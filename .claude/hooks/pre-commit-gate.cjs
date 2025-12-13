#!/usr/bin/env node
/**
 * Pre-Commit Quality Gate - Suggests review before commit if changes are substantial
 *
 * Checks:
 * - PR size threshold approached (200+ lines)
 * - Multiple files modified (3+)
 * - Review not run recently
 *
 * See engineering_practices.md Section 3: Pull Request Standards
 *
 * Exit codes:
 * - 0: Allow (with optional suggestion)
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const PR_SIZE_FILE = path.join(process.cwd(), '.claude', '.pr-size-session.json');
const REVIEW_FILE = path.join(process.cwd(), '.claude', '.last-review.json');
const VIOLATIONS_FILE = path.join(process.cwd(), '.claude', '.delegation-violations.json');

/**
 * Check for pending delegation violations that must be resolved before commit
 */
function checkDelegationViolations() {
  try {
    if (!fs.existsSync(VIOLATIONS_FILE)) {
      return { hasViolations: false, count: 0 };
    }
    const data = JSON.parse(fs.readFileSync(VIOLATIONS_FILE, 'utf8'));
    const violations = data.violations || [];
    const pending = violations.filter(v => v.status !== 'resolved');
    return { hasViolations: pending.length > 0, count: pending.length, violations: pending };
  } catch (e) {
    return { hasViolations: false, count: 0 };
  }
}

// Thresholds
const LINES_THRESHOLD = 200;
const FILES_THRESHOLD = 3;
const REVIEW_AGE_MS = 60 * 60 * 1000; // 1 hour

function loadPRSize() {
  try {
    if (fs.existsSync(PR_SIZE_FILE)) {
      return JSON.parse(fs.readFileSync(PR_SIZE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { linesChanged: 0, filesChanged: [] };
}

function loadLastReview() {
  try {
    if (fs.existsSync(REVIEW_FILE)) {
      return JSON.parse(fs.readFileSync(REVIEW_FILE, 'utf8'));
    }
  } catch (e) {}
  return { timestamp: 0 };
}

async function main() {
  let input = '';
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) { input += line; }

  let data;
  try { data = JSON.parse(input); } catch (e) { process.exit(0); }

  const command = data?.tool_input?.command || '';

  // Only check git commit commands
  if (!/git\s+commit/.test(command)) {
    process.exit(0);
  }

  // Check for pending delegation violations - BLOCK if any exist
  const violationCheck = checkDelegationViolations();
  if (violationCheck.hasViolations) {
    console.error('\n┌─────────────────────────────────────────────────────────────┐');
    console.error('│  🚫 COMMIT BLOCKED - Pending Delegation Violations          │');
    console.error('├─────────────────────────────────────────────────────────────┤');
    console.error(`│  ${violationCheck.count} unresolved violation(s) must be fixed first.`);
    console.error('│                                                             │');
    console.error('│  To resolve:                                                │');
    console.error('│  → node scripts/dispatcher.cjs redo <task-id>              │');
    console.error('│  → Or mark resolved in .delegation-violations.json         │');
    console.error('└─────────────────────────────────────────────────────────────┘\n');
    process.exit(2);
  }

  const suggestions = [];
  const prSize = loadPRSize();
  const lastReview = loadLastReview();
  const reviewAge = Date.now() - lastReview.timestamp;

  // Check PR size threshold
  if (prSize.linesChanged >= LINES_THRESHOLD && reviewAge > REVIEW_AGE_MS) {
    suggestions.push({
      reason: `${prSize.linesChanged} lines changed since last review`,
      action: '/review staged'
    });
  }

  // Check files count
  const filesCount = prSize.filesChanged?.length || 0;
  if (filesCount >= FILES_THRESHOLD && reviewAge > REVIEW_AGE_MS) {
    suggestions.push({
      reason: `${filesCount} files modified in this session`,
      action: 'npm test'
    });
  }

  // Output suggestions
  if (suggestions.length > 0) {
    console.log('\n[PRE-COMMIT] Quality suggestions before committing:');
    for (const s of suggestions) {
      console.log(`  - ${s.reason}`);
      console.log(`    Consider: ${s.action}`);
    }
    console.log('\n  These are suggestions only - commit will proceed.');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Hook error:', err.message);
  process.exit(0);
});
