# Session Handoff: printable-refresher-session12
Status: COMPLETE | Written: 2026-04-26

## Backlog Item

**PRF-G5-SL + PRF-G5-ST CLOSED.** The persistence + selector wiring step is split into 4 sub-deliverables across multiple sessions:

| Sub-deliverable | Status | Commit |
|---|---|---|
| PRF-G5-SL — selectors | **DONE (S12)** | this commit |
| PRF-G5-ST — store CRUD wrappers | **DONE (S12)** | this commit |
| PRF-G5-WR — writer registry + CI-grep | NEXT (gated on SL+ST green ✓) | TBD |
| PRF-G5-HK — React hooks + bundle-grep CI | BLOCKED by PRF-G5-WR | TBD |

After PRF-G5-WR ships, PRF-G5-HK will land context + reducer + persistence hook. Then PRF-G5-RL/RI/DS/LG test scaffolds, then PRF-G5-B Phase B Math Tables card authoring (which is the load-bearing visible-owner-value chain).

## What I Did This Session

Two new modules + two new test files. All in the existing `src/utils/printableRefresher/` and `src/utils/persistence/` namespaces.

**(1) `src/utils/printableRefresher/refresherSelectors.js` — read-side selector library.**

Six selectors per `selectors.md` v1.0 + `annotateCard()` helper:

- `selectAllCards({ cardRegistry, userRefresherConfig }) → AnnotatedCard[]` — base read; never filters; never hides. Used for catalog "Show suppressed" full view + as the source set for partition tests. Red line #6 (flat access).

- `selectActiveCards({ cardRegistry, userRefresherConfig })` — default catalog read; excludes hidden + class-suppressed. Used for default catalog render + default print-export + staleness-diff base set.

- `selectPinnedCards({ cardRegistry, userRefresherConfig })` — visibility === 'pinned' subset; used for "Pinned-first" sort + multi-page print leading-page placement. Trusts the writer-layer contract that pinning un-hides (W-URC-2 coupling).

- `selectSuppressedCards({ cardRegistry, userRefresherConfig })` — hidden OR class-suppressed; the inverse of `selectActiveCards`. Constraint: `selectActive ∪ selectSuppressed === selectAll`, intersection empty.

- `selectCardsForBatchPrint({ cardRegistry, userRefresherConfig }, selectedIds)` — selectedIds filtered to active. Defense-in-depth: if a UI bug allows selecting a suppressed card, this selector still drops it from the print set. Caller can compare lengths to surface a "1 selected card was suppressed + excluded from print" warning in PrintConfirmationModal.

- `selectStaleCards({ cardRegistry, userRefresherConfig }, printBatches) → StaleCard[]` — active cards whose current contentHash differs from the most-recent print snapshot. Implementation:
  - Sorts batches by `printedAt` DESC internally (callers can pass unsorted batches).
  - Iterates in DESC order to build a most-recent-batch-per-cardId index.
  - Cards never printed → not stale (no laminate to be stale).
  - Hidden + class-suppressed cards excluded from active → not stale.
  - Matching hash → current; diverging hash → stale (returned with `isStale: true` + `currentHash` + `printedHash` + `printedAt` + `batchId` + `batchLabel`).

- `annotateCard(card, userRefresherConfig)` — pure helper exported for tests + reuse. Returns `{...card, visibility, classSuppressed, isStale, staleSinceBatch}` with `visibility` from `cardVisibility[cardId]` map (rejects unrecognized values back to `'default'`) and `classSuppressed` from `suppressedClasses` array containment.

**(2) `src/utils/printableRefresher/__tests__/refresherSelectors.test.js` — 39 tests.**

Coverage breakdown:
- annotateCard: 6 tests (default state / visibility from map / classSuppressed from array / preserves card fields / isStale + staleSinceBatch null-init / unrecognized visibility falls back).
- selectAllCards: 4 tests (returns all / annotates correctly / empty-registry / null-or-undefined-registry).
- selectActiveCards: 4 tests (excludes hidden / excludes class-suppressed / includes pinned / combines both filters).
- selectPinnedCards: 2 tests (returns pinned / empty when none).
- selectSuppressedCards: 3 tests (returns hidden / returns class-suppressed / union no duplicates).
- **PRF-G5-SL-PARTITION** (1 test): `selectActive ∪ selectSuppressed === selectAll`, intersection empty, asserted across mixed visibility + class-suppression state.
- selectCardsForBatchPrint: 5 tests (returns selected / drops hidden defense-in-depth / drops class-suppressed / empty selectedIds / null selectedIds graceful).
- selectStaleCards: 8 tests (stale detected / current excluded / never-printed not stale / only-most-recent-batch compared / hidden+suppressed never stale / empty batches / null batches graceful / out-of-order batches sort internally).
- **4 state-clear-asymmetry roundtrip tests** (R-8.1 from Sidebar Rebuild doctrine):
  - **PRF-G5-SL-ROUNDTRIP-PIN** — pinned card in active + pinned, not in suppressed.
  - **PRF-G5-SL-ROUNDTRIP-HIDE** — hidden card in all (annotated 'hidden') + suppressed, not in active.
  - **PRF-G5-SL-ROUNDTRIP-SUPPRESS** — class-suppressed cards excluded from active + included in suppressed + annotated `classSuppressed: true` in all.
  - **PRF-G5-SL-ROUNDTRIP-UNSUPPRESS** — canonical zero-data-loss proof: pin 3 cards → suppress class → un-suppress class → all 3 still pinned. The test reconstructs the writer-state evolution (3 snapshots of `userRefresherConfig`) and asserts selector reads at each step. The pinned-id set at t0 equals the pinned-id set at t2 (after un-suppress) — explicit byte-for-byte preservation of `cardVisibility` through the suppress/un-suppress cycle.
- 2 purity/memoization guardrails (no-mutation of inputs / deterministic equal-output for equal-input).

**(3) `src/utils/persistence/refresherStore.js` — IDB CRUD wrappers.**

Six exports:
- `getRefresherConfig()` — reads the singleton; lazy-creates default if missing (defense-in-depth for corrupted-DB recovery; the migration seeds it but a corrupted state would otherwise return null and crash callers).
- `putRefresherConfig(record)` — throws on null record / missing record.id / wrong record.id (must be `'singleton'`). Last-write-wins via id-keyed put().
- `putPrintBatch(record)` — throws on null record / empty batchId / empty printedAt. The writer layer (W-URC-3) generates fresh UUIDs so duplicate-id overwrites should never occur in production; the wrapper does NOT enforce append-only at the IDB level (that's a writer-layer responsibility per WRITERS.md I-WR-1 + I-WR-5 invariants).
- `getPrintBatch(batchId)` — single-record read; null when not found; throws on empty batchId.
- `getAllPrintBatches()` — returns all batches sorted by `printedAt` DESC (most recent first). Sorting at the wrapper level removes the burden from every caller and matches the read-pattern used by `selectStaleCards`.
- `getPrintBatchesForCard(cardId)` — filters `getAllPrintBatches()` to those including the cardId. Used for per-card lineage modals + "show batch history for this card" surfaces (Phase 5+).

This is the **data layer** — pure IDB primitives with input validation + log/error wrappers. Writer-ownership enforcement (W-URC-1/2/3 per WRITERS.md) is deferred to PRF-G5-WR `writers.js` next session, which composes with these primitives.

Mirrors EAL `anchorObservationsStore.js` pattern: synchronous input-validation throws with `non-empty string` messages; IDB errors logged via `logError` then propagated.

**(4) `src/utils/persistence/__tests__/refresherStore.test.js` — 21 tests.**

- userRefresherConfig (10 tests): seed-default-on-first-read / lazy-create-when-singleton-missing (corrupted-DB recovery) / put-then-get round-trip with mutated colorMode + cardsPerSheet / 4 input-validation rejects (null record / missing id / wrong id) / only-1-record-after-N-puts (id-keyed put is upsert).
- printBatches (10 tests): put-then-get round-trip / null-when-not-found / 4 input-validations (empty batchId in put / missing printedAt in put / null record in put / empty batchId in get); getAllPrintBatches empty / DESC-sorted (3 batches inserted out-of-order: 2026-01-01 / 2026-04-26 / 2026-02-15 → returned in DESC order) / field-preservation-end-to-end with label + cardIds + perCardSnapshots; getPrintBatchesForCard filtered (3-batch fixture: 2 contain card A, 2 contain card B, 1 contains both — selectors return correct subsets in DESC order) / empty-when-not-printed / empty-cardId-rejects.
- I-WR-5 append-only (1 test): 5 distinct batches all preserved with id-set-equality verification.

**(5) Governance:**
- BACKLOG: 2 new rows added — `PRF-G5-SL` + `PRF-G5-ST` both COMPLETE (2026-04-26). 2 new placeholder rows added — `PRF-G5-WR` NEXT (gated on SL+ST green) + `PRF-G5-HK` BLOCKED by WR. Section header updated: now reads "PRF-G5-CI + PRF-G5-MIG + PRF-G5-SL + PRF-G5-ST CLOSED 2026-04-26".
- STATUS top entry: pending — will write after handoff body.

## Files I Own (DO NOT EDIT)

*Session is COMPLETE.* No file lock needed.

The next PRF session (PRF-G5-WR) should author `src/utils/printableRefresher/writers.js` exporting:
- `writeConfigPreferences(patch)` — W-URC-1; debounced 400ms; rejects `cardVisibility` / `suppressedClasses` patches; rejects `includeCodex: true` per AP-PRF-09; reads-then-merges-then-puts via `getRefresherConfig` + `putRefresherConfig`.
- `writeCardVisibility({ cardId, visibility })` + `writeSuppressedClass({ classId, suppress, ownerInitiated })` — W-URC-2; immediate; rejects `printPreferences` / `notifications` patches; suppress requires `options.confirmed === true`; un-suppress requires `options.ownerInitiated === true`.
- `writePrintBatch({ printedAt, label, cardIds, engineVersion, appVersion, perCardSnapshots })` — W-URC-3; rejects empty cardIds; rejects perCardSnapshots key-mismatch with cardIds (I-WR-6); generates `batchId` via `crypto.randomUUID()`; writes batch then invokes W-URC-1 `writeConfigPreferences({ lastExportAt: printedAt })` as final step.

Plus `scripts/check-refresher-writers.sh` CI-grep gate per `WRITERS.md` §CI-grep enforcement sketch.

## Uncommitted Changes (after S12 commit)

Created in this session:
- `src/utils/printableRefresher/refresherSelectors.js`
- `src/utils/printableRefresher/__tests__/refresherSelectors.test.js`
- `src/utils/persistence/refresherStore.js`
- `src/utils/persistence/__tests__/refresherStore.test.js`
- `.claude/handoffs/printable-refresher-session12.md` (this file)

Modified in this session:
- `.claude/BACKLOG.md` (4 new rows: 2 COMPLETE PRF-G5-SL/ST + 2 placeholder PRF-G5-WR/HK; section header update)
- `.claude/STATUS.md` (new top entry pending handoff write)

**NOT modified:**
- All Gate 4 design docs — stable.
- All PRF-G5-CI infrastructure (cardRegistry / lineage / sourceUtilPolicy / copyDisciplinePatterns / getSchemaVersionChange / contentDrift.test.js / verifyCatchesDrift.test.js / dev scripts) — stable.
- `refresherDefaults.js` / `database.js` / `migrations.js` from S11 — stable.
- Auto-profit manifest — stable.
- `SYSTEM_MODEL.md` — flagged for update at PRF-G5-HK (when first React hook lands).

## What's Next

**PRF-G5-WR — writer registry (next session).** Concrete deliverables:

1. `src/utils/printableRefresher/writers.js` — 3 writer functions per `WRITERS.md` v1.0:
   - **W-URC-1 `writeConfigPreferences(patch)`** — debounce 400ms via the hook layer; validator at writer rejects:
     - Any patch containing `cardVisibility` or `suppressedClasses` keys (I-WR-3 segregation; W-URC-2 owns).
     - `includeCodex: true` (Phase 1 enforcement of AP-PRF-09 + red line #16; no upgrade path until Phase 2+ Gate 4 design pass per PRF-P2-PE).
     - Unknown top-level keys.
   - **W-URC-2 `writeCardVisibility({ cardId, visibility })` + `writeSuppressedClass({ classId, suppress, ownerInitiated })`** — immediate, no debounce. Validators:
     - Pin/Hide writes accepted with `cardId` + `visibility ∈ {default, hidden, pinned}`.
     - Suppress writes require `options.confirmed === true` (defense at writer per red line #13 — modal confirmation already enforces; writer is defense-in-depth).
     - Un-suppress writes require `options.ownerInitiated === true` (no programmatic un-suppress per AP-PRF-05).
     - Validators reject patches containing `printPreferences` / `notifications` / `lastExportAt` keys.
   - **W-URC-3 `writePrintBatch(payload)`** — fires only from PrintConfirmationModal confirm handler (red line #15). Validators:
     - Empty `cardIds` array → reject.
     - `perCardSnapshots` keys MUST equal `cardIds` set (I-WR-6 completeness).
     - `printedAt` future > +1 day → warn (dev-mode console) but accept.
     - Generates `batchId` via `crypto.randomUUID()`; writes batch via `putPrintBatch`; final step invokes `writeConfigPreferences({ lastExportAt: printedAt })`.
   - All three writers compose with `refresherStore.js` primitives.

2. `src/utils/printableRefresher/__tests__/writers.test.js` — covers each validator's reject cases + post-write side effects.

3. `scripts/check-refresher-writers.sh` — CI-grep gate per `WRITERS.md` §CI-grep enforcement sketch:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   ALLOWED_FILES=(
     "src/utils/printableRefresher/writers.js"
     "src/utils/printableRefresher/__tests__/writers.test.js"
     "src/utils/persistence/refresherStore.js"  # primitives only used via writers
     "src/utils/persistence/__tests__/refresherStore.test.js"
     "src/utils/persistence/migrations.js"  # singleton seed at migration time
   )
   # Find all put()/delete() calls against the two stores
   # Fail if any caller is outside ALLOWED_FILES
   ```

PRF-G5-HK after that: React hooks + ESLint rule for direct `cardVisibility[` access + `scripts/check-refresher-bundle.sh` per `print-css-doctrine.md`.

## Gotchas / Context

1. **Selectors are pure; no IDB reads.** All state flows in via inputs. The hooks layer (PRF-G5-HK) reads IDB once and passes the resulting state to selectors. This separates I/O from logic and matches the `selectors.md` §Memoization contract — selectors are memoizable on shallow-equal inputs because there are no hidden side effects.

2. **`selectStaleCards` sorts batches internally.** Even though `getAllPrintBatches()` returns DESC-sorted, the selector defensively re-sorts. This means callers can pass unsorted/partial batch arrays without breaking staleness logic. Cost is one Array.sort per render — negligible at expected batch counts (low dozens at most).

3. **`selectStaleCards` uses `Date.parse` for timestamp ordering.** ISO8601 strings sort lexicographically equal to chronologically, so `string > string` would have worked too — but `Date.parse` is explicit + handles potential format drift (e.g., timezone variants). The cost is one `Date` object per batch per render; trivial at batch counts.

4. **`annotateCard` rejects unrecognized visibility values.** If `cardVisibility[cardId] === 'whatever-bad-value'`, the function falls back to `'default'`. This is defense-in-depth — a corrupted IDB state shouldn't crash render code. The schema validator at the writer layer (W-URC-2) enforces the enum set on write.

5. **`refresherStore.getRefresherConfig` lazy-creates default on missing record.** Defense-in-depth for the case where a corrupted DB returns null. The migration seeds the singleton, so this should never fire in practice — but if it does, returning the default is preferable to crashing render code with a "config is null" error. The downside: a corrupted singleton replaces with default rather than surfacing the corruption to the user. Acceptable trade-off given the read-path centrality of this function.

6. **`putPrintBatch` does NOT enforce append-only at the IDB layer.** IDB's `put()` is upsert; passing a duplicate `batchId` overwrites. The writer layer (W-URC-3) is responsible for generating fresh UUIDs via `crypto.randomUUID()` and never re-using an existing batchId. This is documented in the test "same-batchId put overwrites" — the test verifies upsert behavior + comments that production code must not call this path with a duplicate id.

7. **State-clear-asymmetry roundtrip tests are LOAD-BEARING.** They prove zero data loss across the suppress/un-suppress cycle. If a future writer-layer change accidentally clears `cardVisibility` entries when adding to `suppressedClasses`, the un-suppress roundtrip test fails. This is the canonical proof of R-8.1 doctrine compliance — do not weaken these assertions.

8. **`selectCardsForBatchPrint` defense-in-depth dropping is intentional.** Even if the UI strictly prevents selecting a suppressed card, the selector excludes it from the print set. The caller (PrintConfirmationModal) compares `selectedIds.length` to `result.length` and shows a warning if any were dropped. This is the "trust no UI" boundary per red line #13 (durable suppression at print time).

9. **`getRefresherConfig`'s default-fallback breaks the reference-equality memoization invariant on missing-record case.** When called twice on a corrupted-DB state, it returns two distinct `buildDefaultRefresherConfig()` invocations — different references. This is acceptable because: (a) the corrupted-DB path is exceptional, (b) the writer layer would put() the default on first lazy-create downstream, restoring referential stability for subsequent reads. If this becomes a real issue in production, the hook layer can cache the default at first call.

10. **No batch-deletion path in `refresherStore.js`.** I-WR-5 invariant: `printBatches` is append-only. The wrappers don't expose a delete primitive. The dev-mode batch-deleter (per WRITERS.md §I-WR-5 exception) lives at `src/__dev__/printBatchDeleter.js` (Phase 5+) and uses raw IDB transactions with a `__DEV__` guard. The CI-grep at PRF-G5-WR will assert zero `.delete(...)` calls against `printBatches` outside the dev tool.

## System Model Updates Needed

Defer until PRF-G5-HK lands the first React hook. At that point `SYSTEM_MODEL.md` should grow:
- New util namespace `src/utils/printableRefresher/` finalized: cardRegistry / lineage / sourceUtilPolicy / copyDisciplinePatterns / getSchemaVersionChange / **refresherSelectors** (S12) / writers (S13) / manifests / __tests__.
- New persistence wrapper `src/utils/persistence/refresherStore.js` (S12) — listed alongside other store wrappers.
- New CI-gate entries: writer-grep + bundle-grep (PRF-G5-WR + HK).
- Selectors module documented as the only approved read-path for `userRefresherConfig.cardVisibility[*]` per `selectors.md` §Renderer coupling rules.

## Test Status

PRF + persistence tests run together: **780/780 passing across 27 test files** (PRF-G5-CI + PRF-G5-MIG + PRF-G5-SL + PRF-G5-ST + EAL + MPMF + others).

S12 net-add: 60 tests (refresherSelectors 39 + refresherStore 21).

Full smart-test-runner: **294 test files passed; 0 structural failures parsed; same precisionAudit known flake unchanged.** Background command exit code 0. Zero new regressions from S12.
