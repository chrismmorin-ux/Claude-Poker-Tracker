---
last-verified-against-code: 2026-04-16
verified-by: PEO-1
staleness-threshold-days: 60
---

# State Schema Reference
**Version**: 1.3.0 | **Updated**: 2026-04-16

Eight reducers manage application state. All use validated reducers.
Use contexts for cross-component access: useGame(), useUI(), useSession(), usePlayer(), useSettings(), useAuth(), useTournament().

## gameReducer
```js
{ currentStreet: 'preflop',     // 'preflop'|'flop'|'turn'|'river'|'showdown'
  dealerButtonSeat: 1,          // 1-9
  mySeat: 5,                    // 1-9
  actionSequence: [             // single source of truth for ALL actions (betting + showdown)
    { seat: 5, action: 'raise', street: 'preflop', order: 1 },
    { seat: 7, action: 'raise', street: 'preflop', order: 2, amount: 50, allIn: true },
    { seat: 6, action: 'call', street: 'preflop', order: 3, amount: 30, allIn: true }, // short/capped all-in call
    { seat: 3, action: 'mucked', street: 'showdown', order: 5 },
    { seat: 5, action: 'won', street: 'showdown', order: 6, pot: 0 }   // pot index for multi-pot hands
  ],
  absentSeats: [] }             // [1-9]
// No seatActions or showdownActions — actionSequence is the sole format
// Optional entry fields (all-in / side pots, 2026-06-19):
//   amount        — CALL: increment owed; BET/RAISE/STRADDLE: raise-TO LEVEL (not increment)
//   allIn: true   — seat committed its last chips (bet/raise/call). Detect via isSeatAllIn()/getAllInSeats()
//   reopensAction:false — a sub-min-raise all-in that does NOT reopen betting
//   pot           — side-pot index a showdown 'won' entry refers to (0=main). Set via SET_POT_WINNER
// Query helpers: getActionsForSeatOnStreet(), hasSeatFolded(), hasShowdownAction(),
//   getAllInSeats(), isSeatAllIn(), getPotWinnerSeat() in sequenceUtils.js
// Side pots derived (never stored): calculateSidePots(actionSequence, blinds, {smallBlindSeat, bigBlindSeat}) in potCalculator.js
```

## cardReducer
```js
{ communityCards: ['','','','',''],  // [flop0,flop1,flop2,turn,river]
  holeCards: ['',''],                // player's 2 cards
  holeCardsVisible: true,
  allPlayerCards: { [seat]: ['',''] } }  // opponent cards
```

## uiReducer (v114: includes view state; v1.3.0 adds PEO-1 routes)
```js
{ currentView: 'table',         // includes 'playerEditor' | 'playerPicker' (PEO-1)
  selectedPlayers: [],
  contextMenu: null,
  isSidebarCollapsed: false,
  showCardSelector: false,
  isShowdownViewOpen: false,
  highlightedSeat: 1,
  highlightedHoleSlot: 0,
  // PEO-1 fullscreen player-entry route contexts (null when route closed)
  editorContext: null,          // { mode: 'create'|'edit', playerId?, seatContext?, prevScreen, nameSeed? }
  pickerContext: null }         // { seat, batchMode, assignedSeats, prevScreen }
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
{ allPlayers: [{
    playerId, name, nickname, userId,
    // physical (text dropdowns, legacy):
    ethnicity, build, gender, facialHair, hat, sunglasses,
    // feature-avatar (PEO-1, optional nullable sub-object):
    avatarFeatures: { skin, hair, hairColor, beard, beardColor, eyes, eyeColor, glasses, hat } | null,
    nameSource: 'user' | 'auto' | null,   // PEO-1: tracks origin of name for re-derivation
    avatar,                                // legacy base64 image (secondary per D6)
    styleTags, notes,
    handCount, stats, createdAt, lastSeenAt,
  }],
  seatPlayers: { [seat]: playerId },   // ephemeral per-hand assignments
  isLoading: false }
// PEO-1 actions: RETROACTIVELY_LINK_PLAYER, UNDO_RETROACTIVE_LINK
// (surgical handCount update on a single player after linking completes)
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
    prizePool: null,           // ICM input (POKER_THEORY §10) — total $ prize pool
    payouts: [],               // ICM input — $ ladder, index 0 = 1st place (derivePayouts)
    blindSchedule: [],         // [{sb, bb, ante, durationMinutes}]
    handPaceSeconds: 30,
    lockoutLevel: null,
  },
  // Derived (TournamentContext): icm = { equityBySeat, heroEquity, bubbleFactor,
  // requiredEquity, isApproximate, tooLarge } via src/utils/icmEngine/ (Malmuth-Harville).
  // Null when no payout ladder; falls back to the bubble-distance icmPressure zone.
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
