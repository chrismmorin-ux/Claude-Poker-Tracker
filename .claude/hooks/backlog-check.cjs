#!/usr/bin/env node
/**
 * Backlog & Context Check Hook - Session start reminder
 *
 * Hook Type: UserPromptSubmit (runs on first user message)
 *
 * Reminds Claude to:
 * 1. Read BACKLOG.md (single source of truth for work tracking)
 * 2. Read context summary files BEFORE full source files (token optimization)
 *
 * Exit codes:
 * - 0: Always allow (informational only)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const BACKLOG_FILE = path.join(process.cwd(), '.claude', 'BACKLOG.md');
const CONTEXT_DIR = path.join(process.cwd(), '.claude', 'context');
const SESSION_FILE = path.join(process.cwd(), '.claude', '.backlog-check-shown.json');

// Only show once per session (2 hour window)
const SESSION_WINDOW_MS = 2 * 60 * 60 * 1000;

// Context files with estimated token counts
const CONTEXT_FILES = [
  { name: 'CONTEXT_SUMMARY.md', tokens: 400, desc: 'Project overview' },
  { name: 'STATE_SCHEMA.md', tokens: 500, desc: 'All 5 reducer shapes' },
  { name: 'PERSISTENCE_OVERVIEW.md', tokens: 400, desc: 'IndexedDB API' },
  { name: 'RECENT_CHANGES.md', tokens: 350, desc: 'Last 4 versions' },
  { name: 'HOTSPOTS.md', tokens: 400, desc: 'Critical files' },
  { name: 'PROCESS_CHECKLIST.md', tokens: 300, desc: 'Workflow steps' },
];

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

function getAvailableContextFiles() {
  const available = [];
  let totalTokens = 0;

  for (const file of CONTEXT_FILES) {
    const filePath = path.join(CONTEXT_DIR, file.name);
    if (fs.existsSync(filePath)) {
      available.push(file);
      totalTokens += file.tokens;
    }
  }

  return { files: available, totalTokens };
}

async function main() {
  // Consume stdin with timeout
  try {
    const rl = readline.createInterface({
      input: process.stdin,
      terminal: false
    });
    const timeout = setTimeout(() => rl.close(), 1000);
    for await (const line of rl) { /* consume */ }
    clearTimeout(timeout);
  } catch (e) {}

  // Only show once per session window
  if (hasShownRecently()) {
    process.exit(0);
  }

  const summary = getBacklogSummary();
  const contextInfo = getAvailableContextFiles();

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  📋 SESSION START - Read Before Working                     │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│                                                             │');
  console.log('│  1. BACKLOG: .claude/BACKLOG.md (work tracking)            │');
  console.log('│                                                             │');

  if (summary?.currentProject) {
    const proj = summary.currentProject.substring(0, 43);
    console.log(`│     Current focus: ${proj.padEnd(38)}│`);
    console.log('│                                                             │');
  }

  console.log('│  2. CONTEXT FILES (read BEFORE full source files):         │');
  console.log('│                                                             │');

  // List available context files with token counts
  for (const file of contextInfo.files.slice(0, 4)) {
    const entry = `     .claude/context/${file.name}`;
    const tokens = `(~${file.tokens} tok)`;
    const padLen = 59 - entry.length - tokens.length - 2;
    console.log(`│${entry}${' '.repeat(Math.max(1, padLen))}${tokens} │`);
  }

  if (contextInfo.files.length > 4) {
    console.log(`│     ... and ${contextInfo.files.length - 4} more files                                    │`);
  }

  console.log('│                                                             │');
  console.log(`│     Total: ~${String(contextInfo.totalTokens).padEnd(4)} tokens (vs ~3000+ for raw files)    │`);
  console.log('│                                                             │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│  💡 TOKEN OPTIMIZATION TIP                                  │');
  console.log('│                                                             │');
  console.log('│  Read context summaries FIRST. Only request full source    │');
  console.log('│  files when summaries are insufficient for the task.       │');
  console.log('│                                                             │');
  console.log('│  Use Explore agent for codebase questions instead of       │');
  console.log('│  reading multiple files directly.                           │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');

  markShown();
  process.exit(0);
}

main().catch(err => {
  console.error('[BACKLOG] Hook error:', err.message);
  process.exit(0);
});
