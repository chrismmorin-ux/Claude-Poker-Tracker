#!/bin/bash
# local-pull-task.sh - Fetch next open task from backlog for local model execution
#
# Usage: ./scripts/local-pull-task.sh
#
# Output: JSON task spec suitable for local model consumption
# Exit codes:
#   0 - Task assigned successfully
#   1 - No open tasks

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Use dispatcher to assign next task
TASK_JSON=$(node "$SCRIPT_DIR/dispatcher.cjs" assign-next 2>/dev/null)

if [ -z "$TASK_JSON" ] || [ "$TASK_JSON" = "No open tasks in backlog" ]; then
    echo "No open tasks available"
    exit 1
fi

# Extract task details for context provision
TASK_ID=$(echo "$TASK_JSON" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.id)")

echo "=== Task Assigned: $TASK_ID ===" >&2

# If task has needs_context, extract and append
NEEDS_CONTEXT=$(echo "$TASK_JSON" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(d.needs_context && d.needs_context.length > 0) {
    console.log(JSON.stringify(d.needs_context));
} else {
    console.log('[]');
}
")

if [ "$NEEDS_CONTEXT" != "[]" ]; then
    echo "Extracting requested context..." >&2

    # Use context-provider if it exists, otherwise inline extraction
    if [ -f "$SCRIPT_DIR/context-provider.cjs" ]; then
        CONTEXT=$(echo "$NEEDS_CONTEXT" | node "$SCRIPT_DIR/context-provider.cjs")
    else
        # Inline extraction fallback
        CONTEXT=$(echo "$NEEDS_CONTEXT" | node -e "
const fs = require('fs');
const path = require('path');
const contexts = JSON.parse(require('fs').readFileSync(0, 'utf8'));
let output = '';
contexts.forEach(ctx => {
    const fullPath = path.join('$PROJECT_ROOT', ctx.path);
    if (fs.existsSync(fullPath)) {
        const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
        const excerpt = lines.slice(ctx.lines_start - 1, ctx.lines_end).join('\n');
        output += '\n### Context: ' + ctx.path + ' (lines ' + ctx.lines_start + '-' + ctx.lines_end + ')\n\`\`\`\n' + excerpt + '\n\`\`\`\n';
    }
});
console.log(output);
")
    fi

    # Append context to task JSON
    TASK_JSON=$(echo "$TASK_JSON" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
d._extracted_context = \`$CONTEXT\`;
console.log(JSON.stringify(d, null, 2));
")
fi

# Output full task spec
echo "$TASK_JSON"
