#!/usr/bin/env node
/**
 * PM Project Required Hook (UserPromptSubmit)
 *
 * Detects multi-phase work and suggests creating a project file.
 *
 * RULE: Multi-phase or multi-session work should have a project file
 * for continuity, tracking, and automatic closeout.
 *
 * Detects:
 * - User mentions "phase", "milestone", "stage"
 * - Work will span multiple sessions
 * - Complex features requiring decomposition
 *
 * Hook Type: UserPromptSubmit
 * Exit codes: Always 0 (suggests but doesn't block)
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const STATE_FILE = path.join(PROJECT_ROOT, '.claude', '.pm-state.json');
const PROJECTS_DIR = path.join(PROJECT_ROOT, 'docs', 'projects');

// Patterns that suggest multi-phase work
const MULTI_PHASE_PATTERNS = [
  /\bphase\s+\d+/i,
  /\bmultiple\s+phases/i,
  /\bmilestone/i,
  /\bstage\s+\d+/i,
  /\bpart\s+\d+/i,
  /\bstep\s+\d+/i,
  /\b(first|second|third|next)\s+(phase|milestone|stage)/i,
  /\bcomplex\s+(feature|project|initiative)/i,
  /\bmulti[-\s]session/i,
  /\bspan\s+(multiple\s+)?sessions/i,
  /\bcontinue\s+(in\s+)?next\s+session/i,
];

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

function saveState(state) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    // Ignore
  }
}

function detectMultiPhaseWork(prompt) {
  if (!prompt) return null;

  for (const pattern of MULTI_PHASE_PATTERNS) {
    const match = prompt.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}

function hasActiveProject() {
  const state = loadState();
  if (state && state.currentProject) {
    return state.currentProject;
  }
  return null;
}

function listRecentProjects() {
  try {
    if (!fs.existsSync(PROJECTS_DIR)) {
      return [];
    }

    const files = fs.readdirSync(PROJECTS_DIR)
      .filter(f => f.endsWith('.project.md'))
      .map(f => {
        const fullPath = path.join(PROJECTS_DIR, f);
        const stats = fs.statSync(fullPath);
        return {
          name: f.replace('.project.md', ''),
          path: path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/'),
          modified: stats.mtime
        };
      })
      .sort((a, b) => b.modified - a.modified)
      .slice(0, 3);

    return files;
  } catch (e) {
    return [];
  }
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  let inputData = '';
  for await (const line of rl) {
    inputData += line;
  }

  try {
    const event = JSON.parse(inputData);
    const userPrompt = event.user_prompt || event.prompt || '';

    // Check if this looks like multi-phase work
    const multiPhaseIndicator = detectMultiPhaseWork(userPrompt);

    if (!multiPhaseIndicator) {
      // Not multi-phase - allow
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // Check if there's already an active project
    const activeProject = hasActiveProject();

    if (activeProject) {
      // Already have a project - good!
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // Multi-phase work without project file - SUGGEST
    const state = loadState();
    const recentProjects = listRecentProjects();

    const recentProjectLines = recentProjects.length > 0
      ? [
          '│ Recent projects:                                        │',
          ...recentProjects.map(p => `│   • ${p.name.substring(0, 48).padEnd(48)} │`)
        ]
      : ['│ No recent projects found                                │'];

    const message = [
      '',
      '┌─────────────────────────────────────────────────────────┐',
      '│ 💡 MULTI-PHASE WORK DETECTED                             │',
      '├─────────────────────────────────────────────────────────┤',
      `│ Detected: "${multiPhaseIndicator.substring(0, 44).padEnd(44)}" │`,
      '├─────────────────────────────────────────────────────────┤',
      '│ SUGGESTION: Create a project file for:                  │',
      '│ • Continuity across sessions                            │',
      '│ • Phase tracking and progress                           │',
      '│ • Automatic closeout documentation                      │',
      '│ • Metrics and learnings capture                         │',
      '├─────────────────────────────────────────────────────────┤',
      '│ To create project file:                                 │',
      '│   /project start <project-name>                         │',
      '│                                                         │',
      ...recentProjectLines,
      '└─────────────────────────────────────────────────────────┘',
      ''
    ].join('\n');

    // Log the suggestion
    if (state) {
      if (!state.warnings) state.warnings = [];
      state.warnings.push({
        timestamp: new Date().toISOString(),
        rule: 'project_file_suggested',
        indicator: multiPhaseIndicator,
        prompt: userPrompt.substring(0, 100)
      });
      saveState(state);
    }

    // Suggest but allow
    console.log(JSON.stringify({
      continue: true,
      message: message
    }));

  } catch (e) {
    // On any error, allow
    console.log(JSON.stringify({ continue: true }));
  }
}

main().catch(() => {
  console.log(JSON.stringify({ continue: true }));
});
