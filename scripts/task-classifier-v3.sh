#!/bin/bash
# task-classifier-v3.sh - Expanded task classifier with reverse-default delegation
#
# REVERSE-DEFAULT MODEL: Tasks delegate by default unless proven Claude-required
#
# Usage: bash task-classifier-v3.sh "task description" [target_file]
# Output: classification:confidence:model (e.g., "medium_component:high:qwen")
#
# Expanded Categories (delegate 70%+ of work):
#   simple_utility   - <200 lines, pure functions → DeepSeek
#   simple_component - <150 lines, standard patterns → Qwen
#   medium_component - <300 lines, hooks/state → Qwen
#   refactor         - Any size, clear scope → Qwen
#   documentation    - Comments, docs → Qwen
#   test_generation  - Unit tests → Qwen
#   complex          - >300 lines, novel patterns → Claude
#   claude_required  - [CLAUDE] tag or state/reducer/integration → Claude

set -e

TASK="$1"
TARGET_FILE="${2:-}"

if [ -z "$TASK" ]; then
    echo "Usage: $0 \"task description\" [target_file]" >&2
    exit 1
fi

# Check for [CLAUDE] bypass tag first
if echo "$TASK" | grep -q '\[CLAUDE\]'; then
    echo "claude_required:high:claude"
    exit 0
fi

# Convert to lowercase for matching
TASK_LOWER=$(echo "$TASK" | tr '[:upper:]' '[:lower:]')

# =============================================================================
# SCORING SYSTEM (reversed: start with delegate, add points for Claude-required)
# =============================================================================

SCORE_UTILITY=0
SCORE_COMPONENT=0
SCORE_MEDIUM_COMPONENT=0
SCORE_REFACTOR=0
SCORE_DOC=0
SCORE_TEST=0
SCORE_CLAUDE=0

# =============================================================================
# TIER 0: ABSOLUTE CLAUDE-REQUIRED (No override possible)
# =============================================================================

# State management - ALWAYS Claude
if echo "$TASK_LOWER" | grep -qE "(reducer|useReducer|createContext|contextProvider)"; then
    echo "claude_required:high:claude"
    exit 0
fi

# Persistence layer - ALWAYS Claude
if echo "$TASK_LOWER" | grep -qE "(indexeddb|persistence|hydration|migration)"; then
    echo "claude_required:high:claude"
    exit 0
fi

# Cross-file integration - ALWAYS Claude
if echo "$TASK_LOWER" | grep -qE "(wire up|integrate|orchestrat|connect multiple|across (all|many|multiple) files)"; then
    echo "claude_required:high:claude"
    exit 0
fi

# Security-sensitive - ALWAYS Claude
if echo "$TASK_LOWER" | grep -qE "(security|auth|credential|token validation|encryption)"; then
    echo "claude_required:high:claude"
    exit 0
fi

# =============================================================================
# TIER 1: EXACT PATTERN MATCHING - HIGH CONFIDENCE DELEGATION
# =============================================================================

# Pure utility patterns - delegate
if echo "$TASK_LOWER" | grep -qE "^(create|write|add) (a )?(pure |utility |helper )?function (to |that |for )"; then
    SCORE_UTILITY=$((SCORE_UTILITY + 6))
fi

# Simple component patterns - delegate
if echo "$TASK_LOWER" | grep -qE "^(create|add|build) (a )?(simple |small |basic |display |presentational )?(component|button|badge|card|icon)"; then
    SCORE_COMPONENT=$((SCORE_COMPONENT + 6))
fi

# Refactor patterns - delegate
if echo "$TASK_LOWER" | grep -qE "^(rename|extract|move|refactor) .+ (to|into|from)"; then
    SCORE_REFACTOR=$((SCORE_REFACTOR + 6))
fi

# Test patterns - delegate
if echo "$TASK_LOWER" | grep -qE "^(write|create|add|generate) (unit )?tests? for"; then
    SCORE_TEST=$((SCORE_TEST + 6))
fi

# Doc patterns - delegate
if echo "$TASK_LOWER" | grep -qE "^(add|write|update) (jsdoc|documentation|comments)"; then
    SCORE_DOC=$((SCORE_DOC + 6))
fi

# =============================================================================
# TIER 2: FILE PATH ANALYSIS
# =============================================================================

# Extract file path from task or use provided target
FILE_PATH="$TARGET_FILE"
if [ -z "$FILE_PATH" ]; then
    FILE_PATH=$(echo "$TASK" | grep -oE "src/[a-zA-Z0-9/_.-]+" | head -1)
fi

if [ -n "$FILE_PATH" ]; then
    # Utility files - strong delegate signal
    if echo "$FILE_PATH" | grep -qE "^src/utils/"; then
        SCORE_UTILITY=$((SCORE_UTILITY + 5))
    fi

    # UI components - delegate unless complex
    if echo "$FILE_PATH" | grep -qE "^src/components/ui/"; then
        SCORE_COMPONENT=$((SCORE_COMPONENT + 5))
    fi

    # View components - medium complexity, can often delegate
    if echo "$FILE_PATH" | grep -qE "^src/components/views/"; then
        SCORE_MEDIUM_COMPONENT=$((SCORE_MEDIUM_COMPONENT + 4))
    fi

    # Test files - delegate
    if echo "$FILE_PATH" | grep -qE "\.(test|spec)\.(js|jsx|ts|tsx)"; then
        SCORE_TEST=$((SCORE_TEST + 5))
    fi

    # Reducer files - Claude only
    if echo "$FILE_PATH" | grep -qE "^src/reducers/"; then
        SCORE_CLAUDE=$((SCORE_CLAUDE + 10))
    fi

    # Hook files - Claude only
    if echo "$FILE_PATH" | grep -qE "^src/hooks/"; then
        SCORE_CLAUDE=$((SCORE_CLAUDE + 8))
    fi

    # Context files - Claude only
    if echo "$FILE_PATH" | grep -qE "^src/contexts/"; then
        SCORE_CLAUDE=$((SCORE_CLAUDE + 10))
    fi
fi

# =============================================================================
# TIER 3: SIZE/COMPLEXITY INDICATORS (Expanded limits)
# =============================================================================

# Small size → delegate (expanded from 80 to 200)
if echo "$TASK_LOWER" | grep -qE "(< *200|under 200|< *150|under 150|< *100|under 100|small|simple|basic)"; then
    SCORE_UTILITY=$((SCORE_UTILITY + 3))
    SCORE_COMPONENT=$((SCORE_COMPONENT + 3))
fi

# Medium size → can still delegate (new category)
if echo "$TASK_LOWER" | grep -qE "(< *300|under 300|medium|moderate)"; then
    SCORE_MEDIUM_COMPONENT=$((SCORE_MEDIUM_COMPONENT + 4))
fi

# Large/complex → Claude
if echo "$TASK_LOWER" | grep -qE "(> *300|over 300|> *400|large|complex|novel|unique|custom)"; then
    SCORE_CLAUDE=$((SCORE_CLAUDE + 5))
fi

# Few props → delegate
if echo "$TASK_LOWER" | grep -qE "(< *5 props|few props|simple props|no props|minimal props)"; then
    SCORE_COMPONENT=$((SCORE_COMPONENT + 2))
fi

# Many props → Claude
if echo "$TASK_LOWER" | grep -qE "(many props|5\+ props|complex props|> *8 props)"; then
    SCORE_CLAUDE=$((SCORE_CLAUDE + 3))
fi

# =============================================================================
# TIER 4: KEYWORD SCORING (Bias toward delegation)
# =============================================================================

# Strong utility signals
echo "$TASK_LOWER" | grep -qE "(pure function|utility|helper|transform|format|validate|calculate)" && SCORE_UTILITY=$((SCORE_UTILITY + 3))
echo "$TASK_LOWER" | grep -qE "(no side effects|stateless|data transformation|array|object|string)" && SCORE_UTILITY=$((SCORE_UTILITY + 2))

# Strong component signals
echo "$TASK_LOWER" | grep -qE "(presentational|display|ui|visual|styled|simple component)" && SCORE_COMPONENT=$((SCORE_COMPONENT + 3))
echo "$TASK_LOWER" | grep -qE "(button|badge|card|modal|tooltip|icon|label|indicator)" && SCORE_COMPONENT=$((SCORE_COMPONENT + 2))

# Medium component signals (with hooks/state)
echo "$TASK_LOWER" | grep -qE "(useState|local state|toggle|expand|collapse|visible)" && SCORE_MEDIUM_COMPONENT=$((SCORE_MEDIUM_COMPONENT + 3))
echo "$TASK_LOWER" | grep -qE "(form field|input|dropdown|select|checkbox)" && SCORE_MEDIUM_COMPONENT=$((SCORE_MEDIUM_COMPONENT + 2))

# Refactor signals
echo "$TASK_LOWER" | grep -qE "(refactor|rename|extract|move|restructure|reorganize|clean up)" && SCORE_REFACTOR=$((SCORE_REFACTOR + 4))
echo "$TASK_LOWER" | grep -qE "(simplify|deduplicate|consolidate|split)" && SCORE_REFACTOR=$((SCORE_REFACTOR + 2))

# Documentation signals
echo "$TASK_LOWER" | grep -qE "(document|jsdoc|comment|readme|changelog|explain)" && SCORE_DOC=$((SCORE_DOC + 4))

# Test signals
echo "$TASK_LOWER" | grep -qE "(test|spec|coverage|assert|expect|mock|unit test)" && SCORE_TEST=$((SCORE_TEST + 4))

# Claude-required signals (must overcome default delegation)
echo "$TASK_LOWER" | grep -qE "(global state|cross-component|shared state)" && SCORE_CLAUDE=$((SCORE_CLAUDE + 5))
echo "$TASK_LOWER" | grep -qE "(useCallback|useMemo|useEffect|custom hook)" && SCORE_CLAUDE=$((SCORE_CLAUDE + 4))
echo "$TASK_LOWER" | grep -qE "(business logic|algorithm|complex logic)" && SCORE_CLAUDE=$((SCORE_CLAUDE + 3))
echo "$TASK_LOWER" | grep -qE "(debugging|investigation|why|root cause)" && SCORE_CLAUDE=$((SCORE_CLAUDE + 5))

# =============================================================================
# DETERMINE WINNER (Bias toward delegation)
# =============================================================================

MAX_SCORE=0
WINNER="simple_utility"  # Default to delegation
MODEL="deepseek"

# Claude-required checks first (must score high to override)
if [ $SCORE_CLAUDE -ge 8 ]; then
    MAX_SCORE=$SCORE_CLAUDE
    WINNER="claude_required"
    MODEL="claude"
fi

# Delegation categories
if [ $SCORE_UTILITY -gt $MAX_SCORE ]; then
    MAX_SCORE=$SCORE_UTILITY
    WINNER="simple_utility"
    MODEL="deepseek"
fi

if [ $SCORE_COMPONENT -gt $MAX_SCORE ]; then
    MAX_SCORE=$SCORE_COMPONENT
    WINNER="simple_component"
    MODEL="qwen"
fi

if [ $SCORE_MEDIUM_COMPONENT -gt $MAX_SCORE ]; then
    MAX_SCORE=$SCORE_MEDIUM_COMPONENT
    WINNER="medium_component"
    MODEL="qwen"
fi

if [ $SCORE_REFACTOR -gt $MAX_SCORE ]; then
    MAX_SCORE=$SCORE_REFACTOR
    WINNER="refactor"
    MODEL="qwen"
fi

if [ $SCORE_DOC -gt $MAX_SCORE ]; then
    MAX_SCORE=$SCORE_DOC
    WINNER="documentation"
    MODEL="qwen"
fi

if [ $SCORE_TEST -gt $MAX_SCORE ]; then
    MAX_SCORE=$SCORE_TEST
    WINNER="test_generation"
    MODEL="qwen"
fi

# =============================================================================
# DETERMINE CONFIDENCE
# =============================================================================

CONFIDENCE="low"

if [ $MAX_SCORE -ge 8 ]; then
    CONFIDENCE="high"
elif [ $MAX_SCORE -ge 5 ]; then
    CONFIDENCE="medium"
fi

# Reduce confidence if Claude score is close
if [ "$WINNER" != "claude_required" ] && [ $SCORE_CLAUDE -ge 4 ]; then
    if [ "$CONFIDENCE" = "high" ]; then
        CONFIDENCE="medium"
    elif [ "$CONFIDENCE" = "medium" ]; then
        CONFIDENCE="low"
    fi
fi

# If no strong signals at all, default to simple_utility with low confidence
# This implements reverse-default: delegate unless proven otherwise
if [ $MAX_SCORE -lt 3 ]; then
    WINNER="simple_utility"
    MODEL="deepseek"
    CONFIDENCE="low"
fi

echo "${WINNER}:${CONFIDENCE}:${MODEL}"

# =============================================================================
# OPTIONAL: VERBOSE OUTPUT (uncomment for debugging)
# =============================================================================
# echo "Scores:" >&2
# echo "  utility:         $SCORE_UTILITY" >&2
# echo "  component:       $SCORE_COMPONENT" >&2
# echo "  medium_component:$SCORE_MEDIUM_COMPONENT" >&2
# echo "  refactor:        $SCORE_REFACTOR" >&2
# echo "  doc:             $SCORE_DOC" >&2
# echo "  test:            $SCORE_TEST" >&2
# echo "  claude:          $SCORE_CLAUDE" >&2
# echo "Winner: $WINNER ($MAX_SCORE) - Confidence: $CONFIDENCE - Model: $MODEL" >&2
