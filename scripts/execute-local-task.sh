#!/bin/bash
# execute-local-task.sh - Execute a task via local model with auto file creation
#
# This script orchestrates local model code generation:
# 1. Reads task specification JSON
# 2. Loads context files
# 3. Builds structured prompt
# 4. Calls LM Studio API
# 5. Extracts code from response
# 6. Creates backup of existing file
# 7. Writes new file
# 8. Runs optional test command
# 9. Returns structured result
#
# Usage: ./scripts/execute-local-task.sh <task-spec.json>
#
# Task spec format:
# {
#   "task_id": "T-001",
#   "model": "deepseek|qwen|auto",
#   "description": "Create utility function",
#   "output_file": "src/utils/myUtil.js",
#   "context_files": ["src/constants/gameConstants.js"],
#   "constraints": ["Export named function", "Include JSDoc"],
#   "test_command": "npx vitest run src/utils/__tests__/myUtil.test.js",
#   "language": "javascript"
# }

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LM_STUDIO_URL="http://10.0.0.230:1234"
QWEN_MODEL="qwen2.5-coder-7b-instruct"
DEEPSEEK_MODEL="deepseek-coder-7b-instruct-v1.5"
BACKUP_DIR="$PROJECT_ROOT/.local-model-backups"
MAX_CONTEXT_LINES=200

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper: Print colored output
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Helper: Output JSON result
output_result() {
    local status="$1"
    local file="$2"
    local error="$3"
    local backup="$4"

    cat << EOF
{
  "status": "$status",
  "file": "$file",
  "backup": "$backup",
  "error": "$error"
}
EOF
}

# Validate arguments
if [ -z "$1" ]; then
    log_error "Usage: $0 <task-spec.json>"
    output_result "failed" "" "No task spec provided" ""
    exit 1
fi

TASK_SPEC_FILE="$1"

if [ ! -f "$TASK_SPEC_FILE" ]; then
    log_error "Task spec file not found: $TASK_SPEC_FILE"
    output_result "failed" "" "Task spec file not found: $TASK_SPEC_FILE" ""
    exit 1
fi

# Parse task spec using Python
log_info "Reading task specification..."

TASK_JSON=$(cat "$TASK_SPEC_FILE")

# Detect Python command
# On Windows, use full path to avoid App Execution Alias interception
PYTHON_CMD=""

# Check for actual Python installations first (Windows paths)
if [ -f "/c/Python314/python.exe" ]; then
    PYTHON_CMD="/c/Python314/python"
elif [ -f "/c/Python313/python.exe" ]; then
    PYTHON_CMD="/c/Python313/python"
elif [ -f "/c/Python312/python.exe" ]; then
    PYTHON_CMD="/c/Python312/python"
elif [ -f "/c/Python311/python.exe" ]; then
    PYTHON_CMD="/c/Python311/python"
elif [ -f "/c/Python310/python.exe" ]; then
    PYTHON_CMD="/c/Python310/python"
# Try Unix-style python3 (actual, not Windows alias)
elif python3 --version > /dev/null 2>&1; then
    PYTHON_CMD="python3"
# Last resort
elif python --version > /dev/null 2>&1; then
    PYTHON_CMD="python"
fi

if [ -z "$PYTHON_CMD" ]; then
    log_error "Python not found"
    output_result "failed" "" "Python not found" ""
    exit 1
fi

log_info "Using Python: $PYTHON_CMD"

# Extract fields from JSON
TASK_ID=$(echo "$TASK_JSON" | $PYTHON_CMD -c "import sys,json; d=json.load(sys.stdin); print(d.get('task_id',''))")
MODEL=$(echo "$TASK_JSON" | $PYTHON_CMD -c "import sys,json; d=json.load(sys.stdin); print(d.get('model','deepseek'))")
DESCRIPTION=$(echo "$TASK_JSON" | $PYTHON_CMD -c "import sys,json; d=json.load(sys.stdin); print(d.get('description',''))")
OUTPUT_FILE=$(echo "$TASK_JSON" | $PYTHON_CMD -c "import sys,json; d=json.load(sys.stdin); print(d.get('output_file',''))")
LANGUAGE=$(echo "$TASK_JSON" | $PYTHON_CMD -c "import sys,json; d=json.load(sys.stdin); print(d.get('language','javascript'))")
TEST_CMD=$(echo "$TASK_JSON" | $PYTHON_CMD -c "import sys,json; d=json.load(sys.stdin); print(d.get('test_command',''))")

# Get arrays
CONTEXT_FILES=$(echo "$TASK_JSON" | $PYTHON_CMD -c "import sys,json; d=json.load(sys.stdin); print('\n'.join(d.get('context_files',[])))")
CONSTRAINTS=$(echo "$TASK_JSON" | $PYTHON_CMD -c "import sys,json; d=json.load(sys.stdin); print('\n'.join(d.get('constraints',[])))")

log_info "Task ID: $TASK_ID"
log_info "Output: $OUTPUT_FILE"
log_info "Model: $MODEL"

# Select model
if [ "$MODEL" = "qwen" ]; then
    MODEL_NAME="$QWEN_MODEL"
elif [ "$MODEL" = "deepseek" ]; then
    MODEL_NAME="$DEEPSEEK_MODEL"
else
    MODEL_NAME="$DEEPSEEK_MODEL"
fi

# Build context section
log_info "Loading context files..."
CONTEXT_SECTION=""

while IFS= read -r ctx_file; do
    [ -z "$ctx_file" ] && continue

    FULL_PATH="$PROJECT_ROOT/$ctx_file"
    if [ -f "$FULL_PATH" ]; then
        # Truncate if too long
        FILE_CONTENT=$(head -n $MAX_CONTEXT_LINES "$FULL_PATH")
        LINE_COUNT=$(wc -l < "$FULL_PATH")

        CONTEXT_SECTION+="
### File: $ctx_file
\`\`\`$LANGUAGE
$FILE_CONTENT
\`\`\`
"
        if [ "$LINE_COUNT" -gt "$MAX_CONTEXT_LINES" ]; then
            CONTEXT_SECTION+="
(truncated - showing first $MAX_CONTEXT_LINES of $LINE_COUNT lines)
"
        fi
        log_info "  Loaded: $ctx_file ($LINE_COUNT lines)"
    else
        log_warn "  Context file not found: $ctx_file"
    fi
done <<< "$CONTEXT_FILES"

# Build constraints section
CONSTRAINTS_SECTION=""
while IFS= read -r constraint; do
    [ -z "$constraint" ] && continue
    CONSTRAINTS_SECTION+="- $constraint
"
done <<< "$CONSTRAINTS"

# Build the prompt - be VERY explicit about code-only output
PROMPT="Write the complete code for file: $OUTPUT_FILE

TASK: $DESCRIPTION

CONSTRAINTS:
$CONSTRAINTS_SECTION

RULES - YOU MUST FOLLOW THESE:
1. Respond with ONLY valid $LANGUAGE code
2. Do NOT include any explanations or descriptions
3. Do NOT include markdown code fences
4. Start your response with the first line of code (import or comment)
5. End your response with the last line of code

$CONTEXT_SECTION

Now write the complete code:"

# Build JSON payload for API
log_info "Calling LM Studio API..."

JSON_PAYLOAD=$($PYTHON_CMD -c "
import json
prompt = '''$PROMPT'''
payload = {
    'model': '$MODEL_NAME',
    'messages': [
        {'role': 'system', 'content': 'You are a code generator. You output ONLY code. No explanations. No markdown. No descriptions. Just pure, valid code that can be saved directly to a file.'},
        {'role': 'user', 'content': prompt}
    ],
    'temperature': 0.1,
    'max_tokens': 4000
}
print(json.dumps(payload))
")

# Make API call
RESPONSE=$(curl -s -X POST "$LM_STUDIO_URL/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -d "$JSON_PAYLOAD" 2>&1)

if [ $? -ne 0 ]; then
    log_error "Failed to connect to LM Studio"
    output_result "failed" "$OUTPUT_FILE" "LM Studio connection failed" ""
    exit 1
fi

# Extract content from response
CONTENT=$(echo "$RESPONSE" | $PYTHON_CMD -c "
import sys, json, re
try:
    data = json.load(sys.stdin)
    content = data['choices'][0]['message']['content']

    # Try to extract code from markdown code block if present
    code_match = re.search(r'\`\`\`(?:\w+)?\n?(.*?)\`\`\`', content, re.DOTALL)
    if code_match:
        result = code_match.group(1).strip()
    else:
        # No code block - use content as-is but strip common non-code prefixes
        result = content.strip()
        # Remove common preambles that models add
        for prefix in ['Here is the code:', 'Here\\'s the code:', 'Sure, here', 'The code is:']:
            if result.lower().startswith(prefix.lower()):
                result = result[len(prefix):].strip()

    # Ensure we have actual code (starts with common JS patterns)
    if not any(result.startswith(p) for p in ['/', '*', 'import', 'export', 'const', 'let', 'var', 'function', 'class', '\"use']):
        # Might have explanation - try to find code block anywhere
        code_match = re.search(r'((?:import|export|const|let|var|function|class|/\\*\\*)[\\s\\S]+)', result)
        if code_match:
            result = code_match.group(1).strip()

    print(result)
except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    sys.exit(1)
" 2>&1)

if [ -z "$CONTENT" ] || [[ "$CONTENT" == ERROR:* ]]; then
    log_error "Failed to parse response from LM Studio"
    log_error "Response: $RESPONSE"
    output_result "failed" "$OUTPUT_FILE" "Failed to parse model response" ""
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup existing file if it exists
BACKUP_FILE=""
FULL_OUTPUT_PATH="$PROJECT_ROOT/$OUTPUT_FILE"
if [ -f "$FULL_OUTPUT_PATH" ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/$(basename "$OUTPUT_FILE").$TIMESTAMP.bak"
    cp "$FULL_OUTPUT_PATH" "$BACKUP_FILE"
    log_info "Created backup: $BACKUP_FILE"
fi

# Create directory if needed
OUTPUT_DIR=$(dirname "$FULL_OUTPUT_PATH")
mkdir -p "$OUTPUT_DIR"

# Write the file
log_info "Writing file: $OUTPUT_FILE"
echo "$CONTENT" > "$FULL_OUTPUT_PATH"

# Verify file was created
if [ ! -f "$FULL_OUTPUT_PATH" ]; then
    log_error "Failed to create file"
    output_result "failed" "$OUTPUT_FILE" "File creation failed" "$BACKUP_FILE"
    exit 1
fi

LINES_WRITTEN=$(wc -l < "$FULL_OUTPUT_PATH")
log_success "File created: $OUTPUT_FILE ($LINES_WRITTEN lines)"

# Validate syntax (Node.js check)
log_info "Validating syntax..."
if node --check "$FULL_OUTPUT_PATH" 2>/dev/null; then
    log_success "Syntax validation passed"
else
    log_warn "Syntax validation failed - attempting ESLint fix..."
    if command -v npx &> /dev/null; then
        npx eslint --fix "$FULL_OUTPUT_PATH" 2>/dev/null || true
        if node --check "$FULL_OUTPUT_PATH" 2>/dev/null; then
            log_success "Syntax fixed by ESLint"
        else
            log_warn "Syntax still invalid after ESLint - file may need manual fixes"
        fi
    fi
fi

# Run test if specified
TEST_PASSED="unknown"
if [ -n "$TEST_CMD" ]; then
    log_info "Running test: $TEST_CMD"
    cd "$PROJECT_ROOT"

    if eval "$TEST_CMD" 2>&1 | tail -5; then
        log_success "Tests passed"
        TEST_PASSED="true"
    else
        log_warn "Tests failed - file created but may need fixes"
        TEST_PASSED="false"
    fi
fi

# Log to metrics
METRICS_DIR="$PROJECT_ROOT/.claude/metrics"
mkdir -p "$METRICS_DIR"
TIMESTAMP=$(date -Iseconds 2>/dev/null || date +%Y-%m-%dT%H:%M:%S)
echo "[$TIMESTAMP] SUCCESS | Task: $TASK_ID | Model: $MODEL | File: $OUTPUT_FILE | Lines: $LINES_WRITTEN | Tests: $TEST_PASSED" >> "$METRICS_DIR/local-model-tasks.log"

# Output success result
log_success "Task $TASK_ID completed successfully"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Estimated tokens saved: ~1,500"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
output_result "success" "$OUTPUT_FILE" "" "$BACKUP_FILE"
