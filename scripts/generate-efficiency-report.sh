#!/bin/bash
# Generate Token Efficiency Audit Report
# Populates template with data from session history and rule analysis

HISTORY_FILE=".claude/data/session-history.json"
RULES_FILE=".claude/data/efficiency-rules.json"
TEMPLATE_FILE=".claude/templates/efficiency-audit-report.md"
REPORT_DIR=".claude/reports"

# Ensure report directory exists
mkdir -p "$REPORT_DIR"

# Check required files
if [ ! -f "$HISTORY_FILE" ]; then
  echo "Error: No session history at $HISTORY_FILE"
  exit 1
fi

if [ ! -f "$RULES_FILE" ]; then
  echo "Error: No rules file at $RULES_FILE"
  exit 1
fi

# Generate report filename with timestamp
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
REPORT_FILE="$REPORT_DIR/efficiency-audit-$TIMESTAMP.md"

echo "Generating Token Efficiency Audit Report..."

node -e "
const fs = require('fs');

const history = JSON.parse(fs.readFileSync('$HISTORY_FILE', 'utf8'));
const rules = JSON.parse(fs.readFileSync('$RULES_FILE', 'utf8'));
const sessions = history.sessions;

// Calculate metrics
const agg = history.aggregateMetrics;
const sessionCount = sessions.length;

// Status helpers
const getStatus = (val, target, higherBetter = false) => {
  if (higherBetter) return val >= target ? '✅' : '⚠️';
  return val <= target ? '✅' : '⚠️';
};

// Evaluate rules
const ruleResults = rules.rules.map(rule => {
  const total = sessionCount || 1;
  const rate = sessionCount > 0 ? Math.round((rule.triggerCount / total) * 100) : 0;
  return {
    name: rule.name,
    triggerRate: rate,
    severity: rate >= 50 ? '🔴 HIGH' : rate >= 30 ? '🟡 MEDIUM' : '🟢 LOW',
    recommendation: rate >= 30 ? rule.recommendation : 'No action needed'
  };
});

// Calculate trend
let trendDirection = 'Insufficient data';
let trendPercent = 0;
let hasTrend = false;
let trendInsight = '';

if (sessions.length >= 6) {
  hasTrend = true;
  const recent3 = sessions.slice(0, 3);
  const older3 = sessions.slice(3, 6);
  const recentAvg = recent3.reduce((s, x) => s + (x.tokenBudget?.used || 0), 0) / 3;
  const olderAvg = older3.reduce((s, x) => s + (x.tokenBudget?.used || 0), 0) / 3;
  trendPercent = Math.round(((recentAvg - olderAvg) / olderAvg) * 100);
  trendDirection = trendPercent < 0 ? '📈 Improving' : trendPercent > 5 ? '📉 Degrading' : '➡️ Stable';
  trendInsight = trendPercent < 0
    ? 'Token efficiency is improving. Recent sessions use ' + Math.abs(trendPercent) + '% fewer tokens.'
    : trendPercent > 5
    ? 'Token usage increasing. Review recent sessions for inefficiencies.'
    : 'Token usage is stable. Continue current practices.';
}

// Build recommendations
const recommendations = ruleResults
  .filter(r => r.triggerRate >= 30)
  .map(r => ({
    priority: r.triggerRate >= 50 ? '🔴 HIGH' : '🟡 MEDIUM',
    issue: r.name + ' (' + r.triggerRate + '% trigger rate)',
    action: r.recommendation,
    impact: rules.rules.find(rule => rule.name === r.name)?.estimatedSavings || 'Improved efficiency'
  }));

// Phase distribution
const phases = { preparation: 0, exploration: 0, planning: 0, file_reading: 0, execution: 0, testing: 0, commits: 0 };
sessions.forEach(s => {
  Object.keys(phases).forEach(p => {
    phases[p] += s.phaseBreakdown?.[p] || 0;
  });
});
const phaseTotal = Object.values(phases).reduce((a, b) => a + b, 0) || 1;
const avgPhases = {};
Object.keys(phases).forEach(p => {
  avgPhases[p] = sessionCount > 0 ? Math.round(phases[p] / sessionCount) : 0;
});

// Find high performers and over budget
const highPerformers = sessions
  .filter(s => s.outcome === 'success' && (s.tokenBudget?.percentUsed || 100) < 70)
  .slice(0, 5)
  .map(s => ({
    id: s.id,
    percentUsed: s.tokenBudget?.percentUsed || 0,
    filesModified: s.efficiencyMetrics?.filesModified || 0
  }));

const overBudget = sessions
  .filter(s => s.outcome === 'over_budget')
  .slice(0, 5)
  .map(s => ({
    id: s.id,
    percentUsed: s.tokenBudget?.percentUsed || 0,
    cause: 'Budget exceeded'
  }));

// Generate next steps
const steps = [];
if (agg.successRate < 90) steps.push('Focus on staying within budget - current success rate is ' + agg.successRate + '%');
if (recommendations.length > 0) steps.push('Address ' + recommendations.filter(r => r.priority.includes('HIGH')).length + ' high-priority rule violations');
if (avgPhases.preparation < phaseTotal * 0.05 / sessionCount) steps.push('Increase preparation phase - read context files before exploring');
if (steps.length === 0) {
  steps.push('Maintain current efficient practices');
  steps.push('Continue monitoring session metrics');
  steps.push('Consider raising budget threshold if consistently under budget');
}
while (steps.length < 3) steps.push('Review session patterns for optimization opportunities');

// Build report
const report = \`# Token Efficiency Audit Report

**Generated**: \${new Date().toISOString().split('T')[0]}
**Sessions Analyzed**: \${sessionCount}
**Report Type**: Full Analysis

---

## Executive Summary

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Success Rate | \${agg.successRate}% | ≥90% | \${getStatus(agg.successRate, 90, true)} |
| Avg Tokens/Session | \${agg.avgTokensPerSession} | ≤25,000 | \${getStatus(agg.avgTokensPerSession, 25000)} |
| Avg Iterations | \${agg.avgIterationsPerSession} | ≤15 | \${getStatus(agg.avgIterationsPerSession, 15)} |
| Trend | \${trendDirection} | Improving | \${hasTrend ? (trendPercent <= 0 ? '✅' : '⚠️') : '—'} |

---

## Rule Violations

Rules are evaluated against session history. High trigger rates indicate recurring issues.

| Rule | Trigger Rate | Severity | Action Required |
|------|-------------|----------|-----------------|
\${ruleResults.map(r => '| ' + r.name + ' | ' + r.triggerRate + '% | ' + r.severity + ' | ' + r.recommendation + ' |').join('\\n')}

---

## Recommendations

\${recommendations.length > 0 ? recommendations.map(r => \`### \${r.priority}: \${r.issue}

**Action**: \${r.action}
**Expected Impact**: \${r.impact}
\`).join('\\n') : '*No critical recommendations. Current practices are effective.*'}

---

## Trend Analysis

\${hasTrend ? \`**Direction**: \${trendDirection} (\${trendPercent}% change)
**Analysis Period**: Last 6 sessions

\${trendInsight}\` : '*Insufficient data for trend analysis. Need 6+ sessions.*'}

---

## Session Patterns

### High Performers (< 70% budget)
\${highPerformers.length > 0 ? highPerformers.map(s => '- **' + s.id + '**: ' + s.percentUsed + '% budget, ' + s.filesModified + ' files').join('\\n') : '*No high-performer sessions recorded yet.*'}

### Over Budget Sessions
\${overBudget.length > 0 ? overBudget.map(s => '- **' + s.id + '**: ' + s.percentUsed + '% budget').join('\\n') : '*No over-budget sessions. Excellent budget discipline!*'}

---

## Phase Distribution (Avg Across Sessions)

\\\`\\\`\\\`
Preparation  : \${avgPhases.preparation} tokens (\${sessionCount > 0 ? Math.round(avgPhases.preparation / (phaseTotal/sessionCount) * 100) : 0}%)
Exploration  : \${avgPhases.exploration} tokens (\${sessionCount > 0 ? Math.round(avgPhases.exploration / (phaseTotal/sessionCount) * 100) : 0}%)
Planning     : \${avgPhases.planning} tokens (\${sessionCount > 0 ? Math.round(avgPhases.planning / (phaseTotal/sessionCount) * 100) : 0}%)
File Reading : \${avgPhases.file_reading} tokens (\${sessionCount > 0 ? Math.round(avgPhases.file_reading / (phaseTotal/sessionCount) * 100) : 0}%)
Execution    : \${avgPhases.execution} tokens (\${sessionCount > 0 ? Math.round(avgPhases.execution / (phaseTotal/sessionCount) * 100) : 0}%)
Testing      : \${avgPhases.testing} tokens (\${sessionCount > 0 ? Math.round(avgPhases.testing / (phaseTotal/sessionCount) * 100) : 0}%)
Commits      : \${avgPhases.commits} tokens (\${sessionCount > 0 ? Math.round(avgPhases.commits / (phaseTotal/sessionCount) * 100) : 0}%)
\\\`\\\`\\\`

**Optimal Targets**:
- Preparation: 5-10% (index/context files)
- Exploration: 10-20% (understanding codebase)
- Execution: 40-60% (actual implementation)
- Testing: 10-15% (validation)

---

## Next Steps

1. \${steps[0]}
2. \${steps[1]}
3. \${steps[2]}

---

*Generated by Token Efficiency Learning Engine v1*
\`;

fs.writeFileSync('$REPORT_FILE', report);
console.log('Report generated: $REPORT_FILE');
"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "       Report saved to: $REPORT_FILE"
echo "═══════════════════════════════════════════════════════════"
