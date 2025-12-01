# Poker Tracker Specification - v103

## Version: v103 (Refactoring Complete)
## Last Updated: 2024-12-01
## File: poker_tracker_wireframes_v103.tsx
## Lines: 1958

---

## QUICK REFERENCE

### Current Features
1. **Table View**: 9-seat poker table with auto-selection workflow
2. **Card Selector**: Full-screen card assignment for board and hole cards
3. **Showdown View**: Card assignment + hand history summary for all 9 players
4. **Stats View**: Player statistics display (placeholder)

### Key Variable Names (v103 naming)
| Variable | Purpose |
|----------|---------|
| `currentView` | Which view is shown: `SCREEN.TABLE` or `SCREEN.STATS` |
| `isShowdownViewOpen` | Boolean for showdown card assignment view |
| `dealerButtonSeat` | Which seat (1-9) has the dealer button |
| `highlightedBoardIndex` | Which community card slot (0-4) is selected |
| `highlightedHoleSlot` | Which hole card slot (0-1) is selected |
| `highlightedSeat` | Which seat (1-9) is selected in showdown view |

---

## CODE ORGANIZATION (Lines)

```
1-10:       Imports + Debug setup (DEBUG flag, log helper)
11-107:     Constants (CONSTANTS, ACTIONS, SEAT_ARRAY, etc.)
109-242:    Helper Functions (11 pure functions)
244-408:    Extracted UI Components (4 components)
410+:       Main Component (PokerTrackerWireframes)
```

---

## CONSTANTS (Lines 11-107)

```javascript
// Debug
DEBUG = true
log = (...args) => DEBUG && console.log('[PokerTracker]', ...args)

CONSTANTS = {
  NUM_SEATS: 9,
  CARD: {
    SMALL: { width: 40, height: 58 },    // Hole cards on table
    MEDIUM: { width: 50, height: 70 },   // Showdown card slots
    LARGE: { width: 60, height: 85 },    // Card selector slots
    TABLE: { width: 70, height: 100 },   // Community cards on table
  },
  BADGE_SIZE: 24,
  SEAT_SIZE: 60,
  DEALER_BUTTON_SIZE: 45,
  TOGGLE_BUTTON_SIZE: 40,
  TABLE_WIDTH: 1600,
  TABLE_HEIGHT: 720,
  TABLE_SCALE: 0.5,
  FELT_WIDTH: 900,
  FELT_HEIGHT: 450,
}

SEAT_POSITIONS = [{ seat: 1-9, x: %, y: % }]  // 9 positions
SEAT_ARRAY = [1, 2, 3, 4, 5, 6, 7, 8, 9]      // For iteration

STREETS = ['preflop', 'flop', 'turn', 'river', 'showdown']
BETTING_STREETS = ['preflop', 'flop', 'turn', 'river']  // Excludes showdown

SCREEN = { TABLE: 'table', STATS: 'stats' }

SUITS = ['♠', '♥', '♦', '♣']
RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
SUIT_ABBREV = { '♥': 'h', '♦': 'd', '♣': 'c', '♠': 's' }

ACTIONS = {
  FOLD, LIMP, CALL, OPEN, THREE_BET, FOUR_BET,
  CBET_IP_SMALL, CBET_IP_LARGE, CBET_OOP_SMALL, CBET_OOP_LARGE,
  CHECK, FOLD_TO_CR, DONK, STAB, CHECK_RAISE, FOLD_TO_CBET,
  MUCKED, WON
}

FOLD_ACTIONS = [ACTIONS.FOLD, ACTIONS.FOLD_TO_CR, ACTIONS.FOLD_TO_CBET]
SEAT_STATUS = { FOLDED: 'folded', ABSENT: 'absent' }
```

---

## HELPER FUNCTIONS (Lines 109-242)

### Pure Functions (Outside Component)
| Function | Purpose |
|----------|---------|
| `isFoldAction(action)` | Returns true if action is any fold type |
| `isRedCard(card)` | Returns true if card is hearts/diamonds |
| `isRedSuit(suit)` | Returns true if suit is ♥ or ♦ |
| `createEmptyPlayerCards()` | Returns `{ 1: ['',''], 2: ['',''], ... 9: ['',''] }` |
| `getCardAbbreviation(card)` | "A♥" → "Ah" |
| `getHandAbbreviation(cards)` | ["A♥", "T♦"] → "AhTd" |
| `getActionDisplayName(action)` | ACTIONS.FOLD → 'fold' |
| `getActionColor(action)` | Returns Tailwind classes for showdown summary |
| `getSeatActionStyle(action)` | Returns `{bg, ring}` for table seat styling |
| `getOverlayStatus(inactive, mucked, won)` | Determines DiagonalOverlay status |
| `log(...args)` | Debug logging with [PokerTracker] prefix |

---

## EXTRACTED UI COMPONENTS (Lines 244-408)

### BADGE_CONFIG
```javascript
BADGE_CONFIG = {
  dealer: { bg: 'bg-white', border: 'border-gray-800', text: 'text-black', label: 'D' },
  sb: { bg: 'bg-blue-400', border: 'border-blue-600', text: 'text-white', label: 'SB' },
  bb: { bg: 'bg-red-400', border: 'border-red-600', text: 'text-white', label: 'BB' },
  me: { bg: 'bg-purple-500', border: 'border-purple-700', text: 'text-white', label: 'ME' },
}
```

### PositionBadge - 11 uses
```jsx
<PositionBadge
  type="dealer|sb|bb|me"     // Required: which badge type
  size="small|large"          // Optional: 24px or 45px (default: small)
  draggable={boolean}         // Optional: enable drag (default: false)
  onDragStart={function}      // Optional: drag handler
/>
```

### VisibilityToggle - 4 uses
```jsx
<VisibilityToggle
  visible={boolean}           // Required: current visibility state
  onToggle={function}         // Required: toggle handler
  size="small|large"          // Optional: 24px or 40px (default: small)
/>
```

### DiagonalOverlay - 2 uses
```jsx
<DiagonalOverlay
  status={SEAT_STATUS.FOLDED|SEAT_STATUS.ABSENT|'mucked'|'won'|null}
/>
```

### CardSlot - 23 uses
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

---

## EVENT HANDLERS (Inside Component)

### Extracted Handlers
| Handler | Purpose |
|---------|---------|
| `handleNextHandFromShowdown` | Close showdown + advance to next hand |
| `handleClearShowdownCards` | Clear all player cards in showdown view |
| `handleCloseShowdown` | Close showdown view |
| `handleCloseCardSelector` | Close card selector |
| `handleMuckSeat(seat)` | Mark seat as mucked + advance |
| `handleWonSeat(seat)` | Mark seat as winner + advance |
| `handleSetMySeat(seat)` | Set my seat position |
| `advanceToNextActiveSeat(fromSeat)` | Helper: advance to next active seat |

### Other Key Handlers
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

---

## STATE VARIABLES

```javascript
currentView: SCREEN.TABLE | SCREEN.STATS
selectedPlayers: number[]
currentStreet: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
mySeat: number  // 1-9
dealerButtonSeat: number  // 1-9
holeCardsVisible: boolean
isDraggingDealer: boolean
seatActions: { [street]: { [seat]: ACTIONS.* } }
contextMenu: { x, y, seat } | null
absentSeats: number[]
communityCards: string[]  // Length 5
holeCards: string[]  // Length 2
showCardSelector: boolean
cardSelectorType: 'community' | 'hole'
highlightedBoardIndex: number | null  // 0-4 for community cards
isShowdownViewOpen: boolean
allPlayerCards: { 1: ['',''], ..., 9: ['',''] }
highlightedSeat: number | null  // 1-9
highlightedHoleSlot: 0 | 1 | null
```

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
Set `DEBUG = false` at line 8 to disable all console logging.

### Token Efficiency
1. Read THIS spec first (~3k tokens)
2. Only read .tsx if making code changes (~50k tokens)
3. Use str_replace for changes < 100 lines
4. Update CHANGELOG after every change

### Code Organization
- Single file: poker_tracker_wireframes_v103.tsx
- ~1958 lines (down from 2228 in v102)
- All refactoring complete ✅
