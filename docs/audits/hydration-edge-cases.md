# TICKET-3.3: Hydration Edge Cases

**Status:** Complete
**Auditor:** Claude (Core System Audit)
**Date:** 2025-12-09

---

## Executive Summary

This document catalogs edge cases in the hydration process including partial data, corrupted data, missing fields, and version mismatches. Current handling is inconsistent - some cases fail gracefully, others could cause runtime errors. Key recommendations include adding default merging and validation layers.

---

## Edge Case Inventory

### Category 1: Missing Data

| Edge Case | Current Handling | Risk |
|-----------|------------------|------|
| No hands in database | Returns null, starts fresh | None |
| No active session | Returns null, starts fresh | None |
| No players in database | Returns [], empty list | None |
| Hand missing gameState | `undefined` spread into reducer | Medium |
| Hand missing cardState | Skips card hydration (guarded) | Low |
| Hand missing seatPlayers | Skips player hydration (guarded) | Low |
| Session missing required fields | Fields become undefined | High |

---

### Category 2: Partial Data

| Edge Case | Scenario | Current Handling | Risk |
|-----------|----------|------------------|------|
| gameState missing `mySeat` | Old record format | `mySeat: undefined` | Medium |
| gameState missing `absentSeats` | Old record format | `absentSeats: undefined` | High |
| Session missing `handCount` | v2 record | `handCount: undefined` | Medium |
| Session missing `rebuyTransactions` | v2 record pre-migration | Crash or NaN | High |
| Player missing optional fields | Normal | Works (optional) | None |

---

### Category 3: Corrupted Data

| Edge Case | Scenario | Current Handling | Risk |
|-----------|----------|------------------|------|
| `seatActions` not object | DB corruption | normalizeSeatActions returns {} | Low |
| `communityCards` wrong length | Manual DB edit | Schema validation (DEBUG) | Low |
| `dealerButtonSeat: 0` | Bug or corruption | Schema validation (DEBUG) | Medium |
| `dealerButtonSeat: "abc"` | Type corruption | Schema validation (DEBUG) | Medium |
| Circular reference in state | Impossible via UI | JSON.stringify would fail | Low |
| `rebuyTransactions: "100"` | Type corruption | `.reduce()` crashes | High |

---

### Category 4: Version Mismatches

| Edge Case | Scenario | Current Handling | Risk |
|-----------|----------|------------------|------|
| Hand v1.0 (no version field) | Very old data | normalizeSeatActions runs | Low |
| Hand v1.1 (string seatActions) | Old format | normalizeSeatActions runs | Low |
| Session v2 (rebuy: number) | Pre-v3 migration | Migration on DB open | Low |
| Unknown future version | Time travel? | Loaded as-is (no check) | Low |

---

### Category 5: Timing/Race Conditions

| Edge Case | Scenario | Current Handling | Risk |
|-----------|----------|------------------|------|
| DB open fails | IndexedDB unavailable | Catch, start fresh | Low |
| Session deleted mid-hydration | Concurrent tab | getSessionById returns null | Low |
| Hand deleted mid-hydration | Concurrent tab | loadLatestHand returns null | Low |
| Multiple rapid startups | User spam-refreshes | Multiple initDB calls | Low |

---

## Detailed Analysis

### EC-1: gameState Missing mySeat

**Trigger:**
```javascript
// Old hand record
{ gameState: { currentStreet: 'flop', dealerButtonSeat: 3 } }
// Missing: mySeat, seatActions, absentSeats
```

**Current Code:**
```javascript
case GAME_ACTIONS.HYDRATE_STATE:
  return {
    ...state,           // Has mySeat: 5 (initial)
    ...action.payload   // Has mySeat: undefined!
  };
// Result: mySeat: undefined (overwrites initial!)
```

**Impact:** `mySeat` becomes undefined, causes errors in seat calculations.

**Fix:**
```javascript
case GAME_ACTIONS.HYDRATE_STATE:
  return {
    ...initialGameState,  // Defaults
    ...state,
    ...action.payload     // Only overwrites if present
  };
```

---

### EC-2: absentSeats is Undefined

**Trigger:** Old hand record without `absentSeats` field.

**Current Code:**
```javascript
// useSeatUtils.js
const getSmallBlindSeat = () => {
  // Uses absentSeats in calculation
  // If undefined: absentSeats.includes() throws!
};
```

**Impact:** Runtime error when calculating blind positions.

**Fix:** Default merge (see EC-1) or explicit check:
```javascript
const absentSeats = state.absentSeats || [];
```

---

### EC-3: Session Missing handCount

**Trigger:** v2 session record hydrated.

**Current Code:**
```javascript
// SessionContext.jsx
const displayHandCount = currentSession.handCount + 1;
// undefined + 1 = NaN
```

**Impact:** "Hand #NaN" displayed in UI.

**Fix:**
```javascript
const displayHandCount = (currentSession.handCount || 0) + 1;
```

---

### EC-4: rebuyTransactions is String

**Trigger:** DB corruption or manual edit.

**Current Code:**
```javascript
// SessionContext.jsx
const rebuyTotal = rebuyTransactions.reduce((sum, t) => sum + t.amount, 0);
// String.reduce() throws TypeError
```

**Impact:** Runtime crash.

**Fix:**
```javascript
const rebuyTotal = Array.isArray(rebuyTransactions)
  ? rebuyTransactions.reduce((sum, t) => sum + (t?.amount || 0), 0)
  : 0;
```

---

### EC-5: activeSession Points to Deleted Session

**Trigger:**
1. User starts session (ID: 5)
2. In another tab, session 5 is deleted
3. First tab refreshes
4. `getActiveSession()` returns { sessionId: 5 }
5. `getSessionById(5)` returns null

**Current Code:**
```javascript
const sessionData = await getSessionById(activeSession.sessionId);
if (sessionData) {
  dispatchSession({ type: HYDRATE_SESSION, payload: { session: sessionData } });
}
// sessionData is null, hydration skipped
```

**Impact:** User starts without session (graceful degradation).

**Improvement:** Clear stale activeSession pointer:
```javascript
if (!sessionData) {
  await clearActiveSession();
  log('Cleared orphan activeSession pointer');
}
```

---

### EC-6: seatActions in Old String Format

**Trigger:** Hand from pre-v109.

**Current Code:**
```javascript
// normalizeSeatActions.js
if (Array.isArray(actions)) {
  normalized[street][seat] = actions;
} else if (typeof actions === 'string' && actions) {
  normalized[street][seat] = [actions];  // Convert to array
}
```

**Impact:** None (handled correctly).

**Issue:** `loadLatestHand()` DOESN'T call normalizeHandRecord!

```javascript
// handsStorage.js:117-119
if (cursor) {
  const hand = cursor.value;
  resolve(hand);  // BUG: Missing normalization!
}
```

---

### EC-7: Database Quota Exceeded

**Trigger:** Too many hands saved, storage full.

**Current Code:**
```javascript
if (event.target.error.name === 'QuotaExceededError') {
  logError('Storage quota exceeded. Please clear old hands.');
}
reject(event.target.error);
```

**Impact:** Save fails, user not notified in UI.

**Fix:** Add toast notification for quota errors.

---

### EC-8: IndexedDB Unavailable

**Trigger:** Private browsing, or browser doesn't support IndexedDB.

**Current Code:**
```javascript
if (!window.indexedDB) {
  logError('IndexedDB not supported');
  reject(new Error('IndexedDB not supported'));
  return;
}
```

**Higher Level:**
```javascript
} catch (error) {
  logError('Initialization failed:', error);
  isInitializedRef.current = true;
  setIsReady(true);  // Continue without persistence
}
```

**Impact:** App works but data not persisted. User not informed.

---

## Fallback Strategy Summary

| Condition | Fallback | User Notification |
|-----------|----------|-------------------|
| No hands | Start fresh | None |
| No session | Start fresh | None |
| No players | Empty list | None |
| DB unavailable | In-memory only | None (should add) |
| Corrupt data | Use defaults | None (should add) |
| Quota exceeded | Save fails | Log only (should add UI) |
| Migration fails | Partial data | Log only |

---

## Recommendations

### Critical (P0)

1. **Add normalization to loadLatestHand**
   - Currently missing, causes EC-6

2. **Add default merging to HYDRATE actions**
   - Prevents EC-1, EC-2, EC-3

### High Priority (P1)

3. **Add type guards for computed values**
   ```javascript
   const rebuyTotal = Array.isArray(rebuyTransactions)
     ? rebuyTransactions.reduce(...)
     : 0;
   ```

4. **Add user notifications for critical failures**
   - DB unavailable
   - Quota exceeded
   - Migration failures

### Medium Priority (P2)

5. **Add data validation layer**
   - Validate loaded data before hydration
   - Use Zod or custom schemas

6. **Clear orphan references**
   - activeSession pointing to deleted session
   - hands with invalid sessionId

7. **Add recovery UI**
   - "Clear corrupted data" option
   - "Export/Import" for backup

---

## Test Matrix

| Edge Case | Unit Test | Integration Test | Manual Test |
|-----------|-----------|------------------|-------------|
| EC-1: Missing mySeat | No | No | No |
| EC-2: Undefined absentSeats | No | No | No |
| EC-3: Missing handCount | No | No | No |
| EC-4: Corrupt rebuyTransactions | No | No | No |
| EC-5: Orphan activeSession | No | No | No |
| EC-6: String seatActions | Yes | No | No |
| EC-7: Quota exceeded | No | No | Manual |
| EC-8: No IndexedDB | No | No | Private mode |

**Gap:** Most edge cases have no automated tests.

---

## Related Documents

- [TICKET-3.1: Hydration Flow](./hydration-flow.md)
- [TICKET-3.2: Version Compatibility](./version-compatibility.md)
- [TICKET-1.3: Read/Hydration Paths](./persistence-read-paths.md)
