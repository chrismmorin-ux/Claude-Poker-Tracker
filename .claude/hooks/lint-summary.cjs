#!/usr/bin/env node
/**
 * Lint Summary - Appends compact ESLint output summary for token optimization
 *
 * PostToolUse hook for Bash commands. Detects lint runs and appends
 * a compact summary block at the end of output.
 *
 * Exit codes:
 * - 0: Always allows (informational only)
 */

const readline = require('readline');

function isLintCommand(command) {
  return /npm\s+run\s+lint/.test(command) ||
         /eslint\s+/.test(command) ||
         /npx\s+eslint/.test(command);
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
  if (lines.length > 1) {
    console.log('(Full output above - focus on this summary)');
  }
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
  const stderr = toolResponse?.stderr || '';
  const exitCode = toolResponse?.exitCode ?? 0;

  // Only process lint commands
  if (!isLintCommand(command)) {
    process.exit(0);
  }

  // Combine stdout and stderr for ESLint (can output to either)
  const output = (stdout + '\n' + stderr).replace(/\x1b\[[0-9;]*m/g, '');

  // Check for clean exit with no issues
  if (exitCode === 0 && output.trim().length < 10) {
    drawBox('LINT SUMMARY', ['Status: ✓ NO ISSUES']);
    process.exit(0);
  }

  // Parse ESLint output
  // ESLint summary line format: "✖ N problems (X errors, Y warnings)"
  const summaryMatch = output.match(/(\d+)\s+problems?\s+\((\d+)\s+errors?,\s+(\d+)\s+warnings?\)/);

  let errorCount = 0;
  let warningCount = 0;

  if (summaryMatch) {
    errorCount = parseInt(summaryMatch[2]);
    warningCount = parseInt(summaryMatch[3]);
  } else {
    // Count individual error/warning markers
    errorCount = (output.match(/error\s+/gi) || []).length;
    warningCount = (output.match(/warning\s+/gi) || []).length;
  }

  // If no issues found, show success
  if (errorCount === 0 && warningCount === 0 && exitCode === 0) {
    drawBox('LINT SUMMARY', ['Status: ✓ NO ISSUES']);
    process.exit(0);
  }

  // Count rule occurrences for TOP ISSUES
  const ruleCounts = {};
  // Match patterns like: "error  rule-name" or "warning  rule-name"
  const ruleMatches = output.matchAll(/(?:error|warning)\s+([a-z][\w/-]+)/gi);
  for (const match of ruleMatches) {
    const rule = match[1];
    ruleCounts[rule] = (ruleCounts[rule] || 0) + 1;
  }

  // Sort rules by count
  const topRules = Object.entries(ruleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const lines = ['Status: ✗ ISSUES FOUND'];

  if (errorCount > 0) {
    lines.push(`Errors:   ${errorCount}`);
  }
  if (warningCount > 0) {
    lines.push(`Warnings: ${warningCount}`);
  }

  if (topRules.length > 0) {
    lines.push('');
    lines.push('TOP ISSUES:');
    topRules.forEach(([rule, count]) => {
      lines.push(`  - ${rule} (${count})`);
    });
  }

  drawBox('LINT SUMMARY', lines);
  process.exit(0);
}

main().catch(err => {
  console.error('Lint summary error:', err.message);
  process.exit(0);
});
