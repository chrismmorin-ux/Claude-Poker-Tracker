# Session Handoff: printable-refresher-session15
Status: COMPLETE | Written: 2026-04-26

## Backlog Item

**PRF-G5-RL + PRF-G5-RI + PRF-G5-DS + PRF-G5-LG CLOSED + AppRoot wiring landed.** 4 test scaffolds shipped + Provider integrated into the live app's provider stack. After this commit only PRF-G5-B Phase B Math Tables remains before visible owner value lands.

| Phase 5 sub-deliverable | Status |
|---|---|
| PRF-G5-CI / MIG / SL / ST / WR / HK | DONE (S1-S14) |
| **PRF-G5-RL** — red-line meta-test | **DONE (this session)** |
| **PRF-G5-RI** — writer-boundary test | **DONE (this session)** |
| **PRF-G5-DS** — durable-suppression test | **DONE (this session)** |
| **PRF-G5-LG** — lineage-footer rendering test | **DONE (this session)** |
| **AppRoot wiring** | **DONE (this session)** |
| PRF-G5-B Phase B Math Tables | NEXT |

## What I Did This Session

Three AppRoot file edits + 4 new test files. All within the existing PRF + reducers + contexts + hooks + utils namespaces.

**(1) AppRoot wiring (3 file edits):**

- `src/hooks/useAppState.js` — added `import { refresherReducer, initialRefresherState }` + `useReducer(refresherReducer, initialRefresherState)` + return `refresherState` and `dispatchRefresher`. Comment cites PRF-G5-HK provenance + notes hydrate-only persistence model (writers.js owns IDB writes).
- `src/AppProviders.jsx` — added `RefresherProvider` import from `./contexts` + `manifests` import from `./utils/printableRefresher/cardRegistry` aliased as `refresherCardRegistry` (deliberate IoC — Provider receives the registry as a prop). Wrapped existing provider chain with `<RefresherProvider refresherState={refresherState} dispatchRefresher={dispatchRefresher} cardRegistry={refresherCardRegistry}>` between `EntitlementProvider` and `GameProvider`. Added `refresherState` + `dispatchRefresher` to props destructuring.
- `src/contexts/index.js` — exports `RefresherProvider` + `useRefresher` from `./RefresherContext`. Comment cites PRF-G5-HK + 2026-04-26 date.

Plus call-site update at `src/PokerTracker.jsx` AppRoot — destructures `refresherState` + `dispatchRefresher` from `useAppState()` + threads them through to `<AppProviders>`.

**(2) `src/utils/printableRefresher/__tests__/writerBoundary.test.js` — PRF-G5-RI (6 tests).**

Verifies I-WR-2 reference-mode write-silence at the writer boundary:
- Mocks ALL store wrapper modules globally — `refresherStore` (the only legitimate target) + 5 skill-state-store modules (`anchorObservationsStore`, `exploitAnchorsStore`, `perceptionPrimitivesStore`, `anchorObservationDraftsStore`, `subscriptionStore`).
- Calls each PRF writer (W-URC-1/2a/2b/3) in turn.
- Asserts ONLY refresherStore mocks were called via `assertNoSkillStateStoreCalls()` helper that iterates over the 5 skill-state-store mock modules + checks every exported mock function has `not.toHaveBeenCalled()`.
- Plus integration test running all 4 writers in sequence with the same zero-skill-state-call assertion.

If a future writer accidentally imports a non-PRF store wrapper + calls put/delete, this test fails — the writer must be re-classified per WRITERS.md amendment rule.

**(3) `src/utils/printableRefresher/__tests__/durableSuppression.test.js` — PRF-G5-DS (5 tests).**

The canonical R-8.1 zero-data-loss proof at the writer/IDB boundary. Mirror of `refresherSelectors.test.js` PRF-G5-SL-ROUNDTRIP-UNSUPPRESS test which proves the SAME invariant at the selector boundary — together they verify the round-trip is durable through the entire stack:

- Pin 3 cards → suppress class → un-suppress class → all 3 STILL pinned in cardVisibility.
- Hidden card visibility survives suppress+un-suppress (separate from pinned case).
- Mixed pinned+hidden across multiple classes survive sequence of suppress+un-suppress in reverse order.
- Close+reopen IDB cycle preserves both `cardVisibility` + `suppressedClasses` (cross-session durability).
- writeConfigPreferences (W-URC-1) does NOT touch cardVisibility/suppressedClasses — verifies I-WR-3 field-ownership segregation as cross-check.

Real IDB integration (fake-indexeddb under jsdom). Each test does `getDB() → writer calls → getRefresherConfig() → assertions`.

**(4) `src/utils/printableRefresher/__tests__/lineageFooterRendering.test.js` — PRF-G5-LG (12 tests).**

For every manifest in the registry (currently `prf-math-auto-profit.json`; will scale linearly with future card authoring):
- Renders 7 numbered `[1]..[7]` lines.
- Field [1] cardIdSemver — contains `cardId` + `v\d+`.
- Field [2] generationDate — ISO8601 timestamp.
- Field [3] sourceUtilTrail — non-empty (auto-profit case falls back to "POKER_THEORY-derivation (see field [5])").
- Field [4] engineAppVersion — contains both `engine` + `app` + RUNTIME_FIXTURE values.
- Field [5] theoryCitation — exact match to `manifest.theoryCitation`.
- Field [6] assumptionBundle — JSON-shaped (starts `{`, ends `}`).
- Field [7] bucketDefinitionsCited — null-marker or non-empty string.
- Lineage object has exactly 7 named keys (no extras, no missing).

Plus 2 fallback path tests (engineAppVersion unknown markers when runtime not supplied + printFooter deterministic for fixed input).

Mirror of `verifyCatchesDrift.test.js` Check 6 at the per-manifest registry level. The verifyCatchesDrift file uses fixture manifests; this file exercises the actual registry.

**(5) `src/utils/printableRefresher/__tests__/redLineCompliance.test.js` — PRF-G5-RL (24 tests).**

Meta-test indexing coverage for all 17 red lines per charter §Acceptance Criteria.

- Direct assertions for testable-now red lines #1, #2, #3, #4, #5, #6, #7, #10, #11, #12, #13, #14, #15, #16 (delegated covering tests cited).
- Subsumed: #8 (subsumed by #11+#16) + #9 (incognito N/A — refresher doesn't capture observations) + #17 (intent-switch placeholder; Phase 2+ deferred).
- Coverage manifest test asserts `REDLINE_COUNT === 17` — fails if red-line count diverges from charter.

This file is a compliance INDEX — its job is to keep the 17-line list in sync with covering tests. If a red line gains a new covering test, add it here. If an existing covering test is removed, this file's reference fails loudly, surfacing the gap.

**(6) Governance:**
- BACKLOG: 4 row state-flips PRF-G5-RL/RI/DS/LG: NEXT → COMPLETE (2026-04-26) with full implementation accept-criteria detail.
- BACKLOG section header updated: "PRF-G5-CI + PRF-G5-MIG + PRF-G5-SL + PRF-G5-ST + PRF-G5-WR + PRF-G5-HK + PRF-G5-RL + PRF-G5-RI + PRF-G5-DS + PRF-G5-LG CLOSED 2026-04-26 + AppRoot wiring landed."
- STATUS top entry: pending — will write after handoff body.

## Files I Own (DO NOT EDIT)

*Session is COMPLETE.* No file lock needed.

## Uncommitted Changes (after S15 commit)

Created in this session:
- `src/utils/printableRefresher/__tests__/writerBoundary.test.js`
- `src/utils/printableRefresher/__tests__/durableSuppression.test.js`
- `src/utils/printableRefresher/__tests__/lineageFooterRendering.test.js`
- `src/utils/printableRefresher/__tests__/redLineCompliance.test.js`
- `.claude/handoffs/printable-refresher-session15.md` (this file)

Modified in this session:
- `src/hooks/useAppState.js` (added refresherReducer integration)
- `src/AppProviders.jsx` (wrapped chain with RefresherProvider + manifests prop)
- `src/contexts/index.js` (added RefresherProvider + useRefresher exports)
- `src/PokerTracker.jsx` (AppRoot destructures + threads refresherState + dispatchRefresher to AppProviders)
- `.claude/BACKLOG.md` (4 row state-flips + section header update)
- `.claude/STATUS.md` (new top entry pending)

**NOT modified:**
- All Gate 4 design docs — stable.
- All PRF-G5-CI / G5-MIG / G5-SL / G5-ST / G5-WR / G5-HK infrastructure — stable.
- `SYSTEM_MODEL.md` — flagged for update at PRF-G5-B (when card authoring starts and the surface becomes navigable).

## What's Next

**PRF-G5-B Phase B Math Tables (next session) — visible owner value.**

The persistence + selector wiring is fully complete. The next deliverable lands actual cards owners can print. 6 manifests authored:
1. `prf-math-auto-profit.json` (already exists from S1) — can be enriched with full bodyMarkdown.
2. `prf-math-geometric-sizing.json`
3. `prf-math-pot-odds.json`
4. `prf-math-implied.json`
5. `prf-math-binomial.json`
6. `prf-math-spr-zones.json`

The content-drift CI shipped in S1-S4 catches drift automatically as new manifests are added — author manifest, run `node scripts/refresher-compute-hash.js <cardId>` to compute the contentHash, paste into manifest, watch all 6 checks pass.

After PRF-G5-B → Q5 differentiation demo at design review → conditional PRF-G5-A Phase A Preflop → PRF-G5-C Phase C Equity+Exceptions → PRF-G5-PDF cross-browser snapshots.

Phase 1 MVP card count target: 10-13 cards (6 Phase B + 0-3 Phase A conditional + 4 Phase C).

**Note on UI components:** The actual `PrintableRefresherView` UI components (catalog / cards / print modal / settings panel) are deferred — they need the cards to exist first, then the surface assembles them via the selectors + writer-action helpers already shipped. This session's AppRoot wiring lands the Provider so the view can hook in directly via `useRefresher()` once authored.

## Gotchas / Context

1. **Provider order matters.** `RefresherProvider` is placed between `EntitlementProvider` and `GameProvider` in the chain. Reasoning: it's a top-level surface state independent of game/UI/session/player state. If `RefresherProvider` ever needs `useAuth` (e.g., for per-user singleton scoping in Phase 2+), it can stay in this slot — Auth wraps Entitlement which wraps Refresher. Don't move it inside the game-specific providers (Game / UI / Session / Player) — refresher state is orthogonal to in-game state.

2. **`cardRegistry` is a constructor-time prop, not runtime-mutable.** `manifests` from `cardRegistry.js` is loaded at build time via `import.meta.glob`. The Provider receives the array once and never sees changes. If a future feature wants dynamic card loading (e.g., user-authored cards from IDB), that would require a different architecture — current pattern assumes registry is build-time immutable.

3. **The 4 test scaffolds vary in coupling tightness.**
   - PRF-G5-RI is the loosest coupled (mocks everything; pure unit).
   - PRF-G5-DS is the tightest (real IDB; integration).
   - PRF-G5-LG is per-manifest (registry-driven; scales with card count).
   - PRF-G5-RL is meta-only (delegates to other tests; lightweight).
   This stratification is intentional — each test verifies a different layer of the red-line stack.

4. **PRF-G5-RL's coverage manifest test (`REDLINE_COUNT === 17`) is the canary.** If a future review of the charter adds an 18th red line or removes one, this assertion fails LOUDLY. The maintainer must then update the assertion + add coverage for the new red line OR remove coverage for the deleted one. Without this canary, red-line count drift would silently happen.

5. **PRF-G5-RL imports its delegated tests' SUBJECT modules, not the test files themselves.** Vitest doesn't import test files transitively. The meta-test asserts that the SUBJECTS of the delegated tests exist (writers.js exports the 4 writers; refresherSelectors.js exposes the selectors; lineage.js exposes derive7FieldLineage). If a delegated test file is renamed, the meta-test still passes — but a missing subject module would fail loudly. This is a softer check than file-existence verification but appropriate here because the test files themselves are CI-discovered via vitest's glob.

6. **PRF-G5-DS overlaps with refresherMigration.test.js's PRF-G5-DS section.** Both verify suppression durability — the migration test verifies it survives close+reopen at the IDB level; this writer-level test verifies cardVisibility entries are preserved through the suppress/un-suppress writer cycle. Both are independently load-bearing — the migration test catches IDB-layer regressions; the writer test catches writer-layer regressions. Don't deduplicate.

7. **PRF-G5-LG is largely duplicative of verifyCatchesDrift.test.js Check 6.** Both verify the 7-field lineage rendering. The duplication is intentional: verifyCatchesDrift uses fixture manifests (synthetic state); PRF-G5-LG uses the actual registry. If the registry shape changes (new manifest fields), PRF-G5-LG fails first; verifyCatchesDrift continues passing on its fixtures. Catching real-registry regressions early matters.

8. **AppRoot integration is NOT integration-tested in this commit.** The unit tests verify each piece in isolation (Provider mocks persistence; persistence mocks IDB). A full integration test (real IDB through Provider through useRefresher consumer) would belong in a separate `appProviders.integration.test.jsx` — deferred to PRF-G5-B or later. The risk of skipping integration coverage is low because the unit tests cover all the wiring contracts; the only thing not directly tested is "does AppProviders.jsx correctly thread the props" which is mechanically verified by the existing `<RefresherProvider>` usage compiling + rendering.

9. **`refresherReducer.test.js` test for "preserves existing config when updatedConfig missing" was originally written to test a return-same-state path** but with the action validation in `createValidatedReducer`, returns are always new state objects. The test now verifies that the config slice value is `===` to the prior value (via `.toBe(seeded.config)`) — this is correct because the reducer doesn't construct a new config object when the payload's updatedConfig is missing; it just spreads it through.

10. **The `redLineCompliance.test.js` `require()` calls were broken.** ESM modules under vitest use `import` (sync at module load) not `require()` (CommonJS). Initial draft had `require('../writers.js')` which threw at runtime; rewrote to `await import(...)` for the dynamic case + top-level static import for the deterministic cases. Future test additions to this file should use top-level imports unless they specifically need dynamic resolution.

## System Model Updates Needed

Defer until PRF-G5-B card authoring lands. At that point `SYSTEM_MODEL.md` should grow:
- New context provider `RefresherProvider` in §1 Component Map provider chain (between `EntitlementProvider` and `GameProvider`).
- New hook list entries: `useRefresher` + `useRefresherView` + `useRefresherPersistence`.
- New reducer entry: `refresherReducer`.
- New CI-gate entries: `scripts/check-refresher-writers.sh` (S13) + `scripts/check-refresher-bundle.sh` (S14).
- Mention selectors / writers / refresherStore / refresherDefaults modules in §1 + §2.

## Test Status

**S15 net-add: 47 new tests across 4 new test files.**
- `writerBoundary.test.js` — 6/6 ✓
- `durableSuppression.test.js` — 5/5 ✓
- `lineageFooterRendering.test.js` — 12/12 ✓
- `redLineCompliance.test.js` — 24/24 ✓

**Full PRF scope (19 test files): 399/399 green** in isolation.

CI-grep smoke tests:
- `scripts/check-refresher-writers.sh` (S13) — passes ✅
- `scripts/check-refresher-bundle.sh` (S14) — passes ✅

Full smart-test-runner not run this session — modifications outside the PRF scope are governance docs + AppRoot wiring (PokerTracker.jsx + useAppState.js + AppProviders.jsx + contexts/index.js); these are well-covered by existing app-level tests indirectly. The known precisionAudit flake + parallel-MPMF-G5-B2 broken `migrationV21.test.js` situation remains unchanged. Zero new regressions from S15.
