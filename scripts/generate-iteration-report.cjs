#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function generateReport() {
  const projectRoot = path.join(__dirname, '..');
  const backlogPath = path.join(projectRoot, '.claude', 'backlog.json');
  const limitsPath = path.join(projectRoot, '.claude', 'config', 'atomic-limits.json');
  const logsPath = path.join(projectRoot, '.claude', 'logs', 'local-model-tasks.log');
  const reportPath = path.join(projectRoot, '.claude', 'ITERATION_REPORT.md');

  // Load data sources
  let backlog = {};
  let limits = {};
  let taskLogs = [];

  try {
    if (fs.existsSync(backlogPath)) {
      const backlogContent = fs.readFileSync(backlogPath, 'utf-8');
      backlog = JSON.parse(backlogContent);
    }
  } catch (error) {
    console.error(`Failed to read backlog: ${error.message}`);
  }

  try {
    if (fs.existsSync(limitsPath)) {
      const limitsContent = fs.readFileSync(limitsPath, 'utf-8');
      limits = JSON.parse(limitsContent);
    }
  } catch (error) {
    console.error(`Failed to read limits: ${error.message}`);
  }

  try {
    if (fs.existsSync(logsPath)) {
      const logsContent = fs.readFileSync(logsPath, 'utf-8');
      const lines = logsContent.split('\n').filter(line => line.trim());
      taskLogs = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(entry => entry !== null);
    }
  } catch (error) {
    console.error(`Failed to read logs: ${error.message}`);
  }

  // Calculate metrics
  const tasks = backlog.tasks || [];

  // Task status breakdown
  const statusCounts = {};
  const assignmentCounts = {};
  let totalEstLines = 0;
  let totalEstEffort = 0;

  tasks.forEach(task => {
    const status = task.status || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    const assigned = task.assigned_to || 'unassigned';
    assignmentCounts[assigned] = (assignmentCounts[assigned] || 0) + 1;

    totalEstLines += task.est_lines_changed || 0;
    totalEstEffort += task.est_local_effort_mins || 0;
  });

  // Execution metrics by model
  const modelMetrics = {};
  const allTaskIds = new Set();

  taskLogs.forEach(log => {
    const model = log.model || 'unknown';
    const status = log.status || 'unknown';
    const taskId = log.task_id || 'unknown';

    allTaskIds.add(taskId);

    if (!modelMetrics[model]) {
      modelMetrics[model] = {
        total: 0,
        succeeded: 0,
        failed: 0,
        inProgress: 0,
        avgDuration: 0,
        durations: []
      };
    }

    modelMetrics[model].total++;

    if (status === 'completed' || status === 'success') {
      modelMetrics[model].succeeded++;
    } else if (status === 'failed') {
      modelMetrics[model].failed++;
    } else if (status === 'in_progress') {
      modelMetrics[model].inProgress++;
    }

    if (log.execution && log.execution.duration_ms) {
      modelMetrics[model].durations.push(log.execution.duration_ms);
    }
  });

  // Calculate average durations
  Object.keys(modelMetrics).forEach(model => {
    const durations = modelMetrics[model].durations;
    if (durations.length > 0) {
      modelMetrics[model].avgDuration = Math.round(
        durations.reduce((a, b) => a + b, 0) / durations.length
      );
    }
  });

  // Get recent tasks (last 10)
  const recentTasks = taskLogs.slice(-10).reverse();

  // Generate markdown report
  let markdown = `# Iteration Metrics Report

Generated: ${new Date().toISOString()}

## Current Atomic Limits

| Limit | Value | Description |
|-------|-------|-------------|
`;

  if (limits.limits) {
    Object.keys(limits.limits).forEach(key => {
      const limit = limits.limits[key];
      const value = limit.max !== undefined ? limit.max : limit.value;
      const desc = limit.description || '';
      markdown += `| ${key} | ${value} | ${desc} |\n`;
    });
  }

  markdown += `

## Task Status Summary

**Total Tasks:** ${tasks.length}

| Status | Count | Percentage |
|--------|-------|-----------|
`;

  const totalTasks = tasks.length || 1;
  Object.keys(statusCounts).sort().forEach(status => {
    const count = statusCounts[status];
    const percentage = ((count / totalTasks) * 100).toFixed(1);
    markdown += `| ${status} | ${count} | ${percentage}% |\n`;
  });

  markdown += `

## Assignment Breakdown

| Assigned To | Count | Percentage |
|------------|-------|-----------|
`;

  Object.keys(assignmentCounts).sort().forEach(assigned => {
    const count = assignmentCounts[assigned];
    const percentage = ((count / totalTasks) * 100).toFixed(1);
    markdown += `| ${assigned} | ${count} | ${percentage}% |\n`;
  });

  markdown += `

## Effort Estimates

- **Total Estimated Lines Changed:** ${totalEstLines}
- **Total Estimated Effort (minutes):** ${totalEstEffort}
- **Average Lines Per Task:** ${(totalEstLines / Math.max(totalTasks, 1)).toFixed(1)}
- **Average Effort Per Task:** ${(totalEstEffort / Math.max(totalTasks, 1)).toFixed(1)} minutes

## Execution History by Model

| Model | Total | Succeeded | Failed | In Progress | Success Rate | Avg Duration (ms) |
|-------|-------|-----------|--------|-------------|--------------|-------------------|
`;

  Object.keys(modelMetrics).sort().forEach(model => {
    const metrics = modelMetrics[model];
    const successRate = metrics.total > 0
      ? ((metrics.succeeded / metrics.total) * 100).toFixed(1)
      : '0.0';
    markdown += `| ${model} | ${metrics.total} | ${metrics.succeeded} | ${metrics.failed} | ${metrics.inProgress} | ${successRate}% | ${metrics.avgDuration} |\n`;
  });

  markdown += `

## Recent Execution History (Last 10 Tasks)

| Timestamp | Task ID | Model | Status | Duration (ms) |
|-----------|---------|-------|--------|--------------|
`;

  recentTasks.forEach(log => {
    const timestamp = log.timestamp ? new Date(log.timestamp).toISOString().slice(0, 19) : 'N/A';
    const taskId = log.task_id || 'N/A';
    const model = log.model || 'N/A';
    const status = log.status || 'N/A';
    const duration = log.execution && log.execution.duration_ms
      ? log.execution.duration_ms
      : 'N/A';
    markdown += `| ${timestamp} | ${taskId} | ${model} | ${status} | ${duration} |\n`;
  });

  markdown += `

## Recommendations for Tuning

`;

  // Calculate recommendations
  const recommendations = [];

  // Check success rates
  Object.keys(modelMetrics).forEach(model => {
    const metrics = modelMetrics[model];
    if (metrics.total >= 5) {
      const successRate = (metrics.succeeded / metrics.total) * 100;
      if (successRate < 50) {
        recommendations.push(
          `**${model}** has low success rate (${successRate.toFixed(1)}%). Consider reviewing failure patterns or adjusting task decomposition.`
        );
      } else if (successRate < 70) {
        recommendations.push(
          `**${model}** has moderate success rate (${successRate.toFixed(1)}%). Monitor recent failures and consider lighter task loads.`
        );
      }
    }
  });

  // Check task distribution
  const unassignedCount = assignmentCounts['unassigned'] || 0;
  if (unassignedCount > 0) {
    const unassignedPercent = ((unassignedCount / totalTasks) * 100).toFixed(1);
    recommendations.push(
      `**${unassignedCount}** tasks (${unassignedPercent}%) are unassigned. Review and assign these to appropriate models.`
    );
  }

  // Check atomic limits
  if (limits.limits) {
    const avgLines = totalEstLines / Math.max(totalTasks, 1);
    if (avgLines > (limits.limits.est_lines_changed?.max || 300) * 0.8) {
      recommendations.push(
        `Average lines per task (${avgLines.toFixed(1)}) approaching limit (${limits.limits.est_lines_changed?.max || 300}). Consider tighter decomposition.`
      );
    }

    const avgEffort = totalEstEffort / Math.max(totalTasks, 1);
    if (avgEffort > (limits.limits.est_local_effort_mins?.max || 60) * 0.8) {
      recommendations.push(
        `Average effort per task (${avgEffort.toFixed(1)} mins) approaching limit (${limits.limits.est_local_effort_mins?.max || 60} mins). Break down larger tasks.`
      );
    }
  }

  // Overall health
  if (recommendations.length === 0) {
    recommendations.push('All metrics look good. Continue current practices.');
  }

  recommendations.forEach((rec, idx) => {
    markdown += `${idx + 1}. ${rec}\n`;
  });

  markdown += `

---

**Report Version:** 1.0
**Data Sources:**
- .claude/backlog.json
- .claude/config/atomic-limits.json
- .claude/logs/local-model-tasks.log
`;

  // Write report
  try {
    fs.writeFileSync(reportPath, markdown, 'utf-8');
    console.log(`Report generated: ${reportPath}`);
    return true;
  } catch (error) {
    console.error(`Failed to write report: ${error.message}`);
    return false;
  }
}

const success = generateReport();
process.exit(success ? 0 : 1);
