#!/usr/bin/env node
/**
 * Delegation Check Hook - Warns when Claude writes files marked for local models
 *
 * Hook Type: PostToolUse (Write) - runs after Claude writes a file
 *
 * Checks the active project file for Task Delegation Analysis tables.
 * If the written file is marked "Local Model" or "Yes" in the delegation column,
 * outputs a warning that this should have been delegated.
 *
 * This is a POST-write check (informational) - the damage is done but it:
 * 1. Teaches Claude the pattern was violated
 * 2. Logs the violation for efficiency analysis
 * 3. Reminds to delegate similar tasks in the future
 *
 * Exit codes:
 * - 0: Always allow (informational only, cannot block after write)
 */

const fs = require('fs');
const path = require('path');

const PROJECTS_FILE = path.join(process.cwd(), '.claude', 'projects.json');
const VIOLATIONS_FILE = path.join(process.cwd(), '.claude', '.delegation-violations.json');

function getActiveProjectFile() {
  try {
    if (!fs.existsSync(PROJECTS_FILE)) return null;
    const projects = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
    if (projects.active?.length > 0) {
      return projects.active[0].file;
    }
  } catch (e) {}
  return null;
}

function checkDelegationTable(projectContent, filename) {
  // Look for Task Delegation Analysis tables
  // Format: | Task | Complexity | Local Model? | Reason |
  // or: | Task | ... | **Yes** | ...

  const basename = path.basename(filename);

  // Pattern to match table rows that mention this file
  const tableRowPattern = new RegExp(
    `\\|[^|]*${basename.replace(/\./g, '\\.')}[^|]*\\|[^|]*\\|[^|]*(\\*\\*Yes\\*\\*|Local Model|local)[^|]*\\|`,
    'i'
  );

  // Also check for explicit "Owner: Local Model" in step descriptions
  const ownerPattern = new RegExp(
    `###[^#]*${basename.replace(/\./g, '\\.')}[\\s\\S]{0,200}\\*\\*Owner:\\s*Local\\s*Model\\*\\*`,
    'i'
  );

  // Check for file in "Files to Create" with (owner: local)
  const filesToCreatePattern = new RegExp(
    `\\[\\s*\\]\\s*\`[^`]*${basename.replace(/\./g, '\\.')}\`[^(]*\\(owner:\\s*local\\)`,
    'i'
  );

  return tableRowPattern.test(projectContent) ||
         ownerPattern.test(projectContent) ||
         filesToCreatePattern.test(projectContent);
}

function logViolation(filename) {
  try {
    let violations = [];
    if (fs.existsSync(VIOLATIONS_FILE)) {
      violations = JSON.parse(fs.readFileSync(VIOLATIONS_FILE, 'utf8'));
    }
    violations.push({
      file: filename,
      timestamp: new Date().toISOString(),
    });
    // Keep only last 50 violations
    if (violations.length > 50) {
      violations = violations.slice(-50);
    }
    fs.writeFileSync(VIOLATIONS_FILE, JSON.stringify(violations, null, 2));
  } catch (e) {}
}

async function main() {
  // Get the filename from environment or stdin
  // PostToolUse hooks receive tool input/output via stdin as JSON
  let input = '';
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) { input += line; }

  let filename;
  try {
    const data = JSON.parse(input);
    filename = data.tool_input?.file_path || data.file_path;
  } catch (e) {
    // If not JSON, might be raw path
    filename = input.trim();
  }

  if (!filename) {
    process.exit(0);
  }

  // Skip non-source files
  if (!filename.match(/\.(jsx?|tsx?|cjs|mjs)$/)) {
    process.exit(0);
  }

  // Get active project file
  const projectFile = getActiveProjectFile();
  if (!projectFile) {
    process.exit(0);
  }

  const projectPath = path.join(process.cwd(), projectFile);
  if (!fs.existsSync(projectPath)) {
    process.exit(0);
  }

  const projectContent = fs.readFileSync(projectPath, 'utf8');

  // Check if this file should have been delegated
  if (checkDelegationTable(projectContent, filename)) {
    const basename = path.basename(filename);

    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│  ⚠️  DELEGATION VIOLATION DETECTED                          │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│  File: ${basename.padEnd(51)}│`);
    console.log('│                                                             │');
    console.log('│  This file was marked for LOCAL MODEL delegation in the    │');
    console.log('│  project file, but Claude wrote it directly.               │');
    console.log('│                                                             │');
    console.log('│  For similar tasks, use:                                   │');
    console.log('│  - /local-code for new components/utilities                │');
    console.log('│  - /local-refactor for restructuring tasks                 │');
    console.log('│  - /local-test for test generation                         │');
    console.log('│                                                             │');
    console.log('│  Check project file Task Delegation Analysis before coding │');
    console.log('└─────────────────────────────────────────────────────────────┘');
    console.log('');

    logViolation(filename);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[DELEGATION] Hook error:', err.message);
  process.exit(0);
});
