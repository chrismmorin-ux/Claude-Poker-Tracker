#!/bin/bash
# suggest-command.sh - Suggest the best command/approach for a task

TASK="$1"

if [ -z "$TASK" ]; then
    echo "Usage: $0 <task_description>"
    exit 1
fi

# Get classification from task-classifier
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLASSIFICATION=$("$SCRIPT_DIR/task-classifier.sh" "$TASK")

# Extract decision and confidence
DECISION=$(echo "$CLASSIFICATION" | cut -d: -f1)
CONFIDENCE=$(echo "$CLASSIFICATION" | cut -d: -f2)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤔 Task Analysis"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Task: \"$TASK\""
echo ""

# Provide suggestion based on classification
case "$DECISION" in
    "local")
        echo "✅ Recommendation: Use LOCAL MODEL"
        echo ""
        case "$CONFIDENCE" in
            "high")
                echo "Confidence: ⭐⭐⭐ HIGH"
                echo ""
                echo "This is a perfect task for local models. You'll save Claude tokens"
                echo "and get fast results!"
                ;;
            "medium")
                echo "Confidence: ⭐⭐ MEDIUM"
                echo ""
                echo "This task should work well with local models, though Claude might"
                echo "provide slightly better quality."
                ;;
            "low")
                echo "Confidence: ⭐ LOW"
                echo ""
                echo "Local models might work, but consider Claude if quality is critical."
                ;;
        esac
        echo ""
        echo "📝 Suggested commands:"

        # Suggest specific command based on task keywords
        TASK_LOWER=$(echo "$TASK" | tr '[:upper:]' '[:lower:]')
        if echo "$TASK_LOWER" | grep -q -E "refactor|rename|extract"; then
            echo "  • /local-refactor $TASK"
        elif echo "$TASK_LOWER" | grep -q -E "test|unit test"; then
            echo "  • /local-test $TASK"
        elif echo "$TASK_LOWER" | grep -q -E "document|comment|jsdoc"; then
            echo "  • /local-doc $TASK"
        elif echo "$TASK_LOWER" | grep -q -E "generate|create|boilerplate"; then
            echo "  • /local-code $TASK"
        else
            echo "  • /local $TASK"
        fi
        echo ""
        echo "💰 Estimated token savings: 500-1500 tokens"
        ;;

    "claude")
        echo "✅ Recommendation: Use CLAUDE"
        echo ""
        case "$CONFIDENCE" in
            "high")
                echo "Confidence: ⭐⭐⭐ HIGH"
                echo ""
                echo "This task requires Claude's advanced capabilities. Local models"
                echo "are unlikely to produce satisfactory results."
                ;;
            "medium")
                echo "Confidence: ⭐⭐ MEDIUM"
                echo ""
                echo "Claude is recommended for this task. Local models might struggle"
                echo "with the complexity."
                ;;
            "low")
                echo "Confidence: ⭐ LOW"
                echo ""
                echo "Claude is probably better, but local models could work if you're"
                echo "willing to iterate."
                ;;
        esac
        echo ""
        echo "📝 Suggested approach:"
        echo "  • Continue using Claude normally (just type your request)"
        echo ""
        echo "Why Claude?"
        TASK_LOWER=$(echo "$TASK" | tr '[:upper:]' '[:lower:]')
        if echo "$TASK_LOWER" | grep -q -E "debug|fix bug"; then
            echo "  → Debugging requires deep code understanding"
        elif echo "$TASK_LOWER" | grep -q -E "architecture|design"; then
            echo "  → Architecture decisions need advanced reasoning"
        elif echo "$TASK_LOWER" | grep -q -E "optimize|performance"; then
            echo "  → Optimization requires performance analysis"
        elif echo "$TASK_LOWER" | grep -q -E "feature|implement"; then
            echo "  → New features need project-wide context"
        else
            echo "  → This task requires Claude's advanced capabilities"
        fi
        ;;

    "unsure")
        echo "⚠️  Recommendation: UNCERTAIN"
        echo ""
        echo "Confidence: ❓ UNSURE"
        echo ""
        echo "This task could go either way. Here are your options:"
        echo ""
        echo "Option 1: Try Local First (Fast, Free)"
        echo "  • /local $TASK"
        echo "  • If result is good → you saved tokens!"
        echo "  • If result is poor → fall back to Claude"
        echo ""
        echo "Option 2: Use Claude (Reliable)"
        echo "  • Continue with Claude normally"
        echo "  • Guaranteed quality"
        echo "  • Higher token usage"
        echo ""
        echo "💡 Suggestion: Try local first. If you're not satisfied with the"
        echo "   result, you can always ask Claude afterward."
        ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
