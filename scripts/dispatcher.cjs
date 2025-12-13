#!/usr/bin/env node
/**
 * dispatcher.cjs - Task dispatcher CLI for local model delegation
 *
 * Commands:
 *   add-tasks                    - Add tasks from ///LOCAL_TASKS JSON (stdin)
 *   assign-next                  - Assign next open task to local model
 *   status                       - View backlog status
 *   metrics                      - Show task success rates (--by-type, --by-model)
 *   complete                     - Mark task complete with result
 *   audit                        - Validate all tasks against atomic criteria
 *   redecompose                  - Mark task for re-decomposition
 *   extract-context              - Extract and preview context for a task
 *   create-permission-request    - Create permission request template
 *   list-permissions             - List permission requests
 *   approve-permission           - Approve permission request
 *   reject-permission            - Reject permission request
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const readline = require('readline');
const { execSync, spawn } = require('child_process');
const { generateInvariantTest } = require('./invariant-test-generator.cjs');

const BACKLOG_PATH = path.join(process.cwd(), '.claude', 'backlog.json');
const SCHEMA_PATH = path.join(process.cwd(), '.claude', 'schemas', 'local-task.schema.json');
const PERMISSION_REQUESTS_PATH = path.join(process.cwd(), '.claude', 'permission-requests.json');
const LOG_FILE = path.join(process.cwd(), '.claude', 'logs', 'local-model-tasks.log');

// Atomic criteria limits
const ATOMIC_LIMITS = {
  files_touched: 3,
  est_lines_changed: 300,
  est_local_effort_mins: 60
};

// Maximum decomposition depth to prevent infinite recursion
const MAX_DECOMPOSITION_DEPTH = 3;

// Load backlog
function loadBacklog() {
  if (!fs.existsSync(BACKLOG_PATH)) {
    return {
      version: '1.0.0',
      updated_at: new Date().toISOString(),
      tasks: [],
      projects: {},
      stats: { total_tasks: 0, open: 0, in_progress: 0, done: 0, failed: 0 }
    };
  }
  return JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf8'));
}

// Command: metrics
function showMetrics(byType = false, byModel = false) {
  const backlog = loadBacklog();

  // Calculate overall metrics
  const done = backlog.tasks.filter(t => t.status === 'done').length;
  const failed = backlog.tasks.filter(t => t.status === 'failed').length;
  const open = backlog.tasks.filter(t => t.status === 'open').length;
  const inProgress = backlog.tasks.filter(t => t.status === 'in_progress').length;
  const total = backlog.tasks.length;

  const successCount = done + failed;
  const successRate = successCount > 0 ? ((done / successCount) * 100).toFixed(1) : '0.0';

  console.log('\nTask Metrics');
  console.log('============');
  console.log(`Total: ${total}  Done: ${done}  Failed: ${failed}  Open: ${open}  In Progress: ${inProgress}`);
  console.log(`Success Rate: ${successRate}% (${done}/${successCount})`);

  // Group by task_complexity_type if requested
  if (byType) {
    console.log('\nBy Type:');
    const byTypeMap = {};

    backlog.tasks.forEach(task => {
      const type = task.task_complexity_type || 'Unknown';
      if (!byTypeMap[type]) {
        byTypeMap[type] = { done: 0, failed: 0 };
      }
      if (task.status === 'done') byTypeMap[type].done++;
      if (task.status === 'failed') byTypeMap[type].failed++;
    });

    Object.keys(byTypeMap).sort().forEach(type => {
      const stats = byTypeMap[type];
      const count = stats.done + stats.failed;
      const rate = count > 0 ? ((stats.done / count) * 100).toFixed(1) : '0.0';
      console.log(`  Type ${type}: ${rate}% (${stats.done}/${count})`);
    });
  }

  // Group by assigned_to model if requested
  if (byModel) {
    console.log('\nBy Model:');
    const byModelMap = {};

    backlog.tasks.forEach(task => {
      const model = task.assigned_to || 'unassigned';
      if (!byModelMap[model]) {
        byModelMap[model] = { done: 0, failed: 0 };
      }
      if (task.status === 'done') byModelMap[model].done++;
      if (task.status === 'failed') byModelMap[model].failed++;
    });

    Object.keys(byModelMap).sort().forEach(model => {
      const stats = byModelMap[model];
      const count = stats.done + stats.failed;
      const rate = count > 0 ? ((stats.done / count) * 100).toFixed(1) : '0.0';
      console.log(`  ${model}: ${rate}% (${stats.done}/${count})`);
    });
  }

  console.log('');
}

// Save backlog
function saveBacklog(backlog) {
  backlog.updated_at = new Date().toISOString();
  backlog.stats = calculateStats(backlog.tasks);
  fs.writeFileSync(BACKLOG_PATH, JSON.stringify(backlog, null, 2));
}

// Write task execution log entry (JSONL format)
function writeTaskLog(entry) {
  try {
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch (e) {
    // Silent fail - don't break dispatcher
  }
}

// Calculate stats
function calculateStats(tasks) {
  return {
    total_tasks: tasks.length,
    open: tasks.filter(t => t.status === 'open').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    failed: tasks.filter(t => t.status === 'failed').length
  };
}

// Validate task against atomic criteria
function validateAtomic(task) {
  const errors = [];

  if (!task.id) errors.push('Missing required field: id');
  if (!task.title) errors.push('Missing required field: title');
  if (!task.description) errors.push('Missing required field: description');
  if (!task.test_command) errors.push('Missing required field: test_command');
  if (!task.assigned_to) errors.push('Missing required field: assigned_to');
  if (!task.priority) errors.push('Missing required field: priority');
  if (!task.status) errors.push('Missing required field: status');

  if (!task.files_touched || !Array.isArray(task.files_touched)) {
    errors.push('Missing required field: files_touched (array)');
  } else if (task.files_touched.length > ATOMIC_LIMITS.files_touched) {
    errors.push(`files_touched (${task.files_touched.length}) exceeds limit (${ATOMIC_LIMITS.files_touched})`);
  }

  if (typeof task.est_lines_changed !== 'number') {
    errors.push('Missing required field: est_lines_changed (number)');
  } else if (task.est_lines_changed > ATOMIC_LIMITS.est_lines_changed) {
    errors.push(`est_lines_changed (${task.est_lines_changed}) exceeds limit (${ATOMIC_LIMITS.est_lines_changed})`);
  }

  if (task.est_local_effort_mins && task.est_local_effort_mins > ATOMIC_LIMITS.est_local_effort_mins) {
    errors.push(`est_local_effort_mins (${task.est_local_effort_mins}) exceeds limit (${ATOMIC_LIMITS.est_local_effort_mins})`);
  }

  // Validate needs_context has line ranges
  if (task.needs_context && Array.isArray(task.needs_context)) {
    task.needs_context.forEach((ctx, i) => {
      if (!ctx.path) errors.push(`needs_context[${i}] missing path`);
      if (typeof ctx.lines_start !== 'number') errors.push(`needs_context[${i}] missing lines_start`);
      if (typeof ctx.lines_end !== 'number') errors.push(`needs_context[${i}] missing lines_end`);
    });
  }

  return { valid: errors.length === 0, errors };
}

// Command: add-tasks
async function addTasks() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  // Parse ///LOCAL_TASKS format
  let tasks;
  try {
    // Handle ///LOCAL_TASKS prefix
    const jsonStr = input.replace(/^\/\/\/LOCAL_TASKS\s*/i, '').trim();
    tasks = JSON.parse(jsonStr);
    if (!Array.isArray(tasks)) tasks = [tasks];
  } catch (e) {
    console.error('Error parsing tasks:', e.message);
    process.exit(1);
  }

  const backlog = loadBacklog();
  let added = 0, blocked = 0, autoTests = 0;

  for (const task of tasks) {
    const validation = validateAtomic(task);
    if (!validation.valid) {
      console.error(`\nBLOCKED: Task ${task.id || 'unknown'}`);
      validation.errors.forEach(e => console.error(`  - ${e}`));
      blocked++;
      continue;
    }

    // Check for duplicate
    if (backlog.tasks.find(t => t.id === task.id)) {
      console.log(`Skipped duplicate: ${task.id}`);
      continue;
    }

    task.status = task.status || 'open';
    backlog.tasks.push(task);
    added++;
    console.log(`Added: ${task.id} - ${task.title}`);

    // Auto-generate invariant test if needed
    const testTask = generateInvariantTest(task);
    if (testTask) {
      // Check if test task already exists
      if (!backlog.tasks.find(t => t.id === testTask.id)) {
        backlog.tasks.push(testTask);
        autoTests++;
        console.log(`  └─ Auto-generated test: ${testTask.id} - ${testTask.title}`);
      }
    }
  }

  saveBacklog(backlog);
  console.log(`\nSummary: ${added} added, ${autoTests} auto-tests created, ${blocked} blocked`);

  if (blocked > 0) {
    process.exit(2); // Signal validation failures
  }
}

// Convert dispatcher task format to execute-local-task.sh format
function convertToExecutionFormat(task) {
  // Extract model name from assigned_to (e.g., "local:deepseek" -> "deepseek")
  let model = 'deepseek'; // default
  if (task.assigned_to && task.assigned_to.startsWith('local:')) {
    model = task.assigned_to.replace('local:', '');
  }

  // Determine language from file extension
  const outputFile = task.files_touched && task.files_touched[0];
  let language = 'javascript';
  if (outputFile) {
    if (outputFile.endsWith('.ts') || outputFile.endsWith('.tsx')) language = 'typescript';
    else if (outputFile.endsWith('.py')) language = 'python';
    else if (outputFile.endsWith('.sh')) language = 'bash';
  }

  return {
    task_id: task.id,
    model: model,
    description: task.description,
    output_file: outputFile || '',
    context_files: task.inputs || [],
    constraints: task.constraints || [],
    test_command: task.test_command || '',
    language: language,
    // Pass edit_strategy for FP-001 guards (defaults to create_new)
    edit_strategy: task.edit_strategy || 'create_new',
    // Pass needs_context for precise context extraction
    needs_context: task.needs_context || [],
    // Pass test_first for TDD workflow
    test_first: task.test_first || null
  };
}

// Check LM Studio health
async function checkLmStudioHealth() {
  const configPath = path.join(process.cwd(), '.claude', 'config', 'lm-studio.json');

  // If config doesn't exist, return healthy (optional feature)
  if (!fs.existsSync(configPath)) {
    return { healthy: true, error: null };
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const endpoint = config.endpoint || 'http://localhost:1234';
    const timeoutMs = config.health_timeout_ms || 5000;
    const retryAttempts = config.retry_attempts || 3;

    let lastError = null;
    let retryCount = 0;

    while (retryCount < retryAttempts) {
      try {
        const healthResult = await new Promise((resolve, reject) => {
          const url = new URL(`${endpoint}/v1/models`);
          const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: 'GET',
            timeout: timeoutMs
          };

          const req = http.request(options, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ healthy: true });
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          });

          req.on('timeout', () => {
            req.abort();
            reject(new Error('Request timeout'));
          });

          req.on('error', (err) => {
            reject(err);
          });

          req.end();
        });

        return { healthy: true, error: null };
      } catch (error) {
        lastError = error.message;
        retryCount++;

        if (retryCount < retryAttempts) {
          // Exponential backoff: 100ms * 2^retry
          const delayMs = 100 * Math.pow(2, retryCount - 1);
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
    }

    return {
      healthy: false,
      error: `LM Studio not available at ${endpoint}. Start LM Studio or check config. (${lastError})`
    };
  } catch (error) {
    return {
      healthy: false,
      error: `Failed to load LM Studio config: ${error.message}`
    };
  }
}

// Launch LM Studio if auto_launch is enabled
async function launchLmStudio() {
  const configPath = path.join(process.cwd(), '.claude', 'config', 'lm-studio.json');

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (!config.auto_launch) {
      return { launched: false, error: 'auto_launch is disabled in config' };
    }

    const launchCommand = config.launch_command;
    if (!launchCommand) {
      return { launched: false, error: 'launch_command not specified in config' };
    }

    console.log(`Attempting to launch LM Studio: ${launchCommand}`);

    // Spawn process in detached mode (doesn't block dispatcher)
    const child = spawn(launchCommand, [], {
      detached: true,
      stdio: 'ignore',
      shell: true
    });

    // Allow parent process to exit independently
    child.unref();

    console.log('LM Studio launch initiated (PID: ' + child.pid + ')');

    // Wait for LM Studio to become healthy (poll every 2s, up to 30s)
    console.log('Waiting for LM Studio to become healthy...');
    const maxWaitMs = 30000;
    const pollIntervalMs = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const healthStatus = await checkLmStudioHealth();
      if (healthStatus.healthy) {
        console.log('✓ LM Studio is now healthy');
        return { launched: true, error: null };
      }

      // Wait before next poll
      await new Promise(r => setTimeout(r, pollIntervalMs));
    }

    return { launched: true, error: 'LM Studio launched but failed to become healthy within 30 seconds' };
  } catch (error) {
    return { launched: false, error: `Failed to launch LM Studio: ${error.message}` };
  }
}

// Prompt user when LM Studio is unavailable
async function promptUserOnFailure(endpoint) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  ⚠️  LM Studio not available                                   ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║  Endpoint: ${endpoint.padEnd(55)}║`);
    console.log('║                                                               ║');
    console.log('║  Options:                                                     ║');
    console.log('║  [R] Retry health check                                       ║');
    console.log('║  [L] Launch LM Studio manually, then retry                    ║');
    console.log('║  [S] Skip - exit without running task                         ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');

    rl.question('Choice (R/L/S): ', (answer) => {
      rl.close();
      const choice = answer.toUpperCase().trim();
      if (['R', 'L', 'S'].includes(choice)) {
        resolve(choice);
      } else {
        console.log('Invalid choice. Defaulting to Skip.');
        resolve('S');
      }
    });
  });
}

// Command: assign-next
async function assignNext() {
  // Check LM Studio health before assignment
  console.log('Checking LM Studio health...');
  let healthStatus = await checkLmStudioHealth();

  if (!healthStatus.healthy) {
    // Health check failed - attempt auto-launch if enabled
    const launchResult = await launchLmStudio();

    if (launchResult.launched && !launchResult.error) {
      // Successfully launched and became healthy
      healthStatus = { healthy: true, error: null };
    } else if (launchResult.launched && launchResult.error) {
      // Launched but unhealthy after timeout - prompt user
      const configPath = path.join(process.cwd(), '.claude', 'config', 'lm-studio.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const endpoint = config.endpoint || 'http://localhost:1234';

      const choice = await promptUserOnFailure(endpoint);

      if (choice === 'R') {
        console.log('\nRetrying health check...');
        healthStatus = await checkLmStudioHealth();
      } else if (choice === 'L') {
        console.log('\nWaiting for you to launch LM Studio...');
        console.log('Once launched, press Enter to retry...');
        await new Promise(r => setTimeout(r, 5000));
        healthStatus = await checkLmStudioHealth();
      } else {
        console.log('\nTask skipped - exiting.');
        process.exit(0);
      }

      if (!healthStatus.healthy) {
        console.error('\n' + healthStatus.error);
        process.exit(1);
      }
    } else {
      // auto_launch is disabled or failed - prompt user
      const configPath = path.join(process.cwd(), '.claude', 'config', 'lm-studio.json');
      let endpoint = 'http://localhost:1234';
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        endpoint = config.endpoint || endpoint;
      }

      const choice = await promptUserOnFailure(endpoint);

      if (choice === 'R') {
        console.log('\nRetrying health check...');
        healthStatus = await checkLmStudioHealth();
      } else if (choice === 'L') {
        console.log('\nWaiting for you to launch LM Studio...');
        console.log('Once launched, press Enter to retry...');
        await new Promise(r => setTimeout(r, 5000));
        healthStatus = await checkLmStudioHealth();
      } else {
        console.log('\nTask skipped - exiting.');
        process.exit(0);
      }

      if (!healthStatus.healthy) {
        console.error('\n' + healthStatus.error);
        process.exit(1);
      }
    }
  }
  console.log('✓ LM Studio is healthy\n');

  const backlog = loadBacklog();

  // Find next open task (priority order: P0 > P1 > P2 > P3)
  const priorityOrder = ['P0', 'P1', 'P2', 'P3'];
  let openTask = null;

  for (const priority of priorityOrder) {
    openTask = backlog.tasks.find(t => t.status === 'open' && t.priority === priority);
    if (openTask) break;
  }

  // Fallback to any open task
  if (!openTask) {
    openTask = backlog.tasks.find(t => t.status === 'open');
  }

  if (!openTask) {
    console.log('No open tasks in backlog');
    process.exit(0);
  }

  // PRE-ASSIGN AUDIT: Validate task meets atomic criteria before assignment
  const validation = validateAtomic(openTask);
  if (!validation.valid) {
    console.error('\n╔═══════════════════════════════════════════════════════════════╗');
    console.error('║  🛑 PRE-ASSIGN AUDIT FAILED - Task blocked                    ║');
    console.error('╚═══════════════════════════════════════════════════════════════╝\n');
    console.error(`Task: ${openTask.id} - ${openTask.title}`);
    console.error('\nErrors:');
    validation.errors.forEach(e => console.error(`  ✗ ${e}`));
    console.error('\nAction: Re-decompose this task before assignment');
    console.error('Run: node scripts/dispatcher.cjs redecompose ' + openTask.id);

    // Mark task as blocked
    openTask.status = 'blocked';
    openTask.blocked_reason = 'Failed pre-assign audit: ' + validation.errors.join('; ');
    saveBacklog(backlog);

    process.exit(2);
  }

  openTask.status = 'in_progress';
  openTask.assigned_at = new Date().toISOString();
  saveBacklog(backlog);

  console.log('✓ Task passed pre-assign audit');
  console.log(`\n🚀 Executing task: ${openTask.id} - ${openTask.title}`);
  console.log('');

  // Convert to execution format
  const execSpec = convertToExecutionFormat(openTask);

  // Write temp spec file
  const tempSpecPath = path.join(process.cwd(), '.claude', '.temp-task-spec.json');
  fs.writeFileSync(tempSpecPath, JSON.stringify(execSpec, null, 2));

  // Determine execution script - use TDD script if task has test_first field
  const isTddTask = openTask.test_first && openTask.test_first.test_file;
  const scriptPath = isTddTask
    ? path.join(__dirname, 'tdd-execute-task.sh')
    : path.join(__dirname, 'execute-local-task.sh');

  if (isTddTask) {
    console.log('📋 TDD task detected - using test-first workflow');
  }

  const taskStartTime = new Date();

  // Log task start
  writeTaskLog({
    timestamp: taskStartTime.toISOString(),
    task_id: openTask.id,
    model: execSpec.model,
    status: 'in_progress',
    execution: { start: taskStartTime.toISOString(), end: null, duration_ms: null }
  });

  try {
    console.log(`📝 Calling local model: ${execSpec.model}`);
    console.log('');

    const result = execSync(`bash "${scriptPath}" "${tempSpecPath}"`, {
      encoding: 'utf8',
      stdio: 'inherit',
      cwd: process.cwd()
    });

    // Task completed successfully by execute-local-task.sh
    // The script auto-updates backlog, but we'll reload to be sure
    const updatedBacklog = loadBacklog();
    const completedTask = updatedBacklog.tasks.find(t => t.id === openTask.id);
    const taskEndTime = new Date();
    const durationMs = taskEndTime - taskStartTime;

    // Log task completion
    writeTaskLog({
      timestamp: taskEndTime.toISOString(),
      task_id: openTask.id,
      model: execSpec.model,
      status: completedTask && completedTask.status === 'done' ? 'success' : 'failed',
      execution: { start: taskStartTime.toISOString(), end: taskEndTime.toISOString(), duration_ms: durationMs },
      test_result: completedTask ? { exit_code: completedTask.tests_passed ? 0 : 1 } : null
    });

    if (completedTask && completedTask.status === 'done') {
      console.log(`\n✅ Task ${openTask.id} completed successfully`);
    } else {
      console.log(`\n⚠️  Task ${openTask.id} executed but status unclear`);
    }

  } catch (error) {
    const taskEndTime = new Date();
    const durationMs = taskEndTime - taskStartTime;

    // Log task failure
    writeTaskLog({
      timestamp: taskEndTime.toISOString(),
      task_id: openTask.id,
      model: execSpec.model,
      status: 'failed',
      execution: { start: taskStartTime.toISOString(), end: taskEndTime.toISOString(), duration_ms: durationMs },
      failure_classification: 'unknown',
      output: { stderr: (error.message || '').slice(0, 2000) }
    });

    console.error(`\n❌ Task ${openTask.id} execution failed`);
    console.error(error.message);

    // Mark task as failed
    const failedBacklog = loadBacklog();
    const failedTask = failedBacklog.tasks.find(t => t.id === openTask.id);
    if (failedTask) {
      failedTask.status = 'failed';
      failedTask.error = error.message;
      failedTask.failed_at = new Date().toISOString();
      saveBacklog(failedBacklog);
    }

    process.exit(1);
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempSpecPath)) {
      fs.unlinkSync(tempSpecPath);
    }
  }
}

// Command: status
function showStatus() {
  const backlog = loadBacklog();

  console.log('\n=== Backlog Status ===\n');
  console.log(`Total: ${backlog.stats.total_tasks}`);
  console.log(`Open: ${backlog.stats.open}`);
  console.log(`In Progress: ${backlog.stats.in_progress}`);
  console.log(`Done: ${backlog.stats.done}`);
  console.log(`Failed: ${backlog.stats.failed}`);

  if (backlog.tasks.length > 0) {
    console.log('\n--- Open Tasks ---');
    backlog.tasks
      .filter(t => t.status === 'open')
      .slice(0, 10)
      .forEach(t => console.log(`  ${t.id}: ${t.title} [${t.priority}]`));

    const inProgress = backlog.tasks.filter(t => t.status === 'in_progress');
    if (inProgress.length > 0) {
      console.log('\n--- In Progress ---');
      inProgress.forEach(t => console.log(`  ${t.id}: ${t.title}`));
    }
  }

  console.log('\n--- Projects ---');
  Object.entries(backlog.projects).forEach(([id, p]) => {
    console.log(`  ${id}: ${p.name} (Phase ${p.phase}/${p.total_phases}) [${p.status}]`);
  });
}

// Command: complete
function completeTask(taskId, testsPassed) {
  const backlog = loadBacklog();
  const task = backlog.tasks.find(t => t.id === taskId);

  if (!task) {
    console.error(`Task not found: ${taskId}`);
    process.exit(1);
  }

  if (testsPassed) {
    // Tests passed - mark as done
    task.status = 'done';
    task.completed_at = new Date().toISOString();
    task.tests_passed = true;
    saveBacklog(backlog);
    console.log(`✅ Task ${taskId} completed successfully`);
  } else {
    // Tests failed - trigger automatic redecomposition
    task.status = 'failed';
    task.completed_at = new Date().toISOString();
    task.tests_passed = false;
    task.failure_count = (task.failure_count || 0) + 1;

    saveBacklog(backlog);

    console.log(`\n❌ Task ${taskId} FAILED (tests did not pass)`);
    console.log(`Failure count: ${task.failure_count}`);
    console.log(`\nTriggering automatic re-decomposition...\n`);

    // Automatically trigger redecomposition
    redecomposeTask(taskId, `Test failure (attempt ${task.failure_count})`);
  }
}

// Command: audit
function auditTasks() {
  const backlog = loadBacklog();
  let valid = 0, invalid = 0;
  const report = { valid: [], invalid: [] };

  console.log('\n=== Atomic Criteria Audit ===\n');

  for (const task of backlog.tasks) {
    const validation = validateAtomic(task);
    if (validation.valid) {
      valid++;
      report.valid.push(task.id);
    } else {
      invalid++;
      report.invalid.push({ id: task.id, errors: validation.errors });
      console.log(`FAIL: ${task.id}`);
      validation.errors.forEach(e => console.log(`  - ${e}`));
    }
  }

  console.log(`\nResults: ${valid} valid, ${invalid} invalid`);

  // Write audit report
  const auditPath = path.join(process.cwd(), '.claude', 'audits', 'atomicity_report.json');
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.writeFileSync(auditPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    total: backlog.tasks.length,
    valid,
    invalid,
    details: report
  }, null, 2));

  console.log(`Report written to: ${auditPath}`);

  if (invalid > 0) process.exit(2);
}

// Command: redecompose
function redecomposeTask(taskId, reason = 'Manual request') {
  const backlog = loadBacklog();
  const task = backlog.tasks.find(t => t.id === taskId);

  if (!task) {
    console.error(`Task not found: ${taskId}`);
    process.exit(1);
  }

  // Initialize or increment decomposition depth
  if (!task.decomposition_depth) {
    task.decomposition_depth = 0;
  }
  task.decomposition_depth++;

  // Check if max depth exceeded
  if (task.decomposition_depth > MAX_DECOMPOSITION_DEPTH) {
    console.error(`\n⚠️  MAX DECOMPOSITION DEPTH EXCEEDED`);
    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.error(`Task: ${task.id} - ${task.title}`);
    console.error(`Current depth: ${task.decomposition_depth} (max: ${MAX_DECOMPOSITION_DEPTH})`);
    console.error(`Reason: ${reason}`);
    console.error(`\nThis task has been decomposed ${task.decomposition_depth} times without success.`);
    console.error(`\nNext steps:`);
    console.error(`  1. Review task complexity - may be fundamentally non-atomic`);
    console.error(`  2. Consider CLAUDE_REQUEST_FOR_PERMISSION if decomposition truly impossible`);
    console.error(`  3. Escalate to human for review`);
    console.error(`\nTo create permission request:`);
    console.error(`  node scripts/dispatcher.cjs create-permission-request`);
    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    task.status = 'blocked';
    task.blocked_reason = `Max decomposition depth exceeded (${task.decomposition_depth}/${MAX_DECOMPOSITION_DEPTH})`;
    task.requires_permission = true;
    saveBacklog(backlog);
    process.exit(3); // Exit code 3 = max depth exceeded
  }

  // Mark for redecomposition
  task.status = 'blocked';
  task.needs_redecomposition = true;
  task.redecompose_requested_at = new Date().toISOString();
  task.redecompose_reason = reason;

  // Track decomposition history
  if (!task.decomposition_history) {
    task.decomposition_history = [];
  }
  task.decomposition_history.push({
    timestamp: new Date().toISOString(),
    depth: task.decomposition_depth,
    reason: reason
  });

  saveBacklog(backlog);

  console.log(`\n🔄 Task marked for re-decomposition`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Task: ${task.id} - ${task.title}`);
  console.log(`Depth: ${task.decomposition_depth}/${MAX_DECOMPOSITION_DEPTH}`);
  console.log(`Reason: ${reason}`);
  console.log(`\nClaude should now:`);
  console.log(`  1. Analyze why this task failed`);
  console.log(`  2. Break into smaller, more atomic subtasks`);
  console.log(`  3. Output new ///LOCAL_TASKS with decomposition_depth preserved`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

// Command: extract-context
function extractContext(taskId) {
  const backlog = loadBacklog();
  const task = backlog.tasks.find(t => t.id === taskId);

  if (!task) {
    console.error(`Task not found: ${taskId}`);
    process.exit(1);
  }

  // Check if task has needs_context
  if (!task.needs_context || task.needs_context.length === 0) {
    console.log(`Task ${taskId} has no needs_context defined`);
    console.log('Context would be loaded from context_files (legacy) or empty');
    process.exit(0);
  }

  console.log(`\n=== Context for Task ${taskId} ===\n`);
  console.log(`Context requests: ${task.needs_context.length}\n`);

  // Call context-provider.cjs
  const contextProviderPath = path.join(__dirname, 'context-provider.cjs');

  if (!fs.existsSync(contextProviderPath)) {
    console.error('Error: context-provider.cjs not found');
    process.exit(1);
  }

  try {
    const needsContextJson = JSON.stringify(task.needs_context);
    const output = execSync(`node "${contextProviderPath}" '${needsContextJson}'`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });

    console.log(output);

    // Show summary
    console.log('\n=== Summary ===');
    task.needs_context.forEach((ctx, i) => {
      const lines = ctx.lines_end - ctx.lines_start + 1;
      console.log(`  [${i + 1}] ${ctx.path} (${lines} lines)`);
    });

  } catch (error) {
    console.error('Error extracting context:');
    console.error(error.message);
    if (error.stderr) {
      console.error('\nStderr:', error.stderr);
    }
    process.exit(2);
  }
}

// Load permission requests
function loadPermissionRequests() {
  if (!fs.existsSync(PERMISSION_REQUESTS_PATH)) {
    return {
      version: "1.0.0",
      description: "Log of CLAUDE_REQUEST_FOR_PERMISSION escalations",
      schema: ".claude/schemas/permission-request.schema.json",
      updated_at: new Date().toISOString(),
      requests: [],
      statistics: { total_requests: 0, approved: 0, rejected: 0, redecompose: 0, pending: 0 }
    };
  }
  return JSON.parse(fs.readFileSync(PERMISSION_REQUESTS_PATH, 'utf8'));
}

// Save permission requests
function savePermissionRequests(data) {
  data.updated_at = new Date().toISOString();
  // Update statistics
  data.statistics = {
    total_requests: data.requests.length,
    approved: data.requests.filter(r => r.status === 'approved').length,
    rejected: data.requests.filter(r => r.status === 'rejected').length,
    redecompose: data.requests.filter(r => r.status === 'redecompose').length,
    pending: data.requests.filter(r => r.status === 'pending').length
  };
  fs.writeFileSync(PERMISSION_REQUESTS_PATH, JSON.stringify(data, null, 2));
}

// Generate permission request ID
function generatePermissionRequestId() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const permissionRequests = loadPermissionRequests();

  const todayRequests = permissionRequests.requests.filter(r =>
    r.request_id.startsWith(`PR-${dateStr}`)
  );

  const sequence = String(todayRequests.length + 1).padStart(3, '0');
  return `PR-${dateStr}-${sequence}`;
}

// Command: create-permission-request
function createPermissionRequest() {
  const requestId = generatePermissionRequestId();

  const template = {
    request_id: requestId,
    timestamp: new Date().toISOString(),
    task_description: "[FILL IN] Describe the task requiring direct Claude work (10-500 chars)",
    attempted_decomposition: {
      decomposition_attempts: 1,
      subtasks_proposed: [
        {
          title: "[FILL IN] Describe attempted subtask #1",
          blocking_reason: "[FILL IN] Explain why this subtask cannot meet atomic criteria",
          failed_criteria: ["files_touched"]
        }
      ],
      why_insufficient: "[FILL IN] Explain in detail why atomic decomposition is not feasible (min 20 chars)"
    },
    blocking_criteria: [
      "files_touched"
    ],
    justification: "[FILL IN] Provide detailed justification for why Claude must handle this directly (min 50 chars, max 1000)",
    estimated_complexity: {
      files_affected: 1,
      lines_affected: 0,
      effort_mins: 0,
      risk_level: "medium"
    },
    requested_by: "claude:sonnet-4.5",
    status: "pending"
  };

  console.log('Permission Request Template:');
  console.log('============================\n');
  console.log(JSON.stringify(template, null, 2));
  console.log('\nInstructions:');
  console.log('1. Copy the JSON above');
  console.log('2. Fill in all [FILL IN] placeholders');
  console.log('3. Add to .claude/permission-requests.json in the "requests" array');
  console.log('4. Run: node scripts/dispatcher.cjs list-permissions --status=pending');
  console.log('\nNote: Request will BLOCK work on related files until reviewed');
}

// Command: list-permissions
function listPermissions(statusFilter) {
  const data = loadPermissionRequests();
  let requests = data.requests;

  if (statusFilter) {
    requests = requests.filter(r => r.status === statusFilter);
  }

  console.log('\n=== Permission Requests ===\n');
  console.log(`Total: ${data.statistics.total_requests} | Pending: ${data.statistics.pending} | Approved: ${data.statistics.approved} | Rejected: ${data.statistics.rejected} | Redecompose: ${data.statistics.redecompose}\n`);

  if (requests.length === 0) {
    console.log('No permission requests found' + (statusFilter ? ` with status: ${statusFilter}` : ''));
    return;
  }

  requests.forEach(req => {
    const status = req.status === 'approved' ? '✅' :
                   req.status === 'rejected' ? '❌' :
                   req.status === 'redecompose' ? '🔄' :
                   '⏳';

    console.log(`${status} ${req.request_id} [${req.status.toUpperCase()}]`);
    console.log(`   Task: ${req.task_description}`);
    const sourceAgent = req.source_agent || 'primary';
    console.log(`   Source: ${sourceAgent}`);
    if (req.session_context) {
      console.log(`   Context: ${req.session_context}`);
    }
    console.log(`   Complexity: ${req.estimated_complexity.files_affected} files, ${req.estimated_complexity.lines_affected} lines, ${req.estimated_complexity.effort_mins} mins`);
    console.log(`   Risk: ${req.estimated_complexity.risk_level}`);
    console.log(`   Blocking: ${req.blocking_criteria.join(', ')}`);

    if (req.reviewed_by) {
      console.log(`   Reviewed by: ${req.reviewed_by} at ${req.review_timestamp}`);
    }

    if (req.review_decision) {
      console.log(`   Decision: ${req.review_decision}`);
    }

    if (req.approval_conditions && req.approval_conditions.length > 0) {
      console.log(`   Conditions: ${req.approval_conditions.join(', ')}`);
    }

    console.log('');
  });
}

// Command: approve-permission
function approvePermission(requestId, conditions) {
  const data = loadPermissionRequests();
  const request = data.requests.find(r => r.request_id === requestId);

  if (!request) {
    console.error(`Permission request not found: ${requestId}`);
    process.exit(1);
  }

  if (request.status !== 'pending') {
    console.error(`Permission request ${requestId} is not pending (status: ${request.status})`);
    process.exit(1);
  }

  request.status = 'approved';
  request.reviewed_by = 'human';
  request.review_timestamp = new Date().toISOString();
  request.review_decision = 'Approved by human reviewer';

  if (conditions && conditions.length > 0) {
    request.approval_conditions = conditions.split(',').map(c => c.trim());
  } else {
    request.approval_conditions = [];
  }

  savePermissionRequests(data);

  console.log(`✅ Permission request ${requestId} APPROVED`);
  console.log(`   Task: ${request.task_description}`);
  if (request.approval_conditions.length > 0) {
    console.log(`   Conditions: ${request.approval_conditions.join(', ')}`);
  }
  console.log('\nClaude can now proceed with this task.');
}

// Command: reject-permission
function rejectPermission(requestId, suggestion) {
  const data = loadPermissionRequests();
  const request = data.requests.find(r => r.request_id === requestId);

  if (!request) {
    console.error(`Permission request not found: ${requestId}`);
    process.exit(1);
  }

  if (request.status !== 'pending') {
    console.error(`Permission request ${requestId} is not pending (status: ${request.status})`);
    process.exit(1);
  }

  if (suggestion) {
    request.status = 'redecompose';
    request.alternative_approach = suggestion;
    request.review_decision = 'Alternative decomposition suggested';
  } else {
    request.status = 'rejected';
    request.review_decision = 'Request denied - must decompose atomically';
  }

  request.reviewed_by = 'human';
  request.review_timestamp = new Date().toISOString();

  savePermissionRequests(data);

  if (suggestion) {
    console.log(`🔄 Permission request ${requestId} REDECOMPOSE`);
    console.log(`   Suggestion: ${suggestion}`);
  } else {
    console.log(`❌ Permission request ${requestId} REJECTED`);
  }
  console.log(`   Task: ${request.task_description}`);
  console.log('\nClaude must decompose this task atomically.');
}

// Main
const [,, command, ...args] = process.argv;

(async function main() {
  switch (command) {
    case 'add-tasks':
      await addTasks();
      break;
    case 'assign-next':
      await assignNext();
      break;
  case 'metrics':
    const byType = args.includes('--by-type');
    const byModel = args.includes('--by-model');
    showMetrics(byType, byModel);
    break;
  case 'status':
    showStatus();
    break;
  case 'complete':
    if (!args[0]) {
      console.error('Usage: dispatcher.cjs complete <task-id> [--tests=passed|failed]');
      process.exit(1);
    }
    const testsPassed = args[1] !== '--tests=failed';
    completeTask(args[0], testsPassed);
    break;
  case 'audit':
    auditTasks();
    break;
  case 'redecompose':
    if (!args[0]) {
      console.error('Usage: dispatcher.cjs redecompose <task-id>');
      process.exit(1);
    }
    redecomposeTask(args[0]);
    break;
  case 'extract-context':
    if (!args[0]) {
      console.error('Usage: dispatcher.cjs extract-context <task-id>');
      process.exit(1);
    }
    extractContext(args[0]);
    break;
  case 'create-permission-request':
    createPermissionRequest();
    break;
  case 'list-permissions':
    const statusArg = args.find(a => a.startsWith('--status='));
    const statusFilter = statusArg ? statusArg.split('=')[1] : null;
    listPermissions(statusFilter);
    break;
  case 'approve-permission':
    if (!args[0]) {
      console.error('Usage: dispatcher.cjs approve-permission <request-id> [--conditions="cond1,cond2"]');
      process.exit(1);
    }
    const conditionsArg = args.find(a => a.startsWith('--conditions='));
    const conditions = conditionsArg ? conditionsArg.split('=')[1].replace(/^"|"$/g, '') : null;
    approvePermission(args[0], conditions);
    break;
  case 'health':
    (async () => {
      const result = await checkLmStudioHealth();
      if (result.healthy) {
        console.log('✓ LM Studio is healthy');
        process.exit(0);
      } else {
        console.error('✗ ' + result.error);
        process.exit(1);
      }
    })();
    break;
  case 'reject-permission':
    if (!args[0]) {
      console.error('Usage: dispatcher.cjs reject-permission <request-id> [--suggest="alternative approach"]');
      process.exit(1);
    }
    const suggestArg = args.find(a => a.startsWith('--suggest='));
    const suggestion = suggestArg ? suggestArg.split('=')[1].replace(/^"|"$/g, '') : null;
    rejectPermission(args[0], suggestion);
    break;
  default:
    console.log(`
Dispatcher CLI - Task management for local model delegation

Commands:
  add-tasks                         Add tasks from ///LOCAL_TASKS JSON (stdin)
  assign-next                       Assign next open task to local model
  status                            View backlog status
  metrics [opts]                    Show task success rates (--by-type, --by-model)
  complete <id> [opts]              Mark task complete (--tests=passed|failed)
  audit                             Validate all tasks against atomic criteria
  redecompose <id>                  Mark task for re-decomposition
  extract-context <id>              Extract and preview context for a task
  health                            Check LM Studio health status
  create-permission-request         Create permission request template
  list-permissions [--status=...]   List permission requests (pending|approved|rejected|redecompose)
  approve-permission <id> [opts]    Approve permission request (--conditions="cond1,cond2")
  reject-permission <id> [opts]     Reject permission request (--suggest="alternative")

Examples:
  echo '///LOCAL_TASKS [{"id":"T-001",...}]' | node scripts/dispatcher.cjs add-tasks
  node scripts/dispatcher.cjs assign-next
  node scripts/dispatcher.cjs status
  node scripts/dispatcher.cjs metrics
  node scripts/dispatcher.cjs metrics --by-type
  node scripts/dispatcher.cjs metrics --by-model
  node scripts/dispatcher.cjs complete T-001 --tests=passed
  node scripts/dispatcher.cjs audit
  node scripts/dispatcher.cjs extract-context T-001
  node scripts/dispatcher.cjs health
  node scripts/dispatcher.cjs create-permission-request
  node scripts/dispatcher.cjs list-permissions --status=pending
  node scripts/dispatcher.cjs approve-permission PR-2025-12-11-001 --conditions="must write tests"
  node scripts/dispatcher.cjs reject-permission PR-2025-12-11-001 --suggest="Split by file"
`);
  }
})().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
