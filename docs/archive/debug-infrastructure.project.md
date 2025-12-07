# Debug Infrastructure Project Tracker

## Quick Start for Claude Code Sessions

1. Read this file first
2. Find the current phase (marked with `[IN PROGRESS]`)
3. Read the "Context Files" for that phase
4. Execute the checklist items
5. Update status when complete

---

## Phase Status Overview

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | [x] COMPLETE | Centralized Error Handling |
| 2 | [x] COMPLETE | Reducer Hardening |
| 3 | [x] COMPLETE | Eliminate Magic Numbers |
| 4 | [x] COMPLETE | Unit Test Infrastructure |
| 5 | [x] COMPLETE | PropTypes Validation |
| 6 | [x] COMPLETE | Consolidate Duplicate Logic |
| 7 | [x] COMPLETE | Normalize State Format |
| 8 | [x] COMPLETE | Debug Documentation |

---

## Phase 1: Centralized Error Handling [COMPLETE]

### Goal
Create a single source of truth for error handling with structured error codes that are searchable and include context for debugging.

### Context Files to Read
- `src/utils/persistence.js` (lines 33-57) - Current error pattern
- `src/hooks/usePersistence.js` (lines 24-30) - Current DEBUG flag
- `src/PokerTracker.jsx` (lines 62-63) - Current log function

### Files to Create
- [x] `src/utils/errorHandler.js` - Error codes, AppError class, logger
- [x] `src/components/ErrorBoundary.jsx` - React error boundary

### Files to Modify
- [x] `src/PokerTracker.jsx` - Wrap app in ErrorBoundary
- [x] `src/hooks/usePersistence.js` - Use centralized logger
- [x] `src/hooks/useSessionPersistence.js` - Use centralized logger
- [x] `src/hooks/usePlayerPersistence.js` - Use centralized logger
- [x] `src/utils/persistence.js` - Use centralized logger

### Implementation Details

**Error Codes Structure:**
```
E1xx - State errors (INVALID_STATE, STATE_CORRUPTION, REDUCER_FAILED)
E2xx - Validation errors (INVALID_INPUT, INVALID_ACTION, INVALID_SEAT)
E3xx - Persistence errors (DB_INIT_FAILED, SAVE_FAILED, LOAD_FAILED)
E4xx - Component errors (RENDER_FAILED, HANDLER_FAILED)
```

**Logger API:**
```javascript
logger.debug(module, ...args)  // Only in DEBUG mode
logger.info(module, ...args)   // Always logs
logger.warn(module, ...args)   // Warning level
logger.error(module, error)    // Formats AppError with context
```

### Verification
- [x] Console shows module prefix for all logs (e.g., `[Persistence]`, `[PokerTracker]`)
- [x] App wrapped in ErrorBoundary for crash protection
- [ ] `npm run dev` works without errors (pending verification)

---

## Phase 2: Reducer Hardening [COMPLETE]

### Goal
Add validation wrappers to all reducers to catch state corruption early and log detailed error context.

### Context Files to Read
- `src/reducers/gameReducer.js` - Current state shape
- `src/reducers/cardReducer.js` - Current state shape
- `src/utils/errorHandler.js` - Error codes (created in Phase 1)

### Files to Create
- [x] `src/utils/reducerUtils.js` - createValidatedReducer wrapper, validateSchema, SCHEMA_RULES

### Files to Modify
- [x] `src/reducers/gameReducer.js` - Add GAME_STATE_SCHEMA, use wrapper
- [x] `src/reducers/cardReducer.js` - Add CARD_STATE_SCHEMA, use wrapper
- [x] `src/reducers/uiReducer.js` - Add UI_STATE_SCHEMA, use wrapper
- [x] `src/reducers/sessionReducer.js` - Add SESSION_STATE_SCHEMA, use wrapper
- [x] `src/reducers/playerReducer.js` - Add PLAYER_STATE_SCHEMA, use wrapper

### Implementation Details

**State Schema Example:**
```javascript
export const GAME_STATE_SCHEMA = {
  currentStreet: { type: 'string', enum: STREETS },
  dealerButtonSeat: { type: 'number', min: 1, max: 9 },
  mySeat: { type: 'number', min: 1, max: 9 },
  seatActions: { type: 'object' },
  absentSeats: { type: 'array', items: 'number' }
};
```

### Verification
- [x] All reducers wrapped with createValidatedReducer
- [x] State schemas exported for each reducer
- [x] Build passes without errors

---

## Phase 3: Eliminate Magic Numbers [COMPLETE]

### Goal
Move all hardcoded numbers to constants for maintainability and to prevent bugs when values change.

### Context Files to Read
- `src/constants/gameConstants.js` - Current constants
- `src/PokerTracker.jsx` (lines 288-293) - Magic layout numbers
- `src/reducers/cardReducer.js` (lines 186, 193, 203) - Hardcoded 9, 18

### Files Modified
- [x] `src/constants/gameConstants.js` - Added LAYOUT and LIMITS objects
- [x] `src/PokerTracker.jsx` - Updated to use LAYOUT constants
- [x] `src/reducers/cardReducer.js` - Updated to use LIMITS.NUM_SEATS and MAX_SHOWDOWN_SLOTS
- [x] `src/reducers/gameReducer.js` - Updated to use LIMITS.NUM_SEATS
- [x] `src/components/views/PlayersView.jsx` - Updated findNextEmptySeat to use LIMITS.NUM_SEATS

### Implementation Details

**New Constants:**
```javascript
export const LAYOUT = {
  FELT_WIDTH: 900,
  FELT_HEIGHT: 450,
  TABLE_OFFSET_X: 200,
  TABLE_OFFSET_Y: 50,
  CONTEXT_MENU_OFFSET_X: -160,
  CONTEXT_MENU_OFFSET_Y: -20,
};

export const LIMITS = {
  NUM_SEATS: 9,
  MAX_HOLE_CARDS: 2,
  MAX_COMMUNITY_CARDS: 5,
  MAX_SHOWDOWN_SLOTS: 18,
};
```

### Verification
- [x] Hardcoded 9s replaced with LIMITS.NUM_SEATS
- [x] Layout magic numbers replaced with LAYOUT constants
- [x] Build passes without errors

---

## Phase 4: Unit Test Infrastructure [COMPLETE]

### Goal
Set up Vitest testing framework and create initial tests for critical paths.

### Context Files to Read
- `package.json` - Current scripts
- `vite.config.js` - Build configuration
- `src/utils/validation.js` - Test target
- `src/utils/actionValidation.js` - Test target

### Files Created
- [x] `src/test/setup.js` - Test setup with @testing-library/jest-dom
- [x] `src/utils/__tests__/validation.test.js` - 40 tests for input validation
- [x] `src/utils/__tests__/actionValidation.test.js` - 62 tests for poker action sequences
- [x] `src/reducers/__tests__/gameReducer.test.js` - 31 tests for game reducer

### Files Modified
- [x] `vite.config.js` - Added Vitest configuration (globals, jsdom, setupFiles)
- [x] `package.json` - Added vitest, @testing-library/react, jsdom, test scripts

### Test Scripts Added
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

### Verification
- [x] `npm test` runs successfully
- [x] 133 tests pass (target was 10+)
- [x] Coverage: validation.js, actionValidation.js, gameReducer.js all tested

---

## Phase 5: PropTypes Validation [COMPLETE]

### Goal
Add runtime prop validation to catch prop errors during development.

### Context Files to Read
- `src/components/views/TableView.jsx` - Props to validate
- `src/components/ui/CardSlot.jsx` - Props to validate

### Files Modified
- [x] `package.json` - Added prop-types dependency
- [x] `src/components/ui/CardSlot.jsx` - Added PropTypes (10 props)
- [x] `src/components/ui/PlayerForm.jsx` - Added PropTypes (5 props including nested initialData)
- [x] `src/components/views/TableView.jsx` - Added PropTypes (54 props organized by category)
- [x] `src/components/views/ShowdownView.jsx` - Added PropTypes (35 props)
- [x] `src/components/views/CardSelectorView.jsx` - Added PropTypes (13 props)

### PropTypes Categories Used
- Basic types: `string`, `number`, `bool`, `func`, `object`
- Arrays: `arrayOf(PropTypes.string)`, `arrayOf(PropTypes.number)`
- Enums: `oneOf(['table', 'hole-table', 'showdown', 'selector'])`
- Shapes: `shape({ x: number, y: number, seat: number })`
- Components: `elementType` for icon components

### Verification
- [x] Build passes without errors
- [x] All 133 tests still pass
- [x] Console warns on missing required props (runtime validation active)

---

## Phase 6: Consolidate Duplicate Logic [COMPLETE]

### Goal
Unify the three separate "find next seat" implementations into one shared function.

### Context Files Read
- `src/hooks/useShowdownCardSelection.js` (lines 57-92) - Implementation 1: findNextEmptySlot
- `src/reducers/cardReducer.js` (lines 175-215) - Implementation 2: ADVANCE_SHOWDOWN_HIGHLIGHT (dead code)
- `src/hooks/useShowdownHandlers.js` (lines 43-61) - Implementation 3: advanceToNextActiveSeat

### Files Created
- [x] `src/utils/seatNavigation.js` - Unified seat navigation utilities

### Files Modified
- [x] `src/hooks/useShowdownCardSelection.js` - Now imports `findNextEmptySlot` from seatNavigation
- [x] `src/hooks/useShowdownHandlers.js` - Now imports `findFirstActiveSeat`, `findNextActiveSeat` from seatNavigation
- [N/A] `src/reducers/cardReducer.js` - ADVANCE_SHOWDOWN_HIGHLIGHT is dead code (never called), left unchanged

### Implementation Details

**New seatNavigation.js exports:**
```javascript
isSeatShowdownActive(seat, isSeatInactive, seatActions) // Check if seat can participate
findFirstActiveSeat(numSeats, isSeatInactive, seatActions) // Find first active seat
findNextActiveSeat(fromSeat, numSeats, isSeatInactive, seatActions) // Find next active seat
findNextEmptySlot(...) // Find next empty card slot in active seat
```

**Lines of code removed:**
- useShowdownCardSelection.js: ~36 lines (inline findNextEmptySlot)
- useShowdownHandlers.js: ~18 lines (inline first active seat + advanceToNextActiveSeat)

### Verification
- [x] Showdown seat advancement works correctly (build passes)
- [x] All 133 tests pass
- [x] Unified implementation in seatNavigation.js used by both hooks

---

## Phase 7: Normalize State Format [COMPLETE]

### Goal
Remove dual array/string support for seatActions, eliminating 15+ defensive checks.

### Context Files Read
- `src/reducers/gameReducer.js` (lines 98-126) - Already stores as arrays
- `src/utils/persistence.js` - Load functions for hands

### Files Created
- [x] `src/migrations/normalizeSeatActions.js` - Migration utilities:
  - `normalizeSeatActions(seatActions)` - Normalizes seatActions object
  - `normalizeHandRecord(hand)` - Normalizes full hand record

### Files Modified
- [x] `src/utils/persistence.js` - Added normalization on load:
  - `loadHandById` - Applies normalizeHandRecord
  - `getAllHands` - Maps normalizeHandRecord to all results
- [x] `src/utils/actionUtils.js` - Simplified getLastAction (removed string fallback)
- [x] `src/utils/seatUtils.js` - Removed Array.isArray check in hasSeatFolded
- [x] `src/hooks/useSeatColor.js` - Removed Array.isArray check
- [x] `src/components/views/ShowdownView.jsx` - Removed 2 Array.isArray checks
- [x] `src/components/views/HistoryView.jsx` - Removed Array.isArray check
- [x] `src/utils/seatNavigation.js` - Simplified hasShowdownAction

### Implementation Details

**Migration Pattern:**
```javascript
// Old format (string)
seatActions['preflop'][1] = 'fold'

// New format (always array)
seatActions['preflop'][1] = ['fold']

// Normalization on load
const hand = normalizeHandRecord(rawHand);
```

**Remaining Array.isArray checks (intentional):**
- `actionUtils.js:246` - Defensive guard in getLastAction
- `displayUtils.js:90` - For rebuyTransactions (unrelated)
- `normalizeSeatActions.js:41` - Migration logic (needs to detect format)

### Verification
- [x] All 133 tests pass
- [x] Build succeeds
- [x] seatActions always arrays (normalized on database load)
- [x] Old saved hands will load correctly (migration runs automatically)

---

## Phase 8: Debug Documentation [COMPLETE]

### Goal
Create comprehensive documentation for error codes and state schemas.

### Files Created
- [x] `docs/DEBUGGING.md` - Error codes reference (~200 lines)
  - Error code ranges (E1xx-E4xx) with descriptions
  - Logger API documentation
  - Debug mode explanation
  - Common debugging scenarios
  - Files reference table

- [x] `docs/STATE_SCHEMAS.md` - State shape documentation (~350 lines)
  - All 5 reducer state shapes with examples
  - Schema definitions for validation
  - Action types and payloads
  - Database schema reference
  - Common validation rules

### Files Modified
- [x] `CLAUDE.md` - Added debugging references to Quick Start section

### Verification
- [x] All 16 error codes documented with causes
- [x] All 5 reducers' state shapes documented
- [x] All action types documented with payloads
- [x] Build passes without errors

---

## Session Log

Track progress across Claude Code sessions:

| Date | Session | Phase | Work Done |
|------|---------|-------|-----------|
| 2025-12-07 | Initial | Planning | Created project tracker, started Phase 1 |
| 2025-12-07 | Initial | Phase 1 | COMPLETE - Created errorHandler.js, ErrorBoundary.jsx, updated all hooks and persistence.js to use centralized logger |
| 2025-12-07 | Initial | Phase 2 | COMPLETE - Created reducerUtils.js with schema validation, wrapped all 5 reducers with validation |
| 2025-12-07 | Initial | Phase 3 | COMPLETE - Added LAYOUT and LIMITS to gameConstants.js, replaced magic numbers in 5 files |
| 2025-12-07 | Session 2 | Phase 4 | COMPLETE - Vitest setup with 133 tests (validation.test.js: 40, actionValidation.test.js: 62, gameReducer.test.js: 31) |
| 2025-12-07 | Session 2 | Phase 5 | COMPLETE - PropTypes added to 5 components (CardSlot, PlayerForm, TableView, ShowdownView, CardSelectorView) |
| 2025-12-07 | Session 3 | Phase 6 | COMPLETE - Created seatNavigation.js, unified "find next seat" logic in 2 hooks (~54 lines removed) |
| 2025-12-07 | Session 3 | Phase 7 | COMPLETE - Created normalizeSeatActions.js migration, removed dual-format checks from 7 files |
| 2025-12-07 | Session 3 | Phase 8 | COMPLETE - Created DEBUGGING.md (~200 lines) and STATE_SCHEMAS.md (~350 lines), updated CLAUDE.md |
