#!/bin/bash
# Session Continuity Advisor
#
# Analyzes current session state and recommends:
# - Continue current session, or
# - Start new session with continuation prompt
#
# Decision criteria:
# - Token budget remaining
# - Context window estimate
# - Session duration
# - Phase completion status

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PM_STATE_FILE="$PROJECT_ROOT/.claude/.pm-state.json"

# Token budget thresholds
TOKEN_BUDGET_TOTAL=30000
TOKEN_BUDGET_WARN=24000
TOKEN_BUDGET_CRITICAL=25000

# Context percentage thresholds
CONTEXT_WARN=60
CONTEXT_CRITICAL=70

# Session duration thresholds (minutes)
DURATION_WARN=120
DURATION_CRITICAL=150

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Read PM state if exists
if [ ! -f "$PM_STATE_FILE" ]; then
    echo "Warning: PM state file not found, using estimates"
    TOKENS_USED=0
    SESSION_DURATION=60
    FILES_MODIFIED=0
else
    TOKENS_USED=$(jq -r '.tokensUsed // 0' "$PM_STATE_FILE" 2>/dev/null || echo "0")
    SESSION_DURATION=$(jq -r '.sessionDurationMinutes // 60' "$PM_STATE_FILE" 2>/dev/null || echo "60")
    FILES_MODIFIED=$(jq -r '.filesModified // 0' "$PM_STATE_FILE" 2>/dev/null || echo "0")
fi

# Calculate remaining budget
TOKENS_REMAINING=$((TOKEN_BUDGET_TOTAL - TOKENS_USED))
BUDGET_PCT=$((TOKENS_USED * 100 / TOKEN_BUDGET_TOTAL))

# Estimate context window usage (rough heuristic)
# Base: 10% for system prompts
# + 5% per 5k tokens used
# + 10% per 10 files modified
CONTEXT_PCT=10
CONTEXT_PCT=$((CONTEXT_PCT + (TOKENS_USED / 5000) * 5))
CONTEXT_PCT=$((CONTEXT_PCT + (FILES_MODIFIED / 10) * 10))
CONTEXT_PCT=$((CONTEXT_PCT > 100 ? 100 : CONTEXT_PCT))

# Determine recommendation
RECOMMENDATION="CONTINUE"
REASONS=()

# Check token budget
if [ "$TOKENS_REMAINING" -lt 5000 ]; then
    RECOMMENDATION="NEW SESSION"
    REASONS+=("Token budget critically low (<5k remaining)")
elif [ "$TOKENS_REMAINING" -lt 10000 ]; then
    REASONS+=("Token budget getting tight (<10k remaining)")
fi

# Check context window
if [ "$CONTEXT_PCT" -ge "$CONTEXT_CRITICAL" ]; then
    RECOMMENDATION="NEW SESSION"
    REASONS+=("Context window >70% full")
elif [ "$CONTEXT_PCT" -ge "$CONTEXT_WARN" ]; then
    REASONS+=("Context window approaching 60%")
fi

# Check session duration
if [ "$SESSION_DURATION" -ge "$DURATION_CRITICAL" ]; then
    RECOMMENDATION="NEW SESSION"
    REASONS+=("Session >2.5 hours (context fatigue)")
elif [ "$SESSION_DURATION" -ge "$DURATION_WARN" ]; then
    REASONS+=("Session >2 hours")
fi

# Always recommend new session after project completion
REASONS+=("Project/phase complete, natural breakpoint")

# Print report
echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           SESSION CONTINUITY ADVICE                       ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

echo "📊 Current Session Status:"
echo "   Token Budget: $TOKENS_USED / $TOKEN_BUDGET_TOTAL used ($BUDGET_PCT%)"
echo "   Context Estimate: ~$CONTEXT_PCT% full"
echo "   Session Duration: $SESSION_DURATION minutes"
echo "   Files Modified: $FILES_MODIFIED"
echo ""

# Print recommendation with color
if [ "$RECOMMENDATION" = "NEW SESSION" ]; then
    echo -e "🎯 RECOMMENDATION: ${YELLOW}**START NEW SESSION**${NC}"
else
    echo -e "🎯 RECOMMENDATION: ${GREEN}**CONTINUE CURRENT SESSION**${NC}"
fi

echo ""
echo "Reasons:"
for reason in "${REASONS[@]}"; do
    echo "- $reason"
done

echo ""

if [ "$RECOMMENDATION" = "NEW SESSION" ]; then
    echo "📋 To resume this work in a NEW session, use the continuation prompt generated in:"
    echo "   docs/projects/<project-id>/continuation-prompt.txt"
    echo ""
    echo "Benefits of starting fresh:"
    echo "- Context loaded from artifacts (~2,500 tokens)"
    echo "- vs continuing with accumulated context (~${TOKENS_USED} tokens)"
    echo "- Savings: ~$((TOKENS_USED - 2500)) tokens"
else
    echo "💡 Continuing in this session:"
    echo "   Budget remaining: $TOKENS_REMAINING tokens"
    echo "   Enough for ~$((TOKENS_REMAINING / 3000)) more typical tasks"
fi

echo ""
echo "───────────────────────────────────────────────────────────"
