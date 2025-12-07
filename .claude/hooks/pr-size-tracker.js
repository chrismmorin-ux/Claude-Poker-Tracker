#!/usr/bin/env node
/**
 * PR Size Tracker Hook - Warns when cumulative edits exceed PR size guidelines
 *
 * Tracks lines changed per session and warns when approaching 400 lines.
 * See engineering_practices.md Section 3: PR size target < 400 lines
 *
 * Uses a session file to track cumulative changes.
 *
 * Exit codes:
 * - 0: Allow (with optional warning)
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(process.cwd(), '.claude', '.pr-size-session.json');
const WARN_THRESHOLD = 300;  // Warn at 300 lines
const LIMIT_THRESHOLD = 400; // Strong warn at 400 lines

function loadSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      // Reset if older than 4 hours (likely a new session)
      const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
      if (data.startTime < fourHoursAgo) {
        return { linesChanged: 0, filesChanged: [], startTime: Date.now() };
      }
      return data;
    }
  } catch (e) {
    // Ignore errors
  }
  return { linesChanged: 0, filesChanged: [], startTime: Date.now() };
}

function saveSession(session) {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
  } catch (e) {
    // Ignore errors
  }
}

async function main() {
  let input = '';
  const rl = readline.createInterface({ input: process.stdin });

  for await (const line of rl) {
    input += line;
  }

  let data;
  try {
    data = JSON.parse(input);
  } catch (e) {
    process.exit(0);
  }

  // Only process Edit tool results
  if (data?.tool !== 'Edit') {
    process.exit(0);
  }

  const filePath = data?.tool_input?.file_path || '';
  const oldString = data?.tool_input?.old_string || '';
  const newString = data?.tool_input?.new_string || '';

  // Estimate lines changed (rough approximation)
  const oldLines = oldString.split('\n').length;
  const newLines = newString.split('\n').length;
  const linesChanged = Math.abs(newLines - oldLines) + Math.min(oldLines, newLines);

  // Load and update session
  const session = loadSession();
  session.linesChanged += linesChanged;

  if (!session.filesChanged.includes(filePath)) {
    session.filesChanged.push(filePath);
  }

  saveSession(session);

  // Check thresholds
  if (session.linesChanged >= LIMIT_THRESHOLD) {
    console.log(`[PR-SIZE] WARNING: ${session.linesChanged} lines changed across ${session.filesChanged.length} files.`);
    console.log('This exceeds the 400-line PR guideline.');
    console.log('See engineering_practices.md Section 3: PR Standards');
    console.log('');
    console.log('Consider:');
    console.log('  - Splitting into multiple PRs');
    console.log('  - Creating a staging/QA runbook');
    console.log('  - Breaking the work into smaller commits');
  } else if (session.linesChanged >= WARN_THRESHOLD) {
    console.log(`[PR-SIZE] Note: ${session.linesChanged} lines changed. Approaching 400-line PR guideline.`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Hook error:', err.message);
  process.exit(0);
});
