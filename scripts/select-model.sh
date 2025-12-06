#!/bin/bash
# select-model.sh - Automatically select best model based on task description

TASK="$1"

# Convert to lowercase for easier matching
TASK_LOWER=$(echo "$TASK" | tr '[:upper:]' '[:lower:]')

# Keywords that suggest Qwen (better at refactoring, understanding existing code)
QWEN_KEYWORDS=("refactor" "rename" "extract" "test" "document" "comment" "explain" "understand" "analyze" "review" "fix" "bug")

# Keywords that suggest DeepSeek (better at generation, creating new code)
DEEPSEEK_KEYWORDS=("generate" "create" "write" "build" "implement" "add" "boilerplate" "scaffold" "template")

# Check for Qwen keywords
for keyword in "${QWEN_KEYWORDS[@]}"; do
    if echo "$TASK_LOWER" | grep -q "$keyword"; then
        echo "qwen"
        exit 0
    fi
done

# Check for DeepSeek keywords
for keyword in "${DEEPSEEK_KEYWORDS[@]}"; do
    if echo "$TASK_LOWER" | grep -q "$keyword"; then
        echo "deepseek"
        exit 0
    fi
done

# Default to Qwen (safer, more conservative choice)
echo "qwen"
