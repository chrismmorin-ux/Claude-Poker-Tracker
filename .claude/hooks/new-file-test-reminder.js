#!/usr/bin/env node
/**
 * New File Test Reminder - Suggests test generation for new testable files
 *
 * Triggers when Write tool creates files in:
 * - src/utils/
 * - src/hooks/
 * - src/reducers/
 *
 * See engineering_practices.md Section 4: Testing Expectations
 *
 * Exit codes:
 * - 0: Always allow (suggestion only)
 */

const readline = require('readline');
const path = require('path');

// Patterns for files that should have tests
const TESTABLE_PATTERNS = [
  { pattern: /src[\\\/]utils[\\\/](?!.*\.test\.js$).*\.js$/, type: 'utility' },
  { pattern: /src[\\\/]hooks[\\\/](?!.*\.test\.js$).*\.js$/, type: 'hook' },
  { pattern: /src[\\\/]reducers[\\\/](?!.*\.test\.js$).*\.js$/, type: 'reducer' }
];

async function main() {
  let input = '';
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) { input += line; }

  let data;
  try { data = JSON.parse(input); } catch (e) { process.exit(0); }

  // Only process Write tool
  if (data?.tool !== 'Write') process.exit(0);

  const filePath = data?.tool_input?.file_path || '';
  if (!filePath) process.exit(0);

  for (const { pattern, type } of TESTABLE_PATTERNS) {
    if (pattern.test(filePath)) {
      const fileName = path.basename(filePath);
      console.log(`\n[TEST-REMINDER] New ${type} file created: ${fileName}`);
      console.log(`  This file type should have unit tests.`);
      console.log(`  Run: /gen-tests ${filePath}`);
      console.log(`  See: engineering_practices.md Section 4: Testing Expectations`);
      break;
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Hook error:', err.message);
  process.exit(0);
});
