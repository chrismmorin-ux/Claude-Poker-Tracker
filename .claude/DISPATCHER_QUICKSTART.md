# Dispatcher Quickstart Guide

Quick reference for using the task dispatcher system.

---

## Adding Tasks Manually

Create a JSON file with your tasks following the ///LOCAL_TASKS format:

```bash
# Add tasks from a JSON file
cat tasks.json | node scripts/dispatcher.cjs add-tasks

# Or redirect from file
node scripts/dispatcher.cjs add-tasks < tasks.json
```

**Example tasks.json:**
```json
[
  {
    "id": "T-001",
    "title": "Create utility function",
    "description": "Add helper function to format dates",
    "files_touched": ["src/utils/dateUtils.js"],
    "est_lines_changed": 20,
    "est_local_effort_mins": 15,
    "test_command": "npm test src/utils/__tests__/dateUtils.test.js",
    "assigned_to": "local:deepseek",
    "priority": "P1",
    "status": "open"
  }
]
```

---

## Executing Tasks

```bash
# Execute the next available task
node scripts/dispatcher.cjs assign-next

# Check what tasks are pending
node scripts/dispatcher.cjs status
```

The dispatcher will:
1. Pick the highest priority open task
2. Validate it passes atomic criteria
3. Call the local model (DeepSeek or Qwen)
4. Apply the changes
5. Run tests

---

## Checking Status

```bash
# View all tasks grouped by status
node scripts/dispatcher.cjs status

# Validate all tasks against atomic criteria
node scripts/dispatcher.cjs audit
```

**Status output shows:**
- Total tasks
- Open (ready to execute)
- In Progress (being worked on)
- Done (completed successfully)
- Failed (need attention)

---

## Other Commands

```bash
# Mark a task as complete manually
node scripts/dispatcher.cjs complete T-001

# Redecompose a failed task
node scripts/dispatcher.cjs redecompose T-001

# Extract context for a task
node scripts/dispatcher.cjs extract-context T-001

# Permission requests (when decomposition blocked)
node scripts/dispatcher.cjs create-permission-request
node scripts/dispatcher.cjs list-permissions --status=pending
node scripts/dispatcher.cjs approve-permission PR-001
```

---

## Troubleshooting Common Errors

### "Error parsing tasks: Unexpected end of JSON input"
**Cause:** Malformed JSON in input
**Fix:** Validate your JSON file with `cat tasks.json | jq .`

### "Task failed atomic validation: files_touched > 3"
**Cause:** Task violates atomic criteria (too many files)
**Fix:** Decompose the task into smaller subtasks, each touching ≤3 files

### "No open tasks found"
**Cause:** All tasks are done or in progress
**Fix:** Check status with `node scripts/dispatcher.cjs status`

### "Module not found: showdown"
**Cause:** Missing npm dependencies
**Fix:** Run `npm install` in project root

### "Test failed: command not found"
**Cause:** Test command references non-existent test file
**Fix:** Create the test file first or update test_command

---

## Atomic Criteria Reference

All tasks must meet these limits:

| Criterion | Limit | Rationale |
|-----------|-------|-----------|
| `files_touched` | ≤ 3 | Limits scope complexity |
| `est_lines_changed` | ≤ 300 | Keeps tasks focused |
| `test_command` | Required | Ensures verifiability |
| `est_local_effort_mins` | ≤ 60 | Prevents runaway tasks |

If a task violates any criterion, the dispatcher will **BLOCK** it and require re-decomposition.

---

## Example: Local Model Enforcement Project

This project used the dispatcher for all 20 tasks:

```bash
# 1. Created task specs
cat local-model-enforcement-tasks.json | node scripts/dispatcher.cjs add-tasks

# 2. Executed each task
node scripts/dispatcher.cjs assign-next  # Repeat for each task

# 3. Monitored progress
node scripts/dispatcher.cjs status
```

**Result:**
- 20 tasks executed via local models
- ~16,000 tokens saved vs direct Claude implementation
- All tasks validated and tested automatically

---

## See Also

- **Full Policy:** `.claude/DECOMPOSITION_POLICY.md`
- **Task Schema:** `.claude/schemas/local-task.schema.json`
- **Troubleshooting:** `.claude/TROUBLESHOOTING_DECOMPOSITION.md`
