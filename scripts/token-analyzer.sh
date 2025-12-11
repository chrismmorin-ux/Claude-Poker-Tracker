#!/bin/bash
# Analyze session history for patterns and trends
# Usage: bash scripts/token-analyzer.sh [--json]

HISTORY_FILE=".claude/data/session-history.json"
OUTPUT_FORMAT="${1:-text}"

if [ ! -f "$HISTORY_FILE" ]; then
  echo "Error: No session history found at $HISTORY_FILE"
  echo "Run some sessions first, then use archive-session.sh"
  exit 1
fi

if [ "$OUTPUT_FORMAT" = "--json" ]; then
  # JSON output for programmatic use
  node -e "
const fs = require('fs');
const history = JSON.parse(fs.readFileSync('$HISTORY_FILE', 'utf8'));
const sessions = history.sessions;

if (sessions.length === 0) {
  console.log(JSON.stringify({ error: 'No sessions in history' }));
  process.exit(0);
}

const analysis = {
  aggregateMetrics: history.aggregateMetrics,
  trends: {},
  recommendations: []
};

// Trend analysis (last 5 vs previous 5)
if (sessions.length >= 10) {
  const recent = sessions.slice(0, 5);
  const older = sessions.slice(5, 10);
  const recentAvg = recent.reduce((s, x) => s + (x.tokenBudget?.used || 0), 0) / 5;
  const olderAvg = older.reduce((s, x) => s + (x.tokenBudget?.used || 0), 0) / 5;
  analysis.trends = {
    recentAvgTokens: Math.round(recentAvg),
    olderAvgTokens: Math.round(olderAvg),
    changePercent: Math.round((recentAvg - olderAvg) / olderAvg * 100),
    improving: recentAvg < olderAvg
  };
}

// Generate recommendations
const avgPrep = sessions.reduce((s, x) => s + (x.efficiencyMetrics?.preparationRatio || 0), 0) / sessions.length;
if (avgPrep < 0.1) {
  analysis.recommendations.push({
    type: 'LOW_PREPARATION',
    message: 'Average preparation ratio is low. Read index files before exploring.',
    priority: 'high'
  });
}

const avgIter = history.aggregateMetrics.avgIterationsPerSession;
if (avgIter > 15) {
  analysis.recommendations.push({
    type: 'HIGH_ITERATIONS',
    message: 'Sessions averaging ' + avgIter + ' iterations. Consider using /clear more often.',
    priority: 'medium'
  });
}

console.log(JSON.stringify(analysis, null, 2));
"
else
  # Human-readable output
  echo "═══════════════════════════════════════════════════════════════"
  echo "              TOKEN EFFICIENCY ANALYSIS                         "
  echo "═══════════════════════════════════════════════════════════════"

  node -e "
const fs = require('fs');
const history = JSON.parse(fs.readFileSync('$HISTORY_FILE', 'utf8'));
const sessions = history.sessions;

if (sessions.length === 0) {
  console.log('\nNo sessions in history yet.');
  console.log('Sessions are archived when pm-audit-capture.sh runs.');
  process.exit(0);
}

console.log('\n┌─────────────────────────────────────────────────────────────┐');
console.log('│ AGGREGATE METRICS                                           │');
console.log('├─────────────────────────────────────────────────────────────┤');
console.log('│  Total sessions:        ' + String(history.aggregateMetrics.totalSessions).padStart(5) + '                              │');
console.log('│  Avg tokens/session:    ' + String(history.aggregateMetrics.avgTokensPerSession).padStart(5) + '                              │');
console.log('│  Avg iterations:        ' + String(history.aggregateMetrics.avgIterationsPerSession).padStart(5) + '                              │');
console.log('│  Success rate:          ' + String(history.aggregateMetrics.successRate + '%').padStart(5) + '                              │');
console.log('│  Avg efficiency score:  ' + String(history.aggregateMetrics.avgEfficiencyScore).padStart(5) + '                              │');
console.log('└─────────────────────────────────────────────────────────────┘');

// Phase distribution across all sessions
console.log('\n┌─────────────────────────────────────────────────────────────┐');
console.log('│ PHASE DISTRIBUTION (avg tokens per session)                 │');
console.log('├─────────────────────────────────────────────────────────────┤');

const phases = ['preparation', 'exploration', 'planning', 'file_reading', 'execution', 'testing', 'commits'];
phases.forEach(phase => {
  const total = sessions.reduce((s, x) => s + (x.phaseBreakdown?.[phase] || 0), 0);
  const avg = sessions.length > 0 ? Math.round(total / sessions.length) : 0;
  const bar = '█'.repeat(Math.min(Math.round(avg / 500), 20));
  console.log('│  ' + phase.padEnd(15) + String(avg).padStart(6) + '  ' + bar.padEnd(20) + '  │');
});
console.log('└─────────────────────────────────────────────────────────────┘');

// Trend analysis (last 5 vs previous 5)
if (sessions.length >= 10) {
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ TREND ANALYSIS (Recent 5 vs Previous 5)                     │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  const recent = sessions.slice(0, 5);
  const older = sessions.slice(5, 10);
  const recentAvg = recent.reduce((s, x) => s + (x.tokenBudget?.used || 0), 0) / 5;
  const olderAvg = older.reduce((s, x) => s + (x.tokenBudget?.used || 0), 0) / 5;
  const change = Math.round((recentAvg - olderAvg) / olderAvg * 100);
  const trend = change < 0 ? '📉 IMPROVING' : change > 10 ? '📈 ATTENTION NEEDED' : '➡️  STABLE';
  console.log('│  Recent 5 avg:     ' + String(Math.round(recentAvg)).padStart(6) + ' tokens                       │');
  console.log('│  Previous 5 avg:   ' + String(Math.round(olderAvg)).padStart(6) + ' tokens                       │');
  console.log('│  Change:           ' + String((change > 0 ? '+' : '') + change + '%').padStart(6) + '                                │');
  console.log('│  Trend:            ' + trend.padEnd(20) + '                   │');
  console.log('└─────────────────────────────────────────────────────────────┘');
} else if (sessions.length >= 2) {
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ Need 10+ sessions for trend analysis (' + sessions.length + ' recorded)          │');
  console.log('└─────────────────────────────────────────────────────────────┘');
}

// Recent sessions
console.log('\n┌─────────────────────────────────────────────────────────────┐');
console.log('│ RECENT SESSIONS                                             │');
console.log('├─────────────────────────────────────────────────────────────┤');
sessions.slice(0, 5).forEach((s, i) => {
  const outcome = s.outcome === 'success' ? '✓' : '✗';
  const tokens = String(s.tokenBudget?.used || 0).padStart(5);
  const pct = String((s.tokenBudget?.percentUsed || 0) + '%').padStart(4);
  console.log('│  ' + outcome + ' ' + s.date + '  ' + tokens + ' tokens (' + pct + ')  ' + (s.tags || []).join(', ').padEnd(15).substring(0, 15) + ' │');
});
console.log('└─────────────────────────────────────────────────────────────┘');

// Recommendations
console.log('\n┌─────────────────────────────────────────────────────────────┐');
console.log('│ RECOMMENDATIONS                                             │');
console.log('├─────────────────────────────────────────────────────────────┤');

const avgPrep = sessions.reduce((s, x) => s + (x.efficiencyMetrics?.preparationRatio || 0), 0) / sessions.length;
const avgIter = history.aggregateMetrics.avgIterationsPerSession;
const avgTokensPerFile = sessions.reduce((s, x) => s + (x.efficiencyMetrics?.tokensPerFileModified || 0), 0) / sessions.length;

let hasRecs = false;
if (avgPrep < 0.1) {
  console.log('│  ⚠️  Low preparation ratio (' + avgPrep.toFixed(2) + ')                          │');
  console.log('│     → Read .claude/index/*.md before exploring             │');
  hasRecs = true;
}
if (avgIter > 15) {
  console.log('│  ⚠️  High iteration count (avg ' + avgIter + ')                          │');
  console.log('│     → Use /clear more often to reset context               │');
  hasRecs = true;
}
if (avgTokensPerFile > 2500) {
  console.log('│  ⚠️  High tokens per file (' + Math.round(avgTokensPerFile) + ')                        │');
  console.log('│     → Use grep to narrow before reading full files         │');
  hasRecs = true;
}
if (history.aggregateMetrics.successRate < 80) {
  console.log('│  ⚠️  Low success rate (' + history.aggregateMetrics.successRate + '%)                             │');
  console.log('│     → Review sessions that went over budget                │');
  hasRecs = true;
}
if (!hasRecs) {
  console.log('│  ✓ No issues detected - keep up the good work!             │');
}
console.log('└─────────────────────────────────────────────────────────────┘');
"
fi
