#!/bin/bash
# Archive current session to history
# Called by pm-audit-capture.sh or manually

STATE_FILE=".claude/.pm-state.json"
HISTORY_FILE=".claude/data/session-history.json"

# Check if state file exists
if [ ! -f "$STATE_FILE" ]; then
  echo "Error: No session state file found at $STATE_FILE"
  exit 1
fi

# Initialize history if needed
if [ ! -f "$HISTORY_FILE" ]; then
  mkdir -p "$(dirname "$HISTORY_FILE")"
  cat > "$HISTORY_FILE" << 'EOF'
{
  "version": 1,
  "maxSessions": 50,
  "sessions": [],
  "aggregateMetrics": {
    "totalSessions": 0,
    "avgTokensPerSession": 0,
    "avgEfficiencyScore": 0,
    "avgIterationsPerSession": 0,
    "successRate": 0
  },
  "learnedPatterns": {
    "bestPractices": [],
    "antiPatterns": [],
    "lastAnalysis": null
  }
}
EOF
fi

# Extract session data and append to history
node -e "
const fs = require('fs');

try {
  const state = JSON.parse(fs.readFileSync('$STATE_FILE', 'utf8'));
  const history = JSON.parse(fs.readFileSync('$HISTORY_FILE', 'utf8'));

  // Build session entry
  const session = {
    id: state.sessionId || 'pm-' + Date.now().toString(36),
    date: new Date().toISOString().split('T')[0],
    duration: state.startTime
      ? Math.round((Date.now() - new Date(state.startTime).getTime()) / 60000)
      : 0,
    tokenBudget: {
      total: state.tokenBudget?.total || 30000,
      used: state.tokenBudget?.used || 0,
      percentUsed: state.tokenBudget?.percentUsed || 0
    },
    phaseBreakdown: Object.fromEntries(
      Object.entries(state.tokensByPhase || {}).map(([k, v]) => [k, v.estimatedTokens || 0])
    ),
    efficiencyMetrics: {
      iterationCount: state.efficiencyMetrics?.iterationCount || 0,
      tokensPerFileModified: state.efficiencyMetrics?.tokensPerFileModified || 0,
      preparationRatio: state.efficiencyMetrics?.preparationRatio || 0,
      filesModified: (state.filesModified || []).length
    },
    outcome: (state.tokenBudget?.percentUsed || 0) <= 100 ? 'success' : 'over_budget',
    tags: []
  };

  // Add tags based on activity
  if (session.efficiencyMetrics.filesModified > 5) session.tags.push('multi-file');
  if (session.phaseBreakdown.planning > 1000) session.tags.push('planned');
  if (session.phaseBreakdown.testing > 500) session.tags.push('tested');

  // Add to history (FIFO - newest first)
  history.sessions.unshift(session);

  // Enforce maxSessions limit
  if (history.sessions.length > history.maxSessions) {
    history.sessions = history.sessions.slice(0, history.maxSessions);
  }

  // Update aggregate metrics
  const sessions = history.sessions;
  const successCount = sessions.filter(x => x.outcome === 'success').length;

  history.aggregateMetrics = {
    totalSessions: sessions.length,
    avgTokensPerSession: sessions.length > 0
      ? Math.round(sessions.reduce((s, x) => s + (x.tokenBudget?.used || 0), 0) / sessions.length)
      : 0,
    avgIterationsPerSession: sessions.length > 0
      ? Math.round(sessions.reduce((s, x) => s + (x.efficiencyMetrics?.iterationCount || 0), 0) / sessions.length)
      : 0,
    avgEfficiencyScore: sessions.length > 0
      ? Math.round(sessions.reduce((s, x) => {
          const budgetEfficiency = 100 - (x.tokenBudget?.percentUsed || 0);
          return s + Math.max(0, budgetEfficiency);
        }, 0) / sessions.length)
      : 0,
    successRate: sessions.length > 0
      ? Math.round(successCount / sessions.length * 100)
      : 0
  };

  fs.writeFileSync('$HISTORY_FILE', JSON.stringify(history, null, 2));
  console.log('Session archived successfully');
  console.log('  ID:', session.id);
  console.log('  Tokens used:', session.tokenBudget.used);
  console.log('  Duration:', session.duration, 'minutes');
  console.log('  Outcome:', session.outcome);
  console.log('  Total sessions in history:', history.aggregateMetrics.totalSessions);
} catch (error) {
  console.error('Error archiving session:', error.message);
  process.exit(1);
}
"
