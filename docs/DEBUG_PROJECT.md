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
| 6 | [ ] NOT STARTED | Consolidate Duplicate Logic |
| 7 | [ ] NOT STARTED | Normalize State Format |
| 8 | [ ] NOT STARTED | Debug Documentation |

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

## Phase 6: Consolidate Duplicate Logic [NOT STARTED]

### Goal
Unify the three separate "find next seat" implementations into one shared function.

### Context Files to Read
- `src/hooks/useShowdownCardSelection.js` (lines 57-92) - Implementation 1
- `src/reducers/cardReducer.js` (lines 175-215) - Implementation 2
- `src/hooks/useShowdownHandlers.js` (lines 43-61) - Implementation 3

### Files to Create
- [ ] `src/utils/seatNavigation.js` - Unified findNextActiveSeat

### Files to Modify
- [ ] `src/hooks/useShowdownCardSelection.js` - Use seatNavigation
- [ ] `src/reducers/cardReducer.js` - Use seatNavigation
- [ ] `src/hooks/useShowdownHandlers.js` - Use seatNavigation

### Verification
- [ ] Showdown seat advancement works correctly
- [ ] Only 1 implementation of "find next seat" exists
- [ ] All 3 files import from seatNavigation.js

---

## Phase 7: Normalize State Format [NOT STARTED]

### Goal
Remove dual array/string support for seatActions, eliminating 15+ defensive checks.

### Context Files to Read
- `src/reducers/gameReducer.js` (line 85-90) - Current format
- Search: `Array.isArray(actions)` - All defensive checks (15+ occurrences)

### Files to Create
- [ ] `src/migrations/normalizeSeatActions.js` - One-time migration

### Files to Modify
- [ ] `src/reducers/gameReducer.js` - Remove dual format support
- [ ] `src/hooks/useSeatColor.js` - Remove Array.isArray check
- [ ] All files with `Array.isArray(actions)` pattern

### Verification
- [ ] `grep -r "Array.isArray(actions)" src/` returns 0 results
- [ ] seatActions always contains arrays
- [ ] Old saved hands still load correctly (migration works)

---

## Phase 8: Debug Documentation [NOT STARTED]

### Goal
Create comprehensive documentation for error codes and state schemas.

### Files to Create
- [ ] `docs/DEBUGGING.md` - Error codes reference
- [ ] `docs/STATE_SCHEMAS.md` - State shape documentation

### Files to Modify
- [ ] `CLAUDE.md` - Add debugging section reference

### Verification
- [ ] Every error code has documentation
- [ ] State shapes match actual implementation

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
