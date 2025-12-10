# TICKET-3.1: Hydration Flow Mapping

**Status:** Complete
**Auditor:** Claude (Core System Audit)
**Date:** 2025-12-09

---

## Executive Summary

Application hydration occurs across three independent paths during startup: hands (game+card+seatPlayers), sessions, and players. Each path initializes its own persistence hook and dispatches HYDRATE actions to reducers. The flows are largely correct but have timing dependencies and missing default merging that could cause issues with partial or outdated data.

---

## Complete Hydration Sequence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION STARTUP                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          React App Mounts                                    │
│                                                                              │
│   PokerTracker.jsx                                                          │
│   ├── useReducer(gameReducer, initialGameState)                             │
│   ├── useReducer(cardReducer, initialCardState)                             │
│   ├── useReducer(sessionReducer, initialSessionState)                       │
│   ├── useReducer(playerReducer, initialPlayerState)                         │
│   ├── useReducer(uiReducer, initialUiState)                                 │
│   │                                                                          │
│   │   [All reducers start with INITIAL state]                               │
│   │                                                                          │
│   ├── usePersistence(...)          ──┐                                      │
│   ├── useSessionPersistence(...)    ─┼─── Three hooks run in PARALLEL       │
│   └── usePlayerPersistence(...)    ──┘                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│  usePersistence  │    │ useSessionPersistence │    │ usePlayerPersistence │
│                  │    │                        │    │                      │
│ 1. initDB()      │    │ 1. getActiveSession()  │    │ 1. getAllPlayers()   │
│ 2. loadLatest    │    │ 2. getSessionById()    │    │ 2. LOAD_PLAYERS      │
│    Hand()        │    │ 3. HYDRATE_SESSION     │    │                      │
│ 3. HYDRATE_STATE │    │                        │    │                      │
│    (game, card)  │    │                        │    │                      │
│ 4. HYDRATE_SEAT  │    │                        │    │                      │
│    _PLAYERS      │    │                        │    │                      │
│ 5. setIsReady()  │    │ 4. setIsReady()        │    │ 3. setIsReady()      │
└─────────────────┘    └──────────────────────┘    └─────────────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ALL HOOKS READY                                     │
│                      (no guaranteed order)                                   │
│                                                                              │
│   UI renders with hydrated state                                            │
│   - May show initial state briefly before hydration completes               │
│   - Each hook sets its own isReady flag                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Hydration Path Details

### Path 1: Hands (usePersistence.js)

**Purpose:** Restore last hand's game state, card state, and seat assignments.

**Sequence:**
```
1. initDB()
   └── Opens PokerTrackerDB, runs migrations if needed

2. loadLatestHand()
   └── Gets most recent hand by timestamp index
   └── Returns: { handId, gameState, cardState, seatPlayers, ... }

3. HYDRATE_STATE (gameReducer)
   └── Merges: { currentStreet, dealerButtonSeat, mySeat, seatActions, absentSeats }
   └── WARNING: Spread merge, missing fields become undefined

4. HYDRATE_STATE (cardReducer)
   └── Explicitly extracts: { communityCards, holeCards, holeCardsVisible, allPlayerCards }
   └── Better: Only sets known fields

5. HYDRATE_SEAT_PLAYERS (playerReducer)
   └── Sets: seatPlayers object
   └── Fallback: {} if missing

6. setIsReady(true)
   └── Enables auto-save
```

**Data Flow:**
```
IndexedDB:hands
    │
    └── loadLatestHand()
            │
            ├── hand.gameState ──► dispatchGame(HYDRATE_STATE)
            │                              │
            │                              └── gameReducer state updated
            │
            ├── hand.cardState ──► dispatchCard(HYDRATE_STATE)
            │                              │
            │                              └── cardReducer state updated
            │
            └── hand.seatPlayers ──► dispatchPlayer(HYDRATE_SEAT_PLAYERS)
                                           │
                                           └── playerReducer.seatPlayers updated
```

---

### Path 2: Sessions (useSessionPersistence.js)

**Purpose:** Restore active poker session if one exists.

**Sequence:**
```
1. getActiveSession()
   └── Reads activeSession store (singleton at key=1)
   └── Returns: { sessionId } or null

2. getSessionById(sessionId) [if active session exists]
   └── Gets full session record from sessions store
   └── Returns: { sessionId, startTime, venue, ... }

3. HYDRATE_SESSION (sessionReducer)
   └── Replaces: currentSession with full session object
   └── WARNING: Full replacement, no default merge

4. setIsReady(true)
   └── Enables session auto-save
```

**Data Flow:**
```
IndexedDB:activeSession
    │
    └── getActiveSession()
            │
            └── { sessionId: 5 }
                    │
                    └── getSessionById(5)
                            │
                            └── Full session record
                                    │
                                    └── dispatchSession(HYDRATE_SESSION)
                                            │
                                            └── sessionReducer.currentSession = record
```

---

### Path 3: Players (usePlayerPersistence.js)

**Purpose:** Load player database for seat assignment features.

**Sequence:**
```
1. getAllPlayers()
   └── Gets all records from players store
   └── Returns: Array of player objects

2. LOAD_PLAYERS (playerReducer)
   └── Replaces: allPlayers array

3. setIsReady(true)
   └── Enables player operations
```

**Data Flow:**
```
IndexedDB:players
    │
    └── getAllPlayers()
            │
            └── [player1, player2, player3, ...]
                    │
                    └── dispatchPlayer(LOAD_PLAYERS)
                            │
                            └── playerReducer.allPlayers = array
```

---

## Timing Analysis

### Parallel Execution

All three hooks run their `useEffect` callbacks in parallel (React does not guarantee order):

```
Time ─────────────────────────────────────────────────────────►

usePersistence:     [initDB]─[loadLatestHand]─[dispatch×3]─[ready]
                         │
useSessionPersist:  ─────[getActiveSession]─[getSessionById]─[dispatch]─[ready]
                              │
usePlayerPersist:   ─────────[getAllPlayers]─[dispatch]─[ready]

Render:             [initial]─────────────────────────────[hydrated]
```

### Potential Issues

| Issue | Scenario | Impact |
|-------|----------|--------|
| Flash of initial state | UI renders before hydration completes | Brief wrong UI |
| Interleaved dispatches | Dispatches from different hooks arrive in any order | None (reducers independent) |
| DB initialization | Multiple `initDB()` calls | OK (opens same connection) |

---

## State Initialization Order

### Before Hydration (Initial State)

```javascript
gameState: {
  currentStreet: 'preflop',
  dealerButtonSeat: 1,
  mySeat: 5,
  seatActions: {},
  absentSeats: []
}

cardState: {
  communityCards: ['', '', '', '', ''],
  holeCards: ['', ''],
  holeCardsVisible: true,
  allPlayerCards: { 1: ['', ''], ..., 9: ['', ''] }
}

sessionState: {
  currentSession: {
    sessionId: null,
    isActive: false,
    handCount: 0,
    ...
  },
  allSessions: [],
  isLoading: false
}

playerState: {
  allPlayers: [],
  seatPlayers: {},
  isLoading: false
}
```

### After Hydration (Example)

```javascript
gameState: {
  currentStreet: 'flop',
  dealerButtonSeat: 7,
  mySeat: 3,
  seatActions: { preflop: { 2: ['fold'] } },
  absentSeats: [9]
}

cardState: {
  communityCards: ['A♠', 'K♥', 'Q♦', '', ''],
  holeCards: ['J♠', 'T♠'],
  holeCardsVisible: true,
  allPlayerCards: { ... }
}

sessionState: {
  currentSession: {
    sessionId: 5,
    isActive: true,
    venue: 'Horseshoe Casino',
    handCount: 47,
    ...
  },
  allSessions: [],  // NOT loaded on startup!
  isLoading: false
}

playerState: {
  allPlayers: [player1, player2, ...],
  seatPlayers: { 1: 12, 3: 5 },  // From last hand
  isLoading: false
}
```

---

## Derived Values Computation

These are computed AFTER hydration, not during:

| Value | Computation | Hook/Context |
|-------|-------------|--------------|
| Small Blind Seat | `(dealer % 9) + 1`, skip absent | GameContext |
| Big Blind Seat | `(SB % 9) + 1`, skip absent | GameContext |
| hasSeatFolded | Check seatActions | GameContext |
| totalInvestment | buyIn + sum(rebuys) | SessionContext |
| getSeatPlayerName | Lookup in allPlayers | PlayerContext |

---

## Error Recovery

### usePersistence Failure

```javascript
} catch (error) {
  logError('Initialization failed:', error);
  isInitializedRef.current = true;
  setIsReady(true);  // Continue with initial state
}
```

**Result:** App starts fresh (no hand restored)

### useSessionPersistence Failure

```javascript
} catch (error) {
  logError('Initialization failed:', error);
  isInitializedRef.current = true;
  setIsReady(true);  // Continue without session
}
```

**Result:** App starts without active session

### usePlayerPersistence Failure

```javascript
} catch (error) {
  logError('Initialization failed:', error);
  setIsReady(true);  // Continue with empty player list
}
```

**Result:** App starts with empty player database

---

## Missing Field Handling

### Game State Hydration

```javascript
case GAME_ACTIONS.HYDRATE_STATE:
  return {
    ...state,
    ...action.payload  // DANGER: Missing fields become undefined
  };
```

**Problem:** If stored hand is missing `absentSeats`, it becomes `undefined` not `[]`.

### Session State Hydration

```javascript
case SESSION_ACTIONS.HYDRATE_SESSION:
  return {
    ...state,
    currentSession: action.payload.session || initialSessionState.currentSession
  };
```

**Problem:** Full replacement. If session missing `handCount`, it's undefined.

### Recommended Fix

```javascript
case GAME_ACTIONS.HYDRATE_STATE:
  return {
    ...initialGameState,  // Defaults first
    ...state,             // Current state
    ...action.payload     // Loaded data overwrites
  };
```

---

## Recommendations

### Critical (P0)

1. **Add default merging to all HYDRATE actions**
   - Ensures missing fields get defaults
   - See "Recommended Fix" above

### High Priority (P1)

2. **Add loading indicators**
   - Show "Loading..." while hooks initialize
   - Prevent flash of initial state

3. **Coordinate hydration completion**
   ```javascript
   const allReady = persistenceReady && sessionReady && playerReady;
   if (!allReady) return <LoadingScreen />;
   ```

### Medium Priority (P2)

4. **Add version checking**
   - Check `hand.version` before hydrating
   - Apply migrations for old format data

5. **Pre-load allSessions on startup**
   - Currently only loaded when SessionsView opened
   - Consider eager loading for faster navigation

---

## Related Documents

- [TICKET-1.3: Read/Hydration Paths](./persistence-read-paths.md)
- [TICKET-3.2: Version Compatibility Matrix](./version-compatibility.md)
- [TICKET-3.3: Edge Case Analysis](./hydration-edge-cases.md)
