# Poker Tracker Specification - v110

## Version: v110 (Session Management System)
## Last Updated: 2025-12-06
## Main File: src/PokerTracker.jsx (~620 lines)
## Total Project: v108 architecture + persistence system + session management (11 new files)

---

## QUICK REFERENCE

### Current Features
1. **Table View**: 9-seat poker table with auto-selection workflow
2. **Card Selector**: Full-screen card assignment for board and hole cards
3. **Showdown View**: Card assignment + hand history summary for all 9 players
4. **Stats View**: Player statistics display (placeholder)
5. **History View**: Hand history browser with load/delete functionality (NEW in v109)
6. **Sessions View**: Session management with buy-in tracking, rebuys, cash-out workflow (NEW in v110)
7. **Persistence**: Auto-save/restore with IndexedDB for hands and sessions (v109+v110)

### Key Variable Names (v104 naming)
| Variable | Purpose |
|----------|---------|
| `currentView` | Which view is shown: `SCREEN.TABLE`, `SCREEN.STATS`, `SCREEN.HISTORY`, or `SCREEN.SESSIONS` |
| `isShowdownViewOpen` | Boolean for showdown card assignment view |
| `dealerButtonSeat` | Which seat (1-9) has the dealer button |
| `highlightedBoardIndex` | Which community card slot (0-4) is selected |
| `highlightedHoleSlot` | Which hole card slot (0-1) is selected |
| `highlightedSeat` | Which seat (1-9) is selected in showdown view |
| `scale` | Dynamic viewport scale factor (v104) |
| `sessionState` | Current session state (sessionId, venue, gameType, buyIn, etc.) (NEW in v110) |

---

## CODE ORGANIZATION (v108 Modular Architecture)

### Main File: src/PokerTracker.jsx (~620 lines)
```
Lines 1-45:      Imports (React, icons, components, reducers, utils, hooks, constants)
Lines 47-92:     Constants (CONSTANTS, SEAT_POSITIONS, SCREEN - UI-specific only)
Lines 94-179:    Main Component (reducers, hooks, handlers, view rendering)
```

### New Files (v108-v110):
```
src/constants/
├── gameConstants.js (~57 lines)     # Game configuration constants (v108)
└── sessionConstants.js              # Session configuration (NEW in v110)

src/hooks/
├── useActionUtils.js (~58 lines)    # Action utility wrappers (v108)
├── useStateSetters.js (~72 lines)   # State dispatcher wrappers (v108)
├── useSeatUtils.js (~57 lines)      # Seat logic utilities (v108)
├── useSeatColor.js (~60 lines)      # Seat color styling (v108)
├── useShowdownHandlers.js (~99 lines) # Showdown handlers (v108)
├── useCardSelection.js (~72 lines)  # Card selection logic (v108)
├── useShowdownCardSelection.js (~109 lines) # Showdown card selection (v108)
├── usePersistence.js (~237 lines)   # IndexedDB auto-save/restore (v109)
└── useSessionPersistence.js (~327 lines) # Session persistence (NEW in v110)

src/reducers/
├── gameReducer.js                   # Game state management (v106)
├── uiReducer.js                     # UI state management (v106)
├── cardReducer.js                   # Card state management (v106)
└── sessionReducer.js                # Session state management (NEW in v110)

src/utils/
├── actionUtils.js                   # Action styling and display
├── actionValidation.js              # Action sequence validation (v109)
├── cardUtils.js                     # Card manipulation
├── seatUtils.js                     # Seat navigation
├── displayUtils.js                  # Display formatting (UPDATED in v110)
├── validation.js                    # Input validation
└── persistence.js (~520 lines)      # IndexedDB CRUD operations (v109, UPDATED in v110)

src/components/
├── views/                           # Full-screen views
│   ├── TableView.jsx (~326 lines)
│   ├── StatsView.jsx (~264 lines)
│   ├── CardSelectorView.jsx (~178 lines)
│   ├── ShowdownView.jsx (~485 lines)
│   ├── HistoryView.jsx (~300 lines) # Hand history browser (v109)
│   └── SessionsView.jsx (~656 lines) # Session management (NEW in v110)
└── ui/                              # Reusable UI components
    ├── CardSlot.jsx
    ├── VisibilityToggle.jsx
    ├── PositionBadge.jsx
    ├── DiagonalOverlay.jsx
    ├── ScaledContainer.jsx
    ├── ActionBadge.jsx              # Single action badge (v109)
    ├── ActionSequence.jsx           # Multiple action badges (v109)
    └── SessionForm.jsx              # New session form (NEW in v110)
```

---

## CONSTANTS

### Game Constants (src/constants/gameConstants.js)
All centralized game configuration:

```javascript
ACTIONS = {
  FOLD, LIMP, CALL, OPEN, THREE_BET, FOUR_BET,
  CBET_IP_SMALL, CBET_IP_LARGE, CBET_OOP_SMALL, CBET_OOP_LARGE,
  CHECK, FOLD_TO_CR, DONK, STAB, CHECK_RAISE, FOLD_TO_CBET,
  MUCKED, WON
  // ... 25 total actions
}

FOLD_ACTIONS = [ACTIONS.FOLD, ACTIONS.FOLD_TO_CR, ACTIONS.FOLD_TO_CBET]
SEAT_STATUS = { FOLDED: 'folded', ABSENT: 'absent' }
SEAT_ARRAY = [1, 2, 3, 4, 5, 6, 7, 8, 9]      // For iteration

STREETS = ['preflop', 'flop', 'turn', 'river', 'showdown']
BETTING_STREETS = ['preflop', 'flop', 'turn', 'river']  // Excludes showdown

SUITS = ['♠', '♥', '♦', '♣']
RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
SUIT_ABBREV = { '♥': 'h', '♦': 'd', '♣': 'c', '♠': 's' }

// Helper function
isFoldAction = (action) => FOLD_ACTIONS.includes(action)
```

### Session Constants (src/constants/sessionConstants.js - NEW in v110)
Session configuration for session management:

```javascript
SESSION_ACTIONS = {
  START_SESSION, END_SESSION, UPDATE_SESSION_FIELD, ADD_REBUY,
  LOAD_SESSIONS, SET_ACTIVE_SESSION, HYDRATE_SESSION,
  INCREMENT_HAND_COUNT, SET_LOADING
}

VENUES = ['Online', 'Horseshoe Casino', 'Wind Creek Casino']

GAME_TYPES = {
  TOURNAMENT: { label: 'Tournament', buyInDefault: 0, rebuyDefault: 0 },
  ONE_TWO: { label: '1/2', buyInDefault: 200, rebuyDefault: 200 },
  ONE_THREE: { label: '1/3', buyInDefault: 300, rebuyDefault: 300 },
  TWO_FIVE: { label: '2/5', buyInDefault: 500, rebuyDefault: 500 }
}

GAME_TYPE_KEYS = ['TOURNAMENT', 'ONE_TWO', 'ONE_THREE', 'TWO_FIVE']

SESSION_GOALS = {
  OBSERVE: 'Observe and take notes',
  TIGHT_AGGRESSIVE: 'Play tight and aggressive',
  // ... more goals
}
```

### UI Constants (src/PokerTracker.jsx)
UI-specific configuration:

```javascript
// Debug
DEBUG = true
log = (...args) => DEBUG && console.log('[PokerTracker]', ...args)

CONSTANTS = {
  NUM_SEATS: 9,
  // Mobile-optimized card dimensions (v104)
  CARD: {
    SMALL: { width: 24, height: 35 },    // Hole cards on table
    MEDIUM: { width: 28, height: 40 },   // Showdown card slots
    LARGE: { width: 32, height: 45 },    // Card selector slots
    TABLE: { width: 35, height: 50 },    // Community cards on table
  },
  // Mobile-optimized UI elements (v104)
  BADGE_SIZE: 16,
  SEAT_SIZE: 40,
  DEALER_BUTTON_SIZE: 28,
  TOGGLE_BUTTON_SIZE: 24,
  // Samsung Galaxy A22 landscape (v104)
  TABLE_WIDTH: 1600,
  TABLE_HEIGHT: 720,
  TABLE_SCALE: 1.0,  // Dynamic scaling via hook
  FELT_WIDTH: 900,
  FELT_HEIGHT: 450,
}

SEAT_POSITIONS = [{ seat: 1-9, x: %, y: % }]  // 9 positions
SCREEN = { TABLE: 'table', STATS: 'stats', HISTORY: 'history', SESSIONS: 'sessions' }
```

---

## CUSTOM HOOKS (src/hooks/)

### useActionUtils.js
Action utility functions (wraps utils with constants):
- `getActionDisplayName(action)` - ACTIONS.FOLD → 'fold'
- `getActionColor(action)` - Tailwind classes for showdown summary
- `getSeatActionStyle(action)` - Returns `{bg, ring}` for table seat styling
- `getOverlayStatus(inactive, mucked, won)` - DiagonalOverlay status
- `getCardAbbreviation(card)` - "A♥" → "Ah"
- `getHandAbbreviation(cards)` - ["A♥", "T♦"] → "AhTd"

### useStateSetters.js
State dispatcher wrappers (10 functions):
- `setCurrentScreen(screen)` - Set view (TABLE/STATS)
- `setContextMenu(menu)` - Set context menu
- `setSelectedPlayers(players)` - Set selected seats
- `setHoleCardsVisible(visible)` - Toggle hole cards
- `setCurrentStreet(street)` - Set current street
- `setDealerSeat(seat)` - Set dealer button
- `setCardSelectorType(type)` - Set card selector type
- `setHighlightedCardIndex(index)` - Highlight community card
- `setHighlightedSeat(seat)` - Highlight seat in showdown
- `setHighlightedCardSlot(slot)` - Highlight hole card slot

### useSeatUtils.js
Seat logic utilities (wraps utils):
- `getSmallBlindSeat()` - Calculate SB seat
- `getBigBlindSeat()` - Calculate BB seat
- `hasSeatFolded(seat)` - Check if seat folded
- `getFirstActionSeat()` - Get first seat to act
- `getNextActionSeat(fromSeat)` - Get next seat to act

### useSeatColor.js
Seat color styling:
- `getSeatColor(seat)` - Returns `{bg, ring}` for seat based on status/action

### useShowdownHandlers.js
Showdown-specific handlers (6 functions):
- `handleClearShowdownCards()` - Clear all player cards
- `handleMuckSeat(seat)` - Mark seat as mucked + advance
- `handleWonSeat(seat)` - Mark seat as winner + advance
- `handleNextHandFromShowdown()` - Close showdown + next hand
- `handleCloseShowdown()` - Close showdown view
- `handleCloseCardSelector()` - Close card selector

### useCardSelection.js
Regular card selection logic:
- `selectCard(card)` - Handle card selection with auto-advance

### useShowdownCardSelection.js
Showdown card selection logic:
- `selectCardForShowdown(card)` - Complex multi-player card selection with auto-advance

---

## UTILITY FUNCTIONS (src/utils/)

### actionUtils.js
- `getActionDisplayName(action, isFoldAction, ACTIONS)` - Action to display name
- `getActionColor(action, isFoldAction, ACTIONS)` - Action to Tailwind classes
- `getSeatActionStyle(action, isFoldAction, ACTIONS)` - Seat styling
- `getOverlayStatus(inactiveStatus, isMucked, hasWon, SEAT_STATUS)` - Overlay status

### displayUtils.js
- `isRedCard(card)` - Check if card is red (♥ or ♦)
- `isRedSuit(suit)` - Check if suit is red
- `getCardAbbreviation(card, SUIT_ABBREV)` - Card to abbreviation
- `getHandAbbreviation(cards, SUIT_ABBREV)` - Cards to abbreviation

### cardUtils.js
- `assignCardToSlot(cards, card, targetSlot)` - Card assignment
- `findNextEmptySlot(...)` - Find next empty showdown slot
- `shouldAutoCloseCardSelector(currentStreet, highlightedIndex)` - Auto-close logic

### seatUtils.js
- `getSmallBlindSeat(dealerSeat, absentSeats, numSeats)` - Calculate SB
- `getBigBlindSeat(dealerSeat, absentSeats, numSeats)` - Calculate BB
- `getFirstActionSeat(...)` - First seat to act
- `getNextActionSeat(...)` - Next seat to act

### validation.js
- `isValidCard(card)` - Validate card string
- `isValidSeat(seat, numSeats)` - Validate seat number
- `isValidAction(action, ACTIONS)` - Validate action

---

## UI COMPONENTS (src/components/ui/)

All reusable UI components extracted to separate files:

### PositionBadge.jsx
Position indicators for dealer, blinds, and player seat.
```jsx
<PositionBadge
  type="dealer|sb|bb|me"     // Required: which badge type
  size="small|large"          // Optional: 16px or 28px mobile (v104) (default: small)
  draggable={boolean}         // Optional: enable drag (default: false)
  onDragStart={function}      // Optional: drag handler
/>
```

### VisibilityToggle.jsx
Show/hide toggle button for hole cards.
```jsx
<VisibilityToggle
  visible={boolean}           // Required: current visibility state
  onToggle={function}         // Required: toggle handler
  size="small|large"          // Optional: 24px or 40px (default: small)
/>
```

### DiagonalOverlay.jsx
Status overlays for folded/absent/mucked/won seats.
```jsx
<DiagonalOverlay
  status={SEAT_STATUS.FOLDED|SEAT_STATUS.ABSENT|'mucked'|'won'|null}
/>
```

### CardSlot.jsx
Universal card display component with 4 variants.
```jsx
<CardSlot
  card={string|null}          // Card like "A♥" or null
  variant="table|hole-table|showdown|selector"  // Size variant
  isHighlighted={boolean}     // Yellow ring highlight (default: false)
  isHidden={boolean}          // Hidden card back (default: false)
  status={null|'folded'|'absent'|'mucked'|'won'}  // Affects bg color
  onClick={function}          // Click handler (default: null)
  canInteract={boolean}       // Enable hover/click (default: true)
/>
```

**Variant Sizes:**
| Variant | Width | Height | Use Case |
|---------|-------|--------|----------|
| `table` | 70px | 100px | Community cards on table |
| `hole-table` | 40px | 58px | Hole cards on table |
| `showdown` | 50px | 70px | Showdown view cards |
| `selector` | 60px | 85px | Card selector slots |

### ScaledContainer.jsx
Responsive scaling wrapper for viewport adaptation.
```jsx
<ScaledContainer scale={number}>
  {children}
</ScaledContainer>
```

---

## EVENT HANDLERS

### From Hooks (useShowdownHandlers.js)
These handlers are provided by the `useShowdownHandlers` hook:
| Handler | Purpose |
|---------|---------|
| `handleNextHandFromShowdown` | Close showdown + advance to next hand |
| `handleClearShowdownCards` | Clear all player cards in showdown view |
| `handleCloseShowdown` | Close showdown view |
| `handleCloseCardSelector` | Close card selector |
| `handleMuckSeat(seat)` | Mark seat as mucked + advance |
| `handleWonSeat(seat)` | Mark seat as winner + advance |

### Main Component Handlers (PokerTracker.jsx)
These handlers are defined directly in the main component:
| Handler | Purpose |
|---------|---------|
| `handleDealerDragStart/Drag/End` | Dealer button drag-and-drop |
| `handleSeatRightClick` | Open context menu on seat |
| `togglePlayerSelection(seat)` | Select/deselect seat |
| `recordAction(action)` | Record action for selected seats |
| `recordSeatAction(seat, action)` | Record action for specific seat |
| `toggleAbsent` | Mark selected seats as absent |
| `nextStreet` | Advance to next street |
| `nextHand` | Start new hand (preserves absent) |
| `resetHand` | Full reset (clears everything) |
| `handleSetMySeat(seat)` | Set my seat position |

---

## STATE MANAGEMENT (useReducer Pattern)

State is managed by three specialized reducers (v106+):

### gameReducer (src/reducers/gameReducer.js)
Game-related state:
```javascript
currentStreet: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
dealerButtonSeat: number  // 1-9
mySeat: number  // 1-9
seatActions: { [street]: { [seat]: ACTIONS.* } }
absentSeats: number[]
```

### uiReducer (src/reducers/uiReducer.js)
UI-related state:
```javascript
currentView: SCREEN.TABLE | SCREEN.STATS
selectedPlayers: number[]
contextMenu: { x, y, seat } | null
isDraggingDealer: boolean
holeCardsVisible: boolean
showCardSelector: boolean
cardSelectorType: 'community' | 'hole'
scale: number  // Dynamic viewport scale (v104)
```

### cardReducer (src/reducers/cardReducer.js)
Card-related state:
```javascript
communityCards: string[]  // Length 5
holeCards: string[]  // Length 2
highlightedBoardIndex: number | null  // 0-4 for community cards
isShowdownViewOpen: boolean
allPlayerCards: { 1: ['',''], ..., 9: ['',''] }
highlightedSeat: number | null  // 1-9
highlightedHoleSlot: 0 | 1 | null
```

### sessionReducer (src/reducers/sessionReducer.js - NEW in v110)
Session-related state:
```javascript
currentSession: {
  sessionId: number | null
  startTime: number | null
  endTime: number | null
  isActive: boolean
  venue: string | null
  gameType: string | null
  buyIn: number | null
  rebuyTransactions: Array<{timestamp: number, amount: number}>
  cashOut: number | null
  reUp: number
  goal: string | null
  notes: string | null
  handCount: number
}
allSessions: Array<Session>  // Cached session list
isLoading: boolean
```

All state updates use dispatch actions (e.g., `dispatchGame`, `dispatchUi`, `dispatchCard`, `dispatchSession`).

---

## ACTION COLOR SCHEME

| Action | Color | Tailwind |
|--------|-------|----------|
| All folds | Red | bg-red-300/400 |
| Limp | Gray | bg-gray-300/400 |
| Call, Check | Blue | bg-blue-200/300 |
| Open, Cbets | Green | bg-green-300/400/500 |
| 3bet, Stab | Yellow | bg-yellow-300/400 |
| 4bet, Donk, Check-Raise | Orange | bg-orange-300/400 |
| Won | Green | bg-green-400 |
| Mucked | Gray | bg-gray-400 |

---

## V104 FEATURES - RESPONSIVE DESIGN & MOBILE OPTIMIZATION

### Dynamic Viewport Scaling
- **Hook**: `useEffect` calculates scale on mount and window resize
- **Formula**: `scale = min(viewportWidth * 0.95 / 1600, viewportHeight * 0.95 / 720, 1.0)`
- **Target Device**: Samsung Galaxy A22 landscape (1600x720)
- **Behavior**: Scales down to fit any browser window, never scales up beyond 1.0

### Card Selector Improvements (v104)
- **Header Changes**:
  - Title shows current street: "Select Cards: Preflop" / "Select Cards: Flop"
  - Board and hole cards moved to header (right side)
  - Vertical separator between board and hole cards
  - "Done" button renamed to "Table View"

- **Card Table Optimization**:
  - Cards maximized: 90px height x 62px width
  - Large text: rank (text-lg), suit (text-3xl)
  - No scrolling required - everything fits in viewport
  - Cell padding reduced to p-1, minimal spacing

### Showdown Improvements (v104)
- **Auto-advance**: Skips already-filled card slots when selecting cards
- **Summary Display**: Shows "show [cards]" for active hands without explicit action
- **Card Table**: Same maximized sizing as regular card selector (90px x 62px)

---

## RENDER ORDER

1. Showdown View (if `isShowdownViewOpen === true`)
2. Card Selector (if `showCardSelector === true`)
3. Table View (if `currentView === SCREEN.TABLE`)
4. Stats View (if `currentView === SCREEN.STATS`)

---

## NEXT HAND vs RESET

### Next Hand
- Clears: All cards, all actions, selections
- Resets: Street to preflop
- **Preserves**: Absent seat markings
- **Advances**: Dealer button

### Reset
- Clears: Everything including absent seats
- Resets: Street to preflop

---

## DEVELOPMENT NOTES

### Debug Mode
Set `DEBUG = false` in `src/PokerTracker.jsx` to disable all console logging.

### Token Efficiency
1. Read THIS spec first (~4k tokens)
2. Read specific files as needed (main file is only ~620 lines now!)
3. Use Edit tool for targeted changes
4. Update CHANGELOG.md after version changes

### Code Organization (v108)
**Modular Architecture:**
- Main file: `src/PokerTracker.jsx` (~620 lines)
- Constants: `src/constants/gameConstants.js` (~57 lines)
- Hooks: `src/hooks/` (7 files, ~584 total lines)
- Reducers: `src/reducers/` (3 files)
- Utils: `src/utils/` (5 files)
- Components: `src/components/` (9 files: 4 views + 5 UI)

**Total reduction from v101:** 2063 → 620 lines main file (70% reduction)

### Adding New Features
- **New action**: Update `gameConstants.js`, then `actionUtils.js`
- **New handler**: Add to appropriate hook or main component
- **New state**: Update appropriate reducer (game/ui/card)
- **New UI component**: Create in `src/components/ui/`
- **New utility**: Add to appropriate file in `src/utils/`

### Version History
- v101-v103: Refactoring and constants extraction
- v104: Mobile optimization and responsive scaling
- v105: Component extraction (views and UI)
- v106: State management with useReducer
- v107: Utils integration and display utilities
- v108: Custom hooks extraction
- v109: Hand history and persistence system
- **v110: Session management system (current)** ✅
