#!/usr/bin/env node
/**
 * Edit Review Suggest Hook
 *
 * Suggests running `/review staged` after significant edits.
 * Triggers after 5+ edits OR 200+ lines changed in a session.
 *
 * Hook Type: PostToolUse (Edit, Write)
 *
 * Session file: .claude/.edit-review-session.json
 * Exit codes: 0 (always allow - suggestions only)
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(process.cwd(), '.claude', '.edit-review-session.json');

const THRESHOLDS = {
  EDIT_COUNT: 5,           // Suggest after 5 edits
  LINES_CHANGED: 200,      // OR after 200 lines changed
  COOLDOWN_MINUTES: 30,    // Don't re-suggest within 30 min
  SESSION_EXPIRY_HOURS: 2, // Reset session after 2 hours
};

function loadSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));

      // Reset if session is older than expiry threshold
      const expiryTime = Date.now() - (THRESHOLDS.SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
      if (data.startTime < expiryTime) {
        return createEmptySession();
      }
      return data;
    }
  } catch (e) {
    // Silently fail and create new session
  }
  return createEmptySession();
}

function createEmptySession() {
  return {
    startTime: Date.now(),
    editCount: 0,
    totalLinesChanged: 0,
    filesEdited: [],
    reviewSuggestedAt: null,
    reviewRan: false,
  };
}

function saveSession(session) {
  try {
    const dir = path.dirname(SESSION_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
  } catch (e) {
    // Silently fail
  }
}

function calculateLinesChanged(oldString, newString) {
  const oldLines = (oldString || '').split('\n').length;
  const newLines = (newString || '').split('\n').length;
  // Count both removed and added lines
  return Math.abs(newLines - oldLines) + Math.min(oldLines, newLines);
}

function shouldSuggestReview(session) {
  // Check if we've already suggested recently
  if (session.reviewSuggestedAt) {
    const cooldownTime = THRESHOLDS.COOLDOWN_MINUTES * 60 * 1000;
    if (Date.now() - session.reviewSuggestedAt < cooldownTime) {
      return false;
    }
  }

  // Check if review was already run
  if (session.reviewRan) {
    return false;
  }

  // Check thresholds
  return session.editCount >= THRESHOLDS.EDIT_COUNT ||
         session.totalLinesChanged >= THRESHOLDS.LINES_CHANGED;
}

async function main() {
  // Read stdin
  let input = '';
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) {
    input += line;
  }

  // Parse JSON
  let data;
  try {
    data = JSON.parse(input);
  } catch (e) {
    process.exit(0);
  }

  // Only handle Edit and Write tools
  const tool = data?.tool;
  if (tool !== 'Edit' && tool !== 'Write') {
    process.exit(0);
  }

  // Load session
  const session = loadSession();

  // Track the edit
  const filePath = data?.tool_input?.file_path || '';
  const fileName = path.basename(filePath);

  // Calculate lines changed
  let linesChanged = 0;
  if (tool === 'Edit') {
    const oldString = data?.tool_input?.old_string || '';
    const newString = data?.tool_input?.new_string || '';
    linesChanged = calculateLinesChanged(oldString, newString);
  } else if (tool === 'Write') {
    const content = data?.tool_input?.content || '';
    linesChanged = content.split('\n').length;
  }

  // Update session
  session.editCount += 1;
  session.totalLinesChanged += linesChanged;

  if (!session.filesEdited.includes(filePath)) {
    session.filesEdited.push(filePath);
  }

  // Check if we should suggest review
  if (shouldSuggestReview(session)) {
    const fileCount = session.filesEdited.length;
    console.log('');
    console.log('[REVIEW SUGGESTION]');
    console.log(`  You've made ${session.editCount} edits (~${session.totalLinesChanged} lines) across ${fileCount} file(s).`);
    console.log('  Consider running: /review staged');
    console.log('');

    session.reviewSuggestedAt = Date.now();
  }

  // Save session
  saveSession(session);

  process.exit(0);
}

main().catch(err => {
  console.error('[edit-review-suggest] Error:', err.message);
  process.exit(0);
});
