# CLAUDE.md - Project Context for Claude Code

## Project Overview
Poker Tracker - A React-based hand tracker for live 9-handed poker games.

## Quick Start
1. Read `docs/SPEC.md` first (complete specification)
2. Main code is in `src/PokerTracker.jsx` (~620 lines)
3. View components in `src/components/views/`
4. UI components in `src/components/ui/`
5. Custom hooks in `src/hooks/`
6. Utility functions in `src/utils/`
7. Game constants in `src/constants/`
8. Use `docs/QUICK_REF.md` for fast lookups

## Key Commands
```bash
npm install    # Install dependencies
npm run dev    # Start dev server (localhost:5173)
npm run build  # Production build
```

## Architecture (v109)

### File Structure
```
src/
├── PokerTracker.jsx (~620 lines)
│   ├── Lines 1-45:      Imports (React, icons, components, reducers, utils, hooks, constants)
│   ├── Lines 47-92:     Constants (CONSTANTS, SEAT_POSITIONS, SCREEN - UI-specific only)
│   ├── Lines 94-179:    Main Component (reducers, hooks, handlers, view rendering)
│   └── Note: All game constants and complex logic extracted to hooks
│
├── constants/                   (Game configuration - NEW in v108)
│   └── gameConstants.js         (ACTIONS, FOLD_ACTIONS, SEAT_STATUS, STREETS, etc.)
│
├── hooks/                       (Custom hooks - NEW in v108)
│   ├── useActionUtils.js        (Action utility wrappers)
│   ├── useStateSetters.js       (State dispatcher wrappers)
│   ├── useSeatUtils.js          (Seat logic utilities)
│   ├── useSeatColor.js          (Seat color styling)
│   ├── useShowdownHandlers.js   (Showdown handlers)
│   ├── useCardSelection.js      (Card selection logic)
│   ├── useShowdownCardSelection.js (Showdown card selection)
│   └── usePersistence.js        (IndexedDB auto-save/restore - NEW in v109)
│
├── reducers/                    (State management)
│   ├── gameReducer.js           (Game state: street, dealer, actions)
│   ├── uiReducer.js             (UI state: view, selection, context menu)
│   └── cardReducer.js           (Card state: community, hole, showdown)
│
├── utils/                       (Utility functions)
│   ├── actionUtils.js           (Action styling, display, overlays)
│   ├── actionValidation.js      (Action sequence validation)
│   ├── cardUtils.js             (Card assignment and manipulation)
│   ├── seatUtils.js             (Seat navigation and positioning)
│   ├── displayUtils.js          (Display formatting)
│   ├── validation.js            (Input validation)
│   └── persistence.js           (IndexedDB CRUD operations - NEW in v109)
│
└── components/
    ├── ui/                      (Reusable UI components)
    │   ├── CardSlot.jsx         (Card display with 4 variants)
    │   ├── VisibilityToggle.jsx (Show/hide button)
    │   ├── PositionBadge.jsx    (D, SB, BB, ME indicators)
    │   ├── DiagonalOverlay.jsx  (FOLD/ABSENT/MUCK/WON overlays)
    │   ├── ScaledContainer.jsx  (Responsive scaling wrapper)
    │   ├── ActionBadge.jsx      (Single action badge display)
    │   └── ActionSequence.jsx   (Multiple action badges with overflow)
    │
    └── views/                   (Full-screen view components)
        ├── TableView.jsx        (Main poker table, ~326 lines)
        ├── StatsView.jsx        (Statistics display, ~264 lines)
        ├── CardSelectorView.jsx (Card selection, ~178 lines)
        ├── ShowdownView.jsx     (Showdown interface, ~485 lines)
        └── HistoryView.jsx      (Hand history browser, ~300 lines - NEW in v109)
```

### State Management (useReducer)
The app uses three reducers for clean state management:

**gameReducer** (`src/reducers/gameReducer.js`):
- State: `currentStreet`, `dealerButtonSeat`, `mySeat`, `seatActions`, `absentSeats`
- Actions: `SET_STREET`, `ADVANCE_DEALER`, `RECORD_ACTION`, `CLEAR_STREET_ACTIONS`, etc.

**uiReducer** (`src/reducers/uiReducer.js`):
- State: `currentView`, `selectedPlayers`, `contextMenu`, `isDraggingDealer`
- Actions: `SET_SCREEN`, `TOGGLE_PLAYER_SELECTION`, `SET_CONTEXT_MENU`, etc.

**cardReducer** (`src/reducers/cardReducer.js`):
- State: `communityCards`, `holeCards`, `allPlayerCards`, `isShowdownViewOpen`, etc.
- Actions: `SET_COMMUNITY_CARD`, `SET_HOLE_CARD`, `OPEN_SHOWDOWN_VIEW`, etc.

### Key Constants
- `ACTIONS.*` - All action types (FOLD, CALL, OPEN, etc.)
- `SEAT_ARRAY` - [1,2,3,4,5,6,7,8,9] for iteration
- `CONSTANTS.NUM_SEATS` - Use instead of hardcoded 9
- `SCREEN.TABLE` / `SCREEN.STATS` / `SCREEN.HISTORY` - View identifiers

### Component Architecture
View and UI components are modular:

**View Components** (in `src/components/views/`):
- Import from `'../ui/...'` for UI components
- Receive state and handlers as props from PokerTracker.jsx
- Examples: `TableView`, `StatsView`, `CardSelectorView`, `ShowdownView`

**UI Components** (in `src/components/ui/`):
- Self-contained, reusable across views
- `CardSlot` - 4 variants: `table`, `hole-table`, `showdown`, `selector`
- `PositionBadge` - 2 sizes: `small` (16px), `large` (28px)
- `VisibilityToggle` - 2 sizes: `small` (24px), `large` (40px)
- `DiagonalOverlay` - Status overlays (requires SEAT_STATUS prop)
- `ScaledContainer` - Responsive scaling wrapper

### Utility Functions (src/utils/)
Helper functions are centralized in the utils/ directory:

**actionUtils.js**: Action-related utilities
- `getActionDisplayName(action, isFoldAction, ACTIONS)` - Get display name for action
- `getActionColor(action, isFoldAction, ACTIONS)` - Get Tailwind classes for action color
- `getSeatActionStyle(action, isFoldAction, ACTIONS)` - Get seat background/ring colors
- `getOverlayStatus(inactiveStatus, isMucked, hasWon, SEAT_STATUS)` - Determine overlay status

**displayUtils.js**: Display formatting utilities (NEW in v107)
- `isRedCard(card)` - Check if card is red (♥ or ♦)
- `isRedSuit(suit)` - Check if suit is red
- `getCardAbbreviation(card, SUIT_ABBREV)` - Convert "A♥" → "Ah"
- `getHandAbbreviation(cards, SUIT_ABBREV)` - Convert ["A♥", "K♠"] → "AhKs"

**cardUtils.js**: Card manipulation utilities
- `assignCardToSlot(cards, card, targetSlot)` - Assign card and remove from other slots
- `findNextEmptySlot(...)` - Find next empty card slot in showdown
- `shouldAutoCloseCardSelector(currentStreet, highlightedIndex)` - Auto-close logic

**seatUtils.js**: Seat navigation utilities
- `getSmallBlindSeat(dealerSeat, absentSeats, numSeats)` - Calculate SB seat
- `getBigBlindSeat(dealerSeat, absentSeats, numSeats)` - Calculate BB seat
- `getFirstActionSeat(...)` - Get first seat to act on current street
- `getNextActionSeat(...)` - Get next seat to act

**validation.js**: Input validation utilities
- `isValidCard(card)` - Validate card string
- `isValidSeat(seat, numSeats)` - Validate seat number
- `isValidAction(action, ACTIONS)` - Validate action

**Import pattern**: Utils use dependency injection - constants are passed as parameters.

### Custom Hooks (src/hooks/)
Encapsulated component logic extracted from PokerTracker.jsx for better organization and testability:

**useActionUtils.js**: Action utility wrappers (~58 lines)
- Returns 6 functions with constants injected: `getActionDisplayName`, `getActionColor`, `getSeatActionStyle`, `getOverlayStatus`, `getCardAbbreviation`, `getHandAbbreviation`
- Consolidates utility wrapper functions into a single hook

**useStateSetters.js**: State dispatcher wrappers (~72 lines)
- Returns 10 setter functions: `setCurrentScreen`, `setContextMenu`, `setSelectedPlayers`, `setHoleCardsVisible`, `setCurrentStreet`, `setDealerSeat`, `setCardSelectorType`, `setHighlightedCardIndex`, `setHighlightedSeat`, `setHighlightedCardSlot`
- Takes `(dispatchGame, dispatchUi, dispatchCard)` as parameters

**useSeatUtils.js**: Seat logic utilities (~57 lines)
- Returns 5 functions: `getSmallBlindSeat`, `getBigBlindSeat`, `hasSeatFolded`, `getFirstActionSeat`, `getNextActionSeat`
- Wraps seatUtils functions with proper dependencies and constant injection
- Takes `(currentStreet, dealerButtonSeat, absentSeats, seatActions, numSeats)` as parameters

**useSeatColor.js**: Seat color styling (~60 lines)
- Returns `getSeatColor` function
- Complex logic for determining seat colors based on status, selection, and actions
- Takes `(hasSeatFolded, selectedPlayers, mySeat, absentSeats, seatActions, currentStreet, getSeatActionStyle)` as parameters

**useShowdownHandlers.js**: Showdown handlers (~99 lines)
- Returns 6 handlers: `handleClearShowdownCards`, `handleMuckSeat`, `handleWonSeat`, `handleNextHandFromShowdown`, `handleCloseShowdown`, `handleCloseCardSelector`
- Encapsulates all showdown-specific handler logic
- Takes `(dispatchCard, dispatchGame, isSeatInactive, seatActions, recordSeatAction, nextHand, numSeats, log)` as parameters

**useCardSelection.js**: Card selection logic (~72 lines)
- Returns `selectCard` function
- Handles community and hole card selection with auto-advance and auto-close
- Takes `(highlightedBoardIndex, cardSelectorType, communityCards, holeCards, currentStreet, dispatchCard)` as parameters

**useShowdownCardSelection.js**: Showdown card selection (~109 lines)
- Returns `selectCardForShowdown` function
- Complex auto-advance logic for multi-player card assignment
- Takes `(highlightedSeat, highlightedHoleSlot, mySeat, holeCards, allPlayerCards, communityCards, seatActions, isSeatInactive, dispatchCard, numSeats)` as parameters

**Hook pattern**: All hooks use `useCallback` and `useMemo` with proper dependency arrays. They encapsulate complex logic and return functions ready to use.

### Important: useCallback Pattern
All handler functions are wrapped in `useCallback` with proper dependencies to prevent unnecessary re-renders and enable use in dependency arrays. When adding new handlers:
1. Use `useCallback` for functions passed as props
2. Include all external dependencies in the dependency array
3. Helper functions used as dependencies must also be `useCallback`
4. Define helper functions BEFORE functions that depend on them

## Common Tasks

### Adding a New Action
1. Add to `ACTIONS` constant in `src/constants/gameConstants.js`
2. Add case to `getActionDisplayName()` in `src/utils/actionUtils.js`
3. Add color to `getActionColor()` and `getSeatActionStyle()` in `src/utils/actionUtils.js`

### Modifying Card Display
Import and use `CardSlot` from `'./components/ui/CardSlot'`:
```javascript
import { CardSlot } from './components/ui/CardSlot';

<CardSlot
  card="A♠"
  variant="table"  // or 'hole-table', 'showdown', 'selector'
  SEAT_STATUS={SEAT_STATUS}  // Pass if using status prop
/>
```

### Debug Mode
Set `DEBUG = false` at line 8 to disable all console logging.

## Important Rules
- ALL action recordings use `ACTIONS.*` constants
- Use `SEAT_ARRAY` for seat iteration (not hardcoded arrays)
- Use `CONSTANTS.NUM_SEATS` for seat limits (not hardcoded 9)
- Import UI components from `src/components/ui/` (don't define inline)
- View components import their own UI components (don't pass as props)
- Pass SEAT_STATUS to CardSlot and DiagonalOverlay when using status
- **State updates**: Use reducer dispatch functions (`dispatchGame`, `dispatchUi`, `dispatchCard`), never direct state setters
- **Handlers**: Wrap all handler functions in `useCallback` with correct dependencies
- **Function order**: Define helper functions BEFORE callbacks that depend on them

## Responsive Design
The app uses dynamic scaling to fit any browser window size:
- Design dimensions: 1600x720 (Samsung Galaxy A22 landscape)
- Scale calculated on mount and window resize: `min(viewportWidth * 0.95 / 1600, viewportHeight * 0.95 / 720, 1.0)`
- Mobile-optimized component sizes: badges (16px/28px), seats (40px), cards scaled down
- Card selectors maximized: 90px height cards with large text, no scrolling required

## Testing Changes
Test all 4 views at various browser sizes:
1. Table View (default)
2. Card Selector (click community/hole cards) - shows current street in header
3. Showdown View (click "showdown" street) - auto-advances to next empty card slot
4. Stats View (click "Stats" button)

## Version History
- v101: Baseline features
- v102: Constants extraction
- v103: Full refactoring
- v104: Mobile landscape optimization, responsive scaling, card selector improvements
- v105: Component extraction - views and UI components modularized
  - Reduced main file from 1957 to 1088 lines (44% smaller)
  - 4 view components extracted to `src/components/views/`
  - 5 UI components extracted to `src/components/ui/`
  - Eliminated ~164 lines of duplicate UI component code
- v106: State management refactoring with useReducer
  - Migrated from useState to three useReducer hooks (gameReducer, uiReducer, cardReducer)
  - All handlers converted to useCallback with proper dependencies
  - Improved code organization: helper functions defined before dependent callbacks
  - Fixed circular dependency issues and initialization bugs
  - Main file reduced to ~1000 lines
- v107: Utils integration
  - Created `src/utils/displayUtils.js` for display formatting utilities
  - Connected existing utils (actionUtils, cardUtils, seatUtils) to PokerTracker.jsx
  - Removed 134 lines of duplicate helper functions
  - Added useCallback wrappers to inject constants into utils
  - Updated 4 components to import from utils (ShowdownView, CardSelectorView, CardSlot, PokerTracker)
  - Main file reduced from 1056 to ~920 lines (13% reduction)
  - Net codebase reduction: ~51 lines
- v108: Custom hooks extraction
  - Created `src/constants/gameConstants.js` - Centralized game configuration
  - Created 7 custom hooks in `src/hooks/`:
    - `useActionUtils.js` - Action utility wrappers
    - `useStateSetters.js` - State dispatcher wrappers
    - `useSeatUtils.js` - Seat logic utilities
    - `useSeatColor.js` - Seat color styling
    - `useShowdownHandlers.js` - Showdown handlers
    - `useCardSelection.js` - Card selection logic
    - `useShowdownCardSelection.js` - Showdown card selection
  - Eliminated all duplicate code and improved testability
  - Main file reduced from 967 to 620 lines (36% reduction)
  - Phased implementation (v108a → v108d) for safety
  - Highly modular architecture with clear separation of concerns
- v109: Hand history and persistence system (current)
  - Created `src/utils/persistence.js` - IndexedDB CRUD operations (saveHand, loadHandById, getAllHands, deleteHand, clearAllHands, getHandCount)
  - Created `src/hooks/usePersistence.js` - Auto-save/restore hook with debouncing (1.5s delay)
  - Created `src/components/views/HistoryView.jsx` - Hand history browser UI (~300 lines)
  - Created `src/components/ui/ActionBadge.jsx` - Single action badge component
  - Created `src/components/ui/ActionSequence.jsx` - Multiple action badges with overflow (+N display)
  - Created `src/utils/actionValidation.js` - Validates poker action sequences (prevents illegal actions)
  - Added SCREEN.HISTORY view identifier
  - Features: Load any saved hand, delete individual hands, clear all history, relative timestamps
  - Multiple actions per street now fully supported with visual action sequences
  - Database schema: PokerTrackerDB v1 with 'hands' object store (handId, timestamp, sessionId indexes)
