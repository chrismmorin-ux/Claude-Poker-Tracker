#!/bin/bash
# select-model.sh - Auto-select local model (qwen or deepseek) based on task
#
# Used by call-local-model.sh when MODEL_CHOICE="auto"
# Usage: bash select-model.sh "task description"
# Output: "qwen" or "deepseek"

set -e

TASK="$1"

if [ -z "$TASK" ]; then
    echo "Usage: $0 \"task description\"" >&2
    exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Classify the task
CLASSIFICATION=$("$SCRIPT_DIR/task-classifier.sh" "$TASK")

# Map classification to model choice
case "$CLASSIFICATION" in
    refactor)
        # Qwen is best for refactoring
        echo "qwen"
        ;;
    
    simple_utility|simple_component|complex)
        # DeepSeek for code generation
        echo "deepseek"
        ;;
    
    claude_required)
        # Default to deepseek (user explicitly chose to use local model)
        # They can ignore the output if they realize it's too complex
        echo "deepseek"
        ;;
    
    *)
        # Default to deepseek
        echo "deepseek"
        ;;
esac
