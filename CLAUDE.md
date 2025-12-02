# CLAUDE.md - Project Context for Claude Code

## Project Overview
Poker Tracker - A React-based hand tracker for live 9-handed poker games.

## Quick Start
1. Read `docs/SPEC.md` first (complete specification)
2. Main code is in `src/PokerTracker.jsx` (~1088 lines)
3. View components in `src/components/views/`
4. UI components in `src/components/ui/`
5. Use `docs/QUICK_REF.md` for fast lookups

## Key Commands
```bash
npm install    # Install dependencies
npm run dev    # Start dev server (localhost:5173)
npm run build  # Production build
```

## Architecture (v106)

### File Structure
```
src/
├── PokerTracker.jsx (~1000 lines)
│   ├── Lines 1-14:      Imports (React, icons, components, reducers)
│   ├── Lines 16-118:    Constants (CONSTANTS, ACTIONS, SCREEN, etc.)
│   ├── Lines 120-256:   Helper Functions (11 pure functions)
│   └── Lines 261+:      Main Component (reducers, handlers, view rendering)
│
├── reducers/                    (State management)
│   ├── gameReducer.js           (Game state: street, dealer, actions)
│   ├── uiReducer.js             (UI state: view, selection, context menu)
│   └── cardReducer.js           (Card state: community, hole, showdown)
│
├── components/
│   ├── ui/                      (Reusable UI components)
│   │   ├── CardSlot.jsx         (Card display with 4 variants)
│   │   ├── VisibilityToggle.jsx (Show/hide button)
│   │   ├── PositionBadge.jsx    (D, SB, BB, ME indicators)
│   │   ├── DiagonalOverlay.jsx  (FOLD/ABSENT/MUCK/WON overlays)
│   │   └── ScaledContainer.jsx  (Responsive scaling wrapper)
│   │
│   └── views/                   (Full-screen view components)
│       ├── TableView.jsx        (Main poker table, ~326 lines)
│       ├── StatsView.jsx        (Statistics display, ~264 lines)
│       ├── CardSelectorView.jsx (Card selection, ~180 lines)
│       └── ShowdownView.jsx     (Showdown interface, ~487 lines)
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
- `SCREEN.TABLE` / `SCREEN.STATS` - View identifiers

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

### Helper Functions (Outside Component)
- `isFoldAction(action)` - Check if action is fold type
- `getActionColor(action)` - Action → Tailwind classes
- `getSeatActionStyle(action)` - Action → {bg, ring}
- `getOverlayStatus(...)` - Determine overlay status
- `log(...)` - Debug logging (controlled by DEBUG flag)

### Important: useCallback Pattern
All handler functions are wrapped in `useCallback` with proper dependencies to prevent unnecessary re-renders and enable use in dependency arrays. When adding new handlers:
1. Use `useCallback` for functions passed as props
2. Include all external dependencies in the dependency array
3. Helper functions used as dependencies must also be `useCallback`
4. Define helper functions BEFORE functions that depend on them

## Common Tasks

### Adding a New Action
1. Add to `ACTIONS` constant
2. Add case to `getActionDisplayName()`
3. Add color to `getActionColor()` and `getSeatActionStyle()`

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
- v106: State management refactoring with useReducer (current)
  - Migrated from useState to three useReducer hooks (gameReducer, uiReducer, cardReducer)
  - All handlers converted to useCallback with proper dependencies
  - Improved code organization: helper functions defined before dependent callbacks
  - Fixed circular dependency issues and initialization bugs
  - Main file reduced to ~1000 lines
