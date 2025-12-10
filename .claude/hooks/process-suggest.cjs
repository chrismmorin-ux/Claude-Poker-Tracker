#!/usr/bin/env node
/**
 * Process Improvement Suggestion Hook
 *
 * Hook Type: PostToolUse (Bash - git commands)
 * Suggests /process-* commands when patterns indicate issues:
 * - Multiple "fix:" commits in a row
 * - High file churn (many files changed)
 * - Long sessions without review
 *
 * Exit codes:
 * - 0: Allow (may output suggestion)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const STATE_FILE = path.join(__dirname, '..', '.process-suggest-state.json');
const SUGGESTION_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes between suggestions

async function readStdin() {
  return new Promise((resolve) => {
    let input = '';
    const rl = readline.createInterface({ input: process.stdin });
    const timeout = setTimeout(() => {
      rl.close();
      resolve('');
    }, 100);

    rl.on('line', line => {
      clearTimeout(timeout);
      input += line;
    });
    rl.on('close', () => {
      clearTimeout(timeout);
      resolve(input);
    });
    rl.on('error', () => {
      clearTimeout(timeout);
      resolve('');
    });
  });
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return {
    lastSuggestion: 0,
    fixCommitsSeen: 0,
    sessionStart: Date.now()
  };
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) { /* ignore */ }
}

async function main() {
  const input = await readStdin();
  let data;
  try {
    data = JSON.parse(input);
  } catch (e) {
    process.exit(0);
  }

  // Only trigger on git commit commands
  const command = data.tool_input?.command || '';
  if (!command.includes('git commit')) {
    process.exit(0);
  }

  const state = loadState();
  const now = Date.now();

  // Check cooldown
  if (now - state.lastSuggestion < SUGGESTION_COOLDOWN_MS) {
    process.exit(0);
  }

  // Check if this looks like a fix commit
  const isFixCommit = command.includes('fix:') ||
                      command.includes('fix(') ||
                      command.includes('bugfix') ||
                      command.includes('hotfix');

  if (isFixCommit) {
    state.fixCommitsSeen = (state.fixCommitsSeen || 0) + 1;
  } else {
    // Reset counter on non-fix commits
    state.fixCommitsSeen = 0;
  }

  // Suggest process-fix after 2+ consecutive fix commits
  if (state.fixCommitsSeen >= 2) {
    console.error('[process-suggest] Multiple fix commits detected.');
    console.error('Consider running: /process-fix last');
    console.error('This will analyze the error pattern and suggest preventions.');
    state.lastSuggestion = now;
    state.fixCommitsSeen = 0; // Reset after suggestion
  }

  // Suggest process-review after 2+ hours
  const sessionDuration = now - state.sessionStart;
  if (sessionDuration > 2 * 60 * 60 * 1000) { // 2 hours
    console.error('[process-suggest] Long session detected (2+ hours).');
    console.error('Consider running: /process-review session');
    console.error('This will review your work for compliance and improvement opportunities.');
    state.lastSuggestion = now;
    state.sessionStart = now; // Reset session timer
  }

  saveState(state);
  process.exit(0);
}

main().catch(err => {
  console.error('[process-suggest] Error:', err.message);
  process.exit(0);
});
