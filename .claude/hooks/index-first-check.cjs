#!/usr/bin/env node
/**
 * Index-First Check Hook
 *
 * Reminds to check index files before launching Explore agents.
 * Tracks when agents are launched for questions that could be
 * answered by index/context files.
 *
 * Hook Type: PreToolUse (Task)
 * Exit codes: 0 (always allow - informational only)
 *
 * Checks for:
 * - "where is" questions → suggest SYMBOLS.md
 * - "find function" questions → suggest SYMBOLS.md
 * - "what files" questions → suggest STRUCTURE.md
 * - "how does X work" questions → suggest context files
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const INDEX_SYMBOLS = path.join(process.cwd(), '.claude', 'index', 'SYMBOLS.md');
const INDEX_STRUCTURE = path.join(process.cwd(), '.claude', 'index', 'STRUCTURE.md');
const CONTEXT_DIR = path.join(process.cwd(), '.claude', 'context');

// Keywords that suggest index files would help
const SYMBOL_KEYWORDS = [
  /where\s+is\s+/i,
  /find\s+(function|const|component|hook)/i,
  /locate\s+/i,
  /which\s+file\s+(has|contains|defines)/i,
  /what\s+file\s+/i,
  /defined\s+in/i,
];

const STRUCTURE_KEYWORDS = [
  /file\s+structure/i,
  /directory\s+(layout|structure)/i,
  /codebase\s+structure/i,
  /how\s+is\s+(the\s+)?(code|project)\s+organized/i,
  /what\s+files\s+are/i,
];

const CONTEXT_KEYWORDS = [
  /how\s+does\s+.+\s+work/i,
  /explain\s+(the\s+)?(state|reducer|persistence)/i,
  /what\s+is\s+the\s+(state|schema|pattern)/i,
  /understand\s+the\s+/i,
];

async function readStdin() {
  return new Promise((resolve) => {
    let input = '';
    const rl = readline.createInterface({
      input: process.stdin,
      terminal: false
    });

    const timeout = setTimeout(() => {
      rl.close();
      resolve(input);
    }, 1000);

    rl.on('line', (line) => {
      input += line;
    });

    rl.on('close', () => {
      clearTimeout(timeout);
      resolve(input);
    });
  });
}

function checkKeywords(prompt, patterns) {
  return patterns.some(pattern => pattern.test(prompt));
}

async function main() {
  const input = await readStdin();

  let data;
  try {
    data = JSON.parse(input);
  } catch (e) {
    process.exit(0);
  }

  const tool = data?.tool;
  if (tool !== 'Task') {
    process.exit(0);
  }

  const subagentType = data?.tool_input?.subagent_type || '';
  const prompt = data?.tool_input?.prompt || '';

  // Only check Explore agents
  if (!subagentType.toLowerCase().includes('explore')) {
    process.exit(0);
  }

  const suggestions = [];

  // Check for symbol-related queries
  if (checkKeywords(prompt, SYMBOL_KEYWORDS)) {
    if (fs.existsSync(INDEX_SYMBOLS)) {
      suggestions.push({
        type: 'index',
        file: '.claude/index/SYMBOLS.md',
        reason: 'Function/constant locations',
      });
    }
  }

  // Check for structure-related queries
  if (checkKeywords(prompt, STRUCTURE_KEYWORDS)) {
    if (fs.existsSync(INDEX_STRUCTURE)) {
      suggestions.push({
        type: 'index',
        file: '.claude/index/STRUCTURE.md',
        reason: 'Directory/file layout',
      });
    }
  }

  // Check for context-related queries
  if (checkKeywords(prompt, CONTEXT_KEYWORDS)) {
    if (fs.existsSync(CONTEXT_DIR)) {
      suggestions.push({
        type: 'context',
        file: '.claude/context/',
        reason: 'Domain summaries (STATE_SCHEMA.md, PERSISTENCE_OVERVIEW.md)',
      });
    }
  }

  // Show suggestions if any found
  if (suggestions.length > 0) {
    console.log('');
    console.log('[INDEX-FIRST] Token optimization suggestion:');
    console.log('  Before launching Explore agent, check:');
    suggestions.forEach(s => {
      console.log(`  - ${s.file} (${s.reason})`);
    });
    console.log('');
    console.log('  These files may answer your question in ~100-500 tokens');
    console.log('  vs ~1000-3000 tokens for an Explore agent.');
    console.log('');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[index-first-check] Error:', err.message);
  process.exit(0);
});
