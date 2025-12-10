#!/usr/bin/env node
/**
 * Test Tracker - Records when tests are run and their results
 *
 * Works with quality-gate.cjs to track test status.
 * Runs as PostToolUse hook after Bash commands to detect test runs.
 *
 * Exit codes:
 * - 0: Always allows (informational only)
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const TEST_STATE_FILE = path.join(process.cwd(), '.claude', '.test-state.json');
const EDIT_STATE_FILE = path.join(process.cwd(), '.claude', '.last-edit.json');

function isTestCommand(command) {
  return /npm\s+(test|run\s+test)/.test(command) ||
         /vitest/.test(command) ||
         /npm\s+run\s+test:coverage/.test(command);
}

function saveTestState(state) {
  try {
    const dir = path.dirname(TEST_STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TEST_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {}
}

function clearEditState() {
  // Reset edit counter when tests pass (they've validated recent changes)
  try {
    const dir = path.dirname(EDIT_STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(EDIT_STATE_FILE, JSON.stringify({
      lastEdit: 0,  // Reset to 0 so tests are "fresh"
      editCount: 0,
      files: [],
      clearedAfterTests: Date.now()
    }, null, 2));
  } catch (e) {}
}

async function main() {
  let input = '';
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) { input += line; }

  let data;
  try { data = JSON.parse(input); } catch (e) { process.exit(0); }

  const command = data?.tool_input?.command || '';
  // tool_response is the correct field name (not tool_result)
  const toolResponse = data?.tool_response || {};
  const stdout = toolResponse?.stdout || '';

  // Only track test commands
  if (!isTestCommand(command)) {
    process.exit(0);
  }

  // Strip ANSI escape codes for reliable matching
  const cleanStdout = stdout.replace(/\x1b\[[0-9;]*m/g, '');

  // Detect if tests passed by looking for success indicators
  // Vitest output format: "Tests  2235 passed"
  // Use specific pattern to match "Tests" line (with spaces), not "Test Files" line
  const passedMatch = cleanStdout.match(/Tests\s+(\d+)\s+passed/);
  const failedMatch = cleanStdout.match(/Tests\s+(\d+)\s+failed/);

  const testsPassed = passedMatch && (!failedMatch || parseInt(failedMatch[1]) === 0);
  const testCount = passedMatch ? parseInt(passedMatch[1]) : 0;

  if (testsPassed) {
    // Record successful test run
    saveTestState({
      lastRun: Date.now(),
      passed: true,
      testCount: testCount,
      command: command
    });

    // Clear the edit state since tests have validated changes
    clearEditState();

    console.log(`[TEST TRACKER] ${testCount} tests passed - quality gate cleared`);
  } else if (failedMatch) {
    // Record failed test run
    saveTestState({
      lastRun: Date.now(),
      passed: false,
      failedCount: parseInt(failedMatch[1]),
      command: command
    });

    console.log(`[TEST TRACKER] Tests failed - quality gate will block commits`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Test tracker error:', err.message);
  process.exit(0);
});
