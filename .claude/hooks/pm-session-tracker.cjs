#!/usr/bin/env node
/**
 * PM Session Tracker Hook
 *
 * Tracks real-time session state for the Program Manager.
 * Maintains token budget, delegation counts, and file modifications.
 *
 * Hook Type: PostToolUse (all tools)
 * State file: .claude/.pm-state.json
 * Exit codes: 0 (tracking only, never blocks)
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(process.cwd(), '.claude', '.pm-state.json');
const TEMPLATE_FILE = path.join(process.cwd(), '.claude', '.pm-state-template.json');

const CONFIG = {
  SESSION_EXPIRY_HOURS: 4,
  TOKEN_WARNING_THRESHOLD: 24000,
  TOKEN_BLOCK_THRESHOLD: 28000,
  TOKEN_TOTAL: 30000,
};

function generateSessionId() {
  return 'pm-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

      // Reset if session is older than expiry threshold
      const startTime = new Date(data.startTime).getTime();
      const expiryTime = Date.now() - (CONFIG.SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
      if (startTime < expiryTime) {
        return createEmptyState();
      }
      return data;
    }
  } catch (e) {
    // Silently fail and create new state
  }
  return createEmptyState();
}

function createEmptyState() {
  return {
    sessionId: generateSessionId(),
    startTime: new Date().toISOString(),
    tokenBudget: {
      total: CONFIG.TOKEN_TOTAL,
      used: 0,
      remaining: CONFIG.TOKEN_TOTAL,
      percentUsed: 0,
      warningThreshold: CONFIG.TOKEN_WARNING_THRESHOLD,
      blockThreshold: CONFIG.TOKEN_BLOCK_THRESHOLD,
      status: 'normal'
    },
    delegation: {
      tasksSeen: 0,
      tasksDelegated: 0,
      tasksBlocked: 0,
      tasksBypassedWithTag: 0,
      complianceRate: 0.0
    },
    filesModified: [],
    currentProject: null,
    currentPhase: null,
    enterPlanModeUsed: false,
    warnings: [],
    blocks: [],
    overrides: [],
    lastToolUse: {
      tool: null,
      timestamp: null,
      result: null
    }
  };
}

function saveState(state) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    // Silently fail
  }
}

function updateTokenStatus(state) {
  const percent = state.tokenBudget.percentUsed;
  if (percent >= 93) {
    state.tokenBudget.status = 'critical';
  } else if (percent >= 80) {
    state.tokenBudget.status = 'warning';
  } else {
    state.tokenBudget.status = 'normal';
  }
}

function trackFileModification(state, filePath) {
  if (!filePath) return;

  // Normalize path
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Add to filesModified if not already there
  if (!state.filesModified.includes(normalizedPath)) {
    state.filesModified.push(normalizedPath);
  }
}

function trackToolUse(state, tool, input) {
  state.lastToolUse = {
    tool: tool,
    timestamp: new Date().toISOString(),
    result: 'completed'
  };

  // Track file modifications
  if (tool === 'Write' || tool === 'Edit') {
    const filePath = input?.file_path;
    trackFileModification(state, filePath);
  }

  // Track EnterPlanMode usage
  if (tool === 'EnterPlanMode') {
    state.enterPlanModeUsed = true;
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
    const tool = event.tool_name || event.tool;
    const input = event.tool_input || event.input || {};

    // Load current state
    const state = loadState();

    // Track this tool use
    trackToolUse(state, tool, input);

    // Update token status (note: actual token tracking requires external source)
    updateTokenStatus(state);

    // Save updated state
    saveState(state);

    // Output result (always allow - this is tracking only)
    console.log(JSON.stringify({
      continue: true
    }));

  } catch (e) {
    // On error, still continue
    console.log(JSON.stringify({
      continue: true
    }));
  }
}

main().catch(() => {
  console.log(JSON.stringify({ continue: true }));
});
