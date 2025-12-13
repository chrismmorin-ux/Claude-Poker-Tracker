---
description: Route task to local model (auto-selects Qwen or DeepSeek)
argument-hint: [task description]
---

## Execution Flow

1. **Decompose** task into atomic pieces
2. **Request** via Dispatcher agent:
   ```
   Task(subagent_type="dispatcher", prompt="Execute: <description>")
   ```
3. **Dispatcher** executes via local model internally
4. **Integrate** result

## Examples

Instead of direct execution, route through Dispatcher:

**Create utility:**
```
Task(subagent_type="dispatcher", prompt="Execute task: Create formatCurrency utility in src/utils/formatCurrency.js")
```

**Create component:**
```
Task(subagent_type="dispatcher", prompt="Execute task: Create ChipBadge component in src/components/ui/ChipBadge.jsx")
```

**Create tests:**
```
Task(subagent_type="dispatcher", prompt="Execute task: Write tests for formatCurrency in src/utils/__tests__/formatCurrency.test.js")
```

## How Dispatcher Routes Tasks

The Dispatcher agent (`subagent_type="dispatcher"`) evaluates each request against:

1. **Task Registry** (`.claude/backlog.json`) - All tasks must be created first
2. **Assignment** - Task must be assigned to a model (local/Claude)
3. **Approval** - Human approval required for Claude-assigned tasks
4. **Execution** - Dispatcher executes via appropriate model

## Task Status Tracking

Monitor task execution via:
```bash
node scripts/dispatcher.cjs status
```

View execution logs:
- `.claude/logs/local-model-tasks.log` - Execution history
- `.claude/dispatcher-state.json` - Decision audit trail
