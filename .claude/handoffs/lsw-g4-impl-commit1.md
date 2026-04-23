# Handoff: LSW-G4-IMPL Commit 1 — primitive extraction (non-breaking)

**Status:** COMPLETE (2026-04-22; test-parity + visual-parity verified)
**Started:** 2026-04-22
**Owner:** Claude (main)
**Project:** `docs/projects/line-study-slice-widening.project.md`
**Backlog item:** LSW-G4-IMPL
**Preceding handoff:** `lsw-g4-spec-path2.md`
**Spec:** `docs/design/surfaces/bucket-ev-panel-v2.md`

---

## Scope

Commit 1 of the 6-commit v2 migration path. **Non-breaking** — no behavior change. Sub-components extracted from `BucketEVPanel.jsx` into `panels/` directory for reuse by `BucketEVPanelV2` in Commit 3. `BucketEVPanel.jsx` imports them instead of defining inline.

**Non-breaking guarantees:**
- `BucketEVPanel.jsx` exports unchanged: `parseComboString`, `computeBucketEVs`, `isRowApplicable`, `BucketEVPanel`.
- `LineNodeRenderer.jsx` continues to render JT6 flop_root identically.
- All existing tests pass without modification.

## Delivered

### New files (6)
- `src/components/views/PostflopDrillsView/panels/panelHelpers.js` — `formatEV`, `actionLabel`, `CAVEAT_LABELS`, `RELATION_STYLE`, `isRowApplicable` (impl; re-exported from BucketEVPanel.jsx for test back-compat)
- `src/components/views/PostflopDrillsView/panels/PinnedComboRow.jsx` — `PinnedComboRow` component (LSW-H2)
- `src/components/views/PostflopDrillsView/panels/DominationMapDisclosure.jsx` — `DominationMapDisclosure` component (LSW-G5/G5.1/G5.2)
- `src/components/views/PostflopDrillsView/panels/BucketRow.jsx` — `BucketRow` component (single-bucket table row)
- `src/components/views/PostflopDrillsView/panels/InapplicableDisclosure.jsx` — `InapplicableDisclosure` component (LSW-H1)
- `src/components/views/PostflopDrillsView/panels/BucketEVTable.jsx` — `BucketEVTable` component

### Modified files (1)
- `src/components/views/PostflopDrillsView/BucketEVPanel.jsx` — inlined sub-components removed; imports added for the 6 new files; `isRowApplicable` re-exported from panelHelpers for test back-compat. Public API surface unchanged.

### Unchanged files
- `src/components/views/PostflopDrillsView/LineNodeRenderer.jsx` — still imports `{ BucketEVPanel }` from `./BucketEVPanel`.
- `src/components/views/PostflopDrillsView/__tests__/BucketEVPanel.test.jsx` — all imports continue to work.
- All engine code, schema, drill content.

## Verification (all green)

- [x] **Test parity** — `bash scripts/smart-test-runner.sh` completed exit-0. BucketEVPanel tests 32/32. PostflopDrillContent engine/schema 335/335. Full build clean (`npm run build` → `✓ built in 8.42s` + PWA generation).
- [x] **Visual parity** — JT6 flop_root at 1600×720 via Playwright post-refactor: pinned-combo row (J♥T♠ equity 54.8% · bet 150% +17.48bb · runner-up bet 75% +16.77bb) + domination disclosure collapsed (6 hand-type groups) + demoted bucket table (topPair · bet 150% +20.30bb · runner-up bet 75% +18.54bb · 9 combos) + caveats (synthetic range, simplified EV). Matches post-G5.2 baseline. Evidence: `docs/design/audits/evidence/lsw-g4-impl-commit1-jt6-flop-root-parity.png`.
- [x] **Import graph sanity** — `LineNodeRenderer` → `BucketEVPanel` → (panels/) chain resolves. No circular imports (build would have failed). HMR picks up the refactor cleanly.

## Files I Own (this session)

- All 6 new files in `src/components/views/PostflopDrillsView/panels/`
- `src/components/views/PostflopDrillsView/BucketEVPanel.jsx`
- `.claude/handoffs/lsw-g4-impl-commit1.md` (this file)
- BACKLOG + STATUS updates

## Files I Will NOT Touch

- `src/utils/postflopDrillContent/*` — engine changes are Commit 2.
- `src/components/views/PostflopDrillsView/LineNodeRenderer.jsx` — branching logic is Commit 3.
- Any test file — parity is the Commit-1 guarantee.
- `docs/design/surfaces/bucket-ev-panel-v2.md` — spec already signed off.

## Next-session pointers

On Commit 1 close: Commit 2 (engine v2) ships `computeBucketEVsV2` + `computeDecomposedActionEVs` in `src/utils/postflopDrillContent/drillModeEngine.js`. v1 `computeBucketEVs` stays in `BucketEVPanel.jsx` untouched.

Commit 2.5 then ships `villainRanges.js` alias map + schema v3 validator updates.

Commit 3 ships `BucketEVPanelV2.jsx` composition root + P6b glossary + schema migration of JT6 flop_root to `heroView`.
