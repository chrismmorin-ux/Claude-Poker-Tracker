#!/usr/bin/env node
/**
 * Scan-First Check Hook
 *
 * Enforces the "scan before drill" pattern:
 * - Tracks Grep/Glob usage (scans)
 * - Warns when Read is called on src/ files without prior scan
 * - Encourages using index files first
 *
 * Hook Type: PreToolUse (Read)
 * Exit codes:
 *   0 = allow (with optional warning)
 *   2 = block (not used - informational only for now)
 *
 * Session file: .claude/.scan-session.json
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(process.cwd(), '.claude', '.scan-session.json');

const CONFIG = {
  SESSION_EXPIRY_MINUTES: 30,  // Reset scan memory after 30 min idle
  WARN_AFTER_DIRECT_READS: 2,  // Warn after 2 direct reads without scan
  ALLOWED_DIRECT_PATTERNS: [
    /\.claude[/\\]/,            // .claude/ files always allowed
    /docs[/\\]/,                // docs/ files allowed
    /package\.json$/,           // Package files allowed
    /\.md$/,                    // Markdown allowed
    /\.json$/,                  // JSON config allowed
    /test[s]?[/\\]/,            // Test files allowed
    /__tests__[/\\]/,           // Test files allowed
  ],
};

function loadSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));

      // Reset if session is stale
      const expiryTime = Date.now() - (CONFIG.SESSION_EXPIRY_MINUTES * 60 * 1000);
      if (data.lastActivity < expiryTime) {
        return createEmptySession();
      }
      return data;
    }
  } catch (e) {
    // Silently fail
  }
  return createEmptySession();
}

function createEmptySession() {
  return {
    lastActivity: Date.now(),
    scannedPatterns: [],      // Patterns searched via Grep
    scannedGlobs: [],         // Globs searched via Glob
    directReads: 0,           // Reads without prior scan
    scanThenDrillReads: 0,    // Reads with prior scan
    warningsShown: [],
  };
}

function saveSession(session) {
  try {
    const dir = path.dirname(SESSION_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
  } catch (e) {
    // Silently fail
  }
}

function isAllowedDirectRead(filePath) {
  return CONFIG.ALLOWED_DIRECT_PATTERNS.some(pattern => pattern.test(filePath));
}

function wasScannedFirst(session, filePath) {
  const fileName = path.basename(filePath);
  const dirName = path.dirname(filePath);

  // Check if any grep pattern matches this file
  for (const pattern of session.scannedPatterns) {
    try {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(filePath) || regex.test(fileName)) {
        return true;
      }
    } catch (e) {
      // Invalid regex, skip
    }
  }

  // Check if any glob pattern matches this file path
  for (const glob of session.scannedGlobs) {
    // Simple glob matching - if glob directory is parent of file
    const globDir = glob.replace(/\*.*$/, '');
    if (filePath.includes(globDir) || dirName.includes(globDir)) {
      return true;
    }
    // Match file extension patterns like *.jsx
    if (glob.includes('*')) {
      const ext = glob.split('*').pop();
      if (ext && filePath.endsWith(ext)) {
        return true;
      }
    }
  }

  return false;
}

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

async function main() {
  const input = await readStdin();

  let data;
  try {
    data = JSON.parse(input);
  } catch (e) {
    process.exit(0);
  }

  const tool = data?.tool;
  const session = loadSession();
  session.lastActivity = Date.now();

  // Track Grep usage - remember searched patterns
  if (tool === 'Grep') {
    const pattern = data?.tool_input?.pattern;
    if (pattern && !session.scannedPatterns.includes(pattern)) {
      session.scannedPatterns.push(pattern);
      // Keep only last 20 patterns
      if (session.scannedPatterns.length > 20) {
        session.scannedPatterns.shift();
      }
    }
    saveSession(session);
    process.exit(0);
  }

  // Track Glob usage - remember searched globs
  if (tool === 'Glob') {
    const pattern = data?.tool_input?.pattern;
    if (pattern && !session.scannedGlobs.includes(pattern)) {
      session.scannedGlobs.push(pattern);
      // Keep only last 20 globs
      if (session.scannedGlobs.length > 20) {
        session.scannedGlobs.shift();
      }
    }
    saveSession(session);
    process.exit(0);
  }

  // Check Read tool usage
  if (tool === 'Read') {
    const filePath = data?.tool_input?.file_path || '';

    // Skip check for allowed patterns
    if (isAllowedDirectRead(filePath)) {
      saveSession(session);
      process.exit(0);
    }

    // Check if this is a source file (normalize path for cross-platform)
    const normalizedPath = filePath.replace(/\\/g, '/');
    const isSourceFile = normalizedPath.includes('/src/');
    if (!isSourceFile) {
      saveSession(session);
      process.exit(0);
    }

    // Check if file was scanned first
    if (wasScannedFirst(session, filePath)) {
      session.scanThenDrillReads = (session.scanThenDrillReads || 0) + 1;
      saveSession(session);
      process.exit(0);
    }

    // Direct read without scan
    session.directReads = (session.directReads || 0) + 1;

    // Show warning after threshold
    const warningKey = 'scan-first-warning';
    if (session.directReads >= CONFIG.WARN_AFTER_DIRECT_READS &&
        !session.warningsShown.includes(warningKey)) {
      console.log('');
      console.log('[SCAN-FIRST] Token optimization reminder:');
      console.log(`  Reading ${path.basename(filePath)} without prior Grep/Glob.`);
      console.log('');
      console.log('  Better pattern: Scan → Drill');
      console.log('  1. Grep for pattern to find files');
      console.log('  2. Read only matched files');
      console.log('');
      console.log('  Or check .claude/index/SYMBOLS.md for function locations.');
      console.log('');
      session.warningsShown.push(warningKey);
    }

    saveSession(session);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[scan-first-check] Error:', err.message);
  process.exit(0);
});
