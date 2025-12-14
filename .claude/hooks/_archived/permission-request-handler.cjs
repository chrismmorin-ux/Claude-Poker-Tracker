/**
 * Permission Request Handler Hook
 *
 * Handles CLAUDE_REQUEST_FOR_PERMISSION protocol:
 * - Intercepts direct work attempts on non-decomposed tasks
 * - Checks for approved permission requests
 * - Blocks or allows based on permission status
 * - Guides user through structured escalation
 *
 * Hook Type: PreToolUse
 * Triggers: Write, Edit, Bash (file operations)
 */

const fs = require('fs');
const path = require('path');

const PERMISSION_REQUESTS_FILE = path.join(process.cwd(), '.claude', 'permission-requests.json');
const BACKLOG_FILE = path.join(process.cwd(), '.claude', 'backlog.json');
const PERMISSION_REQUEST_SCHEMA = path.join(process.cwd(), '.claude', 'schemas', 'permission-request.schema.json');

/**
 * Loads permission requests from file
 */
function loadPermissionRequests() {
  if (!fs.existsSync(PERMISSION_REQUESTS_FILE)) {
    return { version: "1.0.0", requests: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(PERMISSION_REQUESTS_FILE, 'utf-8'));
  } catch (error) {
    console.error(`⚠️  Failed to load permission requests: ${error.message}`);
    return { version: "1.0.0", requests: [] };
  }
}

/**
 * Loads backlog to check for related tasks
 */
function loadBacklog() {
  if (!fs.existsSync(BACKLOG_FILE)) {
    return { tasks: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(BACKLOG_FILE, 'utf-8'));
  } catch (error) {
    console.error(`⚠️  Failed to load backlog: ${error.message}`);
    return { tasks: [] };
  }
}

/**
 * Checks if file is part of an open task in backlog
 */
function findRelatedTask(filePath, backlog) {
  return backlog.tasks.find(task =>
    task.status === 'open' &&
    task.files_touched.some(f => filePath.includes(f))
  );
}

/**
 * Checks if there's an approved permission request for this work
 */
function findApprovedPermission(filePath, permissionRequests) {
  return permissionRequests.requests.find(req =>
    req.status === 'approved' &&
    req.estimated_complexity.files_affected &&
    // Check if file path is mentioned in task description or justification
    (req.task_description.includes(path.basename(filePath)) ||
     req.justification.includes(path.basename(filePath)))
  );
}

/**
 * Generates a new permission request ID
 */
function generatePermissionRequestId() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const permissionRequests = loadPermissionRequests();

  // Count existing requests for today
  const todayRequests = permissionRequests.requests.filter(r =>
    r.request_id.startsWith(`PR-${dateStr}`)
  );

  const sequence = String(todayRequests.length + 1).padStart(3, '0');
  return `PR-${dateStr}-${sequence}`;
}

/**
 * Creates a permission request template
 */
function createPermissionRequestTemplate(filePath, toolName) {
  return {
    request_id: generatePermissionRequestId(),
    timestamp: new Date().toISOString(),
    task_description: `[FILL IN] Describe the task requiring direct work on ${path.basename(filePath)}`,
    attempted_decomposition: {
      decomposition_attempts: 1,
      subtasks_proposed: [
        {
          title: "[FILL IN] Describe attempted subtask",
          blocking_reason: "[FILL IN] Explain why this subtask cannot meet atomic criteria",
          failed_criteria: ["files_touched"] // Example - update as needed
        }
      ],
      why_insufficient: "[FILL IN] Explain in detail why atomic decomposition is not feasible for this task"
    },
    blocking_criteria: [
      "files_touched" // Example - update based on actual blocking criteria
    ],
    justification: "[FILL IN] Provide detailed justification for why Claude must handle this directly (min 50 chars)",
    estimated_complexity: {
      files_affected: 1,
      lines_affected: 0, // Estimate
      effort_mins: 0, // Estimate
      risk_level: "medium" // low, medium, high, critical
    },
    requested_by: "claude:sonnet-4.5",
    status: "pending"
  };
}

/**
 * Main hook handler
 */
function handlePreToolUse(toolName, toolInput) {
  // Only intercept file modification tools
  if (!['Write', 'Edit'].includes(toolName)) {
    return { allow: true };
  }

  const filePath = toolInput.file_path;
  if (!filePath) {
    return { allow: true };
  }

  // Skip hook infrastructure files (avoid infinite recursion)
  if (filePath.includes('.claude/hooks/') ||
      filePath.includes('.claude/schemas/') ||
      filePath.includes('.claude/permission-requests.json')) {
    return { allow: true };
  }

  // Skip test files
  if (filePath.includes('__tests__/') || filePath.endsWith('.test.js')) {
    return { allow: true };
  }

  // Check for approved permission
  const permissionRequests = loadPermissionRequests();
  const approvedPermission = findApprovedPermission(filePath, permissionRequests);

  if (approvedPermission) {
    console.log(`✅ PERMISSION GRANTED: ${approvedPermission.request_id}`);
    console.log(`   Task: ${approvedPermission.task_description}`);
    if (approvedPermission.approval_conditions && approvedPermission.approval_conditions.length > 0) {
      console.log(`   Conditions: ${approvedPermission.approval_conditions.join(', ')}`);
    }
    return { allow: true };
  }

  // Check if file is part of an open task
  const backlog = loadBacklog();
  const relatedTask = findRelatedTask(filePath, backlog);

  if (relatedTask) {
    // There's a task in backlog - should execute via local model
    console.log(`\n⚠️  DELEGATION POLICY VIOLATION DETECTED`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`File: ${path.basename(filePath)}`);
    console.log(`Related Task: ${relatedTask.id} - ${relatedTask.title}`);
    console.log(`Status: ${relatedTask.status}`);
    console.log(`Assigned To: ${relatedTask.assigned_to}`);
    console.log(`\n❌ BLOCKED: This file is part of an open task in backlog.`);
    console.log(`\nTo proceed, choose one option:`);
    console.log(`  1. Execute via local model: node scripts/dispatcher.cjs assign-next`);
    console.log(`  2. Request permission: Create a permission request (see below)`);
    console.log(`\nTo request permission:`);
    console.log(`  - Add entry to .claude/permission-requests.json using template below`);
    console.log(`  - Provide detailed justification (why atomic decomposition failed)`);
    console.log(`  - User will review and approve/reject/request redecomposition`);
    console.log(`\nTemplate:`);
    console.log(JSON.stringify(createPermissionRequestTemplate(filePath, toolName), null, 2));
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    return {
      allow: false,
      message: `Task exists in backlog. Execute via dispatcher or request permission.`
    };
  }

  // No task, no permission - this might be new work
  // Allow but warn about decomposition policy
  console.log(`\n⚠️  DECOMPOSITION POLICY REMINDER`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`File: ${path.basename(filePath)}`);
  console.log(`\nNo related task found in backlog.`);
  console.log(`\nIf this is NEW work:`);
  console.log(`  1. Decompose into atomic tasks (see .claude/DECOMPOSITION_POLICY.md)`);
  console.log(`  2. Add tasks to backlog: node scripts/dispatcher.cjs add-tasks`);
  console.log(`  3. Execute via local model: node scripts/dispatcher.cjs assign-next`);
  console.log(`\nIf atomic decomposition is impossible:`);
  console.log(`  - Create permission request in .claude/permission-requests.json`);
  console.log(`  - Use template: node scripts/dispatcher.cjs create-permission-request`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  return { allow: true }; // Warning only for new work
}

module.exports = {
  name: 'permission-request-handler',
  description: 'Handles CLAUDE_REQUEST_FOR_PERMISSION protocol for non-atomic tasks',
  type: 'PreToolUse',
  handler: handlePreToolUse
};
