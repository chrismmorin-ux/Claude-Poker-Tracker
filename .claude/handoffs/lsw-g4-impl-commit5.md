# Handoff: LSW-G4-IMPL Commit 5 — v1 deletion (final commit)

**Status:** COMPLETE (2026-04-22)
**Started:** 2026-04-22
**Owner:** Claude (main)
**Project:** `docs/projects/line-study-slice-widening.project.md`
**Backlog item:** LSW-G4-IMPL
**Preceding handoff:** `lsw-g4-impl-commit4.md`

---

## Scope

Final commit of the 6-commit migration. Deletes the v1 `BucketEVPanel` + v1 primitives + v1 engine functions + v1 tests. Hardens the schema migration guard so `heroHolding` can never be re-authored. **Owner-driven rationale:** the LSW audit sweep surfaced pervasive analysis + engine errors in the v1 pipeline (coarse `HERO_BUCKET_TYPICAL_EQUITY` priors, infeasible-bucket rendering S1, hero-first framing violating first-principles doctrine S5). Keeping v1 alive risks bad data silently reappearing; deleting it is actively defensive.

**Key pre-check that made aggressive deletion safe:** v1 `BucketEVPanel` was **only rendered on JT6 flop_root** — every other node (all non-root nodes, all terminals, all other lines) never declared `heroHolding` in the first place. JT6 migrated to v3 in Commit 3. So v1 deletion removes zero live-user-visible rendering.

## Delivered

### Deleted (7 files)

- `src/components/views/PostflopDrillsView/BucketEVPanel.jsx` — v1 composition root (308 lines).
- `src/components/views/PostflopDrillsView/panels/PinnedComboRow.jsx` — v1 primitive (LSW-H2).
- `src/components/views/PostflopDrillsView/panels/BucketEVTable.jsx` — v1 primitive.
- `src/components/views/PostflopDrillsView/panels/BucketRow.jsx` — v1 primitive.
- `src/components/views/PostflopDrillsView/panels/InapplicableDisclosure.jsx` — v1 primitive (LSW-H1).
- `src/components/views/PostflopDrillsView/panels/DominationMapDisclosure.jsx` — v1 primitive (LSW-G5; v2 ships VillainRangeDecomposition as replacement).
- `src/components/views/PostflopDrillsView/__tests__/BucketEVPanel.test.jsx` — v1 test file.

### Modified (5 files)

- `src/components/views/PostflopDrillsView/LineNodeRenderer.jsx` — removed v1 branch + v1 import + `HeroHoldingRow` helper. Single-path renders via `BucketEVPanelV2` when `node.heroView` is present.
- `src/components/views/PostflopDrillsView/panels/panelHelpers.js` — trimmed from 5 helpers to just `RELATION_STYLE` (the one v2 `VillainRangeDecomposition` imports).
- `src/utils/postflopDrillContent/drillModeEngine.js` — deleted 5 v1 exports (`HERO_BUCKET_TYPICAL_EQUITY`, `DEFAULT_ACTIONS`, `villainFoldRateFromComposition`, `evaluateDrillNode`, `computePinnedComboEV`) and their imports (`enumerateBucketCombos`, `buildArchetypeWeightedRange`, `aggregateBucketWeights`, `MIN_COMBO_SAMPLE`, `calcValueBetEV`, `POP_CALLING_RATES`). Module docstring rewritten to describe the v2 surface. v1 deletion rationale preserved as a section-header comment for future archaeologists. **File: 1211 → 820 lines** (~390 lines of v1 code removed).
- `src/utils/postflopDrillContent/lineSchema.js` — hard-deprecation migration guard: `validateNode` now rejects **any** node declaring `heroHolding` (was: dual-authored with `heroView`). Error message directs authors at `heroView` + `villainRangeContext` + `decisionKind`. Deleted the `validateHeroHolding` validator (no longer reachable). Schema version history updated with Commit 5 entry.
- `src/utils/postflopDrillContent/__tests__/drillModeEngine.test.js` — removed tests for deleted functions (`HERO_BUCKET_TYPICAL_EQUITY`, `DEFAULT_ACTIONS`, `villainFoldRateFromComposition`, `evaluateDrillNode`). Kept `classifyDomination` + `computeDominationMap` pair-plus-draw composite tests. File: 378 → 137 lines.
- `src/utils/postflopDrillContent/__tests__/lineSchema.test.js` — replaced the 13-test `Node.heroHolding (RT-106)` suite with a 3-test `Node.heroHolding deprecation (LSW-G4-IMPL Commit 5)` block confirming rejection + migration-pointer error message. `SCHEMA_VERSION` test note updated.
- `src/utils/postflopDrillContent/__tests__/lineSchema.v3.test.js` — the "migration guard" describe block now asserts `heroHolding` is rejected in any form (was: dual-authored rejected, legacy-alone accepted). 3 tests confirming hard deprecation + error-message guidance.

### Unchanged

- v2 composition root `BucketEVPanelV2.jsx` (Commit 3).
- v2 primitives (`VillainRangeDecomposition`, `WeightedTotalTable`, `HeroViewBlock`, `ActionRecommendationStrip`, `StreetNarrowingContext`, `ConfidenceDisclosure`, `GlossaryBlock`, `BucketLabel`).
- v2 engine surface (`GROUP_CALL_RATES`, `computeDecomposedActionEVs`, `computeValueBeatRatio`, `computeBucketEVsV2`, `classifyDomination`, `computeDominationMap`, `DOMINATION_GROUPS`, `listDominationGroupMeta`, `dominationGroupMetaFor`).
- v3 schema validators (`validateHeroView`, `validateVillainRangeContext`, `validateNarrowingSpec`).
- `villainRanges.js` alias layer.
- `variantRecipes.js`, `useResponsiveBreakpoint.js`.
- Migrated lines (JT6 flop_root, Q72r flop_root, K77 flop_root) — all render via v2.
- BUCKET_DEFINITIONS + BUCKET_DISPLAY_NAMES (`bucketTaxonomy.js`).

## Verification

- [x] **Targeted tests green** — drillContent + PostflopDrillsView suites: **387/387 passing** (down from 455 pre-deletion: −32 v1 BucketEVPanel tests, −~30 v1 engine tests, −a few consolidated heroHolding tests; net −68 tests covers the deleted surface).
- [x] **Production build clean** — `npm run build` → PWA precache size **1629 KiB** (down from 1648 KiB, confirming ~19 KB of v1 code physically removed).
- [x] **Visual verify JT6 via v2 post-deletion** (`docs/design/audits/evidence/lsw-g4-impl-commit5-jt6-post-v1-deletion.png`): DECISION SURFACE v2 header · variant V1 · Villain's range vs you showing 5 decomposition rows (DOMINATING Overcards (Ax) 45.2%/80%eq, DOMINATED Overpair 28.8%/24%eq, FAVORED Gutshot 20.5%/68%eq, FAVORED Non-nut Flush Draw 2.7%/70%eq, CRUSHED Set 1.4%/8%eq). Archetype-invariance annotation present. Bucket-label ⓘ tap targets visible. Identical structural rendering to Commit-3 canary; MC variance gives small per-group equity drift within tolerance.
- [x] **Import graph clean** — no circular dependencies; `LineNodeRenderer` renders `BucketEVPanelV2` as the only panel path; grep-check confirms no live imports of deleted files.

## Grep audit (post-deletion)

```
rg -l "heroHolding|HERO_BUCKET_TYPICAL_EQUITY|DEFAULT_ACTIONS|villainFoldRateFromComposition|evaluateDrillNode|computePinnedComboEV|PinnedComboRow|BucketEVTable|DominationMapDisclosure|InapplicableDisclosure" src/
```

Returns references only in:
- `lineSchema.js` (the migration-guard error message + the section-header comment explaining the deletion).
- `drillModeEngine.js` (section-header comment).
- `lines.js` (Commit 3 migration comments explaining the v3 shape of JT6).
- Test files: the new deprecation tests (reference `heroHolding` only to assert it's rejected).
- Handoff files + Gate-4 audit documents (prose, historical).

**No live code reachable.** The deletion is clean.

## Known limitations carried forward

- **G4-TD-1** (call-kind EV modeling) — still stubbed as `unsupported` in `computeDecomposedActionEVs`. v1.1 scope.
- **G4-TD-2** (authoredReason override path) — deferred to v1.1.
- **G4-TD-3** (archetypeRanges.js expansions for T98 + AK2) — blocks those 2 lines from migrating to v2 (their flop_root nodes currently have no panel rendering at all since v1 is deleted and they lack heroView). Not a regression — those nodes never had v1 panel rendering either (no heroHolding authored). Migration is LSW-B1 continuation work.
- **G4-TD-4** (selectVariant should distinguish check from bet) — cosmetic.
- **MW lines (J85, Q53)** — still blocked on LSW-G6 MW bucket-EV engine.
- **Non-root nodes** on every line (turn/river decision + terminals) — no panel rendering. LSW-B2 + LSW-B3 extend v2 coverage to those nodes via heroView + villainRangeContext authoring.

## LSW-G4-IMPL: CLOSED

All 6 commits of the migration path shipped:
- **Commit 1** ✓ primitive extraction, non-breaking
- **Commit 2** ✓ engine v2 parallel exports
- **Commit 2.5** ✓ villainRanges alias + schema v3 validators
- **Commit 3** ✓ JT6 canary + v2 panel + primitives + glossary + responsive + JT6 migration
- **Commit 4** ✓ LSW-B1 partial migration (Q72r + K77)
- **Commit 5** ✓ v1 mechanical deletion (this handoff)

The bucket-ev-panel Path 2 restructure is **COMPLETE**. Villain-first decision modeling is live on 3 flop roots (JT6, Q72r, K77) with structural enforcement of I-DM-1/2/3 via `VARIANT_RECIPES` + component interfaces + dev assertions. Bad-data regressions from the v1 pipeline are structurally impossible (schema rejects `heroHolding`; no v1 code path exists).

## Files I Own (this session)

- All 7 deleted files (no longer in tree)
- `src/components/views/PostflopDrillsView/LineNodeRenderer.jsx`
- `src/components/views/PostflopDrillsView/panels/panelHelpers.js`
- `src/utils/postflopDrillContent/drillModeEngine.js`
- `src/utils/postflopDrillContent/lineSchema.js`
- `src/utils/postflopDrillContent/__tests__/drillModeEngine.test.js`
- `src/utils/postflopDrillContent/__tests__/lineSchema.test.js`
- `src/utils/postflopDrillContent/__tests__/lineSchema.v3.test.js`
- `.claude/handoffs/lsw-g4-impl-commit5.md` (this file)
- BACKLOG + STATUS updates

## Next-session pointers

LSW-G4-IMPL closes with this commit. Remaining LSW work opens:

- **LSW-B2** — turn-node migrations (JT6 + Q72r + K77 turn nodes; each requires `heroView` + `villainRangeContext` + narrowingSpec authoring).
- **LSW-B3** — river-node migrations (bluff-catch + thin-value variants exercise V5/V6 panel modes).
- **LSW-G6** — MW bucket-EV engine (unblocks J85, Q53 migrations).
- **G4-TD-1/2/3/4** — follow-on tech debt for call-kind EV, authoredReason, archetype range authoring, variant selection.
- **LSW-A2..A8** — remaining per-line audits (Stream A continuation) before widening.
