---
id: project-id-here
name: Project Name
status: active
priority: P2
created: YYYY-MM-DD
backlog-id: XX
---

# Project: [Name]

## Quick Start for New Sessions

1. Read ALL files in `.claude/handoffs/` — check for file conflicts
2. Read this file — find the current phase (marked with `<- CURRENT`)
3. Read the "Context Files" for that phase
4. Create/update your handoff file in `.claude/handoffs/`
5. Execute the checklist items
6. Update this file and handoff when done

---

## Overview

[Brief description of what this project accomplishes and why it matters — written for a non-technical owner]

**Acceptance Criteria (overall):** [How does the owner verify this project is done? Plain English.]

---

## Context Files

Files to read before starting work:
- `path/to/relevant/file.js`
- `.claude/context/RELEVANT_CONTEXT.md`

---

## Phases

| Phase | Status | Description | Accept Criteria |
|-------|--------|-------------|-----------------|
| 1 | [ ] | Phase 1 description | How to verify phase 1 is done |
| 2 | [ ] | Phase 2 description | How to verify phase 2 is done |
| 3 | [ ] | Phase 3 description | How to verify phase 3 is done |

---

## Phase 1: [Name] <- CURRENT

### Goal
[What this phase accomplishes — plain English]

### Acceptance Criteria
- [ ] [Specific, owner-verifiable criterion 1]
- [ ] [Specific, owner-verifiable criterion 2]
- [ ] Tests pass

### Files This Phase Touches
_List files so other sessions know to avoid them. Copy to your handoff "Files I Own"._
- `src/path/to/file.js`
- `src/path/to/test.js`

### Context Files for This Phase
- `path/to/relevant/context.js`

### Tasks
| Task | Status | Description |
|------|--------|-------------|
| 1.1 | [ ] | [Task description] |
| 1.2 | [ ] | [Task description] |
| 1.3 | [ ] | Write tests for 1.1-1.2 |

### Verification
- [ ] All tasks completed
- [ ] Tests pass (`bash scripts/smart-test-runner.sh`)
- [ ] Acceptance criteria met
- [ ] Changes committed

---

## Phase 2: [Name]

### Goal
[What this phase accomplishes]

[Continue pattern...]

---

## Session Log

Track which sessions worked on this project and what they did:

| Date | Session | Phase | Work Done |
|------|---------|-------|-----------|
| YYYY-MM-DD | [session-id] | 1 | Created project file, started Phase 1 |

---

## Decisions Log

Key decisions made during implementation:

| Date | Decision | Rationale |
|------|----------|-----------|
| YYYY-MM-DD | Chose X over Y | [Why — plain English] |

---

## Closeout Checklist

Before marking project complete (run `/project closeout <id>`):

- [ ] All phases marked complete
- [ ] All acceptance criteria verified
- [ ] Tests passing
- [ ] All changes committed
- [ ] Documentation updated (if structural changes):
  - [ ] CLAUDE.md (architecture section)
  - [ ] docs/QUICK_REF.md (new constants/hooks/utils)
  - [ ] docs/CHANGELOG.md (version entry)
  - [ ] .claude/context/*.md (if schema/hotspot changes)
- [ ] STATUS.md updated
- [ ] Handoff file marked COMPLETE
- [ ] Backlog item(s) marked complete via `/backlog complete <id>`
