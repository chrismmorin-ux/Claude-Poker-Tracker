# PIO IDB v23 — shipped record (WS-160 / SPR-034)

**Shipped:** 2026-05-04 (PIO Gate 5 child A / WS-160 / SPR-034)
**Author of spec:** see `idb-v22-migration-spec.md` (PIO Gate 4 / WS-007)
**Coordination outcome:** Spec assumed "v22 owned by whichever Gate 5 ships first." That binding became moot — heroLeaks (SCF Gate 5 / WS-145) shipped at v22 on 2026-05-03. PIO bumps cleanly to **v23** independently. Table-Build Gate 5 (when it ships) bumps to v24+.

---

## What landed

- `DB_VERSION` 22 → 23 (`src/utils/persistence/database.js`).
- Two new constants: `SIGHTING_LOGS_STORE_NAME = 'sightingLogs'`, `PLAYER_PHOTOS_STORE_NAME = 'playerPhotos'`.
- `migrateV23(db, transaction)` callback in `src/utils/persistence/migrations.js`:
  - Creates `sightingLogs` object store. Keypath `sightingId`, autoIncrement. **5 indexes:** `by_playerId`, `by_playerId_sessionId` (composite), `by_featuresSeen` (multiEntry), `by_capturedAt`, `by_venueId`.
  - Creates `playerPhotos` object store. Keypath `blobId`, autoIncrement. **1 index:** `by_playerId` (for cascade-on-delete).
  - Walks `players` cursor → adds defaults for 6 new fields: `ageDecade: null`, `ethnicityTags: []`, `wardrobe: []`, `jewelry: []`, `logo: []`, `photoBlobId: null`. Idempotent — only writes when `=== undefined`.
- Two CRUD modules: `sightingLogsStore.js` (5 functions) + `playerPhotosStore.js` (3 functions). Both follow the `heroLeaksStore.js` shape.
- Barrel exports added in `src/utils/persistence/index.js`.

## What did NOT land (deferred to other PIO children)

- Camera Capture Modal flow (WS-161) — uses `playerPhotos.savePhoto()` for the atomic-txn binding.
- Player Profile View (WS-162) — uses `sightingLogs.getSightingsForPlayer()` + `computeStability()`.
- PlayersView/PlayerEditor extensions for the 6 new attribute fields (WS-163).
- Recognition-search ranking (WS-164) — depends on Table-Build Gate 5 surface.
- Settings photo-toggle + CI-grep (WS-165).
- Hat-field flat-string → envelope upgrade (read-shim in `playersStore.js`; not migrated; Table-Build's concern).

## What also landed (utility scaffold)

`src/utils/playerMatching/computeStability.js` — Bayesian-Beta posterior over historical sightings per audit §PIO-G3-STAB. Returns `{posterior, confidence: 'always'|'sometimes'|'today-only', moe, sampleSize}`. Confidence bands per audit:
- `posterior >= 0.85` → `'always'`
- `0.40 <= p < 0.85` → `'sometimes'`
- `posterior < 0.40` → `'today-only'`

Uses `SIGHTING_FEATURE_PRIORS` lookup (currently empty scaffold → uniform-prior fallback). Corpus-tuned priors deferred to WS-162 (Player Profile View) authoring or a follow-up.

## Tests

- `sightingLogsStore.test.js` — 13 cases: preconditions + round-trip + index queries + cascade delete.
- `playerPhotosStore.test.js` — 9 cases: preconditions + blob round-trip + cascade delete.
- `computeStability.test.js` — 11 cases: cold start + single sighting + all-same + half-vary + minority match + most-recent reference + array-valued attributes + MoE narrowing.
- `database.test.js` — extended for v23 store count (21 → 23).
- `anchorLibraryStores.test.js` — `DB_VERSION` assertion bumped 22 → 23.

**Verification:** 9826 passed / 30 skipped / 0 failed (+33 net). Build clean (5.68s).
