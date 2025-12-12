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
const BACKLOG_FILE = path.join(process.cwd(), '.claude', 'backlog.json');

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

function findTaskInBacklog(filename) {
  // Check backlog.json for open tasks assigned to local models
  try {
    if (!fs.existsSync(BACKLOG_FILE)) return null;

    const backlog = JSON.parse(fs.readFileSync(BACKLOG_FILE, 'utf8'));
    const basename = path.basename(filename);

    // Find any open/in_progress task that touches this file and is assigned to local model
    const task = backlog.tasks?.find(t =>
      (t.status === 'open' || t.status === 'in_progress') &&
      t.assigned_to?.startsWith('local:') &&
      t.files_touched?.some(f => path.basename(f) === basename)
    );

    if (task) {
      const model = task.assigned_to.replace('local:', '');
      return {
        taskId: task.id,
        model: model,
        source: 'backlog'
      };
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
      model: match[2].toLowerCase(),
      source: 'project'
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
      model: ownerMatch[1].toLowerCase(),
      source: 'project'
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

  // Check backlog.json first (new ///LOCAL_TASKS format)
  const backlogTask = findTaskInBacklog(filename);
  if (backlogTask) {
    const basename = path.basename(filename);

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  🛑 BLOCKED: This file must be created by LOCAL MODEL         ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║  File: ${basename.padEnd(54)}║`);
    console.log(`║  Task: ${backlogTask.taskId.padEnd(54)}║`);
    console.log(`║  Model: ${backlogTask.model.padEnd(53)}║`);
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log('║  DO NOT write this file directly. Use dispatcher:             ║');
    console.log('║                                                               ║');
    console.log('║  1. node scripts/dispatcher.cjs assign-next                   ║');
    console.log('║  2. Review output and integrate                               ║');
    console.log('║                                                               ║');
    console.log('║  Or decompose using ///LOCAL_TASKS format:                    ║');
    console.log('║  See .claude/DECOMPOSITION_POLICY.md                          ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

    // Exit with code 2 to BLOCK the operation
    process.exit(2);
  }

  // Fall back to checking project file (old format)
  const projectFile = getActiveProjectFile();
  if (!projectFile) {
    // No active project - allow but remind about decomposition
    console.log('');
    console.log('⚠️  No active project. Consider creating one with /project start <name>');
    console.log('   All tasks should be decomposed for local model execution.');
    console.log('   See .claude/DECOMPOSITION_POLICY.md for details.');
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
    console.log('║  1. Decompose into ///LOCAL_TASKS format                      ║');
    console.log('║  2. Add to backlog: node scripts/dispatcher.cjs add-tasks     ║');
    console.log('║  3. Execute: node scripts/dispatcher.cjs assign-next          ║');
    console.log('║                                                               ║');
    console.log('║  See: .claude/DECOMPOSITION_POLICY.md                         ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

    // Exit with code 2 to BLOCK the operation
    process.exit(2);
  }

  // No matching task found - allow but check if ANY tasks exist
  const hasAtomicTasks = projectContent.includes('| T-0') || fs.existsSync(BACKLOG_FILE);
  if (!hasAtomicTasks) {
    console.log('');
    console.log('⚠️  Project has no atomic task decomposition!');
    console.log('   STOP: Decompose this work into atomic tasks using ///LOCAL_TASKS');
    console.log('   See .claude/DECOMPOSITION_POLICY.md for decomposition guide.');
    console.log('');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[ENFORCE-DELEGATION] Hook error:', err.message);
  process.exit(0); // Don't block on errors
});
