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
| 1 | [ ] | Setup: Install coverage dep, create shared utils |
| 2 | [ ] | Utility tests: displayUtils, cardUtils, actionUtils, seatUtils, exportUtils (~180 tests) |
| 3 | [ ] | Simple hook tests: useToast, usePlayerFiltering, useActionUtils, useSeatUtils, useStateSetters (~90 tests) |
| 4 | [ ] | Complex hook tests: useSeatColor, useCardSelection, useShowdownCardSelection, useShowdownHandlers (~100 tests) |
| 5 | [ ] | Persistence hook tests: usePersistence, useSessionPersistence, usePlayerPersistence (~80 tests) |
| 6 | [ ] | UI component tests (~130 tests) |
| 7 | [ ] | View component tests (~80 tests) |
| 8 | [ ] | Context provider tests (~50 tests) |

---

## Before Starting Each Phase (MANDATORY)

Run this checklist before beginning ANY phase:

- [ ] **Project file active** - Verify this file is in `docs/projects/` and registered in `.claude/projects.json`
- [ ] **Previous phase docs updated** - If not Phase 1, ensure previous phase documentation was committed
- [ ] **Tests passing** - Run `npm test` before making changes
- [ ] **Read context files** - Read all files listed in "Context Files" section above

---

## Phase 1: Setup <- CURRENT

### Goal
Install coverage dependency and create shared test utilities.

### Files to Create
- [ ] `src/test/utils.js` - Shared mock factories and test helpers

### Tasks
- [ ] Install `@vitest/coverage-v8` dependency
- [ ] Create mock state factories (createMockGameState, createMockCardState, etc.)
- [ ] Create mock dispatch factory
- [ ] Re-export constants for tests
- [ ] Run tests to verify setup works

### Verification
- [ ] `npm test` passes
- [ ] `npm test -- --coverage` works

---

## Phase 2: Utility Tests

### Goal
Test all pure utility functions (~180 tests)

### Files to Create
- [ ] `src/utils/__tests__/displayUtils.test.js` (~25 tests) - owner: local
- [ ] `src/utils/__tests__/cardUtils.test.js` (~35 tests) - owner: Claude
- [ ] `src/utils/__tests__/actionUtils.test.js` (~55 tests) - owner: Claude
- [ ] `src/utils/__tests__/seatUtils.test.js` (~45 tests) - owner: Claude
- [ ] `src/utils/__tests__/exportUtils.test.js` (~35 tests) - owner: Claude

### Verification
- [ ] All utility tests pass
- [ ] Run coverage report

---

## Phase 3: Simple Hook Tests

### Goal
Test simple/pure hooks (~90 tests)

### Files to Create
- [ ] `src/hooks/__tests__/useToast.test.js` (~20 tests) - owner: local
- [ ] `src/hooks/__tests__/usePlayerFiltering.test.js` (~30 tests) - owner: Claude
- [ ] `src/hooks/__tests__/useActionUtils.test.js` (~15 tests) - owner: Claude
- [ ] `src/hooks/__tests__/useSeatUtils.test.js` (~15 tests) - owner: Claude
- [ ] `src/hooks/__tests__/useStateSetters.test.js` (~10 tests) - owner: Claude

---

## Phase 4: Complex Hook Tests

### Goal
Test hooks with dispatch and complex logic (~100 tests)

### Files to Create
- [ ] `src/hooks/__tests__/useSeatColor.test.js` (~30 tests)
- [ ] `src/hooks/__tests__/useCardSelection.test.js` (~25 tests)
- [ ] `src/hooks/__tests__/useShowdownCardSelection.test.js` (~25 tests)
- [ ] `src/hooks/__tests__/useShowdownHandlers.test.js` (~20 tests)

---

## Phase 5: Persistence Hook Tests

### Goal
Test async hooks with IndexedDB (~80 tests)

### Files to Create
- [ ] `src/hooks/__tests__/usePersistence.test.js` (~30 tests)
- [ ] `src/hooks/__tests__/useSessionPersistence.test.js` (~25 tests)
- [ ] `src/hooks/__tests__/usePlayerPersistence.test.js` (~25 tests)

---

## Phase 6: UI Component Tests

### Goal
Test React UI components (~130 tests)

### Files to Create
- [ ] `src/components/ui/__tests__/CardSlot.test.jsx` (~18 tests)
- [ ] `src/components/ui/__tests__/Toast.test.jsx` (~12 tests)
- [ ] `src/components/ui/__tests__/ActionBadge.test.jsx` (~8 tests)
- [ ] `src/components/ui/__tests__/ActionSequence.test.jsx` (~10 tests)
- [ ] Plus ~12 more component test files

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
