# State Schema Reference
**Version**: 1.0.6 | **Updated**: 2025-12-09

Five reducers manage application state. All use validated reducers.
Use contexts for cross-component access: useGame(), useUI(), useSession(), usePlayer().

## gameReducer
```js
{ currentStreet: 'preflop',     // 'preflop'|'flop'|'turn'|'river'|'showdown'
  dealerButtonSeat: 1,          // 1-9
  mySeat: 5,                    // 1-9
  seatActions: { [street]: { [seat]: string[] } },  // actions by street/seat
  absentSeats: [] }             // [1-9]
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
{ currentView: 'table',         // 'table'|'stats'|'history'|'sessions'|'players'
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

## Where to Look
- Full schemas with actions: `docs/STATE_SCHEMAS.md`
- Reducer files: `src/reducers/*.js`
- Context files: `src/contexts/*.jsx`
