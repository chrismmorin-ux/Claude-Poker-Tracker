#!/usr/bin/env node
/**
 * Metrics Collector Hook - Token Usage Tracking
 *
 * Hook Type: PostToolUse (all tools)
 *
 * Features:
 * - Estimates tokens from tool inputs/outputs (chars / 4 approximation)
 * - Tracks by tool type (Read, Grep, Bash, Task, etc.)
 * - Persists to .claude/metrics/session-YYYY-MM-DD.json
 * - Aggregates for dashboard display
 *
 * Token Estimation:
 * - Input: characters / 4
 * - Output: characters / 4
 * - Agent base cost: 2000 tokens
 *
 * Exit codes: 0 (always allow - tracking only)
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const METRICS_DIR = path.join(process.cwd(), '.claude', 'metrics');
const SESSION_BUDGET_FILE = path.join(process.cwd(), '.claude', '.session-budget.json');

const CONFIG = {
  SESSION_EXPIRY_HOURS: 4,
  CHARS_PER_TOKEN: 4,  // Approximation: ~4 chars per token
  AGENT_BASE_COST: 2000,  // Base token cost for launching an agent
};

// Tool-specific token multipliers (some tools have overhead)
const TOOL_MULTIPLIERS = {
  Task: 1.5,      // Agents have significant overhead
  Read: 1.0,      // Direct read
  Write: 1.2,     // Write + validation
  Edit: 1.2,      // Edit + validation
  Grep: 0.8,      // Efficient search
  Glob: 0.5,      // Very efficient
  Bash: 1.0,      // Variable
  WebFetch: 1.5,  // Network + parsing
  WebSearch: 1.5, // Search overhead
};

function getSessionFileName() {
  const today = new Date().toISOString().slice(0, 10);  // YYYY-MM-DD
  return path.join(METRICS_DIR, `session-${today}.json`);
}

function loadSessionMetrics() {
  const sessionFile = getSessionFileName();
  try {
    if (fs.existsSync(sessionFile)) {
      const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));

      // Check if we need to start a new session block
      const lastActivity = data.sessions?.[data.sessions.length - 1]?.lastActivity || 0;
      const expiryTime = Date.now() - (CONFIG.SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

      if (lastActivity < expiryTime && data.sessions?.length > 0) {
        // Start a new session block within the same day
        data.sessions.push(createNewSessionBlock());
      }

      return data;
    }
  } catch (e) {
    // File corrupted or doesn't exist
  }
  return createNewDayMetrics();
}

function createNewDayMetrics() {
  return {
    date: new Date().toISOString().slice(0, 10),
    sessions: [createNewSessionBlock()],
    dailyTotals: {
      estimatedTokens: 0,
      toolCalls: 0,
      byTool: {},
    },
  };
}

function createNewSessionBlock() {
  return {
    sessionId: generateSessionId(),
    startTime: Date.now(),
    lastActivity: Date.now(),
    estimatedTokens: 0,
    toolCalls: [],
    byTool: {},
    budget: {
      total: 30000,
      warning: 24000,
    },
  };
}

function generateSessionId() {
  return new Date().toISOString().slice(11, 19).replace(/:/g, '') + '-' +
    Math.random().toString(36).substring(2, 6);
}

function saveSessionMetrics(metrics) {
  try {
    if (!fs.existsSync(METRICS_DIR)) {
      fs.mkdirSync(METRICS_DIR, { recursive: true });
    }

    const sessionFile = getSessionFileName();
    fs.writeFileSync(sessionFile, JSON.stringify(metrics, null, 2));
  } catch (e) {
    // Silent fail - don't block on metrics
  }
}

function estimateTokens(obj) {
  if (!obj) return 0;
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return Math.ceil(str.length / CONFIG.CHARS_PER_TOKEN);
}

function updateBudgetFile(tokensDelta) {
  try {
    if (fs.existsSync(SESSION_BUDGET_FILE)) {
      const budget = JSON.parse(fs.readFileSync(SESSION_BUDGET_FILE, 'utf8'));
      budget.budget.used += tokensDelta;
      budget.budget.remaining = budget.budget.total - budget.budget.used;
      budget.lastActivity = Date.now();
      fs.writeFileSync(SESSION_BUDGET_FILE, JSON.stringify(budget, null, 2));
    }
  } catch (e) {
    // Silent fail
  }
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
  const input = await readStdinWithTimeout(1000);

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

  // Load metrics
  const metrics = loadSessionMetrics();
  const currentSession = metrics.sessions[metrics.sessions.length - 1];

  // Estimate tokens for this tool call
  const inputTokens = estimateTokens(data.tool_input);
  const outputTokens = estimateTokens(data.tool_result);
  const multiplier = TOOL_MULTIPLIERS[tool] || 1.0;

  let estimatedTokens = Math.ceil((inputTokens + outputTokens) * multiplier);

  // Add base cost for agent launches
  if (tool === 'Task') {
    estimatedTokens += CONFIG.AGENT_BASE_COST;
  }

  // Record the tool call
  const toolCall = {
    timestamp: Date.now(),
    tool,
    inputTokens,
    outputTokens,
    estimatedTotal: estimatedTokens,
  };

  // Add details for specific tools
  if (tool === 'Read' && data.tool_input?.file_path) {
    toolCall.file = path.basename(data.tool_input.file_path);
  }
  if (tool === 'Task' && data.tool_input?.subagent_type) {
    toolCall.agent = data.tool_input.subagent_type;
  }
  if (tool === 'Grep' && data.tool_input?.pattern) {
    toolCall.pattern = data.tool_input.pattern.substring(0, 30);
  }

  // Update session metrics
  currentSession.toolCalls.push(toolCall);
  currentSession.estimatedTokens += estimatedTokens;
  currentSession.lastActivity = Date.now();

  // Update by-tool breakdown
  if (!currentSession.byTool[tool]) {
    currentSession.byTool[tool] = { count: 0, tokens: 0 };
  }
  currentSession.byTool[tool].count += 1;
  currentSession.byTool[tool].tokens += estimatedTokens;

  // Update daily totals
  metrics.dailyTotals.estimatedTokens += estimatedTokens;
  metrics.dailyTotals.toolCalls += 1;
  if (!metrics.dailyTotals.byTool[tool]) {
    metrics.dailyTotals.byTool[tool] = { count: 0, tokens: 0 };
  }
  metrics.dailyTotals.byTool[tool].count += 1;
  metrics.dailyTotals.byTool[tool].tokens += estimatedTokens;

  // Save metrics
  saveSessionMetrics(metrics);

  // Also update the budget file so budget-check.cjs has accurate data
  updateBudgetFile(estimatedTokens);

  process.exit(0);
}

main().catch(err => {
  console.error('[metrics-collector] Error:', err.message);
  process.exit(0);
});
