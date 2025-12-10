# TICKET-2.4: Cross-Reducer Dependencies

**Status:** Complete
**Auditor:** Claude (Core System Audit)
**Date:** 2025-12-09

---

## Executive Summary

The application uses 5 reducers (game, card, session, player, ui) that operate independently but have implicit dependencies through shared concepts (seats, hands, sessions). The main coupling points are: (1) hand persistence combining game+card+player state, (2) session-hand linking, and (3) seat references across reducers. There are no direct reducer-to-reducer dependencies, but coordinating updates requires careful sequencing in calling code.

---

## Reducer Inventory

| Reducer | File | Primary Responsibility |
|---------|------|------------------------|
| gameReducer | gameReducer.js | Street, dealer, actions, absent seats |
| cardReducer | cardReducer.js | Community cards, hole cards, player cards |
| sessionReducer | sessionReducer.js | Session lifecycle, financials |
| playerReducer | playerReducer.js | Player database, seat assignments |
| uiReducer | uiReducer.js | View state, selection, card selector UI |

---

## Dependency Graph

```
                    ┌─────────────┐
                    │  Persistence │
                    │    Layer     │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │gameReducer │  │cardReducer │  │playerReducer│
    │            │  │            │  │  seatPlayers │
    └─────┬──────┘  └─────┬──────┘  └──────┬──────┘
          │               │                │
          └───────────────┼────────────────┘
                          │
                    ┌─────┴─────┐
                    │  saveHand  │
                    │ (combines) │
                    └───────────┘

    ┌────────────┐        ┌────────────┐
    │sessionReducer│◄─────│   saveHand  │ (gets sessionId)
    └──────┬──────┘        └───────────┘
           │
           └────────── handCount increment
```

---

## Shared Concepts

### 1. Seats (1-9)

**Used By:**
- `gameReducer.mySeat` - User's seat position
- `gameReducer.dealerButtonSeat` - Dealer position
- `gameReducer.seatActions[street][seat]` - Actions per seat
- `gameReducer.absentSeats` - Array of absent seats
- `cardReducer.allPlayerCards[seat]` - Showdown cards per seat
- `playerReducer.seatPlayers` - Map of seat → playerId
- `uiReducer.selectedPlayers` - Selected seats for batch action
- `uiReducer.highlightedSeat` - Current showdown focus

**Invariant:** Seat numbers must be 1-9 (from LIMITS.NUM_SEATS)

**Coupling Risk:** If one reducer uses seat 10, others would ignore or error.

---

### 2. Streets

**Used By:**
- `gameReducer.currentStreet` - Current game phase
- `gameReducer.seatActions[street]` - Actions indexed by street

**Read By (not stored):**
- `uiReducer.cardSelectorType` - Determines which cards to show
- Card selection logic - Uses street to auto-advance

**Coupling:** Card selection hooks read `currentStreet` from game state to determine valid card slots.

---

### 3. Hands (Composite Entity)

**Components:**
- `gameReducer` - gameState snapshot
- `cardReducer` - cardState snapshot
- `playerReducer` - seatPlayers snapshot

**Coupling Point:** `usePersistence.js` combines all three for `saveHand()`:

```javascript
const handData = {
  gameState: {
    currentStreet: gameState.currentStreet,
    dealerButtonSeat: gameState.dealerButtonSeat,
    mySeat: gameState.mySeat,
    seatActions: gameState.seatActions,
    absentSeats: gameState.absentSeats
  },
  cardState: {
    communityCards: cardState.communityCards,
    holeCards: cardState.holeCards,
    holeCardsVisible: cardState.holeCardsVisible,
    allPlayerCards: cardState.allPlayerCards
  },
  seatPlayers: playerState.seatPlayers  // Note: top-level, not nested
};
```

**Issue:** `seatPlayers` is at top level, not nested under `playerState`.

---

### 4. Sessions

**Primary Reducer:** sessionReducer

**Referenced By:**
- `saveHand()` - Links hand to active session via `sessionId`
- `handCount` - Computed from hands in session

**Coupling:** Hands have `sessionId` foreign key. No cascade delete.

---

## Cross-Reducer Operations

### Operation 1: Next Hand

**Reducers Involved:** game, card, session, player (indirectly)

**Sequence:**
```javascript
// 1. Reset game state, advance dealer
dispatchGame({ type: GAME_ACTIONS.NEXT_HAND });

// 2. Reset all cards
dispatchCard({ type: CARD_ACTIONS.RESET_CARDS });

// 3. Increment session hand count
dispatchSession({ type: SESSION_ACTIONS.INCREMENT_HAND_COUNT });

// Note: playerReducer.seatPlayers NOT cleared (intentional)
```

**Risk:** If any dispatch fails, state becomes inconsistent.

---

### Operation 2: Reset Hand (Full)

**Reducers Involved:** game, card

**Sequence:**
```javascript
// 1. Reset game state (clears actions, absent, resets street)
dispatchGame({ type: GAME_ACTIONS.RESET_HAND });

// 2. Reset all cards
dispatchCard({ type: CARD_ACTIONS.RESET_CARDS });

// Note: session NOT affected, dealer NOT advanced
```

---

### Operation 3: Start Session

**Reducers Involved:** session (primary), persistence (side effect)

**Sequence:**
```javascript
// 1. Create in DB (async)
const sessionId = await createSession(sessionData);

// 2. Set as active in DB (async)
await setActiveSession(sessionId);

// 3. Update reducer
dispatchSession({ type: SESSION_ACTIONS.START_SESSION, payload: {...} });
```

**Risk:** If step 2 or 3 fails, orphan session in DB.

---

### Operation 4: End Session

**Reducers Involved:** session (primary), persistence (side effect)

**Sequence:**
```javascript
// 1. End in DB (async)
await dbEndSession(sessionId, cashOut);

// 2. Clear active session pointer (async)
await clearActiveSession();

// 3. Update reducer
dispatchSession({ type: SESSION_ACTIONS.END_SESSION, payload: {...} });
```

---

### Operation 5: Showdown Card Selection

**Reducers Involved:** card, ui

**Sequence:**
```javascript
// 1. Set card in allPlayerCards
dispatchCard({ type: CARD_ACTIONS.SET_PLAYER_CARD, payload: {...} });

// 2. Advance highlight to next empty slot
dispatchUi({ type: UI_ACTIONS.ADVANCE_SHOWDOWN_HIGHLIGHT, payload: { allPlayerCards } });
```

**Coupling:** UI needs card state to know which slots are empty.

---

## State Synchronization Issues

### Issue 1: Session Hand Count vs Computed Count

**Sources:**
- `sessionReducer.currentSession.handCount` - Stored in state
- `getSessionHandCount(sessionId)` - Computed from hands table

**Problem:** Two sources of truth can diverge.

**Current Behavior:** `handCount` in session is incremented via reducer. DB hand count is separate.

---

### Issue 2: Active Session Flag vs ActiveSession Store

**Sources:**
- `sessionReducer.currentSession.isActive` - Boolean in state
- `activeSession` store in IndexedDB - Separate singleton

**Problem:** Can be out of sync if one update fails.

---

### Issue 3: seatPlayers Persistence

**Saved:** In hand record as `seatPlayers` (top-level)
**Not Saved:** In session record

**Implication:** Seat assignments persist across hands but are lost when:
- App restarts without saving hand
- Session ends (by design?)

---

## Reducer Independence Analysis

| Reducer | Reads From Other Reducers? | Writes Trigger Other Reducers? |
|---------|----------------------------|-------------------------------|
| game | No | No (hooks may dispatch others) |
| card | No | No (hooks may dispatch ui) |
| session | No | No |
| player | No | No |
| ui | Reads card state via payload* | No |

*`ADVANCE_SHOWDOWN_HIGHLIGHT` receives `allPlayerCards` in payload

---

## Recommendations

### Critical (P0)

1. **Atomic multi-dispatch wrapper**
   ```javascript
   const atomicDispatch = async (dispatches) => {
     try {
       dispatches.forEach(d => d.dispatch(d.action));
     } catch (e) {
       // Rollback or log error
     }
   };
   ```

### High Priority (P1)

2. **Document cross-reducer operations**
   - Create `docs/CROSS_REDUCER_OPS.md`
   - Document sequence for each operation
   - Note failure modes

3. **Consolidate hand count**
   - Remove `handCount` from session state
   - Always compute from hands table

4. **Consolidate active session tracking**
   - Use `activeSession` store as source of truth
   - Remove `isActive` from session records

### Medium Priority (P2)

5. **Add transaction-like semantics**
   - Wrap related dispatches in try-catch
   - Log inconsistent states

6. **Create shared seat validation**
   ```javascript
   // utils/validation.js
   const isValidSeat = (seat) => seat >= 1 && seat <= LIMITS.NUM_SEATS;
   ```

---

## Dependency Matrix

| → Depends On | game | card | session | player | ui |
|--------------|------|------|---------|--------|-----|
| game | - | No | No | No | No |
| card | No | - | No | No | No |
| session | No | No | - | No | No |
| player | No | No | No | - | No |
| ui | No | Yes* | No | No | - |

*UI `ADVANCE_SHOWDOWN_HIGHLIGHT` needs allPlayerCards in payload

---

## Context Providers (v114)

Contexts wrap reducers but don't change dependencies:

| Context | Reducer(s) | Derived Values |
|---------|------------|----------------|
| GameContext | game | SB/BB seat, hasSeatFolded |
| CardContext | card | (none) |
| SessionContext | session | totalInvestment |
| PlayerContext | player | getSeatPlayerName |
| UIContext | ui | (none) |

**Derived values** are computed in context, not stored. They depend on reducer state but don't modify it.

---

## Related Documents

- [TICKET-2.1: gameReducer State Machine](./state-machine-game.md)
- [TICKET-2.2: sessionReducer State Machine](./state-machine-session.md)
- [TICKET-2.3: cardReducer State Machine](./state-machine-card.md)
- [TICKET-3.1: Hydration Flow](./hydration-flow.md)
