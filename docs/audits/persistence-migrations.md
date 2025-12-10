# TICKET-1.4: Migration Correctness

**Status:** Complete
**Auditor:** Claude (Core System Audit)
**Date:** 2025-12-09

---

## Executive Summary

The application has two migration mechanisms: schema migrations (IndexedDB `onupgradeneeded`) and data migrations (runtime normalization). Schema migrations are well-structured but have edge cases around error handling and data integrity verification. The runtime migration (`normalizeSeatActions`) is simple and idempotent but adds read-time overhead.

---

## Migration Inventory

### Schema Migrations (database.js)

| Version | Changes | Migration Code |
|---------|---------|----------------|
| v1 → v2 | Add sessions store, activeSession store | Lines 96-114 |
| v2 → v3 | Add venue, gameType; convert rebuy → rebuyTransactions | Lines 117-168 |
| v3 → v4 | Add cashOut field | Lines 171-202 |
| v4 → v5 | Add players store | Lines 205-221 |

### Data Migrations (runtime)

| Migration | File | Trigger |
|-----------|------|---------|
| normalizeSeatActions | normalizeSeatActions.js | Every hand read |

---

## Schema Migration Analysis

### v1 → v2: Sessions and ActiveSession Stores

**Code (database.js:96-114):**
```javascript
if (oldVersion < 2 && !db.objectStoreNames.contains(SESSIONS_STORE_NAME)) {
  const sessionsStore = db.createObjectStore(SESSIONS_STORE_NAME, {
    keyPath: 'sessionId',
    autoIncrement: true
  });
  sessionsStore.createIndex('startTime', 'startTime', { unique: false });
  sessionsStore.createIndex('endTime', 'endTime', { unique: false });
  sessionsStore.createIndex('isActive', 'isActive', { unique: false });
}

if (oldVersion < 2 && !db.objectStoreNames.contains(ACTIVE_SESSION_STORE_NAME)) {
  db.createObjectStore(ACTIVE_SESSION_STORE_NAME, { keyPath: 'id' });
}
```

**Analysis:**

| Check | Status | Notes |
|-------|--------|-------|
| Idempotent | Yes | Guards with `objectStoreNames.contains()` |
| Data preserved | N/A | New stores, no existing data |
| Indexes correct | Yes | All indexes created properly |
| Error handling | Implicit | IndexedDB transaction aborts on error |

**Risk:** Low

---

### v2 → v3: Venue, GameType, RebuyTransactions

**Code (database.js:117-168):**
```javascript
if (oldVersion < 3) {
  const transaction = event.target.transaction;
  const sessionsStore = transaction.objectStore(SESSIONS_STORE_NAME);
  const getAllRequest = sessionsStore.openCursor();

  getAllRequest.onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const session = cursor.value;

      // Add new fields with defaults
      session.venue = session.venue || 'Online';
      session.gameType = session.gameType || '1/2';

      // Migrate rebuy: number → rebuyTransactions: array
      if (typeof session.rebuy === 'number') {
        if (session.rebuy > 0) {
          session.rebuyTransactions = [{
            timestamp: session.startTime + 60000,  // 1 minute after start
            amount: session.rebuy
          }];
        } else {
          session.rebuyTransactions = [];
        }
        delete session.rebuy;
      } else {
        session.rebuyTransactions = session.rebuyTransactions || [];
      }

      cursor.update(session);
      cursor.continue();
    }
  };
}
```

**Analysis:**

| Check | Status | Notes |
|-------|--------|-------|
| Idempotent | Yes | Checks `typeof session.rebuy === 'number'` |
| Data preserved | Yes | Converts rebuy to rebuyTransactions |
| Defaults sensible | Mostly | `startTime + 60000` is arbitrary but acceptable |
| Error handling | Logs only | `onerror` logs but doesn't abort |

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| M-1 | Medium | **Async migration in onupgradeneeded** - Cursor iteration is async but upgrade transaction may complete before all records processed |
| M-2 | Low | Estimated timestamp (`startTime + 60000`) may be inaccurate |
| M-3 | Low | Error in migration logs but doesn't fail upgrade |

---

### v3 → v4: CashOut Field

**Code (database.js:171-202):**
```javascript
if (oldVersion < 4) {
  const transaction = event.target.transaction;
  const sessionsStore = transaction.objectStore(SESSIONS_STORE_NAME);
  const getAllRequest = sessionsStore.openCursor();

  getAllRequest.onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const session = cursor.value;
      session.cashOut = session.cashOut || null;
      cursor.update(session);
      cursor.continue();
    }
  };
}
```

**Analysis:**

| Check | Status | Notes |
|-------|--------|-------|
| Idempotent | Yes | `session.cashOut || null` handles existing values |
| Data preserved | Yes | Only adds default if missing |
| Error handling | Logs only | Same pattern as v3 |

**Risk:** Low (simple field addition)

---

### v4 → v5: Players Store

**Code (database.js:205-221):**
```javascript
if (oldVersion < 5) {
  if (!db.objectStoreNames.contains(PLAYERS_STORE_NAME)) {
    const playersStore = db.createObjectStore(PLAYERS_STORE_NAME, {
      keyPath: 'playerId',
      autoIncrement: true
    });
    playersStore.createIndex('name', 'name', { unique: false });
    playersStore.createIndex('createdAt', 'createdAt', { unique: false });
    playersStore.createIndex('lastSeenAt', 'lastSeenAt', { unique: false });
  }
}
```

**Analysis:**

| Check | Status | Notes |
|-------|--------|-------|
| Idempotent | Yes | Guards with `objectStoreNames.contains()` |
| Data preserved | N/A | New store, no existing data |
| Indexes correct | Partial | `name` should be `unique: true` (see TICKET-1.1) |

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| M-4 | High | **name index non-unique** - Creates data integrity risk (see P-1/P-2) |

---

## Data Migration Analysis

### normalizeSeatActions (normalizeSeatActions.js)

**Purpose:** Converts old single-string format to new array format:
- Old: `seatActions[street][seat] = "fold"`
- New: `seatActions[street][seat] = ["fold"]`

**Code:**
```javascript
export const normalizeSeatActions = (seatActions) => {
  if (!seatActions || typeof seatActions !== 'object') {
    return {};
  }

  const normalized = {};

  for (const street of Object.keys(seatActions)) {
    const streetActions = seatActions[street];
    if (!streetActions || typeof streetActions !== 'object') {
      normalized[street] = {};
      continue;
    }

    normalized[street] = {};
    for (const seat of Object.keys(streetActions)) {
      const actions = streetActions[seat];

      if (Array.isArray(actions)) {
        normalized[street][seat] = actions;      // Already array - keep
      } else if (typeof actions === 'string' && actions) {
        normalized[street][seat] = [actions];    // String → array
      } else {
        normalized[street][seat] = [];           // Fallback
      }
    }
  }

  return normalized;
};
```

**Called From:**
- `loadHandById()` - handsStorage.js:161
- `getAllHands()` - handsStorage.js:200
- `getHandsBySessionId()` - handsStorage.js:236

**NOT Called From:**
- `loadLatestHand()` - **BUG: Missing normalization!**

**Analysis:**

| Check | Status | Notes |
|-------|--------|-------|
| Idempotent | Yes | Array check first |
| Pure function | Yes | No side effects |
| Error safe | Yes | Handles null/undefined |
| Complete | No | Missing from `loadLatestHand` |

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| M-5 | High | **loadLatestHand() missing normalization** - Hydration on startup uses unnormalized data |
| M-6 | Low | Runtime migration adds overhead on every read |

---

## Migration Safety Matrix

| Migration | Rollback Safe | Data Loss Risk | Tested |
|-----------|---------------|----------------|--------|
| v1→v2 | Yes (new stores) | None | N/A |
| v2→v3 | No (deletes rebuy) | Low | No |
| v3→v4 | Yes (adds field) | None | N/A |
| v4→v5 | Yes (new store) | None | N/A |
| seatActions | Yes (pure function) | None | Yes |

---

## Version Compatibility Analysis

### Forward Compatibility (old app reads new data)

| Scenario | Impact |
|----------|--------|
| v4 app reads v5 data | Players store ignored, hands/sessions work |
| v3 app reads v4 data | cashOut field ignored |
| v2 app reads v3 data | venue, gameType, rebuyTransactions ignored |

**Risk:** Low - Extra fields are ignored

---

### Backward Compatibility (new app reads old data)

| Scenario | Impact | Mitigation |
|----------|--------|------------|
| v5 app reads v1 data | Hands work; no sessions/players | Upgrade runs |
| v5 app reads v2 data | Sessions work; rebuy is number | v3 migration |
| v5 app reads v3 data | Works; cashOut undefined | v4 migration |
| v5 app reads v4 data | Works; no players | v5 migration |
| seatActions (string) | App crash possible | Runtime migration |

**Critical Path:** `normalizeSeatActions` must run for old hands

---

## Async Migration Concern (M-1)

### Problem

IndexedDB `onupgradeneeded` cursor operations are asynchronous, but the upgrade transaction has a finite lifetime:

```javascript
request.onupgradeneeded = (event) => {
  // ... cursor operations start here
  // Transaction may complete before all cursors finish!
};
```

### Current Behavior

The cursor operations (`cursor.update()`, `cursor.continue()`) keep the transaction alive as long as there's pending work. IndexedDB guarantees this.

### Verification

According to IndexedDB spec, transactions remain active while there are pending requests. The pattern used is correct.

**Risk:** Low (spec-compliant pattern)

---

## Recommendations

### Critical (P0)

1. **M-5: Add normalization to loadLatestHand**
   ```javascript
   // handsStorage.js:117
   if (cursor) {
     const hand = cursor.value;
     resolve(normalizeHandRecord(hand));  // Add this!
   }
   ```

2. **M-4: Fix name index uniqueness**
   - Add v6 migration to recreate index with `unique: true`
   - Or add application-level locking

### High Priority (P1)

3. **M-1: Add migration verification**
   - After upgrade, verify record counts match
   - Log migration summary (X records processed)

4. **M-3: Improve error handling**
   - Fail upgrade on migration error (abort transaction)
   - Provide recovery path for partial migrations

### Medium Priority (P2)

5. **M-6: Migrate seatActions at write time**
   - On next save, write normalized format
   - Reduces read-time overhead

6. **Add version field validation**
   - Check hand.version before hydration
   - Apply appropriate migrations

---

## Migration Test Coverage

| Migration | Unit Tests | Integration Tests |
|-----------|-----------|-------------------|
| v1→v2 | No | No |
| v2→v3 | No | No |
| v3→v4 | No | No |
| v4→v5 | No | No |
| normalizeSeatActions | Yes | No |

**Gap:** Schema migrations have no automated tests.

---

## Related Documents

- [TICKET-1.1: Storage Format Analysis](./persistence-storage-schema.md)
- [TICKET-1.2: Write Semantics Audit](./persistence-write-semantics.md)
- [TICKET-1.3: Read/Hydration Paths](./persistence-read-paths.md)
