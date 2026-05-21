# Persistence Failure Modes

**Authored:** 2026-05-14 (SPR-080, Refactor Sprint Item 7 / WS-188 Phase 1)
**Owner:** engineering program
**Scope:** every way `src/utils/persistence/` can fail — observed or theoretical.

This catalog is the canonical persistence failure-mode register. Each mode has a severity, status, primary source pointer, and mitigation strategy. New failure surfaces discovered in production land here; the catalog is append-only at the FM-PERSIST-N namespace.

Companion docs:
- `docs/persistence/CACHE_CONTRACTS.md` — staleness contracts per cache surface.
- `.claude/decisions/2026-05-14-schema-versioning-policy.md` (ADR-PERSIST-1)
- `.claude/decisions/2026-05-14-multi-store-migration.md` (ADR-PERSIST-2)
- `.claude/decisions/2026-05-14-append-only-stores.md` (ADR-PERSIST-3)
- `.claude/decisions/2026-05-14-blob-storage-strategy.md` (ADR-PERSIST-4)
- `.claude/context/SYSTEM_MODEL.md` §11 (tech debt register cross-links)

**Severity scale:**
- **CRITICAL** — data loss, silent corruption, or unrecoverable state.
- **HIGH** — user-visible breakage, partial state recovery possible.
- **MEDIUM** — degraded behavior but data integrity preserved.
- **LOW** — observable only under contrived conditions.

**Status scale:**
- **OBSERVED** — failure has occurred in production or test.
- **PARTIALLY-MITIGATED** — surface has mitigation but the gap is real.
- **MITIGATED** — surface has working defense; included for audit completeness.
- **THEORETICAL** — surface exists but no occurrence; included for risk register.
- **ARCHITECTURALLY-CONSTRAINED** — surface exists but is bounded by an explicit design choice (e.g., single-tab assumption).

---

## FM-PERSIST-1: Tx abort mid-write (photo blob orphan on replacement)

**Severity:** HIGH
**Status:** PARTIALLY-MITIGATED
**Source:** `src/utils/persistence/savePhotoAtomically.js:84-86` + `__tests__/savePhotoAtomically.test.js:134-148`

**The failure:** `savePhotoAtomically` runs a 2-step IDB transaction: (1) `playerPhotos.add(blob)` returns `blobId`; (2) `players.put({ ...player, photoBlobId: blobId })`. If the player has a prior `photoBlobId`, the old blob is replaced but the old `playerPhotos` record is NEVER cleaned up. Orphan accumulates per replacement.

The abort path itself is safe — `tx.abort()` at line 85 rolls back both the new blob add and the player update atomically. Tests confirm no orphan on abort. But the **replace-with-orphan** path leaks one record per photo update.

**Mitigation:**
- Existing: abort path is correct.
- Missing: no compensating cleanup of the prior `playerPhotos.<oldBlobId>` record on successful replacement.
- Fix surface: `savePhotoAtomically.js` could read `player.photoBlobId` before writing and queue a delete of the old blob in the same transaction. Documented in test (line 145): "orphan blob still readable; cleanup is out-of-scope v1."

**Cross-links:** ADR-PERSIST-4 (Blob storage strategy); FM-PERSIST-3 (quota pressure compounds this).

---

## FM-PERSIST-2: Schema mismatch / version downgrade

**Severity:** CRITICAL
**Status:** THEORETICAL
**Source:** `src/utils/persistence/database.js:156-164` (onupgradeneeded only; no ondowngrade hook)

**The failure:** IDB does not support downgrades. If a user runs an older app bundle after a newer bundle wrote the DB at a higher version:
- `oldVersion` will not decrease; `onupgradeneeded` does not fire.
- New stores (e.g., v25 `predictionAudit`) exist physically in IDB but the older code has no awareness of them.
- Older code calls `db.transaction([...older stores], ...)` and silently ignores newer stores.
- Result: silent data drift; newer-version data not read by older app.

**Mitigation:**
- None at the IDB layer (this is a browser-spec limitation).
- Operational: deployment must never serve older bundles after a newer bundle has shipped.
- Detect: app could read `DB_VERSION` at startup and refuse to run if database reports a higher version than the code knows.

**Cross-links:** ADR-PERSIST-1 (schema versioning policy); FM-PERSIST-11 (onversionchange handler closes connection but doesn't prevent older-code reads).

---

## FM-PERSIST-3: IDB quota exceeded

**Severity:** CRITICAL
**Status:** PARTIALLY-MITIGATED
**Source:** `src/utils/persistence/handsStorage.js:86-88` (hands-only quota check); no equivalent in blob writers.

**The failure:** Mobile Safari has a ~50MB default IDB quota. Photos (`playerPhotos` store) can each be ~100KB-1MB. After ~50-500 photos, quota fires `QuotaExceededError` on `add()`/`put()`.

Currently:
- `handsStorage.js:86-88` catches `QuotaExceededError` by name and rejects with a typed error.
- **`savePhotoAtomically.js` has no quota check** — error fires mid-transaction, both steps abort, error propagates to UI without explanation.

**Mitigation:**
- Existing: hands store has the typed-error pattern.
- Missing: blob writers (`playerPhotos`) don't pre-check via `navigator.storage.estimate()` before attempting large writes.
- Fix surface: add a per-feature quota pre-check pattern. Each writer should estimate before attempting large writes; if quota is tight, prompt the user to clear old data.

**Cross-links:** FM-PERSIST-1 (blob orphan compounds quota); ADR-PERSIST-4 (blob storage strategy acknowledges quota pressure).

---

## FM-PERSIST-4: `customBetSizes[key]=[]` regression class

**Severity:** HIGH
**Status:** MITIGATED
**Source:** `src/components/views/TableView/CommandStrip.jsx:487-490` (read-side fix) + `:575-583` (write-side defense)

**The failure (historical):** The bet-button-disappearing bug at commit `dd9b266`. `openSizingEditor` was called without first hydrating `editorValues` from the current `customBetSizes`. The empty editor state was persisted as `[]` to IDB. On next load, `customMultipliers[key]` was `[]` (Array.isArray true, length 0), so `getSizingOptions` returned no presets — the sizing-presets panel vanished.

**Mitigation (two-sided defense, per `feedback_idb_persisted_defaults.md`):**
- Read-side (L487): `const customMultipliers = Array.isArray(storedMultipliers) && storedMultipliers.length > 0 ? storedMultipliers : null` — treats `[]` as "use defaults."
- Write-side (L575-576): filter to non-zero values; if `cleaned.length === 0`, don't persist — just close the editor.
- Hydrate-before-open: any editor opening flow MUST hydrate from current state first.

**Generalized rule (binding):** When persisting "use defaults" to an IDB-backed override setting, treat `[]` as "use defaults" at the read side AND refuse to persist all-zero/empty arrays at the save side AND hydrate the editor before opening.

**Cross-links:** Memory note `feedback_idb_persisted_defaults.md`; failure file `.claude/failures/IDB_PERSISTED_DEFAULTS.md` (if created).

---

## FM-PERSIST-5: Concurrent multi-tab writes

**Severity:** HIGH
**Status:** ARCHITECTURALLY-CONSTRAINED
**Source:** `src/utils/persistence/database.js:145-148` (onblocked handler); cached connection model.

**The failure:** Each tab caches a DB connection (`cachedDb` singleton). When Tab A initiates an upgrade transaction, Tab B's open connection blocks it. `onblocked` fires at line 147 and the upgrade rejects with a "close other tabs and reload" instruction.

Beyond blocking on upgrade, **no cross-tab sync exists**. Tab A writes a hand → Tab B's in-memory mirror goes stale. There is no `BroadcastChannel`, no IDB `versionchange` listener for record-level changes, no other notification mechanism.

**Mitigation:**
- Existing: `onblocked` handler tells user to close tabs.
- Missing: no record-level cross-tab notification. Single-tab assumption is load-bearing across all persistence hooks.

**Architectural constraint (binding):** Multi-tab simultaneous use is not supported. Documented in this catalog + INV-PERSIST-5 in `system/invariants.md`.

**Cross-links:** INV-PERSIST-5; FM-PERSIST-11 (onversionchange race).

---

## FM-PERSIST-6: Migration cursor error doesn't abort transaction

**Severity:** CRITICAL
**Status:** UNMITIGATED (code-fix needed)
**Source:** `src/utils/persistence/migrations.js:394-396, 425-427` (multiple cursor handlers across migrateV7-V10)

**The failure:** Migrations use cursors to backfill data on existing records (e.g., `migrateV7` walks all hands to add `userId` field). Cursor `.onerror` handlers in several migrations LOG the error but do not call `tx.abort()`. If a cursor errors mid-backfill — corrupted record, type mismatch, runtime exception — the migration transaction continues on other cursors.

Concrete scenario: `migrateV7` runs 5 nested cursor migrations on the same transaction. If hands cursor fails at record 50k of 100k, the transaction continues on sessions, players, etc. Result: hands `userId` partially migrated, sessions fully migrated. Schema version is bumped, so the partial migration is never re-attempted.

**Mitigation:**
- None currently.
- Fix surface: add `tx.abort()` to every cursor `.onerror` handler in `migrations.js`. The transactional atomicity guarantee then holds: any cursor error rolls the entire migration back, app crashes on next load, user can be guided to clear IDB or upgrade browser.
- Tracked as TD-19 follow-up.

**Cross-links:** ADR-PERSIST-2 (multi-store migration atomicity); FM-PERSIST-12 (root cause).

---

## FM-PERSIST-7: Append-only store violations (no IDB enforcement)

**Severity:** MEDIUM
**Status:** PROCESS-MITIGATED
**Source:** `src/utils/persistence/anchorObservationsStore.js:44-49` (putObservation can upsert); `src/utils/persistence/predictionAuditWriter.js:108-138` (writePredictionAudit overwrites).

**The failure:** Per design, `anchorObservations` (v19) and `predictionAudit` (v25) are append-only stores. The migration registry tags them as additive. But IDB does not enforce append-only semantics — `put()` permits full record replacement at any time. A buggy writer could overwrite historical observations or audit records.

**Per-store rules:**
- `anchorObservations` — 3 writers (W-AO-1 capture, W-AO-2 matcher, W-AO-3 candidate-promotion). Each should write only its allowed field set. Registry at `src/utils/anchorLibrary/writers.js` (in-code mirror of WRITERS.md, shipped SPR-078).
- `predictionAudit` — v25 says "forward-only — no engine-replay backfill," but no schema-level guard against re-writing.

**Mitigation:**
- Existing: writer-level field discipline (per WRITERS.md registry); CI gates (`scripts/check-anchor-writers.sh` planned).
- Missing: runtime enforcement of "never overwrite" — store wrappers could check for existing record on put and reject.
- Fix surface: per-writer validation in store wrappers. Not blocking; document the contract.

**Cross-links:** ADR-PERSIST-3 (append-only stores); WRITERS.md (anchor library writer registry).

---

## FM-PERSIST-8: Migration version gap (registry stale)

**Severity:** HIGH
**Status:** TEST-MITIGATED
**Source:** `src/utils/persistence/migrationRegistry.js`; tests at `__tests__/migrationRegistry.test.js #6`; runtime logging in `migrations.js:1154-1166`.

**The failure:** A new migration can be added to `migrations.js` but forgotten in `migrationRegistry.js`. The registry entry is not auto-generated from the code; it's a separately-authored append-only list.

**Mitigation:**
- Existing: Test #6 in `migrationRegistry.test.js` asserts `DB_VERSION` matches the max entry version. If the registry is stale, the test fails CI before merge.
- Runtime: at upgrade time, `runMigrations()` logs which registered versions applied. If 0 versions log, the registry is stale at runtime — surfaces in console.

**Architectural choice:** The registry is intentionally NOT auto-generated. Authoring an entry forces the engineer to fill in `description`, `owner.program`, `storesAdded`, `migrationFn` — the audit trail is more valuable than the convenience.

**Cross-links:** ADR-PERSIST-1 (schema versioning policy); `migrationRegistry.test.js`.

---

## FM-PERSIST-9: `savePhotoAtomically` Promise.all concurrency (different entities)

**Severity:** N/A (false alarm; no failure mode)
**Status:** Safe by design.
**Source:** `__tests__/savePhotoAtomically.test.js:118-132`

**Investigation outcome:** Concurrent `savePhotoAtomically` calls on different players are tested and pass. IDB handles the two transactions independently; no deadlock or interleaving issue. No new failure mode here — included in catalog for completeness so future audits don't re-investigate.

---

## FM-PERSIST-10: Multi-index creation in single migration tx

**Severity:** N/A (false alarm; no failure mode)
**Status:** Safe by design.
**Source:** `src/utils/persistence/migrations.js:207-234` (migrateV7 adds 6 indexes).

**Investigation outcome:** Multiple `createIndex` calls within one `onupgradeneeded` transaction are atomic per IDB spec — either all succeed or all roll back. The 6-index batch in migrateV7 is safe. Documented here so future audits don't worry about it.

---

## FM-PERSIST-11: DB caching + `onversionchange` async race

**Severity:** MEDIUM
**Status:** PARTIALLY-MITIGATED
**Source:** `src/utils/persistence/database.js:189-193` (onversionchange handler).

**The failure:** When another connection opens the DB at a higher version (upgrade scenario from another tab), the current tab's `onversionchange` handler fires. The handler closes the cached DB and nulls the pointer. But the app may have async operations in flight that already obtained the connection reference. Those operations may attempt to use a closed DB and fail mid-request.

**Mitigation:**
- Existing: `onversionchange` closes the connection promptly.
- Missing: no app-level signal to retry or refresh. The app must reload to recover.
- Document: "DB connection closed on version change; app must reload" — see ADR-PERSIST-1.

**Cross-links:** FM-PERSIST-5 (multi-tab assumption); ADR-PERSIST-1.

---

## FM-PERSIST-12: Cursor error handlers don't call `tx.abort()` (root cause of FM-PERSIST-6)

**Severity:** CRITICAL
**Status:** UNMITIGATED (code-fix needed)
**Source:** `src/utils/persistence/migrations.js:394-396, 425-427` (multiple sites).

**The failure:** This is the underlying code defect that produces FM-PERSIST-6. Every cursor in `migrations.js` should propagate errors to `tx.abort()`; current handlers log only.

**Fix surface:** A single PR audits every cursor in `migrations.js` and adds `tx.abort()` to every `.onerror` handler. Estimated ~10-15 sites. Tracked as TD-19 follow-up.

**Cross-links:** FM-PERSIST-6 (the production-visible symptom).

---

## Tech debt follow-ups (filed)

- **TD-19** (SYSTEM_MODEL.md §11) — Cursor error handlers in `migrations.js` don't call `tx.abort()`. Estimated S effort; ~10-15 cursor sites.
- **TD-20** (SYSTEM_MODEL.md §11) — Blob writers lack quota pre-check. Add `navigator.storage.estimate()` pre-check to `savePhotoAtomically.js` + future blob writers.
- **TD-21** (SYSTEM_MODEL.md §11) — Append-only writer enforcement is process-only. Consider runtime guard in `anchorObservationsStore.put` + `predictionAuditWriter.write`.

## Change log

| Date | Author | Change |
|------|--------|--------|
| 2026-05-14 | SPR-080 Item 2 / WS-188 Phase 1 | Initial authoring — 12 modes (8 verified + 4 additional findings). |
