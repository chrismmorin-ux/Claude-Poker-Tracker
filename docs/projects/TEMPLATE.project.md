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

## Phase 1: [Name] ← CURRENT

### Goal
[What this phase accomplishes]

### Task Delegation
Before implementing, check if tasks can be delegated to local models:
- [ ] Run `/route <task>` for each subtask
- Utility functions (<80 lines) → `/local-code`
- Simple components (<100 lines) → `/local-code`
- Refactoring → `/local-refactor`
- Documentation → `/local-doc`
- Unit tests → `/local-test`

### Files to Create
- [ ] `path/to/new/file.js` - Description (owner: Claude | local)

### Files to Modify
- [ ] `path/to/existing/file.js` - What changes (owner: Claude | local)

### Implementation Details
[Technical notes, code snippets, decisions]

### Verification
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
