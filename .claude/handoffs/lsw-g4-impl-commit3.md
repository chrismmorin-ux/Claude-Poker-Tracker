# Handoff: LSW-G4-IMPL Commit 3 — JT6 canary + v2 composition root

**Status:** COMPLETE (2026-04-22)
**Started:** 2026-04-22
**Owner:** Claude (main)
**Project:** `docs/projects/line-study-slice-widening.project.md`
**Backlog item:** LSW-G4-IMPL
**Preceding handoff:** `lsw-g4-impl-commit25.md`
**Spec:** `docs/design/surfaces/bucket-ev-panel-v2.md`

---

## Scope

Biggest commit of the 6-commit migration. Ships the v2 panel composition root + 7 new primitives + BUCKET definition data + JT6 canary migration + dual-path LineNodeRenderer branching.

## Delivered

### New files (11)

**Shared + registry:**
- `src/components/views/PostflopDrillsView/panels/variantRecipes.js` — `VARIANT_RECIPES` frozen constant (V1–V6) + `selectVariant` routing + `primitivesForVariant` helper. I-DM-1 enforcement: composition ordering lives in a grep-visible constant.
- `src/components/views/PostflopDrillsView/panels/useResponsiveBreakpoint.js` — hook returning `lg`/`md`/`sm`/`xs` based on DOM viewport. Gate-4 F02 compliance (≥1200/≥900/≥640 thresholds). Exports `p1RowCapForBreakpoint` + `p2ColumnModeForBreakpoint` helpers.

**v2 primitives (all new, coexist with v1 primitives until Commit 5):**
- `panels/BucketLabel.jsx` — shared label wrapper used by P1/P2/P6b. Inline tap-for-definition popover with ≥44 DOM-px tap area (Gate-4 F01/F14). Falls back to raw id when label has no display entry.
- `panels/GlossaryBlock.jsx` (P6b) — collapsed-by-default bucket-label glossary scoped to current node's labels.
- `panels/VillainRangeDecomposition.jsx` (P1) — primary teaching block with 3 rendering modes (standard / bluff-catch polar-split / thin-value beat-vs-pay split). Expanded-by-default (I-DM-1). Responsive row cap 6/6/4/3.
- `panels/WeightedTotalTable.jsx` (P2) — per-group × per-action arithmetic. Responsive layout: detail-5 / aggregated-3 / vertical across breakpoints. I-DM-2 dev-assertion on empty `perGroupContribution`.
- `panels/HeroViewBlock.jsx` (P3) — hero context header. Interface physically excludes EV props (I-DM-3). v1 ship: single-combo only; combo-set + range-level are stubs.
- `panels/ActionRecommendationStrip.jsx` (P4) — 1-line templated or authored reason. Dev warns when both present.
- `panels/StreetNarrowingContext.jsx` (P5) — docked above P1 on non-root nodes. Renders `streetNarrowing` ordered array with "show full history" expansion.
- `panels/ConfidenceDisclosure.jsx` (P6) — MC trials + caveats + methodology disclosure.

**Composition root:**
- `src/components/views/PostflopDrillsView/BucketEVPanelV2.jsx` — reads VARIANT_RECIPES + dispatches to `computeBucketEVsV2` + renders primitives per recipe. No Reveal gate (Gate-4 Q7 resolved). Renders structured error banner on `errorState` population.

**Tests:**
- `panels/__tests__/variantRecipes.test.js` — 14 tests. Frozen-map shape + I-DM invariant enforcement (P1 before P3; P2 present; P6b in every recipe; P5 on turn/river only; P6+P6b tail) + selectVariant routing (bluff-catch → V5, thin-value → V6, standard by street+who-acts-first) + primitivesForVariant safety.

### Modified files (4)

- `src/utils/postflopDrillContent/bucketTaxonomy.js` — added `BUCKET_DEFINITIONS` frozen map (31 bucket IDs → 1-sentence student-language definitions) + `BUCKET_DISPLAY_NAMES` frozen map + `displayNameForBucket()` + `definitionForBucket()` helpers. Additive — existing consumers unaffected.
- `src/utils/postflopDrillContent/drillModeEngine.js` — added `definition` field to every `DOMINATION_GROUPS` entry + new exports `listDominationGroupMeta()` + `dominationGroupMetaFor(id)` for glossary consumers.
- `src/utils/postflopDrillContent/lines.js` — JT6 `flop_root` migrated from `heroHolding` → `heroView` + added `villainRangeContext.baseRangeId: 'btn_vs_bb_3bp_bb_range'` + `decisionKind: 'standard'` + `decisionStrategy: 'pure'`. First and only line migrated in Commit 3 (others land in Commit 4 via LSW-B1).
- `src/components/views/PostflopDrillsView/LineNodeRenderer.jsx` — dual-path branching on `node.heroView` presence. v3 nodes → `BucketEVPanelV2` (no reveal gate per I-DM-1); legacy v2 nodes → `BucketEVPanel` (reveal gate). Migration guard in schema validator ensures the branch is clean.
- `src/components/views/PostflopDrillsView/__tests__/BucketEVPanel.test.jsx` — `getJT6FlopNode` helper synthesizes a v2-legacy fixture (adds `heroHolding` back + strips `heroView`) so the existing 32 v1 tests continue to exercise the v1 code path against the migrated JT6 node. Commit 5 retires this helper with the v1 panel.

### Unchanged

- v1 primitives (PinnedComboRow, BucketEVTable, BucketRow, InapplicableDisclosure, DominationMapDisclosure) — coexist with v2 in `panels/` until Commit 5 deletion.
- v1 `computeBucketEVs` in `BucketEVPanel.jsx` — untouched. v1 panel continues to render on non-migrated nodes.
- v1 BucketEVPanel test file — test signature unchanged; fixture helper adapts.
- All engine v1/v2 code from Commits 1/2/2.5.

## Verification

- [x] **Targeted tests** — `variantRecipes.test.js` 14/14.
- [x] **Regression** — full drillContent + PostflopDrillsView: **455/455 passing** (up from 441: +14 variantRecipes tests). 32 v1 BucketEVPanel tests pass unchanged.
- [x] **Production build** — `npm run build` clean. No import errors, no circular dependencies.
- [x] **Visual verify** — JT6 flop_root at 1600×720 via Playwright. Evidence:
  - `evidence/lsw-g4-impl-commit3-jt6-v2-canary.png` — viewport showing P1 VILLAIN'S RANGE VS YOU expanded with 5 decomposition rows (FAVORED Overcards Ax 45.2%/76%eq, CRUSHED Overpair 28.8%/19%eq, FAVORED Gutshot 20.5%/73%eq, FAVORED Non-nut FD 2.7%/72%eq, CRUSHED Set 1.4%/8%eq) + archetype-invariance annotation + ⓘ tap targets on each bucket label.
  - `evidence/lsw-g4-impl-commit3-jt6-v2-canary-mid.png` — scrolled showing P2 arithmetic (Fold row +0.00bb across all columns), P4 recommendation ("Correct: Raise to 9bb at +14.77bb..."), P3 hero context ("YOUR HAND · J♥T♠ · (top pair, good kicker)"), P6 confidence strip ("MC trials: 500 · archetype: reg · [synthetic range] [simplified EV] · methodology ▸"), P6b glossary ("Bucket definitions (6 labels on this node)" collapsed).
- [x] **I-DM structural enforcement confirmed** — P1 renders above P3 per VARIANT_RECIPES.V1 ordering; P3's amber block has no EV number; P2 arithmetic visible for every action.

## Known v1-ship limitations

Noted here because the visible canary makes them discoverable:

- **Call-kind EV modeling is stubbed.** `computeDecomposedActionEVs` treats `kind: 'call'` as `unsupported: true` (0 EV across all groups). On JT6 the authored-correct branch is "Call" but the engine picks "Raise to 9bb" as best because raise gets computed per bet-EV math. This is a **v1.1 scope** fix (requires threading villain bet size from `node.villainAction.size` into the EV formula `equity × (pot + 2V) − V`). The panel structure is correct; the EV rankings are off for call-heavy decisions. Gate-4 heuristic audit items F02-F14 were about layout/glossary/error-states — call-EV is an engine-accuracy question belonging to LSW-D1 depth-2 territory.
- **Templated recommendation ignores authored `correct` flag.** P4 renders `Correct: {best-by-EV action}` regardless of whether the authored line flags a different branch. Fix requires surfacing authored reason (new `authoredReason` field path from `node.decision.branches` or similar). v1.1 scope.
- **streetNarrowing is always null on JT6** — flop_root has no narrowing. Turn/river nodes on future lines will populate via action history threading. No code changes needed; the pipeline accepts the array when B1/B2 authors add `actionHistory` to their heroView schema.

These limitations are tracked in the handoff + spec's risks section. None blocks Commit 3; all are deliberate v1-ship scope decisions per spec.

## Files I Own (this session)

- 11 new files in `src/components/views/PostflopDrillsView/panels/` + `BucketEVPanelV2.jsx` + tests dir
- `src/utils/postflopDrillContent/bucketTaxonomy.js` (modified)
- `src/utils/postflopDrillContent/drillModeEngine.js` (definitions + new helpers)
- `src/utils/postflopDrillContent/lines.js` (JT6 flop_root migration)
- `src/components/views/PostflopDrillsView/LineNodeRenderer.jsx` (branch)
- `src/components/views/PostflopDrillsView/__tests__/BucketEVPanel.test.jsx` (fixture helper)
- `.claude/handoffs/lsw-g4-impl-commit3.md` (this file)
- BACKLOG + STATUS updates

## Files I Will NOT Touch

- v1 `BucketEVPanel.jsx` — deletion is Commit 5.
- v1 primitives in `panels/` — deletion is Commit 5.
- Other lines (Q72r, K77, T98, AK2, MW) — migration is Commit 4.
- `computeBucketEVs` / call-kind engine modeling — v1.1 / LSW-D1 scope.

## Next-session pointers

- **Commit 4 — LSW-B1 line migration.** 4 HU flop roots (Q72r, K77, T98, AK2) migrate `heroHolding → heroView` per H3 feasibility checklist + the now-registered `villainRanges.js` aliases. Each node renders via v2. Requires:
  - Adding aliases for T98 (`sb_vs_btn_3bp_btn_range` → new entry needed in archetypeRanges.js) and AK2 (`utg_vs_btn_4bp_btn_call`) before those 2 lines can fully resolve.
  - Q72r and K77 alias already seeded in Commit 2.5 — those 2 ship first.
- **Commit 5 — v1 mechanical deletion.** Grep-based removal criterion: `rg "heroHolding|byBucket|PinnedComboRow|BucketEVTable|DominationMapDisclosure|InapplicableDisclosure" src/` returns empty outside deprecation notices.
- **Pre-Commit-4 tech-debt backlog (opened by this commit):**
  - **G4-TD-1:** call-kind EV modeling. Thread villain bet size through `computeDecomposedActionEVs`. v1.1 scope.
  - **G4-TD-2:** `recommendation.authoredReason` path — line-content-authored override for engine-templated recommendation. Schema + engine plumbing.
  - **G4-TD-3:** T98 + AK2 `archetypeRanges.js` authoring (BTN 3bet-vs-SB, BTN call-of-4bet). Blocks LSW-B1 for those 2 lines.
