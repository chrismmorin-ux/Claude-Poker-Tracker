# TICKET-5.2: Implementation Roadmap

**Status:** Complete
**Auditor:** Claude (Core System Audit)
**Date:** 2025-12-09

---

## Executive Summary

This roadmap provides a phased plan for implementing the findings from the Core System Audit. Work is organized into 4 implementation phases targeting critical bugs first, then systematic improvements. Total estimated effort is 15-20 development hours spread across the phases.

---

## Priority Matrix

### P0 - Critical (Must Fix)

| ID | Issue | Impact | Effort |
|----|-------|--------|--------|
| M-5 | loadLatestHand missing normalization | Old hands cause crashes | 15 min |
| R-5 | Session hydration missing defaults | undefined fields cause NaN | 30 min |
| W-1 | startNewSession non-atomic | Orphan sessions | 1 hr |
| C-3 | Card duplicates not prevented in reducer | Invalid poker hands | 1 hr |

### P1 - High Priority

| ID | Issue | Impact | Effort |
|----|-------|--------|--------|
| R-1 | Game hydration missing defaults | undefined fields | 30 min |
| P-1/P-2 | Player name uniqueness gap | Duplicate players | 1 hr |
| A-1/S-1 | Dual active session tracking | State sync bugs | 2 hr |
| G-4/G-5 | No action/seat validation | Invalid data stored | 1 hr |
| SS-10 | Session hydration full replacement | Missing fields | 30 min |

### P2 - Medium Priority

| ID | Issue | Impact | Effort |
|----|-------|--------|--------|
| W-4 | sessionHandNumber race | Duplicate hand numbers | 2 hr |
| W-12 | Quota errors not surfaced | Silent failures | 1 hr |
| M-6 | Runtime seatActions migration | Performance | 2 hr |
| S-2 | Redundant handCount | Data drift | 1 hr |

### P3 - Low Priority / Nice-to-Have

| ID | Issue | Impact | Effort |
|----|-------|--------|--------|
| Schema tests | No migration tests | Untested code | 4 hr |
| TypeScript | No compile-time checks | Developer experience | 8 hr |
| Full validation | Inconsistent validation | Edge cases | 4 hr |

---

## Implementation Phases

### Phase A: Critical Fixes (1-2 hours)

**Goal:** Fix bugs that cause crashes or data corruption.

#### A.1: Fix loadLatestHand Normalization

**File:** `src/utils/persistence/handsStorage.js`

**Change:**
```javascript
// Line 117-119
if (cursor) {
  const hand = cursor.value;
  resolve(normalizeHandRecord(hand));  // Add normalization
}
```

**Test:** Load old hand with string seatActions format.

---

#### A.2: Add Default Merging to Hydration

**Files:** `gameReducer.js`, `cardReducer.js`, `sessionReducer.js`

**Pattern:**
```javascript
case ACTIONS.HYDRATE_STATE:
  return {
    ...initialState,       // Defaults
    ...state,              // Current (if any)
    ...action.payload      // Loaded data
  };
```

**Test:** Hydrate with partial data, verify defaults used.

---

### Phase B: Validation Foundation (2-3 hours)

**Goal:** Create reusable validation utilities.

#### B.1: Create Validation Module

**File:** `src/utils/validation.js` (new or enhance existing)

```javascript
// Core validators
export const isValidSeat = (seat) => ...
export const isValidCard = (card) => ...
export const isValidAction = (action) => ...
export const isValidStreet = (street) => ...

// State validators
export const isValidGameState = (state) => ...
export const isValidCardState = (state) => ...
export const isValidSessionState = (state) => ...
```

---

#### B.2: Add Input Validation to Key Reducers

**Files:** `gameReducer.js`, `cardReducer.js`

**Example:**
```javascript
case GAME_ACTIONS.RECORD_ACTION: {
  const { seats, action: playerAction } = action.payload;

  // Validate
  const validSeats = seats.filter(isValidSeat);
  if (!validSeats.length) return state;
  if (!isValidAction(playerAction)) return state;

  // Proceed...
}
```

---

### Phase C: Persistence Hardening (3-4 hours)

**Goal:** Ensure data integrity in storage layer.

#### C.1: Add Persistence Validation Module

**File:** `src/utils/persistence/validation.js` (new)

```javascript
export const validateHandRecord = (hand) => {
  const errors = [];
  if (!hand.gameState) errors.push('Missing gameState');
  if (!hand.cardState) errors.push('Missing cardState');
  // ... more checks
  return errors;
};

export const validateSessionRecord = (session) => {
  const errors = [];
  if (!Array.isArray(session.rebuyTransactions)) {
    errors.push('rebuyTransactions must be array');
  }
  // ... more checks
  return errors;
};
```

---

#### C.2: Make startNewSession Atomic

**File:** `src/hooks/useSessionPersistence.js`

**Change:**
```javascript
const startNewSession = useCallback(async (sessionData = {}) => {
  let sessionId = null;

  try {
    sessionId = await createSession(sessionData);
    await setActiveSession(sessionId);

    dispatchSession({
      type: SESSION_ACTIONS.START_SESSION,
      payload: { sessionId, ... }
    });

    return sessionId;
  } catch (error) {
    // Rollback: Delete orphan session
    if (sessionId) {
      await deleteSession(sessionId).catch(() => {});
    }
    throw error;
  }
}, [dispatchSession]);
```

---

#### C.3: Consolidate Active Session Tracking

**Decision:** Use `activeSession` store as single source of truth.

**Changes:**
1. Remove `isActive` field from session records (v6 migration)
2. Derive `isActive` from presence in `activeSession` store
3. Update `endSession` to only clear `activeSession`

---

### Phase D: Type Safety (Optional, 4-8 hours)

**Goal:** Add TypeScript for compile-time safety.

#### D.1: Create Type Definitions

**Directory:** `src/types/`

- `game.ts` - GameState types
- `card.ts` - CardState types
- `session.ts` - SessionState types
- `player.ts` - PlayerState types
- `ui.ts` - UIState types
- `persistence.ts` - DB record types

---

#### D.2: Add Type Guards

**File:** `src/utils/typeGuards.ts`

Type guards for runtime checking of hydrated data.

---

#### D.3: Convert Critical Files to TypeScript

Priority order:
1. `src/utils/validation.ts`
2. `src/reducers/gameReducer.ts`
3. `src/utils/persistence/*.ts`
4. Remaining reducers

---

## Testing Requirements

### Phase A Tests

| Test | Type | Coverage |
|------|------|----------|
| normalizeSeatActions | Unit | Exists |
| Hydration with partial data | Integration | NEW |
| Hydration with missing fields | Integration | NEW |

### Phase B Tests

| Test | Type | Coverage |
|------|------|----------|
| isValidSeat | Unit | NEW |
| isValidCard | Unit | NEW |
| isValidAction | Unit | NEW |
| Reducer input validation | Integration | NEW |

### Phase C Tests

| Test | Type | Coverage |
|------|------|----------|
| validateHandRecord | Unit | NEW |
| validateSessionRecord | Unit | NEW |
| startNewSession rollback | Integration | NEW |

---

## Risk Assessment

### Low Risk Changes

- Adding normalization to loadLatestHand
- Adding default merging to hydration
- Creating validation utilities
- Adding input validation to reducers

### Medium Risk Changes

- Making startNewSession atomic (rollback logic)
- Consolidating active session tracking (DB migration)
- Enabling validation in production

### Higher Risk Changes

- TypeScript migration (affects all files)
- Schema version 6 migration
- Removing isActive field

---

## Rollout Strategy

### Week 1: Critical Fixes (Phase A)

1. Implement A.1, A.2
2. Deploy to development
3. Test with existing data
4. Deploy to production

### Week 2: Validation (Phase B)

1. Create validation module
2. Add to reducers (development only)
3. Monitor for violations
4. Enable in production

### Week 3: Persistence (Phase C)

1. Add persistence validation
2. Fix startNewSession atomicity
3. Plan DB migration for active session

### Week 4+: Type Safety (Phase D)

1. Create type definitions
2. Add type guards
3. Gradual TypeScript adoption

---

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Hydration failures | Unknown | 0 |
| Invalid data in DB | Unknown | 0 |
| Reducer validation errors | None (no checks) | Logged & handled |
| Runtime crashes from state | Unknown | 0 |

---

## Dependencies

### Internal Dependencies

| Phase | Depends On |
|-------|------------|
| B | A complete |
| C | B complete |
| D | C complete (optional) |

### External Dependencies

- None (no new libraries)

---

## Open Questions

1. **Enable schema validation in production?**
   - Pro: Catches issues
   - Con: Performance overhead

2. **Add Sentry/error reporting?**
   - Would help track validation failures

3. **TypeScript strict mode?**
   - `strictNullChecks` catches many issues
   - Requires more comprehensive changes

---

## Maintenance Notes

### After Implementation

1. Update `CLAUDE.md` with new validation patterns
2. Update `docs/STATE_SCHEMAS.md` with formal types
3. Add validation to PR checklist
4. Document error codes for validation failures

### Ongoing

1. Review validation logs monthly
2. Add validators for new features
3. Keep type definitions in sync

---

## Related Documents

- [TICKET-5.1: Schema Design](./schema-design.md)
- [TICKET-4.2: Validation Layer Proposal](./validation-proposal.md)
- [TICKET-4.1: Invariant Catalog](./invariant-catalog.md)
- [All Phase 1-4 Audit Documents](./README.md)
