#!/usr/bin/env node
/**
 * Project Update Hook - Tracks edits and suggests project updates
 *
 * Hook Type: PostToolUse (Edit, Write)
 *
 * Detects:
 * - Edits to files that match active project context files
 * - Substantial work that may complete a phase
 * - Documentation that may need updating
 *
 * Exit codes:
 * - 0: Always allow (suggestion only)
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const PROJECTS_FILE = path.join(process.cwd(), '.claude', 'projects.json');
const SESSION_FILE = path.join(process.cwd(), '.claude', '.project-update-session.json');

// Thresholds
const EDITS_BEFORE_REMINDER = 10;
const DOCS_PATTERNS = [/CLAUDE\.md$/, /README\.md$/, /CHANGELOG\.md$/, /SPEC\.md$/];

function loadProjects() {
  try {
    if (fs.existsSync(PROJECTS_FILE)) {
      return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
    }
  } catch (e) {}
  return { active: [], pending: [], completed: [] };
}

function loadSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      // Reset if older than 2 hours
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
      if (data.startTime < twoHoursAgo) {
        return { editCount: 0, filesEdited: [], remindersShown: [], startTime: Date.now() };
      }
      return data;
    }
  } catch (e) {}
  return { editCount: 0, filesEdited: [], remindersShown: [], startTime: Date.now() };
}

function saveSession(session) {
  try {
    const dir = path.dirname(SESSION_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
  } catch (e) {}
}

async function main() {
  let input = '';
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) { input += line; }

  let data;
  try { data = JSON.parse(input); } catch (e) { process.exit(0); }

  // Handle both Edit and Write tools
  if (data?.tool !== 'Edit' && data?.tool !== 'Write') process.exit(0);

  const filePath = data?.tool_input?.file_path || '';
  if (!filePath) process.exit(0);

  const session = loadSession();
  session.editCount++;

  // Track unique files
  if (!session.filesEdited.includes(filePath)) {
    session.filesEdited.push(filePath);
  }

  const projects = loadProjects();
  const activeProjects = projects.active || [];

  // Check if editing docs that may need CLAUDE.md update
  const isDocFile = DOCS_PATTERNS.some(p => p.test(filePath));

  // Check for substantial work milestone
  if (session.editCount >= EDITS_BEFORE_REMINDER && !session.remindersShown.includes('project-update')) {
    if (activeProjects.length > 0) {
      console.log('\n[PROJECT] Substantial work detected (' + session.editCount + ' edits)');
      console.log('  Consider updating your project file with progress.');
      console.log('  Active projects: ' + activeProjects.map(p => p.id).join(', '));
      session.remindersShown.push('project-update');
    }
  }

  // Check for potential phase completion (many files edited)
  const uniqueFiles = session.filesEdited.length;
  if (uniqueFiles >= 5 && !session.remindersShown.includes('phase-check')) {
    if (activeProjects.length > 0) {
      console.log('\n[PROJECT] ' + uniqueFiles + ' files modified this session.');
      console.log('  If you completed a phase, update the project file:');
      for (const p of activeProjects) {
        console.log('    - ' + p.file);
      }
      session.remindersShown.push('phase-check');
    }
  }

  // Remind about docs update after significant changes
  if (session.editCount >= 15 && !session.remindersShown.includes('docs-update')) {
    if (!isDocFile) {
      console.log('\n[DOCS] Many changes made. Consider updating documentation:');
      console.log('  - CLAUDE.md (architecture overview)');
      console.log('  - CHANGELOG.md (version history)');
      session.remindersShown.push('docs-update');
    }
  }

  saveSession(session);
  process.exit(0);
}

main().catch(err => {
  console.error('[PROJECT] Hook error:', err.message);
  process.exit(0);
});
