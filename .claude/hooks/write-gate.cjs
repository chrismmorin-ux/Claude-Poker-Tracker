#!/usr/bin/env node
/**
 * write-gate.cjs - Block-by-default delegation enforcement hook
 *
 * PreToolUse hook for Edit/Write/NotebookEdit operations.
 * Implements block-by-default architecture per enforcement plan.
 *
 * Exit codes:
 *   0 = Allow operation
 *   2 = Block operation (with message)
 *
 * Logic flow:
 *   1. Check bypass file (.delegation-bypass) → Allow if exists
 *   2. Check protected files → Block unless human-approval file exists
 *   3. Find task in backlog → Block if no task
 *   4. Check task assignment → Block if assigned to local model
 *   5. Check task status → Block if failed/blocked
 */

const fs = require('fs');
const path = require('path');

// Constants
const BYPASS_FILE = path.join(process.cwd(), '.claude', '.delegation-bypass');
const BACKLOG_FILE = path.join(process.cwd(), '.claude', 'backlog.json');
const PROTECTED_FILES_CONFIG = path.join(process.cwd(), '.claude', '.protected-files.json');
const LOG_FILE = path.join(process.cwd(), '.claude', 'logs', 'delegation-check.log');

// Files that bypass backlog task requirement (plan mode, project files)
const EXEMPT_PATTERNS = [
  /^\.claude[\/\\]plans[\/\\]/,           // Plan mode files
  /^docs[\/\\]projects[\/\\].*\.project\.md$/,  // Project files
  /^\.claude[\/\\]dispatcher-state\.json$/,     // Dispatcher state
];

/**
 * Normalize path to forward slashes for consistent comparison
 * Handles Windows C:\, Git Bash /c/, and Unix paths
 */
function normalizePath(p) {
    if (!p) return '';
    // Convert Windows drive letter format (C:\ -> /c/)
    let normalized = p.replace(/^([A-Za-z]):/, (_, drive) => '/' + drive.toLowerCase());
    // Convert all backslashes to forward slashes
    normalized = normalized.replace(/\\/g, '/');
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');
    return normalized;
}

/**
 * Log message to delegation log
 */
function log(message) {
    try {
        const logsDir = path.dirname(LOG_FILE);
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        const timestamp = new Date().toISOString();
        fs.appendFileSync(LOG_FILE, `[${timestamp}] [write-gate] ${message}\n`);
    } catch (e) {
        // Ignore logging errors
    }
}

/**
 * Create or append to violation lockfile for audit trail
 */
function createViolationLockfile(filePath, reason, toolName = 'write-gate') {
    try {
        const LOCKFILE_PATH = path.join(process.cwd(), '.claude', '.delegation-violation.lock');
        const violation = {
            timestamp: new Date().toISOString(),
            file_path: filePath,
            reason: reason,
            tool_name: toolName
        };

        let violations = [];
        if (fs.existsSync(LOCKFILE_PATH)) {
            const content = fs.readFileSync(LOCKFILE_PATH, 'utf-8');
            violations = JSON.parse(content);
        }

        violations.push(violation);
        fs.writeFileSync(LOCKFILE_PATH, JSON.stringify(violations, null, 2));
        log(`VIOLATION RECORDED: ${filePath}`);
    } catch (e) {
        log(`WARNING: Could not create violation lockfile: ${e.message}`);
    }
}

/**
 * Check if bypass file exists (human-created session bypass)
 */
function checkBypassFile() {
    if (fs.existsSync(BYPASS_FILE)) {
        log('BYPASS: .delegation-bypass file found - allowing all operations');
        return true;
    }
    return false;
}

/**
 * Check if file is exempt from backlog task requirement
 * (plan files, project files, dispatcher state)
 */
function isExemptFile(filePath) {
    const normalizedFilePath = normalizePath(filePath);
    const normalizedCwd = normalizePath(process.cwd());
    const relativePath = normalizedFilePath.replace(normalizedCwd, '').replace(/^\//, '');

    for (const pattern of EXEMPT_PATTERNS) {
        if (pattern.test(relativePath)) {
            log(`EXEMPT: ${relativePath} matches exempt pattern`);
            return true;
        }
    }
    return false;
}

/**
 * Check if file is protected and requires human approval
 */
function checkProtectedFile(filePath) {
    try {
        if (!fs.existsSync(PROTECTED_FILES_CONFIG)) {
            return { blocked: false };
        }

        const config = JSON.parse(fs.readFileSync(PROTECTED_FILES_CONFIG, 'utf-8'));
        const files = config.files || [];
        const basename = path.basename(filePath);
        // Normalize both paths to handle Windows/Unix path differences
        const normalizedFilePath = normalizePath(filePath);
        const normalizedCwd = normalizePath(process.cwd());
        const relativePath = normalizedFilePath.replace(normalizedCwd, '').replace(/^\//, '');

        log(`PROTECTED CHECK: file=${basename}, relative=${relativePath}`);

        // Check against patterns
        for (const pattern of files) {
            // Glob pattern matching (simple)
            if (pattern.includes('*')) {
                const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
                if (regex.test(relativePath)) {
                    // Check for human approval file
                    const approvalFile = path.join(process.cwd(), '.claude', `.human-approved-${basename}`);
                    if (fs.existsSync(approvalFile)) {
                        log(`PROTECTED: ${relativePath} has human approval file`);
                        return { blocked: false };
                    }
                    return {
                        blocked: true,
                        reason: `Protected file requires human approval. Create .claude/.human-approved-${basename} to allow.`
                    };
                }
            } else if (relativePath === pattern || relativePath.endsWith(pattern)) {
                const approvalFile = path.join(process.cwd(), '.claude', `.human-approved-${basename}`);
                if (fs.existsSync(approvalFile)) {
                    return { blocked: false };
                }
                return {
                    blocked: true,
                    reason: `Protected file requires human approval. Create .claude/.human-approved-${basename} to allow.`
                };
            }
        }

        return { blocked: false };
    } catch (e) {
        log(`ERROR checking protected files: ${e.message}`);
        return { blocked: false }; // Fail open on error
    }
}

/**
 * Find task in backlog that touches this file
 */
function findTaskForFile(filePath) {
    try {
        if (!fs.existsSync(BACKLOG_FILE)) {
            return null;
        }

        const backlog = JSON.parse(fs.readFileSync(BACKLOG_FILE, 'utf-8'));
        const tasks = backlog.tasks || [];
        const basename = path.basename(filePath);
        // Normalize paths for consistent comparison
        const normalizedFilePath = normalizePath(filePath);
        const normalizedCwd = normalizePath(process.cwd());
        const relativePath = normalizedFilePath.replace(normalizedCwd, '').replace(/^\//, '');

        // Find matching task, prefer non-done tasks
        let matchingTask = null;
        for (const task of tasks) {
            const filesTouched = task.files_touched || [];
            for (const touched of filesTouched) {
                const touchedBasename = path.basename(touched);
                if (touchedBasename === basename || touched === relativePath || relativePath.endsWith(touched)) {
                    // Prefer open/in_progress tasks over done tasks
                    if (!matchingTask || (task.status !== 'done' && matchingTask.status === 'done')) {
                        matchingTask = task;
                    }
                }
            }
        }

        return matchingTask;
    } catch (e) {
        log(`ERROR finding task: ${e.message}`);
        return null;
    }
}

/**
 * Check if task assignment allows Claude to edit
 */
function checkTaskAssignment(task, filePath) {
    if (!task) {
        const basename = path.basename(filePath);
        const reason = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  DECOMPOSITION POLICY REMINDER
File: ${basename}

No related task found in backlog.

If this is NEW work:
  1. Decompose into atomic tasks (see .claude/DECOMPOSITION_POLICY.md)
  2. Add tasks to backlog: node scripts/dispatcher.cjs add-tasks
  3. Execute via local model: node scripts/dispatcher.cjs assign-next

If atomic decomposition is impossible:
  - Create permission request in .claude/permission-requests.json
  - Use template: node scripts/dispatcher.cjs create-permission-request
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        return { blocked: true, reason };
    }

    const assignedTo = task.assigned_to || '';
    const status = task.status || '';

    // Allow if task is done (subsequent edits allowed)
    if (status === 'done') {
        log(`ALLOW: Task ${task.id} is done - subsequent edits allowed`);
        return { blocked: false };
    }

    // Check status
    if (status === 'failed') {
        return {
            blocked: true,
            reason: `Task ${task.id} has failed status. Run 'dispatcher redecompose ${task.id}' first.`
        };
    }

    if (status === 'blocked') {
        return {
            blocked: true,
            reason: `Task ${task.id} is blocked. Resolve blocking issue first.`
        };
    }

    // Check assignment
    if (assignedTo.startsWith('local:')) {
        const basename = path.basename(filePath);
        const reason = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  DELEGATION POLICY VIOLATION
File: ${basename}
Related Task: ${task.id} - ${task.title}
Status: ${status}
Assigned To: ${assignedTo}

BLOCKED: This file is part of an open task in backlog.

To proceed, choose one option:
  1. Execute via local model: node scripts/dispatcher.cjs assign-next
  2. Request permission: Create entry in .claude/permission-requests.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        return {
            blocked: true,
            reason
        };
    }

    // Allow if assigned to claude or human
    if (assignedTo === 'claude' || assignedTo === 'human') {
        log(`ALLOW: Task ${task.id} assigned to ${assignedTo}`);
        return { blocked: false };
    }

    // Allow if no assignment but task exists and is open/in_progress
    if (!assignedTo && (status === 'open' || status === 'in_progress')) {
        log(`ALLOW: Task ${task.id} exists with status ${status}`);
        return { blocked: false };
    }

    // Block by default
    return {
        blocked: true,
        reason: `Task ${task.id} cannot be edited directly. Check assignment and status.`
    };
}

/**
 * Main execution
 */
async function main() {
    let input = '';

    // Read stdin
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) {
        input += chunk;
    }

    let data;
    try {
        data = JSON.parse(input);
    } catch (e) {
        log(`ERROR parsing input: ${e.message}`);
        process.exit(0); // Fail open on parse error
    }

    const toolInput = data.tool_input || {};
    const filePath = toolInput.file_path || '';

    if (!filePath) {
        process.exit(0); // No file path, allow (might be non-file operation)
    }

    log(`Checking: ${filePath}`);

    // 1. Check bypass file
    if (checkBypassFile()) {
        process.exit(0);
    }

    // 1.5. Check exempt files (plan mode, project files)
    if (isExemptFile(filePath)) {
        log(`EXEMPT: ${filePath} - allowed without backlog task`);
        process.exit(0);
    }

    // 2. Check protected files
    const protectedCheck = checkProtectedFile(filePath);
    if (protectedCheck.blocked) {
        console.error(`\n🚫 BLOCKED: ${protectedCheck.reason}\n`);
        log(`BLOCKED (protected): ${filePath}`);
        createViolationLockfile(filePath, protectedCheck.reason, 'write-gate');
        process.exit(2);
    }

    // 3. Find task and check assignment
    const task = findTaskForFile(filePath);
    const assignmentCheck = checkTaskAssignment(task, filePath);

    if (assignmentCheck.blocked) {
        console.error(`\n🚫 BLOCKED: ${assignmentCheck.reason}\n`);
        log(`BLOCKED (assignment): ${filePath} - ${assignmentCheck.reason}`);
        createViolationLockfile(filePath, assignmentCheck.reason, 'write-gate');
        process.exit(2);
    }

    // All checks passed
    log(`ALLOWED: ${filePath}`);
    process.exit(0);
}

main();
