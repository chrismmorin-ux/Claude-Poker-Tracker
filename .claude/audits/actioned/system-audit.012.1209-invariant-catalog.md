# TICKET-4.1: Invariant Catalog

**Status:** Complete
**Auditor:** Claude (Core System Audit)
**Date:** 2025-12-09

---

## Executive Summary

This document catalogs all runtime invariants that must hold true for the Poker Tracker application to function correctly. Invariants are organized by domain and categorized by enforcement level (enforced, partially enforced, not enforced). This catalog serves as the foundation for a potential validation layer.

---

## Invariant Categories

| Category | Count | Critical | Enforced |
|----------|-------|----------|----------|
| Seat Invariants | 8 | 3 | 2 |
| Card Invariants | 7 | 4 | 0 |
| Action Invariants | 5 | 2 | 1 |
| Session Invariants | 6 | 3 | 0 |
| Player Invariants | 4 | 1 | 1 |
| State Shape Invariants | 6 | 2 | 4 |

---

## 1. Seat Invariants

### SEAT-1: Valid Seat Range
**Statement:** All seat references must be integers 1-9.
**Applies To:** `dealerButtonSeat`, `mySeat`, `absentSeats[]`, `seatActions[street]{}`, `seatPlayers{}`, `selectedPlayers[]`, `allPlayerCards{}`
**Enforced:** Schema validation (DEBUG only) for top-level fields
**Critical:** Yes

```javascript
const isValidSeat = (seat) => Number.isInteger(seat) && seat >= 1 && seat <= 9;
```

### SEAT-2: Unique Absent Seats
**Statement:** `absentSeats` array contains no duplicates.
**Applies To:** `gameReducer.absentSeats`
**Enforced:** Not enforced (toggle could create duplicates via race condition)
**Critical:** No (UI handles gracefully)

```javascript
const hasUniqueSeatArray = (seats) => new Set(seats).size === seats.length;
```

### SEAT-3: mySeat Not Absent
**Statement:** User's seat should not be in `absentSeats`.
**Applies To:** Relationship between `mySeat` and `absentSeats`
**Enforced:** Not enforced (logically impossible in normal use)
**Critical:** No

### SEAT-4: Dealer Not Absent (Optional)
**Statement:** Dealer button should not be on absent seat.
**Applies To:** Relationship between `dealerButtonSeat` and `absentSeats`
**Enforced:** Not enforced (allowed by design - dealer can be absent)
**Critical:** No

### SEAT-5: SB/BB Calculation Valid
**Statement:** Small blind and big blind can be computed from dealer position.
**Applies To:** Derived values in `useSeatUtils`
**Enforced:** Function returns valid seat (wraps, skips absent)
**Critical:** Yes

### SEAT-6: Seat Player Mapping Valid
**Statement:** `seatPlayers` keys are valid seats, values are valid player IDs.
**Applies To:** `playerReducer.seatPlayers`
**Enforced:** Not enforced
**Critical:** No (stale references handled)

### SEAT-7: No Duplicate Player Assignments
**Statement:** Same player cannot be assigned to multiple seats.
**Applies To:** `seatPlayers` values
**Enforced:** Application logic in `usePlayerPersistence`
**Critical:** No (UI would be confusing but not crash)

### SEAT-8: Selected Players Valid
**Statement:** `selectedPlayers` contains only valid seats.
**Applies To:** `uiReducer.selectedPlayers`
**Enforced:** Not enforced
**Critical:** No

---

## 2. Card Invariants

### CARD-1: Valid Card Format
**Statement:** All card strings are valid format or empty.
**Applies To:** `communityCards[]`, `holeCards[]`, `allPlayerCards[][]`
**Enforced:** Not enforced (UI only shows valid cards)
**Critical:** Yes

```javascript
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const isValidCard = (card) => {
  if (card === '') return true;
  return RANKS.some(r => SUITS.some(s => card === r + s));
};
```

### CARD-2: No Duplicate Cards
**Statement:** Each card appears at most once across all slots.
**Applies To:** All card storage locations
**Enforced:** Application logic in card selection hooks
**Critical:** Yes (poker requires unique cards)

```javascript
const getAllCards = (state) => [
  ...state.communityCards.filter(c => c),
  ...state.holeCards.filter(c => c),
  ...Object.values(state.allPlayerCards).flat().filter(c => c)
];
const hasNoDuplicateCards = (state) => {
  const cards = getAllCards(state);
  return new Set(cards).size === cards.length;
};
```

### CARD-3: Community Cards Length
**Statement:** `communityCards` always has exactly 5 elements.
**Applies To:** `cardReducer.communityCards`
**Enforced:** Schema validation (length: 5)
**Critical:** Yes

### CARD-4: Hole Cards Length
**Statement:** `holeCards` always has exactly 2 elements.
**Applies To:** `cardReducer.holeCards`
**Enforced:** Schema validation (length: 2)
**Critical:** Yes

### CARD-5: Player Cards Structure
**Statement:** `allPlayerCards` has seats 1-9, each with 2 slots.
**Applies To:** `cardReducer.allPlayerCards`
**Enforced:** Initialization only (can be corrupted)
**Critical:** Yes

### CARD-6: Cards Fit Street
**Statement:** Community cards should match current street.
**Applies To:** Relationship between `currentStreet` and `communityCards`
**Enforced:** Not enforced (UI guidance only)
**Critical:** No

| Street | Valid Filled Slots |
|--------|-------------------|
| preflop | 0 |
| flop | 0-3 |
| turn | 0-4 |
| river | 0-5 |
| showdown | 0-5 |

### CARD-7: Deck Size Constraint
**Statement:** Total assigned cards cannot exceed 52.
**Applies To:** All card storage
**Enforced:** Not enforced (implicit via no duplicates)
**Critical:** No

---

## 3. Action Invariants

### ACTION-1: Valid Action Type
**Statement:** All recorded actions are from `ACTIONS` constant.
**Applies To:** `seatActions[street][seat][]`
**Enforced:** Not enforced (any string accepted)
**Critical:** Yes

```javascript
const isValidAction = (action) => Object.values(ACTIONS).includes(action);
```

### ACTION-2: Actions Array Format
**Statement:** `seatActions[street][seat]` is always an array.
**Applies To:** `gameReducer.seatActions`
**Enforced:** Migration on read, but new writes are arrays
**Critical:** Yes

### ACTION-3: Valid Street Keys
**Statement:** `seatActions` keys are valid street names.
**Applies To:** `seatActions` object keys
**Enforced:** Not enforced (uses `currentStreet`)
**Critical:** No

### ACTION-4: Folded Seat Has No Post-Fold Actions
**Statement:** After fold, seat should not have more actions.
**Applies To:** Action sequence logic
**Enforced:** Application logic (validation functions)
**Critical:** No (bad data is confusing but not crash)

### ACTION-5: Terminal Actions Are Final
**Statement:** After FOLD, WON, or MUCKED, no more actions.
**Applies To:** Showdown logic
**Enforced:** Application logic
**Critical:** No

---

## 4. Session Invariants

### SESSION-1: At Most One Active Session
**Statement:** Only one session can be active at a time.
**Applies To:** `activeSession` store + `isActive` flag
**Enforced:** Singleton pattern in `activeSession` store
**Critical:** Yes

### SESSION-2: Active Session Has ID
**Statement:** If `isActive: true`, `sessionId` must be set.
**Applies To:** `currentSession`
**Enforced:** Not enforced
**Critical:** Yes

```javascript
const hasValidActiveSession = (session) => {
  if (!session.isActive) return true;
  return session.sessionId !== null && session.startTime !== null;
};
```

### SESSION-3: Ended Session Has EndTime
**Statement:** If `isActive: false` and `sessionId` set, `endTime` should be set.
**Applies To:** `currentSession`
**Enforced:** Not enforced
**Critical:** No

### SESSION-4: Positive Financial Values
**Statement:** `buyIn`, rebuy amounts, `cashOut` should be non-negative.
**Applies To:** `currentSession` financial fields
**Enforced:** Not enforced
**Critical:** No (negative could be intentional adjustment)

### SESSION-5: Rebuy Transactions Valid
**Statement:** `rebuyTransactions` is array of `{timestamp, amount}`.
**Applies To:** `currentSession.rebuyTransactions`
**Enforced:** Not enforced
**Critical:** Yes

```javascript
const isValidRebuyTransactions = (txns) => {
  if (!Array.isArray(txns)) return false;
  return txns.every(t =>
    typeof t === 'object' &&
    typeof t.timestamp === 'number' &&
    typeof t.amount === 'number'
  );
};
```

### SESSION-6: Hand Count Non-Negative
**Statement:** `handCount` should be >= 0.
**Applies To:** `currentSession.handCount`
**Enforced:** Not enforced (increment only, no decrement)
**Critical:** No

---

## 5. Player Invariants

### PLAYER-1: Unique Player Names
**Statement:** No two players have the same name.
**Applies To:** `players` store
**Enforced:** Application logic (not DB index)
**Critical:** Yes

### PLAYER-2: Player ID Exists
**Statement:** Player IDs in `seatPlayers` exist in `allPlayers`.
**Applies To:** Relationship between `seatPlayers` and `allPlayers`
**Enforced:** Not enforced (stale refs possible)
**Critical:** No (handled gracefully)

### PLAYER-3: Valid Player Fields
**Statement:** Player records have required fields.
**Applies To:** `players` store records
**Enforced:** createPlayer adds defaults
**Critical:** No

### PLAYER-4: Avatar Size Limit
**Statement:** Avatar base64 string within 2MB.
**Applies To:** `player.avatar`
**Enforced:** Application constant (AVATAR_MAX_SIZE_BYTES)
**Critical:** No

---

## 6. State Shape Invariants

### SHAPE-1: Required Top-Level Keys
**Statement:** Reducer state has all expected keys.
**Applies To:** All reducers
**Enforced:** Schema validation (type checks)
**Critical:** Yes

| Reducer | Required Keys |
|---------|---------------|
| game | currentStreet, dealerButtonSeat, mySeat, seatActions, absentSeats |
| card | communityCards, holeCards, holeCardsVisible, allPlayerCards |
| session | currentSession, allSessions, isLoading |
| player | allPlayers, seatPlayers, isLoading |
| ui | currentView, selectedPlayers, contextMenu, isDraggingDealer, isSidebarCollapsed, showCardSelector, ... |

### SHAPE-2: Type Correctness
**Statement:** State values have correct types.
**Applies To:** All state fields
**Enforced:** Schema validation (DEBUG mode)
**Critical:** Yes

### SHAPE-3: Array Lengths
**Statement:** Fixed-length arrays maintain size.
**Applies To:** `communityCards[5]`, `holeCards[2]`
**Enforced:** Schema validation (length checks)
**Critical:** Yes

### SHAPE-4: Object Structure
**Statement:** Nested objects have expected structure.
**Applies To:** `seatActions`, `allPlayerCards`, `currentSession`
**Enforced:** Partial (top-level type only)
**Critical:** Yes

### SHAPE-5: Enum Values
**Statement:** Enum fields contain valid values.
**Applies To:** `currentStreet`, `cardSelectorType`
**Enforced:** Schema validation (enum checks)
**Critical:** Yes

### SHAPE-6: Numeric Ranges
**Statement:** Numeric fields within valid ranges.
**Applies To:** `dealerButtonSeat`, `mySeat`, seat references
**Enforced:** Schema validation (min/max)
**Critical:** Yes

---

## Enforcement Summary

| Level | Description | Count |
|-------|-------------|-------|
| Schema | Validated by reducerUtils (always on - fixed 2025-12-09) | 12 |
| Application | Checked in hooks/utils | 8 |
| None | Not validated anywhere | 16 |

---

## Critical Invariants Not Enforced

| ID | Invariant | Impact If Violated |
|----|-----------|-------------------|
| CARD-1 | Valid card format | Display errors |
| CARD-2 | No duplicate cards | Invalid poker hand |
| ACTION-1 | Valid action type | Action not recognized |
| SESSION-2 | Active session has ID | Null reference errors |
| SESSION-5 | Rebuy transactions array | Crash in calculations |

---

## Recommendations

### Critical (P0) ✅ FIXED 2025-12-09

1. **Add runtime validation for critical invariants** ✅ FIXED
   - CARD-2: Check uniqueness on card assignment - Fixed in cardReducer.js
   - SESSION-5: Validate rebuyTransactions type - Validated in sessionReducer

2. **Always enable schema validation** ✅ FIXED
   - Removed DEBUG check from reducerUtils.js
   - Schema validation now runs in production

### High Priority (P1)

3. **Add invariant checks to persistence layer**
   - Validate before save
   - Validate on load

4. **Create shared validation utilities**
   ```javascript
   // utils/validation.js
   export const invariants = {
     isValidSeat,
     isValidCard,
     hasNoDuplicateCards,
     isValidRebuyTransactions,
   };
   ```

### Medium Priority (P2)

5. **Add development-time invariant assertions**
   ```javascript
   if (DEBUG) {
     console.assert(isValidSeat(seat), `Invalid seat: ${seat}`);
   }
   ```

6. **Create invariant test suite**
   - Unit tests for each invariant function
   - Integration tests for combined invariants

---

## Related Documents

- [TICKET-4.2: Validation Layer Proposal](./validation-proposal.md)
- [TICKET-5.1: Schema Design](./schema-design.md)
- [TICKET-2.4: Cross-Reducer Dependencies](./cross-reducer-analysis.md)
