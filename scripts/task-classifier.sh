#!/bin/bash
# task-classifier.sh - Analyze task description and classify complexity
#
# Usage: bash task-classifier.sh "task description"
# Output: Classification (simple_utility|simple_component|refactor|complex|claude_required)

set -e

TASK="$1"

if [ -z "$TASK" ]; then
    echo "Usage: $0 \"task description\"" >&2
    exit 1
fi

# Convert to lowercase for matching
TASK_LOWER=$(echo "$TASK" | tr '[:upper:]' '[:lower:]')

# =============================================================================
# DECISION TREE (from LOCAL_MODELS_GUIDE.md)
# =============================================================================

# Check for Claude-required keywords (complex tasks)
if echo "$TASK_LOWER" | grep -qE "(state|reducer|useReducer|context|integration|connect|hook|complex|business logic)"; then
    echo "claude_required"
    exit 0
fi

# Check for multi-file tasks
if echo "$TASK_LOWER" | grep -qE "(multiple files|several files|across files|modify.*and.*modify)"; then
    echo "claude_required"
    exit 0
fi

# Check for refactoring tasks (good for Qwen)
if echo "$TASK_LOWER" | grep -qE "(refactor|rename|extract|move|restructure|reformat)"; then
    echo "refactor"
    exit 0
fi

# Check for utility function keywords
if echo "$TASK_LOWER" | grep -qE "(utility|function|helper|pure function|transform|format|validate)"; then
    # Check if it's too complex
    if echo "$TASK_LOWER" | grep -qE "(state|api|fetch|async|complex)"; then
        echo "complex"
    else
        echo "simple_utility"
    fi
    exit 0
fi

# Check for component keywords
if echo "$TASK_LOWER" | grep -qE "(component|jsx|react|button|badge|card|display)"; then
    # Check complexity indicators
    if echo "$TASK_LOWER" | grep -qE "(5\+ props|many props|complex|integration|state management)"; then
        echo "complex"
    elif echo "$TASK_LOWER" | grep -qE "(simple|small|basic|display|ui)"; then
        echo "simple_component"
    else
        # Medium complexity - check line count mentions
        if echo "$TASK_LOWER" | grep -qE "(< *100|under 100|less than 100|small)"; then
            echo "simple_component"
        else
            echo "complex"
        fi
    fi
    exit 0
fi

# Check for boilerplate/data keywords
if echo "$TASK_LOWER" | grep -qE "(boilerplate|test data|fixture|mock|constant|config)"; then
    echo "simple_utility"
    exit 0
fi

# Check for complex tasks by size mentions
if echo "$TASK_LOWER" | grep -qE "(> *150|over 150|more than 150|large)"; then
    echo "claude_required"
    exit 0
fi

# Default: if uncertain and mentions specific line count < 100, try simple
if echo "$TASK_LOWER" | grep -qE "(< *80|< *100|under 80|under 100)"; then
    echo "simple_utility"
    exit 0
fi

# Default to complex if uncertain (safer)
echo "complex"
