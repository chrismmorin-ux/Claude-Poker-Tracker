#!/usr/bin/env node

/**
 * Decomposition Health Check
 *
 * Analyzes backlog.json and reports on decomposition system health:
 * - Atomic compliance rate
 * - Average decomposition depth
 * - Permission request patterns
 * - Test pass rates
 * - Warnings for violations
 * - Recommendations for improvements
 */

const fs = require('fs');
const path = require('path');

// Paths
const BACKLOG_PATH = path.join(process.cwd(), '.claude', 'backlog.json');
const PERMISSION_REQUESTS_PATH = path.join(process.cwd(), '.claude', 'permission-requests.json');
const SCHEMA_PATH = path.join(process.cwd(), '.claude', 'schemas', 'local-task.schema.json');
const AUDIT_REPORT_PATH = path.join(process.cwd(), '.claude', 'audits', 'atomicity_report.json');

// Constants
const COMPLIANCE_TARGET = 0.95; // 95%
const DEPTH_TARGET = 1.5;
const PERMISSION_RATE_TARGET = 0.05; // 5%
const TEST_PASS_RATE_TARGET = 0.90; // 90%

/**
 * Load JSON file safely
 */
function loadJSON(filePath, defaultValue = null) {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error.message);
    return defaultValue;
  }
}

/**
 * Calculate atomic compliance
 */
function calculateCompliance(tasks) {
  if (tasks.length === 0) return { rate: 1.0, violations: [] };

  const violations = [];

  tasks.forEach(task => {
    const issues = [];

    // Check files_touched
    if (task.files_touched && task.files_touched.length > 3) {
      issues.push(`files_touched: ${task.files_touched.length} > 3`);
    }

    // Check est_lines_changed
    if (task.est_lines_changed && task.est_lines_changed > 300) {
      issues.push(`est_lines_changed: ${task.est_lines_changed} > 300`);
    }

    // Check test_command
    if (!task.test_command || task.test_command.trim() === '') {
      issues.push('missing test_command');
    }

    // Check est_local_effort_mins
    if (task.est_local_effort_mins && task.est_local_effort_mins > 60) {
      issues.push(`est_local_effort_mins: ${task.est_local_effort_mins} > 60`);
    }

    if (issues.length > 0) {
      violations.push({
        task_id: task.id,
        title: task.title,
        issues
      });
    }
  });

  const compliantCount = tasks.length - violations.length;
  const rate = tasks.length > 0 ? compliantCount / tasks.length : 1.0;

  return { rate, violations };
}

/**
 * Calculate average decomposition depth
 */
function calculateAverageDepth(tasks) {
  const tasksWithDepth = tasks.filter(t =>
    t.decomposition_history && t.decomposition_history.length > 0
  );

  if (tasksWithDepth.length === 0) return 0;

  const totalDepth = tasksWithDepth.reduce((sum, task) => {
    const maxDepth = Math.max(...task.decomposition_history.map(h => h.depth || 0));
    return sum + maxDepth;
  }, 0);

  return totalDepth / tasksWithDepth.length;
}

/**
 * Find max depth reached
 */
function findMaxDepth(tasks) {
  let maxDepth = 0;

  tasks.forEach(task => {
    if (task.decomposition_history && task.decomposition_history.length > 0) {
      const taskMaxDepth = Math.max(...task.decomposition_history.map(h => h.depth || 0));
      if (taskMaxDepth > maxDepth) {
        maxDepth = taskMaxDepth;
      }
    }

    // Also check decomposition_depth field
    if (task.decomposition_depth && task.decomposition_depth > maxDepth) {
      maxDepth = task.decomposition_depth;
    }
  });

  return maxDepth;
}

/**
 * Analyze permission requests
 */
function analyzePermissionRequests(permissionRequests) {
  if (!permissionRequests) {
    return {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      rate: 0
    };
  }

  const requests = permissionRequests.requests || [];

  return {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    rate: 0 // Will be calculated relative to total tasks
  };
}

/**
 * Calculate test pass rate
 */
function calculateTestPassRate(tasks) {
  const tasksWithTests = tasks.filter(t =>
    t.test_command && t.status === 'done'
  );

  if (tasksWithTests.length === 0) return null;

  // Count tasks that completed successfully vs failed
  const completedTasks = tasks.filter(t => t.status === 'done');
  const failedTasks = tasks.filter(t => t.status === 'failed');
  const totalTested = completedTasks.length + failedTasks.length;

  if (totalTested === 0) return null;

  return completedTasks.length / totalTested;
}

/**
 * Generate warnings
 */
function generateWarnings(compliance, avgDepth, maxDepth, permissionStats, testPassRate, tasks) {
  const warnings = [];

  // Add compliance violations
  if (compliance.violations.length > 0) {
    compliance.violations.forEach(v => {
      warnings.push({
        level: 'warning',
        message: `Task ${v.task_id} violates atomic criteria: ${v.issues.join(', ')}`
      });
    });
  }

  // Depth warnings
  if (avgDepth > DEPTH_TARGET) {
    warnings.push({
      level: 'warning',
      message: `Average decomposition depth (${avgDepth.toFixed(2)}) exceeds target (${DEPTH_TARGET})`
    });
  }

  if (maxDepth >= 3) {
    warnings.push({
      level: 'critical',
      message: `Max decomposition depth reached (${maxDepth}/3) - escalation threshold`
    });
  }

  // Test pass rate warnings
  if (testPassRate !== null && testPassRate < TEST_PASS_RATE_TARGET) {
    warnings.push({
      level: 'warning',
      message: `Test pass rate (${(testPassRate * 100).toFixed(1)}%) below target (${TEST_PASS_RATE_TARGET * 100}%)`
    });
  }

  // Compliance warnings
  if (compliance.rate < COMPLIANCE_TARGET) {
    warnings.push({
      level: 'critical',
      message: `Atomic compliance (${(compliance.rate * 100).toFixed(1)}%) below target (${COMPLIANCE_TARGET * 100}%)`
    });
  }

  return warnings;
}

/**
 * Generate recommendations
 */
function generateRecommendations(compliance, avgDepth, permissionStats, testPassRate, warnings) {
  const recommendations = [];

  // Compliance recommendations
  if (compliance.violations.length > 0) {
    compliance.violations.forEach(v => {
      if (v.issues.some(i => i.includes('files_touched'))) {
        recommendations.push(`→ Redecompose ${v.task_id} by splitting into multiple tasks (one per file group)`);
      }
      if (v.issues.some(i => i.includes('est_lines_changed'))) {
        recommendations.push(`→ Break ${v.task_id} into smaller logical units (target <150 lines per task)`);
      }
      if (v.issues.some(i => i.includes('test_command'))) {
        recommendations.push(`→ Add test_command to ${v.task_id} (even simple: node -e "require('./file')")`);
      }
      if (v.issues.some(i => i.includes('est_local_effort_mins'))) {
        recommendations.push(`→ Split ${v.task_id} into sequential phases (target <30 min per task)`);
      }
    });
  }

  // Depth recommendations
  if (avgDepth > DEPTH_TARGET) {
    recommendations.push('→ Improve initial task specifications (clearer constraints, better context)');
    recommendations.push('→ Review failed tasks to identify specification patterns');
  }

  // Permission rate recommendations
  const permissionRate = permissionStats.rate;
  if (permissionRate > PERMISSION_RATE_TARGET) {
    recommendations.push('→ Review permission requests for decomposition opportunities');
    recommendations.push('→ Consider architectural changes to enable better decomposition');
  }

  // Test pass rate recommendations
  if (testPassRate !== null && testPassRate < TEST_PASS_RATE_TARGET) {
    recommendations.push('→ Add more specific constraints to task specs');
    recommendations.push('→ Increase context via needs_context for failing tasks');
  }

  // General recommendations if healthy
  if (warnings.length === 0) {
    recommendations.push('✓ System healthy - maintain current decomposition practices');
  }

  return recommendations;
}

/**
 * Main health check
 */
function runHealthCheck() {
  console.log('Decomposition Health Report');
  console.log('==========================\n');

  // Load data
  const backlog = loadJSON(BACKLOG_PATH, { tasks: [] });
  const permissionRequests = loadJSON(PERMISSION_REQUESTS_PATH, { requests: [] });

  const tasks = backlog.tasks || [];

  if (tasks.length === 0) {
    console.log('No tasks in backlog - system idle\n');
    return 0;
  }

  // Calculate metrics
  const statusCounts = {
    open: tasks.filter(t => t.status === 'open').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    review: tasks.filter(t => t.status === 'review').length,
    done: tasks.filter(t => t.status === 'done').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    failed: tasks.filter(t => t.status === 'failed').length
  };

  const compliance = calculateCompliance(tasks);
  const avgDepth = calculateAverageDepth(tasks);
  const maxDepth = findMaxDepth(tasks);
  const permissionStats = analyzePermissionRequests(permissionRequests);
  permissionStats.rate = tasks.length > 0 ? permissionStats.total / tasks.length : 0;
  const testPassRate = calculateTestPassRate(tasks);

  // Display metrics
  console.log('Backlog Status:');
  console.log(`  Open: ${statusCounts.open}`);
  console.log(`  In Progress: ${statusCounts.in_progress}`);
  console.log(`  Review: ${statusCounts.review}`);
  console.log(`  Done: ${statusCounts.done}`);
  console.log(`  Blocked: ${statusCounts.blocked}`);
  console.log(`  Failed: ${statusCounts.failed}`);
  console.log(`  Total: ${tasks.length}\n`);

  console.log('Atomic Compliance:');
  const compliancePercent = (compliance.rate * 100).toFixed(1);
  const complianceStatus = compliance.rate >= COMPLIANCE_TARGET ? '✓' : '✗';
  console.log(`  ${complianceStatus} ${compliancePercent}% (${tasks.length - compliance.violations.length}/${tasks.length} tasks)`);
  console.log(`  Target: ${COMPLIANCE_TARGET * 100}%`);
  if (compliance.violations.length > 0) {
    console.log(`  Violations: ${compliance.violations.length}`);
  }
  console.log('');

  console.log('Decomposition Depth:');
  const depthStatus = avgDepth <= DEPTH_TARGET ? '✓' : '✗';
  console.log(`  ${depthStatus} Average: ${avgDepth.toFixed(2)}`);
  console.log(`  Max Reached: ${maxDepth}/3`);
  console.log(`  Target: <${DEPTH_TARGET}\n`);

  console.log('Permission Requests:');
  console.log(`  Total: ${permissionStats.total}`);
  console.log(`  Pending: ${permissionStats.pending}`);
  console.log(`  Approved: ${permissionStats.approved}`);
  console.log(`  Rejected: ${permissionStats.rejected}`);
  const permissionRatePercent = (permissionStats.rate * 100).toFixed(1);
  const permissionStatus = permissionStats.rate <= PERMISSION_RATE_TARGET ? '✓' : '✗';
  console.log(`  ${permissionStatus} Rate: ${permissionRatePercent}% of tasks`);
  console.log(`  Target: <${PERMISSION_RATE_TARGET * 100}%\n`);

  if (testPassRate !== null) {
    console.log('Test Pass Rate:');
    const testPassPercent = (testPassRate * 100).toFixed(1);
    const testPassStatus = testPassRate >= TEST_PASS_RATE_TARGET ? '✓' : '✗';
    console.log(`  ${testPassStatus} ${testPassPercent}%`);
    console.log(`  Target: >${TEST_PASS_RATE_TARGET * 100}%\n`);
  }

  // Generate warnings and recommendations
  const warnings = generateWarnings(compliance, avgDepth, maxDepth, permissionStats, testPassRate, tasks);
  const recommendations = generateRecommendations(compliance, avgDepth, permissionStats, testPassRate, warnings);

  // Display warnings
  if (warnings.length > 0) {
    console.log('WARNINGS:');
    warnings.forEach(w => {
      const prefix = w.level === 'critical' ? '⚠⚠' : '⚠';
      console.log(`${prefix} ${w.message}`);
    });
    console.log('');
  }

  // Display recommendations
  if (recommendations.length > 0) {
    console.log('RECOMMENDATIONS:');
    recommendations.forEach(r => {
      console.log(r);
    });
    console.log('');
  }

  // Overall health score
  const healthScore = calculateHealthScore(compliance.rate, avgDepth, permissionStats.rate, testPassRate);
  console.log('Overall Health Score:');
  console.log(`  ${getHealthGrade(healthScore)} (${healthScore.toFixed(1)}/100)`);
  console.log('');

  // Exit code based on critical warnings
  const hasCritical = warnings.some(w => w.level === 'critical');
  return hasCritical ? 1 : 0;
}

/**
 * Calculate overall health score (0-100)
 */
function calculateHealthScore(complianceRate, avgDepth, permissionRate, testPassRate) {
  let score = 0;

  // Compliance: 40 points
  score += complianceRate * 40;

  // Depth: 30 points (inverse - lower is better)
  const depthScore = Math.max(0, 1 - (avgDepth / 3));
  score += depthScore * 30;

  // Permission rate: 15 points (inverse - lower is better)
  const permissionScore = Math.max(0, 1 - (permissionRate / 0.10));
  score += permissionScore * 15;

  // Test pass rate: 15 points
  if (testPassRate !== null) {
    score += testPassRate * 15;
  } else {
    score += 15; // Default to full points if no test data
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Get letter grade for health score
 */
function getHealthGrade(score) {
  if (score >= 95) return 'A+ Excellent';
  if (score >= 90) return 'A  Very Good';
  if (score >= 85) return 'B+ Good';
  if (score >= 80) return 'B  Acceptable';
  if (score >= 75) return 'C+ Fair';
  if (score >= 70) return 'C  Needs Improvement';
  if (score >= 60) return 'D  Poor';
  return 'F  Critical';
}

// Run health check
if (require.main === module) {
  const exitCode = runHealthCheck();
  process.exit(exitCode);
}

module.exports = {
  runHealthCheck,
  calculateCompliance,
  calculateAverageDepth,
  findMaxDepth,
  analyzePermissionRequests,
  calculateTestPassRate,
  generateWarnings,
  generateRecommendations,
  calculateHealthScore
};
