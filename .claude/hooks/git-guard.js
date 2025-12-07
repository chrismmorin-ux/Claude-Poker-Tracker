#!/usr/bin/env node
/**
 * Git Guard Hook - Enforces version control standards from engineering_practices.md
 *
 * Blocks:
 * - Force push to main/master
 * - Hard reset on main/master
 * - Direct commits to main without branch (warns)
 *
 * Exit codes:
 * - 0: Allow
 * - 1: Allow with warning (message printed)
 * - 2: Block (message printed)
 */

const readline = require('readline');

async function main() {
  // Read JSON from stdin
  let input = '';
  const rl = readline.createInterface({ input: process.stdin });

  for await (const line of rl) {
    input += line;
  }

  let data;
  try {
    data = JSON.parse(input);
  } catch (e) {
    // Not valid JSON, allow
    process.exit(0);
  }

  const command = data?.tool_input?.command || '';

  // Normalize command for pattern matching
  const cmd = command.toLowerCase().replace(/\s+/g, ' ').trim();

  // BLOCK: Force push to main/master
  if (/git\s+push\s+.*--force/.test(cmd) || /git\s+push\s+-f/.test(cmd)) {
    if (/\b(main|master)\b/.test(cmd) || !/\b\w+\/\w+\b/.test(cmd)) {
      console.log('BLOCKED: Force push to main/master is prohibited.');
      console.log('See engineering_practices.md Section 1: Branch Protection Rules');
      console.log('');
      console.log('If you need to force push to a feature branch, specify the branch explicitly:');
      console.log('  git push --force origin feature/your-branch');
      process.exit(2);
    }
  }

  // BLOCK: Hard reset on main/master
  if (/git\s+reset\s+--hard/.test(cmd)) {
    // Check if we're on main/master
    if (/\b(main|master|origin\/main|origin\/master)\b/.test(cmd)) {
      console.log('BLOCKED: Hard reset on main/master is prohibited.');
      console.log('See engineering_practices.md Section 1: Branch Protection Rules');
      process.exit(2);
    }
  }

  // WARN: Committing directly (might be on main)
  if (/git\s+commit\s/.test(cmd) && !/-m\s+["']?(feat|fix|refactor|docs|test|style|chore|perf)/.test(cmd)) {
    console.log('WARNING: Commit message may not follow conventional format.');
    console.log('Expected format: <type>: <description>');
    console.log('Types: feat, fix, refactor, docs, test, style, chore, perf');
    console.log('See engineering_practices.md Section 2: Commit Format');
    // Don't block, just warn
  }

  // WARN: Amending commits (risky if pushed)
  if (/git\s+commit\s+--amend/.test(cmd)) {
    console.log('WARNING: Amending commits. Ensure this commit has not been pushed.');
    console.log('See engineering_practices.md Section 2: History Hygiene Rules');
  }

  // BLOCK: Rebase with -i (interactive) - not supported in non-interactive shells
  if (/git\s+rebase\s+-i/.test(cmd) || /git\s+add\s+-i/.test(cmd)) {
    console.log('BLOCKED: Interactive git commands (-i) are not supported in this environment.');
    console.log('Use non-interactive alternatives or run manually in your terminal.');
    process.exit(2);
  }

  // BLOCK: Merge to main without PR (direct merge)
  if (/git\s+merge\s+.*\b(main|master)\b/.test(cmd)) {
    console.log('WARNING: Merging to/from main. Ensure this follows PR workflow.');
    console.log('See engineering_practices.md Section 1: Branch Workflow');
  }

  // Allow
  process.exit(0);
}

main().catch(err => {
  console.error('Hook error:', err.message);
  process.exit(0); // Fail open
});
