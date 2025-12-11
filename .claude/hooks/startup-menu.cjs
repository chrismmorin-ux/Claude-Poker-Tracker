#!/usr/bin/env node
/**
 * startup-menu.cjs - Low-token startup menu
 *
 * Displays actionable menu at session start (~150 tokens vs ~2000).
 * Shows: active project, next in queue, pending audits, backlog actions
 */

const fs = require('fs');
const path = require('path');

const PROJECTS_DIR = path.join(__dirname, '..', '..', 'docs', 'projects');
const AUDITS_REGISTRY = path.join(__dirname, '..', 'audits', 'registry.json');
const BACKLOG_PATH = path.join(__dirname, '..', 'BACKLOG.md');
const STATE_FILE = path.join(__dirname, '..', '.startup-menu-shown.json');

function shouldShowMenu() {
  // Show once per session (2 hour window)
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const lastShown = new Date(state.lastShown);
    const now = new Date();
    const hoursSince = (now - lastShown) / (1000 * 60 * 60);

    return hoursSince >= 2;
  } catch {
    return true; // No state file, show menu
  }
}

function markShown() {
  fs.writeFileSync(STATE_FILE, JSON.stringify({
    lastShown: new Date().toISOString()
  }));
}

function getProjects() {
  try {
    // Match format: {priority}.{sequence}.{date}-{name}.project.md
    // Example: 1.001.1211-program-manager.project.md
    const files = fs.readdirSync(PROJECTS_DIR)
      .filter(f => f.match(/^\d+\.\d+\.\d+-.*\.project\.md$/))
      .sort();

    return files.map(filename => {
      const match = filename.match(/^(\d+)\.(\d+)\.(\d+)-(.*)\.project\.md$/);
      if (!match) return null;

      const [, priority, sequence, date, slug] = match;
      const content = fs.readFileSync(path.join(PROJECTS_DIR, filename), 'utf8');

      // Extract status and phase from content
      const statusMatch = content.match(/\*\*Status\*\*:\s*(.+)/);
      const phaseMatch = content.match(/Phase\s+(\d+)\/(\d+)/);

      const status = statusMatch ? statusMatch[1].trim() : 'Unknown';
      const phase = phaseMatch ? `${phaseMatch[1]}/${phaseMatch[2]}` : '0/?';

      // Sort key: priority.sequence (e.g., "1.001" < "2.001" < "3.002")
      const sortKey = parseFloat(`${priority}.${sequence}`);

      return {
        sortKey,
        priority: `P${priority}`,
        sequence: parseInt(sequence),
        date,
        slug: slug.replace(/-/g, ' '),
        filename,
        status,
        phase,
        isActive: status.includes('Active') || status.includes('NEXT') || status.includes('In Progress'),
        isPaused: status.includes('PAUSED') || status.includes('Paused'),
        isBlocked: status.includes('Blocked') || status.includes('BLOCKED')
      };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function getAudits() {
  try {
    const registry = JSON.parse(fs.readFileSync(AUDITS_REGISTRY, 'utf8'));
    const pending = registry.audits.filter(a => a.status === 'pending');

    return {
      total: pending.length,
      high: pending.filter(a => a.severity === 'high' || a.severity === 'critical').length
    };
  } catch {
    return { total: 0, high: 0 };
  }
}

function getBacklogStats() {
  try {
    const content = fs.readFileSync(BACKLOG_PATH, 'utf8');

    // Count P0/P1 tasks
    const p0Tasks = (content.match(/\|\s*P0\s*\|/g) || []).length;
    const p1Tasks = (content.match(/\|\s*P1\s*\|/g) || []).length;

    return {
      urgent: p0Tasks,
      high: p1Tasks
    };
  } catch {
    return { urgent: 0, high: 0 };
  }
}

function displayMenu() {
  const projects = getProjects();
  const audits = getAudits();
  const backlog = getBacklogStats();

  // Find active project, or first non-blocked/non-paused project
  const currentProject = projects.find(p => p.isActive) ||
                         projects.find(p => !p.isBlocked && !p.isPaused) ||
                         projects[0];
  const nextProject = projects.find(p => p !== currentProject && !p.isBlocked) || projects[1];

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  What would you like to do?                               ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');

  // Option 1: Continue current project
  if (currentProject) {
    const name = currentProject.slug.substring(0, 35);
    const phase = currentProject.phase;
    console.log(`║  [1] Continue: ${name.padEnd(35)} (${phase})  ║`);
  } else {
    console.log('║  [1] No active project                                     ║');
  }

  // Option 2: Start next project
  if (nextProject) {
    const name = nextProject.slug.substring(0, 35);
    const phase = nextProject.phase;
    const paused = nextProject.isPaused ? ' - PAUSED' : '';
    console.log(`║  [2] Start next: ${name.padEnd(30)} (${phase})${paused.padEnd(9)}║`);
  } else {
    console.log('║  [2] No pending projects                                   ║');
  }

  // Option 3: Review audits
  if (audits.total > 0) {
    const auditText = `Review ${audits.total} audit${audits.total > 1 ? 's' : ''}`;
    const highText = audits.high > 0 ? ` (${audits.high} high)` : '';
    console.log(`║  [3] ${auditText}${highText}`.padEnd(64) + '║');
  } else {
    console.log('║  [3] No pending audits                                     ║');
  }

  // Option 4: Backlog
  if (backlog.urgent > 0 || backlog.high > 0) {
    const tasks = [];
    if (backlog.urgent > 0) tasks.push(`${backlog.urgent} urgent`);
    if (backlog.high > 0) tasks.push(`${backlog.high} high`);
    const taskText = tasks.join(', ');
    console.log(`║  [4] Backlog: view/add tasks (${taskText})`.padEnd(64) + '║');
  } else {
    console.log('║  [4] Backlog: view/add tasks                               ║');
  }

  // Option 5: Find refactoring opportunities
  console.log('║  [5] Find refactor opportunities                           ║');

  // Option 6: Skip
  console.log('║  [6] Skip → proceed with your request                     ║');

  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Reply with number (1-6) or just ask your question.');
  console.log('');

  // Quick commands reminder
  console.log('Quick commands: /project-queue | /audit-status | /backlog');
  console.log('');
}

function main() {
  if (!shouldShowMenu()) {
    process.exit(0);
  }

  displayMenu();
  markShown();
  process.exit(0);
}

main();
