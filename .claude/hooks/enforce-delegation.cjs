#!/usr/bin/env node
/**
 * enforce-delegation.cjs - BLOCKS Claude from writing files that should be delegated
 *
 * Hook Type: PreToolUse (Write, Edit) - runs BEFORE Claude writes/edits
 *
 * This is a BLOCKING hook. If the target file matches a task in the active
 * project that's assigned to a local model, it BLOCKS the operation and
 * instructs Claude to use the local model instead.
 *
 * Exit codes:
 * - 0: Allow the operation
 * - 2: BLOCK the operation (with message)
 */

const fs = require('fs');
const path = require('path');

const PROJECTS_FILE = path.join(process.cwd(), '.claude', 'projects.json');

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

function findTaskForFile(projectContent, filename) {
  const basename = path.basename(filename);

  // Look for task table rows: | T-XXX | description | `filename` | model | status |
  const taskPattern = new RegExp(
    `\\|\\s*(T-\\d+)\\s*\\|[^|]+\\|[^|]*\`[^|]*${basename.replace(/\./g, '\\.')}[^|]*\`[^|]*\\|\\s*(deepseek|qwen|local)\\s*\\|\\s*\\[\\s*\\]`,
    'gi'
  );

  const matches = projectContent.matchAll(taskPattern);
  for (const match of matches) {
    return {
      taskId: match[1],
      model: match[2].toLowerCase()
    };
  }

  // Also check Files to Create/Modify with (owner: local)
  const ownerPattern = new RegExp(
    `\\[\\s*\\]\\s*\`[^|]*${basename.replace(/\./g, '\\.')}[^\`]*\`[^\\n]*\\(owner:\\s*(local|deepseek|qwen)\\)`,
    'i'
  );

  const ownerMatch = projectContent.match(ownerPattern);
  if (ownerMatch) {
    return {
      taskId: 'unmarked',
      model: ownerMatch[1].toLowerCase()
    };
  }

  return null;
}

function isHookOrConfigFile(filename) {
  // Don't block editing hook files, configs, or project files themselves
  const skipPatterns = [
    /\.claude\/hooks\//,
    /\.claude\/.*\.json$/,
    /\.claude\/.*\.md$/,
    /docs\/projects\//,
    /package\.json$/,
    /\.config\./,
    /vite\.config/,
    /vitest\.config/,
    /eslint/,
    /prettier/
  ];

  return skipPatterns.some(p => p.test(filename));
}

async function main() {
  // Get the filename from stdin (hook input)
  let input = '';
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) { input += line; }

  let filename;
  try {
    const data = JSON.parse(input);
    filename = data.tool_input?.file_path || data.file_path;
  } catch (e) {
    filename = input.trim();
  }

  if (!filename) {
    process.exit(0);
  }

  // Skip non-source files
  if (!filename.match(/\.(jsx?|tsx?|cjs|mjs)$/)) {
    process.exit(0);
  }

  // Skip hook/config files
  if (isHookOrConfigFile(filename)) {
    process.exit(0);
  }

  // Get active project file
  const projectFile = getActiveProjectFile();
  if (!projectFile) {
    // No active project - allow but remind about decomposition
    console.log('');
    console.log('⚠️  No active project. Consider creating one with /project start <name>');
    console.log('   All tasks should be decomposed for local model execution.');
    console.log('');
    process.exit(0);
  }

  const projectPath = path.join(process.cwd(), projectFile);
  if (!fs.existsSync(projectPath)) {
    process.exit(0);
  }

  const projectContent = fs.readFileSync(projectPath, 'utf8');

  // Check if this file has an incomplete task assigned to local model
  const task = findTaskForFile(projectContent, filename);

  if (task) {
    const basename = path.basename(filename);

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  🛑 BLOCKED: This file must be created by LOCAL MODEL         ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║  File: ${basename.padEnd(54)}║`);
    console.log(`║  Task: ${task.taskId.padEnd(54)}║`);
    console.log(`║  Model: ${task.model.padEnd(53)}║`);
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log('║  DO NOT write this file directly. Instead:                    ║');
    console.log('║                                                               ║');
    console.log('║  1. Create task spec JSON in .claude/task-specs/              ║');
    console.log('║  2. Run: ./scripts/execute-local-task.sh <spec.json>          ║');
    console.log('║  3. Review output and integrate                               ║');
    console.log('║                                                               ║');
    console.log('║  Or use: /local-code "description of what to create"          ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

    // Exit with code 2 to BLOCK the operation
    process.exit(2);
  }

  // No matching task found - allow but check if ANY tasks exist
  const hasAtomicTasks = projectContent.includes('| T-0');
  if (!hasAtomicTasks) {
    console.log('');
    console.log('⚠️  Project has no atomic task decomposition!');
    console.log('   STOP: Decompose this work into atomic tasks (≤30 lines each)');
    console.log('   before implementing. See WORKFLOW.md for decomposition guide.');
    console.log('');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[ENFORCE-DELEGATION] Hook error:', err.message);
  process.exit(0); // Don't block on errors
});
