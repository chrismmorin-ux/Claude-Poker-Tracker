# TICKET-2.1: gameReducer State Machine

**Status:** Complete
**Auditor:** Claude (Core System Audit)
**Date:** 2025-12-09

---

## Executive Summary

The gameReducer manages core poker game state including street progression, dealer position, and player actions. The state machine is well-designed with clear transitions, but lacks guards against invalid state combinations and has implicit invariants that are not enforced at the reducer level.

---

## State Shape

```typescript
interface GameState {
  currentStreet: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  dealerButtonSeat: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  mySeat: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  seatActions: {
    [street: string]: {
      [seat: string]: string[]  // Array of action names
    }
  };
  absentSeats: number[];  // Seats 1-9 that are absent
}
```

### Initial State

```javascript
{
  currentStreet: 'preflop',
  dealerButtonSeat: 1,
  mySeat: 5,
  seatActions: {},
  absentSeats: [],
}
```

---

## Action Types

| Action | Payload | Purpose |
|--------|---------|---------|
| `SET_STREET` | `string` | Jump to specific street |
| `NEXT_STREET` | none | Advance to next street in order |
| `SET_DEALER` | `number` | Set dealer button position |
| `ADVANCE_DEALER` | none | Move dealer to next seat |
| `SET_MY_SEAT` | `number` | Set user's seat position |
| `RECORD_ACTION` | `{seats: number[], action: string}` | Record action for seats |
| `CLEAR_STREET_ACTIONS` | none | Clear actions for current street |
| `CLEAR_SEAT_ACTIONS` | `number[]` | Clear specific seats' actions |
| `UNDO_LAST_ACTION` | `number` | Remove last action from seat |
| `TOGGLE_ABSENT` | `number[]` | Toggle absent status for seats |
| `RESET_HAND` | none | Reset to preflop, clear actions |
| `NEXT_HAND` | none | Advance dealer, reset to preflop |
| `HYDRATE_STATE` | `object` | Restore from persistence |

---

## State Transitions

### Street Progression

```
PREFLOP ─── NEXT_STREET ──→ FLOP ─── NEXT_STREET ──→ TURN
                                                        │
                                                   NEXT_STREET
                                                        │
                                                        ▼
                                     SHOWDOWN ←── NEXT_STREET ─── RIVER
```

**Implementation (lines 69-78):**
```javascript
case GAME_ACTIONS.NEXT_STREET: {
  const STREET_ORDER = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  const currentIndex = STREET_ORDER.indexOf(state.currentStreet);
  const nextStreet = currentIndex < STREET_ORDER.length - 1
    ? STREET_ORDER[currentIndex + 1]
    : state.currentStreet;  // Stay at showdown
  return { ...state, currentStreet: nextStreet };
}
```

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| G-1 | Low | `NEXT_STREET` at showdown is no-op (intentional but undocumented) |
| G-2 | Info | `SET_STREET` allows jumping backwards (no validation) |

---

### Dealer Progression

```
Seat 1 ──→ Seat 2 ──→ ... ──→ Seat 9 ──→ Seat 1 (wrap)
```

**Implementation (lines 86-90):**
```javascript
case GAME_ACTIONS.ADVANCE_DEALER:
  return {
    ...state,
    dealerButtonSeat: (state.dealerButtonSeat % NUM_SEATS) + 1,
  };
```

**Note:** Uses `LIMITS.NUM_SEATS` (9) for wrapping, not hardcoded.

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| G-3 | Low | Dealer advancement doesn't skip absent seats |

---

### Action Recording

```
RECORD_ACTION for seat N on street S:
  1. Create street entry if missing
  2. Get existing actions array (or [])
  3. Append new action
  4. Remove seat from absentSeats (if present)
```

**Implementation (lines 98-126):**
```javascript
case GAME_ACTIONS.RECORD_ACTION: {
  const { seats, action: playerAction } = action.payload;
  const newSeatActions = { ...state.seatActions };

  if (!newSeatActions[state.currentStreet]) {
    newSeatActions[state.currentStreet] = {};
  }

  seats.forEach(seat => {
    const currentActions = newSeatActions[state.currentStreet][seat] || [];
    newSeatActions[state.currentStreet] = {
      ...newSeatActions[state.currentStreet],
      [seat]: [...currentActions, playerAction]
    };
  });

  // Remove from absent
  const newAbsentSeats = state.absentSeats.filter(s => !seats.includes(s));

  return { ...state, seatActions: newSeatActions, absentSeats: newAbsentSeats };
}
```

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| G-4 | Medium | **No action validation** - Any string accepted as action |
| G-5 | Medium | **No seat validation** - Seat 0 or 10 would be stored |
| G-6 | Low | Recording action removes from absent (side effect) |

---

### Hand Lifecycle

```
                    ┌─────── RESET_HAND ───────┐
                    │                           │
                    ▼                           │
[Initial] ──→ PLAYING ←─── NEXT_HAND ──────────┤
                │                               │
                └─── (complete hand) ───────────┘
```

**RESET_HAND (lines 204-210):**
```javascript
case GAME_ACTIONS.RESET_HAND:
  return {
    ...state,
    currentStreet: 'preflop',
    seatActions: {},
    absentSeats: [],  // Clears absent
  };
```

**NEXT_HAND (lines 212-219):**
```javascript
case GAME_ACTIONS.NEXT_HAND:
  return {
    ...state,
    currentStreet: 'preflop',
    dealerButtonSeat: (state.dealerButtonSeat % NUM_SEATS) + 1,
    seatActions: {},
    // absentSeats preserved!
  };
```

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| G-7 | Info | `RESET_HAND` clears absent but `NEXT_HAND` preserves them (intentional) |

---

## State Invariants

### Expected Invariants

| Invariant | Description | Enforced? |
|-----------|-------------|-----------|
| I1 | `currentStreet` is valid street name | Schema validation only |
| I2 | `dealerButtonSeat` is 1-9 | Schema validation only |
| I3 | `mySeat` is 1-9 | Schema validation only |
| I4 | `absentSeats` contains only valid seats (1-9) | **Not enforced** |
| I5 | `absentSeats` has no duplicates | **Not enforced** |
| I6 | `seatActions` keys are valid streets | **Not enforced** |
| I7 | `seatActions[street]` keys are valid seats | **Not enforced** |
| I8 | `seatActions` values are valid actions | **Not enforced** |

### Schema Validation (lines 48-54)

```javascript
export const GAME_STATE_SCHEMA = {
  currentStreet: SCHEMA_RULES.street,  // enum validation
  dealerButtonSeat: SCHEMA_RULES.seat,  // 1-9
  mySeat: SCHEMA_RULES.seat,  // 1-9
  seatActions: SCHEMA_RULES.object,  // just type: object
  absentSeats: SCHEMA_RULES.seatArray,  // array of numbers (not validated 1-9)
};
```

**Gap:** Schema validates top-level types but not nested structure integrity.

---

## Illegal State Analysis

### Theoretically Possible Illegal States

| State | How It Could Happen | Impact |
|-------|---------------------|--------|
| `dealerButtonSeat: 0` | `SET_DEALER` with 0 | Blind calculation breaks |
| `dealerButtonSeat: 10` | `SET_DEALER` with 10 | Blind calculation breaks |
| `absentSeats: [1, 1]` | Double toggle race? | Minor UI glitch |
| `seatActions.preflop.10` | `RECORD_ACTION` seat:10 | Data stored but ignored |
| `currentStreet: 'invalid'` | `SET_STREET` invalid | UI crash |

### Protection Mechanisms

1. **Schema validation** (DEBUG mode only) - Catches type violations
2. **Reducer returns previous state on error** - Prevents state corruption
3. **LIMITS.NUM_SEATS constant** - Centralizes seat count

---

## State Transition Matrix

| Current State | Action | Valid? | Next State |
|---------------|--------|--------|------------|
| Any street | `SET_STREET` | Yes | Target street |
| preflop-river | `NEXT_STREET` | Yes | Next street |
| showdown | `NEXT_STREET` | Yes | showdown (no-op) |
| Any | `SET_DEALER` | Yes | New dealer |
| Any | `ADVANCE_DEALER` | Yes | Next seat |
| Any | `RECORD_ACTION` | Yes* | +action |
| Any | `TOGGLE_ABSENT` | Yes | Toggle seats |
| Any | `RESET_HAND` | Yes | Initial (no dealer change) |
| Any | `NEXT_HAND` | Yes | Initial + advance dealer |
| Any | `HYDRATE_STATE` | Yes | Merged state |

*RECORD_ACTION accepts any payload - validation gap

---

## Undo Mechanism

**UNDO_LAST_ACTION (lines 156-184):**

```javascript
case GAME_ACTIONS.UNDO_LAST_ACTION: {
  const seat = action.payload;
  const currentActions = [...(state.seatActions[state.currentStreet]?.[seat] || [])];

  if (currentActions.length === 0) {
    return state; // Nothing to undo
  }

  currentActions.pop();
  // ... update state
}
```

**Behavior:**
- Only undoes actions on CURRENT street
- Removes most recent action only
- Returns unchanged state if no actions to undo

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| G-8 | Low | Cannot undo actions from previous streets |
| G-9 | Low | `UNDO_LAST_ACTION` doesn't restore absent status |

---

## Recommendations

### High Priority (P1)

1. **G-4/G-5: Add payload validation**
   ```javascript
   case GAME_ACTIONS.RECORD_ACTION: {
     const { seats, action: playerAction } = action.payload;

     // Validate seats
     const validSeats = seats.filter(s => s >= 1 && s <= NUM_SEATS);
     if (validSeats.length === 0) return state;

     // Validate action
     if (!Object.values(ACTIONS).includes(playerAction)) {
       console.warn('Invalid action:', playerAction);
       return state;
     }
     // ... continue
   }
   ```

2. **Add invariant checks**
   - Validate `absentSeats` uniqueness after `TOGGLE_ABSENT`
   - Validate seat bounds in all seat-related actions

### Medium Priority (P2)

3. **G-3: Consider dealer skip logic**
   - Optionally skip absent seats when advancing dealer
   - Or document that dealer can land on absent seat

4. **Document intentional behaviors**
   - `NEXT_STREET` at showdown is no-op
   - `RESET_HAND` vs `NEXT_HAND` differences
   - Action recording removes from absent

---

## Derived State (Computed Outside Reducer)

| Value | Computation | Location |
|-------|-------------|----------|
| Small Blind Seat | `(dealer % 9) + 1`, skip absent | `useSeatUtils.js` |
| Big Blind Seat | `(SB % 9) + 1`, skip absent | `useSeatUtils.js` |
| Has Seat Folded | Check seatActions for fold | `useSeatUtils.js` |
| First Action Seat | UTG calculation | `useSeatUtils.js` |

These computations rely on reducer invariants being maintained.

---

## Related Documents

- [TICKET-2.2: sessionReducer State Machine](./state-machine-session.md)
- [TICKET-2.3: cardReducer State Machine](./state-machine-card.md)
- [TICKET-2.4: Cross-Reducer Dependencies](./cross-reducer-analysis.md)
