#!/usr/bin/env node
/**
 * Architecture Audit Hook - Logs changes to architecture-significant files
 *
 * Tracks edits to:
 * - Reducers (state management)
 * - Hooks (shared logic)
 * - Constants (configuration)
 * - Main component files
 *
 * This is an informational hook - it logs but doesn't block.
 *
 * Exit codes:
 * - 0: Always allow (logging only)
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Files/patterns considered architecturally significant
const ARCH_PATTERNS = [
  /reducers\//,
  /hooks\//,
  /constants\//,
  /PokerTracker\.jsx$/,
  /persistence\.js$/,
  /CLAUDE\.md$/,
  /engineering_practices\.md$/,
];

async function main() {
  let input = '';
  const rl = readline.createInterface({ input: process.stdin });

  for await (const line of rl) {
    input += line;
  }

  let data;
  try {
    data = JSON.parse(input);
  } catch (e) {
    process.exit(0);
  }

  // Only process Edit tool results
  if (data?.tool !== 'Edit') {
    process.exit(0);
  }

  const filePath = data?.tool_input?.file_path || '';

  // Check if this is an architecturally significant file
  const isArchFile = ARCH_PATTERNS.some(pattern => pattern.test(filePath));

  if (isArchFile) {
    const timestamp = new Date().toISOString();
    const fileName = path.basename(filePath);

    // Log to console (visible in Claude's output)
    console.log(`[ARCH-AUDIT] ${timestamp}`);
    console.log(`  File: ${fileName}`);
    console.log(`  Path: ${filePath}`);
    console.log(`  Note: This file is architecturally significant.`);
    console.log(`  Consider: Does this change need an ADR? (See engineering_practices.md Section 9)`);

    // Optionally log to file (uncomment if you want persistent logging)
    // const logFile = path.join(process.cwd(), '.claude', 'arch-changes.log');
    // const logEntry = `${timestamp} | EDIT | ${filePath}\n`;
    // fs.appendFileSync(logFile, logEntry);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Hook error:', err.message);
  process.exit(0);
});
