---
description: Route task to local model (auto-selects Qwen or DeepSeek)
argument-hint: [task description]
---

## Auto-Delegation Flow (v3)

This command uses the new reverse-default delegation system:
1. **Classify** task with `task-classifier-v3.sh` (expanded categories)
2. **Generate** spec automatically with `auto-generate-task-spec.sh`
3. **Execute** via `execute-local-task.sh`

### Usage

For a complete task with output file:
```bash
# Step 1: Generate spec (auto-classifies and creates JSON)
SPEC=$(bash scripts/auto-generate-task-spec.sh "$ARGUMENTS" "src/path/to/output.js")

# Step 2: Execute (if not CLAUDE_REQUIRED)
if [ "$SPEC" != "CLAUDE_REQUIRED" ]; then
    bash scripts/execute-local-task.sh "$SPEC"
fi
```

### Quick Commands

**Create utility function:**
```bash
bash scripts/auto-generate-task-spec.sh "Create formatCurrency utility" "src/utils/formatCurrency.js" | xargs bash scripts/execute-local-task.sh
```

**Create simple component:**
```bash
bash scripts/auto-generate-task-spec.sh "Create ChipBadge component" "src/components/ui/ChipBadge.jsx" | xargs bash scripts/execute-local-task.sh
```

**Generate tests:**
```bash
bash scripts/auto-generate-task-spec.sh "Write tests for formatCurrency" "src/utils/__tests__/formatCurrency.test.js" | xargs bash scripts/execute-local-task.sh
```

### Expanded Categories (v3)

| Category | Line Limit | Model | Examples |
|----------|------------|-------|----------|
| `simple_utility` | <200 | DeepSeek | Pure functions, helpers |
| `simple_component` | <150 | Qwen | Buttons, badges, cards |
| `medium_component` | <300 | Qwen | Forms, lists with state |
| `refactor` | Any | Qwen | Rename, extract, move |
| `documentation` | Any | Qwen | JSDoc, comments |
| `test_generation` | Any | Qwen | Unit tests |
| `claude_required` | - | Claude | State, hooks, integration |

### [CLAUDE] Bypass

Add `[CLAUDE]` to task description to skip delegation:
```
[CLAUDE] Implement complex reducer logic for session management
```

### Metrics

Task outcomes logged to:
- `.claude/metrics/local-model-tasks.log` - Execution history
- `.claude/metrics/delegation.json` - Decision tracking
- `.claude/.pm-state.json` - Session delegation stats
