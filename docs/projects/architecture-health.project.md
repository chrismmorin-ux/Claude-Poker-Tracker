---
id: architecture-health
name: Architecture Health & Action System Refactor
status: active
priority: P0
created: 2025-12-10
plan_file: C:\Users\chris\.claude\plans\frolicking-cooking-glacier.md
---

# Project: Architecture Health & Action System Refactor

## Quick Start for New Chats

1. Read this file first
2. Find the current phase (marked with `← CURRENT`)
3. Read the "Context Files" for that phase
4. Execute the checklist items
5. Update status when complete

---

## User Decisions (2025-12-10)

- **Bet Sizing**: Defer to future project (simpler implementation now)
- **UI Labels**: Context-aware (show "Limp", "Open", "3bet" based on game state)
- **Hand Strength**: Separate project (focus on action system first)

---

## Overview

Comprehensive architecture improvements to prepare the codebase for complex future features (hand history analysis, range tracking, exploit identification). This project combines:

1. **CTO Review Findings** - Critical architecture debt from v116 review
2. **Action System Refactor** - Simplify to primitive actions, derive patterns

### Why This Matters

Current action system has fundamental issues:
- Actions like "check-raise" and "3bet" are recorded directly, but they're actually **patterns** (sequences of primitive actions)
- This makes replay/analysis impossible because we can't reconstruct the actual action sequence
- Future features (hand replayer, range analysis, exploit detection) require accurate action sequences

### Target Architecture

```
LAYER 1: Primitive Actions (what user inputs)
├── check, bet, call, raise, fold

LAYER 2: Action Sequence Storage (what we persist)
├── Ordered list: [{seat, action, street, order}, ...]

LAYER 3: Pattern Recognition (computed on read)
├── Preflop: limp, open, 3bet, 4bet, cold-call, squeeze
├── Postflop: cbet, donk, probe, float, check-raise, delayed-cbet

LAYER 4: UI Display (context-aware labels)
├── Show "Limp" for CALL when no raise, "Open" for first RAISE, etc.
```

---

## Context Files

Files to read before starting work:
- `.claude/context/STATE_SCHEMA.md` - Current state structure
- `src/constants/gameConstants.js` - Current ACTIONS constants
- `src/reducers/gameReducer.js` - How actions are stored
- `src/utils/actionUtils.js` - Action display helpers
- `docs/STATE_SCHEMAS.md` - Full state documentation

---

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | [ ] | Architecture Cleanup (CTO findings) |
| 2 | [ ] | Primitive Action System |
| 3 | [ ] | Action Sequence Storage |
| 4 | [ ] | Pattern Recognition Engine |
| 5 | [ ] | Migration & Integration |

---

## Phase 1: Architecture Cleanup ← CURRENT

### Goal
Address critical CTO review findings before major refactoring.

### Before Starting (MANDATORY)
- [ ] Run `npm test` - ensure baseline passing
- [ ] Run `npm audit` - document current vulnerabilities
- [ ] Read `src/PokerTracker.jsx` to understand current structure

---

### Task 1.1: IndexedDB Data Isolation

**Goal**: Add userId to all IndexedDB records for multi-user support.

| Task ID | Description | Owner | Lines | Dependencies |
|---------|-------------|-------|-------|--------------|
| 1.1.1 | Create v7 migration schema with userId field | Local | ~60 | None |
| 1.1.2 | Update handsStorage.js - add userId filter to all queries | Local | ~40 | 1.1.1 |
| 1.1.3 | Update sessionsStorage.js - add userId filter | Local | ~40 | 1.1.1 |
| 1.1.4 | Update playersStorage.js - add userId filter | Local | ~40 | 1.1.1 |
| 1.1.5 | Update settingsStorage.js - change singleton to per-user | Local | ~30 | 1.1.1 |
| 1.1.6 | Update activeSession to use userId key | Local | ~20 | 1.1.1 |
| 1.1.7 | Update usePersistence hook to get userId from AuthContext | Claude | ~50 | 1.1.2-6 |
| 1.1.8 | Create migration tests | Local | ~100 | 1.1.1-6 |

**Files Modified**:
- `src/utils/persistence/database.js` - v7 migration
- `src/utils/persistence/handsStorage.js`
- `src/utils/persistence/sessionsStorage.js`
- `src/utils/persistence/playersStorage.js`
- `src/utils/persistence/settingsStorage.js`
- `src/hooks/usePersistence.js`

**Schema Change (v6 → v7)**:
```js
// Each object store gets userId field
// Migration: existing records get userId = 'guest'
// New index: compound index on userId + existing indexes

// Example for hands store:
// Old: { handId, sessionId, timestamp, ... }
// New: { handId, sessionId, timestamp, userId, ... }
// Index: ['userId', 'timestamp'] for efficient queries
```

**Acceptance Criteria**:
- [ ] IndexedDB migrates from v6 to v7 without data loss
- [ ] All existing data marked with userId = 'guest'
- [ ] Queries filter by current user's userId
- [ ] Guest data can be claimed on account creation

---

### Task 1.2: Main Component Decomposition

**Goal**: Split PokerTracker.jsx (892 lines) into focused modules.

| Task ID | Description | Owner | Lines | Dependencies |
|---------|-------------|-------|-------|--------------|
| 1.2.1 | Create AppProviders.jsx - extract provider composition (lines 631-647) | Local | ~60 | None |
| 1.2.2 | Create useAppState.js hook - consolidate reducer/persistence init (lines 128-174) | Local | ~80 | None |
| 1.2.3 | Create ViewRouter.jsx - extract view routing (lines 649-881) | Claude | ~200 | 1.2.1 |
| 1.2.4 | Refactor PokerTracker.jsx to use extracted modules | Claude | ~100 | 1.2.1-3 |
| 1.2.5 | Create tests for AppProviders | Local | ~40 | 1.2.1 |
| 1.2.6 | Create tests for useAppState | Local | ~60 | 1.2.2 |

**Files Created**:
- `src/AppProviders.jsx` (~60 lines)
- `src/hooks/useAppState.js` (~80 lines)
- `src/ViewRouter.jsx` (~200 lines)

**Files Modified**:
- `src/PokerTracker.jsx` (target: <400 lines, down from 892)

**Provider Nesting Order** (must preserve):
```
AuthProvider → GameProvider → UIProvider → SessionProvider → PlayerProvider → CardProvider → SettingsProvider
```

**Acceptance Criteria**:
- [ ] All 2,351 tests still pass
- [ ] No functional changes
- [ ] PokerTracker.jsx under 400 lines
- [ ] Clear separation of concerns

---

### Task 1.3: Dependency Updates

| Task ID | Description | Owner | Lines | Dependencies |
|---------|-------------|-------|-------|--------------|
| 1.3.1 | Update Vite/esbuild to fix GHSA-67mh-4wv8-2f99 | Local | ~5 | None |
| 1.3.2 | Verify dev server and build work | Local | - | 1.3.1 |
| 1.3.3 | Run full test suite | Local | - | 1.3.2 |

**Acceptance Criteria**:
- [ ] `npm audit` shows no moderate+ vulnerabilities
- [ ] Dev server and build work correctly
- [ ] All tests pass

---

### Phase 1 Verification
- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] App functions in all 7 views
- [ ] Commit with message: `refactor: Phase 1 architecture cleanup`

---

## Phase 2: Primitive Action System

### Goal
Replace 18 complex actions with 5 primitives: `check`, `bet`, `call`, `raise`, `fold`

| Task ID | Description | Owner | Lines | Dependencies |
|---------|-------------|-------|-------|--------------|
| 2.1 | Create `src/constants/primitiveActions.js` | Local | ~50 | None |
| 2.2 | Create `src/utils/primitiveActionValidation.js` | Local | ~70 | 2.1 |
| 2.3 | Create primitive action tests | Local | ~80 | 2.1, 2.2 |
| 2.4 | Add PRIMITIVE_ACTIONS export to gameConstants.js | Local | ~10 | 2.1 |

**File: `src/constants/primitiveActions.js`**
```js
export const PRIMITIVE_ACTIONS = {
  CHECK: 'check',   // Pass when no bet to call
  BET: 'bet',       // First chips into pot on street
  CALL: 'call',     // Match existing bet
  RAISE: 'raise',   // Increase existing bet
  FOLD: 'fold',     // Surrender hand
};

export const LEGACY_TO_PRIMITIVE = {
  'fold': 'fold', 'limp': 'call', 'call': 'call',
  'open': 'raise', '3bet': 'raise', '4bet': 'raise',
  'check': 'check', 'cbet_ip_small': 'bet', 'cbet_ip_large': 'bet',
  'cbet_oop_small': 'bet', 'cbet_oop_large': 'bet',
  'donk': 'bet', 'stab': 'bet', 'check_raise': 'raise',
  'fold_to_cbet': 'fold', 'fold_to_cr': 'fold',
};
```

### Phase 2 Verification
- [ ] Tests updated for new action constants
- [ ] PRIMITIVE_ACTIONS exported from gameConstants
- [ ] All tests pass

---

## Phase 3: Action Sequence Storage

### Goal
Store ordered action sequences instead of aggregated seat actions.

**Current Storage** (Problem):
```js
seatActions: { preflop: { 1: ['fold'], 2: ['3bet'] } }
// Missing: order, timing, who acted when
```

**Target Storage** (Solution):
```js
actionSequence: [
  { street: 'preflop', seat: 2, action: 'raise', order: 1 },
  { street: 'preflop', seat: 3, action: 'raise', order: 2 },  // This is the 3bet
  { street: 'preflop', seat: 1, action: 'fold', order: 3 },
]
```

| Task ID | Description | Owner | Lines | Dependencies |
|---------|-------------|-------|-------|--------------|
| 3.1 | Create `src/types/actionTypes.js` - type definitions | Local | ~40 | Phase 2 |
| 3.2 | Update gameReducer - add actionSequence state + actions | Claude | ~150 | 3.1 |
| 3.3 | Create `src/utils/sequenceUtils.js` | Local | ~60 | 3.1 |
| 3.4 | Create sequenceUtils tests | Local | ~100 | 3.3 |
| 3.5 | Update ActionPanel.jsx for primitive actions with context-aware labels | Claude | ~80 | 3.2 |
| 3.6 | Update handsStorage.js to store actionSequence | Local | ~40 | 3.3 |
| 3.7 | Create `src/migrations/migrateToSequence.js` | Local | ~70 | 3.3 |

**New Reducer Actions**:
- `RECORD_PRIMITIVE_ACTION` - Add entry to sequence with auto-incrementing order
- `UNDO_SEQUENCE_ACTION` - Remove last action from sequence
- `CLEAR_SEQUENCE` - Clear all actions (new hand)
- `ADVANCE_SEQUENCE_STREET` - Mark new street in sequence

### Phase 3 Verification
- [ ] Actions record in sequence with correct order
- [ ] UI shows context-aware labels (Limp, Open, 3bet, etc.)
- [ ] Sequences persist to IndexedDB
- [ ] Legacy hands migrated on load

---

## Phase 4: Pattern Recognition Engine

### Goal
Derive poker patterns (limp, open, 3bet, cbet, check-raise, etc.) from primitive sequences.

| Task ID | Description | Owner | Lines | Dependencies |
|---------|-------------|-------|-------|--------------|
| 4.1 | Create `src/utils/patternRecognition/positionUtils.js` | Local | ~60 | None |
| 4.2 | Create `src/utils/patternRecognition/preflopPatterns.js` | Local | ~80 | 3.1, 4.1 |
| 4.3 | Create `src/utils/patternRecognition/postflopPatterns.js` | Local | ~100 | 3.1, 4.1 |
| 4.4 | Create `src/utils/patternRecognition/index.js` | Local | ~30 | 4.1-4.3 |
| 4.5 | Create pattern recognition tests | Local | ~150 | 4.1-4.4 |
| 4.6 | Update actionUtils.js for pattern display | Claude | ~60 | 4.4 |
| 4.7 | Update ActionBadge/ActionSequence for patterns | Local | ~50 | 4.6 |

**Preflop Patterns**:
| Pattern | Detection Rule |
|---------|---------------|
| Limp | CALL when betLevel=1 (only blinds) |
| Open | First RAISE preflop |
| 3-bet | RAISE when betLevel=2 |
| 4-bet | RAISE when betLevel=3 |
| Cold-call | CALL after a raise |
| Squeeze | 3-bet with callers in pot |

**Postflop Patterns**:
| Pattern | Detection Rule |
|---------|---------------|
| C-bet | First bet by preflop aggressor |
| Donk | First bet NOT by preflop aggressor |
| Check-raise | CHECK followed by RAISE same street |
| Probe | BET into aggressor who checked |
| Float | CALL flop, BET turn when checked to |

### Phase 4 Verification
- [ ] All preflop patterns correctly identified
- [ ] All postflop patterns correctly identified
- [ ] Patterns displayed in UI with correct labels
- [ ] Unit tests cover edge cases

---

## Phase 5: Migration & Integration

### Goal
Migrate existing data and ensure backwards compatibility.

| Task ID | Description | Owner | Lines | Dependencies |
|---------|-------------|-------|-------|--------------|
| 5.1 | Create `src/migrations/actionMigration.js` - batch convert old hands | Local | ~70 | 3.7 |
| 5.2 | Create IndexedDB v8 migration with sequence field | Local | ~40 | 5.1 |
| 5.3 | Update hand history views for new format | Claude | ~100 | 4.7 |
| 5.4 | Create migration tests | Local | ~80 | 5.1-5.2 |
| 5.5 | Full integration test - record, save, load, display | Claude | ~100 | All |
| 5.6 | Update documentation (CLAUDE.md, STATE_SCHEMAS.md) | Local | ~50 | All |

### Phase 5 Verification
- [ ] All existing hands migrated successfully
- [ ] Full round-trip working (record → save → load → display)
- [ ] Documentation updated
- [ ] No data loss

---

## Task Delegation Summary

### By Owner

| Owner | Task Count | Total Lines |
|-------|------------|-------------|
| Local Model | 24 | ~1,250 |
| Claude | 6 | ~680 |

### Local Model Task Types
- **Constants/Types** (3 tasks): primitiveActions.js, actionTypes.js
- **Utilities** (6 tasks): validation, sequenceUtils, positionUtils, patterns
- **Tests** (6 tasks): All test files
- **Migrations** (4 tasks): Database schema, data conversion
- **Storage** (4 tasks): userId filtering for persistence layer
- **UI Updates** (1 task): ActionBadge, ActionSequence updates

### Claude-Required Tasks
Tasks requiring complex integration or multiple state sources:
- 1.1.7: usePersistence hook integration with AuthContext
- 1.2.3: ViewRouter extraction (complex prop forwarding)
- 1.2.4: PokerTracker refactoring
- 3.2: gameReducer sequence state addition
- 3.5: ActionPanel UI integration with context-aware labels
- 4.6: actionUtils pattern display integration
- 5.3: History view updates
- 5.5: Full integration testing

---

## Execution Order

```
Phase 1 (Architecture Cleanup)
├── 1.1.1 (DB schema) → 1.1.2-6 (storage updates) → 1.1.7-8 (integration)
├── 1.2.1-2 (extractions, parallel) → 1.2.3-4 (refactoring) → 1.2.5-6 (tests)
└── 1.3.1-3 (dependency updates)

Phase 2 (Primitive Actions)
└── 2.1 → 2.2 → 2.3-4 (can parallelize tests and export)

Phase 3 (Action Sequences)
├── 3.1 → 3.2 (reducer) → 3.5 (UI)
└── 3.1 → 3.3 → 3.4, 3.6, 3.7 (utilities, parallel)

Phase 4 (Pattern Recognition)
├── 4.1 (position) → 4.2, 4.3 (patterns, parallel) → 4.4 (index)
└── 4.5 (tests) → 4.6 (display) → 4.7 (UI)

Phase 5 (Migration & Integration)
└── 5.1 → 5.2 → 5.3 → 5.4-5.6 (parallel)
```

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-10 | Primitive actions = check/bet/call/raise/fold | These are the actual mechanics; everything else is a pattern |
| 2025-12-10 | Store sequences not aggregates | Enables replay, pattern detection, and analysis |
| 2025-12-10 | Compute patterns on read | Keeps storage simple, allows algorithm improvements |
| 2025-12-10 | Context-aware UI labels | Show "Limp", "Open", "3bet" based on game state, not raw primitives |
| 2025-12-10 | Defer bet sizing | Simplifies implementation; can add in future project |
| 2025-12-10 | Defer hand strength | Separate project to reduce scope |
| 2025-12-10 | Phase 1 = architecture cleanup first | Clean foundation before major changes |

---

## Session Log

| Date | Session | Phase | Work Done |
|------|---------|-------|-----------|
| 2025-12-10 | CTO Review | Planning | Created project from review findings + user requirements |
| 2025-12-10 | Planning | Planning | Finalized 5-phase plan with task decomposition |

---

## Dependencies

This project blocks:
- Player Tendencies Analytics (needs pattern data)
- Range Analysis Tools (needs action sequences)
- Firebase Cloud Sync (needs IndexedDB v7 with userId)

This project is blocked by:
- Nothing (can start immediately)

---

## Future Projects (Deferred)

### Hand Strength Evaluation
- Hand ranking (high card → royal flush)
- Relative strength (TPTK, overpair, underpair, set, trips)
- Draw detection (flush draw, OESD, gutshot, combo draw)
- Files: `src/utils/handEvaluation/*`

### Bet Sizing Tracking
- Add sizing field to action entries
- Pot odds calculation
- SPR analysis
- Sizing tells detection

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Migration data loss | Low | High | Thorough testing, keep old format during transition |
| Performance regression | Medium | Medium | Profile pattern recognition, cache results |
| Breaking existing features | Medium | High | Maintain backwards compatibility, feature flags |
| Scope creep | High | Medium | Strict phase boundaries, defer enhancements |

---

## Completion Checklist

Before marking project complete:
- [ ] All phases marked [x] COMPLETE
- [ ] Tests passing
- [ ] Documentation updated:
  - [ ] CLAUDE.md (architecture changes)
  - [ ] docs/QUICK_REF.md (new constants/hooks/utils)
  - [ ] docs/CHANGELOG.md (version entry)
  - [ ] docs/STATE_SCHEMAS.md (reducer changes)
  - [ ] .claude/context/*.md (context summaries)
- [ ] Code reviewed
- [ ] All data migrations tested
- [ ] Performance benchmarked
- [ ] Committed with descriptive message
