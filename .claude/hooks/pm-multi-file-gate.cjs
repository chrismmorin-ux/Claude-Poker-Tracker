#!/usr/bin/env node
/**
 * PM Multi-File Gate Hook (PreToolUse)
 *
 * Enforces the rule: 4+ files modified requires EnterPlanMode first.
 *
 * Flow:
 * 1. Load PM state to check filesModified count
 * 2. Check if EnterPlanMode has been used
 * 3. If 4+ files and no plan: BLOCK
 * 4. If <4 files OR plan exists: ALLOW
 *
 * Hook Type: PreToolUse (Write, Edit tools)
 * Exit codes:
 *   0 + continue:true  = Allow
 *   0 + continue:false = Block with message
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const STATE_FILE = path.join(PROJECT_ROOT, '.claude', '.pm-state.json');

const MULTI_FILE_THRESHOLD = 4;

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

function normalizeFilePath(filePath) {
  if (!filePath) return '';
  return filePath.replace(/\\/g, '/');
}

function isExcludedFile(filePath) {
  const normalizedPath = normalizeFilePath(filePath);

  // Exclude these paths from the file count
  const excludePatterns = [
    /^\.claude\//,           // Claude config files
    /^docs\//,               // Documentation
    /^scripts\//,            // Scripts
    /\.md$/,                 // Markdown files
    /\.json$/,               // JSON config files
    /package\.json$/,        // Package files
  ];

  return excludePatterns.some(pattern => pattern.test(normalizedPath));
}

function willExceedThreshold(state, newFilePath) {
  if (!state) return false;

  const normalizedNewPath = normalizeFilePath(newFilePath);

  // Check if this file is already in the list
  if (state.filesModified.includes(normalizedNewPath)) {
    return false; // Not a new file
  }

  // Count current files (excluding excluded patterns)
  const currentCount = state.filesModified.filter(f => !isExcludedFile(f)).length;

  // Check if adding this file would exceed threshold
  return !isExcludedFile(normalizedNewPath) && (currentCount + 1) >= MULTI_FILE_THRESHOLD;
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
    const tool = event.tool_name || event.tool;
    const input = event.tool_input || event.input || {};

    // Only check Write and Edit tools
    if (tool !== 'Write' && tool !== 'Edit') {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    const filePath = input?.file_path || '';

    // Load PM state
    const state = loadState();
    if (!state) {
      // No state = allow (don't block on missing state)
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // Check if EnterPlanMode has been used
    if (state.enterPlanModeUsed) {
      // Plan exists - allow
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // Check if this would be the 4th+ file
    if (willExceedThreshold(state, filePath)) {
      // Block - requires EnterPlanMode
      const currentCount = state.filesModified.filter(f => !isExcludedFile(f)).length;

      const message = [
        '',
        '┌─────────────────────────────────────────────────────────┐',
        '│ 🚫 MULTI-FILE WORK REQUIRES PLAN                         │',
        '├─────────────────────────────────────────────────────────┤',
        `│ Files already modified: ${currentCount.toString().padEnd(30)} │`,
        `│ Attempting to modify: ${path.basename(filePath).substring(0, 32).padEnd(32)} │`,
        '├─────────────────────────────────────────────────────────┤',
        '│ RULE: 4+ files requires EnterPlanMode first             │',
        '│                                                         │',
        '│ To proceed:                                             │',
        '│ 1. Use EnterPlanMode to create implementation plan      │',
        '│ 2. Get user approval on the plan                        │',
        '│ 3. Exit plan mode and implement                         │',
        '│                                                         │',
        '│ Or to override:                                         │',
        '│   /pm-override multifile                                │',
        '└─────────────────────────────────────────────────────────┘',
        '',
        'Files modified this session:',
        ...state.filesModified.filter(f => !isExcludedFile(f)).map(f => `  - ${f}`),
        ''
      ].join('\n');

      // Log the block
      if (!state.blocks) state.blocks = [];
      state.blocks.push({
        timestamp: new Date().toISOString(),
        rule: 'multi_file_gate',
        threshold: MULTI_FILE_THRESHOLD,
        currentCount: currentCount,
        attemptedFile: filePath
      });
      saveState(state);

      console.log(JSON.stringify({
        continue: false,
        message: message
      }));
      return;
    }

    // Under threshold - allow
    console.log(JSON.stringify({ continue: true }));

  } catch (e) {
    // On any error, allow the action (don't block on hook failure)
    console.log(JSON.stringify({ continue: true }));
  }
}

main().catch(() => {
  console.log(JSON.stringify({ continue: true }));
});
