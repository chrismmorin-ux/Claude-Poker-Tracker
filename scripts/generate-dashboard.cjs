#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DATA_SOURCES = {
  backlog: '.claude/backlog.json',
  taskLog: '.claude/logs/local-model-tasks.log',
  patterns: '.claude/learning/failure-patterns.json',
  violations: '.claude/.delegation-violations.json',
  metrics: '.claude/metrics/delegation.json',
  projects: '.claude/projects.json'
};

function loadFile(filepath, defaultValue) {
  try {
    const fullPath = path.join(process.cwd(), filepath);
    if (filepath.endsWith('.log')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      return content.trim().split('\n').filter(Boolean).map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
    }
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch {
    return defaultValue;
  }
}

function loadDashboardData() {
  return {
    backlog: loadFile(DATA_SOURCES.backlog, { tasks: [] }),
    taskLog: loadFile(DATA_SOURCES.taskLog, []),
    patterns: loadFile(DATA_SOURCES.patterns, { patterns: [] }),
    violations: loadFile(DATA_SOURCES.violations, { violations: [] }),
    metrics: loadFile(DATA_SOURCES.metrics, { decisions: [] }),
    projects: loadFile(DATA_SOURCES.projects, { active: [], completed: [] })
  };
}

function calculateMetrics(data) {
  const tasks = data.backlog.tasks || [];
  const taskLog = data.taskLog || [];
  const patterns = data.patterns.patterns || [];
  const violations = data.violations.violations || [];

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const failedTasks = tasks.filter(t => t.status === 'failed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const openTasks = tasks.filter(t => t.status === 'open').length;

  const attemptedTasks = completedTasks + failedTasks;
  const successRate = attemptedTasks > 0 ? Math.round((completedTasks / attemptedTasks) * 100) : 100;

  const totalDelegations = data.metrics.decisions?.length || 0;
  const violationCount = violations.length;
  const complianceRate = totalDelegations > 0 ? Math.round(((totalDelegations - violationCount) / totalDelegations) * 100) : 100;

  const activePatterns = patterns.filter(p => p.mitigation_status !== 'resolved').length;
  const mitigatedPatterns = patterns.filter(p => p.mitigation_status === 'resolved').length;
  const patternScore = patterns.length > 0 ? Math.round((mitigatedPatterns / patterns.length) * 100) : 100;

  const activeScore = totalTasks > 0 ? Math.min(100, Math.round((inProgressTasks / Math.max(1, totalTasks * 0.1)) * 100)) : 50;
  const healthScore = Math.round(successRate * 0.4 + complianceRate * 0.3 + patternScore * 0.2 + activeScore * 0.1);

  return {
    healthScore,
    successRate,
    complianceRate,
    patternScore,
    totalTasks,
    completedTasks,
    failedTasks,
    inProgressTasks,
    openTasks,
    violationCount,
    activePatterns,
    mitigatedPatterns,
    taskLogEntries: taskLog.length
  };
}

function getHealthEmoji(score) {
  if (score >= 80) return '🟢';
  if (score >= 60) return '🟡';
  return '🔴';
}

function generateMarkdown(data, metrics) {
  const timestamp = new Date().toISOString();
  const projects = data.projects;

  let md = `# System Health Dashboard
**Generated:** ${timestamp}

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Health Score | ${getHealthEmoji(metrics.healthScore)} **${metrics.healthScore}/100** |
| Success Rate | ${metrics.successRate}% |
| Compliance | ${metrics.complianceRate}% |
| Pattern Mitigation | ${metrics.patternScore}% |

---

## Task Execution

| Status | Count |
|--------|-------|
| ✅ Completed | ${metrics.completedTasks} |
| 🔄 In Progress | ${metrics.inProgressTasks} |
| 📋 Open | ${metrics.openTasks} |
| ❌ Failed | ${metrics.failedTasks} |
| **Total** | **${metrics.totalTasks}** |

**Task Log Entries:** ${metrics.taskLogEntries}

---

## Learning Engine

### Failure Patterns
`;

  const patterns = data.patterns.patterns || [];
  if (patterns.length === 0) {
    md += '\n*No failure patterns tracked yet.*\n';
  } else {
    md += '\n| ID | Name | Occurrences | Status |\n|-----|------|-------------|--------|\n';
    for (const p of patterns) {
      const status = p.mitigation_status === 'resolved' ? '✅ Resolved' : '⚠️ Active';
      const count = Array.isArray(p.occurrences) ? p.occurrences.length : (p.occurrences || 0);
      md += `| ${p.pattern_id} | ${p.name} | ${count} | ${status} |\n`;
    }
  }

  md += `
---

## Projects

### Active
`;

  const activeProjects = projects.active || [];
  if (activeProjects.length === 0) {
    md += '\n*No active projects.*\n';
  } else {
    for (const p of activeProjects) {
      md += `- **${p.name}** (${p.phasesComplete || 0}/${p.phases} phases)\n`;
    }
  }

  md += `
### Recently Completed
`;

  const completedProjects = (projects.completed || []).slice(0, 5);
  if (completedProjects.length === 0) {
    md += '\n*No completed projects.*\n';
  } else {
    for (const p of completedProjects) {
      md += `- ${p.name} (${p.completedAt || 'unknown'})\n`;
    }
  }

  md += `
---

## Delegation Compliance

| Metric | Value |
|--------|-------|
| Violations | ${metrics.violationCount} |
| Compliance Rate | ${metrics.complianceRate}% |

---

*Dashboard auto-generated. Run \`node scripts/generate-dashboard.cjs\` to refresh.*
`;

  return md;
}

function main() {
  const args = process.argv.slice(2);
  let output = '.claude/DASHBOARD.md';
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output') {
      output = args[++i];
    } else if (args[i] === '--verbose') {
      verbose = true;
    } else if (args[i] === '--help') {
      console.log('Usage: generate-dashboard.cjs [--output <file>] [--verbose]');
      console.log('');
      console.log('Options:');
      console.log('  --output <file>  Output file (default: .claude/DASHBOARD.md)');
      console.log('  --verbose        Print data counts');
      console.log('  --help           Show this help');
      process.exit(0);
    }
  }

  const data = loadDashboardData();

  if (verbose) {
    console.log('Data loaded:');
    console.log(`  Tasks: ${data.backlog.tasks?.length || 0}`);
    console.log(`  Task log entries: ${data.taskLog.length}`);
    console.log(`  Failure patterns: ${data.patterns.patterns?.length || 0}`);
    console.log(`  Violations: ${data.violations.violations?.length || 0}`);
    console.log(`  Active projects: ${data.projects.active?.length || 0}`);
  }

  const metrics = calculateMetrics(data);
  const markdown = generateMarkdown(data, metrics);

  const outputPath = path.join(process.cwd(), output);
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, markdown, 'utf8');
  console.log(`Dashboard generated: ${output}`);
  console.log(`Health Score: ${getHealthEmoji(metrics.healthScore)} ${metrics.healthScore}/100`);
}

module.exports = { loadDashboardData, loadFile, calculateMetrics, generateMarkdown, DATA_SOURCES };

if (require.main === module) {
  main();
}
