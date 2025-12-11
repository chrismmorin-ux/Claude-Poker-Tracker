#!/usr/bin/env node
/**
 * Delegation Check Pre-Write Hook - BLOCKS writes to files marked for local models
 *
 * Hook Type: PreToolUse (Write) - runs BEFORE Claude writes a file
 *
 * Two-tier enforcement:
 * 1. Project file check - If file is marked "Local Model" in task delegation table
 * 2. Simple task detection - If writing a NEW file under typical delegable patterns
 *
 * Override methods:
 * - "claude:" prefix in user prompt (handled by local-model-delegate.cjs)
 * - "<!-- OVERRIDE_DELEGATION: reason -->" comment in project file
 * - Existing file modification (only NEW file creation triggers delegation check)
 *
 * Exit codes:
 * - 0: Allow write
 * - 2: BLOCK write (file should be delegated)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PROJECTS_FILE = path.join(process.cwd(), '.claude', 'projects.json');
const VIOLATIONS_FILE = path.join(process.cwd(), '.claude', '.delegation-violations.json');

function getActiveProjectFile() {
  try {
    if (!fs.existsSync(PROJECTS_FILE)) return null;
    const projects = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
    if (projects.active?.length > 0) {
      return projects.active[0].file;
    }
  } catch (e) {}
  return null;
}

function checkDelegationTable(projectContent, filename) {
  // Look for Task Delegation Analysis tables
  // Format: | Task | Complexity | Local Model? | Reason |
  // or: | Task | ... | **Yes** | ...

  const basename = path.basename(filename);
  const escapedBasename = basename.replace(/\./g, '\\.');

  // Pattern to match table rows that mention this file with delegation marker
  const tableRowPattern = new RegExp(
    `\\|[^|]*${escapedBasename}[^|]*\\|[^|]*\\|[^|]*(\\*\\*Yes\\*\\*|Local Model|local)[^|]*\\|`,
    'i'
  );

  // Also check for explicit "Owner: Local Model" in step descriptions
  const ownerPattern = new RegExp(
    `###[^#]*${escapedBasename}[\\s\\S]{0,200}\\*\\*Owner:\\s*Local\\s*Model\\*\\*`,
    'i'
  );

  // Check for file in "Files to Create" with (owner: local)
  const filesToCreatePattern = new RegExp(
    '\\[\\s*\\]\\s*`[^`]*' + escapedBasename + '`[^\\n]*\\(owner:\\s*local\\)',
    'i'
  );

  // Check for (owner: local) or (owner: local model) anywhere near the filename
  const generalOwnerPattern = new RegExp(
    escapedBasename + '[^\\n]{0,50}\\(owner:\\s*local',
    'i'
  );

  return tableRowPattern.test(projectContent) ||
         ownerPattern.test(projectContent) ||
         filesToCreatePattern.test(projectContent) ||
         generalOwnerPattern.test(projectContent);
}

function hasOverride(projectContent, filename) {
  const basename = path.basename(filename);
  // Check for override comment: <!-- OVERRIDE_DELEGATION: reason -->
  const overridePattern = new RegExp(
    `<!--\\s*OVERRIDE_DELEGATION[^>]*${basename.replace(/\./g, '\\.')}[^>]*-->`,
    'i'
  );
  // Also check for general override at file level
  const generalOverride = new RegExp(
    `<!--\\s*OVERRIDE_DELEGATION:\\s*[^>]+-->`,
    'i'
  );
  // Check if override is near the filename (within 200 chars)
  const nearbyOverride = projectContent.includes(basename) &&
    projectContent.includes('OVERRIDE_DELEGATION');

  return overridePattern.test(projectContent) || nearbyOverride;
}

function logBlockedAttempt(filename, projectFile) {
  try {
    let data = {
      version: "1.0",
      lastUpdate: new Date().toISOString(),
      violations: [],
      blockedAttempts: [],
      metrics: {
        totalTasksTracked: 0,
        tasksActuallyDelegated: 0,
        attemptsBlocked: 0,
        complianceRate: 0,
        tokensSavedEstimate: 0,
        tokensWastedEstimate: 0
      },
      history: []
    };

    if (fs.existsSync(VIOLATIONS_FILE)) {
      try {
        data = JSON.parse(fs.readFileSync(VIOLATIONS_FILE, 'utf8'));
        if (!data.blockedAttempts) data.blockedAttempts = [];
        if (!data.metrics.attemptsBlocked) data.metrics.attemptsBlocked = 0;
      } catch (e) {
        // Reset if file is corrupted
      }
    }

    // Add blocked attempt
    data.blockedAttempts.push({
      file: filename,
      project: projectFile,
      timestamp: new Date().toISOString(),
      tokensSaved: 800 // Estimated tokens saved by blocking
    });

    // Update metrics
    data.metrics.attemptsBlocked++;
    data.metrics.tokensSavedEstimate += 800;
    data.lastUpdate = new Date().toISOString();

    // Keep only last 100 blocked attempts
    if (data.blockedAttempts.length > 100) {
      data.blockedAttempts = data.blockedAttempts.slice(-100);
    }

    fs.writeFileSync(VIOLATIONS_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    // Silent fail - don't break workflow
  }
}

function getSuggestedCommand(filename) {
  const ext = path.extname(filename).toLowerCase();
  const basename = path.basename(filename).toLowerCase();

  if (basename.includes('test') || basename.includes('spec')) {
    return '/local-test';
  }
  if (ext === '.jsx' || ext === '.tsx') {
    return '/local-code';
  }
  if (ext === '.js' || ext === '.ts') {
    if (basename.includes('util') || basename.includes('helper')) {
      return '/local-code';
    }
    return '/local-code';
  }
  if (ext === '.md') {
    return '/local-doc';
  }
  return '/local-code';
}

async function main() {
  // Read tool input from stdin with timeout
  let input = '';

  try {
    const rl = readline.createInterface({
      input: process.stdin,
      terminal: false
    });

    // Set timeout for stdin read
    const timeout = setTimeout(() => {
      rl.close();
    }, 1000);

    for await (const line of rl) {
      input += line;
    }
    clearTimeout(timeout);
  } catch (e) {
    // Stdin read failed, allow write
    process.exit(0);
  }

  let filename;
  try {
    const data = JSON.parse(input);
    filename = data.tool_input?.file_path || data.file_path;
  } catch (e) {
    // If not JSON, might be raw path
    filename = input.trim();
  }

  if (!filename) {
    process.exit(0);
  }

  // Skip non-source files
  if (!filename.match(/\.(jsx?|tsx?|cjs|mjs)$/)) {
    process.exit(0);
  }

  // Get active project file
  const projectFile = getActiveProjectFile();
  if (!projectFile) {
    process.exit(0);
  }

  const projectPath = path.join(process.cwd(), projectFile);
  if (!fs.existsSync(projectPath)) {
    process.exit(0);
  }

  const projectContent = fs.readFileSync(projectPath, 'utf8');

  // Check for override first
  if (hasOverride(projectContent, filename)) {
    process.exit(0); // Allow write - override present
  }

  // Check if this file should be delegated
  if (checkDelegationTable(projectContent, filename)) {
    const basename = path.basename(filename);
    const suggestedCmd = getSuggestedCommand(filename);

    console.error('');
    console.error('┌─────────────────────────────────────────────────────────────┐');
    console.error('│  ❌ WRITE BLOCKED - Delegation Required                     │');
    console.error('├─────────────────────────────────────────────────────────────┤');
    console.error(`│  File: ${basename.substring(0, 51).padEnd(51)}│`);
    console.error('│                                                             │');
    console.error('│  This file is marked for LOCAL MODEL delegation in the     │');
    console.error('│  project file. Claude must NOT write it directly.          │');
    console.error('│                                                             │');
    console.error('│  Instead, use one of these commands:                        │');
    console.error(`│  → ${suggestedCmd.padEnd(55)}│`);
    console.error('│  → /local-refactor (for restructuring)                      │');
    console.error('│  → /local-test (for test generation)                        │');
    console.error('│                                                             │');
    console.error('│  To override (if delegation is inappropriate):              │');
    console.error('│  Add to project file:                                       │');
    console.error('│  <!-- OVERRIDE_DELEGATION: [reason] -->                     │');
    console.error('└─────────────────────────────────────────────────────────────┘');
    console.error('');

    logBlockedAttempt(filename, projectFile);
    process.exit(2); // BLOCK THE WRITE
  }

  // Tier 2: Check if this is a NEW simple file that should be delegated
  // Only applies to new file creation (not edits to existing files)
  const fullPath = path.isAbsolute(filename) ? filename : path.join(process.cwd(), filename);
  const isNewFile = !fs.existsSync(fullPath);

  if (isNewFile) {
    const basename = path.basename(filename).toLowerCase();

    // Patterns that suggest simple, delegable new files
    const delegablePatterns = [
      /util[s]?\.js$/,        // utility files
      /helper[s]?\.js$/,      // helper files
      /format.*\.js$/,        // formatters
      /constant[s]?\.js$/,    // constants (simple)
      /type[s]?\.js$/,        // type definitions
      /validation\.js$/,      // simple validators
    ];

    const isDelegablePattern = delegablePatterns.some(p => p.test(basename));

    // Check for override bypass marker in environment or session
    const bypassFile = path.join(process.cwd(), '.claude', '.delegation-bypass');
    const hasSessionBypass = fs.existsSync(bypassFile);

    if (isDelegablePattern && !hasSessionBypass) {
      const suggestedCmd = getSuggestedCommand(filename);

      console.error('');
      console.error('┌─────────────────────────────────────────────────────────────┐');
      console.error('│  ⚠️  NEW FILE BLOCKED - Consider Local Model                 │');
      console.error('├─────────────────────────────────────────────────────────────┤');
      console.error(`│  File: ${path.basename(filename).substring(0, 51).padEnd(51)}│`);
      console.error('│                                                             │');
      console.error('│  This appears to be a simple utility file that could be     │');
      console.error('│  generated by a local model (saves ~1,500 tokens).          │');
      console.error('│                                                             │');
      console.error('│  Recommended:                                               │');
      console.error(`│  → ${suggestedCmd.padEnd(55)}│`);
      console.error('│  → Or create task spec: .claude/task-specs/T-XXX.json       │');
      console.error('│                                                             │');
      console.error('│  To proceed with Claude anyway:                             │');
      console.error('│  → User can prefix prompt with "claude:"                    │');
      console.error('└─────────────────────────────────────────────────────────────┘');
      console.error('');

      logBlockedAttempt(filename, 'auto-detected-simple');
      process.exit(2); // BLOCK - suggest delegation
    }
  }

  process.exit(0); // Allow write
}

main().catch(err => {
  console.error('[DELEGATION-PRE] Hook error:', err.message);
  process.exit(0); // Allow on error to be safe
});
