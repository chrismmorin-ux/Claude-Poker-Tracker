# TICKET-1.1: Storage Format Analysis

**Status:** Complete
**Auditor:** Claude (Core System Audit)
**Date:** 2025-12-09

---

## Executive Summary

The Poker Tracker application uses IndexedDB for client-side persistence with a modular storage layer. The database (PokerTrackerDB v5) contains 4 object stores: `hands`, `sessions`, `activeSession`, and `players`. The schema is well-structured but has several areas of concern around schema drift, implicit type assumptions, and incomplete field validation.

---

## Database Overview

| Property | Value |
|----------|-------|
| Database Name | `PokerTrackerDB` |
| Current Version | 5 |
| Storage Mechanism | IndexedDB |
| Module Location | `src/utils/persistence/` |

---

## Object Stores

### 1. `hands` Store

**Purpose:** Stores individual poker hand records with game state snapshots.

| Property | Type | Notes |
|----------|------|-------|
| `handId` | number (auto) | Primary key, auto-incremented |
| `timestamp` | number | Unix timestamp (ms), indexed |
| `sessionId` | number \| null | Foreign key to sessions, indexed |
| `version` | string | Schema version (currently "1.2.0") |
| `sessionHandNumber` | number \| null | 1-based position within session |
| `handDisplayId` | string | Searchable ID (e.g., "S5-H12") |
| `gameState` | object | Snapshot of game reducer state |
| `cardState` | object | Snapshot of card reducer state |
| `seatPlayers` | object | Map of seat# → playerId |

**Indexes:**
- `timestamp` (non-unique) - For chronological queries
- `sessionId` (non-unique) - For session-based filtering

**Nested Schema - `gameState`:**
```javascript
{
  currentStreet: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown',
  dealerButtonSeat: 1-9,
  mySeat: 1-9,
  seatActions: { [street]: { [seat]: string[] } },  // Note: string[] after migration
  absentSeats: number[]
}
```

**Nested Schema - `cardState`:**
```javascript
{
  communityCards: string[5],   // ['', '', '', '', ''] or ['A♠', 'K♥', ...]
  holeCards: string[2],        // ['', ''] or ['A♠', 'K♥']
  holeCardsVisible: boolean,
  allPlayerCards: { [seat]: string[2] }  // { 1: ['', ''], 2: ['A♠', 'K♥'], ... }
}
```

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| H-1 | Medium | `seatPlayers` is optional - not consistently saved (auto-save includes it, manual save does not) |
| H-2 | Low | `version` field exists but is not used for read-time migrations |
| H-3 | Low | No validation that `gameState.seatActions` values are arrays (relies on runtime migration) |
| H-4 | Info | `handDisplayId` format assumes sessionId is numeric |

---

### 2. `sessions` Store

**Purpose:** Stores poker session records with financial tracking.

| Property | Type | Notes |
|----------|------|-------|
| `sessionId` | number (auto) | Primary key, auto-incremented |
| `startTime` | number | Unix timestamp (ms), indexed |
| `endTime` | number \| null | Unix timestamp (ms), indexed |
| `isActive` | boolean | Whether session is ongoing, indexed |
| `venue` | string | Location (default: 'Online') |
| `gameType` | string | Stakes (default: '1/2') |
| `buyIn` | number \| null | Initial buy-in amount |
| `rebuyTransactions` | array | `[{ timestamp: number, amount: number }]` |
| `cashOut` | number \| null | Final cash-out amount |
| `reUp` | number | Re-up amount (default: 0) |
| `goal` | string \| null | Session goal text |
| `notes` | string \| null | User notes |
| `handCount` | number | Hands played in session |
| `version` | string | Schema version (currently "1.3.0") |

**Indexes:**
- `startTime` (non-unique)
- `endTime` (non-unique)
- `isActive` (non-unique)

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| S-1 | Medium | `isActive` is stored but `activeSession` store is authoritative - potential inconsistency |
| S-2 | Low | `handCount` is stored in session but also computed from hands - redundant data source |
| S-3 | Low | `rebuyTransactions` array elements have no ID - cannot delete individual rebuys |
| S-4 | Info | `gameType` is free-text string but GAME_TYPES constant has specific values |
| S-5 | Info | `venue` is free-text string but VENUES constant has specific values |

---

### 3. `activeSession` Store

**Purpose:** Single-record store tracking which session is currently active.

| Property | Type | Notes |
|----------|------|-------|
| `id` | number | Always 1 (singleton pattern) |
| `sessionId` | number | Foreign key to sessions store |
| `lastUpdated` | number | Unix timestamp (ms) |

**Design Pattern:** Uses a fixed key (1) to implement a singleton record that tracks the current active session.

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| A-1 | Medium | Dual source of truth: `activeSession.sessionId` vs `sessions.isActive = true` |
| A-2 | Low | No referential integrity check - `sessionId` could point to deleted session |

---

### 4. `players` Store

**Purpose:** Stores player profiles for identification and note-taking.

| Property | Type | Notes |
|----------|------|-------|
| `playerId` | number (auto) | Primary key, auto-incremented |
| `name` | string | Player name, indexed (non-unique!) |
| `nickname` | string \| undefined | Optional nickname |
| `ethnicity` | string \| undefined | Physical description |
| `build` | string \| undefined | Physical description |
| `gender` | string \| undefined | Physical description |
| `facialHair` | string \| undefined | Physical description |
| `hat` | boolean \| undefined | Wears hat |
| `sunglasses` | boolean \| undefined | Wears sunglasses |
| `styleTags` | string[] \| undefined | Playing style tags |
| `notes` | string \| undefined | User notes |
| `avatar` | string \| undefined | Base64 image data |
| `createdAt` | number | Unix timestamp (ms), indexed |
| `lastSeenAt` | number | Unix timestamp (ms), indexed |
| `handCount` | number | Hands played with player |
| `stats` | object \| null | Reserved for future stats |

**Indexes:**
- `name` (non-unique) - **Bug: Should be unique per hook validation logic**
- `createdAt` (non-unique)
- `lastSeenAt` (non-unique)

**Findings:**

| ID | Severity | Issue |
|----|----------|-------|
| P-1 | High | `name` index is non-unique but `usePlayerPersistence` enforces uniqueness in application code |
| P-2 | Medium | Application validates name uniqueness but DB doesn't - race condition possible |
| P-3 | Low | `avatar` stores base64 - no size limit in DB (2MB limit only in constants) |
| P-4 | Info | Many fields are optional/undefined - no default values in DB layer |

---

## Schema Version History

| Version | Changes |
|---------|---------|
| v1 | Initial: `hands` store with `timestamp` and `sessionId` indexes |
| v2 | Added: `sessions` store, `activeSession` store |
| v3 | Added: `venue`, `gameType`, migrated `rebuy` → `rebuyTransactions` |
| v4 | Added: `cashOut` field to sessions |
| v5 | Added: `players` store |

---

## Data Type Invariants

### Cards
- Valid card format: `{Rank}{Suit}` (e.g., "A♠", "K♥", "T♦")
- Ranks: A, K, Q, J, T, 9, 8, 7, 6, 5, 4, 3, 2
- Suits: ♠, ♥, ♦, ♣
- Empty slot: `""` (empty string)

### Seats
- Valid seat numbers: 1-9 (LIMITS.NUM_SEATS = 9)
- Seat references are stored as strings in object keys (implicit JS behavior)

### Streets
- Valid values: `preflop`, `flop`, `turn`, `river`, `showdown`
- Defined in `STREETS` constant

### Actions
- Defined in `ACTIONS` constant (gameConstants.js)
- Stored as strings (e.g., "fold", "limp", "call")
- `seatActions` now stores arrays of actions per street/seat

---

## Implicit Assumptions

1. **Auto-increment IDs are unique** - IndexedDB guarantees this within a store
2. **Timestamps are UTC milliseconds** - Consistent use of `Date.now()`
3. **Session has at most one active** - Enforced by singleton `activeSession` store
4. **Player names are unique** - Enforced in application, NOT in database
5. **Cards are never duplicated** - Enforced in application, NOT in database
6. **Seat numbers are 1-indexed** - Convention throughout codebase

---

## Recommendations

### Critical (P0)

1. **P-1/P-2: Add unique constraint to player names**
   - Change `name` index to `{ unique: true }` in next schema version
   - Or accept that duplicates are possible and handle in UI

### High Priority (P1)

2. **A-1/S-1: Consolidate active session tracking**
   - Remove `isActive` from sessions store, OR
   - Derive from `activeSession` store only
   - Current dual-source creates sync bugs

3. **H-1: Standardize seatPlayers persistence**
   - Include `seatPlayers` in both auto-save and manual save paths

### Medium Priority (P2)

4. **S-2: Remove redundant handCount**
   - Compute from hands store using `getSessionHandCount()` only
   - Or document which source is authoritative

5. **H-3: Add schema validation on read**
   - Use `version` field to trigger migrations
   - Validate `seatActions` format before use

---

## Related Documents

- [TICKET-1.2: Write Semantics Audit](./persistence-write-semantics.md)
- [TICKET-1.3: Read/Hydration Paths](./persistence-read-paths.md)
- [TICKET-1.4: Migration Correctness](./persistence-migrations.md)
