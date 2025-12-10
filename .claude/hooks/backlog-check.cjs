#!/usr/bin/env node
/**
 * Backlog Check Hook - Reminds Claude to read BACKLOG.md at session start
 *
 * Hook Type: UserPromptSubmit (runs on first user message)
 *
 * The BACKLOG.md is the single source of truth for all work tracking.
 * This hook reminds Claude to read it before starting any work.
 *
 * Exit codes:
 * - 0: Always allow (informational only)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const BACKLOG_FILE = path.join(process.cwd(), '.claude', 'BACKLOG.md');
const SESSION_FILE = path.join(process.cwd(), '.claude', '.backlog-check-shown.json');

// Only show once per session (2 hour window)
const SESSION_WINDOW_MS = 2 * 60 * 60 * 1000;

function hasShownRecently() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      const age = Date.now() - data.timestamp;
      return age < SESSION_WINDOW_MS;
    }
  } catch (e) {}
  return false;
}

function markShown() {
  try {
    const dir = path.dirname(SESSION_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ timestamp: Date.now() }));
  } catch (e) {}
}

function getBacklogSummary() {
  try {
    if (!fs.existsSync(BACKLOG_FILE)) return null;

    const content = fs.readFileSync(BACKLOG_FILE, 'utf8');

    // Extract active work section
    const activeMatch = content.match(/## Active Work[\s\S]*?(?=\n---|\n## (?!Active))/);
    const activeSection = activeMatch ? activeMatch[0] : '';

    // Count active tasks
    const taskRows = (activeSection.match(/^\| [^-|]/gm) || []).length;

    // Extract project priority order for current focus
    const priorityMatch = content.match(/│\s*\d+\.\s*P\d\s*│[^│]+│\s*◀[^│]+│/);
    const currentProject = priorityMatch
      ? priorityMatch[0].match(/│([^│]+)│\s*◀/)?.[1]?.trim()
      : null;

    return {
      hasActiveTasks: taskRows > 0,
      currentProject,
    };
  } catch (e) {
    return null;
  }
}

async function main() {
  // Consume stdin
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) { /* consume */ }

  // Only show once per session window
  if (hasShownRecently()) {
    process.exit(0);
  }

  const summary = getBacklogSummary();

  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│  📋 BACKLOG REMINDER - Single Source of Truth              │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│                                                             │');
  console.log('│  Before starting work, read: .claude/BACKLOG.md            │');
  console.log('│                                                             │');
  if (summary?.currentProject) {
    console.log(`│  Current focus: ${summary.currentProject.substring(0, 40).padEnd(40)}│`);
  }
  console.log('│                                                             │');
  console.log('│  Update BACKLOG.md as you work:                            │');
  console.log('│  - Add tasks to "Current Session Tasks"                    │');
  console.log('│  - Update "Active Projects" progress                       │');
  console.log('│  - Move completed items to archive                         │');
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  markShown();
  process.exit(0);
}

main().catch(err => {
  console.error('[BACKLOG] Hook error:', err.message);
  process.exit(0);
});
