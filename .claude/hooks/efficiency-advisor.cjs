#!/usr/bin/env node
/**
 * Efficiency Advisor Hook - Proactive suggestions based on learned rules
 *
 * Hook Type: UserPromptSubmit (runs at start of each turn)
 *
 * Features:
 * - Evaluates efficiency rules against current session state
 * - Provides milestone-based suggestions (iteration 5, 10, 15, 20)
 * - Warns about context degradation at 20 iterations
 * - Suggests improvements based on phase patterns
 *
 * Intervention Level: Moderate (dashboard suggestions only, never blocks)
 *
 * Exit codes: 0 (always - advisory only)
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(process.cwd(), '.claude', '.pm-state.json');
const RULES_FILE = path.join(process.cwd(), '.claude', 'data', 'efficiency-rules.json');

const CONFIG = {
  ITERATION_MILESTONES: [5, 10, 15, 20],
  CRITICAL_ITERATION: 20,
  MIN_SESSIONS_FOR_TRENDS: 3,
  SUGGESTION_COOLDOWN_MS: 600000, // 10 minutes between similar suggestions
};

// Track shown suggestions to avoid spam
const SHOWN_SUGGESTIONS_FILE = path.join(process.cwd(), '.claude', '.advisor-suggestions.json');

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {}
  return null;
}

function loadRules() {
  try {
    if (fs.existsSync(RULES_FILE)) {
      return JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
    }
  } catch (e) {}
  return { rules: [] };
}

function loadShownSuggestions() {
  try {
    if (fs.existsSync(SHOWN_SUGGESTIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SHOWN_SUGGESTIONS_FILE, 'utf8'));
    }
  } catch (e) {}
  return { shown: {}, sessionId: null };
}

function saveShownSuggestions(suggestions) {
  try {
    const dir = path.dirname(SHOWN_SUGGESTIONS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SHOWN_SUGGESTIONS_FILE, JSON.stringify(suggestions, null, 2));
  } catch (e) {}
}

function shouldShowSuggestion(suggestionId, shownSuggestions, sessionId) {
  // Reset if new session
  if (shownSuggestions.sessionId !== sessionId) {
    shownSuggestions.shown = {};
    shownSuggestions.sessionId = sessionId;
    return true;
  }

  const lastShown = shownSuggestions.shown[suggestionId];
  if (!lastShown) return true;

  return (Date.now() - lastShown) > CONFIG.SUGGESTION_COOLDOWN_MS;
}

function markSuggestionShown(suggestionId, shownSuggestions) {
  shownSuggestions.shown[suggestionId] = Date.now();
}

function evaluateRule(rule, state) {
  const total = Object.values(state.tokensByPhase || {})
    .reduce((sum, p) => sum + (p.estimatedTokens || 0), 0) || 1;

  // Calculate derived metrics
  const metrics = {
    preparationRatio: (state.tokensByPhase?.preparation?.estimatedTokens || 0) / total,
    explorationPercent: ((state.tokensByPhase?.exploration?.estimatedTokens || 0) / total) * 100,
    testingPercent: ((state.tokensByPhase?.testing?.estimatedTokens || 0) / total) * 100,
    executionPercent: ((state.tokensByPhase?.execution?.estimatedTokens || 0) / total) * 100,
    iterationCount: state.efficiencyMetrics?.iterationCount || 0,
    tokensPerFileModified: state.efficiencyMetrics?.tokensPerFileModified || 0,
  };

  const value = metrics[rule.condition.metric];
  if (value === undefined) return false;

  let conditionMet = false;
  switch (rule.condition.operator) {
    case '<': conditionMet = value < rule.condition.threshold; break;
    case '>': conditionMet = value > rule.condition.threshold; break;
    case '>=': conditionMet = value >= rule.condition.threshold; break;
    case '<=': conditionMet = value <= rule.condition.threshold; break;
  }

  // Check additional condition if present
  if (conditionMet && rule.condition.additionalCondition) {
    const addValue = metrics[rule.condition.additionalCondition.metric];
    switch (rule.condition.additionalCondition.operator) {
      case '<': conditionMet = addValue < rule.condition.additionalCondition.threshold; break;
      case '>': conditionMet = addValue > rule.condition.additionalCondition.threshold; break;
      case '>=': conditionMet = addValue >= rule.condition.additionalCondition.threshold; break;
      case '<=': conditionMet = addValue <= rule.condition.additionalCondition.threshold; break;
    }
  }

  return conditionMet;
}

function formatSuggestionBox(title, suggestions, isWarning = false) {
  const icon = isWarning ? '⚠️' : '💡';
  const header = isWarning ? 'EFFICIENCY WARNING' : 'EFFICIENCY TIPS';

  let output = '\n';
  output += '┌─────────────────────────────────────────────────────────────┐\n';
  output += `│ ${icon} ${header.padEnd(56)}│\n`;
  output += '├─────────────────────────────────────────────────────────────┤\n';

  if (title) {
    output += `│ ${title.substring(0, 59).padEnd(59)}│\n`;
    output += '│                                                             │\n';
  }

  suggestions.forEach(s => {
    // Wrap long suggestions
    const lines = wrapText(s, 57);
    lines.forEach((line, i) => {
      const prefix = i === 0 ? '→ ' : '  ';
      output += `│ ${prefix}${line.padEnd(57)}│\n`;
    });
  });

  output += '└─────────────────────────────────────────────────────────────┘\n';

  return output;
}

function wrapText(text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });
  if (currentLine) lines.push(currentLine);

  return lines;
}

function getIterationSuggestions(iterations) {
  if (iterations >= 20) {
    return {
      isWarning: true,
      title: `Iteration ${iterations}: Context quality degradation risk`,
      suggestions: [
        'Consider /clear to reset context (recommended)',
        'Quality of responses may degrade after 20 iterations',
        'If continuing, summarize progress before next complex task'
      ]
    };
  }

  if (iterations === 15) {
    return {
      isWarning: false,
      title: `Iteration ${iterations}: Approaching context limit`,
      suggestions: [
        'Plan to wrap up current task or reset at 20',
        'Consider archiving session state soon'
      ]
    };
  }

  if (iterations === 10) {
    return {
      isWarning: false,
      title: `Iteration ${iterations}: Mid-session checkpoint`,
      suggestions: [
        'Good time to commit completed work',
        'Review if original goal is still on track'
      ]
    };
  }

  if (iterations === 5) {
    return {
      isWarning: false,
      title: `Iteration ${iterations}: Session warming up`,
      suggestions: [
        'Context is well-established',
        'Focus on execution if exploration is complete'
      ]
    };
  }

  return null;
}

function getRuleSuggestions(state, rules) {
  const triggeredRules = [];

  rules.rules.forEach(rule => {
    if (evaluateRule(rule, state)) {
      triggeredRules.push({
        id: rule.id,
        name: rule.name,
        recommendation: rule.recommendation,
        savings: rule.estimatedSavings,
        confidence: rule.confidence
      });
    }
  });

  // Sort by confidence (highest first)
  triggeredRules.sort((a, b) => b.confidence - a.confidence);

  return triggeredRules.slice(0, 2); // Max 2 rule suggestions at a time
}

async function main() {
  const state = loadState();
  if (!state) {
    process.exit(0);
    return;
  }

  const rules = loadRules();
  const shownSuggestions = loadShownSuggestions();
  const sessionId = state.sessionId;

  const iterations = state.efficiencyMetrics?.iterationCount || 0;
  const budgetPercent = state.tokenBudget?.percentUsed || 0;

  let output = '';
  let suggestionsShown = false;

  // Check iteration milestones
  if (CONFIG.ITERATION_MILESTONES.includes(iterations) || iterations >= CONFIG.CRITICAL_ITERATION) {
    const suggestionId = `iteration-${iterations >= 20 ? '20plus' : iterations}`;

    if (shouldShowSuggestion(suggestionId, shownSuggestions, sessionId)) {
      const iterSuggestions = getIterationSuggestions(iterations);

      if (iterSuggestions) {
        output += formatSuggestionBox(
          iterSuggestions.title,
          iterSuggestions.suggestions,
          iterSuggestions.isWarning
        );
        markSuggestionShown(suggestionId, shownSuggestions);
        suggestionsShown = true;
      }
    }
  }

  // Check rule violations (only if not showing iteration warning)
  if (!suggestionsShown && budgetPercent >= 30) {
    const triggeredRules = getRuleSuggestions(state, rules);

    if (triggeredRules.length > 0) {
      const ruleId = triggeredRules.map(r => r.id).join('-');
      const suggestionId = `rules-${ruleId}`;

      if (shouldShowSuggestion(suggestionId, shownSuggestions, sessionId)) {
        const suggestions = triggeredRules.map(r =>
          `${r.name}: ${r.recommendation}`
        );

        output += formatSuggestionBox(
          'Based on current session patterns:',
          suggestions,
          false
        );
        markSuggestionShown(suggestionId, shownSuggestions);
      }
    }
  }

  // Save updated suggestions tracker
  saveShownSuggestions(shownSuggestions);

  // Output suggestions if any
  if (output) {
    console.log(output);
  }

  // Always exit 0 - this is advisory only
  process.exit(0);
}

main().catch(err => {
  // Silent fail - never block
  process.exit(0);
});
