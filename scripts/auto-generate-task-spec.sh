#!/bin/bash
# auto-generate-task-spec.sh - Automatically generate task specs for local model delegation
#
# This script eliminates the manual task spec creation friction by:
# 1. Classifying the task automatically (using task-classifier-v3.sh)
# 2. Inferring context files from the target file path
# 3. Setting appropriate constraints based on file type
# 4. Creating the task spec JSON ready for execute-local-task.sh
#
# Usage: bash auto-generate-task-spec.sh "task description" "output_file"
# Output: Path to generated task spec file (.claude/task-specs/T-XXX.json)
#
# Example:
#   bash auto-generate-task-spec.sh "Create a formatCurrency utility function" "src/utils/formatCurrency.js"
#   → Creates .claude/task-specs/T-001.json and outputs the path

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TASK_SPECS_DIR="$PROJECT_ROOT/.claude/task-specs"
CLASSIFIER="$SCRIPT_DIR/task-classifier-v3.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[AUTO-SPEC]${NC} $1" >&2; }
log_success() { echo -e "${GREEN}[AUTO-SPEC]${NC} $1" >&2; }
log_warn() { echo -e "${YELLOW}[AUTO-SPEC]${NC} $1" >&2; }
log_error() { echo -e "${RED}[AUTO-SPEC]${NC} $1" >&2; }

# Validate arguments
if [ -z "$1" ] || [ -z "$2" ]; then
    log_error "Usage: $0 \"task description\" \"output_file\""
    exit 1
fi

TASK_DESCRIPTION="$1"
OUTPUT_FILE="$2"

# Ensure task-specs directory exists
mkdir -p "$TASK_SPECS_DIR"

# =============================================================================
# STEP 1: Classify the task
# =============================================================================

log_info "Classifying task..."
CLASSIFICATION=$("$CLASSIFIER" "$TASK_DESCRIPTION" "$OUTPUT_FILE")
TASK_TYPE=$(echo "$CLASSIFICATION" | cut -d: -f1)
CONFIDENCE=$(echo "$CLASSIFICATION" | cut -d: -f2)
MODEL=$(echo "$CLASSIFICATION" | cut -d: -f3)

log_info "Classification: $TASK_TYPE ($CONFIDENCE confidence) → $MODEL"

# If Claude-required, don't generate spec
if [ "$TASK_TYPE" = "claude_required" ]; then
    log_warn "Task requires Claude - no spec generated"
    echo "CLAUDE_REQUIRED"
    exit 0
fi

# =============================================================================
# STEP 2: Generate unique task ID
# =============================================================================

# Find next available task ID
LAST_ID=$(ls -1 "$TASK_SPECS_DIR" 2>/dev/null | grep -oE 'T-[0-9]+' | sort -V | tail -1 | grep -oE '[0-9]+' || echo "0")
NEXT_ID=$((LAST_ID + 1))
TASK_ID=$(printf "T-%03d" $NEXT_ID)

log_info "Task ID: $TASK_ID"

# =============================================================================
# STEP 3: Detect language from file extension
# =============================================================================

FILE_EXT="${OUTPUT_FILE##*.}"
case "$FILE_EXT" in
    js|jsx)
        LANGUAGE="javascript"
        ;;
    ts|tsx)
        LANGUAGE="typescript"
        ;;
    css|scss)
        LANGUAGE="css"
        ;;
    json)
        LANGUAGE="json"
        ;;
    md)
        LANGUAGE="markdown"
        ;;
    sh)
        LANGUAGE="bash"
        ;;
    *)
        LANGUAGE="javascript"
        ;;
esac

log_info "Language: $LANGUAGE"

# =============================================================================
# STEP 4: Infer context files based on output path and task type
# =============================================================================

CONTEXT_FILES=()

# Always include constants for JS/JSX files in src/
if [[ "$OUTPUT_FILE" == src/*.js* ]]; then
    # Add relevant constants
    if [ -f "$PROJECT_ROOT/src/constants/gameConstants.js" ]; then
        CONTEXT_FILES+=("src/constants/gameConstants.js")
    fi
fi

# For utils, include related utils
if [[ "$OUTPUT_FILE" == src/utils/*.js* ]]; then
    # Find similar util files (first 3)
    SIMILAR_UTILS=$(ls -1 "$PROJECT_ROOT/src/utils/"*.js 2>/dev/null | head -3 | xargs -I{} basename {} | sed 's/^/src\/utils\//')
    while IFS= read -r util; do
        [ -n "$util" ] && [ "$util" != "$OUTPUT_FILE" ] && CONTEXT_FILES+=("$util")
    done <<< "$SIMILAR_UTILS"
fi

# For components, include related UI components
if [[ "$OUTPUT_FILE" == src/components/ui/*.jsx ]]; then
    # Add a sample UI component for pattern reference
    SAMPLE_UI=$(ls -1 "$PROJECT_ROOT/src/components/ui/"*.jsx 2>/dev/null | head -1 | xargs -I{} basename {} | sed 's/^/src\/components\/ui\//')
    [ -n "$SAMPLE_UI" ] && [ "$SAMPLE_UI" != "$OUTPUT_FILE" ] && CONTEXT_FILES+=("$SAMPLE_UI")
fi

# For tests, include the file being tested
if [[ "$OUTPUT_FILE" == *test* ]] || [[ "$OUTPUT_FILE" == *spec* ]]; then
    # Extract source file path from test path
    SOURCE_FILE=$(echo "$OUTPUT_FILE" | sed -E 's/\/__tests__//; s/\.test\././; s/\.spec\././')
    if [ -f "$PROJECT_ROOT/$SOURCE_FILE" ]; then
        CONTEXT_FILES+=("$SOURCE_FILE")
    fi
fi

# Limit context files to 4 max
CONTEXT_FILES=("${CONTEXT_FILES[@]:0:4}")

log_info "Context files: ${CONTEXT_FILES[*]:-none}"

# =============================================================================
# STEP 5: Set constraints based on task type
# =============================================================================

CONSTRAINTS=()

# Common constraints
CONSTRAINTS+=("Include proper JSDoc comments")
CONSTRAINTS+=("Follow existing code style")

case "$TASK_TYPE" in
    simple_utility)
        CONSTRAINTS+=("Export named function")
        CONSTRAINTS+=("Pure function - no side effects")
        CONSTRAINTS+=("Use dependency injection for constants")
        CONSTRAINTS+=("Handle edge cases (null, undefined, empty)")
        ;;
    simple_component)
        CONSTRAINTS+=("Use functional component")
        CONSTRAINTS+=("Destructure props")
        CONSTRAINTS+=("Include PropTypes")
        CONSTRAINTS+=("Keep under 150 lines")
        ;;
    medium_component)
        CONSTRAINTS+=("Use functional component with hooks")
        CONSTRAINTS+=("Manage local state appropriately")
        CONSTRAINTS+=("Use useCallback for callbacks passed to children")
        CONSTRAINTS+=("Keep under 300 lines")
        ;;
    refactor)
        CONSTRAINTS+=("Preserve existing behavior")
        CONSTRAINTS+=("Update all references")
        CONSTRAINTS+=("Maintain test compatibility")
        ;;
    test_generation)
        CONSTRAINTS+=("Use Vitest/Jest syntax")
        CONSTRAINTS+=("Include describe and it blocks")
        CONSTRAINTS+=("Test edge cases")
        CONSTRAINTS+=("Mock external dependencies")
        ;;
    documentation)
        CONSTRAINTS+=("Use JSDoc format")
        CONSTRAINTS+=("Include @param and @returns")
        CONSTRAINTS+=("Add usage examples")
        ;;
esac

log_info "Constraints: ${#CONSTRAINTS[@]} rules"

# =============================================================================
# STEP 6: Determine test command (if applicable)
# =============================================================================

TEST_COMMAND=""

# For source files, check if a test file exists
if [[ "$OUTPUT_FILE" == src/*.js* ]] && [[ "$OUTPUT_FILE" != *test* ]]; then
    # Construct expected test path
    TEST_PATH=$(echo "$OUTPUT_FILE" | sed -E 's/\.jsx?$/.test.js/; s/src\//src\/__tests__\//')

    if [ -f "$PROJECT_ROOT/$TEST_PATH" ]; then
        TEST_COMMAND="npx vitest run $TEST_PATH --reporter=verbose"
        log_info "Test command: $TEST_COMMAND"
    fi
fi

# =============================================================================
# STEP 7: Generate JSON task spec
# =============================================================================

TASK_SPEC_FILE="$TASK_SPECS_DIR/$TASK_ID.json"

# Build context files JSON array
CONTEXT_JSON="[]"
if [ ${#CONTEXT_FILES[@]} -gt 0 ]; then
    CONTEXT_JSON=$(printf '%s\n' "${CONTEXT_FILES[@]}" | jq -R . | jq -s .)
fi

# Build constraints JSON array
CONSTRAINTS_JSON=$(printf '%s\n' "${CONSTRAINTS[@]}" | jq -R . | jq -s .)

# Create the task spec
cat > "$TASK_SPEC_FILE" << EOF
{
  "task_id": "$TASK_ID",
  "model": "$MODEL",
  "task_type": "$TASK_TYPE",
  "confidence": "$CONFIDENCE",
  "description": $(echo "$TASK_DESCRIPTION" | jq -R .),
  "output_file": "$OUTPUT_FILE",
  "language": "$LANGUAGE",
  "context_files": $CONTEXT_JSON,
  "constraints": $CONSTRAINTS_JSON,
  "test_command": "$TEST_COMMAND",
  "created_at": "$(date -Iseconds 2>/dev/null || date +%Y-%m-%dT%H:%M:%S)",
  "auto_generated": true
}
EOF

log_success "Created task spec: $TASK_SPEC_FILE"

# Output the path (for piping to execute-local-task.sh)
echo "$TASK_SPEC_FILE"
