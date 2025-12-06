#!/bin/bash
# task-classifier.sh - Classify task complexity (local vs claude vs unsure)

TASK="$1"

if [ -z "$TASK" ]; then
    echo "Usage: $0 <task_description>"
    exit 1
fi

# Convert to lowercase for easier matching
TASK_LOWER=$(echo "$TASK" | tr '[:upper:]' '[:lower:]')

# Initialize scores
LOCAL_SCORE=0
CLAUDE_SCORE=0

# High confidence local keywords (simple, mechanical tasks)
LOCAL_HIGH=("rename" "comment" "format" "typo" "capitalize" "lowercase" "uppercase" "trim" "add comment" "remove comment")
LOCAL_MEDIUM=("refactor" "extract" "split" "combine" "test" "unit test" "document" "jsdoc" "explain")
LOCAL_LOW=("generate" "create" "write" "boilerplate" "utility" "helper")

# High confidence Claude keywords (complex, analytical tasks)
CLAUDE_HIGH=("debug" "fix bug" "architecture" "design" "optimize" "performance" "security" "vulnerability" "review" "analyze deeply")
CLAUDE_MEDIUM=("feature" "implement" "add feature" "new feature" "integrate" "migration" "upgrade")
CLAUDE_LOW=("improve" "enhance" "update" "modify" "change")

# Check for high-confidence local keywords
for keyword in "${LOCAL_HIGH[@]}"; do
    if echo "$TASK_LOWER" | grep -q "$keyword"; then
        LOCAL_SCORE=$((LOCAL_SCORE + 3))
    fi
done

# Check for medium-confidence local keywords
for keyword in "${LOCAL_MEDIUM[@]}"; do
    if echo "$TASK_LOWER" | grep -q "$keyword"; then
        LOCAL_SCORE=$((LOCAL_SCORE + 2))
    fi
done

# Check for low-confidence local keywords
for keyword in "${LOCAL_LOW[@]}"; do
    if echo "$TASK_LOWER" | grep -q "$keyword"; then
        LOCAL_SCORE=$((LOCAL_SCORE + 1))
    fi
done

# Check for high-confidence Claude keywords
for keyword in "${CLAUDE_HIGH[@]}"; do
    if echo "$TASK_LOWER" | grep -q "$keyword"; then
        CLAUDE_SCORE=$((CLAUDE_SCORE + 3))
    fi
done

# Check for medium-confidence Claude keywords
for keyword in "${CLAUDE_MEDIUM[@]}"; do
    if echo "$TASK_LOWER" | grep -q "$keyword"; then
        CLAUDE_SCORE=$((CLAUDE_SCORE + 2))
    fi
done

# Check for low-confidence Claude keywords
for keyword in "${CLAUDE_LOW[@]}"; do
    if echo "$TASK_LOWER" | grep -q "$keyword"; then
        CLAUDE_SCORE=$((CLAUDE_SCORE + 1))
    fi
done

# File count analysis (more files = more complex = Claude territory)
FILE_COUNT=$(echo "$TASK" | grep -o -i "\.jsx\|\.js\|\.ts\|\.tsx\|\.py\|\.java" | wc -l)
if [ "$FILE_COUNT" -gt 3 ]; then
    CLAUDE_SCORE=$((CLAUDE_SCORE + 2))
elif [ "$FILE_COUNT" -gt 1 ]; then
    CLAUDE_SCORE=$((CLAUDE_SCORE + 1))
fi

# Check for multi-file indicators
if echo "$TASK_LOWER" | grep -q -E "across|throughout|all files|multiple files|entire codebase|whole project"; then
    CLAUDE_SCORE=$((CLAUDE_SCORE + 2))
fi

# Decision logic with confidence
if [ $LOCAL_SCORE -ge 3 ] && [ $CLAUDE_SCORE -eq 0 ]; then
    echo "local:high"
elif [ $LOCAL_SCORE -ge 2 ] && [ $CLAUDE_SCORE -le 1 ]; then
    echo "local:medium"
elif [ $CLAUDE_SCORE -ge 3 ] && [ $LOCAL_SCORE -eq 0 ]; then
    echo "claude:high"
elif [ $CLAUDE_SCORE -ge 2 ] && [ $LOCAL_SCORE -le 1 ]; then
    echo "claude:medium"
elif [ $LOCAL_SCORE -gt $CLAUDE_SCORE ]; then
    echo "local:low"
elif [ $CLAUDE_SCORE -gt $LOCAL_SCORE ]; then
    echo "claude:low"
else
    echo "unsure"
fi
