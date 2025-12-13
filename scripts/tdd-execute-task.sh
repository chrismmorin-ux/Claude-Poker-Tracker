#!/bin/bash
#
# tdd-execute-task.sh - TDD-first task execution for local models
#
# This script implements the TDD workflow:
# 1. Run tests first (expect failure - test defines success)
# 2. Call local model to implement
# 3. Run tests again (expect pass)
# 4. Report result
#
# Usage: bash scripts/tdd-execute-task.sh <task-spec.json>
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

# Check arguments
if [ -z "$1" ]; then
    error "Usage: $0 <task-spec.json>"
    exit 1
fi

SPEC_FILE="$1"

if [ ! -f "$SPEC_FILE" ]; then
    error "Task spec file not found: $SPEC_FILE"
    exit 1
fi

# Parse task spec
TASK_ID=$(jq -r '.task_id // .id' "$SPEC_FILE")
TEST_FILE=$(jq -r '.test_first.test_file // empty' "$SPEC_FILE")
TEST_COMMAND=$(jq -r '.test_command // empty' "$SPEC_FILE")
OUTPUT_FILE=$(jq -r '.output_file // .files_touched[0] // empty' "$SPEC_FILE")

info "TDD Execution: $TASK_ID"
info "Test file: $TEST_FILE"
info "Output file: $OUTPUT_FILE"

# Step 1: Verify test file exists (or create placeholder)
if [ -n "$TEST_FILE" ] && [ ! -f "$TEST_FILE" ]; then
    warn "Test file does not exist: $TEST_FILE"
    warn "Creating placeholder test file..."

    # Create directory if needed
    mkdir -p "$(dirname "$TEST_FILE")"

    # Create minimal test file
    ASSERTIONS=$(jq -r '.test_first.assertions // [] | join("\n")' "$SPEC_FILE")
    cat > "$TEST_FILE" << 'TESTEOF'
// Auto-generated test placeholder
// TODO: Implement tests for assertions:
TESTEOF
    echo "// $ASSERTIONS" >> "$TEST_FILE"
    echo "" >> "$TEST_FILE"
    echo "describe('TODO', () => {" >> "$TEST_FILE"
    echo "  it.todo('implement tests');" >> "$TEST_FILE"
    echo "});" >> "$TEST_FILE"

    info "Created placeholder: $TEST_FILE"
fi

# Step 2: Run initial test (expect failure or skip if no test)
if [ -n "$TEST_COMMAND" ]; then
    info "Running initial test (expect failure)..."
    set +e
    INITIAL_TEST_OUTPUT=$(eval "$TEST_COMMAND" 2>&1)
    INITIAL_EXIT=$?
    set -e

    if [ $INITIAL_EXIT -eq 0 ]; then
        warn "Initial test passed - task may already be complete"
        warn "Proceeding with implementation anyway..."
    else
        info "Initial test failed as expected (defines success criteria)"
    fi
else
    warn "No test_command specified - skipping initial test"
fi

# Step 3: Call execute-local-task.sh for implementation
info "Calling local model for implementation..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Forward to standard execution script
if [ -f "$SCRIPT_DIR/execute-local-task.sh" ]; then
    bash "$SCRIPT_DIR/execute-local-task.sh" "$SPEC_FILE"
    IMPL_EXIT=$?
else
    error "execute-local-task.sh not found"
    exit 1
fi

if [ $IMPL_EXIT -ne 0 ]; then
    error "Implementation failed"
    exit $IMPL_EXIT
fi

# Step 4: Run final test (expect pass)
if [ -n "$TEST_COMMAND" ]; then
    info "Running final test (expect pass)..."
    set +e
    FINAL_TEST_OUTPUT=$(eval "$TEST_COMMAND" 2>&1)
    FINAL_EXIT=$?
    set -e

    if [ $FINAL_EXIT -eq 0 ]; then
        success "Tests passed - TDD task complete!"
        echo "{\"status\": \"success\", \"task_id\": \"$TASK_ID\", \"tests_passed\": true}"
        exit 0
    else
        error "Tests failed after implementation"
        echo "$FINAL_TEST_OUTPUT"
        echo "{\"status\": \"failed\", \"task_id\": \"$TASK_ID\", \"tests_passed\": false, \"error\": \"Tests failed after implementation\"}"
        exit 1
    fi
else
    warn "No test_command - cannot verify success via tests"
    success "Implementation complete (no test verification)"
    exit 0
fi
