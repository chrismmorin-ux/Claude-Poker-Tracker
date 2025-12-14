#!/usr/bin/env node
/**
 * Project Status Hook - Surfaces active/pending projects at chat start
 *
 * Hook Type: UserPromptSubmit (runs on first user message)
 *
 * Reads .claude/projects.json and displays:
 * - Active projects with completion percentage
 * - Pending projects waiting to start
 * - Suggests /project resume command
 *
 * Exit codes:
 * - 0: Always allow (informational only)
 */

const fs = require('fs');
const path = require('path');

const PROJECTS_FILE = path.join(process.cwd(), '.claude', 'projects.json');
const SESSION_FILE = path.join(process.cwd(), '.claude', '.project-status-shown.json');

// Only show once per session (2 hour window)
const SESSION_WINDOW_MS = 2 * 60 * 60 * 1000;

function loadProjects() {
  try {
    if (fs.existsSync(PROJECTS_FILE)) {
      return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[PROJECT] Error reading projects.json:', e.message);
  }
  return { active: [], pending: [], completed: [] };
}

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

function formatProject(project, showFile = false) {
  const priority = project.priority?.toUpperCase() || 'MEDIUM';
  const priorityColor = {
    'HIGH': '🔴',
    'MEDIUM': '🟡',
    'LOW': '🟢'
  }[priority] || '⚪';

  let status = '';
  if (project.phases && project.phasesComplete !== undefined) {
    const pct = Math.round((project.phasesComplete / project.phases) * 100);
    status = ` (${project.phasesComplete}/${project.phases} phases, ${pct}%)`;
  }

  let line = `  ${priorityColor} ${project.name || project.id}${status}`;
  if (showFile && project.file) {
    line += `\n     └─ ${project.file}`;
  }
  return line;
}

async function main() {
  // Read stdin but we don't need the content for this hook
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) { /* consume */ }

  // Only show once per session window
  if (hasShownRecently()) {
    process.exit(0);
  }

  const projects = loadProjects();
  const hasActive = projects.active?.length > 0;
  const hasPending = projects.pending?.length > 0;

  // Nothing to show
  if (!hasActive && !hasPending) {
    process.exit(0);
  }

  // Build status message
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    📋 PROJECT STATUS                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  if (hasActive) {
    console.log('\n🔧 ACTIVE PROJECTS:');
    for (const project of projects.active) {
      console.log(formatProject(project, true));
    }

    if (projects.active.length === 1) {
      console.log(`\n💡 Resume with: /project resume ${projects.active[0].id}`);
    } else {
      console.log('\n💡 Resume with: /project resume <project-id>');
    }
  }

  if (hasPending) {
    console.log('\n⏳ PENDING PROJECTS:');
    for (const project of projects.pending) {
      console.log(formatProject(project));
    }
    console.log('\n💡 Start with: /project start <project-id>');
  }

  console.log('\n📊 View all: /project status');
  console.log('────────────────────────────────────────────────────────────────\n');

  markShown();
  process.exit(0);
}

main().catch(err => {
  console.error('[PROJECT] Hook error:', err.message);
  process.exit(0);
});
