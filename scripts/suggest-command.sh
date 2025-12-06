#!/bin/bash
# suggest-command.sh - Suggest which command to use based on task classification
#
# Usage: bash suggest-command.sh "task description"
# Output: Suggested command and reasoning

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

# Classify the task
CLASSIFICATION=$("$SCRIPT_DIR/task-classifier.sh" "$TASK")

# =============================================================================
# SUGGESTION ENGINE
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Task Classification: $CLASSIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

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
        echo "Alternative (with template):"
        echo "  bash ./scripts/call-local-model.sh deepseek \"\$(cat .claude/prompts/utility-function.md)"
        echo ""
        echo "  Task: $TASK\""
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
        echo "Alternative (with template):"
        echo "  bash ./scripts/call-local-model.sh deepseek \"\$(cat .claude/prompts/react-component.md)"
        echo ""
        echo "  Task: $TASK\""
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
        echo "Alternative:"
        echo "  bash ./scripts/call-local-model.sh qwen \"$TASK\""
        echo ""
        echo "💡 Tip: Qwen preserves existing code well but may over-explain"
        echo "   Add 'code only, no explanations' to prompt if needed"
        ;;

    complex)
        echo "⚠️  Recommended: Claude"
        echo ""
        echo "Reasoning:"
        echo "  - Task appears moderately complex"
        echo "  - May require project context or multiple integrations"
        echo "  - Local models might need significant fixes (5-10 min overhead)"
        echo ""
        echo "Suggested Command:"
        echo "  Just describe the task to Claude directly"
        echo ""
        echo "Alternative (if you want to try local first):"
        echo "  /local-code $TASK"
        echo ""
        echo "  Then review with Claude (may not save tokens if fixes are extensive)"
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
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
