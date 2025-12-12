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

  // Get additional metrics early for action items
  const git = getGitStatus();
  const techDebt = getTechDebt();
  const testStatus = getTestStatus();
  const deps = getDependencyStatus();
  const sessionBudget = data.sessionBudget?.budget || { total: 30000, used: 0 };
  const breakdown = data.sessionBudget?.breakdown || { reads: 0, agents: 0, edits: 0, searches: 0, other: 0 };
  const budgetUsedPct = Math.round((sessionBudget.used / sessionBudget.total) * 100);
  const audits = data.audits.audits || [];
  const pendingAudits = audits.filter(a => a.status === 'pending');
  const criticalAudits = pendingAudits.filter(a => ['critical', 'high'].includes(a.severity));
  const patterns = data.patterns.patterns || [];

  // Collect action items (red indicators) for detail section
  const actionItems = [];

  // Check task queue completion
  const taskQueuePct = metrics.totalTasks > 0 ? Math.round((metrics.completedTasks / metrics.totalTasks) * 100) : 100;
  const taskEmoji = taskQueuePct >= 100 ? '🟢' : taskQueuePct >= 50 ? '🟡' : '🔴';
  if (taskQueuePct < 50) {
    actionItems.push({
      metric: 'Task Queue',
      value: `${metrics.completedTasks}/${metrics.totalTasks} (${taskQueuePct}%)`,
      explanation: `${metrics.totalTasks - metrics.completedTasks} tasks remain in backlog. These are queued for local model execution.`,
      action: 'Run `node scripts/dispatcher.cjs assign-next` to process tasks, or `/backlog` to review and prioritize.'
    });
  }

  if (metrics.staleTasks > 0) {
    actionItems.push({
      metric: 'Stale Tasks',
      value: `${metrics.staleTasks} stuck`,
      explanation: 'Tasks marked "in progress" for 24+ hours, likely from interrupted sessions.',
      action: 'Run `/backlog` to mark as done/failed, or `node scripts/dispatcher.cjs status` to review.'
    });
  }

  if (metrics.failedTasks > 0) {
    actionItems.push({
      metric: 'Failed Tasks',
      value: `${metrics.failedTasks} failed`,
      explanation: 'Local model tasks that encountered errors during execution.',
      action: 'Check `.claude/logs/local-model-tasks.log` for error details, then retry or decompose further.'
    });
  }

  if (testStatus.failed > 0) {
    actionItems.push({
      metric: 'Test Failures',
      value: `${testStatus.failed} failing`,
      explanation: 'Unit tests are failing, which may indicate bugs or regressions.',
      action: 'Run `npm test` to see details, fix failures before committing.'
    });
  }

  if (deps.securityIssues > 0) {
    actionItems.push({
      metric: 'Security Issues',
      value: `${deps.securityIssues} vulnerabilities`,
      explanation: 'High/critical npm vulnerabilities detected that could pose security risks.',
      action: 'Run `npm audit` for details, then `npm audit fix` to auto-fix.'
    });
  }

  if (criticalAudits.length > 0) {
    actionItems.push({
      metric: 'Critical Audits',
      value: `${criticalAudits.length} pending`,
      explanation: 'High-priority code reviews flagged for issues like bugs, security, or architecture.',
      action: 'Run `/audit-status` to see details and address critical items first.'
    });
  }

  if (budgetUsedPct >= 80) {
    actionItems.push({
      metric: 'Token Budget',
      value: `${budgetUsedPct}% used`,
      explanation: 'Session token budget nearly exhausted. Further operations may be blocked.',
      action: 'Start a new session, or delegate remaining work to local models.'
    });
  }

  // Token breakdown analysis - flag high usage areas
  const totalBreakdown = breakdown.reads + breakdown.agents + breakdown.edits + breakdown.searches + breakdown.other;
  if (totalBreakdown > 0) {
    const readsPct = Math.round((breakdown.reads / totalBreakdown) * 100);
    const agentsPct = Math.round((breakdown.agents / totalBreakdown) * 100);
    if (readsPct > 50) {
      actionItems.push({
        metric: 'High File Reading',
        value: `${readsPct}% of tokens`,
        explanation: 'Most tokens spent reading files. Consider using index/context files first.',
        action: 'Read `.claude/index/*.md` before source files. Use Grep to find sections before full reads.'
      });
    }
    if (agentsPct > 40) {
      actionItems.push({
        metric: 'High Agent Usage',
        value: `${agentsPct}% of tokens`,
        explanation: 'Agents consume many tokens. Consider direct tool use for simple lookups.',
        action: 'Use Grep/Glob directly for "where is X" queries instead of Explore agent.'
      });
    }
  }

  // Determine issues for vertical list
  const issues = [];
  if (metrics.staleTasks > 0) {
    issues.push({ msg: `${metrics.staleTasks} stale task(s) need cleanup`, action: '/backlog' });
  }
  if (metrics.failedTasks > 0) {
    issues.push({ msg: `${metrics.failedTasks} failed task(s)`, action: 'Check logs' });
  }
  if (metrics.activePatterns > 0) {
    issues.push({ msg: `${metrics.activePatterns} unresolved failure pattern(s)`, action: 'See Known Issues' });
  }
  if (git.uncommitted > 0) {
    issues.push({ msg: `${git.uncommitted} uncommitted file(s)`, action: 'git commit' });
  }

  let md = `# 📊 System Health Dashboard
**${timestamp}** · Reporting: **${timePeriod}**

`;

  // Health Score with explanation
  const healthStatus = metrics.healthScore >= 80 ? 'System healthy' :
                       metrics.healthScore >= 60 ? 'Minor issues' : 'Needs attention';
  md += `## ${getHealthEmoji(metrics.healthScore)} Health: ${metrics.healthScore}/100 — ${healthStatus} · *40% success + 30% compliance + 20% patterns + 10% activity*

`;

  // Issues section (vertical)
  if (issues.length > 0) {
    md += `### ⚠️ Issues\n`;
    for (const issue of issues) {
      md += `- ${issue.msg} → \`${issue.action}\`\n`;
    }
    md += '\n';
  }

  // === COMBINED: SESSION, TOKENS, & TASKS ===
  const budgetEmoji = budgetUsedPct < 50 ? '🟢' : budgetUsedPct < 80 ? '🟡' : '🔴';
  const budgetRemaining = sessionBudget.total - sessionBudget.used;
  const successEmoji = metrics.successRate >= 90 ? '🟢' : metrics.successRate >= 70 ? '🟡' : '🔴';
  const complianceEmoji = metrics.complianceRate >= 90 ? '🟢' : metrics.complianceRate >= 70 ? '🟡' : '🔴';

  // Token breakdown percentages
  const readsPct = totalBreakdown > 0 ? Math.round((breakdown.reads / totalBreakdown) * 100) : 0;
  const agentsPct = totalBreakdown > 0 ? Math.round((breakdown.agents / totalBreakdown) * 100) : 0;
  const editsPct = totalBreakdown > 0 ? Math.round((breakdown.edits / totalBreakdown) * 100) : 0;
  const searchesPct = totalBreakdown > 0 ? Math.round((breakdown.searches / totalBreakdown) * 100) : 0;
  const otherPct = totalBreakdown > 0 ? Math.round((breakdown.other / totalBreakdown) * 100) : 0;

  // Status for token breakdown (flag high usage)
  const readsStatus = readsPct > 50 ? '🔴' : readsPct > 30 ? '🟡' : '🟢';
  const agentsStatus = agentsPct > 40 ? '🔴' : agentsPct > 25 ? '🟡' : '🟢';
  const editsStatus = '🟢'; // Edits are productive
  const searchesStatus = searchesPct > 30 ? '🟡' : '🟢';

  md += `---

## 💰 Session & Delegation · *This session*

| Metric | Value | | |
|--------|-------|---|---|
| **── Tokens ──** | | | |
| Budget | ${sessionBudget.used.toLocaleString()}/${sessionBudget.total.toLocaleString()} | ${budgetEmoji} | *API cost this session* |
| Remaining | ${budgetRemaining.toLocaleString()} | ${budgetEmoji} | *Before warning/block* |
| **── Token Breakdown ──** | | | |
| Reads | ${breakdown.reads.toLocaleString()} (${readsPct}%) | ${readsStatus} | *File reading - keep <30%* |
| Agents | ${breakdown.agents.toLocaleString()} (${agentsPct}%) | ${agentsStatus} | *Subagent tasks - keep <25%* |
| Edits | ${breakdown.edits.toLocaleString()} (${editsPct}%) | ${editsStatus} | *Code changes - productive* |
| Searches | ${breakdown.searches.toLocaleString()} (${searchesPct}%) | ${searchesStatus} | *Grep/Glob/Web - normal* |
| Other | ${breakdown.other.toLocaleString()} (${otherPct}%) | ⚪ | *Misc operations* |
| **── Local Model Tasks ──** | | | |
| Queue | ${metrics.completedTasks}/${metrics.totalTasks} (${taskQueuePct}%) | ${taskEmoji} | *Backlog completion* |
| Success | ${metrics.successRate}% | ${successEmoji} | *Of attempted tasks* |
| Compliance | ${metrics.complianceRate}% | ${complianceEmoji} | *Following delegation rules* |
| Pending | ${metrics.openTasks} open, ${metrics.inProgressTasks} active${metrics.staleTasks > 0 ? `, ${metrics.staleTasks} stale` : ''} | ${metrics.staleTasks > 0 ? '🟡' : '🟢'} | *Work items queued* |

`;

  // === COMBINED: CODEBASE STATUS ===
  const testEmoji = testStatus.failed > 0 ? '🔴' : testStatus.passed > 0 ? '🟢' : '⚪';
  const pushNeeded = git.ahead > 0;
  const pullNeeded = git.behind > 0;
  const debtEmoji = (techDebt.todos + techDebt.fixmes) === 0 ? '🟢' :
                    (techDebt.todos + techDebt.fixmes) < 10 ? '🟡' : '🔴';

  // Find last completed audit date
  const completedAudits = audits.filter(a => a.status === 'completed' || a.status === 'done');
  let lastAuditDate = 'Never';
  if (completedAudits.length > 0) {
    const sorted = completedAudits.sort((a, b) => new Date(b.completed_at || b.updated_at || 0) - new Date(a.completed_at || a.updated_at || 0));
    const lastDate = sorted[0].completed_at || sorted[0].updated_at;
    if (lastDate) {
      const diff = Date.now() - new Date(lastDate).getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days === 0) lastAuditDate = 'Today';
      else if (days === 1) lastAuditDate = 'Yesterday';
      else if (days < 7) lastAuditDate = `${days}d ago`;
      else lastAuditDate = `${Math.floor(days / 7)}w ago`;
    }
  }

  md += `---

## 🔀 Codebase Health · *Last audit: ${lastAuditDate}*

| Metric | Value | | |
|--------|-------|---|---|
| **── Git ──** | | | |
| Branch | ${git.branch} | ⚪ | *Current working branch* |
| Uncommitted | ${git.uncommitted} files | ${git.uncommitted === 0 ? '🟢' : '🟡'} | *Changes not committed* |
| Sync | ↑${git.ahead} ↓${git.behind} | ${pushNeeded || pullNeeded ? '🟡' : '🟢'} | *Ahead/behind remote* |
| **── Quality ──** | | | |
| Tests | ${testStatus.passed !== null ? testStatus.passed : '?'} pass, ${testStatus.failed} fail | ${testEmoji} | *${testStatus.timeSince || 'Never run'}* |
| Security | ${deps.securityIssues} vulnerabilities | ${deps.securityIssues === 0 ? '🟢' : '🔴'} | *npm audit high/critical* |
| Outdated | ${deps.outdatedCount} packages | ${deps.outdatedCount === 0 ? '🟢' : '🟡'} | *Behind latest version* |
| **── Debt ──** | | | |
| Markers | ${techDebt.todos} TODO, ${techDebt.fixmes} FIXME | ${debtEmoji} | *Code annotations* |
| Large Files | ${techDebt.largeFiles} | ${techDebt.largeFiles === 0 ? '🟢' : '🟡'} | *>400 lines, split candidate* |

`;

  // Learning Engine - Known Issues
  if (patterns.length > 0) {
    md += `---

## 🧠 Known Issues · *Recurring problems by local models tracked by learning engine*

| Problem | Seen | Status |
|---------|------|--------|
`;
    for (const p of patterns) {
      const count = Array.isArray(p.occurrences) ? p.occurrences.length : (p.occurrences || 0);
      const status = p.mitigation_status === 'resolved' ? '✅ Fixed' : '⚠️ Active';
      md += `| ${p.name} | ${count}x | ${status} |\n`;
    }
    md += '\n';
  }

  // Projects section
  const activeProjects = projects.active || [];
  const completedProjects = (projects.completed || []).slice(0, 3);

  md += `---

## 📁 Projects · *Multi-phase initiatives tracked across sessions*

`;

  if (activeProjects.length === 0) {
    md += `🟢 **No active projects**\n\n`;
  } else {
    md += `| Project | Progress | Status |
|---------|----------|--------|
`;
    for (const p of activeProjects) {
      const health = getProjectHealth(p);
      const progress = `${p.phasesComplete || 0}/${p.phases}`;
      const name = p.name.length > 40 ? p.name.substring(0, 37) + '...' : p.name;
      md += `| ${health.emoji} ${name} | ${progress} | ${health.status} |\n`;
    }
    md += '\n';
  }

  if (completedProjects.length > 0) {
    md += `**Recently Completed:** ${completedProjects.map(p => p.name).join(', ')}\n\n`;
  }

  // Audits section
  md += `---

## 🔍 Audits · *Pending code reviews and quality checks*

| Audit | Severity | Status |
|-------|----------|--------|
`;

  if (pendingAudits.length === 0) {
    md += `| 🟢 No pending audits | — | Clear |\n`;
  } else {
    for (const a of pendingAudits.slice(0, 5)) {
      const emoji = getAuditSeverityEmoji(a.severity);
      const name = (a.name || a.id || 'Unknown').substring(0, 35);
      md += `| ${emoji} ${name} | ${a.severity || 'unknown'} | ${a.status} |\n`;
    }
    if (pendingAudits.length > 5) {
      md += `| ... | +${pendingAudits.length - 5} more | Run \`/audit-status\` |\n`;
    }
  }
  md += '\n';

  // === ACTION ITEMS DETAIL (for red indicators) ===
  if (actionItems.length > 0) {
    md += `---

## 🔴 Action Items · *Details on items needing attention*

`;
    for (const item of actionItems) {
      md += `**${item.metric}: ${item.value}**
    Why: ${item.explanation}
    Fix: ${item.action}

`;
    }
  }

  // Quick actions footer
  md += `---

## 🚀 Quick Actions

| Action | Command |
|--------|---------|
| Process next task | \`node scripts/dispatcher.cjs assign-next\` |
| View task queue | \`node scripts/dispatcher.cjs status\` |
| Clean up backlog | \`/backlog\` |
| Back to menu | \`/menu\` |

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
