# Poker Tracker Change Log

## v106 (Current) - State Management Refactoring ✅

### Summary
- **Lines**: 1088 → ~1000 lines main file
- **Architecture**: Migrated from useState to useReducer pattern
- **State Management**: Three specialized reducers (game, UI, cards)
- **Performance**: All handlers wrapped in useCallback
- **Code Quality**: Eliminated circular dependencies, improved organization

### Key Changes
- **Reducers Created**:
  - `gameReducer.js` - Game state (street, dealer, actions, absent seats)
  - `uiReducer.js` - UI state (view, selection, context menu, dragging)
  - `cardReducer.js` - Card state (community, hole, player cards, showdown)
- **Handler Optimization**: All 15+ handlers converted to useCallback with proper dependencies
- **Function Organization**: Helper functions moved before dependent callbacks
- **Bug Fixes**: Fixed circular dependency issues and initialization bugs
- **Imports**: Added reducer imports from `./reducers/` directory

---

## v105 - Component Extraction

### Summary
- **Lines**: 1957 → 1088 (44% reduction)
- **Components**: 4 view components + 5 UI components extracted
- **Eliminated**: ~164 lines of duplicate UI component code

### Components Extracted
**View Components** (`src/components/views/`):
- `TableView.jsx` (~326 lines) - Main poker table interface
- `StatsView.jsx` (~264 lines) - Statistics display
- `CardSelectorView.jsx` (~180 lines) - Card selection interface
- `ShowdownView.jsx` (~487 lines) - Showdown interface with summary

**UI Components** (`src/components/ui/`):
- `CardSlot.jsx` - 4 variants (table, hole-table, showdown, selector)
- `VisibilityToggle.jsx` - Show/hide toggle button
- `PositionBadge.jsx` - Position indicators (D, SB, BB, ME)
- `DiagonalOverlay.jsx` - Status overlays (FOLD/ABSENT/MUCK/WON)
- `ScaledContainer.jsx` - Responsive scaling wrapper

---

## v104 - Mobile Optimization

### Summary
- Mobile landscape optimization (Samsung Galaxy A22: 1600x720)
- Dynamic responsive scaling
- Card selector improvements
- Button layout optimization

### Changes
- **Responsive Scaling**: Auto-scales to fit viewport (min 95% padding, max 1.0x scale)
- **Component Sizes**: Reduced for mobile (badges 16px/28px, seats 40px)
- **Card Selectors**: 90px height cards, large text, no scrolling
- **Button Layout**: Optimized for touch targets and mobile screens
- **Auto-Advance**: Card selector auto-advances to next slot after selection

---

## v103 - All Refactoring Complete ✅

### Summary
- **Lines**: 2228 → 1958 (270 lines saved, **12.1% reduction**)
- **5 Refactoring Chunks Completed**
- **Code Quality**: Significantly improved maintainability and readability

---

## Chunk-by-Chunk Changes

### Chunk 2: UI Component Extraction & Usage
- **PositionBadge** - 11 usages
  - Showdown Summary View: D, SB, BB, ME badges (4 uses)
  - Showdown Card Selection View: D, SB, BB, ME badges (4 uses)
  - Table View: D, SB, BB badges with absolute positioning (3 uses)
  - Supports `draggable` prop for dealer button drag-and-drop
- **VisibilityToggle** - 4 usages
  - Showdown Summary View, Card Selection View, Table View, Card Selector
- **CardSlot** - 23 usages
  - All card displays across all views
- **DiagonalOverlay** - 2 usages
  - Showdown Summary View and Card Selection View overlays
- Fixed: Replaced inline player cards with `createEmptyPlayerCards()` helper

### Chunk 3: Helper Function Extraction
- Added `SEAT_ARRAY` constant for iteration
- Extracted outside component:
  - `getCardAbbreviation()` - A♥ → Ah
  - `getHandAbbreviation()` - card pair to abbreviation
  - `getActionDisplayName()` - eliminates 3 duplicate switch statements
  - `getActionColor()` - action to Tailwind classes
- Replaced 4 hardcoded `[1,2,3,4,5,6,7,8,9]` arrays with `SEAT_ARRAY`
- Replaced 2 hardcoded `seat <= 9` loops with `CONSTANTS.NUM_SEATS`
- **81 lines saved**

### Chunk 4: Simplify Complex Functions
- Added `getSeatActionStyle()` - returns {bg, ring} for seat colors
- Added `getOverlayStatus()` - determines DiagonalOverlay status
- Simplified `getSeatColor()` function (96 → 38 lines, **60% reduction**)
- Replaced 2 inline overlay status calculations with helper
- Replaced 5 hardcoded `nextSeat <= 9` with `CONSTANTS.NUM_SEATS`
- **26 lines saved**

### Chunk 5: Event Handler Cleanup
- Added `DEBUG` flag and `log()` helper for consistent debugging
- Renamed `makeMySeat` → `handleSetMySeat` for consistency
- Extracted handlers:
  - `handleNextHandFromShowdown()` - closes showdown + advances hand
  - `handleClearShowdownCards()` - clears cards in showdown view
  - `handleCloseShowdown()` - closes showdown view
  - `handleCloseCardSelector()` - closes card selector
  - `advanceToNextActiveSeat()` - helper for Muck/Won advancement
  - `handleMuckSeat()` / `handleWonSeat()` - eliminates 40 lines duplicate code
- Added logging to `nextHand()` and `resetHand()` for debugging

---

## v102 (Previous)
- **Constants Extraction**: Moved all magic numbers and configuration to top-level constants
  - `CONSTANTS` object: NUM_SEATS, CARD dimensions, BADGE_SIZE, TABLE dimensions
  - `SEAT_POSITIONS`: Table layout coordinates
  - `STREETS` / `BETTING_STREETS`: Street name arrays
  - `SCREEN`: View identifiers (TABLE, STATS)
  - `ACTIONS`: All 17 action type string constants
  - `FOLD_ACTIONS`: Array of all fold-type actions
  - `SEAT_STATUS`: Status values (FOLDED, ABSENT)
- **Helper Functions**: `isFoldAction()`, `isRedCard()`, `isRedSuit()`, `createEmptyPlayerCards()`
- **Naming Improvements**: Clearer variable names
- **Component Definitions Added**: `BADGE_CONFIG`, `PositionBadge`, `VisibilityToggle`, `DiagonalOverlay`, `CardSlot`

## v101
- Table View Auto-Selection
- Showdown Screen Summary View
- Consistent action colors
- Next Hand button
- Muck functionality
- Auto-close card selector

---

## Refactoring Status

### Completed ✅
- **Chunk 1**: Constants & Configuration extraction (v102)
- **Chunk 2**: UI Component extraction & usage (v103)
- **Chunk 3**: Helper Function extraction (v103)
- **Chunk 4**: Simplify Complex Functions (v103)
- **Chunk 5**: Event Handler Cleanup (v103)

### All Refactoring Complete! 🎉

---

## File Stats (Main PokerTracker.jsx)
| Version | Lines | Change | Notes |
|---------|-------|--------|-------|
| v101 | ~2063 | baseline | Monolithic file |
| v102 | 2228 | +165 | Added component definitions |
| v103 | 1958 | **-270 (12.1% reduction)** | Refactoring complete |
| v104 | 1957 | -1 | Mobile optimization |
| v105 | 1088 | **-869 (44% reduction)** | Component extraction |
| v106 | ~1000 | **-88 (8% reduction)** | Reducer refactoring |

**Total Reduction**: 2228 → 1000 lines (**55% smaller**)

---

## Component Usage Summary
| Component | Uses | Purpose |
|-----------|------|---------|
| PositionBadge | 11 | D, SB, BB, ME badges |
| VisibilityToggle | 4 | Show/hide hole cards |
| CardSlot | 23 | All card displays |
| DiagonalOverlay | 2 | FOLD/ABSENT/MUCK/WON labels |
| **Total** | **40** | |

## Helper Functions (Outside Component)
| Function | Purpose |
|----------|---------|
| `isFoldAction()` | Check if action is any fold type |
| `isRedCard()` | Check if card is hearts/diamonds |
| `isRedSuit()` | Check if suit is red |
| `createEmptyPlayerCards()` | Create initial player cards state |
| `getCardAbbreviation()` | A♥ → Ah |
| `getHandAbbreviation()` | [A♥, T♦] → AhTd |
| `getActionDisplayName()` | ACTIONS.FOLD → 'fold' |
| `getActionColor()` | Action → Tailwind classes (showdown) |
| `getSeatActionStyle()` | Action → {bg, ring} classes (table) |
| `getOverlayStatus()` | Determine DiagonalOverlay status |
| `log()` | Debug logging (controlled by DEBUG) |

## Event Handlers (Inside Component)
| Handler | Purpose |
|---------|---------|
| `handleNextHandFromShowdown` | Close showdown + next hand |
| `handleClearShowdownCards` | Clear cards in showdown view |
| `handleCloseShowdown` | Close showdown view |
| `handleCloseCardSelector` | Close card selector |
| `handleMuckSeat` | Mark seat as mucked |
| `handleWonSeat` | Mark seat as winner |
| `handleSetMySeat` | Set my seat position |
| `advanceToNextActiveSeat` | Helper for Muck/Won advancement |

## Constants
| Constant | Purpose |
|----------|---------|
| `DEBUG` | Enable/disable console logging |
| `CONSTANTS` | Dimensions, sizes, counts |
| `SEAT_POSITIONS` | Table layout coordinates |
| `SEAT_ARRAY` | [1,2,3,4,5,6,7,8,9] for iteration |
| `STREETS` | All street names |
| `BETTING_STREETS` | Streets with betting (excludes showdown) |
| `ACTIONS` | All 17 action type constants |
| `FOLD_ACTIONS` | Actions that count as folds |
| `SEAT_STATUS` | FOLDED, ABSENT values |
| `SCREEN` | TABLE, STATS view identifiers |
