#!/bin/bash
# local-submit-result.sh - Submit task result from local model
#
# Usage: ./scripts/local-submit-result.sh <task-id> [--patch=<file>] [--tests=passed|failed]
#
# This script:
# 1. Applies the patch if provided
# 2. Runs the task's test command
# 3. Updates task status in backlog
#
# Exit codes:
#   0 - Task completed successfully
#   1 - Missing arguments
#   2 - Tests failed

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Parse arguments
TASK_ID=""
PATCH_FILE=""
TESTS_ARG=""

for arg in "$@"; do
    case $arg in
        --patch=*)
            PATCH_FILE="${arg#*=}"
            ;;
        --tests=*)
            TESTS_ARG="${arg#*=}"
            ;;
        *)
            if [ -z "$TASK_ID" ]; then
                TASK_ID="$arg"
            fi
            ;;
    esac
done

if [ -z "$TASK_ID" ]; then
    echo -e "${RED}Usage: $0 <task-id> [--patch=<file>] [--tests=passed|failed]${NC}"
    exit 1
fi

echo -e "${YELLOW}Processing result for task: $TASK_ID${NC}"

# Get task details from backlog
BACKLOG_FILE="$PROJECT_ROOT/.claude/backlog.json"
TASK_JSON=$(node -e "
const backlog = require('$BACKLOG_FILE');
const task = backlog.tasks.find(t => t.id === '$TASK_ID');
if (task) console.log(JSON.stringify(task));
else process.exit(1);
" 2>/dev/null)

if [ -z "$TASK_JSON" ]; then
    echo -e "${RED}Task not found: $TASK_ID${NC}"
    exit 1
fi

# Apply patch if provided
if [ -n "$PATCH_FILE" ] && [ -f "$PATCH_FILE" ]; then
    echo "Applying patch: $PATCH_FILE"
    cd "$PROJECT_ROOT"
    if git apply --check "$PATCH_FILE" 2>/dev/null; then
        git apply "$PATCH_FILE"
        echo -e "${GREEN}Patch applied successfully${NC}"
    else
        echo -e "${YELLOW}Patch apply check failed, attempting direct apply...${NC}"
        patch -p1 < "$PATCH_FILE" || true
    fi
fi

# Run tests if not explicitly set
if [ -z "$TESTS_ARG" ]; then
    TEST_CMD=$(echo "$TASK_JSON" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).test_command)")

    if [ -n "$TEST_CMD" ] && [ "$TEST_CMD" != "undefined" ]; then
        echo "Running test: $TEST_CMD"
        cd "$PROJECT_ROOT"
        if eval "$TEST_CMD"; then
            TESTS_ARG="passed"
            echo -e "${GREEN}Tests passed${NC}"
        else
            TESTS_ARG="failed"
            echo -e "${RED}Tests failed${NC}"
        fi
    else
        TESTS_ARG="passed"
        echo "No test command specified, assuming passed"
    fi
fi

# Update task status
if [ "$TESTS_ARG" = "passed" ]; then
    node "$SCRIPT_DIR/dispatcher.cjs" complete "$TASK_ID" --tests=passed
    echo -e "${GREEN}Task $TASK_ID completed successfully${NC}"
    exit 0
else
    node "$SCRIPT_DIR/dispatcher.cjs" complete "$TASK_ID" --tests=failed
    echo -e "${RED}Task $TASK_ID marked for review (tests failed)${NC}"
    exit 2
fi
