# Handoff: LSW-G4-IMPL Commit 2.5 — villainRanges alias + schema v3

**Status:** COMPLETE (2026-04-22)
**Started:** 2026-04-22
**Owner:** Claude (main)
**Project:** `docs/projects/line-study-slice-widening.project.md`
**Backlog item:** LSW-G4-IMPL
**Preceding handoff:** `lsw-g4-impl-commit2.md`
**Spec:** `docs/design/surfaces/bucket-ev-panel-v2.md`

---

## Scope

Commit 2.5 of the 6-commit v2 migration path. Ships the prerequisite infrastructure for Commit 3's canary migration: `villainRanges.js` alias layer + schema v3 validator extensions. No behavior change on existing content; adds the vocabulary v3 content will reference.

## Delivered

### New files (3)

- `src/utils/postflopDrillContent/villainRanges.js` — **alias layer**, not parallel store (per systems-architect review). Exports:
  - `VILLAIN_RANGE_ALIASES` — frozen map seeded with 3 HU aliases: `btn_vs_bb_3bp_bb_range` (JT6 canary) + `btn_vs_bb_srp_bb_flat` (Q72r) + `co_vs_bb_srp_bb_flat` (K77). Deferred aliases (T98, AK2, MW) documented inline for later commits.
  - `villainRangeFor(baseRangeId)` — resolves alias → archetypeRangeFor tuple. Two-layer error discrimination: unknown alias vs underlying range missing.
  - `isKnownBaseRangeId(id)` — O(1) predicate for validator back-compat.
  - `listBaseRangeAliases()` — enumeration helper for Explorer UI + tests.
- `src/utils/postflopDrillContent/__tests__/villainRanges.test.js` — 13 tests (frozen-map + seed-alias shape + delegation correctness + 2-layer error messages + mutation safety).
- `src/utils/postflopDrillContent/__tests__/lineSchema.v3.test.js` — 26 tests (version bump + enum exports + v3 node acceptance + migration guard rejecting dual-authored nodes + heroView kind/combo constraints + `air` rejection when single-combo + villainRangeContext baseRangeId/narrowingSpec validation + decisionKind/decisionStrategy enum checks + v2-legacy content still passes).

### Modified files (2)

- `src/utils/postflopDrillContent/lineSchema.js` — v3 extensions:
  - `SCHEMA_VERSION` bumped `2 → 3` with inline version-history comment.
  - New frozen exports: `HERO_VIEW_KINDS`, `DECISION_KINDS`, `DECISION_STRATEGIES`, `NARROWING_SPEC_KINDS`.
  - New validators: `validateHeroView`, `validateNarrowingSpec`, `validateVillainRangeContext`.
  - `validateNode` extended with 5 new branches: migration guard (rejects simultaneous `heroHolding + heroView`) + `heroView` call + `villainRangeContext` call + `decisionKind` enum check + `decisionStrategy` enum check.
  - v2 legacy `heroHolding` validator untouched — legacy content continues to validate.
- `src/utils/postflopDrillContent/__tests__/lineSchema.test.js` — `SCHEMA_VERSION` test updated from `toBe(2)` to `toBe(3)` with version-history note.

### Unchanged

- All engine code (drillModeEngine v1 + v2 from Commit 2).
- Panel code (BucketEVPanel.jsx + panels/ from Commit 1).
- Line content (`lines.js`) — migration starts in Commit 3.
- Archetype ranges (`archetypeRanges.js`) — referenced as the canonical data store.

## Verification

- [x] **New tests** — `villainRanges.test.js` 13/13; `lineSchema.v3.test.js` 26/26.
- [x] **Regression** — full drillContent + PostflopDrillsView suite: **441/441 passing** (up from 402 pre-commit: 32 BucketEVPanel + 335 prior drillContent + 35 v2 engine + 39 v2.5 new).
- [x] **Production build** — `npm run build` clean.
- [x] **v2 content still validates** — legacy test for heroHolding-only nodes passes unchanged; dual-authored migration-guard test confirms heroHolding + heroView is rejected with specific error message.

## Fixed mid-session

- **Test assertion bug** — initial v3 tests used `.valid` but `validateLine` returns `.ok`. Caught immediately (21 of 39 tests failed). Fixed via replace_all. Unrelated to production code quality — pure test authoring error.

## Files I Own (this session)

- `src/utils/postflopDrillContent/villainRanges.js` (new)
- `src/utils/postflopDrillContent/lineSchema.js` (modified)
- `src/utils/postflopDrillContent/__tests__/villainRanges.test.js` (new)
- `src/utils/postflopDrillContent/__tests__/lineSchema.v3.test.js` (new)
- `src/utils/postflopDrillContent/__tests__/lineSchema.test.js` (version-test update only)
- `.claude/handoffs/lsw-g4-impl-commit25.md` (this file)
- BACKLOG + STATUS updates

## Next-session pointers

- **Commit 3 (canary)** — biggest commit of the 6. Ships:
  - `BucketEVPanelV2.jsx` composition root reading `VARIANT_RECIPES` ordered constant.
  - `panels/GlossaryBlock.jsx` (Gate-4 F01 — first-class bucket-label glossary with tap-for-definition, ≥44 DOM-px tap area).
  - Shared `panels/BucketLabel.jsx` used by P1 + P2 + P6b for consistent `displayName` rendering.
  - Responsive layout helpers (Gate-4 F02 — <1200/<900/<640 thresholds).
  - `BUCKET_TAXONOMY` entries gain required `definition: string` field.
  - JT6 flop_root migrated `heroHolding → heroView` in `lines.js`.
  - `LineNodeRenderer.jsx` branches on `heroView` presence: v3 → BucketEVPanelV2; v2 → BucketEVPanel.

Other HU lines (Q72r, K77) can migrate in Commit 4 via LSW-B1, using the now-registered aliases.
