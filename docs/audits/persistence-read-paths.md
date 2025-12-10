# TICKET-1.3: Read/Hydration Paths

**Status:** Complete
**Auditor:** Claude (Core System Audit)
**Date:** 2025-12-09

---

## Executive Summary

The application has three distinct hydration paths for hands, sessions, and players. Each path follows a similar pattern: load from IndexedDB, dispatch HYDRATE action to reducer, merge with initial state. The hydration logic is generally sound but has gaps in partial state handling, version compatibility, and error recovery.

---

## Hydration Sequence Overview

### Application Startup Flow

```
App Mount
    │
    ├── usePersistence.useEffect (hands + cards + seatPlayers)
    │   ├── initDB()
    │   ├── loadLatestHand()
    │   ├── dispatchGame(HYDRATE_STATE)
    │   ├── dispatchCard(HYDRATE_STATE)
    │   └── dispatchPlayer(HYDRATE_SEAT_PLAYERS)
    │
    ├── useSessionPersistence.useEffect (sessions)
    │   ├── getActiveSession()
    │   ├── getSessionById()
    │   └── dispatchSession(HYDRATE_SESSION)
    │
    └── usePlayerPersistence.useEffect (players)
        ├── getAllPlayers()
        └── dispatchPlayer(LOAD_PLAYERS)
```

**Order:** All three hooks run in parallel on mount (React useEffect). No guaranteed order.

---

## Hydration Path 1: Hands (usePersistence.js)

### Source Files
- Hook: `src/hooks/usePersistence.js:59-121`
- Storage: `src/utils/persistence/handsStorage.js:101-139`
- Reducers: `gameReducer.js`, `cardReducer.js`, `playerReducer.js`

### Flow

```javascript
// 1. Load latest hand from DB
const latestHand = await loadLatestHand();

// 2. Hydrate game state (if present)
if (latestHand.gameState) {
  dispatchGame({
    type: GAME_ACTIONS.HYDRATE_STATE,
    payload: latestHand.gameState
  });
}

// 3. Hydrate card state (if present)
if (latestHand.cardState) {
  dispatchCard({
    type: CARD_ACTIONS.HYDRATE_STATE,
    payload: {
      communityCards: latestHand.cardState.communityCards,
      holeCards: latestHand.cardState.holeCards,
      holeCardsVisible: latestHand.cardState.holeCardsVisible,
      allPlayerCards: latestHand.cardState.allPlayerCards
    }
  });
}

// 4. Hydrate seat players (if present)
if (latestHand.seatPlayers && dispatchPlayer) {
  dispatchPlayer({
    type: PLAYER_ACTIONS.HYDRATE_SEAT_PLAYERS,
    payload: { seatPlayers: latestHand.seatPlayers }
  });
}
```

### Reducer Handling

**gameReducer.js:221-225:**
```javascript
case GAME_ACTIONS.HYDRATE_STATE:
  return {
    ...state,
    ...action.payload  // Merge loaded state
  };
```

**cardReducer.js:132-136:**
```javascript
case CARD_ACTIONS.HYDRATE_STATE:
  return {
    ...state,
    ...action.payload  // Merge loaded card state (persistent fields only)
  };
```

**playerReducer.js:85-89:**
```javascript
case PLAYER_ACTIONS.HYDRATE_SEAT_PLAYERS:
  return {
    ...state,
    seatPlayers: action.payload.seatPlayers || {}
  };
```

### Data Transformations

| Source Field | Transformation | Target Field |
|--------------|----------------|--------------|
| `hand.gameState.seatActions` | normalizeSeatActions() (on read) | gameState.seatActions |
| `hand.seatPlayers` | None (pass-through) | playerState.seatPlayers |
| `hand.cardState.*` | None (explicit field extraction) | cardState.* |

### Findings

| ID | Severity | Issue |
|----|----------|-------|
| R-1 | Medium | **Partial state not handled** - If `latestHand.gameState` missing a field, it gets `undefined` |
| R-2 | Medium | **seatActions migration runs on every read** - Performance cost for old data |
| R-3 | Low | Card state extracts specific fields but gameState spreads everything |
| R-4 | Low | `version` field in hand record not checked before hydration |

---

## Hydration Path 2: Sessions (useSessionPersistence.js)

### Source Files
- Hook: `src/hooks/useSessionPersistence.js:61-99`
- Storage: `src/utils/persistence/sessionsStorage.js`
- Reducer: `sessionReducer.js`

### Flow

```javascript
// 1. Load active session pointer
const activeSession = await getActiveSession();

if (activeSession && activeSession.sessionId) {
  // 2. Load full session data
  const sessionData = await getSessionById(activeSession.sessionId);

  if (sessionData) {
    // 3. Hydrate session state
    dispatchSession({
      type: SESSION_ACTIONS.HYDRATE_SESSION,
      payload: { session: sessionData }
    });
  }
}
```

### Reducer Handling

**sessionReducer.js:138-142:**
```javascript
case SESSION_ACTIONS.HYDRATE_SESSION:
  return {
    ...state,
    currentSession: action.payload.session || initialSessionState.currentSession
  };
```

### Data Transformations

| Source Field | Transformation | Target Field |
|--------------|----------------|--------------|
| `session.*` | None (full object replacement) | currentSession.* |

### Findings

| ID | Severity | Issue |
|----|----------|-------|
| R-5 | High | **Full replacement ignores defaults** - If DB session missing a field (e.g., `handCount`), UI gets `undefined` |
| R-6 | Medium | No fallback for missing `activeSession` record (if DB corrupted) |
| R-7 | Low | `isActive` flag in session not verified against `activeSession` pointer |

### Edge Case: Orphaned Active Session

If `activeSession` points to deleted session:

```javascript
const sessionData = await getSessionById(activeSession.sessionId);
// sessionData = null

if (sessionData) { /* won't execute */ }
// Result: No session hydrated, user starts fresh
```

**This is actually safe** - falls back to no session.

---

## Hydration Path 3: Players (usePlayerPersistence.js)

### Source Files
- Hook: `src/hooks/usePlayerPersistence.js:53-78`
- Storage: `src/utils/persistence/playersStorage.js`
- Reducer: `playerReducer.js`

### Flow

```javascript
// 1. Load all players
const players = await getAllPlayers();

// 2. Update state
dispatchPlayer({
  type: PLAYER_ACTIONS.LOAD_PLAYERS,
  payload: { players }
});
```

### Reducer Handling

**playerReducer.js:53-57:**
```javascript
case PLAYER_ACTIONS.LOAD_PLAYERS:
  return {
    ...state,
    allPlayers: action.payload.players
  };
```

### Data Transformations

| Source Field | Transformation | Target Field |
|--------------|----------------|--------------|
| `players[]` | None (array replacement) | allPlayers |

### Findings

| ID | Severity | Issue |
|----|----------|-------|
| R-8 | Low | Players loaded as-is with no schema validation |
| R-9 | Info | Empty array on error is safe default |

---

## State Shape Compatibility

### gameState Hydration

| Expected Field | Type | Default | If Missing |
|----------------|------|---------|------------|
| `currentStreet` | string | `'preflop'` | undefined |
| `dealerButtonSeat` | number | `1` | undefined |
| `mySeat` | number | `5` | undefined |
| `seatActions` | object | `{}` | undefined |
| `absentSeats` | array | `[]` | undefined |

**Risk:** Spread operator (`...action.payload`) will set missing fields to `undefined`, not default.

### cardState Hydration

| Expected Field | Type | Default | If Missing |
|----------------|------|---------|------------|
| `communityCards` | array[5] | `['','','','','']` | undefined |
| `holeCards` | array[2] | `['','']` | undefined |
| `holeCardsVisible` | boolean | `true` | undefined |
| `allPlayerCards` | object | `{1:['',''],...}` | undefined |

**Risk:** Same as gameState - explicit field extraction in hook but no defaults.

### sessionState Hydration

| Expected Field | Type | Default | If Missing |
|----------------|------|---------|------------|
| `sessionId` | number | null | Present or null |
| `startTime` | number | null | Present or null |
| `handCount` | number | 0 | **undefined** |
| `rebuyTransactions` | array | [] | **undefined** |

**Risk:** Full object replacement means schema changes break hydration.

---

## Error Recovery Paths

### Hands Hydration Failure

```javascript
} catch (error) {
  logError('Initialization failed:', error);
  // Continue without persistence
  isInitializedRef.current = true;
  setIsReady(true);
}
```

**Behavior:** App continues with initial state (fresh start)

---

### Session Hydration Failure

```javascript
} catch (error) {
  logError('Initialization failed:', error);
  // Continue without session persistence
  isInitializedRef.current = true;
  setIsReady(true);
}
```

**Behavior:** App continues with no active session

---

### Player Hydration Failure

```javascript
} catch (error) {
  logError('Initialization failed:', error);
  // Continue without player persistence
  setIsReady(true);
}
```

**Behavior:** App continues with empty player list

---

## Derived Values

### Computed on Hydration

| Value | Computation | Location |
|-------|-------------|----------|
| None | - | All state is persisted directly |

### Computed at Runtime (Not Persisted)

| Value | Computation | Location |
|-------|-------------|----------|
| `getSmallBlindSeat()` | From dealerButtonSeat + absentSeats | useSeatUtils.js |
| `getBigBlindSeat()` | From dealerButtonSeat + absentSeats | useSeatUtils.js |
| `hasSeatFolded()` | From seatActions | useSeatUtils.js |
| `totalInvestment` | buyIn + sum(rebuyTransactions) | SessionContext.jsx |

---

## Recommendations

### Critical (P0)

1. **R-5: Add schema defaults for session hydration**
   ```javascript
   case SESSION_ACTIONS.HYDRATE_SESSION:
     return {
       ...state,
       currentSession: {
         ...initialSessionState.currentSession,
         ...action.payload.session
       }
     };
   ```

### High Priority (P1)

2. **R-1: Add schema defaults for gameState hydration**
   ```javascript
   case GAME_ACTIONS.HYDRATE_STATE:
     return {
       ...initialGameState,
       ...state,
       ...action.payload
     };
   ```

3. **R-4: Add version checking for hand records**
   - Check `hand.version` before hydration
   - Apply migrations if needed

### Medium Priority (P2)

4. **R-2: Optimize seatActions migration**
   - Migrate data once on write (during upgrade), not on every read
   - Or cache normalized results

5. **R-3: Standardize hydration approach**
   - Use explicit field extraction everywhere (like cardState), OR
   - Use spread-with-defaults everywhere

---

## Hydration Timing Diagram

```
Time →

usePersistence:     [initDB] ─── [loadLatestHand] ─── [HYDRATE_STATE×3] ─── ready
useSessionPersist:  [getActiveSession] ─── [getSessionById] ─── [HYDRATE_SESSION] ─── ready
usePlayerPersist:   [getAllPlayers] ─── [LOAD_PLAYERS] ─── ready

App renders:        [initial state] ─────────────────────────────────────── [hydrated state]
```

**Note:** All three paths run concurrently. UI may flash initial state briefly.

---

## Related Documents

- [TICKET-1.1: Storage Format Analysis](./persistence-storage-schema.md)
- [TICKET-1.2: Write Semantics Audit](./persistence-write-semantics.md)
- [TICKET-1.4: Migration Correctness](./persistence-migrations.md)
