#!/usr/bin/env node
/**
 * audit_decomposition.cjs - Comprehensive decomposition audit tool
 *
 * Validates all tasks in backlog.json against atomic criteria and produces
 * a detailed report with actionable recommendations.
 *
 * Usage:
 *   node scripts/audit_decomposition.cjs [--verbose] [--fix]
 */

const fs = require('fs');
const path = require('path');

const BACKLOG_PATH = path.join(process.cwd(), '.claude', 'backlog.json');
const REPORT_PATH = path.join(process.cwd(), '.claude', 'audits', 'atomicity_report.json');
const SCHEMA_PATH = path.join(process.cwd(), '.claude', 'schemas', 'local-task.schema.json');

// Atomic criteria limits (must match DECOMPOSITION_POLICY.md)
const ATOMIC_LIMITS = {
  files_touched: 3,
  est_lines_changed: 300,
  est_local_effort_mins: 60
};

// Required fields per schema
const REQUIRED_FIELDS = [
  'id', 'title', 'description', 'files_touched',
  'est_lines_changed', 'test_command', 'assigned_to', 'priority', 'status'
];

// Parse arguments
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const fix = args.includes('--fix');

/**
 * Validate a single task against atomic criteria
 */
function validateTask(task) {
  const errors = [];
  const warnings = [];
  const fixes = [];

  // Required fields
  for (const field of REQUIRED_FIELDS) {
    if (task[field] === undefined || task[field] === null) {
      errors.push({ type: 'missing_field', field, message: `Missing required field: ${field}` });
    }
  }

  // ID format: T-XXX-NNN
  if (task.id && !/^T-[A-Z0-9]+-\d{3}$/.test(task.id)) {
    warnings.push({ type: 'id_format', message: `ID "${task.id}" doesn't match pattern T-XXX-NNN` });
  }

  // Atomic limit: files_touched <= 3
  if (Array.isArray(task.files_touched)) {
    if (task.files_touched.length > ATOMIC_LIMITS.files_touched) {
      errors.push({
        type: 'atomic_violation',
        field: 'files_touched',
        value: task.files_touched.length,
        limit: ATOMIC_LIMITS.files_touched,
        message: `files_touched (${task.files_touched.length}) exceeds limit (${ATOMIC_LIMITS.files_touched})`,
        fix: 'Split into multiple tasks, each touching ≤3 files'
      });
    }
  }

  // Atomic limit: est_lines_changed <= 300
  if (typeof task.est_lines_changed === 'number') {
    if (task.est_lines_changed > ATOMIC_LIMITS.est_lines_changed) {
      errors.push({
        type: 'atomic_violation',
        field: 'est_lines_changed',
        value: task.est_lines_changed,
        limit: ATOMIC_LIMITS.est_lines_changed,
        message: `est_lines_changed (${task.est_lines_changed}) exceeds limit (${ATOMIC_LIMITS.est_lines_changed})`,
        fix: 'Break into smaller logical units'
      });
    }
  }

  // Atomic limit: est_local_effort_mins <= 60
  if (typeof task.est_local_effort_mins === 'number') {
    if (task.est_local_effort_mins > ATOMIC_LIMITS.est_local_effort_mins) {
      errors.push({
        type: 'atomic_violation',
        field: 'est_local_effort_mins',
        value: task.est_local_effort_mins,
        limit: ATOMIC_LIMITS.est_local_effort_mins,
        message: `est_local_effort_mins (${task.est_local_effort_mins}) exceeds limit (${ATOMIC_LIMITS.est_local_effort_mins})`,
        fix: 'Decompose into phases'
      });
    }
  }

  // Required: test_command
  if (!task.test_command || task.test_command.trim() === '') {
    errors.push({
      type: 'missing_test',
      message: 'Missing test_command - all tasks must be verifiable',
      fix: 'Add: "test_command": "npm test path/to/test.js" or "node -e \\"require(\'./file\')\\""'
    });
  }

  // needs_context validation
  if (task.needs_context && Array.isArray(task.needs_context)) {
    task.needs_context.forEach((ctx, i) => {
      if (!ctx.path) {
        errors.push({ type: 'invalid_context', message: `needs_context[${i}] missing path` });
      }
      if (typeof ctx.lines_start !== 'number') {
        errors.push({ type: 'invalid_context', message: `needs_context[${i}] missing lines_start` });
      }
      if (typeof ctx.lines_end !== 'number') {
        errors.push({ type: 'invalid_context', message: `needs_context[${i}] missing lines_end` });
      }
      if (ctx.lines_start > ctx.lines_end) {
        errors.push({ type: 'invalid_context', message: `needs_context[${i}] lines_start > lines_end` });
      }
    });
  }

  // assigned_to format
  if (task.assigned_to && !/^(local:(deepseek|qwen)|human|claude)$/.test(task.assigned_to)) {
    errors.push({
      type: 'invalid_assigned_to',
      message: `Invalid assigned_to: "${task.assigned_to}"`,
      fix: 'Must be: local:deepseek, local:qwen, human, or claude'
    });
  }

  // Priority format
  if (task.priority && !['P0', 'P1', 'P2', 'P3'].includes(task.priority)) {
    warnings.push({ type: 'invalid_priority', message: `Invalid priority: "${task.priority}"` });
  }

  // Status format
  if (task.status && !['open', 'in_progress', 'review', 'done', 'blocked', 'failed'].includes(task.status)) {
    warnings.push({ type: 'invalid_status', message: `Invalid status: "${task.status}"` });
  }

  return {
    task_id: task.id || 'UNKNOWN',
    valid: errors.length === 0,
    errors,
    warnings,
    fixes: errors.filter(e => e.fix).map(e => ({ field: e.field, suggestion: e.fix }))
  };
}

/**
 * Run full audit on backlog
 */
function runAudit() {
  // Load backlog
  if (!fs.existsSync(BACKLOG_PATH)) {
    console.log('No backlog.json found - nothing to audit');
    return { valid: 0, invalid: 0, tasks: [] };
  }

  const backlog = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf8'));
  const tasks = backlog.tasks || [];

  if (tasks.length === 0) {
    console.log('Backlog is empty - nothing to audit');
    return { valid: 0, invalid: 0, tasks: [] };
  }

  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║       DECOMPOSITION AUDIT - Atomic Criteria       ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log(`║  Files touched limit:     ≤ ${ATOMIC_LIMITS.files_touched}                     ║`);
  console.log(`║  Lines changed limit:     ≤ ${ATOMIC_LIMITS.est_lines_changed}                   ║`);
  console.log(`║  Effort minutes limit:    ≤ ${ATOMIC_LIMITS.est_local_effort_mins}                    ║`);
  console.log(`║  Test command:            Required               ║`);
  console.log('╚═══════════════════════════════════════════════════╝\n');

  const results = [];
  let validCount = 0;
  let invalidCount = 0;

  for (const task of tasks) {
    const result = validateTask(task);
    results.push(result);

    if (result.valid) {
      validCount++;
      if (verbose) {
        console.log(`✓ ${result.task_id}`);
      }
    } else {
      invalidCount++;
      console.log(`✗ ${result.task_id}`);
      result.errors.forEach(e => console.log(`    ERROR: ${e.message}`));
      result.warnings.forEach(w => console.log(`    WARN:  ${w.message}`));
      if (result.fixes.length > 0) {
        console.log('    FIXES:');
        result.fixes.forEach(f => console.log(`      - ${f.suggestion}`));
      }
    }
  }

  // Summary
  const compliance = tasks.length > 0 ? ((validCount / tasks.length) * 100).toFixed(1) : 0;
  console.log('\n───────────────────────────────────────────────────');
  console.log(`Total Tasks:     ${tasks.length}`);
  console.log(`Valid:           ${validCount}`);
  console.log(`Invalid:         ${invalidCount}`);
  console.log(`Compliance:      ${compliance}%`);
  console.log('───────────────────────────────────────────────────');

  if (invalidCount > 0) {
    console.log('\n⚠️  BLOCK MODE: Cannot assign tasks until all pass atomic criteria');
    console.log('   Run with --verbose for detailed output');
  } else {
    console.log('\n✓ All tasks pass atomic criteria validation');
  }

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    limits: ATOMIC_LIMITS,
    summary: {
      total: tasks.length,
      valid: validCount,
      invalid: invalidCount,
      compliance_percent: parseFloat(compliance)
    },
    results
  };

  // Write report
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nReport written to: ${REPORT_PATH}`);

  return report;
}

// Export for use by other scripts
module.exports = { validateTask, runAudit, ATOMIC_LIMITS, REQUIRED_FIELDS };

// Run if executed directly
if (require.main === module) {
  const report = runAudit();
  process.exit(report.summary?.invalid > 0 ? 2 : 0);
}
