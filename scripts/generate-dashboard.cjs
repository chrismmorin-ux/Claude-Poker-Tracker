#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DATA_SOURCES = {
  backlog: '.claude/backlog.json',
  taskLog: '.claude/logs/local-model-tasks.log',
  patterns: '.claude/learning/failure-patterns.json',
  violations: '.claude/.delegation-violations.json',
  metrics: '.claude/metrics/delegation.json',
  projects: '.claude/projects.json',
  audits: '.claude/audits/registry.json',
  sessionBudget: '.claude/.session-budget.json',
  sessionHistory: '.claude/data/session-history.json'
};

// Helper to run shell commands and get output
function runCommand(cmd) {
  try {
    const { execSync } = require('child_process');
    return execSync(cmd, { encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return null;
  }
}

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
    projects: loadFile(DATA_SOURCES.projects, { active: [], completed: [] }),
    audits: loadFile(DATA_SOURCES.audits, { audits: [] }),
    sessionBudget: loadFile(DATA_SOURCES.sessionBudget, { budget: { total: 30000, used: 0 }, breakdown: {} }),
    sessionHistory: loadFile(DATA_SOURCES.sessionHistory, { sessions: [], aggregateMetrics: {} })
  };
}

function getTestStatus() {
  // Check for recent test results
  const testTimestamp = path.join(process.cwd(), '.claude/metrics/test-pass-timestamp.txt');
  let lastRun = null;
  let passed = null;
  let failed = 0;

  try {
    if (fs.existsSync(testTimestamp)) {
      const content = fs.readFileSync(testTimestamp, 'utf8').trim();
      lastRun = new Date(content);
    }
  } catch {}

  // Check for test results from smart-test-runner output
  const testResultsPath = path.join(process.cwd(), '.claude/metrics/last-test-results.json');
  try {
    if (fs.existsSync(testResultsPath)) {
      const results = JSON.parse(fs.readFileSync(testResultsPath, 'utf8'));
      passed = results.passed || 0;
      failed = results.failed || 0;
      if (results.timestamp) lastRun = new Date(results.timestamp);
    }
  } catch {}

  // Calculate time since last run
  let timeSince = null;
  if (lastRun) {
    const diff = Date.now() - lastRun.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) timeSince = `${days}d ago`;
    else if (hours > 0) timeSince = `${hours}h ago`;
    else timeSince = 'Recently';
  }

  return { lastRun, timeSince, passed, failed };
}

function getGitStatus() {
  // Windows-compatible git commands
  const status = runCommand('git status --porcelain');
  const branch = runCommand('git branch --show-current');
  const ahead = runCommand('git rev-list --count @{u}..HEAD') || '0';
  const behind = runCommand('git rev-list --count HEAD..@{u}') || '0';
  const lastCommit = runCommand('git log -1 --format=%s');
  const lastCommitTime = runCommand('git log -1 --format=%cr');

  const uncommitted = status ? status.split('\n').filter(Boolean).length : 0;

  return {
    branch: branch || 'unknown',
    uncommitted,
    ahead: parseInt(ahead) || 0,
    behind: parseInt(behind) || 0,
    lastCommit: lastCommit || null,
    lastCommitTime: lastCommitTime || null
  };
}

function getTechDebt() {
  // Windows-compatible: use git grep which works cross-platform
  const todoResult = runCommand('git grep -c "TODO" -- "*.js" "*.jsx"');
  const fixmeResult = runCommand('git grep -c "FIXME" -- "*.js" "*.jsx"');

  // Count TODOs from git grep output (each line is file:count)
  let todos = 0;
  let fixmes = 0;
  if (todoResult) {
    todos = todoResult.split('\n').reduce((sum, line) => {
      const match = line.match(/:(\d+)$/);
      return sum + (match ? parseInt(match[1]) : 0);
    }, 0);
  }
  if (fixmeResult) {
    fixmes = fixmeResult.split('\n').reduce((sum, line) => {
      const match = line.match(/:(\d+)$/);
      return sum + (match ? parseInt(match[1]) : 0);
    }, 0);
  }

  // Large files - check PokerTracker.jsx which we know is large
  let largeFiles = 0;
  try {
    const pokerTrackerPath = path.join(process.cwd(), 'src', 'PokerTracker.jsx');
    if (fs.existsSync(pokerTrackerPath)) {
      const lines = fs.readFileSync(pokerTrackerPath, 'utf8').split('\n').length;
      if (lines > 400) largeFiles++;
    }
  } catch {}

  return {
    todos,
    fixmes,
    largeFiles
  };
}

function getDependencyStatus() {
  // Windows-compatible: npm outdated --json returns empty on no outdated, or JSON on outdated
  const outdated = runCommand('npm outdated --json');
  let outdatedCount = 0;
  let majorUpdates = 0;
  let securityIssues = 0;

  if (outdated && outdated.trim()) {
    try {
      const parsed = JSON.parse(outdated);
      outdatedCount = Object.keys(parsed).length;
      majorUpdates = Object.values(parsed).filter(d => {
        const current = (d.current || '').split('.')[0];
        const latest = (d.latest || '').split('.')[0];
        return current !== latest;
      }).length;
    } catch {}
  }

  // Check for security vulnerabilities (npm audit)
  const auditResult = runCommand('npm audit --json');
  if (auditResult && auditResult.trim()) {
    try {
      const audit = JSON.parse(auditResult);
      // npm audit JSON format varies by version
      if (audit.metadata && audit.metadata.vulnerabilities) {
        securityIssues = audit.metadata.vulnerabilities.high + audit.metadata.vulnerabilities.critical;
      } else if (audit.vulnerabilities) {
        securityIssues = Object.values(audit.vulnerabilities).filter(v =>
          v.severity === 'high' || v.severity === 'critical'
        ).length;
      }
    } catch {}
  }

  return { outdatedCount, majorUpdates, securityIssues };
}

// Status emoji helpers
function getStatusEmoji(status) {
  // Green = good, Yellow = attention, Red = action needed
  if (status === 'good' || status === 'complete' || status === 'resolved') return '🟢';
  if (status === 'warning' || status === 'in_progress' || status === 'active') return '🟡';
  if (status === 'error' || status === 'blocked' || status === 'critical') return '🔴';
  return '⚪';
}

function getProjectHealth(project) {
  const progress = (project.phasesComplete || 0) / (project.phases || 1);
  if (progress >= 1) return { emoji: '🟢', status: 'Complete', action: null };
  if (progress >= 0.5) return { emoji: '🟢', status: 'On track', action: null };
  if (progress > 0) return { emoji: '🟡', status: 'In progress', action: 'Continue work' };
  return { emoji: '🟡', status: 'Not started', action: 'Begin first phase' };
}

function getAuditSeverityEmoji(severity) {
  if (severity === 'critical') return '🔴';
  if (severity === 'high') return '🔴';
  if (severity === 'medium') return '🟡';
  return '🟢';
}

function calculateMetrics(data) {
  const tasks = data.backlog.tasks || [];
  const taskLog = data.taskLog || [];
  const patterns = data.patterns.patterns || [];
  const violations = data.violations.violations || [];
  const now = new Date();

  // Task counts
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const failedTasks = tasks.filter(t => t.status === 'failed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const openTasks = tasks.filter(t => t.status === 'open').length;

  // Detect stale in-progress tasks (no update in 24+ hours)
  const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours
  const staleTasks = tasks.filter(t => {
    if (t.status !== 'in_progress') return false;
    const updated = t.updated_at || t.created_at;
    if (!updated) return true; // No timestamp = assume stale
    return (now - new Date(updated)) > staleThreshold;
  });

  // Success rate
  const attemptedTasks = completedTasks + failedTasks;
  const successRate = attemptedTasks > 0 ? Math.round((completedTasks / attemptedTasks) * 100) : 100;

  // Compliance
  const totalDelegations = data.metrics.decisions?.length || 0;
  const violationCount = violations.length;
  const complianceRate = totalDelegations > 0 ? Math.round(((totalDelegations - violationCount) / totalDelegations) * 100) : 100;

  // Pattern tracking
  const activePatterns = patterns.filter(p => p.mitigation_status !== 'resolved').length;
  const mitigatedPatterns = patterns.filter(p => p.mitigation_status === 'resolved').length;
  const patternScore = patterns.length > 0 ? Math.round((mitigatedPatterns / patterns.length) * 100) : 100;

  // Health score
  const activeScore = totalTasks > 0 ? Math.min(100, Math.round((inProgressTasks / Math.max(1, totalTasks * 0.1)) * 100)) : 50;
  const healthScore = Math.round(successRate * 0.4 + complianceRate * 0.3 + patternScore * 0.2 + activeScore * 0.1);

  // Time period analysis
  const oldestLog = taskLog.length > 0 ? taskLog[0].timestamp : null;
  const newestLog = taskLog.length > 0 ? taskLog[taskLog.length - 1].timestamp : null;

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
    staleTasks: staleTasks.length,
    staleTaskIds: staleTasks.map(t => t.id),
    violationCount,
    activePatterns,
    mitigatedPatterns,
    taskLogEntries: taskLog.length,
    oldestLog,
    newestLog,
    patterns
  };
}

function getHealthEmoji(score) {
  if (score >= 80) return '🟢';
  if (score >= 60) return '🟡';
  return '🔴';
}

function getTimePeriod(oldest, newest) {
  if (!oldest || !newest) return 'No activity recorded yet';
  const start = new Date(oldest);
  const end = new Date(newest);
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  if (days <= 1) return 'Today';
  if (days <= 7) return `Last ${days} days`;
  return `Last ${Math.ceil(days / 7)} weeks`;
}

function generateMarkdown(data, metrics) {
  const timestamp = new Date().toISOString().split('T')[0]; // Just date
  const projects = data.projects;
  const timePeriod = getTimePeriod(metrics.oldestLog, metrics.newestLog);

  // Determine what needs attention
  const alerts = [];
  if (metrics.staleTasks > 0) {
    alerts.push({ type: 'stale', msg: `${metrics.staleTasks} stale task(s) need cleanup`, action: 'Run `/backlog` to review' });
  }
  if (metrics.failedTasks > 0) {
    alerts.push({ type: 'failed', msg: `${metrics.failedTasks} failed task(s)`, action: 'Investigate failures or clear them' });
  }
  if (metrics.activePatterns > 0) {
    alerts.push({ type: 'patterns', msg: `${metrics.activePatterns} unresolved failure pattern(s)`, action: 'Review patterns to prevent repeat issues' });
  }
  if (metrics.violationCount > 0 && metrics.complianceRate < 90) {
    alerts.push({ type: 'compliance', msg: `Compliance at ${metrics.complianceRate}%`, action: 'Review delegation workflow' });
  }

  let md = `# 📊 System Health Dashboard
**${timestamp}** · Reporting: **${timePeriod}**

`;

  // Health Score Hero
  const healthStatus = metrics.healthScore >= 80 ? 'System healthy' :
                       metrics.healthScore >= 60 ? 'Minor issues' : 'Needs attention';
  md += `## ${getHealthEmoji(metrics.healthScore)} Health: ${metrics.healthScore}/100 — ${healthStatus}

`;

  // Alerts section (if any)
  if (alerts.length > 0) {
    md += `### ⚠️ Needs Attention

`;
    for (const alert of alerts) {
      md += `- **${alert.msg}** → ${alert.action}\n`;
    }
    md += '\n';
  } else {
    md += `### ✅ All Clear — No issues requiring attention\n\n`;
  }

  // Get additional metrics
  const git = getGitStatus();
  const techDebt = getTechDebt();
  const sessionBudget = data.sessionBudget?.budget || { total: 30000, used: 0 };
  const budgetUsedPct = Math.round((sessionBudget.used / sessionBudget.total) * 100);

  // === SESSION & TOKEN EFFICIENCY ===
  const budgetEmoji = budgetUsedPct < 50 ? '🟢' : budgetUsedPct < 80 ? '🟡' : '🔴';
  const budgetRemaining = sessionBudget.total - sessionBudget.used;

  md += `---

## 💰 Session & Token Efficiency

> Tracks API usage this session. Lower usage = more efficient = lower cost.

| Metric | Status | Good? | Meaning |
|--------|--------|-------|---------|
| Budget Used | **${sessionBudget.used.toLocaleString()}/${sessionBudget.total.toLocaleString()}** | ${budgetEmoji} | ${budgetUsedPct}% of session budget |
| Remaining | **${budgetRemaining.toLocaleString()} tokens** | ${budgetEmoji} | ${budgetUsedPct < 50 ? 'Plenty left' : budgetUsedPct < 80 ? 'Watch usage' : 'Nearly exhausted'} |

`;

  // === LOCAL MODEL DELEGATION ===
  const taskEmoji = metrics.completedTasks === metrics.totalTasks ? '🟢' :
                    metrics.completedTasks >= metrics.totalTasks * 0.5 ? '🟡' : '🔴';
  const successEmoji = metrics.successRate >= 90 ? '🟢' : metrics.successRate >= 70 ? '🟡' : '🔴';
  const complianceEmoji = metrics.complianceRate >= 90 ? '🟢' : metrics.complianceRate >= 70 ? '🟡' : '🔴';

  md += `---

## 🤖 Local Model Delegation

> Tasks delegated to local AI (DeepSeek/Qwen) instead of Claude API. Higher delegation = lower cost.

| Metric | Status | Good? | Meaning |
|--------|--------|-------|---------|
| Tasks Done | **${metrics.completedTasks}/${metrics.totalTasks}** | ${taskEmoji} | Delegated work items completed |
| Success Rate | **${metrics.successRate}%** | ${successEmoji} | ${metrics.successRate >= 90 ? 'Great!' : metrics.successRate >= 70 ? 'Some failures' : 'Many failures - investigate'} |
| Compliance | **${metrics.complianceRate}%** | ${complianceEmoji} | ${metrics.complianceRate >= 90 ? 'Following rules' : 'Review delegation workflow'} |

`;

  // === GIT STATUS ===
  const gitEmoji = git.uncommitted === 0 && git.ahead === 0 ? '🟢' :
                   git.uncommitted > 0 ? '🟡' : '🟢';
  const pushNeeded = git.ahead > 0;
  const pullNeeded = git.behind > 0;

  md += `---

## 🔀 Git Status

> Current repository state. Green = synced, Yellow = changes pending.

| Metric | Status | Good? | Action |
|--------|--------|-------|--------|
| Branch | **${git.branch}** | ⚪ | — |
| Uncommitted | **${git.uncommitted} files** | ${git.uncommitted === 0 ? '🟢' : '🟡'} | ${git.uncommitted > 0 ? 'Commit changes' : 'Clean'} |
| Push/Pull | **↑${git.ahead} ↓${git.behind}** | ${pushNeeded || pullNeeded ? '🟡' : '🟢'} | ${pushNeeded ? 'Push needed' : pullNeeded ? 'Pull needed' : 'Synced'} |
| Last Commit | ${git.lastCommit ? `"${git.lastCommit.substring(0, 40)}..."` : 'None'} | ⚪ | ${git.lastCommitTime || '—'} |

`;

  // === TEST STATUS ===
  const testStatus = getTestStatus();
  const testEmoji = testStatus.failed > 0 ? '🔴' : testStatus.passed > 0 ? '🟢' : '⚪';
  const testCoverageEmoji = '⚪'; // Would need coverage tool integration

  md += `---

## 🧪 Test Status

> Shows last test run results. Green = passing, Red = failures need attention.

| Metric | Status | Good? | Action |
|--------|--------|-------|--------|
| Last Run | **${testStatus.timeSince || 'Never'}** | ${testStatus.timeSince ? '🟢' : '🟡'} | ${testStatus.timeSince ? '—' : 'Run tests'} |
| Passed | **${testStatus.passed !== null ? testStatus.passed : '?'}** | ${testEmoji} | ${testStatus.passed > 0 ? 'Tests healthy' : 'Run tests to verify'} |
| Failed | **${testStatus.failed}** | ${testStatus.failed === 0 ? '🟢' : '🔴'} | ${testStatus.failed > 0 ? 'Fix failing tests!' : 'All passing'} |

`;

  // === DEPENDENCIES ===
  const deps = getDependencyStatus();
  const depsEmoji = deps.securityIssues > 0 ? '🔴' : deps.majorUpdates > 0 ? '🟡' : deps.outdatedCount > 0 ? '🟡' : '🟢';

  md += `---

## 📦 Dependencies

> Package health. Security issues are critical, outdated packages may have fixes.

| Metric | Count | Good? | Action |
|--------|-------|-------|--------|
| Security Issues | **${deps.securityIssues}** | ${deps.securityIssues === 0 ? '🟢' : '🔴'} | ${deps.securityIssues > 0 ? 'Run `npm audit fix`' : 'Secure'} |
| Major Updates | **${deps.majorUpdates}** | ${deps.majorUpdates === 0 ? '🟢' : '🟡'} | ${deps.majorUpdates > 0 ? 'Review changelogs' : 'Up to date'} |
| Outdated Total | **${deps.outdatedCount}** | ${deps.outdatedCount === 0 ? '🟢' : '🟡'} | ${deps.outdatedCount > 0 ? 'Run `npm outdated`' : 'Current'} |

`;

  // === TECHNICAL DEBT ===
  const debtEmoji = (techDebt.todos + techDebt.fixmes) === 0 ? '🟢' :
                    (techDebt.todos + techDebt.fixmes) < 10 ? '🟡' : '🔴';
  const largeFilesEmoji = techDebt.largeFiles === 0 ? '🟢' : techDebt.largeFiles < 3 ? '🟡' : '🔴';

  md += `---

## 🚧 Technical Debt

> Code markers and complexity. Lower = cleaner codebase.

| Metric | Count | Good? | Action |
|--------|-------|-------|--------|
| TODOs | **${techDebt.todos}** | ${techDebt.todos === 0 ? '🟢' : techDebt.todos < 5 ? '🟡' : '🔴'} | ${techDebt.todos > 0 ? 'Review and address' : 'Clean!'} |
| FIXMEs | **${techDebt.fixmes}** | ${techDebt.fixmes === 0 ? '🟢' : '🔴'} | ${techDebt.fixmes > 0 ? 'Priority fixes needed' : 'None'} |
| Large Files (>400 lines) | **${techDebt.largeFiles}** | ${largeFilesEmoji} | ${techDebt.largeFiles > 0 ? 'Consider splitting' : 'Good size'} |

`;

  // Task Status with context
  md += `---

## 🔧 Task Queue

`;

  if (metrics.inProgressTasks === 0 && metrics.openTasks === 0) {
    md += `**Queue is clear!** No pending work items.\n\n`;
  } else {
    if (metrics.staleTasks > 0) {
      md += `> ⚠️ **${metrics.staleTasks} tasks stuck "in progress"** — These may be from interrupted sessions. Run \`node scripts/dispatcher.cjs status\` to review.\n\n`;
    }

    md += `| Status | Count | What this means |
|--------|-------|-----------------|
| 🔄 In Progress | ${metrics.inProgressTasks} | ${metrics.staleTasks > 0 ? `⚠️ ${metrics.staleTasks} may be stale` : 'Currently being worked on'} |
| 📋 Open | ${metrics.openTasks} | Ready to start |
| ✅ Done | ${metrics.completedTasks} | Completed successfully |
| ❌ Failed | ${metrics.failedTasks} | ${metrics.failedTasks > 0 ? 'Need investigation' : 'None'} |

`;
  }

  // Learning Engine
  const patterns = data.patterns.patterns || [];
  if (patterns.length > 0) {
    md += `---

## 🧠 Known Issues Being Tracked

> These are recurring problems. Once fixed, they prevent future failures.

| Problem | Times Seen | Status |
|---------|-----------|--------|
`;
    for (const p of patterns) {
      const count = Array.isArray(p.occurrences) ? p.occurrences.length : (p.occurrences || 0);
      const status = p.mitigation_status === 'resolved' ? '✅ Fixed' : '⚠️ Active';
      md += `| ${p.name} | ${count} | ${status} |\n`;
    }
    md += '\n';
  }

  // Projects section with health indicators
  const activeProjects = projects.active || [];
  const completedProjects = (projects.completed || []).slice(0, 3);

  md += `---

## 📁 Projects

`;

  if (activeProjects.length === 0) {
    md += `🟢 **No active projects** — All caught up!\n\n`;
  } else {
    // Count projects by status
    const notStarted = activeProjects.filter(p => (p.phasesComplete || 0) === 0).length;
    const inProgress = activeProjects.filter(p => (p.phasesComplete || 0) > 0 && (p.phasesComplete || 0) < p.phases).length;
    const almostDone = activeProjects.filter(p => (p.phasesComplete || 0) >= p.phases).length;

    if (notStarted > 0) {
      md += `> 🟡 **${notStarted} project(s) not yet started** — Select from startup menu to begin\n\n`;
    }

    md += `| Project | Progress | Status | Action |\n`;
    md += `|---------|----------|--------|--------|\n`;

    for (const p of activeProjects) {
      const health = getProjectHealth(p);
      const progress = `${p.phasesComplete || 0}/${p.phases} phases`;
      const action = health.action || '—';
      // Truncate long names
      const name = p.name.length > 35 ? p.name.substring(0, 32) + '...' : p.name;
      md += `| ${health.emoji} ${name} | ${progress} | ${health.status} | ${action} |\n`;
    }
    md += '\n';
  }

  if (completedProjects.length > 0) {
    md += `**✅ Recently Completed:** ${completedProjects.map(p => p.name).join(', ')}\n\n`;
  }

  // Audits section
  const audits = data.audits.audits || [];
  const pendingAudits = audits.filter(a => a.status === 'pending');
  const criticalAudits = pendingAudits.filter(a => ['critical', 'high'].includes(a.severity));

  md += `---

## 🔍 Audits

`;

  if (pendingAudits.length === 0) {
    md += `🟢 **No pending audits** — System reviewed and clear!\n\n`;
  } else {
    if (criticalAudits.length > 0) {
      md += `> 🔴 **${criticalAudits.length} critical/high severity audit(s)** — Address these first!\n\n`;
    }

    md += `| Audit | Severity | Status | Action |\n`;
    md += `|-------|----------|--------|--------|\n`;

    for (const a of pendingAudits.slice(0, 5)) {
      const emoji = getAuditSeverityEmoji(a.severity);
      const name = (a.name || a.id || 'Unknown').substring(0, 30);
      const action = a.severity === 'critical' || a.severity === 'high' ? 'Review now' : 'Review when able';
      md += `| ${emoji} ${name} | ${a.severity || 'unknown'} | ${a.status} | ${action} |\n`;
    }

    if (pendingAudits.length > 5) {
      md += `| ... | +${pendingAudits.length - 5} more | — | Run \`/audit-status\` |\n`;
    }
    md += '\n';
  }

  // Quick actions footer
  md += `---

## 🚀 Quick Actions

| Want to... | Command |
|------------|---------|
| See full task list | \`node scripts/dispatcher.cjs status\` |
| Clean up stale tasks | \`/backlog\` then mark as done/failed |
| Start dev server | Select **[7]** from menu |
| Run next task | \`node scripts/dispatcher.cjs assign-next\` |

*Last refreshed: ${new Date().toLocaleTimeString()}*
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
