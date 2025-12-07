# Plan: Address CTO Architecture Review Findings

> **Reference**: In new chats, say: "Follow the plan in `docs/IMPLEMENTATION_PLAN.md`"

## Overview
Address the 6 priority issues identified in the CTO architecture review of the Poker Tracker application.

---

## Issue 1: Test Coverage (HIGH PRIORITY)

### Current State
- 3 test files exist (~114 test cases)
- Framework: Vitest 4.0.15 with jsdom
- Coverage: ~5% of codebase

### Files Needing Tests

**Reducers (4 untested):**
- `src/reducers/cardReducer.js` (270 lines, 15 action types)
- `src/reducers/uiReducer.js` (118 lines, 10 action types)
- `src/reducers/sessionReducer.js` (167 lines, 12 action types)
- `src/reducers/playerReducer.js` (109 lines, 8 action types)

**Critical Utilities:**
- `src/utils/persistence.js` (1,083 lines) - IndexedDB operations

### Implementation Steps

1. **Create cardReducer.test.js**
   - Test all 15 action types
   - Test initial state
   - Test edge cases (invalid slots, duplicate cards)

2. **Create uiReducer.test.js**
   - Test all 10 action types
   - Test view transitions
   - Test selection state management

3. **Create sessionReducer.test.js**
   - Test session lifecycle (START, END, UPDATE)
   - Test rebuy transactions
   - Test financial calculations

4. **Create playerReducer.test.js**
   - Test player CRUD operations
   - Test seat assignment logic
   - Test hydration

5. **Create persistence.test.js** (using fake-indexeddb)
   - Test CRUD for hands, sessions, players
   - Test database migrations v1→v5
   - Test error handling

---

## Issue 2: Hardcoded Layout Values (MEDIUM PRIORITY)

### Current State
- `LAYOUT` constants defined in `gameConstants.js` (lines 112-142) but **never imported anywhere**
- 5+ files have hardcoded pixel values

### Files to Update

| File | Hardcoded Values |
|------|------------------|
| `src/components/views/TableView.jsx` | 1600, 720, 900, 450, 225, 217, 40, 480, 80 |
| `src/components/ui/ScaledContainer.jsx` | 1600, 720 |
| `src/components/views/StatsView.jsx` | 1600, 720 |
| `src/components/views/ShowdownView.jsx` | 1600, 720 |
| `src/components/views/HistoryView.jsx` | 1600, 720 |

### Implementation Steps

1. **Extend LAYOUT constants** in `gameConstants.js`:
   ```javascript
   TABLE_LABEL_OFFSET: -30,
   TABLE_LABEL_WIDTH: 300,
   TABLE_LABEL_HEIGHT: 60,
   ACTION_PANEL_WIDTH: 480,
   ACTION_PANEL_TOP: 80,
   ```

2. **Update ScaledContainer.jsx** - central fix affects all views using it

3. **Update TableView.jsx** - replace all hardcoded values with LAYOUT.*

4. **Update remaining views** - StatsView, ShowdownView, HistoryView

---

## Issue 3: Data Export/Import (MEDIUM PRIORITY)

### Current State
- No export/import functionality exists
- All data in IndexedDB (browser-locked)
- Persistence functions available: `getAllHands()`, `getAllSessions()`, `getAllPlayers()`

### Data Schema
```javascript
{
  version: "1.0.0",
  exportedAt: timestamp,
  hands: [...],      // From getAllHands()
  sessions: [...],   // From getAllSessions()
  players: [...]     // From getAllPlayers()
}
```

### Implementation Steps

1. **Create `src/utils/exportUtils.js`**
   - `exportAllData()` - Gather all data, return JSON blob
   - `downloadAsJson(data, filename)` - Trigger browser download
   - `validateImportData(json)` - Schema validation
   - `importAllData(json)` - Clear and restore data

2. **Add Export button to SessionsView.jsx**
   - Button in header area
   - Downloads `poker-tracker-backup-{date}.json`

3. **Add Import functionality**
   - File input for JSON upload
   - Validation before import
   - Confirmation dialog (will overwrite existing data)

---

## Issue 4: DEBUG Flag in Production (MEDIUM PRIORITY)

### Current State
- `DEBUG = true` hardcoded in `src/utils/errorHandler.js` line 22
- Logs all actions to console in production builds

### Implementation Steps

1. **Update errorHandler.js**
   ```javascript
   // Before
   export const DEBUG = true;

   // After
   export const DEBUG = import.meta.env.DEV;
   ```

2. **Verify** production builds have debug logging disabled

---

## Issue 5: TableView Prop Drilling (LOW PRIORITY)

### Current State
- TableView receives 40+ props from PokerTracker.jsx
- Complex prop chains for state and handlers

### Recommendation
- Consider React Context for deep prop chains
- **Defer** - current architecture works, this is optimization

---

## Issue 6: TypeScript/Type Safety (LOW PRIORITY)

### Current State
- No TypeScript
- Partial PropTypes coverage

### Recommendation
- Add JSDoc type annotations incrementally
- **Defer** - not blocking functionality

---

## Implementation Order

| Phase | Task | Priority | Status |
|-------|------|----------|--------|
| 1 | Fix DEBUG flag | Medium | ✅ COMPLETE |
| 2 | Replace hardcoded layout values | Medium | ✅ COMPLETE |
| 3 | Add reducer tests (4 files) | High | ✅ COMPLETE |
| 4 | Add data export/import (single JSON) | Medium | ✅ COMPLETE |
| 5 | Add persistence tests (fake-indexeddb) | High | ✅ COMPLETE |

**All phases completed on 2025-12-07.**

### Completion Summary
- **272 tests passing** across 8 test files
- Test coverage significantly improved from ~5% to comprehensive reducer and persistence coverage
- Export/Import functionality available in Sessions view
- DEBUG flag now respects environment (dev vs prod)
- All layout values centralized in LAYOUT constants

## User Decisions
- **Scope**: All 6 issues
- **Export format**: Single combined JSON file
- **Test mocking**: Use fake-indexeddb for full IndexedDB testing

---

## Phase 2: CTO Review Follow-up (2025-12-07)

Based on comprehensive CTO architecture review, the following additional items were identified:

### Issue 7: Replace alert() with Toast Notifications (MEDIUM PRIORITY)

**Current State:**
- `alert()` used for error messages in multiple locations
- Poor UX - blocks UI, no styling, no auto-dismiss

**Implementation Steps:**
1. Create `src/components/ui/Toast.jsx` - Simple toast notification component
2. Create `src/hooks/useToast.js` - Toast state management hook
3. Replace all `alert()` calls with toast notifications
4. Add toast container to main app

**Files to search:** `grep -r "alert\(" src/`

| Status | Task |
|--------|------|
| ✅ | Create Toast component |
| ✅ | Create useToast hook |
| ✅ | Replace alert() calls |

---

### Issue 8: Add Error Boundaries per View (MEDIUM PRIORITY)

**Current State:**
- Single top-level ErrorBoundary (if any)
- View crash takes down entire app

**Implementation Steps:**
1. Create `src/components/ui/ViewErrorBoundary.jsx` - Reusable error boundary
2. Wrap each view component in PokerTracker.jsx
3. Add "retry" functionality per view

**Affected Views:**
- TableView, StatsView, CardSelectorView, ShowdownView, HistoryView, SessionsView, PlayersView

| Status | Task |
|--------|------|
| ✅ | Create ViewErrorBoundary component |
| ✅ | Wrap all 7 views |
| ✅ | Add retry/reset functionality |

---

### Issue 9: Extract Large View Components (LOW PRIORITY)

**Current State:**
- PlayersView.jsx: ~860 lines
- SessionsView.jsx: ~656 lines
- TableView.jsx: ~380 lines

**Recommendation:**
Extract sub-components when files exceed 500 lines:

**PlayersView sub-components:**
- `PlayerCard.jsx` - Individual player display
- `PlayerFilters.jsx` - Search/filter controls
- `SeatAssignment.jsx` - Seat selection grid

**SessionsView sub-components:**
- `SessionCard.jsx` - Individual session display
- `SessionStats.jsx` - Financial summary

| Status | Task |
|--------|------|
| ✅ | Extract PlayerRow from PlayersView |
| ✅ | Extract PlayerFilters from PlayersView |
| ✅ | Extract SeatGrid from PlayersView |
| ✅ | Extract SessionCard from SessionsView |

---

### Issue 10: React Context for Prop Drilling (LOW PRIORITY - DEFERRED)

**Current State:**
- TableView receives 55+ props
- Complex prop chains

**Recommendation:**
Create contexts to reduce prop count:
- `TableContext` - game state, actions
- `PlayerContext` - player data, seat assignments

**Rationale for deferring:**
- Current architecture works correctly
- Context migration requires significant testing
- Consider during v112 major refactor

---

### Issue 11: TypeScript Migration (LOW PRIORITY - DEFERRED)

**Current State:**
- Pure JavaScript with PropTypes

**Recommendation:**
- Incremental migration starting with utility functions
- Add JSDoc type annotations as intermediate step
- Consider for v113+

---

## Phase 2 Priority Order

| Phase | Task | Priority | Effort | Status |
|-------|------|----------|--------|--------|
| 2.1 | Replace alert() with Toast | Medium | 2-3 hrs | ✅ COMPLETE |
| 2.2 | Add ViewErrorBoundary | Medium | 1-2 hrs | ✅ COMPLETE |
| 2.3 | Extract PlayersView components | Low | 3-4 hrs | ✅ COMPLETE |
| 2.4 | Extract SessionsView components | Low | 2-3 hrs | ✅ COMPLETE |
| - | React Context refactor | Low | Deferred | ⏸️ |
| - | TypeScript migration | Low | Deferred | ⏸️ |

### Phase 2.1 & 2.2 Completion Summary (2025-12-07)
- Created `src/components/ui/Toast.jsx` - Toast notification with 4 variants (error, success, warning, info)
- Created `src/hooks/useToast.js` - Toast state management hook
- Created `src/components/ui/ViewErrorBoundary.jsx` - Per-view error boundary with retry/return options
- Added CSS animation for toast slide-in to `src/index.css`
- Replaced all 7 `alert()` calls with `showError()` toast notifications
- Wrapped all 7 views (Showdown, CardSelector, Table, History, Sessions, Players, Stats) with ViewErrorBoundary
- All 272 tests passing

### Phase 2.3 & 2.4 Completion Summary (2025-12-07)
- Extracted `src/components/ui/PlayerFilters.jsx` - Search, sort, and filter controls
- Extracted `src/components/ui/PlayerRow.jsx` - Single player table row with actions
- Extracted `src/components/ui/SeatGrid.jsx` - 9-seat assignment grid with drag-and-drop
- Extracted `src/components/ui/SessionCard.jsx` - Past session display card
- PlayersView.jsx reduced from ~869 to 587 lines (32% reduction)
- SessionsView.jsx reduced from ~800 to 715 lines (~11% reduction)
- All 272 tests passing

**Phase 2 fully completed on 2025-12-07.**

---

## Files to Modify

### Dependencies to Install
```bash
npm install -D fake-indexeddb
```

### New Files (Phase 1 - Complete)
- `src/reducers/__tests__/cardReducer.test.js` ✅
- `src/reducers/__tests__/uiReducer.test.js` ✅
- `src/reducers/__tests__/sessionReducer.test.js` ✅
- `src/reducers/__tests__/playerReducer.test.js` ✅
- `src/utils/__tests__/persistence.test.js` ✅
- `src/utils/exportUtils.js` ✅

### New Files (Phase 2 - Pending)
- `src/components/ui/Toast.jsx` - Toast notification component
- `src/hooks/useToast.js` - Toast state management
- `src/components/ui/ViewErrorBoundary.jsx` - Error boundary wrapper
- `src/components/ui/PlayerCard.jsx` - Player display component (extracted)
- `src/components/ui/PlayerFilters.jsx` - Player search/filter (extracted)
- `src/components/ui/SessionCard.jsx` - Session display component (extracted)

### Modified Files
- `src/utils/errorHandler.js` (DEBUG flag)
- `src/constants/gameConstants.js` (extend LAYOUT)
- `src/components/ui/ScaledContainer.jsx` (use LAYOUT)
- `src/components/views/TableView.jsx` (use LAYOUT)
- `src/components/views/StatsView.jsx` (use LAYOUT)
- `src/components/views/ShowdownView.jsx` (use LAYOUT)
- `src/components/views/HistoryView.jsx` (use LAYOUT)
- `src/components/views/SessionsView.jsx` (add export button)
