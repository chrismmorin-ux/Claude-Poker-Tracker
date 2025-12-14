#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const BACKLOG_PATH = path.join(process.cwd(), '.claude', 'backlog.json');
const ARCHIVE_PATH = path.join(process.cwd(), '.claude', 'backlog-archive.json');

// Parse command line arguments
const dryRun = process.argv.includes('--dry-run');
const includeInProgress = process.argv.includes('--include-in-progress');
const showHelp = process.argv.includes('--help') || process.argv.includes('-h');

if (showHelp) {
  console.log(`
archive-backlog-tasks.cjs - Archive completed/failed tasks from backlog

USAGE: node scripts/archive-backlog-tasks.cjs [OPTIONS]

OPTIONS:
  --dry-run                 Show what would be archived without writing
  --include-in-progress     Also archive in_progress tasks (dangerous, for cleanup)
  --help, -h               Show this help message

DESCRIPTION:
Archives tasks that match criteria:
  - status === 'done'
  - status === 'failed'
  - parent_id points to a completed project
  - status === 'in_progress' (only with --include-in-progress)

For each archived task:
  - Adds archived_at: ISO timestamp
  - Appends to .claude/backlog-archive.json
  - Removes from .claude/backlog.json

After archiving:
  - Recalculates backlog.stats (total_tasks, pending, in_progress, done: 0, failed: 0)
  - Writes both files back to disk

EXAMPLES:
  # Show what would be archived
  node scripts/archive-backlog-tasks.cjs --dry-run

  # Archive done/failed tasks
  node scripts/archive-backlog-tasks.cjs

  # Also archive in_progress tasks (for cleanup)
  node scripts/archive-backlog-tasks.cjs --include-in-progress
`);
  process.exit(0);
}

function readJSON(filepath, defaultValue = null) {
  try {
    if (!fs.existsSync(filepath)) {
      return defaultValue !== null ? defaultValue : {};
    }
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (e) {
    console.error(`Error reading ${filepath}:`, e.message);
    return defaultValue !== null ? defaultValue : {};
  }
}

function writeJSON(filepath, data) {
  try {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error(`Error writing ${filepath}:`, e.message);
    return false;
  }
}

function main() {
  console.log('Reading backlog...');
  const backlog = readJSON(BACKLOG_PATH, { tasks: [], projects: {}, stats: { total_tasks: 0, pending: 0, in_progress: 0, done: 0, failed: 0 } });

  console.log('Reading archive...');
  const archive = readJSON(ARCHIVE_PATH, { version: '1.0.0', updated_at: new Date().toISOString(), tasks: [] });

  // Ensure tasks array exists
  if (!Array.isArray(backlog.tasks)) {
    backlog.tasks = [];
  }
  if (!Array.isArray(archive.tasks)) {
    archive.tasks = [];
  }

  const tasksToArchive = [];
  const tasksToKeep = [];

  // Identify tasks for archival
  for (const task of backlog.tasks) {
    let shouldArchive = false;

    // Check if status matches archive criteria
    if (task.status === 'done' || task.status === 'failed') {
      shouldArchive = true;
    } else if (includeInProgress && task.status === 'in_progress') {
      shouldArchive = true;
    } else if (task.parent_id) {
      // Check if parent project is completed
      const parentProject = backlog.projects ? backlog.projects[task.parent_id] : null;
      if (parentProject && parentProject.status === 'completed') {
        shouldArchive = true;
      }
    }

    if (shouldArchive) {
      tasksToArchive.push(task);
    } else {
      tasksToKeep.push(task);
    }
  }

  if (tasksToArchive.length === 0) {
    console.log('No tasks match archive criteria.');
    process.exit(0);
  }

  // Show dry-run output
  if (dryRun) {
    console.log(`\n[DRY RUN] Would archive ${tasksToArchive.length} tasks:`);
    tasksToArchive.forEach(task => {
      console.log(`  - ${task.id}: ${task.title} (${task.status})`);
    });
    console.log(`\nBacklog after archiving: ${tasksToKeep.length} tasks remaining`);
    process.exit(0);
  }

  // Add timestamps and move to archive
  const now = new Date().toISOString();
  const archivedTasks = tasksToArchive.map(task => ({
    ...task,
    archived_at: now
  }));

  // Update archive file
  archive.tasks.push(...archivedTasks);
  archive.updated_at = now;

  // Update backlog
  backlog.tasks = tasksToKeep;

  // Recalculate stats
  const pendingCount = tasksToKeep.filter(t => t.status === 'pending').length;
  const inProgressCount = tasksToKeep.filter(t => t.status === 'in_progress').length;

  backlog.stats = {
    total_tasks: tasksToKeep.length,
    pending: pendingCount,
    in_progress: inProgressCount,
    done: 0,
    failed: 0,
    open: 0
  };

  // Write files
  console.log(`\nWriting ${tasksToArchive.length} archived tasks to ${ARCHIVE_PATH}...`);
  if (!writeJSON(ARCHIVE_PATH, archive)) {
    console.error('Failed to write archive file');
    process.exit(1);
  }

  console.log(`Updating backlog with ${tasksToKeep.length} remaining tasks...`);
  if (!writeJSON(BACKLOG_PATH, backlog)) {
    console.error('Failed to write backlog file');
    process.exit(1);
  }

  // Success output
  console.log('\n' + '='.repeat(70));
  console.log(`✓ Archived ${tasksToArchive.length} tasks. Backlog: ${tasksToKeep.length} tasks remaining.`);
  console.log('='.repeat(70));

  process.exit(0);
}

main();
