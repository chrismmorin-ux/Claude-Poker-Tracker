# State Schema Reference
**Version**: 1.2.0 | **Updated**: 2026-03-23

Eight reducers manage application state. All use validated reducers.
Use contexts for cross-component access: useGame(), useUI(), useSession(), usePlayer(), useSettings(), useAuth(), useTournament().

## gameReducer
```js
{ currentStreet: 'preflop',     // 'preflop'|'flop'|'turn'|'river'|'showdown'
  dealerButtonSeat: 1,          // 1-9
  mySeat: 5,                    // 1-9
  actionSequence: [             // single source of truth for ALL actions (betting + showdown)
    { seat: 5, action: 'raise', street: 'preflop', order: 1 },
    { seat: 3, action: 'mucked', street: 'showdown', order: 5 }
  ],
  absentSeats: [] }             // [1-9]
// No seatActions or showdownActions — actionSequence is the sole format
// Query helpers: getActionsForSeatOnStreet(), hasSeatFolded(), hasShowdownAction() in sequenceUtils.js
```

## cardReducer
```js
{ communityCards: ['','','','',''],  // [flop0,flop1,flop2,turn,river]
  holeCards: ['',''],                // player's 2 cards
  holeCardsVisible: true,
  allPlayerCards: { [seat]: ['',''] } }  // opponent cards
```

## uiReducer (v114: includes view state)
```js
{ currentView: 'table',         // 'table'|'stats'|'history'|'sessions'|'players'|'settings'|'login'|'signup'|'password_reset'
  selectedPlayers: [],          // seat numbers
  contextMenu: null,            // {x,y,seat} or null
  isSidebarCollapsed: false,
  showCardSelector: false,      // card picker open
  isShowdownViewOpen: false,
  highlightedSeat: 1,           // 1-9 for showdown
  highlightedHoleSlot: 0 }      // 0|1
```

## sessionReducer
```js
{ currentSession: { sessionId, startTime, venue, gameType, buyIn,
                    rebuyTransactions: [{amount,timestamp}], cashOut, handCount },
  allSessions: [],
  isLoading: false }
```

## playerReducer
```js
{ allPlayers: [{ playerId, name, ethnicity, build, styleTags, notes, avatar }],
  seatPlayers: { [seat]: playerId },  // ephemeral assignments
  isLoading: false }
```

## settingsReducer
```js
{ settings: { theme, cardSize, defaultVenue, defaultGameType,
              customVenues, customGameTypes },
  isLoading: false,
  isInitialized: false }
```

## authReducer
```js
{ user: null,          // { uid, email, displayName, photoURL, providerData } or null
  isLoading: true,     // true during auth operations
  isInitialized: false // false until first auth state check completes
}
```

## tournamentReducer
```js
{ config: {
    format: 'freezeout',       // 'freezeout'|'rebuy'|'turbo'
    startingStack: 10000,
    entryFee: 0,
    totalEntrants: null,
    payoutSlots: null,
    blindSchedule: [],         // [{sb, bb, ante, durationMinutes}]
    handPaceSeconds: 30,
    lockoutLevel: null,
  },
  currentLevelIndex: 0,
  levelStartTime: null,
  isPaused: false,
  pauseStartTime: null,
  totalPausedMs: 0,
  chipStacks: {},              // { [seat]: stackAmount }
  playersRemaining: null,
  eliminations: [],            // [{seat, level, timestamp}]
  isActive: false }
```

## Where to Look
- Full schemas with actions: `docs/STATE_SCHEMAS.md`
- Reducer files: `src/reducers/*.js`
- Context files: `src/contexts/*.jsx`
