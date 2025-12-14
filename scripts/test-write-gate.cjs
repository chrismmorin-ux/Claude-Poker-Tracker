#!/usr/bin/env node
/**
 * test-write-gate.cjs - Test script for Phase 4 validation (T-P4-001)
 *
 * Tests the write-gate.cjs hook with various scenarios:
 * 1. Write without task → Should exit code 2 (BLOCK)
 * 2. Write with local-assigned task → Should exit code 2 (BLOCK)
 * 3. Write with claude-assigned task → Should exit code 0 (ALLOW)
 * 4. Write to exempt file (plan mode) → Should exit code 0 (ALLOW)
 * 5. Write to exempt file (project file) → Should exit code 0 (ALLOW)
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKLOG_FILE = path.join(process.cwd(), '.claude', 'backlog.json');
const GATE_SCRIPT = path.join(process.cwd(), '.claude', 'hooks', 'write-gate.cjs');

// Color output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(level, message) {
  const prefix = {
    'PASS': `${colors.green}✓ PASS${colors.reset}`,
    'FAIL': `${colors.red}✗ FAIL${colors.reset}`,
    'TEST': `${colors.blue}→ TEST${colors.reset}`,
    'INFO': `${colors.yellow}ℹ INFO${colors.reset}`
  }[level] || level;
  console.log(`${prefix}: ${message}`);
}

/**
 * Run write-gate with a specific file path
 */
async function runWriteGate(filePath) {
  return new Promise((resolve) => {
    const proc = spawn('node', [GATE_SCRIPT], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stderr = '';
    let stdout = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // Send input to stdin
    const input = JSON.stringify({
      tool_input: { file_path: filePath }
    });
    proc.stdin.write(input);
    proc.stdin.end();

    proc.on('close', (code) => {
      resolve({ code, stderr, stdout });
    });
  });
}

/**
 * Load backlog and add test task
 */
function addTestTask(id, title, filesTouched, assignedTo, status = 'open') {
  const backlog = JSON.parse(fs.readFileSync(BACKLOG_FILE, 'utf-8'));

  backlog.tasks.push({
    id,
    title,
    files_touched: filesTouched,
    assigned_to: assignedTo,
    status,
    priority: 'P1',
    est_local_effort_mins: 10
  });

  fs.writeFileSync(BACKLOG_FILE, JSON.stringify(backlog, null, 2));
}

/**
 * Remove test task
 */
function removeTestTask(id) {
  const backlog = JSON.parse(fs.readFileSync(BACKLOG_FILE, 'utf-8'));
  backlog.tasks = backlog.tasks.filter(t => t.id !== id);
  fs.writeFileSync(BACKLOG_FILE, JSON.stringify(backlog, null, 2));
}

/**
 * Save backlog
 */
function saveBacklog(data) {
  fs.writeFileSync(BACKLOG_FILE, JSON.stringify(data, null, 2));
}

/**
 * Main test runner
 */
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('WRITE-GATE TEST SUITE - Phase 4 Validation (T-P4-001)');
  console.log('='.repeat(70) + '\n');

  // Save original backlog
  const originalBacklog = JSON.parse(fs.readFileSync(BACKLOG_FILE, 'utf-8'));
  let passed = 0;
  let failed = 0;

  try {
    // Test 1: Write without task
    log('TEST', 'Scenario 1: Write without task (should BLOCK with exit code 2)');
    let result = await runWriteGate('src/some-random-file.js');
    if (result.code === 2) {
      log('PASS', 'Correctly blocked write without task');
      passed++;
    } else {
      log('FAIL', `Expected exit code 2, got ${result.code}`);
      failed++;
    }

    // Test 2: Write with local-assigned task
    log('\nTEST', 'Scenario 2: Write with local-assigned task (should BLOCK with exit code 2)');
    addTestTask('TEST-LOCAL-001', 'Test local task', ['src/test-local.js'], 'local:qwen');
    result = await runWriteGate('src/test-local.js');
    if (result.code === 2) {
      log('PASS', 'Correctly blocked write with local-assigned task');
      passed++;
    } else {
      log('FAIL', `Expected exit code 2, got ${result.code}`);
      failed++;
    }
    removeTestTask('TEST-LOCAL-001');

    // Test 3: Write with claude-assigned task
    log('\nTEST', 'Scenario 3: Write with claude-assigned task (should ALLOW with exit code 0)');
    addTestTask('TEST-CLAUDE-001', 'Test claude task', ['src/test-claude.js'], 'claude');
    result = await runWriteGate('src/test-claude.js');
    if (result.code === 0) {
      log('PASS', 'Correctly allowed write with claude-assigned task');
      passed++;
    } else {
      log('FAIL', `Expected exit code 0, got ${result.code}`);
      failed++;
    }
    removeTestTask('TEST-CLAUDE-001');

    // Test 4: Write to exempt file (plan mode)
    log('\nTEST', 'Scenario 4: Write to exempt file in plan mode (should ALLOW with exit code 0)');
    result = await runWriteGate('.claude/plans/test-plan.md');
    if (result.code === 0) {
      log('PASS', 'Correctly allowed write to plan mode file');
      passed++;
    } else {
      log('FAIL', `Expected exit code 0, got ${result.code}`);
      failed++;
    }

    // Test 5: Write to exempt file (project file)
    log('\nTEST', 'Scenario 5: Write to exempt file (project file) (should ALLOW with exit code 0)');
    result = await runWriteGate('docs/projects/test.project.md');
    if (result.code === 0) {
      log('PASS', 'Correctly allowed write to project file');
      passed++;
    } else {
      log('FAIL', `Expected exit code 0, got ${result.code}`);
      failed++;
    }

  } finally {
    // Restore original backlog
    saveBacklog(originalBacklog);
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test error:', err.message);
  process.exit(1);
});
