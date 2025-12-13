---
description: Use Qwen for refactoring tasks (rename, extract, restructure)
argument-hint: [refactoring description]
---

**Local Model Refactoring (via ///LOCAL_TASKS)**

To execute refactoring with local models (Qwen), Claude should:

1. **Create ///LOCAL_TASKS** JSON:
```json
///LOCAL_TASKS
[
  {
    "id": "T-XXX-001",
    "parent_id": "current-project",
    "title": "Refactor component to use hooks",
    "description": "Convert class component to functional component with hooks",
    "files_touched": ["src/components/MyComponent.jsx"],
    "est_lines_changed": 80,
    "est_local_effort_mins": 30,
    "test_command": "npm test src/components/__tests__/MyComponent.test.js",
    "assigned_to": "local:qwen",
    "priority": "P2",
    "status": "open",
    "inputs": ["Current class component code"],
    "outputs": ["Functional component with hooks"],
    "constraints": [
      "Preserve all existing functionality",
      "Maintain prop interface",
      "Keep test passing"
    ],
    "needs_context": [
      {"path": "src/components/MyComponent.jsx", "lines_start": 1, "lines_end": 200}
    ],
    "invariant_test": null
  }
]
```

2. **Use needs_context protocol** for large refactorings:
- Request only the specific line ranges being refactored
- Include relevant imports and dependencies
- Avoid sending entire files

3. **Execute via Dispatcher agent**:

Route through Dispatcher agent:
```
Task(subagent_type="dispatcher", prompt="Execute task: <description from decomposition>")
```

The Dispatcher will:
1. Validate task is in backlog
2. Execute via local model (Qwen for refactoring)
3. Return result or create permission request if escalation needed

**Refactoring Best Practices**:
- One refactoring pattern per task
- Always include test_command to verify no breakage
- Use needs_context to provide only relevant code sections
- Keep est_lines_changed ≤ 300 (split larger refactorings)

**User Request**: $ARGUMENTS

Claude should decompose this refactoring into atomic ///LOCAL_TASKS.
