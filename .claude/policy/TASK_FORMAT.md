# Task Format Reference

Complete specification for `///LOCAL_TASKS` JSON format used to delegate atomic tasks to local models.

---

## Overview

All task decomposition outputs use the `///LOCAL_TASKS` JSON format documented in this file. This format ensures:
- **Atomic tasks**: Each task is small enough to complete in ≤60 minutes
- **Verifiable**: Every task has a test command that proves completion
- **Context-aware**: Local models explicitly request needed files/ranges
- **Testable**: Reducers/persistence tasks include invariant tests

**Schema Reference:** `.claude/schemas/local-task.schema.json`

---

## Complete JSON Format

```json
///LOCAL_TASKS
[
  {
    "id": "T-P1-001",
    "parent_id": null,
    "title": "Create utility function",
    "description": "Create getValidActions helper that returns valid actions for a given street and game state",
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
      "Include JSDoc with @param and @returns",
      "Must handle all street values: 'preflop', 'flop', 'turn', 'river'"
    ],
    "needs_context": [
      {"path": "src/constants/primitiveActions.js", "lines_start": 1, "lines_end": 50}
    ],
    "invariant_test": null,
    "task_complexity_type": "B",
    "edit_strategy": "create_new"
  }
]
```

---

## Field Reference

### Required Fields

| Field | Type | Limits | Purpose |
|-------|------|--------|---------|
| `id` | string | Pattern: `T-[A-Z0-9]+-\d{3}` | Unique task identifier (e.g., `T-DOC-001`) |
| `title` | string | 1-100 chars | Brief task title |
| `description` | string | ≥1 char | Detailed task description for the local model |
| `files_touched` | array | ≤3 items | Files this task creates/modifies |
| `est_lines_changed` | integer | 1-300 | Estimated lines of code changed |
| `test_command` | string | ≥1 char | Command to verify completion (e.g., `npm test`) |
| `assigned_to` | string | Pattern: `^(local:(deepseek\|qwen)\|human\|claude)$` | Task assignment (e.g., `local:qwen`) |
| `priority` | string | `P0`, `P1`, `P2`, `P3` | Task priority level |
| `status` | string | `open`, `in_progress`, `review`, `done`, `blocked`, `failed` | Current status |

### Optional Fields

| Field | Type | Purpose |
|-------|------|---------|
| `parent_id` | string\|null | Parent task ID if this is a subtask |
| `est_local_effort_mins` | integer | Estimated effort in minutes (max 60) |
| `inputs` | array | Required inputs for the task |
| `outputs` | array | Expected outputs from the task |
| `constraints` | array | Constraints the implementation must follow |
| `needs_context` | array | Specific file ranges needed as context |
| `invariant_test` | object\|null | Auto-generated test for reducers/persistence |
| `task_complexity_type` | string | `A` (Mechanical), `B` (Template), `C` (Creative), `D` (Semantic) |
| `edit_strategy` | string | `incremental_edit`, `template_fill`, `create_new`, `rewrite` |
| `edit_operations` | array | Structured edits for `incremental_edit` strategy |
| `output_template` | string | Template with {placeholders} for `template_fill` |
| `anti_patterns` | array | Examples of what NOT to do |
| `test_first` | object | TDD mode: test file + assertions |

---

## needs_context Protocol

### What It Is

The `needs_context` field allows local models to request **specific file ranges** rather than entire files. This:
- Reduces context payload
- Focuses local models on relevant code
- Prevents token waste

### Format

```json
"needs_context": [
  {"path": "src/utils/foo.js", "lines_start": 10, "lines_end": 50},
  {"path": "src/constants/bar.js", "lines_start": 1, "lines_end": 30}
]
```

### Rules

1. **Request only what's needed** - Minimum viable context
2. **Always specify line ranges** - Never request full files without justification
3. **If full file needed** - Justify in `constraints`:
   ```json
   "constraints": ["Requires full file to understand pattern"]
   ```
4. **Dispatcher validation** - Rejects needs_context without line ranges

### Examples

✅ **Good:**
```json
"needs_context": [
  {"path": "src/constants/gameConstants.js", "lines_start": 1, "lines_end": 20}
]
```

❌ **Bad:**
```json
"needs_context": [
  {"path": "src/constants/gameConstants.js"}
]
```

---

## invariant_test Protocol

### When Required

Tasks touching **MUST include `invariant_test`** if they modify:
- Reducers (`src/reducers/*.js`)
- Persistence layer (`src/utils/persistenceUtils.js`)
- Hydration logic (`src/hooks/usePersistence.js`)
- Migrations (`src/utils/migrations.js`)

### Format

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

### Dispatcher Behavior

When a task includes `invariant_test`, the Dispatcher **automatically creates** a paired `T-XXX-TEST` subtask:

```json
{
  "id": "T-P1-001-TEST",
  "parent_id": "T-P1-001",
  "title": "Test: [Parent task title]",
  "description": "Verify invariants for T-P1-001",
  "test_command": "npm test src/reducers/__tests__/gameReducer.test.js",
  // ... other fields
}
```

### Field Definitions

| Field | Type | Purpose |
|-------|------|---------|
| `target` | string | File path to test (e.g., `src/reducers/gameReducer.js`) |
| `assertions` | array | List of invariants that must hold true |

### Examples

**Reducer Modification:**
```json
"invariant_test": {
  "target": "src/reducers/gameReducer.js",
  "assertions": [
    "Initial state has all required properties",
    "ADD_PLAYER action increases player count",
    "REMOVE_PLAYER action maintains seat consistency",
    "State shape never changes between versions"
  ]
}
```

**Persistence Layer:**
```json
"invariant_test": {
  "target": "src/utils/persistenceUtils.js",
  "assertions": [
    "Save + restore produces identical state",
    "Migration handles version upgrades",
    "Corrupted data recovers gracefully"
  ]
}
```

---

## Atomic Task Criteria

A task is **atomic** if ALL of the following are true:

| Criterion | Limit | Rationale |
|-----------|-------|-----------|
| `files_touched` | ≤ 3 | Limits scope complexity |
| `est_lines_changed` | ≤ 300 | Keeps tasks focused |
| `test_command` | Required | Ensures verifiability |
| `est_local_effort_mins` | ≤ 60 | Prevents runaway tasks |

**If ANY criterion fails:** Task must be decomposed further.

---

## Task Complexity Classification

**Added 2025-12-12** - See `.claude/DECOMPOSITION_POLICY.md` Section 2.5 for full guidance.

### Type A: Mechanical Edit (BEST for local models)

**Characteristics:**
- Delete specific lines
- Replace exact strings
- Insert content at specific locations
- Copy-paste with minimal changes

**Example Task:**
```json
{
  "id": "T-MAINT-001",
  "title": "Remove deprecated dependency",
  "description": "Delete lines 4-6 containing require('old-module')",
  "files_touched": ["src/index.js"],
  "est_lines_changed": 3,
  "est_local_effort_mins": 5,
  "task_complexity_type": "A",
  "edit_strategy": "incremental_edit",
  "edit_operations": [
    {
      "type": "delete_line",
      "start_line": 4,
      "end_line": 6,
      "reason": "Dependency no longer used"
    }
  ]
}
```

### Type B: Template Fill (GOOD for local models)

**Characteristics:**
- Fill predefined structure
- Replace placeholders
- Follow strict format rules
- Minimal creative decisions

**Example Task:**
```json
{
  "id": "T-DOC-001",
  "title": "Create function stub from template",
  "task_complexity_type": "B",
  "edit_strategy": "template_fill",
  "output_template": "function {FUNCTION_NAME}({PARAMS}) {\n  // TODO: Implement\n  return {RETURN_VALUE};\n}",
  "constraints": [
    "Replace {FUNCTION_NAME} with 'validateSeat'",
    "Replace {PARAMS} with 'seatNumber'",
    "Replace {RETURN_VALUE} with 'boolean'"
  ]
}
```

### Type C: Creative Generation (RISKY for local models)

**Characteristics:**
- Write new logic from requirements
- Design data structures
- Choose algorithms

**Guideline:** Decompose into Type A/B if possible. Expect 50% failure rate.

### Type D: Semantic Rewrite (ESCALATE to Claude)

**Characteristics:**
- Understand and preserve intent while changing form
- Modify existing files while preserving content
- Fix semantic bugs

**Guideline:** DO NOT delegate to local models. Escalate to Claude immediately.

**Evidence:** See `.claude/ESCALATION_LOG.md` - 100% failure rate on Type D tasks.

---

## Common Patterns

### Pattern: Create New File

```json
{
  "id": "T-FEAT-001",
  "title": "Create new utility module",
  "description": "Create src/utils/newUtil.js with helper functions",
  "files_touched": ["src/utils/newUtil.js"],
  "est_lines_changed": 50,
  "est_local_effort_mins": 20,
  "test_command": "npm test src/utils/__tests__/newUtil.test.js",
  "assigned_to": "local:qwen",
  "priority": "P1",
  "status": "open",
  "task_complexity_type": "C",
  "edit_strategy": "create_new",
  "constraints": [
    "Export all functions with JSDoc",
    "Include error handling",
    "Match existing code style"
  ]
}
```

### Pattern: Modify Reducer with Invariant Test

```json
{
  "id": "T-FEAT-002",
  "title": "Add new action to gameReducer",
  "description": "Add RESET_GAME action handler to game reducer",
  "files_touched": ["src/reducers/gameReducer.js"],
  "est_lines_changed": 30,
  "est_local_effort_mins": 15,
  "test_command": "npm test src/reducers/__tests__/gameReducer.test.js",
  "assigned_to": "local:deepseek",
  "priority": "P1",
  "status": "open",
  "task_complexity_type": "B",
  "edit_strategy": "template_fill",
  "needs_context": [
    {"path": "src/reducers/gameReducer.js", "lines_start": 1, "lines_end": 50},
    {"path": "src/constants/gameConstants.js", "lines_start": 1, "lines_end": 30}
  ],
  "invariant_test": {
    "target": "src/reducers/gameReducer.js",
    "assertions": [
      "RESET_GAME action resets all game state",
      "State shape remains consistent",
      "Previous game data is cleared"
    ]
  }
}
```

### Pattern: TDD Mode (Test-First Development)

```json
{
  "id": "T-FEAT-003",
  "title": "Implement validation function",
  "description": "Implement isValidSeat() to pass existing tests",
  "files_touched": ["src/utils/validators.js"],
  "est_lines_changed": 20,
  "est_local_effort_mins": 15,
  "test_command": "npm test src/utils/__tests__/validators.test.js",
  "assigned_to": "local:qwen",
  "priority": "P1",
  "status": "open",
  "task_complexity_type": "B",
  "edit_strategy": "create_new",
  "test_first": {
    "test_file": "src/utils/__tests__/validators.test.js",
    "assertions": [
      "Returns true for seats 0-8",
      "Returns false for negative numbers",
      "Returns false for numbers > 8"
    ]
  }
}
```

---

## Validation Rules

The Dispatcher validates all tasks before assignment:

1. ✅ `id` matches pattern `T-[A-Z0-9]+-\d{3}`
2. ✅ `files_touched` ≤ 3 items
3. ✅ `est_lines_changed` ≤ 300
4. ✅ `est_local_effort_mins` ≤ 60
5. ✅ `test_command` is not empty
6. ✅ `assigned_to` is valid
7. ✅ `needs_context` has `lines_start` and `lines_end` for each item
8. ✅ `invariant_test` is present for reducer/persistence tasks

**Dispatcher blocks** any task failing validation.

---

## File Locations

| File | Purpose |
|------|---------|
| `.claude/schemas/local-task.schema.json` | JSON Schema validation |
| `.claude/DECOMPOSITION_POLICY.md` | Full policy reference (Section 3) |
| `.claude/backlog.json` | Deployed tasks |
| `.claude/TASK_FORMAT.md` | This file |

---

## Quick Examples

### Simple Task
```json
{
  "id": "T-DOC-001",
  "title": "Update README",
  "description": "Add section for new feature",
  "files_touched": ["README.md"],
  "est_lines_changed": 15,
  "est_local_effort_mins": 10,
  "test_command": "test -f README.md && grep -q 'New Feature' README.md",
  "assigned_to": "local:qwen",
  "priority": "P2",
  "status": "open"
}
```

### Complex Task with Context
```json
{
  "id": "T-FEAT-001",
  "title": "Add player removal action",
  "description": "Implement REMOVE_PLAYER action in game reducer with seat cleanup",
  "files_touched": ["src/reducers/gameReducer.js"],
  "est_lines_changed": 40,
  "est_local_effort_mins": 30,
  "test_command": "npm test src/reducers/__tests__/gameReducer.test.js",
  "assigned_to": "local:deepseek",
  "priority": "P1",
  "status": "open",
  "constraints": [
    "Maintain SEAT_ARRAY order",
    "Clear player data completely",
    "Update player count"
  ],
  "needs_context": [
    {"path": "src/reducers/gameReducer.js", "lines_start": 1, "lines_end": 100},
    {"path": "src/constants/gameConstants.js", "lines_start": 1, "lines_end": 50}
  ],
  "invariant_test": {
    "target": "src/reducers/gameReducer.js",
    "assertions": [
      "Player is removed from state",
      "Seat is cleaned up",
      "Game continues normally"
    ]
  }
}
```

---

## See Also

- `.claude/DECOMPOSITION_POLICY.md` - Complete decomposition rules (Section 3)
- `.claude/agents/dispatcher.md` - Task assignment and execution
- `.claude/schemas/local-task.schema.json` - JSON Schema definition
