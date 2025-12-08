#!/usr/bin/env node
/**
 * Efficiency Tracker Hook
 *
 * Tracks session metrics for workflow efficiency analysis.
 * Used by /efficiency-analysis command to review work patterns.
 *
 * Tracks:
 * - Files edited and edit counts (file churn)
 * - Lines changed per edit
 * - Time between edits (edit velocity)
 * - Tool usage patterns (Read, Edit, Write, Task)
 *
 * Hook Type: PostToolUse (Edit, Write, Read, Task)
 *
 * Session file: .claude/.efficiency-session.json
 * Exit codes: 0 (always allow - tracking only)
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(process.cwd(), '.claude', '.efficiency-session.json');

const CONFIG = {
  SESSION_EXPIRY_HOURS: 4,  // Reset session after 4 hours
  HIGH_CHURN_THRESHOLD: 4,  // Warn if file edited 4+ times
};

function loadSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));

      // Reset if session is older than expiry threshold
      const expiryTime = Date.now() - (CONFIG.SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
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
    lastActivityTime: Date.now(),

    // Edit tracking
    edits: [],                    // { file, timestamp, lines, tool }
    fileEditCounts: {},           // { filepath: count }
    totalLinesChanged: 0,

    // Read tracking
    reads: [],                    // { file, timestamp, wasParallel }
    sequentialReadCount: 0,
    parallelReadCount: 0,
    lastReadTimestamp: null,

    // Agent/Task tracking
    agentsInvoked: [],            // ['Explore', 'code-reviewer', ...]
    localModelsUsed: [],          // ['/local-code', '/local-refactor', ...]

    // Tool usage summary
    toolCounts: {
      Edit: 0,
      Write: 0,
      Read: 0,
      Task: 0,
      Grep: 0,
      Glob: 0,
    },

    // Warnings already shown (prevent duplicates)
    warningsShown: [],
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
  return Math.abs(newLines - oldLines) + Math.min(oldLines, newLines);
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

  const tool = data?.tool;
  if (!tool) {
    process.exit(0);
  }

  // Load session
  const session = loadSession();
  const now = Date.now();

  // Track tool usage
  if (session.toolCounts[tool] !== undefined) {
    session.toolCounts[tool] += 1;
  }

  // Handle Edit tool
  if (tool === 'Edit') {
    const filePath = data?.tool_input?.file_path || '';
    const oldString = data?.tool_input?.old_string || '';
    const newString = data?.tool_input?.new_string || '';
    const linesChanged = calculateLinesChanged(oldString, newString);

    session.edits.push({
      file: path.basename(filePath),
      fullPath: filePath,
      timestamp: now,
      lines: linesChanged,
      tool: 'Edit',
    });

    session.fileEditCounts[filePath] = (session.fileEditCounts[filePath] || 0) + 1;
    session.totalLinesChanged += linesChanged;

    // Check for high churn
    const editCount = session.fileEditCounts[filePath];
    const warningKey = `churn:${filePath}`;
    if (editCount >= CONFIG.HIGH_CHURN_THRESHOLD && !session.warningsShown.includes(warningKey)) {
      console.log('');
      console.log(`[EFFICIENCY] High edit velocity on: ${path.basename(filePath)}`);
      console.log(`  This file has been edited ${editCount} times this session.`);
      console.log('  Consider: Is this file a good refactoring candidate?');
      console.log('');
      session.warningsShown.push(warningKey);
    }
  }

  // Handle Write tool
  if (tool === 'Write') {
    const filePath = data?.tool_input?.file_path || '';
    const content = data?.tool_input?.content || '';
    const linesChanged = content.split('\n').length;

    session.edits.push({
      file: path.basename(filePath),
      fullPath: filePath,
      timestamp: now,
      lines: linesChanged,
      tool: 'Write',
    });

    session.fileEditCounts[filePath] = (session.fileEditCounts[filePath] || 0) + 1;
    session.totalLinesChanged += linesChanged;
  }

  // Handle Read tool - track sequential vs parallel patterns
  if (tool === 'Read') {
    const filePath = data?.tool_input?.file_path || '';

    // Detect if this read is likely parallel (within 100ms of last read)
    const timeSinceLastRead = session.lastReadTimestamp
      ? now - session.lastReadTimestamp
      : Infinity;

    const wasParallel = timeSinceLastRead < 100; // 100ms threshold for parallel

    session.reads.push({
      file: path.basename(filePath),
      fullPath: filePath,
      timestamp: now,
      wasParallel,
    });

    if (wasParallel) {
      session.parallelReadCount += 1;
    } else {
      session.sequentialReadCount += 1;
    }

    session.lastReadTimestamp = now;
  }

  // Handle Task tool - track agent usage
  if (tool === 'Task') {
    const subagentType = data?.tool_input?.subagent_type || 'unknown';
    if (!session.agentsInvoked.includes(subagentType)) {
      session.agentsInvoked.push(subagentType);
    }
  }

  // Update last activity time
  session.lastActivityTime = now;

  // Save session
  saveSession(session);

  process.exit(0);
}

main().catch(err => {
  console.error('[efficiency-tracker] Error:', err.message);
  process.exit(0);
});
