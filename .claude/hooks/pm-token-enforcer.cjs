#!/usr/bin/env node
/**
 * PM Token Enforcer Hook (PreToolUse)
 *
 * Enforces token budget limits:
 * - 0-24,000: Normal operation
 * - 24,001-28,000: Warning (allow but notify)
 * - 28,001+: Block (requires user approval)
 *
 * Hook Type: PreToolUse (all tools)
 * Exit codes:
 *   0 + continue:true  = Allow
 *   0 + continue:false = Block with message
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const STATE_FILE = path.join(PROJECT_ROOT, '.claude', '.pm-state.json');
const METRICS_FILE = path.join(PROJECT_ROOT, '.claude', 'metrics', 'session-metrics.json');

const TOKEN_WARNING_THRESHOLD = 24000;
const TOKEN_BLOCK_THRESHOLD = 28000;
const TOKEN_TOTAL = 30000;

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

function estimateTokensUsed() {
  // Try to read session metrics for actual token count
  try {
    if (fs.existsSync(METRICS_FILE)) {
      const metrics = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
      if (metrics.currentSession && metrics.currentSession.tokensUsed) {
        return metrics.currentSession.tokensUsed;
      }
    }
  } catch (e) {
    // Ignore
  }

  // Fallback: estimate based on state
  const state = loadState();
  if (state && state.tokenBudget && state.tokenBudget.used) {
    return state.tokenBudget.used;
  }

  // No metrics available - allow (don't block without data)
  return 0;
}

function updateStateTokens(state, tokensUsed) {
  if (!state.tokenBudget) {
    state.tokenBudget = {
      total: TOKEN_TOTAL,
      used: 0,
      remaining: TOKEN_TOTAL,
      percentUsed: 0,
      warningThreshold: TOKEN_WARNING_THRESHOLD,
      blockThreshold: TOKEN_BLOCK_THRESHOLD,
      status: 'normal'
    };
  }

  state.tokenBudget.used = tokensUsed;
  state.tokenBudget.remaining = TOKEN_TOTAL - tokensUsed;
  state.tokenBudget.percentUsed = Math.round((tokensUsed / TOKEN_TOTAL) * 100);

  // Update status
  if (tokensUsed >= TOKEN_BLOCK_THRESHOLD) {
    state.tokenBudget.status = 'critical';
  } else if (tokensUsed >= TOKEN_WARNING_THRESHOLD) {
    state.tokenBudget.status = 'warning';
  } else {
    state.tokenBudget.status = 'normal';
  }
}

function createProgressBar(used, total, width = 40) {
  const percent = used / total;
  const filled = Math.round(percent * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
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

    // Load or create state
    let state = loadState();
    if (!state) {
      // No state - allow (don't block on missing state)
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // Get current token usage
    const tokensUsed = estimateTokensUsed();
    updateStateTokens(state, tokensUsed);

    const percentUsed = state.tokenBudget.percentUsed;
    const remaining = state.tokenBudget.remaining;

    // Check if we've exceeded the block threshold
    if (tokensUsed >= TOKEN_BLOCK_THRESHOLD) {
      // BLOCK
      const progressBar = createProgressBar(tokensUsed, TOKEN_TOTAL);

      const message = [
        '',
        '┌─────────────────────────────────────────────────────────┐',
        '│ 🚫 TOKEN BUDGET EXCEEDED - APPROVAL REQUIRED             │',
        '├─────────────────────────────────────────────────────────┤',
        `│ ${progressBar} │`,
        `│ Used: ${tokensUsed.toLocaleString().padEnd(10)} / ${TOKEN_TOTAL.toLocaleString().padEnd(10)} (${percentUsed}%)      │`,
        `│ Remaining: ${remaining.toLocaleString().padEnd(42)} │`,
        '├─────────────────────────────────────────────────────────┤',
        '│ RULE: Token budget exceeded (28k threshold)             │',
        '│                                                         │',
        '│ Options:                                                │',
        '│ 1. Wrap up current work and start new session          │',
        '│ 2. Use /pm-override budget to continue (logged)        │',
        '│ 3. Use /session-advisor for guidance                   │',
        '│                                                         │',
        '│ Note: Continuing may lead to context truncation        │',
        '└─────────────────────────────────────────────────────────┘',
        ''
      ].join('\n');

      // Log the block
      if (!state.blocks) state.blocks = [];
      state.blocks.push({
        timestamp: new Date().toISOString(),
        rule: 'token_budget',
        tokensUsed: tokensUsed,
        threshold: TOKEN_BLOCK_THRESHOLD,
        tool: tool
      });
      saveState(state);

      console.log(JSON.stringify({
        continue: false,
        message: message
      }));
      return;
    }

    // Check if we're in warning zone
    if (tokensUsed >= TOKEN_WARNING_THRESHOLD) {
      // WARN (but allow)
      const progressBar = createProgressBar(tokensUsed, TOKEN_TOTAL);

      const message = [
        '',
        '┌─────────────────────────────────────────────────────────┐',
        '│ ⚠️  TOKEN BUDGET WARNING                                 │',
        '├─────────────────────────────────────────────────────────┤',
        `│ ${progressBar} │`,
        `│ Used: ${tokensUsed.toLocaleString().padEnd(10)} / ${TOKEN_TOTAL.toLocaleString().padEnd(10)} (${percentUsed}%)      │`,
        `│ Remaining: ~${Math.floor(remaining / 2500)} typical tasks                   │`,
        '├─────────────────────────────────────────────────────────┤',
        '│ Consider:                                               │',
        '│ • Delegating remaining simple tasks to local models     │',
        '│ • Wrapping up and starting fresh session               │',
        '│ • Using /pm-status to review session progress           │',
        '└─────────────────────────────────────────────────────────┘',
        ''
      ].join('\n');

      // Log the warning
      if (!state.warnings) state.warnings = [];
      state.warnings.push({
        timestamp: new Date().toISOString(),
        rule: 'token_budget_warning',
        tokensUsed: tokensUsed,
        threshold: TOKEN_WARNING_THRESHOLD
      });
      saveState(state);

      console.log(JSON.stringify({
        continue: true,
        message: message
      }));
      return;
    }

    // Normal operation - save state and allow
    saveState(state);
    console.log(JSON.stringify({ continue: true }));

  } catch (e) {
    // On any error, allow the action (don't block on hook failure)
    console.log(JSON.stringify({ continue: true }));
  }
}

main().catch(() => {
  console.log(JSON.stringify({ continue: true }));
});
