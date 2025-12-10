# Project Backlog - Single Source of Truth
**Last Updated**: 2025-12-09 | **Updated By**: Claude

This file is the central registry for ALL work: active, delegated, pending, and planned.
Both Claude and local models read and update this file.

---

## How to Use This File

### For Claude
- Read this file at session start to understand current work state
- Update task status as work progresses
- Add new tasks discovered during implementation
- Move completed items to the Completed section with date

### For Local Models
When completing a delegated task, append to the `## Local Model Updates` section:
```
### [TIMESTAMP] Task Completed
- **Task ID**: T-XXX
- **Status**: completed | failed | blocked
- **Output**: Brief description or file path
- **Notes**: Any issues encountered
```

### For Human (Chris)
- Add items anywhere with `[HUMAN]` prefix
- Set priorities: P0 (urgent), P1 (high), P2 (medium), P3 (low)
- Mark items for delegation with `[LOCAL]` tag

---

## Active Work (In Progress)

### Current Session Tasks
| ID | Task | Owner | Status | Notes |
|----|------|-------|--------|-------|
| - | No active tasks | - | - | - |

### Active Projects
| Project | Phase | Progress | File |
|---------|-------|----------|------|
| - | No active projects | - | See `docs/projects/` |

---

## Delegated to Local Models

Tasks assigned to local models (DeepSeek/Qwen). Local models update status here.

| ID | Task | Model | Status | Command | Output |
|----|------|-------|--------|---------|--------|
| - | No delegated tasks | - | - | - | - |

### Delegation Template
When delegating, Claude outputs:
```
///LOCAL_TASKS
[
  {
    "id": "T-001",
    "title": "Task description",
    "inputs": ["file1.js", "file2.js"],
    "constraints": ["constraint1", "constraint2"],
    "tests": ["npm test path/to/test"],
    "priority": "P1",
    "assigned_to": "local:deepseek-coder",
    "expected_patch_format": "unified-diff"
  }
]
```

---

## Pending Tasks (Ready to Start)

### P0 - Urgent
| ID | Task | Owner | Est. Effort | Dependencies |
|----|------|-------|-------------|--------------|
| - | None | - | - | - |

### P1 - High Priority
| ID | Task | Owner | Est. Effort | Dependencies |
|----|------|-------|-------------|--------------|
| - | None | - | - | - |

### P2 - Medium Priority
| ID | Task | Owner | Est. Effort | Dependencies |
|----|------|-------|-------------|--------------|
| CTX-001 | Add pre-commit hook for context summaries | Claude | 30min | None |
| CTX-002 | Create CI workflow for context regeneration | Claude | 1hr | CTX-001 |
| CTX-003 | Add token counting validation to context files | Local | 15min | None |

### P3 - Low Priority
| ID | Task | Owner | Est. Effort | Dependencies |
|----|------|-------|-------------|--------------|
| DOC-001 | Add API_REFERENCE.md context file | Local | 30min | None |
| DOC-002 | Add TESTING_GUIDE.md context file | Local | 30min | None |
| DOC-003 | Auto-populate RECENT_CHANGES.md from git log | Claude | 1hr | None |

---

## Planned Projects (Not Yet Started)

Projects that need `/project start` before beginning.

### TypeScript Migration
- **ID**: typescript-migration
- **Priority**: P2
- **Status**: Planned (not started)
- **File**: `docs/projects/typescript-migration.project.md`
- **Description**: Type definitions, type guards, gradual conversion
- **Phases**: 3 planned
- **Blocked By**: None (ready when prioritized)

### Future Ideas
| Idea | Description | Complexity | Notes |
|------|-------------|------------|-------|
| Stats Dashboard | Visual stats for session history | Medium | Needs charting library |
| Cloud Sync | Backup/restore to cloud storage | High | Security considerations |
| Mobile PWA | Progressive web app packaging | Medium | Service worker needed |

---

## Local Model Updates

Local models append completion updates here. Claude processes these on next session.

```
### 2025-12-09T00:00:00Z - Section Created
- Initial backlog structure created
- No local model updates yet
```

---

## Completed (Archive)

### 2025-12-09
- [x] Create `.claude/context/` directory structure
- [x] Create 5 context summary files (CONTEXT_SUMMARY, STATE_SCHEMA, PERSISTENCE_OVERVIEW, RECENT_CHANGES, HOTSPOTS)
- [x] Create `scripts/update_context_summaries.sh`
- [x] Integrate context files into CLAUDE.md Quick Start
- [x] Audit and activate all orphaned hooks in settings.json
- [x] Remove redundant docs (LOCAL_MODELS.md, ROUTING_HELPER_README.md)
- [x] Remove redundant hooks (edit-review-suggest.cjs, arch-audit.cjs)
- [x] Add delegation policy to CLAUDE.md

### Completed Projects
| Project | Completed | Phases | Archive |
|---------|-----------|--------|---------|
| Audit Fix Implementation | 2025-12-09 | 3/3 | `docs/projects/audit-fix-implementation.project.md` |
| Core System Audit | 2025-12-09 | 5/5 | `docs/projects/core-system-audit.project.md` |
| Comprehensive Refactoring v114 | 2025-12-09 | 4/5 | `docs/archive/comprehensive-refactoring-v114.project.md` |
| Test Coverage | 2025-12-09 | 13/13 | `docs/archive/test-coverage.project.md` |
| Debug Infrastructure | 2025-12-07 | 8/8 | `docs/archive/debug-infrastructure.project.md` |
| CTO Review v112 | 2025-12-07 | 11/11 | `docs/archive/cto-review-v112.project.md` |

---

## Context File Priority

**For Claude and local models**: When starting a new task, **read `.claude/context/*.md` files first** before requesting full source files. These summaries (~2000 tokens total) provide sufficient context for most tasks. Only request full files when summaries are insufficient.

---

## Quick Reference

### Commands
- `/project start <name>` - Create new project
- `/project status` - View all projects
- `/backlog` - View this file formatted
- `/route <task>` - Get delegation recommendation
- `/local-code <task>` - Delegate to DeepSeek
- `/local-refactor <task>` - Delegate to Qwen

### Task ID Prefixes
- `T-XXX` - General tasks
- `CTX-XXX` - Context/documentation tasks
- `DOC-XXX` - Documentation tasks
- `FIX-XXX` - Bug fixes
- `FEAT-XXX` - Features
- `INFRA-XXX` - Infrastructure

### Status Values
- `pending` - Ready to start
- `in_progress` - Currently being worked on
- `delegated` - Assigned to local model
- `blocked` - Waiting on dependency
- `completed` - Done
- `failed` - Attempted but failed
