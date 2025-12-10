---
id: mvp-critical-fixes
name: MVP Critical Fixes (P0+P1 Audit Issues)
status: pending
priority: P0
created: 2025-12-09
---

# Project: MVP Critical Fixes

## Quick Start for New Chats

1. Read this file first
2. Find the current phase (marked with `<- CURRENT`)
3. Read the "Context Files" for that phase
4. Execute the checklist items
5. Update status when complete

---

## Overview

Fix all P0 (critical) and P1 (high priority) issues identified in the Core System Audit before adding any new features. This is the foundation for all other MVP work.

**Roadmap Location:** MVP Phase, Sprints M1-M2
**Blocks:** All other MVP projects

---

## Context Files

Files to read before starting work:
- `docs/audits/persistence-migrations.md` - loadLatestHand normalization issue
- `docs/audits/persistence-read-paths.md` - Session hydration defaults issue
- `docs/audits/persistence-write-semantics.md` - startNewSession atomicity issue
- `docs/audits/state-machine-card.md` - Card duplicate prevention
- `docs/audits/invariant-catalog.md` - Validation requirements
- `docs/audits/validation-proposal.md` - Validation layer design

---

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | [ ] | P0 Critical Fixes (4 issues) |
| 2 | [ ] | P1 Validation Layer (4 issues) |

---

## Before Starting Each Phase (MANDATORY)

Run this checklist before beginning ANY phase:

- [ ] **Project file active** - Verify this file is in `docs/projects/` and registered in `.claude/projects.json`
- [ ] **Previous phase docs updated** - If not Phase 1, ensure previous phase documentation was committed
- [ ] **Tests passing** - Run `npm test` before making changes
- [ ] **Read context files** - Read all files listed in "Context Files" section above
- [ ] **Plan if needed** - Use `EnterPlanMode` if touching 4+ files

---

## Phase 1: P0 Critical Fixes <- CURRENT

### Goal
Fix all P0 (critical) issues identified in Core System Audit. These are issues that can cause data corruption, crashes, or silent data loss.

### Task Delegation
Before implementing, check if tasks can be delegated to local models:
- [ ] Run `/route <task>` for each subtask
- These are all Claude-level tasks (complex state management, cross-file changes)

### Tasks

#### M1-1: Fix loadLatestHand missing normalizeSeatActions
**Risk:** P0 Critical | **Effort:** Small

**Problem:** `loadLatestHand()` in persistence module doesn't call `normalizeSeatActions()`, causing old hands with string-format seatActions to be hydrated incorrectly, potentially crashing the app.

**Files to Modify:**
- [ ] `src/utils/persistence/hands.js` - Add normalizeSeatActions call to loadLatestHand

**Acceptance Criteria:**
- [ ] Old hands with string format load correctly
- [ ] New hands with array format continue to work
- [ ] Test added for normalization during load

---

#### M1-2: Add default merging to session hydration
**Risk:** P0 Critical | **Effort:** Medium

**Problem:** Session hydration uses full replacement instead of merging with defaults, leaving fields as `undefined` if stored session is missing fields (e.g., older session without `rebuyTransactions`).

**Files to Modify:**
- [ ] `src/hooks/useSessionPersistence.js` - Add default merging in hydration
- [ ] `src/reducers/sessionReducer.js` - Ensure HYDRATE_SESSION handles missing fields

**Acceptance Criteria:**
- [ ] Sessions missing fields get defaults merged in
- [ ] All session fields have safe default values
- [ ] No undefined field errors after hydration

---

#### M1-3: Make startNewSession atomic
**Risk:** P0 Critical | **Effort:** Medium

**Problem:** `startNewSession` is non-atomic (saves to IndexedDB, then sets in reducer). If step 1 succeeds but step 2 fails, we get orphan sessions in the database.

**Files to Modify:**
- [ ] `src/hooks/useSessionPersistence.js` - Wrap in try/catch, rollback on failure
- [ ] `src/utils/persistence/sessions.js` - Add rollback capability

**Acceptance Criteria:**
- [ ] If session start fails mid-operation, no orphan data remains
- [ ] Error is surfaced to user via toast
- [ ] Test covers rollback scenario

---

#### M1-4: Add card duplicate prevention in cardReducer
**Risk:** P0 Critical | **Effort:** Small

**Problem:** cardReducer allows the same card to be assigned to multiple slots (community cards, hole cards, player cards). This violates poker rules and can cause confusion.

**Files to Modify:**
- [ ] `src/reducers/cardReducer.js` - Add duplicate check before assignment

**Acceptance Criteria:**
- [ ] Same card cannot appear in multiple slots
- [ ] If card already exists elsewhere, it's removed from old slot before assignment
- [ ] Test covers duplicate prevention

---

### Verification (Phase 1)
- [ ] All 4 P0 issues fixed
- [ ] Tests pass (npm test)
- [ ] Build succeeds (npm run build)
- [ ] Manual smoke test of:
  - [ ] Loading old hand data
  - [ ] Starting new session
  - [ ] Card assignment (no duplicates possible)

---

## Phase 2: P1 Validation Layer

### Goal
Enable production-grade validation and fix remaining P1 issues. This establishes the foundation for safe feature development.

### Tasks

#### M2-1: Enable schema validation in production
**Risk:** P1 High | **Effort:** Small

**Problem:** Schema validation only runs in DEBUG mode, leaving production vulnerable to state corruption.

**Files to Modify:**
- [ ] `src/utils/reducerUtils.js` - Make validation always-on or configurable via settings

**Acceptance Criteria:**
- [ ] Validation runs in production builds
- [ ] Performance impact is acceptable (<1ms per action)
- [ ] Validation errors are logged appropriately

---

#### M2-2: Add player name uniqueness at DB level
**Risk:** P1 High | **Effort:** Medium

**Problem:** Player name uniqueness is only enforced in application code. A race condition could create duplicate players.

**Files to Modify:**
- [ ] `src/utils/persistence/players.js` - Add unique check in savePlayer
- [ ] `src/hooks/usePlayerPersistence.js` - Handle duplicate name error

**Acceptance Criteria:**
- [ ] Attempting to save duplicate name returns error
- [ ] Error is surfaced to user with clear message
- [ ] Existing duplicate players (if any) are handled gracefully

---

#### M2-3: Resolve active session dual source of truth
**Risk:** P1 High | **Effort:** Medium

**Problem:** Active session is tracked in two places: `activeSession` metadata store AND `isActive` field in session records. These can become out of sync.

**Files to Modify:**
- [ ] `src/utils/persistence/sessions.js` - Remove activeSession store usage OR make isActive derived
- [ ] `src/hooks/useSessionPersistence.js` - Use single source of truth

**Acceptance Criteria:**
- [ ] Single source of truth for active session
- [ ] No stale activeSession references
- [ ] Migration handles existing data correctly

---

#### M2-4: Add action/seat validation in recordSeatAction
**Risk:** P1 High | **Effort:** Small

**Problem:** recordSeatAction accepts any action/seat combination without validation. Invalid data could corrupt state.

**Files to Modify:**
- [ ] `src/reducers/gameReducer.js` - Add validation in RECORD_ACTION handler

**Acceptance Criteria:**
- [ ] Invalid seat numbers are rejected
- [ ] Invalid actions are rejected
- [ ] Validation errors are logged

---

### Verification (Phase 2)
- [ ] All 4 P1 issues fixed
- [ ] Tests pass (npm test)
- [ ] Build succeeds (npm run build)
- [ ] Manual smoke test of:
  - [ ] Player creation with duplicate name
  - [ ] Session management (only one active)
  - [ ] Invalid action recording (should fail gracefully)

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-09 | Fix P0 before P1 | P0 can cause crashes; P1 can cause subtle bugs |
| 2025-12-09 | All tasks Claude-level | Cross-file state management requires understanding |

---

## Session Log

| Date | Session | Phase | Work Done |
|------|---------|-------|-----------|
| 2025-12-09 | Initial | Planning | Created project file from roadmap |

---

## Completion Checklist

Before marking project complete:
- [ ] All phases marked [x] COMPLETE
- [ ] Tests passing (2,222+ tests)
- [ ] Documentation updated:
  - [ ] CLAUDE.md (if structural changes)
  - [ ] docs/CHANGELOG.md (version entry for fixes)
  - [ ] docs/audits/*.md (mark issues as FIXED)
- [ ] Code reviewed (run `/review staged`)
- [ ] Committed with descriptive message
