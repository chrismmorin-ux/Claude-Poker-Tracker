#!/usr/bin/env node
/**
 * archive-old-tasks.cjs - Move completed/failed tasks to archive
 *
 * Reduces backlog.json size by archiving done/abandoned/failed tasks
 * to backlog-archive.json for historical reference.
 */

const fs = require('fs');
const path = require('path');

const BACKLOG_PATH = path.join(process.cwd(), '.claude', 'backlog.json');
const ARCHIVE_PATH = path.join(process.cwd(), '.claude', 'backlog-archive.json');

// Statuses to archive
const ARCHIVE_STATUSES = ['done', 'abandoned', 'failed'];

function main() {
  // Load backlog
  const backlog = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf8'));
  const originalCount = backlog.tasks.length;

  // Load or create archive
  let archive;
  if (fs.existsSync(ARCHIVE_PATH)) {
    archive = JSON.parse(fs.readFileSync(ARCHIVE_PATH, 'utf8'));
  } else {
    archive = {
      version: '1.0.0',
      description: 'Archived tasks from backlog.json',
      created_at: new Date().toISOString(),
      tasks: []
    };
  }

  // Separate tasks
  const toArchive = backlog.tasks.filter(t => ARCHIVE_STATUSES.includes(t.status));
  const toKeep = backlog.tasks.filter(t => !ARCHIVE_STATUSES.includes(t.status));

  // Count by status
  const doneCount = toArchive.filter(t => t.status === 'done').length;
  const failedCount = toArchive.filter(t => t.status === 'failed').length;
  const abandonedCount = toArchive.filter(t => t.status === 'abandoned').length;

  // Add archive timestamp to each task
  const archivedTasks = toArchive.map(t => ({
    ...t,
    archived_at: new Date().toISOString()
  }));

  // Append to archive
  archive.tasks = [...archive.tasks, ...archivedTasks];
  archive.updated_at = new Date().toISOString();

  // Update backlog
  backlog.tasks = toKeep;
  backlog.updated_at = new Date().toISOString();

  // Write files
  fs.writeFileSync(ARCHIVE_PATH, JSON.stringify(archive, null, 2));
  fs.writeFileSync(BACKLOG_PATH, JSON.stringify(backlog, null, 2));

  // Print summary
  console.log('\n📦 Task Archive Complete');
  console.log('========================');
  console.log(`Original backlog: ${originalCount} tasks`);
  console.log(`Archived: ${toArchive.length} tasks (done: ${doneCount}, failed: ${failedCount}, abandoned: ${abandonedCount})`);
  console.log(`Remaining in backlog: ${toKeep.length} tasks`);

  if (originalCount > 0) {
    const reduction = ((1 - toKeep.length / originalCount) * 100).toFixed(1);
    console.log(`Backlog reduced by ${reduction}%`);
  }

  // Show file sizes
  const backlogSize = fs.statSync(BACKLOG_PATH).size;
  const archiveSize = fs.statSync(ARCHIVE_PATH).size;
  console.log(`\nFile sizes:`);
  console.log(`  backlog.json: ${(backlogSize / 1024).toFixed(1)}KB`);
  console.log(`  backlog-archive.json: ${(archiveSize / 1024).toFixed(1)}KB`);
  console.log('');
}

main();
