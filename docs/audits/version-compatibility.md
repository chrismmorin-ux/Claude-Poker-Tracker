# TICKET-3.2: Version Compatibility Matrix

**Status:** Complete
**Auditor:** Claude (Core System Audit)
**Date:** 2025-12-09

---

## Executive Summary

The application has undergone 5 database schema versions with corresponding data format changes. Forward compatibility (new app reads old data) is well-handled via migrations. Backward compatibility (old app reads new data) is partially addressed - new fields are ignored, but structural changes could break older apps. The `version` field in records is stored but not actively used for compatibility checks.

---

## Schema Version History

| Version | Release | Changes |
|---------|---------|---------|
| v1 | Initial | `hands` store with `timestamp`, `sessionId` indexes |
| v2 | v110 | Added `sessions` store, `activeSession` store |
| v3 | v110 | Added `venue`, `gameType`; converted `rebuy` → `rebuyTransactions` |
| v4 | v110 | Added `cashOut` field to sessions |
| v5 | v111 | Added `players` store |

---

## Hands Store Compatibility

### Record Versions

| Field | v1 | v1.1 | v1.2 |
|-------|-----|------|------|
| `handId` | Yes | Yes | Yes |
| `timestamp` | Yes | Yes | Yes |
| `gameState` | Yes | Yes | Yes |
| `cardState` | Yes | Yes | Yes |
| `sessionId` | No | Yes | Yes |
| `version` | No | Yes | Yes |
| `seatPlayers` | No | No | Yes |
| `sessionHandNumber` | No | No | Yes |
| `handDisplayId` | No | No | Yes |

### seatActions Format Migration

| Format | Example | App Version |
|--------|---------|-------------|
| String (old) | `{ preflop: { 1: "fold" } }` | < v109 |
| Array (new) | `{ preflop: { 1: ["fold", "call"] } }` | >= v109 |

**Migration:** `normalizeSeatActions()` runs on every read.

---

## Sessions Store Compatibility

### Record Versions

| Field | v2 | v3 | v4 |
|-------|-----|-----|-----|
| `sessionId` | Yes | Yes | Yes |
| `startTime` | Yes | Yes | Yes |
| `endTime` | Yes | Yes | Yes |
| `isActive` | Yes | Yes | Yes |
| `buyIn` | Yes | Yes | Yes |
| `rebuy` (number) | Yes | No* | No |
| `rebuyTransactions` (array) | No | Yes | Yes |
| `venue` | No | Yes | Yes |
| `gameType` | No | Yes | Yes |
| `reUp` | Yes | Yes | Yes |
| `goal` | Yes | Yes | Yes |
| `notes` | Yes | Yes | Yes |
| `handCount` | Yes | Yes | Yes |
| `cashOut` | No | No | Yes |
| `version` | Yes | Yes | Yes |

*Migrated to `rebuyTransactions` array

---

## Players Store Compatibility

### Record Version (v5 only)

| Field | Required | Type |
|-------|----------|------|
| `playerId` | Yes | number (auto) |
| `name` | Yes | string |
| `nickname` | No | string |
| `ethnicity` | No | string |
| `build` | No | string |
| `gender` | No | string |
| `facialHair` | No | string |
| `hat` | No | boolean |
| `sunglasses` | No | boolean |
| `styleTags` | No | string[] |
| `notes` | No | string |
| `avatar` | No | string (base64) |
| `createdAt` | Yes | number |
| `lastSeenAt` | Yes | number |
| `handCount` | Yes | number |
| `stats` | No | object |

---

## Forward Compatibility Matrix (New App Reads Old Data)

| Old Data Version | New App Version | Compatible? | Migration Required |
|------------------|-----------------|-------------|-------------------|
| DB v1 | v5 | Yes | Schema upgrade v1→v5 |
| DB v2 | v5 | Yes | Schema upgrade v2→v5 |
| DB v3 | v5 | Yes | Schema upgrade v3→v5 |
| DB v4 | v5 | Yes | Schema upgrade v4→v5 |
| Hand v1 | Current | Yes | normalizeSeatActions |
| Hand v1.1 | Current | Yes | normalizeSeatActions |
| Hand v1.2 | Current | Yes | None |
| Session v2 | Current | Yes | v3, v4 migrations |
| Session v3 | Current | Yes | v4 migration |
| Session v4 | Current | Yes | None |

### Migration Details

**DB v1 → v5:**
```
v1 → v2: Create sessions, activeSession stores
v2 → v3: Add venue/gameType, migrate rebuy → rebuyTransactions
v3 → v4: Add cashOut field
v4 → v5: Create players store
```

**seatActions migration:** Runs on read, converts string → array format

---

## Backward Compatibility Matrix (Old App Reads New Data)

| New Data Version | Old App Version | Compatible? | Notes |
|------------------|-----------------|-------------|-------|
| DB v5 | v4 app | Partial | Players store ignored |
| DB v5 | v3 app | Partial | Players, cashOut ignored |
| DB v5 | v2 app | Partial | Multiple new fields ignored |
| DB v5 | v1 app | No | Sessions store not recognized |
| Hand v1.2 | Old app | Yes | Extra fields ignored |
| seatActions array | Old app | **No** | Expects string, gets array |
| Session v4 | v3 app | Yes | cashOut ignored |

### Breaking Changes

| Change | Impact on Old Apps |
|--------|-------------------|
| `seatActions` array format | Array access on string → errors |
| `rebuyTransactions` array | Expected number, got array → NaN calculations |
| New stores (sessions, players) | Ignored (no error) |
| New fields (cashOut, venue) | Ignored (no error) |

---

## Version Field Usage

### Current State

Records have `version` field but it's NOT actively checked:

```javascript
// Hand record
{ version: '1.2.0', ... }

// Session record
{ version: '1.3.0', ... }

// On hydration:
dispatchGame({ type: HYDRATE_STATE, payload: hand.gameState });
// No version check!
```

### Recommended Usage

```javascript
const loadAndMigrate = (hand) => {
  switch(hand.version) {
    case undefined:
    case '1.0.0':
      hand = migrateV1ToV11(hand);
      // fall through
    case '1.1.0':
      hand = migrateV11ToV12(hand);
      // fall through
    case '1.2.0':
      // Current version
      break;
  }
  return hand;
};
```

---

## Test Scenarios

### Scenario 1: Fresh Install

```
User installs app for first time
→ initDB() creates DB v5
→ All stores created fresh
→ No migration needed
```

**Status:** Works correctly

### Scenario 2: Upgrade from v1

```
User has DB v1 (hands only)
→ Opens new app
→ onupgradeneeded triggers
→ Creates sessions, activeSession, players stores
→ No data migration needed (new stores empty)
```

**Status:** Works correctly

### Scenario 3: Upgrade from v2 with sessions

```
User has DB v2 with sessions (rebuy as number)
→ Opens new app
→ v2→v3 migration runs
→ rebuy converted to rebuyTransactions[]
→ venue, gameType added with defaults
```

**Status:** Works correctly

### Scenario 4: Old app reads new data (BREAKING)

```
User has used v5 app
→ Opens old v2 app (hypothetically)
→ Tries to read session with rebuyTransactions[]
→ Expects rebuy: number
→ Gets rebuyTransactions: [{...}]
→ Calculations break
```

**Status:** Not supported (no old app to run)

### Scenario 5: Corrupted version field

```
User's hand record has version: undefined
→ loadLatestHand() returns record
→ normalizeSeatActions() runs (handles old format)
→ Hydration proceeds
```

**Status:** Works correctly (graceful degradation)

---

## Data Migration Completeness

| Migration | All Records Updated? | Verified? |
|-----------|---------------------|-----------|
| v2→v3: venue/gameType | Yes (cursor loop) | No tests |
| v2→v3: rebuy→rebuyTransactions | Yes (cursor loop) | No tests |
| v3→v4: cashOut | Yes (cursor loop) | No tests |
| seatActions normalization | Per-read only | Yes (unit tests) |

### Gap: No Migration Verification

After schema upgrade, there's no verification that all records were successfully migrated:

```javascript
// Current: Just logs completion
log('v3 migration completed for all sessions');

// Missing: Verification
const count = await objectStore.count();
const migrated = await countRecordsWithField('rebuyTransactions');
if (count !== migrated) {
  logError('Migration incomplete!');
}
```

---

## Recommendations

### Critical (P0)

1. **Fix seatActions migration in loadLatestHand**
   ```javascript
   // handsStorage.js:117
   if (cursor) {
     const hand = cursor.value;
     resolve(normalizeHandRecord(hand));  // Add normalization!
   }
   ```

### High Priority (P1)

2. **Add version checking to hydration**
   ```javascript
   if (hand.version !== CURRENT_HAND_VERSION) {
     hand = migrateHand(hand);
   }
   ```

3. **Add migration tests**
   - Test each version upgrade path
   - Verify all records migrated correctly

### Medium Priority (P2)

4. **Add migration verification**
   - Count records before/after
   - Log migration statistics

5. **Document breaking changes**
   - Create MIGRATION.md
   - List version requirements

---

## Upgrade Path Summary

```
     ┌──────────────────────────────────────────────────────┐
     │                   SUPPORTED PATHS                     │
     └──────────────────────────────────────────────────────┘

     DB v1 ───► DB v2 ───► DB v3 ───► DB v4 ───► DB v5
                  │           │           │
                  ▼           ▼           ▼
              sessions     venue,      cashOut
                          gameType,
                          rebuyTxns

     Hand v1 ─── normalize ───► Current (array format)
     Hand v1.1 ─ normalize ───► Current
     Hand v1.2 ─ (current) ───► Current

     ┌──────────────────────────────────────────────────────┐
     │                UNSUPPORTED PATHS                      │
     └──────────────────────────────────────────────────────┘

     DB v5 ──X──► DB v4 (downgrade not supported)
     Array seatActions ──X──► String format (old app breaks)
```

---

## Related Documents

- [TICKET-1.4: Migration Correctness](./persistence-migrations.md)
- [TICKET-3.1: Hydration Flow](./hydration-flow.md)
- [TICKET-3.3: Edge Case Analysis](./hydration-edge-cases.md)
