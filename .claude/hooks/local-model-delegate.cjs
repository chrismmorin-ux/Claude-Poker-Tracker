#!/usr/bin/env node
/**
 * Local Model Delegation Hook - Enforces local model usage for simple tasks
 *
 * Hook Type: UserPromptSubmit (runs on user messages)
 *
 * Classifies incoming tasks and suggests local model delegation for:
 * - simple_utility: Pure functions, helpers → /local-code
 * - simple_component: Basic React components → /local-code
 * - refactor: Rename, extract, restructure → /local-refactor
 *
 * Bypass triggers (Claude handles directly):
 * - "claude:" prefix
 * - "use claude" in prompt
 * - Questions (starts with what/how/why/etc or ends with ?)
 * - claude_required classification
 * - complex classification
 *
 * Exit codes:
 * - 0: Always allow (informational only, shows suggestion)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const SESSION_FILE = path.join(process.cwd(), '.claude', '.delegate-shown.json');
const CLASSIFIER_SCRIPT = path.join(process.cwd(), 'scripts', 'task-classifier.sh');

// Only show once per 5 minutes for same classification
const REMINDER_WINDOW_MS = 5 * 60 * 1000;

// Keywords that bypass delegation (user wants Claude specifically)
const CLAUDE_BYPASS_PATTERNS = [
  /^claude:/i,
  /\buse\s+claude\b/i,
  /\bclaude\s+(?:should|must|needs?\s+to)\b/i,
  /\bdon'?t\s+(?:use\s+)?(?:local|delegate)\b/i,
  /\bno\s+(?:local|delegation)\b/i,
];

// Keywords that suggest this is just a question, not a coding task
const QUESTION_PATTERNS = [
  /^(?:what|how|why|when|where|can|does|is|are|should|would|could|tell|explain|show|describe)\s/i,
  /\?$/,
  /^(?:help|status|check|list|show|display|view|read|look|find|search)\b/i,
];

// Keywords that suggest this is a git/project management task, not coding
const NON_CODING_PATTERNS = [
  /^(?:commit|push|pull|merge|branch|checkout|rebase|stash)\b/i,
  /^\/(?:project|review|route|cto|audit|gen-tests|local)/i,
  /^(?:run|start|stop|restart|test|build|deploy|install)\b/i,
  /\bgit\s+(?:add|commit|push|pull|status|log|diff)\b/i,
];

// Map classification to command
const CLASSIFICATION_COMMANDS = {
  simple_utility: { cmd: '/local-code', model: 'DeepSeek', desc: 'utility function' },
  simple_component: { cmd: '/local-code', model: 'DeepSeek', desc: 'React component' },
  refactor: { cmd: '/local-refactor', model: 'Qwen', desc: 'refactoring task' },
};

function hasShownRecently(classification) {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      if (data.classification === classification) {
        const age = Date.now() - data.timestamp;
        return age < REMINDER_WINDOW_MS;
      }
    }
  } catch (e) {}
  return false;
}

function markShown(classification) {
  try {
    const dir = path.dirname(SESSION_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SESSION_FILE, JSON.stringify({
      timestamp: Date.now(),
      classification,
    }));
  } catch (e) {}
}

function shouldBypass(prompt) {
  const trimmed = prompt.trim();

  // Check for explicit Claude request
  if (CLAUDE_BYPASS_PATTERNS.some(p => p.test(trimmed))) {
    return { bypass: true, reason: 'explicit_claude_request' };
  }

  // Check if it's a question
  if (QUESTION_PATTERNS.some(p => p.test(trimmed))) {
    return { bypass: true, reason: 'question' };
  }

  // Check if it's a non-coding task
  if (NON_CODING_PATTERNS.some(p => p.test(trimmed))) {
    return { bypass: true, reason: 'non_coding' };
  }

  // Short prompts are usually clarifications or follow-ups
  if (trimmed.length < 20) {
    return { bypass: true, reason: 'short_prompt' };
  }

  return { bypass: false };
}

function classifyTask(prompt) {
  try {
    // Check if classifier script exists
    if (!fs.existsSync(CLASSIFIER_SCRIPT)) {
      return 'complex'; // Default to Claude if no classifier
    }

    // Call the classifier script
    const result = execSync(`bash "${CLASSIFIER_SCRIPT}" "${prompt.replace(/"/g, '\\"')}"`, {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    return result || 'complex';
  } catch (e) {
    return 'complex'; // Default to Claude on error
  }
}

async function main() {
  let input = '';
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) { input += line + '\n'; }

  const prompt = input.trim();

  // Check for bypass conditions
  const bypassCheck = shouldBypass(prompt);
  if (bypassCheck.bypass) {
    process.exit(0);
  }

  // Classify the task
  const classification = classifyTask(prompt);

  // Check if this classification should be delegated
  const delegateInfo = CLASSIFICATION_COMMANDS[classification];
  if (!delegateInfo) {
    // complex or claude_required - let Claude handle it
    process.exit(0);
  }

  // Check if we've shown this recently
  if (hasShownRecently(classification)) {
    process.exit(0);
  }

  // Show delegation suggestion
  const cmdWithArgs = `${delegateInfo.cmd} ${prompt.substring(0, 60)}${prompt.length > 60 ? '...' : ''}`;

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  🤖 LOCAL MODEL DELEGATION SUGGESTED                        │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  Task classified as: ${(delegateInfo.desc).padEnd(36)}│`);
  console.log(`│  Recommended model: ${delegateInfo.model.padEnd(37)}│`);
  console.log('│                                                             │');
  console.log('│  Suggested command:                                         │');
  console.log(`│  ${delegateInfo.cmd} <task>`.padEnd(60) + '│');
  console.log('│                                                             │');
  console.log('│  To use Claude instead, prefix with "claude:"               │');
  console.log('│  Example: claude: create a utility function...              │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');

  markShown(classification);
  process.exit(0);
}

main().catch(err => {
  // Silent fail - don't block the user
  process.exit(0);
});
