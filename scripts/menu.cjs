#!/usr/bin/env node
/**
 * menu.cjs - Display startup menu in terminal
 * Run: node scripts/menu.cjs
 */

const fs = require('fs');
const path = require('path');

const PROJECTS_DIR = path.join(__dirname, '..', 'docs', 'projects');
const AUDITS_REGISTRY = path.join(__dirname, '..', '.claude', 'audits', 'registry.json');
const BACKLOG_PATH = path.join(__dirname, '..', '.claude', 'BACKLOG.md');

function getProjects() {
  try {
    const files = fs.readdirSync(PROJECTS_DIR)
      .filter(f => f.match(/^\d+\.\d+\.\d+-.*\.project\.md$/))
      .sort();

    return files.map(filename => {
      const match = filename.match(/^(\d+)\.(\d+)\.(\d+)-(.*)\.project\.md$/);
      if (!match) return null;

      const [, priority, sequence, date, slug] = match;
      const content = fs.readFileSync(path.join(PROJECTS_DIR, filename), 'utf8');

      const statusMatch = content.match(/\*\*Status\*\*:\s*(.+)/);
      const phaseMatch = content.match(/Phase\s+(\d+)\/(\d+)/);

      const status = statusMatch ? statusMatch[1].trim() : 'Unknown';
      const phase = phaseMatch ? `${phaseMatch[1]}/${phaseMatch[2]}` : '0/?';

      return {
        priority: `P${priority}`,
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
    const p0Tasks = (content.match(/\|\s*P0\s*\|/g) || []).length;
    const p1Tasks = (content.match(/\|\s*P1\s*\|/g) || []).length;
    return { urgent: p0Tasks, high: p1Tasks };
  } catch {
    return { urgent: 0, high: 0 };
  }
}

function displayMenu() {
  const projects = getProjects();
  const audits = getAudits();
  const backlog = getBacklogStats();

  const currentProject = projects.find(p => p.isActive) ||
                         projects.find(p => !p.isBlocked && !p.isPaused) ||
                         projects[0];
  const nextProject = projects.find(p => p !== currentProject && !p.isBlocked) || projects[1];

  console.log('');
  console.log('\x1b[36m╔═══════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[36m║\x1b[0m  \x1b[1mWhat would you like to do?\x1b[0m                               \x1b[36m║\x1b[0m');
  console.log('\x1b[36m╠═══════════════════════════════════════════════════════════╣\x1b[0m');

  if (currentProject) {
    const name = currentProject.slug.substring(0, 35).padEnd(35);
    console.log(`\x1b[36m║\x1b[0m  \x1b[33m[1]\x1b[0m Continue: ${name} (${currentProject.phase})  \x1b[36m║\x1b[0m`);
  } else {
    console.log('\x1b[36m║\x1b[0m  \x1b[33m[1]\x1b[0m No active project                                     \x1b[36m║\x1b[0m');
  }

  if (nextProject) {
    const name = nextProject.slug.substring(0, 30).padEnd(30);
    const paused = nextProject.isPaused ? ' \x1b[31mPAUSED\x1b[0m' : '';
    console.log(`\x1b[36m║\x1b[0m  \x1b[33m[2]\x1b[0m Start next: ${name} (${nextProject.phase})${paused}     \x1b[36m║\x1b[0m`);
  } else {
    console.log('\x1b[36m║\x1b[0m  \x1b[33m[2]\x1b[0m No pending projects                                   \x1b[36m║\x1b[0m');
  }

  if (audits.total > 0) {
    const highText = audits.high > 0 ? ` \x1b[31m(${audits.high} high)\x1b[0m` : '';
    const line = `  \x1b[33m[3]\x1b[0m Review ${audits.total} audit${audits.total > 1 ? 's' : ''}${highText}`;
    console.log(`\x1b[36m║\x1b[0m${line.padEnd(70)}\x1b[36m║\x1b[0m`);
  } else {
    console.log('\x1b[36m║\x1b[0m  \x1b[33m[3]\x1b[0m No pending audits                                      \x1b[36m║\x1b[0m');
  }

  const tasks = [];
  if (backlog.urgent > 0) tasks.push(`\x1b[31m${backlog.urgent} urgent\x1b[0m`);
  if (backlog.high > 0) tasks.push(`\x1b[33m${backlog.high} high\x1b[0m`);
  const taskText = tasks.length > 0 ? ` (${tasks.join(', ')})` : '';
  console.log(`\x1b[36m║\x1b[0m  \x1b[33m[4]\x1b[0m Backlog: view/add tasks${taskText}`.padEnd(75) + `\x1b[36m║\x1b[0m`);

  console.log('\x1b[36m║\x1b[0m  \x1b[33m[5]\x1b[0m Find refactor opportunities                            \x1b[36m║\x1b[0m');
  console.log('\x1b[36m╠═══════════════════════════════════════════════════════════╣\x1b[0m');
  console.log('\x1b[36m║\x1b[0m  \x1b[2mSomething else? Just type it here.\x1b[0m                      \x1b[36m║\x1b[0m');
  console.log('\x1b[36m╚═══════════════════════════════════════════════════════════╝\x1b[0m');
  console.log('');
}

displayMenu();
