---
description: Use Qwen to generate unit tests
argument-hint: [file or function to test]
---

**Local Model Test Generation (via ///LOCAL_TASKS)**

To generate tests with local models (Qwen), Claude should:

1. **Create ///LOCAL_TASKS** JSON with invariant_test support:
```json
///LOCAL_TASKS
[
  {
    "id": "T-XXX-001",
    "parent_id": "current-project",
    "title": "Generate tests for utility function",
    "description": "Create comprehensive unit tests covering normal, edge, and error cases",
    "files_touched": ["src/utils/__tests__/myUtil.test.js"],
    "est_lines_changed": 100,
    "est_local_effort_mins": 25,
    "test_command": "npm test src/utils/__tests__/myUtil.test.js",
    "assigned_to": "local:qwen",
    "priority": "P2",
    "status": "open",
    "inputs": ["Function signature", "Expected behavior"],
    "outputs": ["Comprehensive test suite"],
    "constraints": [
      "Use vitest framework",
      "Cover happy path, edge cases, and errors",
      "Include descriptive test names"
    ],
    "needs_context": [
      {"path": "src/utils/myUtil.js", "lines_start": 1, "lines_end": 50}
    ],
    "invariant_test": null
  }
]
```

2. **invariant_test Protocol** (automatic for critical files):
When tasks touch reducers, persistence, or hydration files, the dispatcher
automatically creates a paired test task using `.claude/templates/invariant-test.template.js`.

Example - if you modify `src/reducers/gameReducer.js`:
```json
{
  "invariant_test": {
    "target": "src/reducers/gameReducer.js",
    "assertions": [
      "State shape unchanged after action",
      "No unexpected side effects",
      "Immutability preserved"
    ]
  }
}
```

The dispatcher will auto-create task `T-XXX-001-TEST` with the invariant test.

3. **Execute via dispatcher**:
```bash
cat tasks.json | node scripts/dispatcher.cjs add-tasks
# Automatically creates test task if invariant_test specified
node scripts/dispatcher.cjs assign-next
```

**Critical Files** (auto-trigger invariant tests):
- `src/reducers/*.js` - State reducers
- `src/utils/persistence.js` - IndexedDB operations
- `src/utils/hydration.js` - State hydration
- `src/contexts/*.jsx` - Context providers

**User Request**: $ARGUMENTS

Claude should decompose into ///LOCAL_TASKS with invariant_test for critical files.
