#!/usr/bin/env node
/**
 * dispatcher.cjs - Task dispatcher CLI for local model delegation
 *
 * Commands:
 *   add-tasks    - Add tasks from ///LOCAL_TASKS JSON (stdin)
 *   assign-next  - Assign next open task to local model
 *   status       - View backlog status
 *   complete     - Mark task complete with result
 *   audit        - Validate all tasks against atomic criteria
 *   redecompose  - Mark task for re-decomposition
 */

const fs = require('fs');
const path = require('path');

const BACKLOG_PATH = path.join(process.cwd(), '.claude', 'backlog.json');
const SCHEMA_PATH = path.join(process.cwd(), '.claude', 'schemas', 'local-task.schema.json');

// Atomic criteria limits
const ATOMIC_LIMITS = {
  files_touched: 3,
  est_lines_changed: 300,
  est_local_effort_mins: 60
};

// Load backlog
function loadBacklog() {
  if (!fs.existsSync(BACKLOG_PATH)) {
    return {
      version: '1.0.0',
      updated_at: new Date().toISOString(),
      tasks: [],
      projects: {},
      stats: { total_tasks: 0, open: 0, in_progress: 0, done: 0, failed: 0 }
    };
  }
  return JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf8'));
}

// Save backlog
function saveBacklog(backlog) {
  backlog.updated_at = new Date().toISOString();
  backlog.stats = calculateStats(backlog.tasks);
  fs.writeFileSync(BACKLOG_PATH, JSON.stringify(backlog, null, 2));
}

// Calculate stats
function calculateStats(tasks) {
  return {
    total_tasks: tasks.length,
    open: tasks.filter(t => t.status === 'open').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    failed: tasks.filter(t => t.status === 'failed').length
  };
}

// Validate task against atomic criteria
function validateAtomic(task) {
  const errors = [];

  if (!task.id) errors.push('Missing required field: id');
  if (!task.title) errors.push('Missing required field: title');
  if (!task.description) errors.push('Missing required field: description');
  if (!task.test_command) errors.push('Missing required field: test_command');
  if (!task.assigned_to) errors.push('Missing required field: assigned_to');
  if (!task.priority) errors.push('Missing required field: priority');
  if (!task.status) errors.push('Missing required field: status');

  if (!task.files_touched || !Array.isArray(task.files_touched)) {
    errors.push('Missing required field: files_touched (array)');
  } else if (task.files_touched.length > ATOMIC_LIMITS.files_touched) {
    errors.push(`files_touched (${task.files_touched.length}) exceeds limit (${ATOMIC_LIMITS.files_touched})`);
  }

  if (typeof task.est_lines_changed !== 'number') {
    errors.push('Missing required field: est_lines_changed (number)');
  } else if (task.est_lines_changed > ATOMIC_LIMITS.est_lines_changed) {
    errors.push(`est_lines_changed (${task.est_lines_changed}) exceeds limit (${ATOMIC_LIMITS.est_lines_changed})`);
  }

  if (task.est_local_effort_mins && task.est_local_effort_mins > ATOMIC_LIMITS.est_local_effort_mins) {
    errors.push(`est_local_effort_mins (${task.est_local_effort_mins}) exceeds limit (${ATOMIC_LIMITS.est_local_effort_mins})`);
  }

  // Validate needs_context has line ranges
  if (task.needs_context && Array.isArray(task.needs_context)) {
    task.needs_context.forEach((ctx, i) => {
      if (!ctx.path) errors.push(`needs_context[${i}] missing path`);
      if (typeof ctx.lines_start !== 'number') errors.push(`needs_context[${i}] missing lines_start`);
      if (typeof ctx.lines_end !== 'number') errors.push(`needs_context[${i}] missing lines_end`);
    });
  }

  return { valid: errors.length === 0, errors };
}

// Command: add-tasks
async function addTasks() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  // Parse ///LOCAL_TASKS format
  let tasks;
  try {
    // Handle ///LOCAL_TASKS prefix
    const jsonStr = input.replace(/^\/\/\/LOCAL_TASKS\s*/i, '').trim();
    tasks = JSON.parse(jsonStr);
    if (!Array.isArray(tasks)) tasks = [tasks];
  } catch (e) {
    console.error('Error parsing tasks:', e.message);
    process.exit(1);
  }

  const backlog = loadBacklog();
  let added = 0, blocked = 0;

  for (const task of tasks) {
    const validation = validateAtomic(task);
    if (!validation.valid) {
      console.error(`\nBLOCKED: Task ${task.id || 'unknown'}`);
      validation.errors.forEach(e => console.error(`  - ${e}`));
      blocked++;
      continue;
    }

    // Check for duplicate
    if (backlog.tasks.find(t => t.id === task.id)) {
      console.log(`Skipped duplicate: ${task.id}`);
      continue;
    }

    task.status = task.status || 'open';
    backlog.tasks.push(task);
    added++;
    console.log(`Added: ${task.id} - ${task.title}`);
  }

  saveBacklog(backlog);
  console.log(`\nSummary: ${added} added, ${blocked} blocked`);

  if (blocked > 0) {
    process.exit(2); // Signal validation failures
  }
}

// Command: assign-next
function assignNext() {
  const backlog = loadBacklog();
  const openTask = backlog.tasks.find(t => t.status === 'open');

  if (!openTask) {
    console.log('No open tasks in backlog');
    process.exit(0);
  }

  openTask.status = 'in_progress';
  openTask.assigned_at = new Date().toISOString();
  saveBacklog(backlog);

  // Output task as JSON for local model consumption
  console.log(JSON.stringify(openTask, null, 2));
}

// Command: status
function showStatus() {
  const backlog = loadBacklog();

  console.log('\n=== Backlog Status ===\n');
  console.log(`Total: ${backlog.stats.total_tasks}`);
  console.log(`Open: ${backlog.stats.open}`);
  console.log(`In Progress: ${backlog.stats.in_progress}`);
  console.log(`Done: ${backlog.stats.done}`);
  console.log(`Failed: ${backlog.stats.failed}`);

  if (backlog.tasks.length > 0) {
    console.log('\n--- Open Tasks ---');
    backlog.tasks
      .filter(t => t.status === 'open')
      .slice(0, 10)
      .forEach(t => console.log(`  ${t.id}: ${t.title} [${t.priority}]`));

    const inProgress = backlog.tasks.filter(t => t.status === 'in_progress');
    if (inProgress.length > 0) {
      console.log('\n--- In Progress ---');
      inProgress.forEach(t => console.log(`  ${t.id}: ${t.title}`));
    }
  }

  console.log('\n--- Projects ---');
  Object.entries(backlog.projects).forEach(([id, p]) => {
    console.log(`  ${id}: ${p.name} (Phase ${p.phase}/${p.total_phases}) [${p.status}]`);
  });
}

// Command: complete
function completeTask(taskId, testsPassed) {
  const backlog = loadBacklog();
  const task = backlog.tasks.find(t => t.id === taskId);

  if (!task) {
    console.error(`Task not found: ${taskId}`);
    process.exit(1);
  }

  task.status = testsPassed ? 'done' : 'review';
  task.completed_at = new Date().toISOString();
  task.tests_passed = testsPassed;

  saveBacklog(backlog);
  console.log(`Task ${taskId} marked as ${task.status}`);
}

// Command: audit
function auditTasks() {
  const backlog = loadBacklog();
  let valid = 0, invalid = 0;
  const report = { valid: [], invalid: [] };

  console.log('\n=== Atomic Criteria Audit ===\n');

  for (const task of backlog.tasks) {
    const validation = validateAtomic(task);
    if (validation.valid) {
      valid++;
      report.valid.push(task.id);
    } else {
      invalid++;
      report.invalid.push({ id: task.id, errors: validation.errors });
      console.log(`FAIL: ${task.id}`);
      validation.errors.forEach(e => console.log(`  - ${e}`));
    }
  }

  console.log(`\nResults: ${valid} valid, ${invalid} invalid`);

  // Write audit report
  const auditPath = path.join(process.cwd(), '.claude', 'audits', 'atomicity_report.json');
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.writeFileSync(auditPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    total: backlog.tasks.length,
    valid,
    invalid,
    details: report
  }, null, 2));

  console.log(`Report written to: ${auditPath}`);

  if (invalid > 0) process.exit(2);
}

// Command: redecompose
function redecomposeTask(taskId) {
  const backlog = loadBacklog();
  const task = backlog.tasks.find(t => t.id === taskId);

  if (!task) {
    console.error(`Task not found: ${taskId}`);
    process.exit(1);
  }

  task.status = 'blocked';
  task.needs_redecomposition = true;
  task.redecompose_requested_at = new Date().toISOString();

  saveBacklog(backlog);
  console.log(`Task ${taskId} marked for re-decomposition`);
}

// Main
const [,, command, ...args] = process.argv;

switch (command) {
  case 'add-tasks':
    addTasks();
    break;
  case 'assign-next':
    assignNext();
    break;
  case 'status':
    showStatus();
    break;
  case 'complete':
    if (!args[0]) {
      console.error('Usage: dispatcher.cjs complete <task-id> [--tests=passed|failed]');
      process.exit(1);
    }
    const testsPassed = args[1] !== '--tests=failed';
    completeTask(args[0], testsPassed);
    break;
  case 'audit':
    auditTasks();
    break;
  case 'redecompose':
    if (!args[0]) {
      console.error('Usage: dispatcher.cjs redecompose <task-id>');
      process.exit(1);
    }
    redecomposeTask(args[0]);
    break;
  default:
    console.log(`
Dispatcher CLI - Task management for local model delegation

Commands:
  add-tasks              Add tasks from ///LOCAL_TASKS JSON (stdin)
  assign-next            Assign next open task to local model
  status                 View backlog status
  complete <id> [opts]   Mark task complete (--tests=passed|failed)
  audit                  Validate all tasks against atomic criteria
  redecompose <id>       Mark task for re-decomposition

Examples:
  echo '///LOCAL_TASKS [{"id":"T-001",...}]' | node scripts/dispatcher.cjs add-tasks
  node scripts/dispatcher.cjs assign-next
  node scripts/dispatcher.cjs status
  node scripts/dispatcher.cjs complete T-001 --tests=passed
  node scripts/dispatcher.cjs audit
`);
}
