---
description: Use Qwen to write documentation and comments
argument-hint: [file/function to document]
---

**Local Model Documentation (via ///LOCAL_TASKS)**

To add documentation with local models (Qwen), Claude should:

1. **Create ///LOCAL_TASKS** JSON:
```json
///LOCAL_TASKS
[
  {
    "id": "T-XXX-001",
    "parent_id": "current-project",
    "title": "Add JSDoc to utility functions",
    "description": "Add comprehensive JSDoc comments with @param, @returns, and @example",
    "files_touched": ["src/utils/actionUtils.js"],
    "est_lines_changed": 40,
    "est_local_effort_mins": 20,
    "test_command": "node -e \"require('./src/utils/actionUtils.js')\"",
    "assigned_to": "local:qwen",
    "priority": "P3",
    "status": "open",
    "inputs": ["Function signatures and behavior"],
    "outputs": ["JSDoc comments for all exported functions"],
    "constraints": [
      "Use JSDoc format with @param, @returns, @example",
      "Include type information",
      "Add brief description of purpose",
      "Do not modify code logic"
    ],
    "needs_context": [
      {"path": "src/utils/actionUtils.js", "lines_start": 1, "lines_end": 100}
    ],
    "invariant_test": null
  }
]
```

2. **Use needs_context for API reference**:
- Request only the function signatures being documented
- Include usage examples from calling code if available
- Keep line ranges focused on documentation target

3. **Execute via dispatcher**:
```bash
cat tasks.json | node scripts/dispatcher.cjs add-tasks
node scripts/dispatcher.cjs assign-next
```

**JSDoc Best Practices**:
- Always include @param with types for parameters
- Always include @returns with type and description
- Add @example for complex functions
- Keep descriptions concise but clear
- Document edge cases and exceptions

**User Request**: $ARGUMENTS

Claude should decompose into ///LOCAL_TASKS with needs_context for targeted documentation.
