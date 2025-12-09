# State Schemas Reference

This document describes the state shape for each reducer in the Poker Tracker application.
All reducers use `createValidatedReducer` to validate state after each action.

---

## Game State (`gameReducer.js`)

Manages poker game state: street, dealer position, actions.

### State Shape

```javascript
{
  currentStreet: 'preflop',      // string: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
  dealerButtonSeat: 1,          // number: 1-9
  mySeat: 5,                    // number: 1-9
  seatActions: {},              // object: { [street]: { [seat]: string[] } }
  absentSeats: []               // number[]: array of seat numbers (1-9)
}
```

### Schema Definition

```javascript
export const GAME_STATE_SCHEMA = {
  currentStreet: { type: 'string', enum: ['preflop', 'flop', 'turn', 'river', 'showdown'] },
  dealerButtonSeat: { type: 'number', min: 1, max: 9 },
  mySeat: { type: 'number', min: 1, max: 9 },
  seatActions: { type: 'object' },
  absentSeats: { type: 'array', items: 'number' }
};
```

### seatActions Structure

Actions are always stored as arrays (normalized on database load):

```javascript
seatActions: {
  preflop: {
    1: ['fold'],
    3: ['call', '3bet'],
    5: ['open']
  },
  flop: {
    3: ['check'],
    5: ['bet']
  }
}
```

### Actions

| Action | Payload | Description |
|--------|---------|-------------|
| `SET_STREET` | `string` | Set current street directly |
| `NEXT_STREET` | - | Advance to next street |
| `SET_DEALER` | `number` | Set dealer button seat |
| `ADVANCE_DEALER` | - | Move dealer to next seat |
| `SET_MY_SEAT` | `number` | Set player's seat position |
| `RECORD_ACTION` | `{ seats: number[], action: string }` | Record action(s) for seat(s) |
| `CLEAR_STREET_ACTIONS` | - | Clear actions for current street |
| `CLEAR_SEAT_ACTIONS` | `number[]` | Clear specific seats' actions |
| `UNDO_LAST_ACTION` | `number` | Remove last action from seat |
| `TOGGLE_ABSENT` | `number[]` | Toggle absent status for seats |
| `RESET_HAND` | - | Reset for new hand (keep dealer) |
| `NEXT_HAND` | - | Reset and advance dealer |
| `HYDRATE_STATE` | `object` | Restore state from saved data |

---

## Card State (`cardReducer.js`)

Manages card data only (view state moved to uiReducer in v114).

### State Shape

```javascript
{
  communityCards: ['', '', '', '', ''],  // string[5]: flop[0-2], turn[3], river[4]
  holeCards: ['', ''],                    // string[2]: player's hole cards
  holeCardsVisible: true,                 // boolean: show/hide hole cards
  allPlayerCards: {                       // object: { [seat]: string[2] }
    1: ['', ''],
    2: ['', ''],
    // ... seats 3-9
  }
}
```

### Schema Definition

```javascript
export const CARD_STATE_SCHEMA = {
  communityCards: { type: 'array', length: 5 },
  holeCards: { type: 'array', length: 2 },
  holeCardsVisible: { type: 'boolean' },
  allPlayerCards: { type: 'object' }
};
```

### Card String Format

Cards use Unicode suit symbols:
- `"A♠"` - Ace of Spades
- `"K♥"` - King of Hearts
- `"Q♦"` - Queen of Diamonds
- `"J♣"` - Jack of Clubs
- `""` - Empty slot

### Actions

| Action | Payload | Description |
|--------|---------|-------------|
| `SET_COMMUNITY_CARD` | `{ index, card }` | Set community card |
| `SET_HOLE_CARD` | `{ index, card }` | Set hole card |
| `CLEAR_COMMUNITY_CARDS` | - | Clear all community cards |
| `CLEAR_HOLE_CARDS` | - | Clear hole cards |
| `TOGGLE_HOLE_VISIBILITY` | - | Toggle hole cards visible |
| `SET_HOLE_VISIBILITY` | `boolean` | Set visibility directly |
| `SET_PLAYER_CARD` | `{ seat, slotIndex, card }` | Set opponent's card |
| `RESET_CARDS` | - | Clear all cards |
| `HYDRATE_STATE` | `object` | Restore state from saved data |

---

## UI State (`uiReducer.js`)

Manages UI state: current view, selections, context menus, and view state (moved from cardReducer in v114).

### State Shape

```javascript
{
  currentView: 'table',         // string: 'table' | 'stats' | 'history' | 'sessions' | 'players'
  selectedPlayers: [],          // number[]: selected seat numbers
  contextMenu: null,            // object | null: { x, y, seat }
  isDraggingDealer: false,      // boolean: dealer button being dragged
  isSidebarCollapsed: false,    // boolean: sidebar collapsed state (v113)
  // View state (moved from cardReducer in v114)
  showCardSelector: false,      // boolean: card selector open
  cardSelectorType: 'community', // string: 'community' | 'hole'
  highlightedBoardIndex: 0,     // number: selected card index (0-4)
  isShowdownViewOpen: false,    // boolean: showdown view open
  highlightedSeat: 1,           // number: selected showdown seat (1-9)
  highlightedHoleSlot: 0        // number: selected card slot (0 or 1)
}
```

### Schema Definition

```javascript
export const UI_STATE_SCHEMA = {
  currentView: { type: 'string' },
  selectedPlayers: { type: 'array', items: 'number' },
  contextMenu: { type: 'object', required: false },
  isDraggingDealer: { type: 'boolean' },
  isSidebarCollapsed: { type: 'boolean' },
  showCardSelector: { type: 'boolean' },
  cardSelectorType: { type: 'string', enum: ['community', 'hole'] },
  highlightedBoardIndex: { type: 'number' },
  isShowdownViewOpen: { type: 'boolean' },
  highlightedSeat: { type: 'number' },
  highlightedHoleSlot: { type: 'number' }
};
```

### Actions

| Action | Payload | Description |
|--------|---------|-------------|
| `SET_SCREEN` | `string` | Change current view |
| `TOGGLE_PLAYER_SELECTION` | `number` | Toggle seat selection |
| `CLEAR_SELECTION` | - | Clear all selections |
| `SET_SELECTION` | `number[]` | Set selection directly |
| `SET_CONTEXT_MENU` | `{ x, y, seat }` | Open context menu |
| `CLOSE_CONTEXT_MENU` | - | Close context menu |
| `START_DRAGGING_DEALER` | - | Begin dealer drag |
| `STOP_DRAGGING_DEALER` | - | End dealer drag |
| `TOGGLE_SIDEBAR` | - | Toggle sidebar collapse |
| `OPEN_CARD_SELECTOR` | `{ type, index }` | Open selector for card |
| `CLOSE_CARD_SELECTOR` | - | Close card selector |
| `SET_CARD_SELECTOR_TYPE` | `string` | Set selector type |
| `SET_HIGHLIGHTED_CARD_INDEX` | `number` | Set highlighted card index |
| `OPEN_SHOWDOWN_VIEW` | - | Open showdown interface |
| `CLOSE_SHOWDOWN_VIEW` | - | Close showdown interface |
| `SET_HIGHLIGHTED_SEAT` | `number` | Select showdown seat |
| `SET_HIGHLIGHTED_HOLE_SLOT` | `number` | Select card slot |

---

## Session State (`sessionReducer.js`)

Manages poker session tracking: buy-ins, rebuys, cash-out.

### State Shape

```javascript
{
  currentSession: {
    sessionId: null,            // number | null: database ID
    startTime: null,            // string | null: ISO timestamp
    endTime: null,              // string | null: ISO timestamp
    isActive: false,            // boolean: session in progress
    venue: null,                // string | null: 'Online', 'Horseshoe Casino', etc.
    gameType: null,             // string | null: 'tournament', '1/2', '1/3', '2/5'
    buyIn: null,                // number | null: initial buy-in
    rebuyTransactions: [],      // { amount, timestamp }[]: rebuy history
    cashOut: null,              // number | null: final cash-out
    reUp: 0,                    // number: re-up count
    goal: null,                 // string | null: session goal
    notes: null,                // string | null: session notes
    handCount: 0                // number: hands played
  },
  allSessions: [],              // session[]: all saved sessions
  isLoading: false              // boolean: loading from database
}
```

### Schema Definition

```javascript
export const SESSION_STATE_SCHEMA = {
  currentSession: { type: 'object' },
  allSessions: { type: 'array' },
  isLoading: { type: 'boolean' }
};
```

### Actions

| Action | Payload | Description |
|--------|---------|-------------|
| `START_SESSION` | `{ sessionId, startTime, venue, ... }` | Start new session |
| `END_SESSION` | `{ endTime, cashOut }` | End current session |
| `UPDATE_SESSION_FIELD` | `{ field, value }` | Update session field |
| `ADD_REBUY` | `{ amount, timestamp }` | Add rebuy transaction |
| `INCREMENT_HAND_COUNT` | - | Increment hands played (called by nextHand) |
| `SET_HAND_COUNT` | `{ count }` | Set hand count directly (for sync/reset) |
| `LOAD_SESSIONS` | `session[]` | Load sessions from DB |
| `SET_LOADING` | `boolean` | Set loading state |
| `HYDRATE_SESSION` | `object` | Restore active session |
| `CLEAR_SESSION` | - | Clear current session |

---

## Player State (`playerReducer.js`)

Manages player profiles and seat assignments.

### State Shape

```javascript
{
  allPlayers: [],               // player[]: all saved players
  seatPlayers: {},              // object: { [seat]: playerId }
  isLoading: false              // boolean: loading from database
}
```

### Player Object Shape

```javascript
{
  playerId: 1,                  // number: database ID
  name: 'John',                 // string: player name
  nickname: 'JD',               // string | null: optional nickname
  ethnicity: 'White',           // string | null: physical description
  build: 'Average',             // string | null: physical description
  gender: 'Male',               // string | null: physical description
  facialHair: 'Clean-shaven',   // string | null: physical description
  hat: false,                   // boolean: wearing hat
  sunglasses: false,            // boolean: wearing sunglasses
  styleTags: [],                // string[]: playing style tags
  notes: '',                    // string: notes about player
  avatar: null,                 // string | null: base64 image data
  handCount: 0,                 // number: hands played against
  stats: {},                    // object: player statistics
  createdAt: '',                // string: ISO timestamp
  lastSeenAt: ''                // string: ISO timestamp
}
```

### Schema Definition

```javascript
export const PLAYER_STATE_SCHEMA = {
  allPlayers: { type: 'array' },
  seatPlayers: { type: 'object' },
  isLoading: { type: 'boolean' }
};
```

### Actions

| Action | Payload | Description |
|--------|---------|-------------|
| `LOAD_PLAYERS` | `{ players: player[] }` | Load players from DB |
| `SET_SEAT_PLAYER` | `{ seat, playerId }` | Assign player to seat |
| `CLEAR_SEAT_PLAYER` | `{ seat }` | Remove player from seat |
| `CLEAR_ALL_SEAT_PLAYERS` | - | Clear all assignments |
| `SET_LOADING` | `boolean` | Set loading state |
| `HYDRATE_PLAYERS` | `object` | Restore seat assignments |

---

## Validation Rules (`reducerUtils.js`)

Common reusable schema rules:

```javascript
export const SCHEMA_RULES = {
  seat: { type: 'number', min: 1, max: 9 },
  seatArray: { type: 'array', items: 'number' },
  street: { type: 'string', enum: ['preflop', 'flop', 'turn', 'river', 'showdown'] },
  boolean: { type: 'boolean' },
  optionalString: { type: 'string', required: false },
  optionalNumber: { type: 'number', required: false },
  object: { type: 'object' },
  array: { type: 'array' }
};
```

---

## Database Schema (`persistence.js`)

IndexedDB stores persistent data across sessions.

### Database: `PokerTrackerDB` (version 5)

### Object Stores

**`hands`** - Saved poker hands
- keyPath: `handId` (autoIncrement)
- Indexes: `timestamp`, `sessionId`
- Fields:
  - `gameState`: game reducer state snapshot
  - `cardState`: card reducer state snapshot
  - `seatPlayers`: seat-to-playerId mapping
  - `timestamp`: Unix timestamp (ms)
  - `sessionId`: linked session ID (null if no session)
  - `sessionHandNumber`: 1-based position within session (null if no session)
  - `handDisplayId`: searchable ID format "S{sessionId}-H{num}" or "H{timestamp}"
  - `version`: record version (currently "1.2.0")

**`sessions`** - Poker sessions
- keyPath: `sessionId` (autoIncrement)
- Indexes: `startTime`, `endTime`, `isActive`
- Fields: venue, gameType, buyIn, rebuyTransactions, cashOut, etc.

**`activeSession`** - Current active session
- keyPath: `id`
- Single-record store

**`players`** - Player profiles
- keyPath: `playerId` (autoIncrement)
- Indexes: `name`, `createdAt`, `lastSeenAt`
- Fields: name, physical descriptions, styleTags, notes, avatar, stats
