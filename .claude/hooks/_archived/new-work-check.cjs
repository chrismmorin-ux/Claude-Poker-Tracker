#!/usr/bin/env node
/**
 * New Work Check Hook - Reminds to create project file for multi-file tasks
 *
 * Hook Type: UserPromptSubmit (runs on user messages)
 *
 * Detects keywords suggesting multi-file work:
 * - refactor, implement, add feature, build, create, migrate
 * - fix bug (if followed by "across" or "multiple")
 *
 * If no active project exists, suggests /project start
 *
 * Exit codes:
 * - 0: Always allow (informational only)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PROJECTS_FILE = path.join(process.cwd(), '.claude', 'projects.json');
const SESSION_FILE = path.join(process.cwd(), '.claude', '.new-work-check-shown.json');

// Only show once per 30 minutes for same type of reminder
const REMINDER_WINDOW_MS = 30 * 60 * 1000;

// Keywords suggesting multi-file work
const MULTI_FILE_KEYWORDS = [
  /\brefactor(?:ing)?\b/i,
  /\bimplement(?:ing|ation)?\b/i,
  /\badd(?:ing)?\s+(?:a\s+)?(?:new\s+)?feature/i,
  /\bbuild(?:ing)?\s+(?:a\s+)?(?:new\s+)?/i,
  /\bcreate\s+(?:a\s+)?(?:new\s+)?(?:system|feature|module|component)/i,
  /\bmigrat(?:e|ing|ion)\b/i,
  /\boverhaul\b/i,
  /\bredesign\b/i,
  /\brestructur(?:e|ing)\b/i,
  /\bcomprehensive\b/i,
  /\bmulti-?file\b/i,
  /\bacross\s+(?:multiple|several|all)\s+files/i,
  /\bphased?\s+(?:approach|implementation|rollout)/i,
];

// Keywords that suggest this is just a question, not a task
const QUESTION_INDICATORS = [
  /^(?:what|how|why|when|where|can|does|is|are|should|would|could)\s/i,
  /\?$/,
  /^explain\b/i,
  /^tell\s+me\b/i,
  /^show\s+me\b/i,
];

function loadProjects() {
  try {
    if (fs.existsSync(PROJECTS_FILE)) {
      return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
    }
  } catch (e) {}
  return { active: [], pending: [], completed: [] };
}

function hasActiveProject() {
  const projects = loadProjects();
  return projects.active?.length > 0;
}

function hasShownRecently() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      const age = Date.now() - data.timestamp;
      return age < REMINDER_WINDOW_MS;
    }
  } catch (e) {}
  return false;
}

function markShown() {
  try {
    const dir = path.dirname(SESSION_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ timestamp: Date.now() }));
  } catch (e) {}
}

function isQuestion(prompt) {
  return QUESTION_INDICATORS.some(pattern => pattern.test(prompt.trim()));
}

function detectsMultiFileWork(prompt) {
  return MULTI_FILE_KEYWORDS.some(pattern => pattern.test(prompt));
}

function suggestProjectName(prompt) {
  // Extract a reasonable project name from the prompt
  const words = prompt.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !['the', 'and', 'for', 'with', 'that', 'this', 'from'].includes(w))
    .slice(0, 3);

  if (words.length >= 2) {
    return words.join('-');
  }
  return 'new-feature';
}

async function main() {
  let input = '';
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) { input += line; }

  // Skip if we've shown recently
  if (hasShownRecently()) {
    process.exit(0);
  }

  // Skip if there's already an active project
  if (hasActiveProject()) {
    process.exit(0);
  }

  // Check if the prompt suggests multi-file work
  const prompt = input.trim();

  // Skip if it's just a question
  if (isQuestion(prompt)) {
    process.exit(0);
  }

  // Check for multi-file keywords
  if (detectsMultiFileWork(prompt)) {
    const suggestedName = suggestProjectName(prompt);

    console.log('\n┌─────────────────────────────────────────────────────────────┐');
    console.log('│  📁 MULTI-FILE TASK DETECTED                                │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    console.log('│  This looks like a task that may span multiple files.      │');
    console.log('│  Consider creating a project to track progress:            │');
    console.log('│                                                             │');
    console.log(`│  /project start ${suggestedName.padEnd(40)}│`);
    console.log('│                                                             │');
    console.log('│  Benefits:                                                  │');
    console.log('│  - Progress tracked across chat sessions                    │');
    console.log('│  - Phase-by-phase checkpoints                               │');
    console.log('│  - Easier handoff if context is lost                        │');
    console.log('└─────────────────────────────────────────────────────────────┘\n');

    markShown();
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[NEW-WORK] Hook error:', err.message);
  process.exit(0);
});
