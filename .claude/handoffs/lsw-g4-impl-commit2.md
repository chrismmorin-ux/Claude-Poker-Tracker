# Handoff: LSW-G4-IMPL Commit 2 — engine v2 (new parallel exports)

**Status:** COMPLETE (2026-04-22)
**Started:** 2026-04-22
**Owner:** Claude (main)
**Project:** `docs/projects/line-study-slice-widening.project.md`
**Backlog item:** LSW-G4-IMPL
**Preceding handoff:** `lsw-g4-impl-commit1.md`
**Spec:** `docs/design/surfaces/bucket-ev-panel-v2.md`

---

## Scope

Commit 2 of the 6-commit v2 migration path. Ship the engine v2 layer as **new parallel exports** alongside the v1 function. v1 `computeBucketEVs` (in `BucketEVPanel.jsx`) is untouched; v1 consumers continue to work unchanged.

## Delivered

### Modified files (1)

- `src/utils/postflopDrillContent/drillModeEngine.js` — three new exports appended:
  - `GROUP_CALL_RATES` — frozen map from `DOMINATION_GROUPS` ids → per-group villain call frequency. Covers all 31 current taxonomy IDs including G5.1 precision-split overcards + G5.2 pair+draw composites.
  - `computeDecomposedActionEVs({ decomposition, heroActions, pot })` — pure function. For each hero action × each villain group, computes per-group EV using `foldRate × pot + (1-foldRate) × (equity × (pot + 2B) − B)` for bets and `equity × pot` for checks. Returns `Array<{ actionLabel, kind, betFraction, perGroupContribution, totalEV, totalEVCI, isBest, unsupported? }>`. Supports bet / check / fold / call / raise / jam kinds — fold = 0 EV; call/raise/jam in v1 stub as unsupported=true with ev=0.
  - `computeValueBeatRatio(decomposition)` — sums weight in `crushed|dominated` (value) vs `favored|dominating` (bluff/pay). Returns `{ valueWeight, bluffOrPayWeight, ratio }` or null when no data.
  - `computeBucketEVsV2(input)` — async orchestrator. Validates input → returns `errorState` on failure (5 discriminants: engine-internal / range-unavailable / malformed-hero / timeout / taxonomy-mismatch). On success: calls `computeDominationMap` for per-group equity+weight, then `computeDecomposedActionEVs` for per-action math, picks best action, templates `recommendation.templatedReason` by `decisionKind`, populates `valueBeatRatio` only for bluff-catch/thin-value, threads `actionHistory` into `streetNarrowing` ordered array, always ships `confidence.caveats` with `['synthetic-range', 'v1-simplified-ev']` until LSW-D1 depth-2 lands.

### New files (1)

- `src/utils/postflopDrillContent/__tests__/drillModeEngineV2.test.js` — 35 tests covering:
  - `GROUP_CALL_RATES` shape + coverage across all 31 DOMINATION_GROUPS ids + monotonicity spot checks.
  - `computeDecomposedActionEVs` — input validation, output shape per action, `perGroupContribution` parity with decomposition length, totalEV = sum invariant, check-action showdown-equity formula, fold-action zero EV, unknown-kind unsupported flag, single isBest action.
  - `computeValueBeatRatio` — empty decomposition null, value/bluff weight split, Infinity ratio when bluff region empty, all-neutral returns null.
  - `computeBucketEVsV2` — 5 error-path branches (null input / MW / non-single-combo heroView / invalid board / unknown archetype) + 13 happy-path assertions (decomposition shape per row, actionEVs shape, recommendation alignment, caveats presence, archetype mirroring, valueBeatRatio decisionKind-gating, templatedReason per-kind phrasing, streetNarrowing null vs array, perVillainDecompositions null in HU, errorState null on happy path).

### Unchanged files

- `BucketEVPanel.jsx` — v1 function stays put; `parseComboString`, `computeBucketEVs`, `isRowApplicable`, `BucketEVPanel` exports unchanged.
- Existing engine tests (`drillModeEngine.test.js`) — not touched.
- Schema, validators, line content, component code — all unchanged.

## Verification

- [x] **Targeted tests** — `drillModeEngineV2.test.js` 35/35.
- [x] **Regression parity** — full `postflopDrillContent` + `PostflopDrillsView` suites: **402/402 passing** (up from 367 pre-commit: 335 drillContent + 32 BucketEVPanel + 35 new v2).
- [x] **Production build clean** — `npm run build` → `✓ built in 9.22s` + PWA. No import errors, no circular dependencies.
- [x] **v1 path untouched** — BucketEVPanel tests 32/32 continue to pass verbatim.

## Fixed mid-session

- **Field-name bug** — initial `computeDecomposedActionEVs` read `group.id` / `group.equity`, but the data contract (v2 spec) defines `groupId` / `heroEquity`. `computeBucketEVsV2` maps `computeDominationMap`'s output into the spec shape. Caught by tests on first run (2/35 failures); fixed via replace_all on the field references; all green on re-run.

## Files I Own (this session)

- `src/utils/postflopDrillContent/drillModeEngine.js` (~400 lines appended)
- `src/utils/postflopDrillContent/__tests__/drillModeEngineV2.test.js`
- `.claude/handoffs/lsw-g4-impl-commit2.md` (this file)
- BACKLOG + STATUS updates

## Files I Will NOT Touch

- `src/components/views/PostflopDrillsView/BucketEVPanel.jsx` — v1 consumer; migration is Commit 3.
- `src/components/views/PostflopDrillsView/panels/` — components extracted in Commit 1; v2 composition root is Commit 3.
- Schema, line content, validators — Commit 2.5 owns schema v3.

## Next-session pointers

- **Commit 2.5** — `villainRanges.js` alias-layer map over `archetypeRanges.js` (seeded with JT6's keys); `lineSchema.js` bump `SCHEMA_VERSION` 2 → 3; add `validateHeroView`, `validateVillainRangeContext`, `validateNarrowingSpec`; migration guard rejecting simultaneous `heroHolding` + `heroView`.
- **Commit 3** — `BucketEVPanelV2.jsx` composition root authored; panels/ gains `GlossaryBlock`, `BucketLabel`, responsive layout helpers; JT6 flop_root migrated from `heroHolding` to `heroView`; `LineNodeRenderer` branches on `heroView` presence.
