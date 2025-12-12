---
id: project-id-here
name: Project Name
status: active
priority: medium
created: YYYY-MM-DD
---

# Project: [Name]

## Quick Start for New Chats

1. Read this file first
2. Find the current phase (marked with `← CURRENT`)
3. Read the "Context Files" for that phase
4. Execute the checklist items
5. Update status when complete

---

## Overview

[Brief description of what this project accomplishes]

---

## Context Files

Files to read before starting work:
- `path/to/relevant/file.js`
- `path/to/another/file.js`

---

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | [ ] | Phase 1 description |
| 2 | [ ] | Phase 2 description |
| 3 | [ ] | Phase 3 description |

---

## Before Starting Each Phase (MANDATORY)

Run this checklist before beginning ANY phase:

- [ ] **Project file active** - Verify this file is in `docs/projects/` and registered in `.claude/projects.json`
- [ ] **Previous phase docs updated** - If not Phase 1, ensure previous phase documentation was committed
- [ ] **Tests passing** - Run `npm test` before making changes
- [ ] **Read context files** - Read all files listed in "Context Files" section above
- [ ] **Plan if needed** - Use `EnterPlanMode` if touching 4+ files
- [ ] **Decomposition Policy** - Review `.claude/DECOMPOSITION_POLICY.md` for atomic criteria

### Atomic Criteria (ALL tasks must meet these limits)

| Criterion | Limit | Rationale |
|-----------|-------|-----------|
| `files_touched` | ≤ 3 | Limits scope complexity |
| `est_lines_changed` | ≤ 300 | Keeps tasks focused |
| `test_command` | Required | Ensures verifiability |
| `est_local_effort_mins` | ≤ 60 | Prevents runaway tasks |

**See full policy**: `.claude/DECOMPOSITION_POLICY.md`

---

## Phase 1: [Name] <- CURRENT

### Goal
[What this phase accomplishes]

### Atomic Task Decomposition (MANDATORY)

**ALL work MUST be decomposed into atomic tasks for local models.**
Tasks must meet atomic criteria (see table above). Format: `///LOCAL_TASKS`

**IMPORTANT**: Tasks with model assignments (deepseek/qwen/claude) will **auto-execute automatically** when this project is selected from the menu. NO asking, NO confirmation. Claude will show progress only: "Task T-001 completed".

| Task ID | Description | File | Model | Status |
|---------|-------------|------|-------|--------|
| T-P1-001 | [Create/Modify] [function/component name] | `path/file.js` | local:deepseek | [ ] |
| T-P1-002 | [Description] | `path/file.js` | local:qwen | [ ] |
| T-P1-003 | Write tests for T-P1-001 | `path/file.test.js` | local:qwen | [ ] |

**Task Storage**: `.claude/backlog.json` (managed via `dispatcher.cjs`)

### Task Specs (///LOCAL_TASKS format)

<details>
<summary>T-P1-001: [Task name]</summary>

```json
///LOCAL_TASKS
[
  {
    "id": "T-P1-001",
    "parent_id": "project-id-here",
    "title": "Create utility function",
    "description": "Detailed description of what to create",
    "files_touched": ["src/path/to/file.js"],
    "est_lines_changed": 25,
    "est_local_effort_mins": 15,
    "test_command": "npm test src/path/__tests__/file.test.js",
    "assigned_to": "local:deepseek",
    "priority": "P1",
    "status": "open",
    "inputs": ["param1: type", "param2: type"],
    "outputs": ["Return type and description"],
    "constraints": [
      "Import from gameConstants",
      "Include JSDoc with @param and @returns"
    ],
    "needs_context": [
      {"path": "src/relevant/context.js", "lines_start": 1, "lines_end": 50}
    ],
    "invariant_test": null
  }
]
```
</details>

### Execution Order
1. [ ] Add tasks: `cat tasks.json | node scripts/dispatcher.cjs add-tasks`
2. [ ] Execute: `node scripts/dispatcher.cjs assign-next` (repeat for each task)
3. [ ] Review outputs
4. [ ] Integration: Claude assembles pieces if needed
5. [ ] Verify: All tests pass

### Claude-Only Tasks (MUST JUSTIFY)
If any task cannot be delegated, document WHY:
- [ ] Task X: [Reason - e.g., "Failed twice with refined specs", "Requires debugging"]

### Verification
- [ ] All atomic tasks completed
- [ ] Tests pass
- [ ] Build succeeds
- [ ] Feature works as expected
- [ ] Docs updated (see source→docs mapping in CLAUDE.md)

---

## Phase 2: [Name]

### Goal
[What this phase accomplishes]

[Continue pattern...]

---

## Decisions Log

Document key decisions made during implementation:

| Date | Decision | Rationale |
|------|----------|-----------|
| YYYY-MM-DD | Chose X over Y | Reason |

---

## Session Log

Track progress across Claude Code sessions:

| Date | Session | Phase | Work Done |
|------|---------|-------|-----------|
| YYYY-MM-DD | Initial | Planning | Created project file |

---

## Completion Checklist

Before marking project complete:
- [ ] All phases marked [x] COMPLETE
- [ ] Tests passing
- [ ] Documentation updated:
  - [ ] CLAUDE.md (architecture, if structural changes)
  - [ ] docs/QUICK_REF.md (if new constants/hooks/utils)
  - [ ] docs/CHANGELOG.md (version entry)
  - [ ] docs/STATE_SCHEMAS.md (if reducer changes)
- [ ] Code reviewed or self-reviewed
- [ ] Committed with descriptive message
