#!/usr/bin/env node
/**
 * Delegation Check Pre-Write Hook - BLOCKS writes to files assigned to local models
 *
 * Hook Type: PreToolUse (Write/Edit) - runs BEFORE Claude writes/edits a file
 *
 * ENFORCEMENT MODEL: Block-by-default for delegated tasks
 *
 * Primary check (dispatcher-aware):
 * 1. Read .claude/backlog.json (source of truth for task assignments)
 * 2. Find tasks where files_touched includes target file
 * 3. If task.assigned_to starts with "local:", BLOCK
 *
 * Secondary check (project-aware):
 * 1. Scan ALL active project files for delegation markers
 * 2. Match deepseek, qwen, local:*, or traditional "Local Model" markers
 *
 * Fallback check (pattern-based):
 * 1. For new files matching delegable patterns, warn/block
 *
 * Override methods:
 * - Create .claude/.delegation-bypass file (temporary session bypass)
 * - Add <!-- OVERRIDE_DELEGATION: reason --> in project file
 * - Mark task as assigned_to: "claude" in backlog
 *
 * Exit codes:
 * - 0: Allow write
 * - 2: BLOCK write (file should be delegated)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const BACKLOG_FILE = path.join(process.cwd(), '.claude', 'backlog.json');
const PROJECTS_FILE = path.join(process.cwd(), '.claude', 'projects.json');
const VIOLATIONS_FILE = path.join(process.cwd(), '.claude', '.delegation-violations.json');
const BYPASS_FILE = path.join(process.cwd(), '.claude', '.delegation-bypass');
const PROTECTED_FILES_CONFIG = path.join(process.cwd(), '.claude', '.protected-files.json');
const LOG_FILE = path.join(process.cwd(), '.claude', 'logs', 'delegation-check.log');

/**
 * Normalize path to forward slashes for consistent comparison
 * Handles Windows C:\, Git Bash /c/, and Unix paths
 */
function normalizePath(p) {
  if (!p) return '';
  let normalized = p.replace(/^([A-Za-z]):/, (_, drive) => '/' + drive.toLowerCase());
  normalized = normalized.replace(/\\/g, '/');
  normalized = normalized.replace(/\/$/, '');
  return normalized;
}

/**
 * Check if file is in the protected files list (blocks Claude regardless of source type)
 */
function checkProtectedFile(filePath) {
  try {
    if (!fs.existsSync(PROTECTED_FILES_CONFIG)) {
      return { blocked: false };
    }
    const config = JSON.parse(fs.readFileSync(PROTECTED_FILES_CONFIG, 'utf-8'));
    const files = config.files || [];
    const basename = path.basename(filePath);
    const normalizedFilePath = normalizePath(filePath);
    const normalizedCwd = normalizePath(process.cwd());
    const relativePath = normalizedFilePath.replace(normalizedCwd, '').replace(/^\//, '');

    for (const pattern of files) {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        if (regex.test(relativePath)) {
          const approvalFile = path.join(process.cwd(), '.claude', `.human-approved-${basename}`);
          if (fs.existsSync(approvalFile)) {
            return { blocked: false };
          }
          return { blocked: true, reason: `Protected file. Create .claude/.human-approved-${basename} to allow.` };
        }
      } else if (relativePath === pattern || relativePath.endsWith(pattern)) {
        const approvalFile = path.join(process.cwd(), '.claude', `.human-approved-${basename}`);
        if (fs.existsSync(approvalFile)) {
          return { blocked: false };
        }
        return { blocked: true, reason: `Protected file. Create .claude/.human-approved-${basename} to allow.` };
      }
    }
    return { blocked: false };
  } catch (e) {
    return { blocked: false };
  }
}

/**
 * Log diagnostic messages for debugging
 */
function log(message) {
  try {
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const timestamp = new Date().toISOString();
    fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
  } catch (e) {
    // Silent fail
  }
}

/**
 * Check if session bypass is active
 */
function hasSessionBypass() {
  return fs.existsSync(BYPASS_FILE);
}

/**
 * PRIMARY CHECK: Search backlog for task assignments
 * @param {string} filename - File being written
 * @returns {Object|null} - Task info if file is assigned to local model, null otherwise
 */
function checkBacklogAssignment(filename) {
  try {
    if (!fs.existsSync(BACKLOG_FILE)) {
      log('Backlog file not found');
      return null;
    }

    const backlog = JSON.parse(fs.readFileSync(BACKLOG_FILE, 'utf8'));
    const tasks = backlog.tasks || [];
    const basename = path.basename(filename);

    // Normalize the filename for comparison
    const normalizedFile = filename.replace(/\\/g, '/').toLowerCase();

    for (const task of tasks) {
      // Only check open or in_progress tasks
      if (task.status !== 'open' && task.status !== 'in_progress') {
        continue;
      }

      // Check if this file is in files_touched
      const filesTouched = task.files_touched || [];
      const matchesFile = filesTouched.some(f => {
        const normalizedTaskFile = f.replace(/\\/g, '/').toLowerCase();
        return normalizedFile.endsWith(normalizedTaskFile) ||
               normalizedTaskFile.endsWith(basename.toLowerCase()) ||
               normalizedFile.includes(normalizedTaskFile);
      });

      if (matchesFile) {
        // Check if assigned to local model
        const assignedTo = task.assigned_to || '';
        if (assignedTo.startsWith('local:')) {
          log(`BLOCK: File ${basename} is in task ${task.id} assigned to ${assignedTo}`);
          return {
            taskId: task.id,
            taskTitle: task.title,
            assignedTo: assignedTo,
            model: assignedTo.replace('local:', '')
          };
        } else if (assignedTo === 'claude' || assignedTo === 'human') {
          log(`ALLOW: File ${basename} is in task ${task.id} assigned to ${assignedTo}`);
          return null; // Explicitly assigned to claude/human
        }
      }
    }

    log(`No matching task found for ${basename}`);
    return null;
  } catch (e) {
    log(`Error checking backlog: ${e.message}`);
    return null;
  }
}

/**
 * SECONDARY CHECK: Search all active project files for delegation markers
 * @param {string} filename - File being written
 * @returns {Object|null} - Project info if file is marked for local model
 */
function checkProjectFiles(filename) {
  try {
    if (!fs.existsSync(PROJECTS_FILE)) {
      return null;
    }

    const projects = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
    const activeProjects = projects.active || [];
    const basename = path.basename(filename);
    const escapedBasename = basename.replace(/\./g, '\\.');

    // Patterns that indicate local model assignment
    // Now includes: deepseek, qwen, local:*, **Yes**, Local Model
    const delegationPatterns = [
      // Table row with model name: | ... | deepseek | ... | or | ... | qwen | ...
      new RegExp(`\\|[^|]*${escapedBasename}[^|]*\\|[^|]*(deepseek|qwen|local:[a-z]+)[^|]*\\|`, 'i'),
      // Table row with traditional markers
      new RegExp(`\\|[^|]*${escapedBasename}[^|]*\\|[^|]*(\\*\\*Yes\\*\\*|Local Model)[^|]*\\|`, 'i'),
      // Owner notation: **Owner: Local Model** or (owner: local)
      new RegExp(`${escapedBasename}[\\s\\S]{0,200}(\\*\\*Owner:\\s*Local|\\(owner:\\s*local)`, 'i'),
      // assigned_to pattern in JSON-like content
      new RegExp(`"files_touched"[^\\]]*${escapedBasename}[^}]*"assigned_to"\\s*:\\s*"local:`, 'i'),
    ];

    for (const project of activeProjects) {
      const projectPath = path.join(process.cwd(), project.file);
      if (!fs.existsSync(projectPath)) {
        continue;
      }

      const projectContent = fs.readFileSync(projectPath, 'utf8');

      // Check for override first
      if (projectContent.includes('OVERRIDE_DELEGATION') &&
          projectContent.includes(basename)) {
        log(`Override found for ${basename} in ${project.file}`);
        return null;
      }

      // Check all delegation patterns
      for (const pattern of delegationPatterns) {
        if (pattern.test(projectContent)) {
          log(`BLOCK: File ${basename} matched delegation pattern in ${project.file}`);
          return {
            projectId: project.id,
            projectFile: project.file
          };
        }
      }
    }

    return null;
  } catch (e) {
    log(`Error checking project files: ${e.message}`);
    return null;
  }
}

/**
 * FALLBACK CHECK: Pattern-based detection for new files
 * @param {string} filename - File being written
 * @returns {boolean} - True if file matches delegable patterns
 */
function isDelegablePattern(filename) {
  const fullPath = path.isAbsolute(filename) ? filename : path.join(process.cwd(), filename);

  // Only check new files
  if (fs.existsSync(fullPath)) {
    return false;
  }

  const basename = path.basename(filename).toLowerCase();

  // Patterns that suggest simple, delegable new files
  const delegablePatterns = [
    /util[s]?\.(js|cjs|mjs|ts)$/,
    /helper[s]?\.(js|cjs|mjs|ts)$/,
    /format.*\.(js|cjs|mjs|ts)$/,
    /constant[s]?\.(js|cjs|mjs|ts)$/,
    /type[s]?\.(js|cjs|mjs|ts)$/,
    /validation\.(js|cjs|mjs|ts)$/,
    /schema\.(js|cjs|mjs|ts)$/,
  ];

  return delegablePatterns.some(p => p.test(basename));
}

/**
 * Log blocked attempt for metrics
 */
function logBlockedAttempt(filename, reason, details) {
  try {
    let data = {
      version: "2.0",
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
      }
    };

    if (fs.existsSync(VIOLATIONS_FILE)) {
      try {
        data = JSON.parse(fs.readFileSync(VIOLATIONS_FILE, 'utf8'));
        if (!data.blockedAttempts) data.blockedAttempts = [];
      } catch (e) {}
    }

    data.blockedAttempts.push({
      file: filename,
      reason,
      details,
      timestamp: new Date().toISOString(),
      tokensSaved: 800
    });

    data.metrics.attemptsBlocked = (data.metrics.attemptsBlocked || 0) + 1;
    data.metrics.tokensSavedEstimate = (data.metrics.tokensSavedEstimate || 0) + 800;
    data.lastUpdate = new Date().toISOString();

    if (data.blockedAttempts.length > 100) {
      data.blockedAttempts = data.blockedAttempts.slice(-100);
    }

    fs.writeFileSync(VIOLATIONS_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    log(`Error logging blocked attempt: ${e.message}`);
  }
}

/**
 * Get suggested command based on file type
 */
function getSuggestedCommand(filename) {
  const ext = path.extname(filename).toLowerCase();
  const basename = path.basename(filename).toLowerCase();

  if (basename.includes('test') || basename.includes('spec')) {
    return '/local-test';
  }
  if (ext === '.md') {
    return '/local-doc';
  }
  return '/local-code';
}

async function main() {
  log('Hook started');

  // Check for session bypass
  if (hasSessionBypass()) {
    log('Session bypass active - allowing write');
    process.exit(0);
  }

  // Read tool input from stdin
  let input = '';
  try {
    const rl = readline.createInterface({
      input: process.stdin,
      terminal: false
    });

    const timeout = setTimeout(() => {
      rl.close();
    }, 1000);

    for await (const line of rl) {
      input += line;
    }
    clearTimeout(timeout);
  } catch (e) {
    log('Stdin read failed - allowing write');
    process.exit(0);
  }

  let filename;
  try {
    const data = JSON.parse(input);
    filename = data.tool_input?.file_path || data.file_path;
  } catch (e) {
    filename = input.trim();
  }

  if (!filename) {
    log('No filename provided - allowing write');
    process.exit(0);
  }

  log(`Checking file: ${filename}`);

  // PROTECTED FILES CHECK: Block regardless of file type
  // This runs BEFORE the non-source file skip to protect .json and other config files
  const protectedCheck = checkProtectedFile(filename);
  if (protectedCheck.blocked) {
    const basename = path.basename(filename);
    console.error('');
    console.error('┌─────────────────────────────────────────────────────────────┐');
    console.error('│  🛡️  PROTECTED FILE - Human Approval Required              │');
    console.error('├─────────────────────────────────────────────────────────────┤');
    console.error(`│  File: ${basename.substring(0, 51).padEnd(51)}│`);
    console.error('│                                                             │');
    console.error(`│  ${protectedCheck.reason.substring(0, 59).padEnd(59)}│`);
    console.error('│                                                             │');
    console.error('│  These files control enforcement and cannot be modified     │');
    console.error('│  by Claude without explicit human approval.                 │');
    console.error('└─────────────────────────────────────────────────────────────┘');
    console.error('');
    log(`BLOCKED (protected): ${filename}`);
    process.exit(2);
  }

  // Skip non-source files (but NOT protected files - they're checked above)
  if (!filename.match(/\.(jsx?|tsx?|cjs|mjs)$/)) {
    log('Non-source file - allowing write');
    process.exit(0);
  }

  const basename = path.basename(filename);

  // PRIMARY CHECK: Backlog task assignment
  const backlogMatch = checkBacklogAssignment(filename);
  if (backlogMatch) {
    const suggestedCmd = getSuggestedCommand(filename);

    console.error('');
    console.error('┌─────────────────────────────────────────────────────────────┐');
    console.error('│  ❌ WRITE BLOCKED - Task Assigned to Local Model            │');
    console.error('├─────────────────────────────────────────────────────────────┤');
    console.error(`│  File: ${basename.substring(0, 51).padEnd(51)}│`);
    console.error(`│  Task: ${backlogMatch.taskId.padEnd(51)}│`);
    console.error(`│  Assigned to: ${backlogMatch.assignedTo.padEnd(44)}│`);
    console.error('│                                                             │');
    console.error('│  This file is assigned to a local model in the backlog.    │');
    console.error('│  Claude must NOT write it directly.                         │');
    console.error('│                                                             │');
    console.error('│  Execute via dispatcher:                                    │');
    console.error('│  → node scripts/dispatcher.cjs assign-next ' + backlogMatch.taskId.padEnd(16) + '│');
    console.error('│                                                             │');
    console.error('│  Or use slash command:                                      │');
    console.error(`│  → ${suggestedCmd.padEnd(55)}│`);
    console.error('│                                                             │');
    console.error('│  To override (if delegation is inappropriate):              │');
    console.error('│  → Update task assigned_to to "claude" in backlog           │');
    console.error('│  → Or create .claude/.delegation-bypass file                │');
    console.error('└─────────────────────────────────────────────────────────────┘');
    console.error('');

    logBlockedAttempt(filename, 'backlog_assignment', backlogMatch);
    process.exit(2); // BLOCK
  }

  // SECONDARY CHECK: Project file delegation markers
  const projectMatch = checkProjectFiles(filename);
  if (projectMatch) {
    const suggestedCmd = getSuggestedCommand(filename);

    console.error('');
    console.error('┌─────────────────────────────────────────────────────────────┐');
    console.error('│  ❌ WRITE BLOCKED - Marked for Local Model in Project       │');
    console.error('├─────────────────────────────────────────────────────────────┤');
    console.error(`│  File: ${basename.substring(0, 51).padEnd(51)}│`);
    console.error(`│  Project: ${projectMatch.projectId.substring(0, 48).padEnd(48)}│`);
    console.error('│                                                             │');
    console.error('│  This file is marked for LOCAL MODEL delegation.            │');
    console.error('│                                                             │');
    console.error('│  Instead, use:                                              │');
    console.error(`│  → ${suggestedCmd.padEnd(55)}│`);
    console.error('│  → node scripts/dispatcher.cjs assign-next                  │');
    console.error('│                                                             │');
    console.error('│  To override, add to project file:                          │');
    console.error('│  <!-- OVERRIDE_DELEGATION: [reason] -->                     │');
    console.error('└─────────────────────────────────────────────────────────────┘');
    console.error('');

    logBlockedAttempt(filename, 'project_marker', projectMatch);
    process.exit(2); // BLOCK
  }

  // FALLBACK CHECK: New file matching delegable patterns
  if (isDelegablePattern(filename)) {
    const suggestedCmd = getSuggestedCommand(filename);

    console.error('');
    console.error('┌─────────────────────────────────────────────────────────────┐');
    console.error('│  ⚠️  NEW FILE - Consider Local Model Delegation              │');
    console.error('├─────────────────────────────────────────────────────────────┤');
    console.error(`│  File: ${basename.substring(0, 51).padEnd(51)}│`);
    console.error('│                                                             │');
    console.error('│  This appears to be a simple utility file that should be    │');
    console.error('│  delegated to a local model (saves ~1,500 tokens).          │');
    console.error('│                                                             │');
    console.error('│  Recommended:                                               │');
    console.error(`│  → ${suggestedCmd.padEnd(55)}│`);
    console.error('│                                                             │');
    console.error('│  To proceed anyway:                                         │');
    console.error('│  → Create .claude/.delegation-bypass file                   │');
    console.error('└─────────────────────────────────────────────────────────────┘');
    console.error('');

    logBlockedAttempt(filename, 'delegable_pattern', { pattern: basename });
    process.exit(2); // BLOCK
  }

  log('All checks passed - allowing write');
  process.exit(0);
}

main().catch(err => {
  log(`Hook error: ${err.message}`);
  console.error('[DELEGATION-PRE] Hook error:', err.message);
  process.exit(0); // Allow on error to be safe
});
