#!/bin/bash
# Efficiency Learner - Extract patterns from session history
# Analyzes session-history.json and updates efficiency-rules.json
# Part of Token Efficiency System Phase 3

HISTORY_FILE=".claude/data/session-history.json"
RULES_FILE=".claude/data/efficiency-rules.json"
REPORT_DIR=".claude/reports"

# Ensure files exist
if [ ! -f "$HISTORY_FILE" ]; then
  echo "Error: No session history found at $HISTORY_FILE"
  echo "Run some sessions first to build history."
  exit 1
fi

if [ ! -f "$RULES_FILE" ]; then
  echo "Error: No rules file found at $RULES_FILE"
  exit 1
fi

# Parse arguments
REPORT_MODE="${1:-summary}"  # summary, full, or json

echo "═══════════════════════════════════════════════════════════"
echo "           EFFICIENCY LEARNING ENGINE                       "
echo "═══════════════════════════════════════════════════════════"

node -e "
const fs = require('fs');

const history = JSON.parse(fs.readFileSync('$HISTORY_FILE', 'utf8'));
const rules = JSON.parse(fs.readFileSync('$RULES_FILE', 'utf8'));
const sessions = history.sessions;
const reportMode = '$REPORT_MODE';

if (sessions.length === 0) {
  console.log('No sessions in history. Run sessions to build data.');
  process.exit(0);
}

// Calculate derived metrics for each session
const enrichedSessions = sessions.map(s => {
  const total = Object.values(s.phaseBreakdown || {}).reduce((a, b) => a + b, 0) || 1;
  return {
    ...s,
    derived: {
      explorationPercent: ((s.phaseBreakdown?.exploration || 0) / total) * 100,
      testingPercent: ((s.phaseBreakdown?.testing || 0) / total) * 100,
      executionPercent: ((s.phaseBreakdown?.execution || 0) / total) * 100,
      preparationRatio: (s.phaseBreakdown?.preparation || 0) / total
    }
  };
});

// Evaluate rules against sessions
const ruleResults = rules.rules.map(rule => {
  let triggered = 0;
  let successAfterTrigger = 0;

  enrichedSessions.forEach(session => {
    const value = session.derived[rule.condition.metric]
      || session.efficiencyMetrics?.[rule.condition.metric]
      || 0;

    let conditionMet = false;
    switch (rule.condition.operator) {
      case '<': conditionMet = value < rule.condition.threshold; break;
      case '>': conditionMet = value > rule.condition.threshold; break;
      case '>=': conditionMet = value >= rule.condition.threshold; break;
      case '<=': conditionMet = value <= rule.condition.threshold; break;
    }

    // Check additional condition if present
    if (conditionMet && rule.condition.additionalCondition) {
      const addValue = session.derived[rule.condition.additionalCondition.metric]
        || session.efficiencyMetrics?.[rule.condition.additionalCondition.metric]
        || 0;
      switch (rule.condition.additionalCondition.operator) {
        case '<': conditionMet = addValue < rule.condition.additionalCondition.threshold; break;
        case '>': conditionMet = addValue > rule.condition.additionalCondition.threshold; break;
        case '>=': conditionMet = addValue >= rule.condition.additionalCondition.threshold; break;
        case '<=': conditionMet = addValue <= rule.condition.additionalCondition.threshold; break;
      }
    }

    if (conditionMet) {
      triggered++;
      if (session.outcome === 'success') {
        successAfterTrigger++;
      }
    }
  });

  return {
    id: rule.id,
    name: rule.name,
    triggered,
    successAfterTrigger,
    triggerRate: Math.round((triggered / sessions.length) * 100),
    recommendation: rule.recommendation,
    estimatedSavings: rule.estimatedSavings
  };
});

// Update rule counts in rules file
rules.rules.forEach(rule => {
  const result = ruleResults.find(r => r.id === rule.id);
  if (result) {
    rule.triggerCount = result.triggered;
    rule.successCount = result.successAfterTrigger;
  }
});
rules.lastUpdated = new Date().toISOString();
fs.writeFileSync('$RULES_FILE', JSON.stringify(rules, null, 2));

// Identify patterns from historical data
const patterns = {
  highPerformers: enrichedSessions.filter(s =>
    s.outcome === 'success' && s.tokenBudget.percentUsed < 70
  ),
  overBudget: enrichedSessions.filter(s => s.outcome === 'over_budget'),
  trending: null
};

// Calculate trend if enough data
if (sessions.length >= 6) {
  const recent3 = sessions.slice(0, 3);
  const older3 = sessions.slice(3, 6);
  const recentAvg = recent3.reduce((s, x) => s + (x.tokenBudget?.used || 0), 0) / 3;
  const olderAvg = older3.reduce((s, x) => s + (x.tokenBudget?.used || 0), 0) / 3;
  patterns.trending = {
    direction: recentAvg < olderAvg ? 'improving' : 'degrading',
    changePercent: Math.round(((recentAvg - olderAvg) / olderAvg) * 100)
  };
}

// Generate recommendations
const recommendations = [];
ruleResults.forEach(r => {
  if (r.triggerRate >= 30) {
    recommendations.push({
      priority: r.triggerRate >= 50 ? 'HIGH' : 'MEDIUM',
      rule: r.id,
      issue: r.name + ' (triggered ' + r.triggerRate + '% of sessions)',
      action: r.recommendation,
      impact: r.estimatedSavings
    });
  }
});

// Output based on mode
if (reportMode === 'json') {
  console.log(JSON.stringify({
    sessionCount: sessions.length,
    aggregates: history.aggregateMetrics,
    ruleResults,
    patterns,
    recommendations
  }, null, 2));
} else {
  // Summary output
  console.log('\\nSESSION HISTORY');
  console.log('───────────────');
  console.log('Sessions analyzed:', sessions.length);
  console.log('Success rate:', history.aggregateMetrics.successRate + '%');
  console.log('Avg tokens/session:', history.aggregateMetrics.avgTokensPerSession);
  console.log('Avg iterations:', history.aggregateMetrics.avgIterationsPerSession);

  if (patterns.trending) {
    console.log('\\nTREND');
    console.log('───────────────');
    const icon = patterns.trending.direction === 'improving' ? '📈' : '📉';
    console.log(icon, patterns.trending.direction.toUpperCase());
    console.log('Change:', patterns.trending.changePercent + '% token usage');
  }

  console.log('\\nRULE ANALYSIS');
  console.log('───────────────');
  ruleResults.forEach(r => {
    const status = r.triggerRate >= 50 ? '🔴' : r.triggerRate >= 30 ? '🟡' : '🟢';
    console.log(status, r.id.padEnd(18), r.triggerRate + '% trigger rate');
  });

  if (recommendations.length > 0) {
    console.log('\\nRECOMMENDATIONS');
    console.log('───────────────');
    recommendations.forEach((rec, i) => {
      const icon = rec.priority === 'HIGH' ? '⚠️' : '💡';
      console.log((i+1) + '.', icon, '[' + rec.priority + ']', rec.issue);
      console.log('   Action:', rec.action);
      console.log('   Impact:', rec.impact);
    });
  } else {
    console.log('\\n✅ No critical issues detected. Keep up efficient practices!');
  }

  if (reportMode === 'full') {
    console.log('\\nHIGH PERFORMERS (tokens < 70% budget)');
    console.log('───────────────');
    if (patterns.highPerformers.length > 0) {
      patterns.highPerformers.slice(0, 5).forEach(s => {
        console.log('-', s.id, ':', s.tokenBudget.percentUsed + '% budget,',
          s.efficiencyMetrics?.filesModified || 0, 'files modified');
      });
    } else {
      console.log('No high-performer sessions yet.');
    }
  }
}

console.log('\\n───────────────');
console.log('Rules file updated:', '$RULES_FILE');
"
