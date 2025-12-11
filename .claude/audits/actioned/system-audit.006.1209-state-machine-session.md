# TICKET-2.2: sessionReducer State Machine

**Status:** Complete
**Auditor:** Claude (Core System Audit)
**Date:** 2025-12-09

---

## Executive Summary

The sessionReducer manages poker session lifecycle including financial tracking (buy-in, rebuys, cash-out). The state machine has clear lifecycle states (inactive → active → ended) but the transitions rely heavily on persistence layer integration, creating coupling between reducer logic and side effects.

---

## State Shape

```typescript
interface SessionState {
  currentSession: {
    sessionId: number | null;
    startTime: number | null;
    endTime: number | null;
    isActive: boolean;
    venue: string | null;
    gameType: string | null;
    buyIn: number | null;
    rebuyTransactions: Array<{ timestamp: number; amount: number }>;
    cashOut: number | null;
    reUp: number;
    goal: string | null;
    notes: string | null;
    handCount: number;
  };
  allSessions: SessionRecord[];
  isLoading: boolean;
}
```

### Initial State

```javascript
{
  currentSession: {
    sessionId: null,
    startTime: null,
    endTime: null,
    isActive: false,
    venue: null,
    gameType: null,
    buyIn: null,
    rebuyTransactions: [],
    cashOut: null,
    reUp: 0,
    goal: null,
    notes: null,
    handCount: 0
  },
  allSessions: [],
  isLoading: false
}
```

---

## Action Types

| Action | Payload | Purpose |
|--------|---------|---------|
| `START_SESSION` | Full session data | Begin new session |
| `END_SESSION` | `{endTime, cashOut}` | End current session |
| `UPDATE_SESSION_FIELD` | `{field, value}` | Update single field |
| `ADD_REBUY` | `{timestamp, amount}` | Add rebuy transaction |
| `LOAD_SESSIONS` | `{sessions: []}` | Load all sessions from DB |
| `SET_ACTIVE_SESSION` | `{session}` | Set entire session object |
| `HYDRATE_SESSION` | `{session}` | Restore from persistence |
| `INCREMENT_HAND_COUNT` | none | Increment hand count +1 |
| `SET_HAND_COUNT` | `{count}` | Set hand count to value |
| `SET_LOADING` | `{isLoading}` | Set loading state |

---

## Session Lifecycle State Machine

```
                              HYDRATE_SESSION
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────┐
│                        NO SESSION                            │
│                     (sessionId: null)                        │
└─────────────────────────────────────────────────────────────┘
        │                                           ▲
        │ START_SESSION                             │
        │                                           │ (session fully reset)
        ▼                                           │
┌─────────────────────────────────────────────────────────────┐
│                      ACTIVE SESSION                          │
│                     (isActive: true)                         │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ UPDATE_SESSION_FIELD │ ADD_REBUY │ INCREMENT_HAND   │    │
│  │                 (field updates loop)                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
        │
        │ END_SESSION
        ▼
┌─────────────────────────────────────────────────────────────┐
│                      ENDED SESSION                           │
│               (isActive: false, endTime: set)                │
│                                                              │
│  Note: Session stays in currentSession until:                │
│  - New START_SESSION, or                                     │
│  - App restart (hydrates fresh if no active session)         │
└─────────────────────────────────────────────────────────────┘
```

---

## State Transitions

### START_SESSION (lines 65-83)

```javascript
case SESSION_ACTIONS.START_SESSION:
  return {
    ...state,
    currentSession: {
      sessionId: action.payload.sessionId,
      startTime: action.payload.startTime,
      endTime: null,
      isActive: true,
      venue: action.payload.venue || 'Online',
      gameType: action.payload.gameType || '1/2',
      buyIn: action.payload.buyIn || null,
      rebuyTransactions: action.payload.rebuyTransactions || [],
      cashOut: null,
      reUp: action.payload.reUp || 0,
      goal: action.payload.goal || null,
      notes: action.payload.notes || null,
      handCount: 0  // Always reset to 0
    }
  };
```

**Observations:**
- Completely replaces `currentSession` (no merge)
- `handCount` always resets to 0 (ignores payload)
- `cashOut` always null (cannot set on start)
- `endTime` always null (correct)

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| SS-1 | Low | No validation that `sessionId` is provided |
| SS-2 | Info | `handCount: 0` ignores payload (intentional but undocumented) |

---

### END_SESSION (lines 86-95)

```javascript
case SESSION_ACTIONS.END_SESSION:
  return {
    ...state,
    currentSession: {
      ...state.currentSession,
      endTime: action.payload.endTime,
      cashOut: action.payload.cashOut || null,
      isActive: false
    }
  };
```

**Observations:**
- Preserves existing session data (merge)
- Only sets `endTime`, `cashOut`, `isActive`
- `sessionId` remains (session is "ended", not "cleared")

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| SS-3 | Medium | **Can end session with no sessionId** - If no active session, still sets isActive:false |
| SS-4 | Low | No validation that session was active before ending |

---

### UPDATE_SESSION_FIELD (lines 98-105)

```javascript
case SESSION_ACTIONS.UPDATE_SESSION_FIELD:
  return {
    ...state,
    currentSession: {
      ...state.currentSession,
      [action.payload.field]: action.payload.value
    }
  };
```

**Observations:**
- Dynamic field update using bracket notation
- No field name validation
- No value type validation

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| SS-5 | Medium | **No field validation** - Can set any field, including invalid ones |
| SS-6 | Medium | **No type validation** - Can set buyIn to string, etc. |
| SS-7 | Low | Can overwrite `sessionId`, `isActive` (should be protected) |

---

### ADD_REBUY (lines 108-121)

```javascript
case SESSION_ACTIONS.ADD_REBUY:
  return {
    ...state,
    currentSession: {
      ...state.currentSession,
      rebuyTransactions: [
        ...state.currentSession.rebuyTransactions,
        {
          timestamp: action.payload.timestamp,
          amount: action.payload.amount
        }
      ]
    }
  };
```

**Observations:**
- Appends to array (immutable)
- No validation of timestamp/amount
- Transactions have no ID (cannot delete individually)

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| SS-8 | Low | No validation that session is active before adding rebuy |
| SS-9 | Low | Rebuy transactions cannot be deleted/edited |

---

### HYDRATE_SESSION (lines 138-142)

```javascript
case SESSION_ACTIONS.HYDRATE_SESSION:
  return {
    ...state,
    currentSession: action.payload.session || initialSessionState.currentSession
  };
```

**Observations:**
- Full replacement (no merge with initial state)
- Falls back to initial state if payload.session is null/undefined

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| SS-10 | High | **Missing fields not defaulted** - If DB session missing `handCount`, it becomes undefined |
| SS-11 | Medium | No schema validation of hydrated session |

---

## Session State Invariants

### Expected Invariants

| Invariant | Description | Enforced? |
|-----------|-------------|-----------|
| I1 | Active session has `sessionId` | **Not enforced** |
| I2 | Active session has `startTime` | **Not enforced** |
| I3 | Active session has `isActive: true` | **Not enforced** |
| I4 | Ended session has `endTime` | **Not enforced** |
| I5 | `rebuyTransactions` is array | Schema only |
| I6 | `handCount >= 0` | **Not enforced** |
| I7 | `buyIn >= 0` if set | **Not enforced** |

### Schema Validation (lines 48-52)

```javascript
export const SESSION_STATE_SCHEMA = {
  currentSession: { type: 'object' },
  allSessions: { type: 'array' },
  isLoading: { type: 'boolean' },
};
```

**Gap:** Only validates top-level types, not `currentSession` structure.

---

## Illegal State Analysis

### Theoretically Possible Illegal States

| State | How It Could Happen | Impact |
|-------|---------------------|--------|
| `isActive: true` + `endTime: set` | Bug in transition | Confusing UI |
| `isActive: false` + `sessionId: null` | Ended session then hydrate empty | Normal (no session) |
| `handCount: -1` | Decrement without check | Minor display issue |
| `rebuyTransactions: [{amount: "foo"}]` | Invalid UPDATE_SESSION_FIELD | NaN in calculations |

### Protection Mechanisms

1. **Schema validation** (DEBUG mode) - Catches type violations
2. **Reducer returns previous state on error** - Prevents corruption
3. **Persistence layer** - Validates on write (partial)

---

## Financial Calculations

### Total Investment (computed outside reducer)

```javascript
// SessionContext.jsx
const totalInvestment = useMemo(() => {
  const { buyIn, rebuyTransactions } = currentSession;
  const rebuyTotal = rebuyTransactions.reduce((sum, t) => sum + t.amount, 0);
  return (buyIn || 0) + rebuyTotal;
}, [currentSession.buyIn, currentSession.rebuyTransactions]);
```

**Depends on:**
- `buyIn` being numeric or null
- `rebuyTransactions` being array of `{amount: number}`

**Risk:** No runtime validation of these assumptions.

---

## State Transition Matrix

| Current State | Action | Valid? | Next State |
|---------------|--------|--------|------------|
| No session | `START_SESSION` | Yes | Active session |
| Active | `START_SESSION` | Yes* | New active session |
| Ended | `START_SESSION` | Yes | New active session |
| No session | `END_SESSION` | **No guard** | isActive:false (no-op-ish) |
| Active | `END_SESSION` | Yes | Ended session |
| Ended | `END_SESSION` | **No guard** | Updates endTime again |
| Active | `UPDATE_SESSION_FIELD` | Yes | Updated field |
| Active | `ADD_REBUY` | Yes | +rebuy transaction |
| Active | `INCREMENT_HAND_COUNT` | Yes | handCount + 1 |
| Any | `LOAD_SESSIONS` | Yes | allSessions updated |
| Any | `HYDRATE_SESSION` | Yes | currentSession replaced |

*Starting new session when one is active: Old session data is lost in reducer state (but may be persisted)

---

## Recommendations

### Critical (P0)

1. **SS-10: Merge with defaults on hydrate**
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

2. **SS-3/SS-4: Add state guards**
   ```javascript
   case SESSION_ACTIONS.END_SESSION: {
     if (!state.currentSession.sessionId) {
       return state;  // No session to end
     }
     // ... continue
   }
   ```

3. **SS-5/SS-6: Add field validation**
   ```javascript
   const VALID_FIELDS = ['venue', 'gameType', 'buyIn', 'goal', 'notes'];
   const PROTECTED_FIELDS = ['sessionId', 'isActive', 'endTime', 'startTime'];

   case SESSION_ACTIONS.UPDATE_SESSION_FIELD: {
     const { field, value } = action.payload;
     if (PROTECTED_FIELDS.includes(field)) {
       console.warn('Cannot update protected field:', field);
       return state;
     }
     // ... continue
   }
   ```

### Medium Priority (P2)

4. **SS-9: Add rebuy deletion capability**
   - Add unique ID to rebuy transactions
   - Add `REMOVE_REBUY` action

5. **Improve schema validation**
   - Validate `currentSession` nested structure
   - Check numeric fields are numbers

---

## Integration with Persistence

The sessionReducer is tightly coupled with `useSessionPersistence`:

| Reducer Action | Persistence Operation | Notes |
|----------------|----------------------|-------|
| `START_SESSION` | `createSession()` + `setActiveSession()` | Called BEFORE reducer |
| `END_SESSION` | `endSession()` + `clearActiveSession()` | Called BEFORE reducer |
| `UPDATE_SESSION_FIELD` | `updateSession()` (debounced) | Called AFTER reducer |
| `ADD_REBUY` | Auto-save includes rebuys | Via debounced save |
| `HYDRATE_SESSION` | `getSessionById()` | Data from DB |

**Risk:** Persistence failures can leave reducer in different state than DB.

---

## Related Documents

- [TICKET-2.1: gameReducer State Machine](./state-machine-game.md)
- [TICKET-2.3: cardReducer State Machine](./state-machine-card.md)
- [TICKET-2.4: Cross-Reducer Dependencies](./cross-reducer-analysis.md)
