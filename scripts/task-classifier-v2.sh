#!/bin/bash
# task-classifier-v2.sh - Enhanced task classifier with confidence scores
#
# Usage: bash task-classifier-v2.sh "task description"
# Output: classification:confidence (e.g., "simple_utility:high", "claude_required:medium")
#
# Classifications:
#   simple_utility   - Pure functions, data transforms (delegate to /local-code)
#   simple_component - Small React components (delegate to /local-code)
#   refactor         - Rename, extract, restructure (delegate to /local-refactor)
#   documentation    - Comments, docs, README (delegate to /local-doc)
#   test_generation  - Unit tests (delegate to /local-test)
#   complex          - Multi-concern tasks (may need decomposition)
#   claude_required  - State, reducers, hooks, integration (Claude only)
#
# Confidence levels:
#   high   - Strong pattern match, safe to auto-delegate
#   medium - Moderate match, suggest but confirm
#   low    - Weak match, manual review recommended

set -e

TASK="$1"

if [ -z "$TASK" ]; then
    echo "Usage: $0 \"task description\"" >&2
    exit 1
fi

# Convert to lowercase for matching
TASK_LOWER=$(echo "$TASK" | tr '[:upper:]' '[:lower:]')

# =============================================================================
# SCORING SYSTEM
# =============================================================================

# Initialize scores for each classification
SCORE_UTILITY=0
SCORE_COMPONENT=0
SCORE_REFACTOR=0
SCORE_DOC=0
SCORE_TEST=0
SCORE_CLAUDE=0

# =============================================================================
# TIER 1: EXACT PATTERN MATCHING (HIGH CONFIDENCE)
# =============================================================================

# Claude-required patterns (immediate exit)
if echo "$TASK_LOWER" | grep -qE "^(implement|create|add|fix).*(reducer|useReducer|context provider|custom hook)"; then
    echo "claude_required:high"
    exit 0
fi

if echo "$TASK_LOWER" | grep -qE "(state management|global state|cross-reducer|hydration|persistence layer)"; then
    echo "claude_required:high"
    exit 0
fi

# Exact refactor patterns
if echo "$TASK_LOWER" | grep -qE "^rename .+ to .+$"; then
    echo "refactor:high"
    exit 0
fi

if echo "$TASK_LOWER" | grep -qE "^(extract|move) .+ (to|into|from) .+$"; then
    echo "refactor:high"
    exit 0
fi

# Exact test patterns
if echo "$TASK_LOWER" | grep -qE "^(write|create|add|generate) (unit )?tests? for"; then
    echo "test_generation:high"
    exit 0
fi

# Exact doc patterns
if echo "$TASK_LOWER" | grep -qE "^(add|write|update) (jsdoc|documentation|comments|readme)"; then
    echo "documentation:high"
    exit 0
fi

# =============================================================================
# TIER 2: FILE PATH ANALYSIS (HIGH CONFIDENCE)
# =============================================================================

# Check for file paths in the task
if echo "$TASK_LOWER" | grep -qE "src/utils/"; then
    SCORE_UTILITY=$((SCORE_UTILITY + 5))
fi

if echo "$TASK_LOWER" | grep -qE "src/components/ui/"; then
    SCORE_COMPONENT=$((SCORE_COMPONENT + 5))
fi

if echo "$TASK_LOWER" | grep -qE "src/reducers/"; then
    SCORE_CLAUDE=$((SCORE_CLAUDE + 8))
fi

if echo "$TASK_LOWER" | grep -qE "src/hooks/"; then
    SCORE_CLAUDE=$((SCORE_CLAUDE + 6))
fi

if echo "$TASK_LOWER" | grep -qE "src/contexts/"; then
    SCORE_CLAUDE=$((SCORE_CLAUDE + 8))
fi

if echo "$TASK_LOWER" | grep -qE "src/components/views/"; then
    # Views are often complex
    SCORE_CLAUDE=$((SCORE_CLAUDE + 3))
    SCORE_COMPONENT=$((SCORE_COMPONENT + 2))
fi

if echo "$TASK_LOWER" | grep -qE "\.(test|spec)\.(js|jsx|ts|tsx)"; then
    SCORE_TEST=$((SCORE_TEST + 5))
fi

# =============================================================================
# TIER 3: KEYWORD SCORING
# =============================================================================

# Utility function indicators
echo "$TASK_LOWER" | grep -qE "(pure function|utility|helper|transform|format|validate|calculate)" && SCORE_UTILITY=$((SCORE_UTILITY + 3))
echo "$TASK_LOWER" | grep -qE "(no side effects|stateless|data transformation)" && SCORE_UTILITY=$((SCORE_UTILITY + 3))
echo "$TASK_LOWER" | grep -qE "(array|object|string) (manipulation|processing)" && SCORE_UTILITY=$((SCORE_UTILITY + 2))

# Component indicators
echo "$TASK_LOWER" | grep -qE "(component|jsx|react|button|badge|card|modal|tooltip)" && SCORE_COMPONENT=$((SCORE_COMPONENT + 2))
echo "$TASK_LOWER" | grep -qE "(simple|basic|small|display|presentational|ui)" && SCORE_COMPONENT=$((SCORE_COMPONENT + 2))
echo "$TASK_LOWER" | grep -qE "(< *100 lines|under 100|less than 100)" && SCORE_COMPONENT=$((SCORE_COMPONENT + 2))

# Refactor indicators
echo "$TASK_LOWER" | grep -qE "(refactor|rename|extract|move|restructure|reorganize|reformat)" && SCORE_REFACTOR=$((SCORE_REFACTOR + 4))
echo "$TASK_LOWER" | grep -qE "(clean up|simplify|deduplicate|consolidate)" && SCORE_REFACTOR=$((SCORE_REFACTOR + 2))

# Documentation indicators
echo "$TASK_LOWER" | grep -qE "(document|jsdoc|comment|readme|changelog)" && SCORE_DOC=$((SCORE_DOC + 4))
echo "$TASK_LOWER" | grep -qE "(explain|describe|annotate)" && SCORE_DOC=$((SCORE_DOC + 2))

# Test indicators
echo "$TASK_LOWER" | grep -qE "(test|spec|coverage|assert|expect|mock)" && SCORE_TEST=$((SCORE_TEST + 3))
echo "$TASK_LOWER" | grep -qE "(unit test|integration test|test case)" && SCORE_TEST=$((SCORE_TEST + 2))

# Claude-required indicators (negative scores for delegation)
echo "$TASK_LOWER" | grep -qE "(state|reducer|useReducer)" && SCORE_CLAUDE=$((SCORE_CLAUDE + 4))
echo "$TASK_LOWER" | grep -qE "(context|provider|consumer)" && SCORE_CLAUDE=$((SCORE_CLAUDE + 4))
echo "$TASK_LOWER" | grep -qE "(hook|useCallback|useMemo|useEffect)" && SCORE_CLAUDE=$((SCORE_CLAUDE + 3))
echo "$TASK_LOWER" | grep -qE "(integration|connect|wire up|orchestrat)" && SCORE_CLAUDE=$((SCORE_CLAUDE + 4))
echo "$TASK_LOWER" | grep -qE "(complex|business logic|algorithm)" && SCORE_CLAUDE=$((SCORE_CLAUDE + 3))
echo "$TASK_LOWER" | grep -qE "(multiple files|several files|across files)" && SCORE_CLAUDE=$((SCORE_CLAUDE + 5))
echo "$TASK_LOWER" | grep -qE "(persistence|database|indexeddb|storage)" && SCORE_CLAUDE=$((SCORE_CLAUDE + 4))

# =============================================================================
# TIER 4: SIZE/COMPLEXITY INDICATORS
# =============================================================================

# Small size indicators boost delegation scores
if echo "$TASK_LOWER" | grep -qE "(< *80|under 80|< *50|under 50)"; then
    SCORE_UTILITY=$((SCORE_UTILITY + 3))
    SCORE_COMPONENT=$((SCORE_COMPONENT + 3))
fi

# Large size indicators boost Claude score
if echo "$TASK_LOWER" | grep -qE "(> *150|over 150|> *200|over 200|large|complex)"; then
    SCORE_CLAUDE=$((SCORE_CLAUDE + 4))
fi

# Prop count for components
if echo "$TASK_LOWER" | grep -qE "(< *5 props|few props|simple props)"; then
    SCORE_COMPONENT=$((SCORE_COMPONENT + 2))
fi

if echo "$TASK_LOWER" | grep -qE "(many props|5\+ props|complex props)"; then
    SCORE_CLAUDE=$((SCORE_CLAUDE + 3))
fi

# =============================================================================
# DETERMINE WINNER
# =============================================================================

# Find the highest scoring classification
MAX_SCORE=0
WINNER="complex"

if [ $SCORE_CLAUDE -gt $MAX_SCORE ]; then
    MAX_SCORE=$SCORE_CLAUDE
    WINNER="claude_required"
fi

if [ $SCORE_UTILITY -gt $MAX_SCORE ]; then
    MAX_SCORE=$SCORE_UTILITY
    WINNER="simple_utility"
fi

if [ $SCORE_COMPONENT -gt $MAX_SCORE ]; then
    MAX_SCORE=$SCORE_COMPONENT
    WINNER="simple_component"
fi

if [ $SCORE_REFACTOR -gt $MAX_SCORE ]; then
    MAX_SCORE=$SCORE_REFACTOR
    WINNER="refactor"
fi

if [ $SCORE_DOC -gt $MAX_SCORE ]; then
    MAX_SCORE=$SCORE_DOC
    WINNER="documentation"
fi

if [ $SCORE_TEST -gt $MAX_SCORE ]; then
    MAX_SCORE=$SCORE_TEST
    WINNER="test_generation"
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

# Special case: if Claude score is high but another score is also high, reduce confidence
if [ "$WINNER" != "claude_required" ] && [ $SCORE_CLAUDE -ge 4 ]; then
    if [ "$CONFIDENCE" = "high" ]; then
        CONFIDENCE="medium"
    elif [ "$CONFIDENCE" = "medium" ]; then
        CONFIDENCE="low"
    fi
fi

# If no clear winner (max score too low), default to complex with low confidence
if [ $MAX_SCORE -lt 3 ]; then
    WINNER="complex"
    CONFIDENCE="low"
fi

echo "${WINNER}:${CONFIDENCE}"

# =============================================================================
# OPTIONAL: VERBOSE OUTPUT (uncomment for debugging)
# =============================================================================
# echo "Scores:" >&2
# echo "  utility:    $SCORE_UTILITY" >&2
# echo "  component:  $SCORE_COMPONENT" >&2
# echo "  refactor:   $SCORE_REFACTOR" >&2
# echo "  doc:        $SCORE_DOC" >&2
# echo "  test:       $SCORE_TEST" >&2
# echo "  claude:     $SCORE_CLAUDE" >&2
# echo "Winner: $WINNER ($MAX_SCORE) - Confidence: $CONFIDENCE" >&2
