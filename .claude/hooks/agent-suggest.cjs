#!/usr/bin/env node
/**
 * Agent Suggestion Hook - Recommends agent invocation based on edit context
 *
 * Triggers:
 * - code-reviewer: After editing reducer/hook/main component (3+ edits)
 * - test-gen: After editing utils with no adjacent test file
 * - component-auditor: After editing components > 200 lines
 *
 * See engineering_practices.md Section 11: AI Agent Interaction Rules
 *
 * Exit codes:
 * - 0: Always allow (suggestion only)
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Agent trigger configurations
const AGENT_TRIGGERS = {
  'code-reviewer': {
    patterns: [/reducers[\\\/]/, /hooks[\\\/]/, /PokerTracker\.jsx$/, /persistence\.js$/],
    minEdits: 3,
    message: 'Consider running `/review staged` to catch issues before committing.'
  },
  'test-gen': {
    patterns: [/utils[\\\/](?!.*\.test\.js$).*\.js$/, /hooks[\\\/](?!.*\.test\.js$).*\.js$/],
    checkTestExists: true,
    message: 'This file may lack test coverage. Consider `/gen-tests $FILE`.'
  },
  'component-auditor': {
    patterns: [/components[\\\/](views|ui)[\\\/].*\.jsx$/],
    minLines: 200,
    message: 'This component is substantial. Consider `/audit-component $FILE`.'
  }
};

const SESSION_FILE = path.join(process.cwd(), '.claude', '.agent-suggest-session.json');

function loadSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      // Reset if older than 2 hours
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
      if (data.startTime < twoHoursAgo) {
        return { editCounts: {}, suggestedFor: [], startTime: Date.now() };
      }
      return data;
    }
  } catch (e) {}
  return { editCounts: {}, suggestedFor: [], startTime: Date.now() };
}

function saveSession(session) {
  try {
    const dir = path.dirname(SESSION_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
  } catch (e) {}
}

function checkTestExists(filePath) {
  // Check for co-located test file
  const testPath = filePath.replace(/\.js$/, '.test.js');
  if (fs.existsSync(testPath)) return true;

  // Check for test in __tests__ directory
  const fileName = path.basename(filePath, '.js');
  const baseName = path.basename(filePath, '.jsx');
  const testDir = path.join(process.cwd(), 'src', '__tests__');

  const possiblePaths = [
    path.join(testDir, `${fileName}.test.js`),
    path.join(testDir, `${baseName}.test.js`),
    path.join(testDir, 'utils', `${fileName}.test.js`),
    path.join(testDir, 'hooks', `${fileName}.test.js`),
    path.join(testDir, 'reducers', `${fileName}.test.js`)
  ];

  return possiblePaths.some(p => fs.existsSync(p));
}

function getLineCount(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').length;
  } catch (e) {
    return 0;
  }
}

async function main() {
  let input = '';
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) { input += line; }

  let data;
  try { data = JSON.parse(input); } catch (e) { process.exit(0); }

  // Handle both Edit and Write tools
  if (data?.tool !== 'Edit' && data?.tool !== 'Write') process.exit(0);

  const filePath = data?.tool_input?.file_path || '';
  if (!filePath) process.exit(0);

  const session = loadSession();

  for (const [agent, config] of Object.entries(AGENT_TRIGGERS)) {
    const matchesPattern = config.patterns.some(p => p.test(filePath));
    if (!matchesPattern) continue;

    // Track edits for patterns with minEdits threshold
    const patternKey = `${agent}`;
    if (config.minEdits) {
      session.editCounts[patternKey] = (session.editCounts[patternKey] || 0) + 1;
    }

    let shouldSuggest = false;
    let reason = '';

    // Check minimum edits threshold
    if (config.minEdits && session.editCounts[patternKey] >= config.minEdits) {
      shouldSuggest = true;
      reason = `${session.editCounts[patternKey]} edits to architecture-significant files`;
    }

    // Check test existence
    if (config.checkTestExists && !checkTestExists(filePath)) {
      shouldSuggest = true;
      reason = 'No test file found for this module';
    }

    // Check line count
    if (config.minLines) {
      const lines = getLineCount(filePath);
      if (lines >= config.minLines) {
        shouldSuggest = true;
        reason = `Component is ${lines} lines (threshold: ${config.minLines})`;
      }
    }

    // Only suggest once per file per session
    const suggestionKey = `${agent}:${filePath}`;
    if (shouldSuggest && !session.suggestedFor.includes(suggestionKey)) {
      session.suggestedFor.push(suggestionKey);
      const message = config.message.replace('$FILE', filePath);
      console.log(`\n[SUGGEST:${agent}] ${reason}`);
      console.log(`  ${message}`);
    }
  }

  saveSession(session);
  process.exit(0);
}

main().catch(err => {
  console.error('Hook error:', err.message);
  process.exit(0);
});
