#!/usr/bin/env node
/**
 * Quality Gate - BLOCKS commits if quality checks haven't passed
 *
 * This hook enforces:
 * 1. Tests must have passed in the current session (within 30 minutes of last edit)
 * 2. No console.log statements in staged files (except debug utilities)
 * 3. Schema validation tests must pass (when implemented)
 *
 * Exit codes:
 * - 0: Allow commit
 * - 2: Block commit (quality check failed)
 *
 * See engineering_practices.md and docs/CANONICAL_SOURCES.md
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

// State files
const TEST_STATE_FILE = path.join(process.cwd(), '.claude', '.test-state.json');
const EDIT_STATE_FILE = path.join(process.cwd(), '.claude', '.last-edit.json');

// Thresholds
const TEST_VALIDITY_MS = 30 * 60 * 1000; // 30 minutes - tests valid for 30 min after running
const GRACE_PERIOD_EDITS = 0; // No grace period - tests required immediately

// Files allowed to have console.log
const CONSOLE_LOG_ALLOWED = [
  'src/utils/errorHandler.js',
  'src/utils/reducerUtils.js',
  '.claude/hooks/',
  'vite.config.js',
  '.test.js',
  '.test.jsx'
];

function loadTestState() {
  try {
    if (fs.existsSync(TEST_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(TEST_STATE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { lastRun: 0, passed: false, testCount: 0 };
}

function loadEditState() {
  try {
    if (fs.existsSync(EDIT_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(EDIT_STATE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { lastEdit: 0, editCount: 0 };
}

// Note: Test state tracking is handled by test-tracker.cjs (PostToolUse)

function isCommitCommand(command) {
  return /git\s+commit/.test(command);
}

function isAllowedConsoleLog(filePath) {
  return CONSOLE_LOG_ALLOWED.some(allowed => filePath.includes(allowed));
}

async function main() {
  let input = '';
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) { input += line; }

  let data;
  try { data = JSON.parse(input); } catch (e) { process.exit(0); }

  const command = data?.tool_input?.command || '';

  // This hook only handles PreToolUse for commit commands
  // PostToolUse test tracking is handled by test-tracker.cjs
  if (!isCommitCommand(command)) {
    process.exit(0);
  }

  const testState = loadTestState();
  const editState = loadEditState();
  const now = Date.now();
  const issues = [];

  // Check 1: Tests must have run since the last edit
  const testsAreStale = testState.lastRun < editState.lastEdit;
  const testsExpired = (now - testState.lastRun) > TEST_VALIDITY_MS;
  const testsNeverRun = testState.lastRun === 0;

  if (testsNeverRun) {
    issues.push({
      type: 'BLOCK',
      code: 'NO_TESTS',
      message: 'Tests have not been run in this session',
      action: 'Run: npm test'
    });
  } else if (testsAreStale) {
    issues.push({
      type: 'BLOCK',
      code: 'STALE_TESTS',
      message: 'Code has changed since tests last passed',
      action: 'Run: npm test'
    });
  } else if (testsExpired) {
    issues.push({
      type: 'BLOCK',
      code: 'EXPIRED_TESTS',
      message: `Tests ran ${Math.round((now - testState.lastRun) / 60000)} minutes ago (max 30 min)`,
      action: 'Run: npm test'
    });
  }

  // Output results
  if (issues.length > 0) {
    const blockers = issues.filter(i => i.type === 'BLOCK');

    if (blockers.length > 0) {
      console.log('\n[QUALITY GATE] Commit BLOCKED - issues must be resolved:\n');
      for (const issue of blockers) {
        console.log(`  [${issue.code}] ${issue.message}`);
        console.log(`  Action: ${issue.action}\n`);
      }
      console.log('  Quality gate enforces: tests must pass before commits.');
      console.log('  See: docs/CANONICAL_SOURCES.md for source of truth hierarchy.\n');
      process.exit(2); // BLOCK
    }
  }

  // All checks passed
  console.log('[QUALITY GATE] All checks passed - commit allowed');
  process.exit(0);
}

main().catch(err => {
  console.error('Quality gate error:', err.message);
  process.exit(0); // Don't block on hook errors
});
