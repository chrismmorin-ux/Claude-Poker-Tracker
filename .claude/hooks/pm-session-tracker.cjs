#!/usr/bin/env node
/**
 * PM Session Tracker Hook
 *
 * Tracks real-time session state for the Program Manager.
 * Maintains token budget, delegation counts, file modifications, and phase-based token tracking.
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
  ITERATION_WARNING_THRESHOLD: 20,  // Research-backed quality degradation point
};

// Token estimates per tool type (conservative estimates)
const TOKEN_ESTIMATES = {
  Read: 500,           // Average file read
  Grep: 300,           // Search results
  Glob: 100,           // File listing
  Write: 500,          // File creation
  Edit: 300,           // File modification
  NotebookEdit: 400,   // Notebook modification
  WebSearch: 1500,     // Web search results
  WebFetch: 2000,      // Web page content
  Task: 3000,          // Agent delegation
  Bash: 200,           // Command execution
  EnterPlanMode: 100,  // Mode change
  ExitPlanMode: 100,   // Mode change
  TodoWrite: 50,       // Todo updates
  AskUserQuestion: 50, // User interaction
  default: 150         // Unknown tools
};

// Phase definitions
const PHASES = ['preparation', 'exploration', 'planning', 'research', 'file_reading', 'execution', 'testing', 'commits', 'other'];

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
    tokensByPhase: {
      preparation: { toolCalls: 0, estimatedTokens: 0 },
      exploration: { toolCalls: 0, estimatedTokens: 0 },
      planning: { toolCalls: 0, estimatedTokens: 0 },
      research: { toolCalls: 0, estimatedTokens: 0 },
      file_reading: { toolCalls: 0, estimatedTokens: 0 },
      execution: { toolCalls: 0, estimatedTokens: 0 },
      testing: { toolCalls: 0, estimatedTokens: 0 },
      commits: { toolCalls: 0, estimatedTokens: 0 },
      other: { toolCalls: 0, estimatedTokens: 0 }
    },
    phaseTransitions: [],
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
    },
    efficiencyMetrics: {
      iterationCount: 0,
      tokensPerFileModified: 0,
      preparationRatio: 0,
      planningROI: 0,
      avgTokensPerTurn: 0,
      contextResetCount: 0
    },
    qualityIndicators: {
      iterationWarningIssued: false,
      lastResetTimestamp: null,
      degradationRisk: 'low'
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

/**
 * Detect the current phase based on tool and input
 */
function detectPhase(tool, input) {
  // Preparation: reading context/index files
  if (tool === 'Read') {
    const filePath = (input?.file_path || '').replace(/\\/g, '/');
    if (filePath.includes('.claude/index/') || filePath.includes('.claude/context/')) {
      return 'preparation';
    }
    return 'file_reading';
  }

  // Exploration: searching codebase
  if (tool === 'Grep' || tool === 'Glob') return 'exploration';
  if (tool === 'Task') {
    const subagentType = input?.subagent_type || '';
    if (subagentType === 'Explore' || subagentType === 'general-purpose') return 'exploration';
    if (subagentType === 'Plan' || subagentType === 'cto-agent') return 'planning';
    if (subagentType === 'test-gen' || subagentType === 'code-reviewer') return 'testing';
    if (subagentType === 'claude-code-guide') return 'research';
  }

  // Planning: design and architecture
  if (tool === 'EnterPlanMode' || tool === 'ExitPlanMode') return 'planning';

  // Research: external information
  if (tool === 'WebSearch' || tool === 'WebFetch') return 'research';

  // Execution: writing/editing code
  if (tool === 'Write' || tool === 'Edit' || tool === 'NotebookEdit') return 'execution';

  // Bash: context-dependent
  if (tool === 'Bash') {
    const cmd = (input?.command || '').toLowerCase();
    if (cmd.includes('test') || cmd.includes('jest') || cmd.includes('vitest') || cmd.includes('npm test')) {
      return 'testing';
    }
    if (cmd.includes('git commit') || cmd.includes('git push') || cmd.includes('gh pr')) {
      return 'commits';
    }
    if (cmd.includes('git')) {
      return 'commits';
    }
    return 'other';
  }

  // Todo management is other
  if (tool === 'TodoWrite' || tool === 'AskUserQuestion') return 'other';

  return 'other';
}

/**
 * Estimate tokens for a tool call
 */
function estimateTokens(tool, input) {
  let baseEstimate = TOKEN_ESTIMATES[tool] || TOKEN_ESTIMATES.default;

  // Adjust estimates based on input context
  if (tool === 'Read') {
    const limit = input?.limit;
    if (limit) {
      // Smaller reads = fewer tokens
      if (limit < 100) baseEstimate = 200;
      else if (limit < 500) baseEstimate = 400;
      else baseEstimate = 800;
    }
  }

  if (tool === 'Grep') {
    // More results = more tokens
    const headLimit = input?.head_limit;
    if (headLimit && headLimit < 10) baseEstimate = 150;
  }

  if (tool === 'Task') {
    // Agents consume more tokens
    const subagentType = input?.subagent_type || '';
    if (subagentType === 'Explore') {
      // Check thoroughness hint in prompt
      const prompt = (input?.prompt || '').toLowerCase();
      if (prompt.includes('quick')) baseEstimate = 1500;
      else if (prompt.includes('thorough')) baseEstimate = 5000;
      else baseEstimate = 3000;
    }
  }

  return baseEstimate;
}

/**
 * Track phase transitions for analysis
 */
function trackPhaseTransition(state, newPhase) {
  const lastPhase = state.phaseTransitions.length > 0
    ? state.phaseTransitions[state.phaseTransitions.length - 1].phase
    : null;

  if (lastPhase !== newPhase) {
    // Keep only last 50 transitions to avoid bloat
    if (state.phaseTransitions.length >= 50) {
      state.phaseTransitions = state.phaseTransitions.slice(-25);
    }
    state.phaseTransitions.push({
      phase: newPhase,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Calculate efficiency metrics based on current state
 */
function calculateEfficiencyMetrics(state) {
  // Initialize if missing
  if (!state.efficiencyMetrics) {
    state.efficiencyMetrics = {
      iterationCount: 0,
      tokensPerFileModified: 0,
      preparationRatio: 0,
      planningROI: 0,
      avgTokensPerTurn: 0,
      contextResetCount: 0
    };
  }

  const filesCount = state.filesModified?.length || 1;
  const totalTokens = state.tokenBudget?.used || 0;

  // Tokens per file modified (lower = more efficient)
  state.efficiencyMetrics.tokensPerFileModified =
    filesCount > 0 ? Math.round(totalTokens / filesCount) : 0;

  // Preparation ratio (preparation / file_reading - higher = better)
  const prepTokens = state.tokensByPhase?.preparation?.estimatedTokens || 0;
  const fileReadTokens = state.tokensByPhase?.file_reading?.estimatedTokens || 1;
  state.efficiencyMetrics.preparationRatio =
    Math.round((prepTokens / fileReadTokens) * 100) / 100;

  // Planning ROI (planning / execution - balanced is best)
  const planTokens = state.tokensByPhase?.planning?.estimatedTokens || 0;
  const execTokens = state.tokensByPhase?.execution?.estimatedTokens || 1;
  state.efficiencyMetrics.planningROI =
    Math.round((planTokens / execTokens) * 100) / 100;

  // Average tokens per turn
  const iterations = state.efficiencyMetrics.iterationCount || 1;
  state.efficiencyMetrics.avgTokensPerTurn = Math.round(totalTokens / iterations);
}

/**
 * Check iteration threshold and update quality indicators
 */
function checkIterationThreshold(state) {
  // Initialize if missing
  if (!state.qualityIndicators) {
    state.qualityIndicators = {
      iterationWarningIssued: false,
      lastResetTimestamp: null,
      degradationRisk: 'low'
    };
  }

  const iterations = state.efficiencyMetrics?.iterationCount || 0;

  // Update degradation risk based on iteration count
  if (iterations >= CONFIG.ITERATION_WARNING_THRESHOLD) {
    state.qualityIndicators.degradationRisk = 'high';

    // Issue warning once at threshold
    if (!state.qualityIndicators.iterationWarningIssued) {
      state.qualityIndicators.iterationWarningIssued = true;
      state.warnings = state.warnings || [];
      state.warnings.push({
        type: 'iteration_threshold',
        message: `20+ iterations reached - consider /clear for fresh context (quality degrades after 20)`,
        timestamp: new Date().toISOString()
      });
    }
  } else if (iterations >= 15) {
    state.qualityIndicators.degradationRisk = 'medium';
  } else {
    state.qualityIndicators.degradationRisk = 'low';
  }
}

/**
 * Track iteration count based on tool activity patterns
 * Uses a heuristic: count distinct "clusters" of tool calls
 */
function trackIteration(state, tool) {
  // Initialize if missing
  if (!state.efficiencyMetrics) {
    state.efficiencyMetrics = {
      iterationCount: 0,
      tokensPerFileModified: 0,
      preparationRatio: 0,
      planningROI: 0,
      avgTokensPerTurn: 0,
      contextResetCount: 0,
      totalToolCalls: 0
    };
  }

  // Track total tool calls
  state.efficiencyMetrics.totalToolCalls = (state.efficiencyMetrics.totalToolCalls || 0) + 1;

  // Increment iteration on AskUserQuestion (indicates a turn boundary)
  if (tool === 'AskUserQuestion') {
    state.efficiencyMetrics.iterationCount++;
  }

  // Estimate iterations based on total tool calls (roughly 5-10 calls per iteration)
  // This provides a backup count when AskUserQuestion isn't used
  const estimatedIterations = Math.max(
    state.efficiencyMetrics.iterationCount,
    Math.ceil(state.efficiencyMetrics.totalToolCalls / 7)
  );
  state.efficiencyMetrics.iterationCount = estimatedIterations;
}

function trackToolUse(state, tool, input) {
  state.lastToolUse = {
    tool: tool,
    timestamp: new Date().toISOString(),
    result: 'completed'
  };

  // Track iterations
  trackIteration(state, tool);

  // Track file modifications
  if (tool === 'Write' || tool === 'Edit') {
    const filePath = input?.file_path;
    trackFileModification(state, filePath);
  }

  // Track EnterPlanMode usage
  if (tool === 'EnterPlanMode') {
    state.enterPlanModeUsed = true;
  }

  // Phase-based token tracking
  const phase = detectPhase(tool, input);
  const estimatedTokens = estimateTokens(tool, input);

  // Initialize tokensByPhase if missing (for existing state files)
  if (!state.tokensByPhase) {
    state.tokensByPhase = {
      preparation: { toolCalls: 0, estimatedTokens: 0 },
      exploration: { toolCalls: 0, estimatedTokens: 0 },
      planning: { toolCalls: 0, estimatedTokens: 0 },
      research: { toolCalls: 0, estimatedTokens: 0 },
      file_reading: { toolCalls: 0, estimatedTokens: 0 },
      execution: { toolCalls: 0, estimatedTokens: 0 },
      testing: { toolCalls: 0, estimatedTokens: 0 },
      commits: { toolCalls: 0, estimatedTokens: 0 },
      other: { toolCalls: 0, estimatedTokens: 0 }
    };
  }

  // Initialize phaseTransitions if missing
  if (!state.phaseTransitions) {
    state.phaseTransitions = [];
  }

  // Update phase metrics
  if (state.tokensByPhase[phase]) {
    state.tokensByPhase[phase].toolCalls++;
    state.tokensByPhase[phase].estimatedTokens += estimatedTokens;
  }

  // Track phase transition
  trackPhaseTransition(state, phase);

  // Update overall token estimate
  state.tokenBudget.used += estimatedTokens;
  state.tokenBudget.remaining = state.tokenBudget.total - state.tokenBudget.used;
  state.tokenBudget.percentUsed = Math.round((state.tokenBudget.used / state.tokenBudget.total) * 100);
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

    // Calculate efficiency metrics
    calculateEfficiencyMetrics(state);

    // Check iteration threshold for quality warnings
    checkIterationThreshold(state);

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
