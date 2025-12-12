---
description: Decompose a feature or initiative into tasks with the CTO-Agent
argument-hint: [feature or initiative description]
---

Use the **cto-agent** subagent to decompose this work into a structured task backlog.

## Initiative to Decompose

$ARGUMENTS

## Requirements

1. Read `engineering_practices.md` for standards and role definitions
2. Read `CLAUDE.md` for current architecture context
3. Analyze the initiative and break it down into:
   - Independent, parallelizable tasks where possible
   - Clear dependencies between tasks
   - Appropriate owner assignments (senior, junior, ai:less-capable, ai:research)

## Expected Output

Use the **///LOCAL_TASKS** format (see `.claude/DECOMPOSITION_POLICY.md`):

```json
///LOCAL_TASKS
[
  {
    "id": "T-XXX-001",
    "parent_id": "project-id",
    "title": "One-line task description",
    "description": "Detailed description of what to create/modify",
    "files_touched": ["path/to/file.js"],
    "est_lines_changed": 50,
    "est_local_effort_mins": 20,
    "test_command": "npm test path/to/file.test.js",
    "assigned_to": "local:deepseek",
    "priority": "P1",
    "status": "open",
    "inputs": ["Required files, APIs, data"],
    "outputs": ["Files created, features added"],
    "constraints": ["Constraint 1", "Constraint 2"],
    "needs_context": [
      {"path": "src/relevant/file.js", "lines_start": 10, "lines_end": 50}
    ],
    "invariant_test": null
  }
]
```

### Atomic Criteria (ALL tasks must meet)

| Criterion | Limit | Rationale |
|-----------|-------|-----------|
| `files_touched` | ≤ 3 | Limits scope complexity |
| `est_lines_changed` | ≤ 300 | Keeps tasks focused |
| `test_command` | Required | Ensures verifiability |
| `est_local_effort_mins` | ≤ 60 | Prevents runaway tasks |

### Local Model Mapping (for `ai:less-capable` tasks)

When assigning `owner: "ai:less-capable"`, also specify `local_command`:

| Task Type | local_command |
|-----------|---------------|
| New utility function (<80 lines) | `/local-code` |
| New simple component (<100 lines, <5 props) | `/local-code` |
| Refactoring, renaming, extracting | `/local-refactor` |
| Adding documentation/JSDoc | `/local-doc` |
| Generating unit tests | `/local-test` |
| State/hooks/reducers/integration | `null` (requires Claude) |

Also provide:
- A dependency graph (which tasks block which)
- Critical path identification
- Total effort estimate
- Key risks and mitigations
