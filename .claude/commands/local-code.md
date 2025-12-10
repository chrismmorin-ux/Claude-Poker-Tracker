---
description: Use DeepSeek to generate new code/boilerplate
argument-hint: [description of code to generate]
---

**Local Model Code Generation**

To generate code with local models, Claude should:

1. **Create a task spec file** at `.claude/task-specs/<task-id>.json`:
```json
{
  "task_id": "T-XXX",
  "model": "deepseek",
  "description": "Clear description of what to create",
  "output_file": "src/path/to/file.js",
  "context_files": ["relevant/context/file.js"],
  "constraints": ["Constraint 1", "Constraint 2"],
  "test_command": "",
  "language": "javascript"
}
```

2. **Execute the task**:
```bash
./scripts/execute-local-task.sh .claude/task-specs/<task-id>.json
```

3. **Review the output** - Read the created file and verify quality

4. **If issues**, either:
   - Revise the task spec and retry (1x max)
   - Implement directly with Claude

**User Request**: $ARGUMENTS

Claude should now decompose this into a task spec and execute it.
