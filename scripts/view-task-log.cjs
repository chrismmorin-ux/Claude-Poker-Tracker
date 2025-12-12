#!/usr/bin/env node
/**
 * view-task-log.cjs - View and filter local model task execution logs
 *
 * Usage: node scripts/view-task-log.cjs [options]
 *
 * Options:
 *   --status=success|failed|in_progress  Filter by status
 *   --model=qwen|deepseek                Filter by model
 *   --task-id=T-XXX                      Filter by task ID prefix
 *   --last=N                             Show last N entries
 *   --verbose                            Show full details
 *   --help                               Show this help
 */

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(process.cwd(), '.claude', 'logs', 'local-model-tasks.log');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg === '--help') args.help = true;
    else if (arg === '--verbose') args.verbose = true;
    else if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key.replace(/-/g, '_')] = value;
    }
  });
  return args;
}

function showHelp() {
  console.log(`
view-task-log - View local model task execution logs

Usage: node scripts/view-task-log.cjs [options]

Options:
  --status=STATUS     Filter by status (success|failed|in_progress)
  --model=MODEL       Filter by model (qwen|deepseek)
  --task-id=PREFIX    Filter by task ID prefix (e.g., T-LEARN)
  --last=N            Show only last N entries
  --verbose           Show full JSON details
  --help              Show this help message

Examples:
  node scripts/view-task-log.cjs --last=10
  node scripts/view-task-log.cjs --status=failed
  node scripts/view-task-log.cjs --model=qwen --verbose
`);
}

function readLogs() {
  if (!fs.existsSync(LOG_FILE)) {
    console.log('No log file found. Run some tasks first.');
    return [];
  }

  const content = fs.readFileSync(LOG_FILE, 'utf8');
  const lines = content.trim().split('\n').filter(l => l.trim());

  return lines.map(line => {
    try {
      return JSON.parse(line);
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
}

function formatDuration(ms) {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleTimeString();
}

function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    return;
  }

  let entries = readLogs();

  // Apply filters
  if (args.status) {
    entries = entries.filter(e => e.status === args.status);
  }
  if (args.model) {
    entries = entries.filter(e => e.model === args.model);
  }
  if (args.task_id) {
    entries = entries.filter(e => e.task_id && e.task_id.startsWith(args.task_id));
  }

  // Apply last N
  if (args.last) {
    entries = entries.slice(-parseInt(args.last, 10));
  }

  if (entries.length === 0) {
    console.log('No matching log entries found.');
    return;
  }

  if (args.verbose) {
    entries.forEach(e => {
      console.log(JSON.stringify(e, null, 2));
      console.log('---');
    });
    return;
  }

  // Table output
  console.log('');
  console.log('Time     | Task ID        | Model    | Status      | Duration');
  console.log('-'.repeat(65));

  entries.forEach(entry => {
    const time = formatTimestamp(entry.timestamp);
    const taskId = (entry.task_id || '-').padEnd(14);
    const model = (entry.model || '-').padEnd(8);
    const status = (entry.status || '-').padEnd(11);
    const duration = formatDuration(entry.execution?.duration_ms);

    console.log(`${time} | ${taskId} | ${model} | ${status} | ${duration}`);
  });

  console.log('');
  console.log(`Total: ${entries.length} entries`);
}

main();
