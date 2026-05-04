# Player Identification v2 — IDB v22 migration spec (PIO-G4-MIG, unified with Table-Build)

**Created:** 2026-05-02 (PIO Gate 4 / WS-007 / SPR-021)
**Status:** Spec authored; coordination contract with Table-Build pending Gate 5 implementation by either project.
**Implementation:** PIO Gate 5 multi-PR (sequenced with or after Table-Build Gate 5).

**Sibling docs:**
- [Gate 4 audit — `docs/design/audits/2026-05-02-gate4-design-player-identification-v2.md`](../../design/audits/2026-05-02-gate4-design-player-identification-v2.md) §PIO-G4-MIG
- [Gate 3 audit — `docs/design/audits/2026-05-02-gate3-research-player-identification-v2.md`](../../design/audits/2026-05-02-gate3-research-player-identification-v2.md) §PIO-G3-MIG
- [Table-Build schema-delta — `docs/projects/table-build/schema-delta.md`](../table-build/schema-delta.md) (existing v22 spec; unified with PIO here)

---

## Why this spec exists

PIO Gate 3 specified an additive-only IDB v22 migration with multi-store creation in single bump (per EAL v18→v19 precedent). Table-Build (Gate 4 ratified 2026-04-26) ALSO specified v22 in its `schema-delta.md`. Both projects target the SAME version. PIO Gate 4 ratified Decision 1 (unified v22) — both projects' migrations land in the same v21→v22 bump.

This spec is the unified migration plan. Coordination contract: whichever Gate 5 ships first owns the v22 bump in `database.js`; the other project piggybacks (additive-only invariant preserved).

---

## v22 store inventory (combined PIO + Table-Build)

| Store | Owner | Type | Schema reference |
|---|---|---|---|
| `players` (existing) | Table-Build | Schema upgrade | Table-Build `schema-delta.md` §3-4: avatarFeatures envelope wrapper around legacy flat shape; ethnicity getter shim (legacy `string` → `string[]`); hat shape migrate-on-read getter shim (flat → envelope) |
| `seatClothingObservations` (NEW) | Table-Build | Store creation | Table-Build `schema-delta.md` §5: today-only observation parallel store |
| `sightingLogs` (NEW) | PIO | Store creation | Gate 3 PIO-G3-SLOG: per-event append-only; 5 indexes (`playerId`, `playerId+sessionId`, `featuresSeen`, `capturedAt`, `venueId`) |
| `playerPhotos` (NEW) | PIO | Store creation | Gate 3 PIO-G3-PHOTO: blobId → Blob; cascade-on-delete; atomic-txn binding to Player record `photoBlobId` reference |

---

## `sightingLogs` schema (NEW; PIO-G3-SLOG)

```javascript
{
  // Composite primary key — implicit auto-incrementing 'id' field for IDB
  id: <auto-increment integer>,

  // Required fields
  playerId: 'self' | string,        // FK to players store
  sessionId: string,                 // FK to sessions store; or 'manual-add' for owner-explicit add
  capturedAt: 1735776000000,         // ms epoch — when sighting was observed
  featuresSeen: {
    skin: string | null,
    hair: string | null,
    beard: string | null,
    glasses: string | null,
    hat: { palette, otherText } | null,
    wardrobe: { palette: string[], otherText: string },
    jewelry: { palette: string[], otherText: string },
    logo: { palette: string[], otherText: string },
    ageDecade: '20s' | '30s' | '40s' | '50s' | '60+' | null,
    ethnicity: string[] | null,
  },

  // Optional fields (Phase 2+ extension)
  venueId: string | null,            // reserved for cross-venue future; v1 always null
  photoBlobId: string | null,        // optional photo capture associated with this sighting
}
```

**Indexes (5):**

| Index name | KeyPath | Purpose |
|---|---|---|
| `by_playerId` | `.playerId` | Fast lookup of all sightings for one player |
| `by_playerId_sessionId` | `[.playerId, .sessionId]` | Per-session rollup queries |
| `by_featuresSeen_compound` | (compound on stable features) | Recognition-search optimization (Phase 2+) |
| `by_capturedAt` | `.capturedAt` | Chronological scan for sighting log render |
| `by_venueId` | `.venueId` | Cross-venue filter (Phase 2+) |

---

## `playerPhotos` schema (NEW; PIO-G3-PHOTO)

```javascript
{
  blobId: 'uuid-or-hash-string',     // Primary key
  blob: <Blob>,                       // The photo Blob (typically ~25KB JPEG quality 0.85, 256x256)
  capturedAt: 1735776000000,          // ms epoch
  playerId: string,                   // FK to players store; cascade-on-delete
}
```

**Player record reference:** `players.{playerId}.photoBlobId = 'uuid-or-hash-string'` points back to `playerPhotos.blobId`.

**Atomic-txn binding (per PIO-G3-PHOTO).** On Camera Capture Modal Accept: single IDB transaction writes `playerPhotos` + updates `players.photoBlobId`. Both succeed atomically or both rollback.

**Cascade-on-delete:** When a Player record is deleted (via PlayersView delete or PlayerEditor delete), the associated `playerPhotos` records also delete in the same transaction. Implementation in `playersStorage.js` delete flow (Gate 5).

---

## `players` schema upgrade (Table-Build §3-4 + PIO additions)

PIO adds new fields to the existing Player record schema (additive-only):

```javascript
{
  // Existing (from PEO + Table-Build)
  id: string,
  name: string,
  nickname: string,
  avatarFeatures: <envelope shape>,   // Table-Build's stability-flagged envelope
  ethnicityTags: string[],            // Table-Build's curated-list field (renamed from legacy `ethnicity: string`)
  notes: string,
  // …

  // NEW (PIO)
  ageDecade: '20s' | '30s' | '40s' | '50s' | '60+' | null,    // Decision 1 from Gate 3
  wardrobe: { palette: string[], otherText: string },          // Decision 2 hybrid
  jewelry: { palette: string[], otherText: string },           // Decision 2 hybrid
  logo: { palette: string[], otherText: string },              // Decision 2 hybrid
  photoBlobId: string | null,                                   // PIO-G3-PHOTO reference
  hat: { palette: string, otherText: string } | string,         // Envelope-or-legacy shape; getter shim adapts
}
```

**Migrate-on-read getter shims** (no v22 forced mutation; legacy records read via shim until next write):

```javascript
// Pseudocode for Gate 5 implementation in src/utils/playerMatching/recordAdapters.js

function readHat(player) {
  if (typeof player.hat === 'string') {
    return { palette: player.hat, otherText: '' };
  }
  return player.hat || { palette: '', otherText: '' };
}

function readEthnicity(player) {
  if (typeof player.ethnicity === 'string') {
    return [player.ethnicity];     // Legacy single-string → array
  }
  return player.ethnicityTags || [];
}
```

**On next write:** writers use the envelope/array shapes directly; legacy field shapes are not regenerated. Records gradually migrate to new shapes through normal owner edits.

---

## Migration ordering (single v21→v22 bump)

`database.js` v21→v22 upgrade callback (Gate 5 implementation):

```javascript
// Pseudocode — Gate 5 implements
function upgradeFromV21ToV22(transaction, db) {
  // 1. Existing 'players' store schema upgrade (Table-Build §3-4)
  //    - avatarFeatures envelope wrapper (no migration; getter shim handles legacy reads)
  //    - ethnicityTags field (no migration; getter shim handles legacy `ethnicity: string`)
  //    - hat envelope shape (no migration; getter shim handles legacy flat-string)

  // 2. Create seatClothingObservations store (Table-Build §5)
  if (!db.objectStoreNames.contains('seatClothingObservations')) {
    const store = db.createObjectStore('seatClothingObservations', { keyPath: 'id', autoIncrement: true });
    store.createIndex('by_sessionId', 'sessionId');
    store.createIndex('by_seatId_sessionId', ['seatId', 'sessionId']);
    // ... per Table-Build schema-delta §5
  }

  // 3. Create sightingLogs store (PIO-G3-SLOG)
  if (!db.objectStoreNames.contains('sightingLogs')) {
    const store = db.createObjectStore('sightingLogs', { keyPath: 'id', autoIncrement: true });
    store.createIndex('by_playerId', 'playerId');
    store.createIndex('by_playerId_sessionId', ['playerId', 'sessionId']);
    store.createIndex('by_capturedAt', 'capturedAt');
    store.createIndex('by_venueId', 'venueId');
  }

  // 4. Create playerPhotos store (PIO-G3-PHOTO)
  if (!db.objectStoreNames.contains('playerPhotos')) {
    const store = db.createObjectStore('playerPhotos', { keyPath: 'blobId' });
    store.createIndex('by_playerId', 'playerId');
    store.createIndex('by_capturedAt', 'capturedAt');
  }
}
```

**Idempotent.** All store creation is gated by `if (!db.objectStoreNames.contains(...))` — safe to run multiple times. Whichever project ships first creates the stores; the other project skips creation but uses them.

---

## Coordination contract

**Whichever Gate 5 ships first owns the v22 bump.** Concrete behavior:

### Scenario A: Table-Build Gate 5 ships first

1. Table-Build PR introduces `database.js` v21→v22 callback with steps 1+2 (players upgrade + seatClothingObservations).
2. PIO Gate 5 (later) extends the same v21→v22 callback with steps 3+4 (sightingLogs + playerPhotos).
3. PIO PR is additive: existing v22 callback is amended, not duplicated.
4. Users on v22 (post Table-Build Gate 5) get sightingLogs + playerPhotos created when PIO Gate 5 runs migrations next launch.

### Scenario B: PIO Gate 5 ships first

1. PIO PR introduces `database.js` v21→v22 callback with all 4 steps (full unified migration).
2. Table-Build Gate 5 (later) finds the v22 callback already exists; verifies steps 1+2 are present; no further migration needed for Table-Build's stores.

### Either scenario

- Both projects' Gate 5 implementations include sanity-check tests verifying ALL 4 steps land in v22.
- If Gate 5 PR review finds the unified callback missing a step, the responsible project amends.

---

## Backward compatibility

- **Legacy v21 records:** read via getter shims (hat flat-string → envelope; ethnicity string → string[]); persisted-on-next-write upgrades records in place.
- **No data backfill required** — migrations are additive; new fields default to `null` / `[]` / empty envelope until owner explicitly sets them.
- **Downgrade NOT supported.** v22 is one-way (standard IDB invariant; matches EAL v18→v19 + earlier v-bumps). Owner cannot revert to v21 without data loss.

---

## Migration test cases (Gate 5 deliverable)

Per Table-Build `schema-delta.md` §6 + Gate 3 PIO-G3-MIG additions, ≥12 fixture cases:

1. Empty v21 IDB — v22 callback runs cleanly; all 4 stores created.
2. v21 IDB with players records (legacy flat hat / string ethnicity) — getter shims adapt reads; records persist unchanged until next write.
3. v21 IDB with full Table-Build pre-test data — Table-Build steps 1+2 idempotent.
4. v22 IDB with PIO Gate 5 not-yet-shipped, then PIO Gate 5 PR runs — sightingLogs + playerPhotos created post-hoc.
5. Legacy `hat: 'cap-team'` (flat string) read → returns `{ palette: 'cap-team', otherText: '' }`.
6. Legacy `ethnicity: 'Irish'` (single string) read → returns `['Irish']`.
7. Player record write after legacy read → persists envelope shape; legacy field absent on next read.
8. `sightingLogs.put({ playerId: 'p1', sessionId: 's1', capturedAt: 123, featuresSeen: {...} })` → stored correctly; queryable via all 5 indexes.
9. `playerPhotos.put({ blobId: 'b1', blob: <Blob>, capturedAt: 123, playerId: 'p1' })` → stored; queryable by `by_playerId`.
10. Player record delete → cascade deletes associated `playerPhotos.{blobId}` records in same transaction.
11. Atomic-txn rollback simulation: simulated playerPhotos.put failure → players record `photoBlobId` rollback (NOT updated).
12. v22 → v22 (idempotent re-run): no errors; no duplicate stores.

---

## Anti-pattern compliance

| AP-PIO | Verdict |
|---|---|
| AP-PIO-01 | N/A (migration spec, not inference) |
| AP-PIO-02 | N/A (data layer; surface boundaries enforce sourceUtilPolicy whitelist) |
| AP-PIO-03 | N/A |
| AP-PIO-04 | N/A |
| AP-PIO-05 | N/A — but: schema includes demographic fields (ethnicity, age decade) for identification utility per memory binding (`feedback_pio_identification_utility_first.md`). Cultural-sensitivity binding affirmed: schema CAPTURES demographics; surfaces RENDER for identification; never propose recommendations keyed on demographics. |

---

## Open questions deferred to Gate 5

1. **Whichever-ships-first owner choice.** Owner picks at Phase 5 entry: Table-Build Gate 5 first OR PIO Gate 5 first OR both shipped together (single coordinated PR sequence).
2. **`venueId` Phase 2+ activation.** v1 always `null`; Phase 2+ adds venue tagging to sightings + cross-venue filter affordances.
3. **Photo retention TTL.** v1 photos persist indefinitely; Phase 2+ may add auto-expiration.
4. **Per-photo incognito mode** (red line #9 deferral). v1 always writes captured photo; Phase 2+ may add per-capture incognito (preview-without-commit).

---

## Change log

- 2026-05-02 — Created (PIO Gate 4 / WS-007 / SPR-021). Unified v22 migration spec coordinating PIO + Table-Build. 4 stores in single bump (players upgrade + seatClothingObservations + sightingLogs + playerPhotos). Coordination contract: whichever Gate 5 ships first owns the bump. Implementation deferred to PIO Gate 5.
