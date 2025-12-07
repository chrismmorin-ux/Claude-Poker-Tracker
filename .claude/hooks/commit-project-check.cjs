#!/usr/bin/env node
/**
 * Commit Project Check Hook - Ensures project files are updated before commit
 *
 * Hook Type: PreToolUse (Bash - git commit)
 *
 * Checks:
 * - Active projects have been updated this session
 * - Project progress matches work done
 * - Suggests updating project files if needed
 *
 * Exit codes:
 * - 0: Allow (with suggestions)
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const PROJECTS_FILE = path.join(process.cwd(), '.claude', 'projects.json');
const SESSION_FILE = path.join(process.cwd(), '.claude', '.project-update-session.json');

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
      return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    }
  } catch (e) {}
  return { editCount: 0, filesEdited: [], remindersShown: [], startTime: Date.now() };
}

function wasProjectFileEdited(session, projects) {
  const projectFiles = projects.active.map(p => p.file);
  return session.filesEdited.some(f => projectFiles.some(pf => f.includes(pf)));
}

async function main() {
  let input = '';
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) { input += line; }

  let data;
  try { data = JSON.parse(input); } catch (e) { process.exit(0); }

  const command = data?.tool_input?.command || '';

  // Only check git commit commands
  if (!/git\s+commit/.test(command)) {
    process.exit(0);
  }

  const projects = loadProjects();
  const session = loadSession();

  // No active projects - nothing to check
  if (!projects.active || projects.active.length === 0) {
    process.exit(0);
  }

  // Check if significant work was done
  const significantWork = session.editCount >= 5 || session.filesEdited.length >= 3;

  if (significantWork) {
    const projectUpdated = wasProjectFileEdited(session, projects);

    if (!projectUpdated) {
      console.log('\n[PROJECT] Active project(s) detected but not updated this session:');
      for (const p of projects.active) {
        console.log('  - ' + p.name + ' (' + p.id + ')');
        console.log('    File: ' + p.file);
      }
      console.log('\n  Consider updating project progress before committing.');
      console.log('  Or run: /project complete <id> if work is finished.');
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[PROJECT] Hook error:', err.message);
  process.exit(0);
});
