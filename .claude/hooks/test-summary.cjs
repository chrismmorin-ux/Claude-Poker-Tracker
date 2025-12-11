#!/usr/bin/env node
/**
 * Test Summary - Appends compact test output summary for token optimization
 *
 * PostToolUse hook for Bash commands. Detects test runs and appends
 * a compact summary block at the end of output.
 *
 * Exit codes:
 * - 0: Always allows (informational only)
 */

const readline = require('readline');

function isTestCommand(command) {
  return /npm\s+(test|run\s+test)/.test(command) ||
         /vitest/.test(command) ||
         /npm\s+run\s+test:coverage/.test(command);
}

function drawBox(title, lines) {
  const width = 55;
  const top = '═'.repeat(width);
  const mid = '─'.repeat(width);

  console.log(`\n${top}`);
  console.log(title);
  console.log(mid);
  lines.forEach(line => console.log(line));
  console.log(mid);
  console.log('(Full output above - focus on this summary)');
  console.log(top);
}

async function main() {
  let input = '';
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) { input += line; }

  let data;
  try { data = JSON.parse(input); } catch (e) { process.exit(0); }

  const command = data?.tool_input?.command || '';
  const toolResponse = data?.tool_response || {};
  const stdout = toolResponse?.stdout || '';

  // Only process test commands
  if (!isTestCommand(command)) {
    process.exit(0);
  }

  // Strip ANSI escape codes for reliable matching
  const clean = stdout.replace(/\x1b\[[0-9;]*m/g, '');

  // Parse test output
  const filesPassedMatch = clean.match(/Test Files\s+(\d+)\s+passed/);
  const filesFailedMatch = clean.match(/Test Files\s+(\d+)\s+failed/);
  const testsPassedMatch = clean.match(/Tests\s+(\d+)\s+passed/);
  const testsFailedMatch = clean.match(/Tests\s+(\d+)\s+failed/);
  const durationMatch = clean.match(/Duration\s+([\d.]+)s/);

  const filesPassed = filesPassedMatch ? parseInt(filesPassedMatch[1]) : 0;
  const filesFailed = filesFailedMatch ? parseInt(filesFailedMatch[1]) : 0;
  const testsPassed = testsPassedMatch ? parseInt(testsPassedMatch[1]) : 0;
  const testsFailed = testsFailedMatch ? parseInt(testsFailedMatch[1]) : 0;
  const duration = durationMatch ? durationMatch[1] : '?';

  // Only show summary if we detected valid test output
  if (testsPassed === 0 && testsFailed === 0) {
    process.exit(0);
  }

  const hasFailed = testsFailed > 0 || filesFailed > 0;
  const status = hasFailed ? '✗ FAILURES DETECTED' : '✓ ALL PASSED';

  const lines = [`Status: ${status}`];

  // Files line
  if (filesFailed > 0) {
    lines.push(`Files:  ${filesPassed} passed, ${filesFailed} failed`);
  } else {
    lines.push(`Files:  ${filesPassed} passed`);
  }

  // Tests line
  if (testsFailed > 0) {
    lines.push(`Tests:  ${testsPassed} passed, ${testsFailed} failed`);
  } else {
    lines.push(`Tests:  ${testsPassed} passed`);
  }

  lines.push(`Time:   ${duration}s`);

  // On failure, extract failed file paths
  if (hasFailed) {
    const failedFiles = [];
    // Match lines like: ✗ src/path/to/file.test.jsx (N tests) or FAIL src/...
    const failedFileMatches = clean.matchAll(/[✗×]\s+(src\/[^\s(]+\.test\.(js|jsx))/g);
    for (const match of failedFileMatches) {
      if (!failedFiles.includes(match[1])) {
        failedFiles.push(match[1]);
      }
    }

    if (failedFiles.length > 0) {
      lines.push('');
      lines.push('FAILED FILES:');
      failedFiles.slice(0, 5).forEach(f => lines.push(`  - ${f}`));
      if (failedFiles.length > 5) {
        lines.push(`  ... and ${failedFiles.length - 5} more`);
      }
    }
  }

  drawBox('TEST SUMMARY', lines);
  process.exit(0);
}

main().catch(err => {
  console.error('Test summary error:', err.message);
  process.exit(0);
});
