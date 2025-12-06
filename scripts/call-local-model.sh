#!/bin/bash
# call-local-model.sh - Call LM Studio API with the appropriate model

set -e  # Exit on error

# Configuration
LM_STUDIO_URL="http://10.0.0.230:1234"
QWEN_MODEL="qwen2.5-coder-7b-instruct"
DEEPSEEK_MODEL="deepseek-coder-7b-instruct-v1.5"

# Parse arguments
MODEL_CHOICE="$1"
TASK="$2"

if [ -z "$TASK" ]; then
    echo "Usage: $0 <model> <task>"
    echo "  model: 'qwen', 'deepseek', or 'auto'"
    echo "  task: description of the task to perform"
    exit 1
fi

# Auto-select model if needed
if [ "$MODEL_CHOICE" = "auto" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    MODEL_CHOICE=$("$SCRIPT_DIR/select-model.sh" "$TASK")
fi

# Set the model name based on choice
if [ "$MODEL_CHOICE" = "qwen" ]; then
    MODEL_NAME="$QWEN_MODEL"
    MODEL_DISPLAY="Qwen 2.5 Coder 7B"
elif [ "$MODEL_CHOICE" = "deepseek" ]; then
    MODEL_NAME="$DEEPSEEK_MODEL"
    MODEL_DISPLAY="DeepSeek Coder 7B"
else
    echo "Error: Unknown model choice: $MODEL_CHOICE"
    exit 1
fi

# Get current working directory context (optional - adds relevant file info)
CONTEXT=""
if [ -f "$(pwd)/src/PokerTracker.jsx" ]; then
    CONTEXT="Context: Working in Claude Poker Tracker project. Main file: src/PokerTracker.jsx"
fi

# Build the system prompt
SYSTEM_PROMPT="You are an expert coding assistant. Provide concise, accurate code solutions. $CONTEXT"

# Build the JSON payload using Python for proper escaping
JSON_PAYLOAD=$(python -c "
import json, sys
payload = {
    'model': '$MODEL_NAME',
    'messages': [
        {'role': 'system', 'content': '''$SYSTEM_PROMPT'''},
        {'role': 'user', 'content': '''$TASK'''}
    ],
    'temperature': 0.3,
    'max_tokens': 2000
}
print(json.dumps(payload))
")

# Display which model we're using
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 Using: $MODEL_DISPLAY"
echo "📝 Task: $TASK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Make the API call
RESPONSE=$(curl -s -X POST "$LM_STUDIO_URL/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -d "$JSON_PAYLOAD" 2>&1)

# Check if curl failed
if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to connect to LM Studio server"
    echo ""
    echo "Response: $RESPONSE"
    exit 1
fi

# Parse the response and extract the content
# Using Python for reliable JSON parsing (available in Git Bash via Python)
CONTENT=$(echo "$RESPONSE" | python -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data['choices'][0]['message']['content'])
except Exception as e:
    pass
" 2>/dev/null)

# If Python parsing failed, try simple grep/sed as fallback
if [ -z "$CONTENT" ]; then
    # Remove newlines and parse
    CONTENT=$(echo "$RESPONSE" | tr -d '\n' | sed -n 's/.*"content":"\([^"]*\)".*/\1/p')
fi

if [ -z "$CONTENT" ]; then
    echo "❌ Error: Failed to parse response from LM Studio"
    echo ""
    echo "Raw response:"
    echo "$RESPONSE"
    exit 1
fi

# Display the result
echo "💡 Result:"
echo ""
echo "$CONTENT"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Task completed using local model"
echo "💰 Claude tokens saved!"
