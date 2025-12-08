#!/usr/bin/env node
/**
 * Docs Sync Hook - Ensures documentation stays up to date with code changes
 *
 * Hook Type: PostToolUse (Edit, Write) and PreToolUse (Bash - git commit)
 *
 * Tracks:
 * - Source file edits that require doc updates
 * - Which docs have been updated this session
 * - Warns before commit if docs are stale
 *
 * Exit codes:
 * - 0: Always allow (suggestions only)
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(process.cwd(), '.claude', '.docs-sync-session.json');

// Map source patterns to required doc updates
const DOC_REQUIREMENTS = {
  // Constants changes -> CLAUDE.md architecture section
  'src/constants/': ['CLAUDE.md', 'docs/QUICK_REF.md'],

  // Hooks changes -> CLAUDE.md hooks section
  'src/hooks/': ['CLAUDE.md', 'docs/QUICK_REF.md'],

  // Reducers changes -> CLAUDE.md state management
  'src/reducers/': ['CLAUDE.md', 'docs/STATE_SCHEMAS.md'],

  // Utils changes -> CLAUDE.md utils section
  'src/utils/': ['CLAUDE.md', 'docs/QUICK_REF.md'],

  // Views changes -> CLAUDE.md file structure
  'src/components/views/': ['CLAUDE.md'],

  // UI components -> CLAUDE.md component section
  'src/components/ui/': ['CLAUDE.md', 'docs/QUICK_REF.md'],

  // Command changes -> CLAUDE.md commands section
  '.claude/commands/': ['CLAUDE.md'],

  // Engineering practices -> CHANGELOG if significant
  'engineering_practices.md': ['docs/CHANGELOG.md'],

  // New features -> CHANGELOG
  'src/PokerTracker.jsx': ['docs/CHANGELOG.md'],
};

// Docs that are considered "updated" (these reset the staleness tracker)
const DOC_FILES = [
  'CLAUDE.md',
  'docs/QUICK_REF.md',
  'docs/CHANGELOG.md',
  'docs/STATE_SCHEMAS.md',
  'docs/SPEC.md',
  'docs/DEBUGGING.md',
  'engineering_practices.md',
];

function loadSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      // Reset if older than 2 hours
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
      if (data.startTime < twoHoursAgo) {
        return createEmptySession();
      }
      return data;
    }
  } catch (e) {}
  return createEmptySession();
}

function createEmptySession() {
  return {
    startTime: Date.now(),
    sourceEdits: [],      // Source files edited
    docsUpdated: [],      // Doc files updated
    requiredDocs: new Set(), // Docs that should be updated
    warningsShown: [],
  };
}

function saveSession(session) {
  try {
    const dir = path.dirname(SESSION_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Convert Set to Array for JSON serialization
    const toSave = {
      ...session,
      requiredDocs: Array.from(session.requiredDocs || []),
    };
    fs.writeFileSync(SESSION_FILE, JSON.stringify(toSave, null, 2));
  } catch (e) {}
}

function getRequiredDocs(filePath) {
  const required = new Set();
  for (const [pattern, docs] of Object.entries(DOC_REQUIREMENTS)) {
    if (filePath.includes(pattern.replace(/\//g, path.sep)) ||
        filePath.includes(pattern.replace(/\//g, '/'))) {
      docs.forEach(d => required.add(d));
    }
  }
  return required;
}

function isDocFile(filePath) {
  return DOC_FILES.some(doc => filePath.endsWith(doc));
}

function getDocName(filePath) {
  for (const doc of DOC_FILES) {
    if (filePath.endsWith(doc)) return doc;
  }
  return null;
}

async function main() {
  let input = '';
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) { input += line; }

  let data;
  try { data = JSON.parse(input); } catch (e) { process.exit(0); }

  const session = loadSession();
  // Convert array back to Set if loaded from JSON
  if (Array.isArray(session.requiredDocs)) {
    session.requiredDocs = new Set(session.requiredDocs);
  }

  // Handle PostToolUse (Edit/Write)
  if (data?.tool === 'Edit' || data?.tool === 'Write') {
    const filePath = data?.tool_input?.file_path || '';
    if (!filePath) { process.exit(0); }

    // Check if this is a doc file being updated
    if (isDocFile(filePath)) {
      const docName = getDocName(filePath);
      if (docName && !session.docsUpdated.includes(docName)) {
        session.docsUpdated.push(docName);
        session.requiredDocs.delete(docName);
      }
    } else {
      // Source file edited - track required docs
      if (!session.sourceEdits.includes(filePath)) {
        session.sourceEdits.push(filePath);
      }
      const required = getRequiredDocs(filePath);
      required.forEach(doc => {
        if (!session.docsUpdated.includes(doc)) {
          session.requiredDocs.add(doc);
        }
      });
    }

    // Periodic reminder after significant source changes
    const staleDocs = Array.from(session.requiredDocs);
    if (session.sourceEdits.length >= 5 && staleDocs.length > 0 &&
        !session.warningsShown.includes('periodic')) {
      console.log('\n[DOCS] Source files modified. These docs may need updating:');
      staleDocs.forEach(doc => console.log('  - ' + doc));
      session.warningsShown.push('periodic');
    }

    saveSession(session);
    process.exit(0);
  }

  // Handle PreToolUse (git commit check)
  if (data?.tool === 'Bash') {
    const command = data?.tool_input?.command || '';

    if (/git\s+commit/.test(command)) {
      const staleDocs = Array.from(session.requiredDocs);

      if (staleDocs.length > 0 && session.sourceEdits.length >= 3) {
        console.log('\n[DOCS] ⚠️  Documentation may be stale!');
        console.log('Source files edited: ' + session.sourceEdits.length);
        console.log('Docs that may need updating:');
        staleDocs.forEach(doc => console.log('  - ' + doc));
        console.log('\nDocs already updated this session:');
        if (session.docsUpdated.length > 0) {
          session.docsUpdated.forEach(doc => console.log('  ✓ ' + doc));
        } else {
          console.log('  (none)');
        }
        console.log('\nConsider updating docs before committing.');
      }
    }

    process.exit(0);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[DOCS] Hook error:', err.message);
  process.exit(0);
});
