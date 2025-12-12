#!/usr/bin/env node
/**
 * decomposition-validator.cjs - Validates ///LOCAL_TASKS output meets atomic criteria
 *
 * Hook Type: PostToolUse (Bash) - validates after Claude runs task operations
 *            PreToolUse (Write, Edit) - validates large changes require decomposition
 *
 * This hook:
 * 1. Validates ///LOCAL_TASKS JSON meets atomic criteria (BLOCKS if invalid)
 * 2. Warns when Claude writes >100 lines without decomposition
 * 3. Tracks decomposition depth (max 3 levels)
 *
 * Exit codes:
 * - 0: Allow the operation
 * - 2: BLOCK the operation (with message)
 */

const fs = require('fs');
const path = require('path');

// Atomic criteria limits (must match DECOMPOSITION_POLICY.md)
const ATOMIC_LIMITS = {
  files_touched: 3,
  est_lines_changed: 300,
  est_local_effort_mins: 60
};

const MAX_DECOMPOSITION_DEPTH = 3;
const WARN_LINES_THRESHOLD = 100;

/**
 * Validate a single task against atomic criteria
 */
function validateTask(task) {
  const errors = [];

  // Required fields
  if (!task.id) errors.push('Missing: id');
  if (!task.title) errors.push('Missing: title');
  if (!task.description) errors.push('Missing: description');
  if (!task.test_command) errors.push('Missing: test_command (required for verification)');
  if (!task.assigned_to) errors.push('Missing: assigned_to');
  if (!task.priority) errors.push('Missing: priority');

  // files_touched limit
  if (!Array.isArray(task.files_touched)) {
    errors.push('Missing: files_touched (array)');
  } else if (task.files_touched.length > ATOMIC_LIMITS.files_touched) {
    errors.push(`files_touched (${task.files_touched.length}) > ${ATOMIC_LIMITS.files_touched} - DECOMPOSE FURTHER`);
  }

  // est_lines_changed limit
  if (typeof task.est_lines_changed !== 'number') {
    errors.push('Missing: est_lines_changed (number)');
  } else if (task.est_lines_changed > ATOMIC_LIMITS.est_lines_changed) {
    errors.push(`est_lines_changed (${task.est_lines_changed}) > ${ATOMIC_LIMITS.est_lines_changed} - DECOMPOSE FURTHER`);
  }

  // est_local_effort_mins limit
  if (task.est_local_effort_mins && task.est_local_effort_mins > ATOMIC_LIMITS.est_local_effort_mins) {
    errors.push(`est_local_effort_mins (${task.est_local_effort_mins}) > ${ATOMIC_LIMITS.est_local_effort_mins} - DECOMPOSE FURTHER`);
  }

  // needs_context validation
  if (task.needs_context && Array.isArray(task.needs_context)) {
    task.needs_context.forEach((ctx, i) => {
      if (!ctx.lines_start || !ctx.lines_end) {
        errors.push(`needs_context[${i}] missing line ranges - MUST specify lines_start and lines_end`);
      }
    });
  }

  // Check decomposition depth
  if (task.decomposition_depth && task.decomposition_depth > MAX_DECOMPOSITION_DEPTH) {
    errors.push(`Decomposition depth (${task.decomposition_depth}) exceeds max (${MAX_DECOMPOSITION_DEPTH}) - ESCALATE to Claude`);
  }

  return errors;
}

/**
 * Parse ///LOCAL_TASKS from output
 */
function parseLocalTasks(content) {
  const match = content.match(/\/\/\/LOCAL_TASKS\s*([\s\S]*?)(?:```|$)/);
  if (!match) return null;

  try {
    const jsonStr = match[1].trim();
    const tasks = JSON.parse(jsonStr);
    return Array.isArray(tasks) ? tasks : [tasks];
  } catch (e) {
    return null;
  }
}

/**
 * Estimate lines changed from Write/Edit operation
 */
function estimateLinesChanged(toolInput) {
  if (toolInput.content) {
    return toolInput.content.split('\n').length;
  }
  if (toolInput.new_string && toolInput.old_string) {
    const oldLines = toolInput.old_string.split('\n').length;
    const newLines = toolInput.new_string.split('\n').length;
    return Math.abs(newLines - oldLines) + Math.min(oldLines, newLines);
  }
  return 0;
}

async function main() {
  let input = '';
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) { input += line + '\n'; }

  let hookData;
  try {
    hookData = JSON.parse(input);
  } catch (e) {
    // If we can't parse, just check for ///LOCAL_TASKS in raw content
    hookData = { tool_output: input };
  }

  const toolName = hookData.tool_name || 'unknown';
  const toolInput = hookData.tool_input || {};
  const toolOutput = hookData.tool_output || '';

  // PostToolUse: Validate ///LOCAL_TASKS in output
  if (toolOutput.includes('///LOCAL_TASKS')) {
    const tasks = parseLocalTasks(toolOutput);

    if (tasks) {
      const allErrors = [];

      for (const task of tasks) {
        const errors = validateTask(task);
        if (errors.length > 0) {
          allErrors.push({ task_id: task.id || 'UNKNOWN', errors });
        }
      }

      if (allErrors.length > 0) {
        console.log('');
        console.log('╔═══════════════════════════════════════════════════════════════╗');
        console.log('║  🛑 BLOCKED: ///LOCAL_TASKS failed atomic criteria            ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝');
        console.log('');

        for (const { task_id, errors } of allErrors) {
          console.log(`Task ${task_id}:`);
          errors.forEach(e => console.log(`  ✗ ${e}`));
        }

        console.log('');
        console.log('REQUIRED ACTIONS:');
        console.log('  1. Break tasks into smaller units');
        console.log('  2. Each task must touch ≤3 files');
        console.log('  3. Each task must change ≤300 lines');
        console.log('  4. Add test_command for verification');
        console.log('');
        console.log('See: .claude/DECOMPOSITION_POLICY.md');
        console.log('');

        process.exit(2); // BLOCK
      }

      // Valid tasks - log success
      console.log(`✓ ${tasks.length} task(s) passed atomic criteria validation`);
    }
  }

  // PreToolUse: Warn on large Write/Edit without decomposition
  if ((toolName === 'Write' || toolName === 'Edit') && toolInput) {
    const linesChanged = estimateLinesChanged(toolInput);

    if (linesChanged > WARN_LINES_THRESHOLD) {
      const filePath = toolInput.file_path || 'unknown';

      // Check if this file is part of an active task
      const backlogPath = path.join(process.cwd(), '.claude', 'backlog.json');
      let hasActiveTask = false;

      if (fs.existsSync(backlogPath)) {
        try {
          const backlog = JSON.parse(fs.readFileSync(backlogPath, 'utf8'));
          const inProgressTasks = backlog.tasks?.filter(t => t.status === 'in_progress') || [];
          hasActiveTask = inProgressTasks.some(t =>
            t.files_touched?.some(f => filePath.includes(f) || f.includes(path.basename(filePath)))
          );
        } catch (e) {}
      }

      if (!hasActiveTask) {
        console.log('');
        console.log('╔═══════════════════════════════════════════════════════════════╗');
        console.log('║  ⚠️  WARNING: Large change without decomposed task            ║');
        console.log('╠═══════════════════════════════════════════════════════════════╣');
        console.log(`║  File: ${path.basename(filePath).substring(0, 54).padEnd(54)}║`);
        console.log(`║  Lines: ~${linesChanged.toString().padEnd(52)}║`);
        console.log('╠═══════════════════════════════════════════════════════════════╣');
        console.log('║  Consider decomposing this work:                              ║');
        console.log('║  1. Output ///LOCAL_TASKS JSON with atomic tasks              ║');
        console.log('║  2. Run: node scripts/dispatcher.cjs add-tasks               ║');
        console.log('║  3. Execute via local model                                   ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝');
        console.log('');
        // Don't block, just warn
      }
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[DECOMPOSITION-VALIDATOR] Hook error:', err.message);
  process.exit(0); // Don't block on errors
});
