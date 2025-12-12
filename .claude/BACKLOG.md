# Project Backlog - Single Source of Truth
**Last Updated**: 2025-12-12 | **Updated By**: Claude

This file is the central registry for ALL work: active, delegated, pending, and planned.
Both Claude and local models read and update this file.

> **Machine-readable tasks**: `.claude/backlog.json`
> **Task format**: Use `///LOCAL_TASKS` (see `.claude/DECOMPOSITION_POLICY.md`)

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
| AUTH-002 | Firebase Auth Phase 5 - Data Isolation | Claude | pending | Next phase |

### Active Projects
| Project | Phase | Progress | File |
|---------|-------|----------|------|
| Decomposition Policy | Phase 8 | 8/10 phases | `docs/projects/0.001.1211-decomposition-policy.project.md` |
| Local Model Enforcement | Phase 1 | 0/7 phases | `docs/projects/0.002.1212-local-model-enforcement.project.md` |
| Primitive Actions UI | Phase 1 | 0/4 phases | `docs/projects/1.001.1211-primitive-actions-ui.project.md` |
| Firebase Auth | Phase 5 | 4/5 phases | `docs/projects/firebase-auth.project.md` |

### Completed Projects
| Project | Completed | File |
|---------|-----------|------|
| Program Management Agent | 2025-12-11 | `docs/projects/1.001.1211-program-manager.project.md` |

---

## Delegated to Local Models

Tasks assigned to local models (DeepSeek/Qwen). Local models update status here.

| ID | Task | Model | Status | Command | Output |
|----|------|-------|--------|---------|--------|
| T-2.1 | Create primitiveActions.js | local:deepseek | pending | - | Awaiting dispatcher fix, then re-execute |
| T-2.2 | Create primitiveActionValidation.js | local:deepseek | pending | - | Awaiting dispatcher fix, then re-execute |
| T-2.3 | Create primitive action tests | local:qwen | pending | - | Awaiting dispatcher fix, then re-execute |
| T-2.4 | Add PRIMITIVE_ACTIONS export to gameConstants.js | local:qwen | pending | - | Awaiting dispatcher fix, then re-execute |

*Note: If local model outputs code without creating files, this indicates a dispatcher integration bug that must be fixed per DECOMPOSITION_POLICY.md Section 9 (recursive decomposition). Do NOT bypass delegation - troubleshoot and fix the underlying issue.

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
| ARCH-001 | Further PokerTracker.jsx decomposition (Option C: Full Context Migration) | Claude | 2-3hr | Trigger: >1200 lines |

### Deferred Architecture Decisions
| ID | Decision | Revisit Trigger | Notes |
|----|----------|-----------------|-------|
| ARCH-001 | PokerTracker.jsx further decomposition | File exceeds 1200 lines OR new view requires 5+ file changes | Options: ViewRouter prop passing, handler hooks, full context migration. Current: 852 lines. See chat 2025-12-10 for analysis. |

---

## Planned Projects (Not Yet Started)

Projects that need `/project start` before beginning.

### Project Priority Order

**Source of Truth**: `docs/projects/` file names

**Naming Format**: `{priority}.{sequence}.{MMDD}-{name}.project.md`
- Priority: 1=P1, 2=P2, 3=P3, 4=P4
- Sequence: 001, 002, etc. (per priority)
- Date: MMDD when created

**Current Queue**:
```
0.001.1211-decomposition-policy     ← P0, Active (57 tasks, 10 phases)
0.002.1212-local-model-enforcement  ← P0, Active (20 tasks, 7 phases) **NEW**
1.001.1211-primitive-actions-ui     ← P1, Active (18 tasks, 4 phases)
2.001.1210-firebase-auth            ← P2, Paused (5/6)
3.001.1209-firebase-cloud-sync
3.002.1209-player-tendencies
4.001.1209-range-analysis
4.002.1209-typescript-migration
```

**Adding New Projects**:
- New P1 urgent: `1.002.MMDD-name.project.md`
- New P3: `3.003.MMDD-name.project.md`
- Sorting is automatic (1.001 < 1.002 < 2.001 < 3.001)

**Commands**: `/project-queue` | startup menu

### Active Projects

None - all MVP projects complete!

### MVP Phase Projects

#### Firebase Authentication (PAUSED)
- **ID**: firebase-auth
- **Priority**: P2
- **Status**: PAUSED (5/6 phases complete)
- **File**: `docs/projects/firebase-auth.project.md`
- **Description**: Optional Firebase Auth with email/password + Google OAuth, guest mode preserved
- **Phases**: 5/6 complete
- **Completed Phases**:
  - Phase 1: Firebase Infrastructure Setup
  - Phase 2: Auth State Management (Reducer + Context)
  - Phase 3: Authentication Views (Login, Signup, Reset)
  - Phase 4: Account Management in Settings
  - Phase 5: Data Isolation (via Architecture Health - IndexedDB v7/v8 userId)
- **Remaining**: Phase 6 (Integration & Testing) - deferred until cloud sync needed

#### MVP UI Polish (COMPLETE)
- **ID**: mvp-polish
- **Priority**: P2
- **Status**: ✅ Complete (2025-12-11)
- **File**: `docs/projects/mvp-polish.project.md`
- **Description**: Toast review, error message polish, UI animations, destructive action confirmations
- **Phases**: 4/4 complete
- **Result**: All views have toast feedback, error messages polished, destructive actions have confirmations

#### Settings System (COMPLETE)
- **ID**: settings-system
- **Priority**: P1
- **Status**: ✅ Complete (2025-12-09)
- **File**: `docs/projects/settings-system.project.md`
- **Description**: Settings infrastructure, preferences UI, venue/game type customization
- **Phases**: 3/3 complete
- **Result**: v115 - Full settings system with persistence

#### Error Reporting (COMPLETE)
- **ID**: error-reporting
- **Priority**: P2
- **Status**: ✅ Complete (2025-12-10)
- **File**: `docs/projects/error-reporting.project.md`
- **Description**: Local error logging, error log viewer, bug report export
- **Phases**: 3/3 complete
- **Result**: v116 - Error log utility, viewer in Settings, Report Bug feature

#### Architecture Health & Action System Refactor (COMPLETE)
- **ID**: architecture-health
- **Priority**: P0 (Critical for future features)
- **Status**: ✅ COMPLETE (2025-12-10)
- **File**: `docs/projects/architecture-health.project.md`
- **Description**: CTO review fixes + action system refactor (primitive actions → pattern recognition)
- **Phases**: 5/5 complete
- **Result**: v117 - Action sequences, pattern recognition, IndexedDB v8

---

### Phase 2 Projects (Post-MVP)

#### Firebase Cloud Sync
- **ID**: firebase-cloud-sync
- **Priority**: P3
- **Status**: Planned
- **File**: `docs/projects/firebase-cloud-sync.project.md`
- **Description**: Firebase backup/restore, device-based auth, conflict resolution, multi-device sync
- **Phases**: 5 planned
- **Blocked By**: settings-system, MVP complete

#### Player Tendencies Analytics (PRIMARY)
- **ID**: player-tendencies
- **Priority**: P3
- **Status**: Planned
- **File**: `docs/projects/player-tendencies.project.md`
- **Description**: VPIP, PFR, aggression factor, 3-bet%, C-bet% calculations and display
- **Phases**: 5 planned
- **Blocked By**: MVP complete
- **Note**: User's primary analytics focus

---

### Phase 3 Projects (Expansion)

#### Range Analysis Tools
- **ID**: range-analysis
- **Priority**: P4
- **Status**: Planned
- **File**: `docs/projects/range-analysis.project.md`
- **Description**: Hand range input matrix, equity calculator, range comparison
- **Phases**: 4 planned
- **Blocked By**: Phase 2 complete

#### TypeScript Migration
- **ID**: typescript-migration
- **Priority**: P4
- **Status**: Planned
- **File**: `docs/projects/typescript-migration.project.md`
- **Description**: Type definitions, type guards, gradual conversion
- **Phases**: 3 planned
- **Blocked By**: MVP complete (optional enhancement)
- **Motivation**: Catches function signature mismatches at compile time (e.g., useAuthPersistence bug 2025-12-10 where wrong args passed silently failed)

---

### Future Ideas
| Idea | Description | Complexity | Notes |
|------|-------------|------------|-------|
| Advanced Stats | Positional stats, trends over time | Medium | After player-tendencies |
| Mobile PWA | Progressive web app packaging | Medium | Service worker needed |
| Session Heat Maps | Profit by hour of day | Medium | After basic analytics |

---

## Local Model Updates

Local models append completion updates here. Claude processes these on next session.

```
### 2025-12-10T08:00:00Z - Process Enforcement Hooks Added
- Added backlog-check.cjs hook (reminds to read BACKLOG.md at session start)
- Added delegation-check.cjs hook (warns when writing files marked for local models)
- Updated CLAUDE.md with mandatory checklist including backlog and delegation rules
- Reason: Claude violated delegation policy in Firebase Auth Phase 3 (4 tasks done by Claude that were marked for local models)

### 2025-12-09T00:00:00Z - Section Created
- Initial backlog structure created
- No local model updates yet
```

---

## Completed (Archive)

### 2025-12-10
- [x] TOK-002: Token Optimization Phase 2 - Budget Metrics Dashboard
  - Created `.claude/hooks/metrics-collector.cjs` (PostToolUse hook)
  - Created `.claude/commands/metrics.md` (slash command)
  - Updated `.claude/metrics/dashboard.md` with weekly rollup template
  - Registered hook for all tools in settings.json

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
| Local Model Orchestration | 2025-12-11 | 6/6 | `docs/archive/local-model-orchestration.project.md` |
| Architecture Health | 2025-12-10 | 5/5 | `docs/archive/architecture-health.project.md` |
| Error Reporting | 2025-12-10 | 3/3 | `docs/archive/error-reporting.project.md` |
| Settings System | 2025-12-09 | 3/3 | `docs/archive/settings-system.project.md` |
| MVP Critical Fixes | 2025-12-09 | 2/2 | `docs/archive/mvp-critical-fixes.project.md` |
| Audit Fix Implementation | 2025-12-09 | 3/3 | `docs/archive/audit-fix-implementation.project.md` |
| Core System Audit | 2025-12-09 | 5/5 | `docs/archive/core-system-audit.project.md` |
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
