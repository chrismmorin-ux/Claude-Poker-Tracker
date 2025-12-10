#!/bin/bash
# suggest-command.sh - Suggest which command to use based on task classification
#
# Usage: bash suggest-command.sh "task description"
# Output: Suggested command and reasoning with confidence level

set -e

TASK="$1"

if [ -z "$TASK" ]; then
    echo "Usage: $0 \"task description\"" >&2
    echo "" >&2
    echo "Example:" >&2
    echo "  bash $0 \"Create a utility function to format dates\"" >&2
    exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Try v2 classifier first, fall back to v1
if [ -f "$SCRIPT_DIR/task-classifier-v2.sh" ]; then
    RESULT=$("$SCRIPT_DIR/task-classifier-v2.sh" "$TASK")
    CLASSIFICATION="${RESULT%%:*}"
    CONFIDENCE="${RESULT##*:}"
else
    CLASSIFICATION=$("$SCRIPT_DIR/task-classifier.sh" "$TASK")
    CONFIDENCE="medium"
fi

# =============================================================================
# CONFIDENCE INDICATOR
# =============================================================================

get_confidence_indicator() {
    case "$1" in
        high)   echo "🟢" ;;
        medium) echo "🟡" ;;
        low)    echo "🔴" ;;
        *)      echo "⚪" ;;
    esac
}

CONF_ICON=$(get_confidence_indicator "$CONFIDENCE")

# =============================================================================
# SUGGESTION ENGINE
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Task Classification: $CLASSIFICATION"
echo "$CONF_ICON Confidence: $CONFIDENCE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Add confidence-based warnings
if [ "$CONFIDENCE" = "low" ]; then
    echo "⚠️  LOW CONFIDENCE - Manual review recommended"
    echo "   The classifier is uncertain. Consider /route for detailed analysis."
    echo ""
fi

case "$CLASSIFICATION" in
    simple_utility)
        echo "✅ Recommended: DeepSeek (local model)"
        echo ""
        echo "Reasoning:"
        echo "  - Task appears to be a simple utility function (< 80 lines)"
        echo "  - DeepSeek is good at isolated code generation"
        echo "  - Expected generation time: ~30-45 seconds"
        echo ""
        echo "Suggested Command:"
        echo "  /local-code $TASK"
        echo ""
        if [ "$CONFIDENCE" = "high" ]; then
            echo "💚 HIGH CONFIDENCE - Safe to auto-delegate"
        fi
        echo ""
        echo "💡 Tip: Review output with Claude to fix import paths and export style"
        echo "   Expected token savings: 70-85%"
        ;;

    simple_component)
        echo "✅ Recommended: DeepSeek (local model)"
        echo ""
        echo "Reasoning:"
        echo "  - Task appears to be a simple React component (< 100 lines, < 5 props)"
        echo "  - DeepSeek can handle basic UI components"
        echo "  - Expected generation time: ~30-45 seconds"
        echo ""
        echo "Suggested Command:"
        echo "  /local-code $TASK"
        echo ""
        if [ "$CONFIDENCE" = "high" ]; then
            echo "💚 HIGH CONFIDENCE - Safe to auto-delegate"
        fi
        echo ""
        echo "💡 Tip: Review output with Claude to fix:"
        echo "   - Import paths (count directories explicitly)"
        echo "   - Export style (must be named export)"
        echo "   - Props vs local constants"
        echo "   Expected token savings: 70-85%"
        ;;

    refactor)
        echo "✅ Recommended: Qwen (local model)"
        echo ""
        echo "Reasoning:"
        echo "  - Task is refactoring/renaming (Qwen's strength)"
        echo "  - Qwen is very fast at mechanical changes"
        echo "  - Expected generation time: ~3-10 seconds"
        echo ""
        echo "Suggested Command:"
        echo "  /local-refactor $TASK"
        echo ""
        if [ "$CONFIDENCE" = "high" ]; then
            echo "💚 HIGH CONFIDENCE - Safe to auto-delegate"
        fi
        echo ""
        echo "💡 Tip: Qwen preserves existing code well but may over-explain"
        echo "   Add 'code only, no explanations' to prompt if needed"
        ;;

    documentation)
        echo "✅ Recommended: Qwen (local model)"
        echo ""
        echo "Reasoning:"
        echo "  - Task is documentation/comments (Qwen's strength)"
        echo "  - Qwen produces good technical documentation"
        echo "  - Expected generation time: ~5-15 seconds"
        echo ""
        echo "Suggested Command:"
        echo "  /local-doc $TASK"
        echo ""
        if [ "$CONFIDENCE" = "high" ]; then
            echo "💚 HIGH CONFIDENCE - Safe to auto-delegate"
        fi
        echo ""
        echo "💡 Tip: Specify JSDoc vs inline comments vs README"
        ;;

    test_generation)
        echo "✅ Recommended: Qwen (local model)"
        echo ""
        echo "Reasoning:"
        echo "  - Task is test generation"
        echo "  - Qwen can produce good unit test structure"
        echo "  - Expected generation time: ~10-20 seconds"
        echo ""
        echo "Suggested Command:"
        echo "  /local-test $TASK"
        echo ""
        if [ "$CONFIDENCE" = "high" ]; then
            echo "💚 HIGH CONFIDENCE - Safe to auto-delegate"
        fi
        echo ""
        echo "💡 Tip: May need Claude review for complex mocks/integration"
        ;;

    complex)
        echo "⚠️  Recommended: Consider decomposition"
        echo ""
        echo "Reasoning:"
        echo "  - Task appears moderately complex"
        echo "  - May benefit from breaking into smaller tasks"
        echo "  - Local models might need significant fixes"
        echo ""
        echo "Options:"
        echo "  1. Use /cto-decompose to break into subtasks"
        echo "  2. Describe directly to Claude"
        echo "  3. Try /local-code (may need fixes)"
        echo ""
        echo "💡 Tip: Decomposition often identifies delegatable subtasks"
        ;;

    claude_required)
        echo "🔴 Recommended: Claude (REQUIRED)"
        echo ""
        echo "Reasoning:"
        echo "  - Task involves:"
        echo "    • State management (reducers, complex hooks)"
        echo "    • Integration code (connecting multiple pieces)"
        echo "    • Multi-file changes"
        echo "    • Complex business logic requiring project understanding"
        echo ""
        echo "Suggested Command:"
        echo "  Just describe the task to Claude directly"
        echo ""
        echo "⚠️  Do NOT use local models for this - they will produce low-quality"
        echo "   output requiring more Claude tokens to fix than direct generation"
        ;;

    *)
        echo "❓ Unknown classification: $CLASSIFICATION"
        echo ""
        echo "Defaulting to: Claude (safest option)"
        ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
