---
description: Use DeepSeek to generate new code/boilerplate
argument-hint: [description of code to generate]
---

**Local Model Code Generation (via ///LOCAL_TASKS)**

To generate code with local models, Claude should:

1. **Create ///LOCAL_TASKS** JSON with atomic task:
```json
///LOCAL_TASKS
[
  {
    "id": "T-XXX-001",
    "parent_id": "current-project",
    "title": "Create utility function",
    "description": "Clear description of what to create",
    "files_touched": ["src/path/to/file.js"],
    "est_lines_changed": 50,
    "est_local_effort_mins": 20,
    "test_command": "npm test src/path/__tests__/file.test.js",
    "assigned_to": "local:deepseek",
    "priority": "P1",
    "status": "open",
    "inputs": ["param1: type", "param2: type"],
    "outputs": ["Return value description"],
    "constraints": ["Must follow existing patterns", "Include JSDoc"],
    "needs_context": [
      {"path": "src/relevant/file.js", "lines_start": 1, "lines_end": 50}
    ],
    "invariant_test": null
  }
]
```

2. **Route through Dispatcher agent**:
```
Task(subagent_type="dispatcher", prompt="Execute task: <description from decomposition>")
```

The Dispatcher will:
1. Validate task is in backlog
2. Execute via local model (DeepSeek for code generation)
3. Return result or create permission request if escalation needed

3. **Review output** and report completion to user

**Atomic Criteria** (see `.claude/DECOMPOSITION_POLICY.md`):
- files_touched ≤ 3
- est_lines_changed ≤ 300
- test_command required
- est_local_effort_mins ≤ 60

**User Request**: $ARGUMENTS

Claude should now decompose this into ///LOCAL_TASKS format and use dispatcher workflow.
