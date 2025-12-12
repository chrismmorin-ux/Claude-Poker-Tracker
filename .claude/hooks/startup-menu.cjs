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
const DASHBOARD_GENERATOR = path.join(__dirname, '..', '..', 'scripts', 'generate-dashboard.cjs');

function getDashboardMetrics() {
  try {
    const { loadDashboardData, calculateMetrics } = require(DASHBOARD_GENERATOR);
    const data = loadDashboardData();
    return calculateMetrics(data);
  } catch {
    return null;
  }
}

function getHealthEmoji(score) {
  if (score >= 80) return '🟢';
  if (score >= 60) return '🟡';
  return '🔴';
}

function shouldShowMenu() {
  // Show on first prompt of each session
  // Use CLAUDE_CONVERSATION_ID which is set per conversation
  const conversationId = process.env.CLAUDE_CONVERSATION_ID || '';

  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

    // If we have a conversation ID, use it for deduplication
    if (conversationId && state.conversationId === conversationId) {
      return false; // Already shown this conversation
    }

    // Fallback: if no conversation ID, always show (user can skip with option 6)
    return true;
  } catch {
    return true; // No state file, show menu
  }
}

function markShown() {
  fs.writeFileSync(STATE_FILE, JSON.stringify({
    lastShown: new Date().toISOString(),
    conversationId: process.env.CLAUDE_CONVERSATION_ID || 'unknown'
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

      // Extract status from YAML frontmatter and phase from content
      const yamlStatusMatch = content.match(/^---[\s\S]*?status:\s*(\w+)[\s\S]*?---/m);
      const bodyStatusMatch = content.match(/\*\*Status\*\*:\s*(.+)/);
      const phaseMatch = content.match(/Phase\s+(\d+)\/(\d+)/) ||
                         content.match(/\| (\d+) \| \[[ x]\] \|/g);

      // Prefer YAML frontmatter status, fallback to body status
      let status = yamlStatusMatch ? yamlStatusMatch[1].trim() :
                   (bodyStatusMatch ? bodyStatusMatch[1].trim() : 'Unknown');

      // Count phases from table if no explicit Phase X/Y found
      let phase = '0/?';
      if (phaseMatch && typeof phaseMatch === 'string') {
        const m = content.match(/Phase\s+(\d+)\/(\d+)/);
        if (m) phase = `${m[1]}/${m[2]}`;
      } else {
        // Count phases from table
        const phaseRows = content.match(/\| \d+ \| \[[ x]\] \|/g);
        if (phaseRows) {
          const complete = phaseRows.filter(r => r.includes('[x]')).length;
          phase = `${complete}/${phaseRows.length}`;
        }
      }

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

  // Get dashboard metrics for header
  const metrics = getDashboardMetrics();
  const healthLine = metrics
    ? `Health: ${getHealthEmoji(metrics.healthScore)} ${metrics.healthScore}/100 | Tasks: ${metrics.completedTasks}/${metrics.totalTasks}`
    : 'Health: Run /dashboard for status';

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log(`║  ${healthLine.padEnd(57)}║`);
  console.log('╠═══════════════════════════════════════════════════════════╣');
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

  // Option 6: View System Dashboard
  console.log('║  [6] View System Dashboard                                 ║');

  // Option 7: Launch dev server for testing
  console.log('║  [7] Launch dev server → localhost:5173                   ║');

  // Option 8: Skip
  console.log('║  [8] Skip → proceed with your request                     ║');

  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Reply with number (1-8) or just ask your question.');
  console.log('');

  // Quick commands reminder
  console.log('Quick commands: /project-queue | /audit-status | /backlog');
  console.log('');
}

function main() {
  // Only show menu on first prompt of session
  if (!shouldShowMenu()) {
    process.exit(0);
    return;
  }

  // Mark that we've shown the menu this session
  markShown();

  // Display menu to Claude via hook output
  displayMenu();
}

main();
