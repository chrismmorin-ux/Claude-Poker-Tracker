#!/usr/bin/env node
/**
 * Edit Tracker - Records when source files are edited
 *
 * Works with quality-gate.cjs to track when tests need to be re-run.
 * Only tracks edits to source files (not docs, config, tests, hooks).
 *
 * Exit codes:
 * - 0: Always allows (informational only)
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const EDIT_STATE_FILE = path.join(process.cwd(), '.claude', '.last-edit.json');

// Only track edits to source files that require testing
const SOURCE_PATTERNS = [
  /^src\/.*\.jsx?$/,           // React components and JS files
  /^src\/.*\.ts$/              // TypeScript files if any
];

// Exclude test files and docs
const EXCLUDE_PATTERNS = [
  /\.test\.(js|jsx|ts|tsx)$/,  // Test files
  /\/__tests__\//,             // Test directories
  /^docs\//,                   // Documentation
  /^\.claude\//,               // Hook files
  /\.md$/,                     // Markdown
  /^README/,                   // README
  /config\.(js|json)$/         // Config files
];

function shouldTrackEdit(filePath) {
  // Must match a source pattern
  const isSource = SOURCE_PATTERNS.some(p => p.test(filePath));
  if (!isSource) return false;

  // Must not be excluded
  const isExcluded = EXCLUDE_PATTERNS.some(p => p.test(filePath));
  return !isExcluded;
}

function loadEditState() {
  try {
    if (fs.existsSync(EDIT_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(EDIT_STATE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { lastEdit: 0, editCount: 0, files: [] };
}

function saveEditState(state) {
  try {
    const dir = path.dirname(EDIT_STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(EDIT_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {}
}

async function main() {
  let input = '';
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) { input += line; }

  let data;
  try { data = JSON.parse(input); } catch (e) { process.exit(0); }

  // Get file path from Edit or Write tool
  const filePath = data?.tool_input?.file_path || '';

  // Normalize to relative path
  const cwd = process.cwd();
  const relativePath = filePath.startsWith(cwd)
    ? filePath.slice(cwd.length + 1).replace(/\\/g, '/')
    : filePath.replace(/\\/g, '/');

  // Only track source file edits
  if (!shouldTrackEdit(relativePath)) {
    process.exit(0);
  }

  // Update edit state
  const state = loadEditState();
  state.lastEdit = Date.now();
  state.editCount = (state.editCount || 0) + 1;

  // Track unique files edited
  if (!state.files) state.files = [];
  if (!state.files.includes(relativePath)) {
    state.files.push(relativePath);
  }

  saveEditState(state);

  // Informational output (optional)
  if (state.editCount > 0 && state.editCount % 5 === 0) {
    console.log(`[EDIT TRACKER] ${state.editCount} source edits - tests will be required before commit`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Edit tracker error:', err.message);
  process.exit(0);
});
