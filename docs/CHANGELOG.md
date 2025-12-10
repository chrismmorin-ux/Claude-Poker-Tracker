# Poker Tracker Change Log

## v114.1 - MVP Critical Fixes (P0+P1 Audit Issues) ✅

### Summary
- **Purpose**: Fix all critical and high-priority issues from Core System Audit
- **Scope**: 8 issues fixed across 8 files
- **Tests**: 2,235 tests passing

### P0 Critical Fixes (4 issues)

#### M1-1: loadLatestHand Normalization ✅ (Already Fixed)
- **File**: `src/utils/persistence/handsStorage.js:119`
- **Fix**: `normalizeHandRecord()` called before resolving loaded hand
- **Impact**: Old hands with string-format seatActions now load correctly

#### M1-2: Session Hydration Default Merging ✅ (Already Fixed)
- **File**: `src/reducers/sessionReducer.js:139-145`
- **Fix**: `HYDRATE_SESSION` merges with `initialSessionState.currentSession`
- **Impact**: Sessions missing fields get proper defaults

#### M1-3: Atomic startNewSession ✅ (Already Fixed)
- **File**: `src/hooks/useSessionPersistence.js:167-229`
- **Fix**: Full rollback logic on failure (deletes session, clears marker)
- **Impact**: No orphan sessions in database on error

#### M1-4: Card Duplicate Prevention ✅ (Fixed 2025-12-09)
- **File**: `src/reducers/cardReducer.js:71-127`
- **Fix**: `isCardInUse()` check added to SET_COMMUNITY_CARD and SET_HOLE_CARD
- **Impact**: Same card cannot appear in multiple slots
- **Tests**: 10 new tests for duplicate prevention

### P1 High Priority Fixes (4 issues)

#### M2-1: Schema Validation Always On ✅
- **File**: `src/utils/reducerUtils.js:152-173`
- **Fix**: Removed `DEBUG &&` check from `createValidatedReducer`
- **Impact**: Schema validation now runs in production

#### M2-2: DB-Level Player Name Uniqueness ✅
- **File**: `src/utils/persistence/playersStorage.js:29-36,73-93,182-189`
- **Fix**: Duplicate name check in both `createPlayer` and `updatePlayer`
- **Impact**: Race conditions cannot create duplicate players

#### M2-3: Active Session Reconciliation ✅
- **File**: `src/hooks/useSessionPersistence.js:70-99`
- **Fix**: Reconciliation on initialization using `activeSession` as source of truth
- **Impact**: No stale activeSession references or orphaned markers

#### M2-4: Action/Seat Validation ✅
- **File**: `src/reducers/gameReducer.js:103-122`
- **Fix**: Validates action type against ACTIONS constant, filters invalid seats
- **Impact**: Invalid data rejected, valid seats still processed
- **Tests**: 3 new tests for validation

### Files Modified
- `src/reducers/cardReducer.js` - Duplicate prevention
- `src/reducers/gameReducer.js` - Action/seat validation
- `src/utils/reducerUtils.js` - Always-on schema validation
- `src/utils/persistence/playersStorage.js` - DB-level uniqueness
- `src/hooks/useSessionPersistence.js` - Session reconciliation
- `src/reducers/__tests__/cardReducer.test.js` - 10 new tests
- `src/reducers/__tests__/gameReducer.test.js` - 3 new tests
- `docs/audits/README.md` - Marked issues as FIXED
- `docs/audits/invariant-catalog.md` - Updated enforcement status

---

## v114 (Current) - Context API + State Consolidation

### Summary
- **Purpose**: Reduce prop drilling and consolidate view state management for future features
- **New Files**: 5 context files (GameContext, UIContext, SessionContext, PlayerContext, index)
- **Prop Reduction**: TableView 64+ props -> ~30 props, StatsView 4 props -> 1 prop
- **State Consolidation**: View state moved from cardReducer to uiReducer

### Context API Introduction
- **GameContext.jsx** (~90 lines): Provides game state + derived utilities
  - State: currentStreet, mySeat, dealerButtonSeat, seatActions, absentSeats
  - Derived: getSmallBlindSeat, getBigBlindSeat, hasSeatFolded, isSeatInactive
- **UIContext.jsx** (~140 lines): Provides UI state + handlers
  - State: selectedPlayers, contextMenu, isDraggingDealer, isSidebarCollapsed, showCardSelector, isShowdownViewOpen
  - Handlers: setCurrentScreen, togglePlayerSelection, setContextMenu, openCardSelector, SCREEN
- **SessionContext.jsx** (~100 lines): Provides session state + operations
  - State: currentSession, allSessions, isLoading
  - Derived: hasActiveSession, totalInvestment
  - Handlers: updateSessionField, addRebuy, incrementHandCount
- **PlayerContext.jsx** (~110 lines): Provides player state + seat management
  - State: allPlayers, seatPlayers, isLoading
  - Handlers: getSeatPlayerName, assignPlayerToSeat, clearSeatPlayer

### State Consolidation
- **Moved from cardReducer to uiReducer**:
  - showCardSelector, cardSelectorType, highlightedBoardIndex
  - isShowdownViewOpen, highlightedSeat, highlightedHoleSlot
- **cardReducer now contains only card data**: communityCards, holeCards, holeCardsVisible, allPlayerCards
- **Updated hooks**: useCardSelection, useShowdownCardSelection, useShowdownHandlers, useStateSetters

### View Migrations
- **StatsView.jsx**: Props reduced from 4 to 1 (scale only)
  - Uses: useGame() for seatActions, mySeat
  - Uses: useUI() for setCurrentScreen, SCREEN
- **TableView.jsx**: Props reduced from 64+ to ~30
  - Uses all 4 contexts for state and handlers
  - Remaining props: scale, tableRef, card state, parent handlers, icons

### Hand History Improvements (earlier in v114)
- **Session Hand Numbers**: Hands display position within session (#1, #2, #3)
- **Hand Display ID**: Searchable format `S{sessionId}-H{handNum}`
- **Visual Session Grouping**: Hands grouped under session headers
- **Hand Count Sync Fix**: INCREMENT_HAND_COUNT moved to nextHand() callback

### Files Created
- `src/contexts/GameContext.jsx`
- `src/contexts/UIContext.jsx`
- `src/contexts/SessionContext.jsx`
- `src/contexts/PlayerContext.jsx`
- `src/contexts/index.js`

### Files Modified
- `src/reducers/uiReducer.js` - Added view state and actions
- `src/reducers/cardReducer.js` - Removed view state
- `src/PokerTracker.jsx` - Added withContextProviders wrapper
- `src/components/views/StatsView.jsx` - Migrated to contexts
- `src/components/views/TableView.jsx` - Migrated to contexts
- `src/hooks/useCardSelection.js` - Updated to use dispatchUi
- `src/hooks/useShowdownCardSelection.js` - Updated to use dispatchUi
- `src/hooks/useShowdownHandlers.js` - Updated to use dispatchUi
- `src/hooks/useStateSetters.js` - Updated to use dispatchUi
- Test files updated for moved state

---

## v113 - Project Continuity System + Local Model Workflow ✅

### Summary
- **Purpose**: Enable seamless project tracking across chat sessions + integrate local model delegation
- **New Files**: 7 files created (4 hooks, 1 command, 1 registry, 1 template)
- **Archived**: 2 completed project files moved to archive
- **Workflow**: Local model commands + documentation sync integrated into task planning

### Local Model Workflow Integration
- **CLAUDE.md**: Added "Local Model Workflow" section with decision flow and command reference
- **engineering_practices.md**: Added "Local Models (DeepSeek/Qwen)" role definition with command mapping
- **TEMPLATE.project.md**: Added "Task Delegation" checklist to phases
- **cto-decompose.md**: Added `local_command` field to task JSON schema

### Documentation Sync System
- **New Hook**: `.claude/hooks/docs-sync.cjs` - Tracks source→docs staleness
  - Monitors source file edits (constants, hooks, reducers, utils, components)
  - Maps changes to required doc updates
  - Warns after 5+ source edits if docs not updated
  - Pre-commit warning if docs are stale
- **CLAUDE.md**: Added "Documentation Maintenance" section with update mapping
- **TEMPLATE.project.md**: Added doc verification to phase checklists
- **settings.json**: Registered docs-sync hook for Edit, Write, and Bash (git commit)

### Local Model Commands Reference
| Command | Model | Use For |
|---------|-------|---------|
| `/route <task>` | - | Get recommendation |
| `/local <task>` | Auto | Auto-route to best model |
| `/local-code <task>` | DeepSeek | New code (<80 lines) |
| `/local-refactor <task>` | Qwen | Refactoring tasks |
| `/local-doc <task>` | Qwen | Documentation/JSDoc |
| `/local-test <task>` | Qwen | Unit test generation |

### Key Changes
- **Project Registry** (`.claude/projects.json`)
  - Central tracking for active, pending, and completed projects
  - Stores project metadata: id, name, file path, priority, phases, completion

- **Startup Hook** (`project-status.cjs`)
  - UserPromptSubmit hook shows active projects at chat start
  - Displays progress percentage and suggests resume command
  - Rate-limited to once per 2-hour session

- **Work Tracking Hooks**
  - `project-update.cjs` - Reminds to update project files after significant edits
  - `commit-project-check.cjs` - Warns before commit if project files not updated
  - `docs-sync.cjs` - Tracks source→docs staleness and warns before commit

- **Project Commands** (`/project`)
  - `/project status` - View all projects with completion status
  - `/project start <name>` - Create new project from template
  - `/project resume <id>` - Load project context and continue
  - `/project complete <id>` - Mark project as finished
  - `/project archive <id>` - Move to archive directory

- **Directory Structure**
  - `docs/projects/` - Active project files
  - `docs/archive/` - Completed project files
  - `docs/projects/TEMPLATE.project.md` - Standard project template

### Files Created
1. `.claude/projects.json` - Project registry
2. `.claude/hooks/project-status.cjs` - Startup status hook
3. `.claude/hooks/project-update.cjs` - Edit tracking hook
4. `.claude/hooks/commit-project-check.cjs` - Pre-commit hook
5. `.claude/commands/project.md` - Project management command
6. `docs/projects/TEMPLATE.project.md` - Project file template

### Files Modified
- `.claude/settings.json` - Registered 3 new hooks
- `.gitignore` - Added session file exclusions
- `CLAUDE.md` - Added Project Continuity System documentation

### Archived Projects
- `docs/archive/debug-infrastructure.project.md` (was DEBUG_PROJECT.md)
- `docs/archive/cto-review-v112.project.md` (was IMPLEMENTATION_PLAN.md)

---

## v108 - Custom Hooks Extraction ✅

### Summary
- **Lines**: 967 → 620 lines main file (36% reduction)
- **Architecture**: Extracted logic into custom hooks and constants
- **New Files**: 8 files created (1 constants file + 7 custom hooks)
- **Code Quality**: Eliminated all duplicate code, improved testability
- **Net Reduction**: ~347 lines from main file, highly modular architecture

### Key Changes
- **Constants Extraction (v108a)**:
  - Created `src/constants/gameConstants.js` - Centralized game configuration
  - Extracted: ACTIONS, FOLD_ACTIONS, SEAT_STATUS, STREETS, BETTING_STREETS, SEAT_ARRAY, SUITS, RANKS, SUIT_ABBREV, isFoldAction
  - Removed 41 lines from main file

- **Simple Hooks (v108b)**:
  - Created `src/hooks/useActionUtils.js` - Action utility wrappers
  - Created `src/hooks/useStateSetters.js` - State dispatcher wrappers
  - Consolidated 16 wrapper functions into 2 hooks
  - Removed 50 lines from main file

- **Complex Hooks (v108c)**:
  - Created `src/hooks/useSeatUtils.js` - Seat logic utilities
  - Created `src/hooks/useSeatColor.js` - Seat color styling
  - Created `src/hooks/useShowdownHandlers.js` - Showdown handlers
  - Eliminated duplicate seat utility functions
  - Removed 149 lines from main file

- **Card Selection Hooks (v108d)**:
  - Created `src/hooks/useCardSelection.js` - Regular card selection
  - Created `src/hooks/useShowdownCardSelection.js` - Showdown card selection
  - Extracted complex card selection logic
  - Removed 107 lines from main file

### Files Created
1. `src/constants/gameConstants.js` (~57 lines) - Game constants and action definitions
2. `src/hooks/useActionUtils.js` (~58 lines) - Action utility functions
3. `src/hooks/useStateSetters.js` (~72 lines) - State setter functions
4. `src/hooks/useSeatUtils.js` (~57 lines) - Seat-related utilities
5. `src/hooks/useSeatColor.js` (~60 lines) - Seat color logic
6. `src/hooks/useShowdownHandlers.js` (~99 lines) - Showdown handlers
7. `src/hooks/useCardSelection.js` (~72 lines) - Card selection logic
8. `src/hooks/useShowdownCardSelection.js` (~109 lines) - Showdown card selection

### Files Modified
- `src/PokerTracker.jsx` - Removed 347 lines, added hook imports and calls (967 → 620 lines)
- `CLAUDE.md` - Updated architecture section with hooks directory
- `docs/QUICK_REF.md` - Added hooks reference section
- `docs/CHANGELOG.md` - This file

### Technical Details
- **Phased Implementation**: 4 phases (v108a → v108d) for safety and testability
- **Hook Pattern**: All hooks use proper useCallback/useMemo with dependency arrays
- **Dependency Injection**: Hooks receive state and constants as parameters
- **No Breaking Changes**: Maintained exact same functionality and API

### Architecture Improvements
**Before v108:**
```
PokerTracker.jsx (967 lines)
├── All constants, helpers, handlers, logic
└── Imports: Reducers, Views, UI components, Utils
```

**After v108:**
```
PokerTracker.jsx (620 lines)
├── Orchestrates state and views
├── Minimal logic (just coordination)
└── Imports: Constants, Hooks, Reducers, Views, UI

New structure:
├── src/constants/ - Centralized game configuration
├── src/hooks/ - 7 custom hooks for component logic
├── src/reducers/ - State management (unchanged)
├── src/utils/ - Pure functions (unchanged)
└── src/components/ - UI components (unchanged)
```

**Benefits:**
- Clear separation of concerns
- Highly testable (hooks can be tested independently)
- Reusable (hooks can be used in other components)
- Maintainable (single responsibility principle)
- Scalable (easy to add new features)

---

## v107 - Utils Integration ✅

### Summary
- **Lines**: 1056 → ~920 lines main file (13% reduction)
- **Architecture**: Connected existing utils, removed duplicates
- **New File**: `src/utils/displayUtils.js` - Display formatting utilities
- **Code Quality**: Eliminated 134 lines of duplicate helper functions
- **Net Reduction**: ~51 lines across entire codebase

### Key Changes
- **New Utils File Created**:
  - `displayUtils.js` - Display and formatting utilities (isRedCard, isRedSuit, getCardAbbreviation, getHandAbbreviation)
- **Utils Integration**: Connected existing utils (actionUtils, cardUtils, seatUtils) to PokerTracker.jsx
- **Removed Duplicates**:
  - Deleted 134 lines of duplicate helper functions from PokerTracker.jsx (lines 122-255)
  - Removed isRedSuit from ShowdownView.jsx and CardSelectorView.jsx
  - Removed isRedCard from CardSlot.jsx
- **Wrapper Pattern**: Added 6 useCallback wrappers to inject constants into utils functions
- **Components Updated**: 4 files now import from utils (ShowdownView, CardSelectorView, CardSlot, PokerTracker)

### Files Modified
- `src/PokerTracker.jsx` - Added imports, removed duplicates, added wrappers (1056 → ~920 lines)
- `src/utils/displayUtils.js` - **NEW** file (~50 lines)
- `src/components/views/ShowdownView.jsx` - Import isRedSuit from utils
- `src/components/views/CardSelectorView.jsx` - Import isRedSuit from utils
- `src/components/ui/CardSlot.jsx` - Import isRedCard from utils
- `CLAUDE.md` - Updated to v107 with utils documentation
- `docs/QUICK_REF.md` - Added utils reference section
- `docs/CHANGELOG.md` - This file

### Technical Details
- **Dependency Injection Pattern**: Utils accept constants as parameters instead of using closure
- **Wrapper Functions**: `wrappedGetActionDisplayName`, `wrappedGetActionColor`, `wrappedGetSeatActionStyle`, `wrappedGetOverlayStatus`, `wrappedGetCardAbbreviation`, `wrappedGetHandAbbreviation`
- **Import Pattern**:
  - From PokerTracker.jsx: `import { func } from './utils/fileName'`
  - From views/ui: `import { func } from '../../utils/fileName'`

---

## v106 - State Management Refactoring ✅

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
