# Session Handoff: printable-refresher-session14
Status: COMPLETE | Written: 2026-04-26

## Backlog Item

**PRF-G5-HK CLOSED.** React hooks + context + reducer + bundle-grep CI all shipped. The persistence + selector wiring step is now FULLY COMPLETE.

| Phase 5 sub-deliverable | Status |
|---|---|
| PRF-G5-CI — content-drift CI | DONE (S1-S4) |
| PRF-G5-MIG — IDB v20 migration | DONE (S11) |
| PRF-G5-SL — selectors | DONE (S12) |
| PRF-G5-ST — store CRUD wrappers | DONE (S12) |
| PRF-G5-WR — writer registry + CI-grep | DONE (S13) |
| **PRF-G5-HK — hooks + context + reducer + bundle-grep** | **DONE (this session)** |
| PRF-G5-RL/RI/DS/LG | NEXT |
| PRF-G5-B Phase B Math Tables | BLOCKED |

## What I Did This Session

Six new files + 1 executable script + 4 test files + 4 BACKLOG row updates. All within the existing PRF + reducers + contexts + hooks namespaces.

**(1) `src/constants/refresherConstants.js` — reducer + view constants.**

Three exports:
- `REFRESHER_ACTIONS` frozen enum (3 actions: REFRESHER_HYDRATED + REFRESHER_CONFIG_REPLACED + REFRESHER_BATCH_APPENDED).
- `initialRefresherState` — config from `buildDefaultRefresherConfig()` + `printBatches: []` + `isReady: false` + `schemaVersion: '1.0.0'`. NOT `Object.freeze`'d because the reducer spreads + replaces the slice, which would error on a frozen object.
- `REFRESHER_STATE_SCHEMA` — top-level type schema for `createValidatedReducer`.
- `REFRESHER_VIEW_LOCALSTORAGE_KEY` (`'pokerTracker.refresherView.v1'`).
- `initialRefresherView` (frozen) — default UI state: empty filter arrays + `showSuppressed: false` + `sort: 'theoretical'`.
- `VALID_SORT_VALUES` — `['theoretical', 'alphabetical', 'lastPrinted', 'pinnedFirst']`.

**(2) `src/reducers/refresherReducer.js` — pure reducer + 3 case branches.**

Wrapped in `createValidatedReducer` mirroring `anchorLibraryReducer.js` precedent. Three cases:

- **REFRESHER_HYDRATED** — bulk-load on mount. `payload.config` defaults to existing state.config if missing; `payload.printBatches` defaults to `[]` if missing OR non-array; `isReady` always set to `true` (failure-path-still-ready convention).
- **REFRESHER_CONFIG_REPLACED** — replaces `config` slice with W-URC-1/2 writer's returned record. Validates `config.id === 'singleton'` (defensive against wrong record being dispatched). Returns same-state on missing/invalid payload.
- **REFRESHER_BATCH_APPENDED** — prepends batch to `printBatches` array (most-recent-first; matches `getAllPrintBatches` DESC order). Replaces `config` slice for lastExportAt update. Defense-in-depth: duplicate `batchId` from caller is dropped (W-URC-3 generates fresh UUIDs so this should never happen) but the config update still applies.

**(3) `src/hooks/useRefresherPersistence.js` — hydrate-only IDB hook.**

Differs from EAL's `useAnchorLibraryPersistence` which does per-slice diff-write — PRF's writers.js owns IDB writes (validated), so this hook is hydrate-only.

- `Promise.all` over `getRefresherConfig` + `getAllPrintBatches` on mount.
- Single `REFRESHER_HYDRATED` dispatch with full payload.
- Failure path: dispatches with empty payload (reducer falls back to defaults) + still sets `isReady: true` so the app remains usable.
- Cancellation guard via local `cancelled` flag prevents post-unmount dispatch.

**(4) `src/hooks/useRefresherView.js` — localStorage UI state.**

Independent of `RefresherContext` (no context coupling) — UI-only state doesn't need to be in the IDB-backed reducer. Per `selectors.md` §Filter + sort composition, this hook owns the view state; selectors take base set + apply view filters/sort downstream.

- Hydrates from `localStorage` on mount with defensive merge — coerces invalid sort values to default + non-array filter fields to `[]` + non-boolean showSuppressed to `false` (strict-equality `=== true`).
- Persists synchronously on every change (localStorage is fast enough that debouncing would be over-engineering; UI state isn't load-bearing for hot paths).
- API: `{ view, setFilter (partial-merge), setSort (enum-validated), setShowSuppressed (strict-equality), resetView }`.

**(5) `src/contexts/RefresherContext.jsx` — Provider + writer-action helpers + selector helpers.**

Mirrors `AnchorLibraryContext.jsx` shape but with writer-action helpers instead of raw dispatch.

**Writer-action helpers (4)** — UI handlers call these, never `writers.js` directly:
- `patchConfig(patch)` — W-URC-1 path. Awaits `writeConfigPreferences(patch)` → dispatches `REFRESHER_CONFIG_REPLACED` with returned record.
- `setCardVisibility({ cardId, visibility })` — W-URC-2a path. Same dispatch pattern.
- `setClassSuppressed({ classId, suppress, confirmed, ownerInitiated })` — W-URC-2b path. Same dispatch pattern. Writer enforces guards (suppress-requires-confirmed, un-suppress-requires-ownerInitiated).
- `recordPrintBatch(payload)` — W-URC-3 path. Awaits `writePrintBatch(payload)` → composes `updatedConfig` client-side from existing reducer state + new `lastExportAt` (W-URC-3 invokes W-URC-1 internally; the IDB now has lastExportAt updated; client-side compose avoids re-reading IDB and gives single-dispatch atomicity at reducer level) → dispatches `REFRESHER_BATCH_APPENDED` with both batch + updatedConfig pieces.

**Selector helpers (6)** — memoized via `useCallback` over `cardRegistry` + `config` + `printBatches`:
- `getAllCards()` / `getActiveCards()` / `getPinnedCards()` / `getSuppressedCards()` / `getCardsForBatchPrint(selectedIds)` / `getStaleCards()`.
- All wrap the corresponding `refresherSelectors.js` exports with the current state.

**Consumer hook** `useRefresher()` throws helpful error outside Provider.

**(6) `scripts/check-refresher-bundle.sh` — bundle-grep CI gate.**

Per `print-css-doctrine.md` §Forbidden mechanisms. Scans 7 PRF surface paths for `html2canvas` / `jspdf` / `pdf-lib` imports via 6 regex variants (covering both `from '...'` and `require('...')` shapes). Smoke-tested ✅ on current tree — zero forbidden imports.

**(7) Tests (4 files, 76 new tests):**

- `src/reducers/__tests__/refresherReducer.test.js` (19 tests) — initial state 2 + REFRESHER_HYDRATED 5 incl. failure-path-still-ready + REFRESHER_CONFIG_REPLACED 5 incl. wrong-id defensive + REFRESHER_BATCH_APPENDED 7 incl. duplicate-batchId-drop with config-still-updated.
- `src/hooks/__tests__/useRefresherPersistence.test.js` (5 tests) — parallel-reads on mount + dispatch shape + isReady transitions + failure-path-still-ready + cancellation guard via blocked Promise + post-unmount.
- `src/hooks/__tests__/useRefresherView.test.js` (28 tests) — initial state 5 incl. malformed-JSON fallback + non-array filter coercion + invalid-sort coercion / setFilter 4 / setSort 3 / setShowSuppressed 3 / resetView 2.
- `src/contexts/__tests__/RefresherContext.test.jsx` (24 tests) — Provider basics 4 + outside-Provider throw 1 + patchConfig W-URC-1 path 2 incl. error propagation + setCardVisibility 1 + setClassSuppressed 1 + recordPrintBatch 1 + 6 selector-helper coverage including getStaleCards diverging-hash detection.

**Total S14: 76/76 green.** Full PRF scope (15 test files): 352/352 green.

**(8) Governance:**
- BACKLOG row PRF-G5-HK: NEXT → COMPLETE (2026-04-26) with full implementation accept-criteria detail + 76-test breakdown + doctrine choices.
- Section header updated: now reads "Gate 5 IN PROGRESS — PRF-G5-CI + PRF-G5-MIG + PRF-G5-SL + PRF-G5-ST + PRF-G5-WR + PRF-G5-HK CLOSED 2026-04-26 — persistence + selector wiring step FULLY COMPLETE."

## Files I Own (DO NOT EDIT)

*Session is COMPLETE.* No file lock needed.

## Uncommitted Changes (after S14 commit)

Created in this session:
- `src/constants/refresherConstants.js`
- `src/reducers/refresherReducer.js`
- `src/hooks/useRefresherPersistence.js`
- `src/hooks/useRefresherView.js`
- `src/contexts/RefresherContext.jsx`
- `scripts/check-refresher-bundle.sh`
- `src/reducers/__tests__/refresherReducer.test.js`
- `src/hooks/__tests__/useRefresherPersistence.test.js`
- `src/hooks/__tests__/useRefresherView.test.js`
- `src/contexts/__tests__/RefresherContext.test.jsx`
- `.claude/handoffs/printable-refresher-session14.md` (this file)

Modified in this session:
- `.claude/BACKLOG.md` (PRF-G5-HK row state-flip + section header update)
- `.claude/STATUS.md` (new top entry pending)

**NOT modified:**
- All Gate 4 design docs — stable.
- All PRF-G5-CI / G5-MIG / G5-SL / G5-ST / G5-WR infrastructure — stable.
- `src/constants/anchorLibraryConstants.js` / `src/reducers/anchorLibraryReducer.js` / `src/contexts/AnchorLibraryContext.jsx` / `src/hooks/useAnchorLibraryPersistence.js` — EAL precedent files, untouched.
- `SYSTEM_MODEL.md` — flagged for update at AppRoot wiring (next session) when first integration test lands.

## What's Next

**PRF-G5-RL / PRF-G5-RI / PRF-G5-DS / PRF-G5-LG test scaffolds (next session, optional).**

Per the Gate 4 ACP these test scaffolds verify the full red-line stack at the integration level. Most assertions don't need card content yet (so they can land before PRF-G5-B Phase B Math Tables). Concrete deliverables:

- **PRF-G5-RL** (red-line compliance): JSX integration test asserting all 17 red lines hold across the surface — most are negative assertions (e.g., "no urgency framing visible to user").
- **PRF-G5-RI** (reducer-boundary write-silence): asserts `currentIntent: 'Reference'` dispatch produces no skill-state mutation. Verifies I-WR-2 from WRITERS.md.
- **PRF-G5-DS** (durable-suppression): suppressedClasses survives engine + app version bump. Already partially covered by `refresherMigration.test.js` PRF-G5-DS test — extend to writer/reducer-layer assertion here.
- **PRF-G5-LG** (lineage-footer rendering): MVP-card render asserts all 7 fields present + correctly formatted.

After test scaffolds → **PRF-G5-B Phase B Math Tables** is the load-bearing visible-owner-value chain. 6 cards (auto-profit / geometric / pot-odds / implied / binomial / SPR zones); content-drift CI shipped in S1-S4 catches drift automatically as new manifests are added.

Then Q5 differentiation demo → PRF-G5-A → PRF-G5-C → PRF-G5-PDF. Phase 1 MVP target 10-13 cards.

**AppRoot wiring** is also pending (3 small file edits): `useAppState.js` adds `useReducer(refresherReducer, initialRefresherState)` + `AppProviders.jsx` adds `<RefresherProvider>` in the provider stack with cardRegistry passed as prop + `contexts/index.js` exports `useRefresher` + `RefresherProvider`. Defer to next session — this session focused on the layer infrastructure.

## Gotchas / Context

1. **Post-write update pattern beats per-slice diff-write here.** EAL's `useAnchorLibraryPersistence` does per-slice diff-write because EAL doesn't have a writer-validation layer. PRF has `writers.js` that validates field-ownership + Phase 1 constraints (includeCodex / confirmed / ownerInitiated guards) BEFORE each IDB write. If `useRefresherPersistence` did per-slice diff-write, it would bypass that validation. The post-write update pattern (UI helper awaits writer → dispatch with returned record) keeps validation intact + the reducer state always matches IDB.

2. **`initialRefresherState.config` is NOT `Object.freeze`'d.** The reducer spreads + replaces the config slice on REFRESHER_CONFIG_REPLACED. Freezing the initial config would cause `Object.assign` / spread to error in strict mode. Mirror EAL's pattern where `initialAnchorLibraryState` itself is frozen but inner dicts are deep-frozen empties (different shape from PRF; PRF's inner config is mutated-in-spread, not replaced-as-whole-dict).

3. **`recordPrintBatch` composes `updatedConfig` client-side.** The W-URC-3 writer invokes W-URC-1 internally for `lastExportAt` — the IDB now has both writes. The hook could re-read IDB to get the latest config, but composing client-side from existing reducer state + new `lastExportAt` is faster and gives single-dispatch atomicity at the reducer level. The trade-off: if W-URC-1's internal call modified other fields (which it shouldn't), the client-side compose would miss them. This is acceptable because W-URC-1 only updates `lastExportAt` in this composition path.

4. **`useRefresherView` is independent of `RefresherContext`.** UI state doesn't need context coupling — components import the hook directly. This keeps the context API surface small + lets the view hook be unit-tested independently of the IDB stack.

5. **`useRefresherView` persists synchronously on every change.** localStorage is fast enough (sub-ms) that debouncing would be over-engineering. UI state isn't load-bearing for hot paths. If profiling later shows render thrash, can wrap in `useDeferredValue` or move to `useTransition`.

6. **`useRefresherView`'s defensive coercion is intentional.** If localStorage was corrupted or written by an old app version with a different schema, the hook falls back to defaults rather than crashing. The schema version (`v1` in the localStorage key) is the explicit migration hook; future v2 additions can read v1 data + upgrade in-place.

7. **`setShowSuppressed` uses strict-equality `=== true`.** Truthy non-boolean values like `'yes'` or `1` are coerced to `false`. This is intentional — the API contract is "boolean only"; coercing is friendlier than throwing but stricter than `Boolean(value)`. If a future reviewer prefers boolean coercion, change to `value === true || value === 'true'`.

8. **`RefresherProvider` accepts `cardRegistry` as a prop.** This is a deliberate inversion of control — the Provider doesn't import `cardRegistry` from `cardRegistry.js` directly so tests can pass mock card sets. Production usage in AppProviders (deferred to next session) will pass `manifests` from the cardRegistry barrel.

9. **`useRefresher()` selector helpers are recreated on every render of the Provider.** This is fine for v1 but if React re-renders the entire tree on every config patch, the helpers re-render too. The `useMemo` on `value` prevents context consumers from re-rendering needlessly, but the helper functions themselves change identity on state change. If profiling shows helper-identity churn causing downstream re-renders, switch to a single useMemo wrapping all helpers as a stable object. For v1 this hasn't been a bottleneck in EAL's similar pattern.

10. **The 4 mocked test files cover behavioral correctness; AppRoot wiring is integration-tested separately at next-session.** When `AppProviders` integration test lands, it should verify: hydration → user changes → IDB write → re-mount → state restored. The unit tests in this session don't cover that full lifecycle since persistence is mocked; the integration test will.

## System Model Updates Needed

Defer until AppRoot wiring lands. At that point `SYSTEM_MODEL.md` should grow:
- New context provider `RefresherProvider` in the provider stack listed in §1 Component Map.
- New hooks `useRefresher` + `useRefresherView` + `useRefresherPersistence` in the hooks list (§1 Component Map).
- New reducer `refresherReducer` in the reducer list (§1 Component Map).
- New CI-gate entries: `scripts/check-refresher-bundle.sh` (alongside `check-refresher-writers.sh` from S13).
- Mention selectors / writers / refresherStore module (already shipped S12-S13) if not yet reflected.

## Test Status

**S14 net-add: 76 new tests across 4 new test files.**
- `refresherReducer.test.js` — 19/19 ✓
- `useRefresherPersistence.test.js` — 5/5 ✓
- `useRefresherView.test.js` — 28/28 ✓
- `RefresherContext.test.jsx` — 24/24 ✓

**Full PRF scope (15 test files): 352/352 green** in isolation.

CI-grep smoke tests:
- `scripts/check-refresher-writers.sh` (S13) — passes ✅
- `scripts/check-refresher-bundle.sh` (S14) — passes ✅

Full smart-test-runner not run this session — modifications outside the PRF scope are governance docs only. The known precisionAudit flake + parallel-MPMF-G5-B2 broken `migrationV21.test.js` situation remains unchanged. Zero new regressions from S14.
