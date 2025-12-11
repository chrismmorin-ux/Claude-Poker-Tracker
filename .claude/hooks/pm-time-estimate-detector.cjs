#!/usr/bin/env node
/**
 * PM Time Estimate Detector Hook (PostToolUse)
 *
 * Detects and warns about time estimates in planning output.
 *
 * RULE: Plans must focus on WHAT needs to be done, not WHEN or HOW LONG.
 * Time is irrelevant - only tokens and quality matter.
 *
 * Detects patterns like:
 * - "Week 1-2: Phase 1"
 * - "This will take about 2 hours"
 * - "Day 1: Implementation"
 * - "Next week we'll..."
 *
 * Hook Type: PostToolUse (Write, Edit for plan files)
 * Exit codes: Always 0 (warns but doesn't block in Phase 3)
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const STATE_FILE = path.join(PROJECT_ROOT, '.claude', '.pm-state.json');

// Time-related keywords to detect
const TIME_PATTERNS = [
  // Week/month references
  /\b(week|weeks|wk)\s*\d+/i,
  /\bweek\s+\d+[-–—]\d+/i,
  /\bnext\s+week/i,
  /\bthis\s+week/i,
  /\bmonth\s*\d+/i,

  // Day references
  /\bday\s*\d+/i,
  /\bday\s+\d+[-–—]\d+/i,
  /\bnext\s+\d+\s+days/i,

  // Hour/minute references
  /\b\d+\s*(hour|hours|hr|hrs)\b/i,
  /\b\d+\s*(minute|minutes|min|mins)\b/i,

  // Duration phrases
  /\bwill\s+take\s+(about|approximately|roughly)?\s*\d+/i,
  /\bshould\s+take\s+(about|approximately|roughly)?\s*\d+/i,
  /\bestimated?\s+(time|duration)/i,
  /\btimeline/i,
  /\bschedule/i,

  // Phase timing
  /\bphase\s+\d+:\s*(week|day|month)/i,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)/i,
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

function isPlanFile(filePath) {
  if (!filePath) return false;

  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();

  // Check for plan files
  return (
    normalizedPath.includes('/plan') ||
    normalizedPath.includes('/project') ||
    normalizedPath.endsWith('.project.md') ||
    normalizedPath.endsWith('.plan.md') ||
    normalizedPath.includes('roadmap')
  );
}

function detectTimeEstimates(content) {
  if (!content) return [];

  const matches = [];

  for (const pattern of TIME_PATTERNS) {
    const found = content.match(new RegExp(pattern.source, 'gi'));
    if (found) {
      matches.push(...found);
    }
  }

  // Deduplicate
  return [...new Set(matches)];
}

function extractContext(content, match, contextLines = 1) {
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(match)) {
      const start = Math.max(0, i - contextLines);
      const end = Math.min(lines.length, i + contextLines + 1);
      return lines.slice(start, end).join('\n');
    }
  }

  return match;
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

    // Only check Write and Edit tools
    if (tool !== 'Write' && tool !== 'Edit') {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    const filePath = input?.file_path || '';
    const content = input?.content || input?.new_string || '';

    // Only check plan files
    if (!isPlanFile(filePath)) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // Detect time estimates in the content
    const timeEstimates = detectTimeEstimates(content);

    if (timeEstimates.length === 0) {
      // No time estimates - good!
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    // Time estimates detected - WARN
    const state = loadState();

    // Show first 3 examples
    const examples = timeEstimates.slice(0, 3);
    const exampleLines = examples.map(ex => {
      const context = extractContext(content, ex);
      return `  "${ex}" in context:\n    ${context.split('\n').join('\n    ')}`;
    });

    const message = [
      '',
      '┌─────────────────────────────────────────────────────────┐',
      '│ ⚠️  TIME ESTIMATES DETECTED IN PLAN                      │',
      '├─────────────────────────────────────────────────────────┤',
      `│ File: ${path.basename(filePath).substring(0, 48).padEnd(48)} │`,
      `│ Time references found: ${timeEstimates.length.toString().padEnd(31)} │`,
      '├─────────────────────────────────────────────────────────┤',
      '│ RULE: Plans should NOT include time estimates           │',
      '│                                                         │',
      '│ Focus on WHAT to do, not WHEN or HOW LONG:             │',
      '│ ❌ "Week 1-2: Implement feature X"                      │',
      '│ ✅ "Phase 1: Implement feature X"                       │',
      '│                                                         │',
      '│ ❌ "This will take about 2 hours"                       │',
      '│ ✅ "This requires implementing X, Y, and Z"             │',
      '├─────────────────────────────────────────────────────────┤',
      '│ Examples found:                                         │',
      ...exampleLines.flatMap(line => line.split('\n').map(l => `│ ${l.substring(0, 56).padEnd(56)} │`)),
      '├─────────────────────────────────────────────────────────┤',
      '│ Please revise the plan to remove time references        │',
      '└─────────────────────────────────────────────────────────┘',
      ''
    ].join('\n');

    // Log the warning
    if (state) {
      if (!state.warnings) state.warnings = [];
      state.warnings.push({
        timestamp: new Date().toISOString(),
        rule: 'time_estimate_detected',
        file: filePath,
        count: timeEstimates.length,
        examples: examples
      });
      saveState(state);
    }

    // Warn but allow (Phase 3 warns, Phase 4 could block)
    console.log(JSON.stringify({
      continue: true,
      message: message
    }));

  } catch (e) {
    // On any error, allow the action
    console.log(JSON.stringify({ continue: true }));
  }
}

main().catch(() => {
  console.log(JSON.stringify({ continue: true }));
});
