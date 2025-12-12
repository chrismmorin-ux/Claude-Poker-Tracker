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

---

## Phase 1: [Name] <- CURRENT

### Goal
[What this phase accomplishes]

### Atomic Task Decomposition (MANDATORY)

**ALL work MUST be decomposed into atomic tasks for local models.**
Each task: ≤30 lines, single function/component, clear inputs/outputs.

| Task ID | Description | File | Model | Status |
|---------|-------------|------|-------|--------|
| T-001 | [Create/Modify] [function/component name] | `path/file.js` | deepseek | [ ] |
| T-002 | [Description] | `path/file.js` | qwen | [ ] |
| T-003 | Write tests for T-001 | `path/file.test.js` | qwen | [ ] |

**Task Spec Location**: `.claude/task-specs/[project-id]/T-XXX.json`

### Task Specs (Create before executing)

<details>
<summary>T-001: [Task name]</summary>

```json
{
  "task_id": "T-001",
  "model": "deepseek",
  "type": "create",
  "description": "Detailed description of what to create",
  "output_file": "src/path/to/file.js",
  "function_name": "functionName",
  "context_files": ["src/relevant/context.js"],
  "inputs": "param1: type, param2: type",
  "outputs": "Return type and description",
  "constraints": [
    "Constraint 1",
    "Constraint 2"
  ],
  "example_usage": "functionName(arg1, arg2) => expected",
  "max_lines": 25
}
```
</details>

### Execution Order
1. [ ] Execute T-001: `./scripts/execute-local-task.sh .claude/task-specs/[project-id]/T-001.json`
2. [ ] Review T-001 output
3. [ ] Execute T-002...
4. [ ] Integration: Claude assembles pieces if needed
5. [ ] Execute test tasks (T-00X)

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
