#!/usr/bin/env node
/**
 * Delegation Enforcer Hook (PreToolUse)
 *
 * Implements reverse-default delegation: ALL file writes delegate to local models
 * UNLESS the task has a [CLAUDE] tag or is classified as claude_required.
 *
 * Flow:
 * 1. Intercept Write/Edit tool calls
 * 2. Check for [CLAUDE] bypass tag in conversation context
 * 3. Classify the task using task-classifier-v3.sh
 * 4. If delegatable: block and suggest auto-delegation
 * 5. If claude_required or [CLAUDE] tag: allow
 *
 * Hook Type: PreToolUse (Write, Edit tools only)
 * Exit codes:
 *   0 + continue:true  = Allow the write
 *   0 + continue:false = Block with message (delegation suggested)
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = process.cwd();
const STATE_FILE = path.join(PROJECT_ROOT, '.claude', '.pm-state.json');
const CLASSIFIER_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'task-classifier-v3.sh');
const AUTO_SPEC_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'auto-generate-task-spec.sh');
const METRICS_FILE = path.join(PROJECT_ROOT, '.claude', 'metrics', 'delegation.json');
const ENFORCEMENT_CONFIG = path.join(PROJECT_ROOT, '.claude', '.pm-enforcement-config.json');

// Categories that should delegate (not Claude)
const DELEGATABLE_CATEGORIES = [
  'simple_utility',
  'simple_component',
  'medium_component',
  'refactor',
  'documentation',
  'test_generation'
];

// File patterns that are always allowed (no delegation check)
const ALWAYS_ALLOW_PATTERNS = [
  /^\.claude\//,           // Claude config files
  /^docs\//,               // Documentation
  /^scripts\//,            // Scripts
  /\.md$/,                 // Markdown files
  /\.json$/,               // JSON config files
  /package\.json$/,        // Package files
  /\.gitignore$/,          // Git files
  /\.env/,                 // Environment files
];

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

function updateMetrics(decision, classification, filePath) {
  try {
    const dir = path.dirname(METRICS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let metrics = { decisions: [], summary: { delegated: 0, bypassed: 0, allowed: 0 } };
    if (fs.existsSync(METRICS_FILE)) {
      metrics = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
    }

    metrics.decisions.push({
      timestamp: new Date().toISOString(),
      decision,
      classification,
      filePath
    });

    // Keep only last 100 decisions
    if (metrics.decisions.length > 100) {
      metrics.decisions = metrics.decisions.slice(-100);
    }

    // Update summary
    metrics.summary[decision] = (metrics.summary[decision] || 0) + 1;

    fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
  } catch (e) {
    // Ignore metrics errors
  }
}

function updateStateWithDelegation(state, decision, classification) {
  if (!state) return;

  state.delegation.tasksSeen++;

  if (decision === 'delegated') {
    state.delegation.tasksDelegated++;
  } else if (decision === 'bypassed') {
    state.delegation.tasksBypassedWithTag++;
  }

  // Calculate compliance rate
  if (state.delegation.tasksSeen > 0) {
    state.delegation.complianceRate =
      (state.delegation.tasksDelegated + state.delegation.tasksBypassedWithTag) /
      state.delegation.tasksSeen;
  }

  saveState(state);
}

function isAlwaysAllowed(filePath) {
  if (!filePath) return false;
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Make path relative if absolute
  const relativePath = normalizedPath.startsWith(PROJECT_ROOT)
    ? normalizedPath.substring(PROJECT_ROOT.length + 1)
    : normalizedPath;

  return ALWAYS_ALLOW_PATTERNS.some(pattern => pattern.test(relativePath));
}

function classifyTask(description, filePath) {
  try {
    // Run task-classifier-v3.sh
    const result = execSync(
      `bash "${CLASSIFIER_SCRIPT}" "${description.replace(/"/g, '\\"')}" "${filePath || ''}"`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();

    const [category, confidence, model] = result.split(':');
    return { category, confidence, model };
  } catch (e) {
    // On error, default to allowing (don't block on classifier failure)
    return { category: 'claude_required', confidence: 'low', model: 'claude' };
  }
}

function loadEnforcementConfig() {
  try {
    if (fs.existsSync(ENFORCEMENT_CONFIG)) {
      const config = JSON.parse(fs.readFileSync(ENFORCEMENT_CONFIG, 'utf8'));
      return config.rules?.delegation?.mode || 'warn';
    }
  } catch (e) {
    // Ignore errors, default to warn
  }
  return 'warn';
}

function checkForClaudeTag(conversationContext) {
  // Check if [CLAUDE] tag appears in recent conversation
  if (!conversationContext) return false;

  const context = typeof conversationContext === 'string'
    ? conversationContext
    : JSON.stringify(conversationContext);

  return context.includes('[CLAUDE]');
}

function inferTaskDescription(input, tool) {
  // Try to infer what the task is from the tool input
  const filePath = input?.file_path || '';
  const content = input?.content || input?.new_string || '';

  // Extract file name
  const fileName = path.basename(filePath);

  // Try to determine task type from content
  if (content.includes('export function')) {
    return `Create/update function in ${fileName}`;
  }
  if (content.includes('export default function') || content.includes('export const')) {
    return `Create/update component ${fileName}`;
  }
  if (filePath.includes('test') || filePath.includes('spec')) {
    return `Write tests in ${fileName}`;
  }

  return `${tool === 'Write' ? 'Create' : 'Edit'} ${fileName}`;
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
    const filePath = input?.file_path || '';

    // EARLY EXIT: Only check Write and Edit tools
    if (tool !== 'Write' && tool !== 'Edit') {
      console.log(JSON.stringify({ continue: true }));
      process.exit(0);
    }

    // EARLY EXIT: Check if file is in always-allow list (before any other processing)
    if (isAlwaysAllowed(filePath)) {
      console.log(JSON.stringify({ continue: true }));
      process.exit(0);
    }

    const conversationContext = event.conversation_context || event.context || '';

    // Check for [CLAUDE] bypass tag
    if (checkForClaudeTag(conversationContext)) {
      const state = loadState();
      updateStateWithDelegation(state, 'bypassed', 'claude_tagged');
      updateMetrics('bypassed', 'claude_tagged', filePath);

      // Allow with bypass (don't show message to avoid halting)
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // Infer task description from input
    const taskDescription = inferTaskDescription(input, tool);

    // Classify the task
    const classification = classifyTask(taskDescription, filePath);

    // Check if this should delegate
    if (DELEGATABLE_CATEGORIES.includes(classification.category)) {
      const state = loadState();

      // This is a delegatable task - suggest delegation
      const message = [
        '',
        '┌─────────────────────────────────────────────────────────┐',
        '│ 🔄 DELEGATION SUGGESTED                                  │',
        '├─────────────────────────────────────────────────────────┤',
        `│ Task: ${taskDescription.substring(0, 45).padEnd(45)} │`,
        `│ Category: ${classification.category.padEnd(41)} │`,
        `│ Model: ${classification.model.padEnd(44)} │`,
        `│ Confidence: ${classification.confidence.padEnd(39)} │`,
        '├─────────────────────────────────────────────────────────┤',
        '│ To delegate: Run this command first:                    │',
        `│   bash scripts/auto-generate-task-spec.sh \\             │`,
        `│     "${taskDescription.substring(0, 30)}..." \\          │`,
        `│     "${filePath.substring(0, 35)}"                       │`,
        '│                                                         │',
        '│ To bypass: Add [CLAUDE] to your request                 │',
        '└─────────────────────────────────────────────────────────┘',
        ''
      ].join('\n');

      // Check enforcement mode from config
      const enforcementMode = loadEnforcementConfig();

      if (enforcementMode === 'block') {
        // BLOCK mode - prevent the operation
        updateStateWithDelegation(state, 'blocked', classification.category);
        updateMetrics('blocked', classification.category, filePath);

        console.log(JSON.stringify({
          continue: false,
          message: message
        }));
        return;
      } else if (enforcementMode === 'warn') {
        // WARN mode - log but allow
        updateStateWithDelegation(state, 'warned', classification.category);
        updateMetrics('warned', classification.category, filePath);

        console.log(JSON.stringify({ continue: true }));
        return;
      } else {
        // OFF mode - just allow without logging
        console.log(JSON.stringify({ continue: true }));
        return;
      }
    }

    // Claude-required task - allow
    const state = loadState();
    updateStateWithDelegation(state, 'allowed', classification.category);
    updateMetrics('allowed', classification.category, filePath);

    console.log(JSON.stringify({ continue: true }));

  } catch (e) {
    // On any error, allow the action (don't block on hook failure)
    console.log(JSON.stringify({ continue: true }));
  }
}

main().catch(() => {
  console.log(JSON.stringify({ continue: true }));
});
