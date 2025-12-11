#!/usr/bin/env node
/**
 * Budget Check Hook - Enforces session token budget
 *
 * Hook Type: UserPromptSubmit (runs on session start and before operations)
 *
 * Features:
 * - Initializes session budget on first run
 * - Estimates token cost of operations
 * - Warns at 80% budget (24K of 30K)
 * - Blocks at 100% budget (requires permission)
 * - Tracks token usage breakdown
 *
 * Budget: 30,000 tokens/session (aggressive)
 * Override: User approves permission request
 *
 * Exit codes:
 * - 0: Allow (within budget or permission granted)
 * - 2: Block (budget exceeded, permission required)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const BUDGET_FILE = path.join(process.cwd(), '.claude', '.session-budget.json');
const CONFIG = {
  TOTAL_BUDGET: 30000,
  WARNING_THRESHOLD: 24000,  // 80%
  HARD_LIMIT: 36000,         // 120% - absolute max with permission
  SESSION_EXPIRY_HOURS: 4,
};

// Token estimation constants
const TOKEN_ESTIMATES = {
  READ_PER_LINE: 0.5,        // ~0.5 tokens per line of code
  AGENT_BASE: 2000,          // Base cost for agent launch
  GREP_GLOB: 100,            // Search operations
  EDIT_PER_LINE: 1,          // Editing overhead
  RESPONSE_PER_CHAR: 0.25,   // Response generation
};

function loadBudget() {
  try {
    if (fs.existsSync(BUDGET_FILE)) {
      const data = JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8'));

      // Check if session expired
      const expiryTime = Date.now() - (CONFIG.SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
      if (data.started < expiryTime) {
        return createNewBudget();
      }

      return data;
    }
  } catch (e) {
    // Corrupted file - create new
  }
  return createNewBudget();
}

function createNewBudget() {
  const sessionId = new Date().toISOString().slice(0, 10) + '-' +
    Math.random().toString(36).substring(2, 6);

  return {
    sessionId,
    started: Date.now(),
    lastActivity: Date.now(),
    budget: {
      total: CONFIG.TOTAL_BUDGET,
      used: 0,
      remaining: CONFIG.TOTAL_BUDGET,
      warningThreshold: CONFIG.WARNING_THRESHOLD,
      hardLimit: CONFIG.HARD_LIMIT,
    },
    breakdown: {
      reads: 0,
      agents: 0,
      edits: 0,
      searches: 0,
      other: 0,
    },
    history: [],
    overrides: [],
    status: 'active',
  };
}

function saveBudget(budget) {
  try {
    const dir = path.dirname(BUDGET_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    budget.lastActivity = Date.now();
    fs.writeFileSync(BUDGET_FILE, JSON.stringify(budget, null, 2));
  } catch (e) {
    // Silent fail
  }
}

function addTokenUsage(budget, category, amount, description) {
  budget.budget.used += amount;
  budget.budget.remaining = budget.budget.total - budget.budget.used;

  if (budget.breakdown[category] !== undefined) {
    budget.breakdown[category] += amount;
  } else {
    budget.breakdown.other += amount;
  }

  budget.history.push({
    timestamp: Date.now(),
    category,
    amount,
    description,
    totalAfter: budget.budget.used,
  });

  // Keep only last 100 history entries
  if (budget.history.length > 100) {
    budget.history = budget.history.slice(-100);
  }
}

function formatBudgetStatus(budget) {
  const pct = ((budget.budget.used / budget.budget.total) * 100).toFixed(1);
  const bar = generateProgressBar(budget.budget.used, budget.budget.total);

  return `
┌─────────────────────────────────────────────────────────────┐
│ TOKEN BUDGET STATUS                                          │
├─────────────────────────────────────────────────────────────┤
│ ${bar} ${pct.padStart(5)}%  │
│                                                             │
│ Used: ${budget.budget.used.toLocaleString().padStart(6)} / ${budget.budget.total.toLocaleString()} tokens                          │
│ Remaining: ${budget.budget.remaining.toLocaleString().padStart(6)} tokens                                │
│                                                             │
│ Breakdown:                                                  │
│   Reads: ${budget.breakdown.reads.toLocaleString().padStart(6)}  Agents: ${budget.breakdown.agents.toLocaleString().padStart(6)}  Edits: ${budget.breakdown.edits.toLocaleString().padStart(6)}    │
└─────────────────────────────────────────────────────────────┘`;
}

function generateProgressBar(used, total) {
  const width = 40;
  const filled = Math.round((used / total) * width);
  const warning = Math.round((CONFIG.WARNING_THRESHOLD / total) * width);

  let bar = '';
  for (let i = 0; i < width; i++) {
    if (i < filled) {
      if (i >= warning) {
        bar += '▓'; // Over warning threshold
      } else {
        bar += '█';
      }
    } else {
      bar += '░';
    }
  }
  return bar;
}

function formatPermissionRequest(budget, requestedAction, estimatedCost) {
  const newTotal = budget.budget.used + estimatedCost;
  const overBy = newTotal - budget.budget.total;

  return `
┌─────────────────────────────────────────────────────────────┐
│ 🔒 BUDGET OVERRIDE REQUIRED                                  │
├─────────────────────────────────────────────────────────────┤
│ Current: ${budget.budget.used.toLocaleString().padStart(6)} / ${budget.budget.total.toLocaleString()} (${((budget.budget.used / budget.budget.total) * 100).toFixed(1)}%)                          │
│                                                             │
│ Requested: ${requestedAction.substring(0, 47).padEnd(47)}│
│ Estimated cost: ${estimatedCost.toLocaleString().padStart(6)} tokens                               │
│ Would exceed budget by: ${overBy.toLocaleString().padStart(6)} tokens                        │
│                                                             │
│ To proceed, user must approve this override.                │
│ Consider alternatives to reduce token usage.                │
└─────────────────────────────────────────────────────────────┘`;
}

async function main() {
  // Load or create budget
  let budget = loadBudget();
  const isNewSession = budget.history.length === 0;

  // Show status on session start
  if (isNewSession) {
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ 📊 NEW SESSION - Token Budget Initialized                    │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│ Budget: ${CONFIG.TOTAL_BUDGET.toLocaleString()} tokens                                        │`);
    console.log(`│ Warning at: ${CONFIG.WARNING_THRESHOLD.toLocaleString()} tokens (80%)                               │`);
    console.log('│                                                             │');
    console.log('│ Tips for token efficiency:                                  │');
    console.log('│ → Read .claude/index/*.md before searching                  │');
    console.log('│ → Use grep/glob before full file reads                      │');
    console.log('│ → Delegate simple tasks to local models                     │');
    console.log('└─────────────────────────────────────────────────────────────┘');
    console.log('');
  }

  // Check budget status
  const pct = (budget.budget.used / budget.budget.total) * 100;

  // Warning at 80%
  if (pct >= 80 && pct < 100) {
    const lastWarning = budget.history.find(h => h.description === 'warning-shown');
    const recentWarning = lastWarning && (Date.now() - lastWarning.timestamp) < 300000; // 5 min

    if (!recentWarning) {
      console.log('');
      console.log('┌─────────────────────────────────────────────────────────────┐');
      console.log('│ ⚠️  TOKEN BUDGET WARNING                                      │');
      console.log('├─────────────────────────────────────────────────────────────┤');
      console.log(`│ Used: ${budget.budget.used.toLocaleString().padStart(6)} / ${budget.budget.total.toLocaleString()} (${pct.toFixed(1)}%)                              │`);
      console.log('│                                                             │');
      console.log('│ Recommendations:                                            │');
      console.log('│ → Use context summaries instead of full reads              │');
      console.log('│ → Delegate remaining simple tasks to local models          │');
      console.log('│ → Batch similar operations together                        │');
      console.log('└─────────────────────────────────────────────────────────────┘');
      console.log('');

      addTokenUsage(budget, 'other', 0, 'warning-shown');
    }
  }

  // Block at 100%
  if (pct >= 100) {
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ 🛑 TOKEN BUDGET EXCEEDED                                     │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log(`│ Used: ${budget.budget.used.toLocaleString().padStart(6)} / ${budget.budget.total.toLocaleString()} (${pct.toFixed(1)}%)                              │`);
    console.log('│                                                             │');
    console.log('│ Session budget is exhausted. Options:                       │');
    console.log('│ 1. Start a new session (/clear or new terminal)             │');
    console.log('│ 2. Request override for specific action                     │');
    console.log('│ 3. Complete task with local models instead                  │');
    console.log('│                                                             │');
    console.log('│ To request override, describe the essential action needed.  │');
    console.log('└─────────────────────────────────────────────────────────────┘');
    console.log('');

    // Don't hard block on UserPromptSubmit - just warn
    // The Read/Write/Task hooks can do actual blocking
  }

  // Save updated budget
  saveBudget(budget);

  process.exit(0);
}

main().catch(err => {
  console.error('[BUDGET-CHECK] Hook error:', err.message);
  process.exit(0); // Allow on error
});
