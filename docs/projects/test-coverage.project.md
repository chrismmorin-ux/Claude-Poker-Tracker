---
id: test-coverage
name: High Test Coverage Implementation
status: active
priority: high
created: 2025-12-08
---

# Project: High Test Coverage Implementation

## Quick Start for New Chats

1. Read this file first
2. Find the current phase (marked with `<- CURRENT`)
3. Read the "Context Files" for that phase
4. Execute the checklist items
5. Update status when complete

---

## Overview

Achieve 90%+ test coverage across the Poker Tracker codebase. Currently at 268 tests across 8 files. Target: ~950 tests across 30+ files.

Full plan: `C:\Users\chris\.claude\plans\binary-squishing-lagoon.md`

---

## Context Files

Files to read before starting work:
- `src/test/setup.js` - Existing test setup
- `src/utils/__tests__/validation.test.js` - Testing patterns
- `src/reducers/__tests__/gameReducer.test.js` - Reducer test patterns

---

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | [x] COMPLETE | Setup: Install coverage dep, create shared utils |
| 2 | [x] COMPLETE | Utility tests: displayUtils, cardUtils, actionUtils, seatUtils, exportUtils (~321 tests) |
| 3 | [x] COMPLETE | Simple hook tests: useToast, usePlayerFiltering, useActionUtils, useSeatUtils, useStateSetters (~125 tests) |
| 4 | [x] COMPLETE | Complex hook tests: useSeatColor, useCardSelection, useShowdownCardSelection, useShowdownHandlers (~100 tests) |
| 5 | [x] COMPLETE | Persistence hook tests: usePersistence, useSessionPersistence, usePlayerPersistence (~80 tests) |
| 6 | [x] COMPLETE | UI component tests (~423 tests) |
| 7 | [ ] | View component tests (~80 tests) <- CURRENT |
| 8 | [ ] | Context provider tests (~50 tests) |

---

## Before Starting Each Phase (MANDATORY)

Run this checklist before beginning ANY phase:

- [ ] **Project file active** - Verify this file is in `docs/projects/` and registered in `.claude/projects.json`
- [ ] **Previous phase docs updated** - If not Phase 1, ensure previous phase documentation was committed
- [ ] **Tests passing** - Run `npm test` before making changes
- [ ] **Read context files** - Read all files listed in "Context Files" section above

---

## Phase 1: Setup [COMPLETE]

### Goal
Install coverage dependency and create shared test utilities.

### Files Created
- [x] `src/test/utils.js` - Shared mock factories and test helpers

### Tasks Completed
- [x] Install `@vitest/coverage-v8` dependency
- [x] Create mock state factories (createMockGameState, createMockCardState, etc.)
- [x] Create mock dispatch factory
- [x] Re-export constants for tests
- [x] Run tests to verify setup works

### Verification
- [x] `npm test` passes
- [x] `npm test -- --coverage` works

---

## Phase 2: Utility Tests [COMPLETE]

### Goal
Test all pure utility functions (~180 tests estimated → 321 actual)

### Files Created
- [x] `src/utils/__tests__/displayUtils.test.js` (25 tests)
- [x] `src/utils/__tests__/cardUtils.test.js` (60 tests)
- [x] `src/utils/__tests__/actionUtils.test.js` (114 tests)
- [x] `src/utils/__tests__/seatUtils.test.js` (72 tests)
- [x] `src/utils/__tests__/exportUtils.test.js` (50 tests)

### Verification
- [x] All 321 utility tests pass
- [x] Coverage report generated

---

## Phase 3: Simple Hook Tests [COMPLETE]

### Goal
Test simple/pure hooks (~90 tests estimated → 125 actual)

### Files Created
- [x] `src/hooks/__tests__/useToast.test.js` (28 tests)
- [x] `src/hooks/__tests__/usePlayerFiltering.test.js` (35 tests)
- [x] `src/hooks/__tests__/useActionUtils.test.js` (32 tests)
- [x] `src/hooks/__tests__/useSeatUtils.test.js` (25 tests)
- [x] `src/hooks/__tests__/useStateSetters.test.js` (37 tests)

### Verification
- [x] All 773 tests pass (456 Phase 1-2 + 125 Phase 3 + 192 existing reducer/validation tests)

---

## Phase 4: Complex Hook Tests [COMPLETE]

### Goal
Test hooks with dispatch and complex logic (~100 tests estimated → 121 actual)

### Files Created
- [x] `src/hooks/__tests__/useSeatColor.test.js` (23 tests)
- [x] `src/hooks/__tests__/useCardSelection.test.js` (25 tests)
- [x] `src/hooks/__tests__/useShowdownCardSelection.test.js` (20 tests)
- [x] `src/hooks/__tests__/useShowdownHandlers.test.js` (22 tests)

### Verification
- [x] All 894 tests pass (773 Phase 1-3 + 121 Phase 4)

---

## Phase 5: Persistence Hook Tests [COMPLETE]

### Goal
Test async hooks with IndexedDB (~80 tests estimated → 95 actual)

### Files Created
- [x] `src/hooks/__tests__/usePersistence.test.js` (25 tests)
- [x] `src/hooks/__tests__/useSessionPersistence.test.js` (32 tests)
- [x] `src/hooks/__tests__/usePlayerPersistence.test.js` (38 tests)

### Verification
- [x] All 940 tests pass (894 Phase 1-4 + 46 Phase 5 new persistence tests)

---

## Phase 6: UI Component Tests [COMPLETE]

### Goal
Test React UI components (~130 tests estimated → 423 actual)

### Files Created
- [x] `src/components/ui/__tests__/Toast.test.jsx` (23 tests)
- [x] `src/components/ui/__tests__/PositionBadge.test.jsx` (23 tests)
- [x] `src/components/ui/__tests__/DiagonalOverlay.test.jsx` (21 tests)
- [x] `src/components/ui/__tests__/VisibilityToggle.test.jsx` (17 tests)
- [x] `src/components/ui/__tests__/ScaledContainer.test.jsx` (17 tests)
- [x] `src/components/ui/__tests__/ActionBadge.test.jsx` (21 tests)
- [x] `src/components/ui/__tests__/ActionSequence.test.jsx` (26 tests)
- [x] `src/components/ui/__tests__/CardSlot.test.jsx` (42 tests)
- [x] `src/components/ui/__tests__/ViewErrorBoundary.test.jsx` (22 tests)
- [x] `src/components/ui/__tests__/PlayerRow.test.jsx` (35 tests)
- [x] `src/components/ui/__tests__/SeatGrid.test.jsx` (30 tests)
- [x] `src/components/ui/__tests__/SessionCard.test.jsx` (30 tests)
- [x] `src/components/ui/__tests__/PlayerFilters.test.jsx` (28 tests)
- [x] `src/components/ui/__tests__/SessionForm.test.jsx` (36 tests)
- [x] `src/components/ui/__tests__/CollapsibleSidebar.test.jsx` (52 tests)

### Verification
- [x] All 1363 tests pass (940 Phase 1-5 + 423 Phase 6)

---

## Phase 7: View Component Tests

### Goal
Test view components (~80 tests)

### Files to Create
- [ ] `src/components/views/__tests__/CardSelectorView.test.jsx`
- [ ] `src/components/views/__tests__/ShowdownView.test.jsx`
- [ ] `src/components/views/__tests__/TableView.test.jsx`
- [ ] `src/components/views/__tests__/HistoryView.test.jsx`
- [ ] `src/components/views/__tests__/SessionsView.test.jsx`
- [ ] `src/components/views/__tests__/PlayersView.test.jsx`

---

## Phase 8: Context Provider Tests

### Goal
Test React context providers (~50 tests)

### Files to Create
- [ ] `src/contexts/__tests__/GameContext.test.jsx`
- [ ] `src/contexts/__tests__/UIContext.test.jsx`
- [ ] `src/contexts/__tests__/SessionContext.test.jsx`
- [ ] `src/contexts/__tests__/PlayerContext.test.jsx`
- [ ] `src/contexts/__tests__/CardContext.test.jsx`

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-08 | Full implementation with breakpoints | Balance thoroughness with review opportunities |
| 2025-12-08 | Use local models for simple tests | Save tokens on displayUtils, useToast, simple UI components |

---

## Session Log

| Date | Session | Phase | Work Done |
|------|---------|-------|-----------|
| 2025-12-08 | Initial | Planning | Created project file, analyzed codebase |

---

## Completion Checklist

Before marking project complete:
- [ ] All phases marked [x] COMPLETE
- [ ] Tests passing (900+ tests)
- [ ] Coverage at 90%+
- [ ] Documentation updated:
  - [ ] CLAUDE.md (testing section if needed)
  - [ ] docs/CHANGELOG.md (version entry)
- [ ] Committed with descriptive message
