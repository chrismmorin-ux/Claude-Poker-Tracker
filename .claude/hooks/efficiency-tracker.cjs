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
 * - Hook effectiveness metrics (blocks, warnings, compliance)
 * - Token optimization opportunities
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
const CONTEXT_DIR = path.join(process.cwd(), '.claude', 'context');

const CONFIG = {
  SESSION_EXPIRY_HOURS: 4,  // Reset session after 4 hours
  HIGH_CHURN_THRESHOLD: 4,  // Warn if file edited 4+ times
  CONTEXT_FIRST_REMINDER_THRESHOLD: 5, // Remind about context files after 5 source reads
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
    sourceFileReads: 0,           // Count of src/ file reads
    contextFileReads: 0,          // Count of .claude/context/ reads

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

    // Hook effectiveness metrics
    hookMetrics: {
      delegationBlocks: 0,        // Files blocked by delegation-check-pre
      delegationViolations: 0,    // Files written despite delegation marking
      qualityGateBlocks: 0,       // Commits blocked by quality-gate
      contextFirstReminders: 0,   // Times reminded to read context first
    },

    // Token optimization tracking
    tokenOptimization: {
      estimatedTokensSaved: 0,
      estimatedTokensWasted: 0,
      delegationOpportunities: 0, // Tasks that could have been delegated
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

async function readStdinWithTimeout(timeoutMs = 1000) {
  return new Promise((resolve) => {
    let input = '';
    const rl = readline.createInterface({
      input: process.stdin,
      terminal: false
    });

    const timeout = setTimeout(() => {
      rl.close();
      resolve(input);
    }, timeoutMs);

    rl.on('line', (line) => {
      input += line;
    });

    rl.on('close', () => {
      clearTimeout(timeout);
      resolve(input);
    });

    rl.on('error', () => {
      clearTimeout(timeout);
      resolve(input);
    });
  });
}

async function main() {
  // Read stdin with timeout to prevent hanging
  const input = await readStdinWithTimeout(1000);

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

  // Handle Read tool - track sequential vs parallel patterns and context-first
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

    // Track context vs source file reads
    const isContextFile = filePath.includes('.claude/context') || filePath.includes('.claude\\context');
    const isSourceFile = filePath.includes('/src/') || filePath.includes('\\src\\');

    if (isContextFile) {
      session.contextFileReads = (session.contextFileReads || 0) + 1;
    } else if (isSourceFile) {
      session.sourceFileReads = (session.sourceFileReads || 0) + 1;

      // Check if reading source files without reading context first
      const warningKey = 'context-first-reminder';
      if (session.contextFileReads === 0 &&
          session.sourceFileReads >= CONFIG.CONTEXT_FIRST_REMINDER_THRESHOLD &&
          !session.warningsShown.includes(warningKey)) {
        console.log('');
        console.log('[EFFICIENCY] Token optimization tip:');
        console.log(`  You've read ${session.sourceFileReads} source files without reading context summaries.`);
        console.log('  Consider reading .claude/context/*.md first (~2000 tokens vs ~3000+ for raw files).');
        console.log('  Files: CONTEXT_SUMMARY.md, STATE_SCHEMA.md, PERSISTENCE_OVERVIEW.md');
        console.log('');
        session.warningsShown.push(warningKey);
        session.hookMetrics = session.hookMetrics || {};
        session.hookMetrics.contextFirstReminders = (session.hookMetrics.contextFirstReminders || 0) + 1;
      }
    }
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
