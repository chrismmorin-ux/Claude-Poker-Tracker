# Decomposition Policy (Authoritative)

This document defines mandatory rules for atomic task decomposition and local model delegation.

---

## 1. Core Principle

**Local models are the DEFAULT execution environment.**

Claude's role is strictly:
1. **DECOMPOSE** - Break ANY task into atomic pieces
2. **DELEGATE** - Create task specs and execute via local model
3. **REVIEW** - Check output quality, integrate pieces
4. **ESCALATE ONLY IF**: Task fails twice with good specs OR requires real-time debugging

---

## 2. Atomic Criteria

A task is **atomic** if ALL of the following are true:

| Criterion | Limit | Rationale |
|-----------|-------|-----------|
| `files_touched` | ≤ 3 | Limits scope complexity |
| `est_lines_changed` | ≤ 300 | Keeps tasks focused |
| `test_command` | Required | Ensures verifiability |
| `est_local_effort_mins` | ≤ 60 | Prevents runaway tasks |

**If ANY criterion fails**: BLOCK immediately, require re-decomposition.

---

## 3. ///LOCAL_TASKS Format

All task decomposition outputs use this JSON format:

```json
///LOCAL_TASKS
[
  {
    "id": "T-P1-001",
    "parent_id": null,
    "title": "Create utility function",
    "description": "Create getValidActions helper that returns valid actions",
    "files_touched": ["src/utils/actionUtils.js"],
    "est_lines_changed": 25,
    "est_local_effort_mins": 15,
    "test_command": "npm test src/utils/__tests__/actionUtils.test.js",
    "assigned_to": "local:deepseek",
    "priority": "P1",
    "status": "open",
    "inputs": ["street", "hasBet", "isMultiSeat"],
    "outputs": ["Array of PRIMITIVE_ACTIONS values"],
    "constraints": [
      "Import PRIMITIVE_ACTIONS from constants",
      "Include JSDoc with @param and @returns"
    ],
    "needs_context": [
      {"path": "src/constants/primitiveActions.js", "lines_start": 1, "lines_end": 50}
    ],
    "invariant_test": null
  }
]
```

**Schema**: `.claude/schemas/local-task.schema.json`

---

## 4. Task Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ DECOMPOSE   │ --> │  BACKLOG    │ --> │  EXECUTE    │
│ Claude      │     │ backlog.json│     │ Local Model │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               v
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   MERGE     │ <-- │   REVIEW    │ <-- │   RESULT    │
│ Claude      │     │ Claude      │     │ diff + json │
└─────────────┘     └─────────────┘     └─────────────┘
```

1. **Decompose**: Claude breaks task into atomic subtasks
2. **Backlog**: Tasks written to `.claude/backlog.json`
3. **Execute**: Dispatcher assigns to local model
4. **Result**: Local model returns unified diff + task_result.json
5. **Review**: Claude validates (small token budget)
6. **Merge**: If valid, integrate; if invalid, decompose fixes

---

## 5. needs_context Protocol

Local models request **exact line ranges**, not full files:

```json
"needs_context": [
  {"path": "src/utils/foo.js", "lines_start": 10, "lines_end": 50},
  {"path": "src/constants/bar.js", "lines_start": 1, "lines_end": 30}
]
```

**Rules**:
- Request only what's needed (minimum context)
- If full file needed, justify in constraints
- Claude supplies only requested ranges
- Reject requests without ranges; require re-specification

---

## 6. invariant_test Protocol

Tasks touching **reducers, persistence, hydration, or migrations** MUST auto-generate a paired test task:

```json
"invariant_test": {
  "target": "src/reducers/gameReducer.js",
  "assertions": [
    "State shape unchanged after action",
    "Action sequence produces expected state",
    "Hydration restores identical state"
  ]
}
```

The dispatcher automatically creates a `T-XXX-TEST` subtask for each task with `invariant_test`.

---

## 7. CLAUDE_REQUEST_FOR_PERMISSION Protocol

When atomic decomposition is **truly impossible**, Claude produces:

```json
{
  "type": "CLAUDE_REQUEST_FOR_PERMISSION",
  "task_id": "T-XXX-001",
  "reason": "Cross-cutting concern spanning 7 tightly-coupled files",
  "attempted_decomposition": [
    "Tried splitting by file - dependencies prevent isolation",
    "Tried splitting by function - state shared across all"
  ],
  "proposed_approach": "Claude implements with detailed review checkpoints",
  "estimated_effort": "45 minutes",
  "files_affected": ["list", "of", "files"]
}
```

**This halts execution** until human approves or suggests alternative decomposition.

---

## 8. Enforcement

### Dispatcher Validation
- **BLOCK** any task failing atomic criteria
- **REJECT** needs_context without line ranges
- **AUTO-CREATE** invariant_test subtasks

### Pre-Assign Audit
Before assigning to local model, dispatcher validates:
1. All atomic criteria pass
2. Required fields present
3. Test command exists

### Recursive Decomposition
If a task fails local execution:
1. Mark as `failed`
2. Re-submit for decomposition (max depth: 3)
3. If still fails at depth 3: escalate to Claude with justification

---

## 9. Troubleshooting

### Task Fails Atomic Validation
- **files_touched > 3**: Split into multiple tasks, one per file group
- **est_lines_changed > 300**: Break into smaller logical units
- **No test_command**: Add verification (even `node -e "require('./file')"`)
- **est_local_effort_mins > 60**: Decompose into phases

### Local Model Output Incomplete
1. Check if context was sufficient (add more via needs_context)
2. Review constraints - were they clear enough?
3. Retry with refined spec
4. If fails twice: escalate to Claude

### Integration Conflicts
- Local model outputs may need Claude to resolve conflicts
- This is expected behavior - Claude's role is integration
- Keep conflict resolution minimal (decompose if complex)

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `node scripts/dispatcher.cjs add-tasks < tasks.json` | Add tasks to backlog |
| `node scripts/dispatcher.cjs assign-next` | Assign next open task |
| `node scripts/dispatcher.cjs status` | View backlog status |
| `node scripts/dispatcher.cjs audit` | Validate all tasks |

| File | Purpose |
|------|---------|
| `.claude/backlog.json` | Machine-readable task queue |
| `.claude/schemas/local-task.schema.json` | Task validation schema |
| `scripts/dispatcher.cjs` | Task assignment CLI |
| `scripts/execute-local-task.sh` | Local model execution |
