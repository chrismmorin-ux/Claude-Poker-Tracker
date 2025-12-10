# TICKET-2.3: cardReducer State Machine

**Status:** Complete
**Auditor:** Claude (Core System Audit)
**Date:** 2025-12-09

---

## Executive Summary

The cardReducer manages card state for community cards, hole cards, and showdown player cards. The reducer is well-structured with focused responsibilities (card data only - view state moved to uiReducer in v114). Key concerns include lack of card uniqueness validation and implicit coupling with game state for determining valid card slots.

---

## State Shape

```typescript
interface CardState {
  communityCards: [string, string, string, string, string];  // 5 slots
  holeCards: [string, string];  // 2 slots
  holeCardsVisible: boolean;
  allPlayerCards: {
    [seat: 1-9]: [string, string]  // 2 cards per seat
  };
}
```

### Initial State

```javascript
{
  communityCards: ['', '', '', '', ''],
  holeCards: ['', ''],
  holeCardsVisible: true,
  allPlayerCards: {
    1: ['', ''], 2: ['', ''], 3: ['', ''],
    4: ['', ''], 5: ['', ''], 6: ['', ''],
    7: ['', ''], 8: ['', ''], 9: ['', '']
  }
}
```

**Note:** Empty string `''` represents empty slot. Card format is `{Rank}{Suit}` (e.g., "A♠", "K♥").

---

## Action Types

| Action | Payload | Purpose |
|--------|---------|---------|
| `SET_COMMUNITY_CARD` | `{index: 0-4, card: string}` | Set specific community card |
| `SET_HOLE_CARD` | `{index: 0-1, card: string}` | Set specific hole card |
| `CLEAR_COMMUNITY_CARDS` | none | Reset all community cards |
| `CLEAR_HOLE_CARDS` | none | Reset all hole cards |
| `TOGGLE_HOLE_VISIBILITY` | none | Toggle hole cards visibility |
| `SET_HOLE_VISIBILITY` | `boolean` | Set visibility directly |
| `SET_PLAYER_CARD` | `{seat: 1-9, slotIndex: 0-1, card: string}` | Set showdown card |
| `RESET_CARDS` | none | Reset all cards to initial state |
| `REMOVE_CARD_FROM_ALL` | *not implemented* | (Defined but unused) |
| `HYDRATE_STATE` | `object` | Restore from persistence |

---

## Card State Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     COMMUNITY CARDS                          │
│                                                              │
│    ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐                           │
│    │[0]│ │[1]│ │[2]│ │[3]│ │[4]│                           │
│    └───┘ └───┘ └───┘ └───┘ └───┘                           │
│    FLOP  FLOP  FLOP  TURN  RIVER                           │
│                                                              │
│    SET_COMMUNITY_CARD(index, card)                          │
│    CLEAR_COMMUNITY_CARDS                                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      HOLE CARDS (My Hand)                    │
│                                                              │
│    ┌───┐ ┌───┐     Visibility: ████ / ░░░░                  │
│    │[0]│ │[1]│     TOGGLE_HOLE_VISIBILITY                   │
│    └───┘ └───┘                                              │
│                                                              │
│    SET_HOLE_CARD(index, card)                               │
│    CLEAR_HOLE_CARDS                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  ALL PLAYER CARDS (Showdown)                 │
│                                                              │
│    Seat 1: [_, _]    Seat 4: [_, _]    Seat 7: [_, _]       │
│    Seat 2: [_, _]    Seat 5: [_, _]    Seat 8: [_, _]       │
│    Seat 3: [_, _]    Seat 6: [_, _]    Seat 9: [_, _]       │
│                                                              │
│    SET_PLAYER_CARD(seat, slotIndex, card)                   │
│    RESET_CARDS (clears all)                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## State Transitions

### SET_COMMUNITY_CARD (lines 69-77)

```javascript
case CARD_ACTIONS.SET_COMMUNITY_CARD: {
  const { index, card } = action.payload;
  const newCommunityCards = [...state.communityCards];
  newCommunityCards[index] = card;
  return {
    ...state,
    communityCards: newCommunityCards,
  };
}
```

**Observations:**
- Immutable update (spreads array)
- No index bounds checking
- No card format validation
- No duplicate card checking

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| C-1 | Medium | **No index validation** - `index: 10` would extend array |
| C-2 | Medium | **No card validation** - Invalid cards like "ZZ" accepted |
| C-3 | High | **No duplicate prevention** - Same card can appear multiple times |

---

### SET_HOLE_CARD (lines 79-87)

```javascript
case CARD_ACTIONS.SET_HOLE_CARD: {
  const { index, card } = action.payload;
  const newHoleCards = [...state.holeCards];
  newHoleCards[index] = card;
  return {
    ...state,
    holeCards: newHoleCards,
  };
}
```

**Same issues as SET_COMMUNITY_CARD (C-1, C-2, C-3)**

---

### SET_PLAYER_CARD (lines 113-122)

```javascript
case CARD_ACTIONS.SET_PLAYER_CARD: {
  const { seat, slotIndex, card } = action.payload;
  const newAllPlayerCards = { ...state.allPlayerCards };
  newAllPlayerCards[seat] = [...newAllPlayerCards[seat]];
  newAllPlayerCards[seat][slotIndex] = card;
  return {
    ...state,
    allPlayerCards: newAllPlayerCards,
  };
}
```

**Observations:**
- Properly clones nested structure
- No seat validation (1-9)
- No slotIndex validation (0-1)

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| C-4 | Medium | **No seat validation** - Seat 10 creates new entry |
| C-5 | Low | **No slotIndex validation** - Could set index 2+ |

---

### RESET_CARDS (lines 124-130)

```javascript
case CARD_ACTIONS.RESET_CARDS:
  return {
    ...state,
    communityCards: ['', '', '', '', ''],
    holeCards: ['', ''],
    allPlayerCards: createEmptyPlayerCards(),
  };
```

**Note:** Uses `createEmptyPlayerCards()` helper for consistent initialization.

**Does NOT reset:** `holeCardsVisible` (intentional - user preference)

---

### HYDRATE_STATE (lines 132-136)

```javascript
case CARD_ACTIONS.HYDRATE_STATE:
  return {
    ...state,
    ...action.payload  // Merge loaded card state
  };
```

**Same concern as other reducers:** Missing fields become undefined, not defaults.

---

## Card State Invariants

### Expected Invariants

| Invariant | Description | Enforced? |
|-----------|-------------|-----------|
| I1 | `communityCards` has exactly 5 elements | Schema (length: 5) |
| I2 | `holeCards` has exactly 2 elements | Schema (length: 2) |
| I3 | Cards are valid format or empty | **Not enforced** |
| I4 | No card appears twice across all slots | **Not enforced** |
| I5 | `allPlayerCards` has seats 1-9 | **Not enforced** |
| I6 | Each seat has exactly 2 card slots | **Not enforced** |

### Schema Validation (lines 55-60)

```javascript
export const CARD_STATE_SCHEMA = {
  communityCards: { type: 'array', length: 5 },
  holeCards: { type: 'array', length: 2 },
  holeCardsVisible: { type: 'boolean' },
  allPlayerCards: { type: 'object' },
};
```

**Gap:** Schema validates array lengths but not card format or uniqueness.

---

## Card Uniqueness Problem (C-3)

### Scenario

User could assign same card to multiple locations:

```javascript
// This is technically valid in reducer:
dispatchCard({ type: 'SET_COMMUNITY_CARD', payload: { index: 0, card: 'A♠' } });
dispatchCard({ type: 'SET_HOLE_CARD', payload: { index: 0, card: 'A♠' } });  // Duplicate!
dispatchCard({ type: 'SET_PLAYER_CARD', payload: { seat: 3, slotIndex: 0, card: 'A♠' } });  // Triple!
```

### Current Mitigation

Card uniqueness is enforced in `useCardSelection.js` and `useShowdownCardSelection.js` hooks at assignment time, NOT in reducer.

```javascript
// cardUtils.js - assignCardToSlot
// Removes card from other slots before assigning to target
```

**Risk:** Direct reducer dispatch (bypassing hooks) could create duplicates.

---

## Card Format Validation

### Valid Card Format

```javascript
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
// Valid: "{Rank}{Suit}" or "" (empty)
// Example: "A♠", "K♥", "T♦", ""
```

### Current Validation

None in reducer. UI card selector only allows valid cards.

**Risk:** Corrupted data from DB or bug could introduce invalid cards.

---

## Illegal State Analysis

### Theoretically Possible Illegal States

| State | How It Could Happen | Impact |
|-------|---------------------|--------|
| Duplicate cards | Direct dispatch | Display confusion, invalid hand |
| Invalid card "ZZ" | Direct dispatch or corrupt DB | Display error or crash |
| `communityCards.length !== 5` | Spread bug or corrupt hydrate | Array index errors |
| `allPlayerCards[10]` | Invalid seat in dispatch | Ignored or creates orphan |
| `allPlayerCards[1][5]` | Invalid slot index | Extends array unexpectedly |

### Protection Mechanisms

1. **UI card selector** - Only shows valid unassigned cards
2. **Hook validation** - `useCardSelection` checks before dispatch
3. **Schema validation** - Checks array lengths (DEBUG only)

---

## Street-Based Card Visibility

The reducer does NOT enforce which community card slots are visible per street. This is UI logic:

| Street | Visible Slots | Enforced In |
|--------|---------------|-------------|
| Preflop | None | UI only |
| Flop | 0, 1, 2 | UI only |
| Turn | 0, 1, 2, 3 | UI only |
| River | 0, 1, 2, 3, 4 | UI only |
| Showdown | 0, 1, 2, 3, 4 | UI only |

**Implication:** Reducer allows setting any card at any time; UI controls when user can set them.

---

## Recommendations

### Critical (P0)

1. **C-3: Add duplicate prevention**
   - Option A: Check uniqueness in reducer (expensive)
   - Option B: Add `REMOVE_CARD_FROM_ALL` action and use it before SET_*
   - Option C: Accept current hook-based enforcement (document risk)

### High Priority (P1)

2. **C-1/C-4/C-5: Add bounds validation**
   ```javascript
   case CARD_ACTIONS.SET_COMMUNITY_CARD: {
     const { index, card } = action.payload;
     if (index < 0 || index > 4) return state;  // Guard
     // ...
   }
   ```

3. **C-2: Add card format validation**
   ```javascript
   const isValidCard = (card) => {
     if (card === '') return true;  // Empty is valid
     return RANKS.some(r => SUITS.some(s => card === r + s));
   };
   ```

### Medium Priority (P2)

4. **Hydration defaults**
   ```javascript
   case CARD_ACTIONS.HYDRATE_STATE:
     return {
       ...initialCardState,
       ...state,
       ...action.payload
     };
   ```

5. **Implement REMOVE_CARD_FROM_ALL**
   - Action defined but not implemented
   - Would enable atomic card movement

---

## State Size Analysis

| Field | Size | Notes |
|-------|------|-------|
| `communityCards` | 5 strings | Max ~10 bytes each |
| `holeCards` | 2 strings | Max ~10 bytes each |
| `holeCardsVisible` | 1 boolean | |
| `allPlayerCards` | 18 strings | 9 seats × 2 cards |

**Total:** ~270 bytes max. Very small footprint.

---

## Related Documents

- [TICKET-2.1: gameReducer State Machine](./state-machine-game.md)
- [TICKET-2.2: sessionReducer State Machine](./state-machine-session.md)
- [TICKET-2.4: Cross-Reducer Dependencies](./cross-reducer-analysis.md)
