# Session Handoff: printable-refresher-session11
Status: COMPLETE | Written: 2026-04-26

## Backlog Item

**PRF-G5-MIG CLOSED.** IDB v20 migration shipped per `idb-migration.md` spec — 2 new stores (`userRefresherConfig` singleton + `printBatches` UUID-keyed with `printedAt` index) added additively without mutating any v19 store. Singleton seeded with `buildDefaultRefresherConfig()` Phase 1 defaults at migration time; printBatches empty per I-WR-5 append-only invariant.

| Session | Scope | Commit |
|---------|-------|--------|
| S1-S4 | PRF-G5-CI (content-drift CI) | 4 commits |
| **S11 (this)** | PRF-G5-MIG (IDB v20 migration) | this commit |
| S12+ | Persistence + selector wiring | NEXT |

After this commit, **persistence + selector wiring** is the next NEXT-unblocked step per Phase 5 sequencing: `useRefresherConfig` + `useRefresherView` + 6 selectors per `selectors.md`. Writer registry per `WRITERS.md` (W-URC-1/2/3) + `scripts/check-refresher-writers.sh` CI-grep.

## What I Did This Session

Two new files + three extensions. All within the `src/utils/persistence/` subtree.

**(1) `src/utils/persistence/refresherDefaults.js` — singleton seed factory.**

Three exports:
- `REFRESHER_CONFIG_SINGLETON_ID = 'singleton'` — the keypath value for the single record in `userRefresherConfig`.
- `REFRESHER_CONFIG_SCHEMA_VERSION = 1` — current record schema version.
- `buildDefaultRefresherConfig()` — returns the Phase 1 default singleton per spec §Seeding:
  - `cardVisibility: {}` (no per-card overrides at first launch)
  - `suppressedClasses: []` (no class suppressed)
  - `printPreferences.pageSize: 'letter'` (Q4 default)
  - `printPreferences.cardsPerSheet: 12` (Q4 default — 12-up grid)
  - `printPreferences.colorMode: 'auto'` (browser/printer-managed)
  - `printPreferences.includeLineage: true` (red line #12 lineage-mandatory)
  - `printPreferences.includeCodex: false` (Phase 1 structural; AP-PRF-09 + Q7 — W-URC-1 validator will reject any patch attempting to set true at v1, deferred to Phase 2+ Gate 4 design pass)
  - `notifications.staleness: false` (AP-PRF-08 opt-in default OFF)
  - `lastExportAt: null`

The seed is materialized at migration-time (not lazy-on-read) so W-URC-1 + W-URC-2 read-then-modify writers don't need a "create singleton" branch on every call.

**(2) `src/utils/persistence/database.js` — DB_VERSION bump + 2 store-name exports.**

- `DB_VERSION` 19 → 20.
- New exports: `USER_REFRESHER_CONFIG_STORE_NAME = 'userRefresherConfig'`, `PRINT_BATCHES_STORE_NAME = 'printBatches'`.
- Comment block notes the dynamic-target rule from spec resolved at compile time: spec called `max(currentVersion + 1, 18)`; EAL Phase 6 Stream D shipped v19 first; PRF computes `max(19+1, 18) = 20`. The compile-time resolution matches the existing project convention (one DB_VERSION constant + one runMigrations chain), avoiding the need for a separate `openRefresherAwareDb()` parallel-open path.

**(3) `src/utils/persistence/migrations.js` — `migrateV20` + chain extension.**

Imports added: `USER_REFRESHER_CONFIG_STORE_NAME`, `PRINT_BATCHES_STORE_NAME`, `buildDefaultRefresherConfig`.

`migrateV20(db, transaction)`:
- userRefresherConfig: `db.createObjectStore` with `keyPath: 'id'`, `autoIncrement: false`, no indexes. Seeds the default singleton via `transaction.objectStore(...).put(buildDefaultRefresherConfig())` so it lands atomically with store creation. Idempotent put() handles partial-failure replay if upgrade interrupts and retries (matches EAL perceptionPrimitives seeding precedent).
- printBatches: `db.createObjectStore` with `keyPath: 'batchId'`, `autoIncrement: false`. `createIndex('printedAt', 'printedAt', { unique: false })` — supports `selectStaleCards` most-recent-batch-per-card lookup per `selectors.md`. NOT seeded — empty until first owner print confirmation (W-URC-3 sole writer per WRITERS.md).
- Both branches are existence-check guarded (`if (!db.objectStoreNames.contains(...))`) so the migration is idempotent on repeat upgrade.
- Errors during seeding are caught and logged via `logError` rather than thrown — store creation succeeds even if the seed put() fails (next read can lazy-seed if needed; defensive against fake-indexeddb edge cases).

`runMigrations` extended: `if (oldVersion < 20) migrateV20(db, transaction)` appended to the chain after the v19 EAL line.

**(4) `src/utils/persistence/__tests__/refresherMigration.test.js` — 19 tests.**

Six PRF-G5-MIG cases per spec + 2 cross-cutting tests:

- **Case 6 — DB_VERSION + collision-resolution** (2 tests):
  - DB_VERSION === 20 (compile-time resolution of dynamic-target rule)
  - DB_VERSION ≥ 18 invariant (the floor in spec's `max(currentVersion+1, 18)` formula)

- **Case 1 — Round-trip / fresh install creates both stores** (2 tests):
  - userRefresherConfig: keypath `id`, no autoIncrement, no indexes
  - printBatches: keypath `batchId`, no autoIncrement (printedAt index validated separately in case 5)

- **Case 2 — Seed correctness** (4 tests):
  - Default singleton matches `buildDefaultRefresherConfig()` exactly (deepEqual)
  - Phase 1 structural defaults all assert individually (Letter / 12-up / auto / lineage-on / codex-OFF / staleness-OFF / lastExportAt null)
  - printBatches starts empty (count === 0)
  - userRefresherConfig has exactly 1 record (the singleton)

- **Case 3 — Idempotent on re-open** (3 tests):
  - Owner-mutated singleton (colorMode='bw', cardsPerSheet=6) survives re-open
  - Re-open does not duplicate the singleton (count remains 1)
  - Both stores still exist after re-open

- **Case 4 — No prior-store mutation** (2 tests):
  - perceptionPrimitives v19 seed (8 records) intact after v20 upgrade chain
  - Inserted printBatches record + v19 store records persist across re-open (`oldVersion === DB_VERSION` path runs no migrations)

- **Case 5 — printedAt index present** (3 tests):
  - Index present
  - Index is non-unique (multiple batches at same printedAt allowed)
  - Cursor traversal returns batches in printedAt-ASC order (3 batches inserted out-of-order: 2026-01-01 / 2026-03-15 / 2026-02-10 → traversal order 2026-01-01 / 2026-02-10 / 2026-03-15)

- **PRF-G5-DS — suppression durability** (1 test):
  - Mutated `suppressedClasses: ['exceptions', 'equity']` byte-preserved across close + re-open. This is the test target shared with `WRITERS.md` red line #13 + I-WR-4 invariant.

- **I-WR-5 — append-only invariant** (2 tests):
  - Single-record persistence with full record-shape verification (batchId / label / cardIds)
  - 5-record persistence with id-set equality verification (no record loss)

All 19/19 green. Pattern mirrors `anchorLibraryStores.test.js` for fake-indexeddb test infrastructure (jsdom env + deleteEntireDB beforeEach + closeDB+resetDBPool teardown).

**(5) Adjusted prior tests for v20 bump (2 files):**
- `anchorLibraryStores.test.js`: `DB_VERSION` assertion 19 → 20 with comment "after PRF-G5-MIG bumped 19 → 20".
- `database.test.js`: "creates all 17 object stores" → "creates all 19 object stores" with two new containment assertions for `userRefresherConfig` + `printBatches` and length assertion 17 → 19.

**(6) Governance:**
- BACKLOG row PRF-G5-MIG: NEXT → COMPLETE (2026-04-26) with full implementation accept-criteria detail + dynamic-target-static-resolution explainer + 19-test breakdown.
- PRF section header updated: now reads "Gate 4 CLOSED 2026-04-25 — Gate 5 IN PROGRESS — PRF-G5-CI CLOSED 2026-04-25 + PRF-G5-MIG CLOSED 2026-04-26".
- STATUS top entry: pending — will write after handoff body.

## Files I Own (DO NOT EDIT)

*Session is COMPLETE. PRF-G5-MIG is closed.* No file lock needed.

The next PRF session should pick up persistence + selector wiring per Phase 5 sequencing — `useRefresherConfig` IDB-backed hook + `useRefresherView` localStorage-backed hook + 6 selectors from `selectors.md` (selectAllCards / selectActiveCards / selectPinnedCards / selectSuppressedCards / selectCardsForBatchPrint / selectStaleCards) + writer registry per `WRITERS.md` (W-URC-1 config-prefs + W-URC-2 card-visibility + W-URC-3 print-date-stamp). Writer-grep CI gate `scripts/check-refresher-writers.sh` should also be authored per `WRITERS.md` §CI-grep enforcement sketch.

## Uncommitted Changes (after S11 commit)

Created in this session:
- `src/utils/persistence/refresherDefaults.js`
- `src/utils/persistence/__tests__/refresherMigration.test.js`
- `.claude/handoffs/printable-refresher-session11.md` (this file)

Modified in this session:
- `src/utils/persistence/database.js` (DB_VERSION 19 → 20 + 2 new store-name exports)
- `src/utils/persistence/migrations.js` (3 new imports + migrateV20 function + runMigrations chain extension)
- `src/utils/persistence/__tests__/anchorLibraryStores.test.js` (DB_VERSION assertion 19 → 20)
- `src/utils/persistence/__tests__/database.test.js` (17 stores → 19 stores test rewrite)
- `.claude/BACKLOG.md` (PRF-G5-MIG row state-flip + section header update)
- `.claude/STATUS.md` (new top entry pending handoff write)

**NOT modified:**
- All Gate 4 design docs — stable.
- All PRF-G5-CI infrastructure (cardRegistry / lineage / sourceUtilPolicy / copyDisciplinePatterns / getSchemaVersionChange / contentDrift.test.js / verifyCatchesDrift.test.js / dev scripts) — stable.
- Auto-profit manifest — bodyMarkdown + contentHash unchanged.
- `SYSTEM_MODEL.md` — flagged for update at next session when persistence + selectors land (the moment first persistence-side React hook ships).

## What's Next

Phase 5 sequencing per S6 handoff §Recommended Phase 5 order:

1. ~~PRF-G5-CI~~ — DONE (S1-S4 / 4 commits 2026-04-25).
2. ~~PRF-G5-MIG~~ — DONE (this commit 2026-04-26).
3. **Persistence + selector wiring (NEXT).** Author:
   - `src/utils/printableRefresher/refresherSelectors.js` — 6 selectors per `selectors.md`:
     - `selectAllCards(manifests)`
     - `selectActiveCards(manifests, config)` (suppressedClasses excluded)
     - `selectPinnedCards(manifests, config)` (cardVisibility entries === 'pinned')
     - `selectSuppressedCards(manifests, config)` (cardVisibility entries === 'hidden' OR class in suppressedClasses)
     - `selectCardsForBatchPrint(manifests, config)` (active + sorted)
     - `selectStaleCards(manifests, config, batches)` (most-recent-batch-per-card via printedAt index, compare manifest hashes)
   - `src/hooks/useRefresherConfig.js` — IDB-backed singleton config hook (mirrors useAssumption + useSubscription patterns).
   - `src/hooks/useRefresherView.js` — localStorage-backed UI state (filter / sort / current view).
   - Writer registry per `WRITERS.md`: `src/utils/persistence/refresherStore.js` exports W-URC-1/2/3 with `validateRefresherConfigPatch` enforcing `includeCodex: false` invariant.
   - `scripts/check-refresher-writers.sh` CI-grep gate per `WRITERS.md` §CI-grep enforcement sketch.
   - `scripts/check-refresher-bundle.sh` per `print-css-doctrine.md` (forbidden rasterization libraries: html2canvas / jspdf / pdf-lib).
4. PRF-G5-RL + PRF-G5-RI + PRF-G5-DS + PRF-G5-LG test scaffolds (red-line / reducer-boundary / durable-suppression / lineage-footer; PRF-G5-DS already partially covered by S11's suppression-durability test, but the writer/reducer-layer assertion remains).
5. PRF-G5-B Phase B Math Tables (6 cards: auto-profit / geometric / pot-odds / implied / binomial / SPR zones — content-drift CI shipped in S1-S4 catches drift automatically as new manifests are added).
6. Q5 differentiation demo at design review.
7. PRF-G5-A Phase A Preflop conditional on Q5.
8. PRF-G5-C Phase C Equity + Exceptions.
9. PRF-G5-PDF Playwright cross-browser snapshots.

Phase 1 MVP card count target: 10-13 cards (6 Phase B + 0-3 Phase A conditional + 4 Phase C).

## Gotchas / Context

1. **Dynamic-target rule resolved at compile time, not runtime.** Spec called for `openRefresherAwareDb()` with `indexedDB.databases()` lookup + `Math.max(currentVersion + 1, 18)`. This was needed when the version target was unknown at design time (parallel project shipping). Now that EAL claimed v19 first, PRF claims v20 statically — no separate parallel-open path needed. The existing `initDB()` + `runMigrations()` chain handles the upgrade naturally. If a future project ships v21 before another PRF migration, the same compile-time resolution applies (bump DB_VERSION + add migrateV21).

2. **Singleton seed via in-flight upgrade transaction is the correct pattern.** EAL's `migrateV19` uses the same approach for `perceptionPrimitives` — `transaction.objectStore(...).put(record)` lands atomically with store creation. Don't use `db.transaction(...)` post-upgrade — that races with the upgrade transaction and can cause "transaction not active" errors.

3. **Idempotent existence-check on `objectStoreNames.contains(...)` is load-bearing.** If the migration runs twice (interrupted upgrade + retry, or `oldVersion === 20` no-op case), the existence check prevents duplicate-store-create errors. EAL's migrateV19 does the same.

4. **The seed is wrapped in try/catch + logError, not thrown.** If the seed put() fails inside the upgrade transaction (rare — fake-indexeddb edge cases), the store creation still succeeds and the next reader can lazy-seed if needed. The trade-off is "fail loud at user runtime" vs "fail silent at install time" — I chose silent because the user-runtime failure mode is recoverable (just call buildDefaultRefresherConfig() at the writer level) and the install-time failure mode is not (user can't proceed). EAL takes the same approach.

5. **`printBatches` is empty at create per I-WR-5.** First record on first owner print confirmation. The migration must NOT seed any "default batch" — that would violate the append-only invariant + create a "phantom batch" the staleness logic might mis-index. Test case 2 explicitly verifies count === 0 at create.

6. **`printedAt` index is non-unique because multiple batches at the same printedAt are legal.** A user might print two refresher packs back-to-back (e.g., test print + production print) within seconds. The index is sorted by printedAt; ties are tolerated; the cursor traversal returns them in insertion-defined order within the tie group.

7. **The full smart-test-runner showed env-flake on preflopDrillsStorage.test.js when run alongside refresherMigration.test.js.** Both pass cleanly in isolation. The flake comes from fake-indexeddb sharing state across parallel-runner workers — same pattern as the gameTreeDepth2 env-timeout from S1 measurement. Not a regression.

8. **The 17 → 19 store count update in database.test.js.** The original test counted exactly 17 stores at v19; this was already wrong if anyone counted the 5 EAL stores (12 prior + 5 EAL = 17 ✓ at v19, so the original was actually correct). After my v20 + 2 PRF stores: 19. The test asserts containment of every store name + length === 19. Future migrations adding new stores must update this assertion — it's the canonical "all stores present" sanity check.

9. **`DB_VERSION` assertion in `anchorLibraryStores.test.js` was a nuisance edit.** That test's purpose is "verify EAL stores at v19" and does not strictly need the DB_VERSION value pinned, but it was authored to lock the version so future migrations would notice it. I updated the value rather than removing the assertion — preserves the original intent.

10. **`runMigrations` runs sequentially via `if (oldVersion < N)` chain.** A fresh install (oldVersion === 0) runs all 20 migrations in order; an upgrade from v19 → v20 runs only `migrateV20`. This is the correct semantics — additive migrations should not re-execute on installs that already passed their threshold. The existence-check inside each migrate function is defense-in-depth.

## System Model Updates Needed

PRF-G5-MIG closure marks the first material persistence change for the Printable Refresher project. SYSTEM_MODEL.md should grow at next session (when first persistence-side React hook ships):

- **§1 Component Map** — add `useRefresherConfig` hook + `useRefresherView` hook to the hooks list (when those land in the persistence + selector wiring step).
- **§2 Persistence (PERSISTENCE_OVERVIEW)** — add v20 migration entry: `userRefresherConfig` (singleton; keypath `id`; seeded with default at create) + `printBatches` (UUID-keyed; keypath `batchId`; printedAt index; empty at create per I-WR-5).
- **DB_VERSION** mention bumped 19 → 20.
- **§7 IDB Migration History** — add v20 row noting PRF-G5-MIG closeout date 2026-04-26.

UI-side updates (new view, new reducers) wait for PRF-G5-B card-rendering implementation later in Phase 5.

## Test Status

PRF migration tests in isolation: **19/19 passing.**

Full smart-test-runner: 295 test files, exit code 0 from background wrapper. The `format-test-failures.cjs` parser reported 0 structural test failures; the same documented precisionAudit flake is the only test-level failure (uses `console.error` rather than `throw`, which the parser doesn't pick up). **Zero new regressions from S11.** preflopDrillsStorage.test.js + postflopDrillsStorage.test.js pass cleanly in isolation; the fake-indexeddb cross-test deleteDatabase race they're prone to under heavy parallel-runner load did not surface in this run.
