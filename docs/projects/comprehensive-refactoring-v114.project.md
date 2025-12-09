---
id: comprehensive-refactoring-v114
name: Comprehensive Refactoring v114
status: active
priority: high
created: 2025-12-08
---

# Project: Comprehensive Refactoring v114

## Quick Start for New Chats

1. Read this file first
2. Find the current phase (marked with `<- CURRENT`)
3. Read the "Context Files" for that phase
4. Execute the checklist items
5. Update status when complete

---

## Overview

Refactor component structure and state management to prepare for:
- Player analytics (advanced stats, tendencies, historical patterns)
- Hand replay/review (visual replay of saved hands)
- Real-time sync (cloud sync, multi-device support)

The full detailed plan is also at: `C:\Users\chris\.claude\plans\logical-floating-squid.md`

---

## Context Files

Files to read before starting work:
- `src/PokerTracker.jsx` - Main component, context providers
- `src/contexts/` - All 4 context providers (Game, UI, Session, Player)
- `src/reducers/` - State management
- `src/components/views/` - View components being migrated

---

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | [x] COMPLETE | State Consolidation - move view state to uiReducer |
| 2 | [x] COMPLETE | Context API - create providers, migrate StatsView & TableView |
| 3 | [ ] | Component Decomposition - split large views into folders |
| 4 | [ ] | Storage Abstraction - create IStorage interface |
| 5 | [ ] | Data Model Enhancement - player stats, audit trail |

---

## Phase 1: State Consolidation [x] COMPLETE

### Goal
Eliminate fragmented view state - move all view state from cardReducer to uiReducer.

### Files Modified
- [x] `src/reducers/uiReducer.js` - Added: showCardSelector, cardSelectorType, highlightedBoardIndex, isShowdownViewOpen, highlightedSeat, highlightedHoleSlot
- [x] `src/reducers/cardReducer.js` - Removed view state, kept only card data
- [x] `src/PokerTracker.jsx` - Updated state destructuring
- [x] `src/hooks/useCardSelection.js` - Updated to use dispatchUi
- [x] `src/hooks/useShowdownCardSelection.js` - Updated to use dispatchUi
- [x] `src/hooks/useShowdownHandlers.js` - Updated to use dispatchUi
- [x] `src/hooks/useStateSetters.js` - Updated to use dispatchUi
- [x] Test files updated

### Verification
- [x] All 272 tests pass
- [x] View transitions work correctly

---

## Phase 2: Context API Introduction [x] COMPLETE

### Goal
Reduce prop drilling from 64+ props in TableView to context-based access.

### Files Created
- [x] `src/contexts/GameContext.jsx` (~90 lines) - Game state + derived utilities
- [x] `src/contexts/UIContext.jsx` (~140 lines) - UI state + handlers
- [x] `src/contexts/SessionContext.jsx` (~100 lines) - Session state + operations
- [x] `src/contexts/PlayerContext.jsx` (~110 lines) - Player state + seat management
- [x] `src/contexts/index.js` - Central export

### Files Modified
- [x] `src/PokerTracker.jsx` - Added withContextProviders() wrapper
- [x] `src/components/views/StatsView.jsx` - Migrated: 4 props -> 1 prop
- [x] `src/components/views/TableView.jsx` - Migrated: 64+ props -> ~30 props

### What TableView Now Gets From Contexts
- `useGame()`: currentStreet, mySeat, dealerButtonSeat, seatActions, absentSeats, getSmallBlindSeat, getBigBlindSeat
- `useUI()`: selectedPlayers, contextMenu, isDraggingDealer, isSidebarCollapsed, setCurrentScreen, setContextMenu, togglePlayerSelection, toggleSidebar, openCardSelector, setSelectedPlayers, SCREEN
- `useSession()`: currentSession, hasActiveSession, updateSessionField
- `usePlayer()`: getSeatPlayerName, assignPlayerToSeat

### Remaining Props (not moved to contexts)
- Viewport: scale, tableRef, SEAT_POSITIONS, numSeats
- Card state: communityCards, holeCards, holeCardsVisible
- Parent handlers: nextHand, resetHand, getSeatColor, etc.
- Icons: SkipForward, BarChart3, RotateCcw

### Verification
- [x] All 272 tests pass
- [x] App functions correctly

---

## Phase 3: Component Decomposition <- CURRENT

### Goal
Split large views into focused sub-components using folder structure.

### Planned Structure
```
src/components/views/
  TableView/
    index.jsx            (re-export)
    TableView.jsx        (orchestration, ~150 lines)
    TableLayout.jsx      (felt + seats layout, ~100 lines)
    SeatComponent.jsx    (individual seat, ~80 lines)
    ActionPanel.jsx      (action buttons, ~120 lines)
    SeatContextMenu.jsx  (right-click menu, ~80 lines)
    TableHeader.jsx      (hand #, session time, ~60 lines)

  SessionsView/
    index.jsx
    SessionsView.jsx     (orchestration, ~150 lines)
    ActiveSessionCard.jsx (~180 lines)
    SessionEditFields.jsx (~100 lines)
    ImportExportPanel.jsx (~150 lines)
    CashOutModal.jsx      (~60 lines)

  ShowdownView/
    index.jsx
    ShowdownView.jsx     (mode router, ~50 lines)
    CardSelectionMode.jsx (~250 lines)
    SummaryMode.jsx       (~200 lines)
    ShowdownSeatRow.jsx   (~80 lines)
```

### Task Delegation
- Simple UI extractions (<100 lines) -> `/local-code`
- Complex orchestration -> Claude

### Verification
- [ ] Tests pass
- [ ] No component file exceeds 250 lines

---

## Phase 4: Storage Abstraction

### Goal
Abstract IndexedDB behind an interface for future cloud backend.

### Planned Files
- `src/storage/IStorage.js` - Interface definition
- `src/storage/IndexedDBStorage.js` - Current impl wrapper
- `src/storage/StorageProvider.jsx` - Context provider
- `src/storage/useStorage.js` - Hook

---

## Phase 5: Data Model Enhancement

### Goal
Prepare data model for analytics and sync features.

### Changes
- Add `stats` field to player records
- Add `_meta` audit trail to all records
- Database migration v5 -> v6

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-08 | Move view state to uiReducer | Unify view state management |
| 2025-12-08 | Keep handlers as props (not in contexts) | Handlers defined in parent need access to refs and local state |
| 2025-12-08 | Card state not yet in contexts | Would require CardContext - deferred to reduce scope |

---

## Session Log

| Date | Session | Phase | Work Done |
|------|---------|-------|-----------|
| 2025-12-08 | Session 1 | 1-2 | Completed Phase 1 (state consolidation), Phase 2 (contexts, StatsView, TableView migration) |

---

## Completion Checklist

Before marking project complete:
- [ ] All phases marked [x] COMPLETE
- [ ] Tests passing (272+)
- [ ] Documentation updated:
  - [ ] CLAUDE.md (architecture section)
  - [ ] docs/QUICK_REF.md (new contexts)
  - [ ] docs/CHANGELOG.md (v114 entry)
  - [ ] docs/STATE_SCHEMAS.md (if reducer changes)
- [ ] Code reviewed
- [ ] Committed with descriptive message
