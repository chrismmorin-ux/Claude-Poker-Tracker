# Handoff: LSW-G4 Path 2 — v2 spec + specialist reviews

**Status:** COMPLETE (spec revised post-review; awaits Gate-4 heuristic audit + Gate-3 J1/J2 work before Commit 1)
**Started:** 2026-04-22
**Owner:** Claude (main)
**Project:** `docs/projects/line-study-slice-widening.project.md`
**Backlog item:** LSW-G4 (roundtable); LSW-G4-IMPL (implementation, blocked)
**Preceding handoff:** `lsw-h3-visual-sweep.md`

---

## Context

Owner selected Path 2 (full villain-first restructure) from the G4 roundtable, with forward-compatibility directive: "design for the final state — we should not have to redesign when we populate more slices and lines, such as variation in hero hands, first action being hero's, or varied villain first actions. Bluff-catching and thin-value scenarios must be first-class."

## Delivered this session

- **`docs/design/surfaces/bucket-ev-panel-v2.md`** — Gate-4 design artifact. 8 axes of variation, 8 primitives, 11 canonical variants (V1-V11), data contract for `ComputeBucketEVsInput`/`Output`, schema extensions for `lines.js`, persona × JTBD coverage table, 5-commit migration path, 6 open Gate-4 questions, 5 risks, 3 decision-modeling invariants.
- **`docs/design/audits/2026-04-22-blindspot-lsw-g4-villain-first-panel.md`** — Gate-2 roundtable (committed prior to Path 2 selection; still the decision record).
- **BACKLOG.md** — LSW-G4 closed; LSW-G4-IMPL opened (5-commit scope, blocked); LSW-J1 (Gate-3 JTBDs DS-48..51) and LSW-J2 (first-principles-learner persona) opened.
- **STATUS.md** — Active Sessions line updated.
- **3 parallel specialist reviews launched** (systems-architect, product-ux-engineer, senior-engineer) — systems-architect returned with 3 P0/P1 structural findings to address before Commit 2.

## Specialist review — systems-architect (complete)

**Verdict: YELLOW** — implement with targeted pre-Commit-2 fixes.

**P0 finding.** `ComputeBucketEVsOutput.actionEVs[].perGroupContribution` is NOT an additive migration — current engine computes EV via `HERO_BUCKET_TYPICAL_EQUITY` coarse priors and domination map via `handVsRange` per group; the two pipelines never cross. P2 (`WeightedTotalTable`) requires a new `computeDecomposedActionEVs` function that joins them. Spec's "additive" claim is false for P2. **Fix:** either prototype this computation before Commit 2 or explicitly defer P2's per-group contribution rows (totals-only) with I-DM-2 acknowledged as not-yet-satisfied.

**P1 — narrowingRule enum.** A frozen enum won't scale as LSW-B1/B2/B3 multiply content. Fix: parameterized `narrowingSpec` object `{ kind, ...params }` with a handler-map dispatch. Additive new handlers instead of enum churn.

**P1 — villainRanges.js centralization.** Creates a parallel store to existing `archetypeRanges.js`, causing dual maintenance. Fix: `baseRangeId` becomes a string alias resolved against `archetypeRanges.js`; `villainRanges.js` is an alias map, not a data store.

**P2 — I-DM invariants are aspirational.** Encode structurally: ordered array for composition root, assertion in `WeightedTotalTable` for empty `perGroupContribution`, physically-unreachable `isBestActionLabel` prop on P3.

**P2 — Axis 7 seam underestimated.** `computeDominationMap` lacks an archetype param; rewiring is deeper than "30 lines."

**Hidden risks:**
- Trial-count mismatch (800 vs 250) between pinned-combo path and per-group path → inconsistent CI widths.
- `computeBucketEVs` currently lives in `BucketEVPanel.jsx`, not `drillModeEngine.js` — migration must pick an owner.
- `P4.oneLineReason` needs authored-vs-templated discriminant.
- `SCHEMA_VERSION` bump needed (2 → 3).
- Migration guard: schema must reject simultaneous `heroHolding` + `heroView`.
- `ActionEntry` type reuse from live-game engine violates drill-layer isolation — need `StudyActionEntry`.

## Specialist review — product-ux-engineer (complete)

**Verdict: YELLOW.**

**P1 items:**
- Q4 layout conflict: "default-visible" P5 + "fits above fold" in direct tension. Fix: P5 docks above P1, 2-line cap; P1 visible-row cap 6; P2 visible-column cap 5.
- V5/V6 pedagogical payload delegated to P4 (skip-safe strip) instead of P1. Fix: P1 polar-split rendering mode triggered by `decisionKind: 'bluff-catch' | 'thin-value'`; `valueBeatRatio` output field added.
- Archetype toolbar inconsistency unmitigated. Fix: inline column-header note `(base range — unaffected by archetype)`.
- `streetNarrowing` single-step output insufficient for river-node axis-5 pedagogy. Fix: ordered array of narrowing events.

**P2 items:** P3 three-mode coupling risk (defer decision to V10 session); Coach JTBDs are proposed status (mark in table); Reveal button fate (elevate to Q7).

## Specialist review — senior-engineer (complete)

**Verdict: YELLOW.**

**P0 items:**
- Canary approach creates permanent dual-path; Commit 5 trigger unverifiable. Fix: make `heroView` required on v2 nodes + reject dual-authored nodes + mechanical grep criterion for Commit 5.
- `computeBucketEVs` output not additive — 17 existing tests break. Fix: new `computeBucketEVsV2` as parallel export; v1 function stays untouched.

**P1 items:**
- `narrowingRule` enum undersized at v1 scope (4 values, 7 depth types). Fix: composable `narrowingSpec` with handler-map dispatch.
- `villainRanges.js` prerequisite library doesn't exist; JT6 range lookup currently fails. Fix: Commit 2.5 seeds JT6 aliases before Commit 3 canary migration.
- Test plan undefined (no snapshot tests exist in repo). Fix: behavioral test layout per primitive + engine shape tests + schema v3 migration tests.

**P2 items:** `VARIANT_RECIPES` code-level registry (not just docs); `oneLineReason` authored-vs-templated split; Reveal-button fate.

## Revisions synthesized

All P0 + P1 findings addressed in-spec. Major changes:
- Data contract → new parallel `computeBucketEVsV2` + `computeDecomposedActionEVs`; v1 untouched.
- Schema → v3 bump, migration guard, `narrowingSpec` composable, `villainRanges.js` alias layer.
- Primitives → P1 bluff-catch/thin-value modes, visible-row/column caps, column-header archetype note, I-DM enforcement mechanisms.
- P5 → docked above P1, 2-line summary, ordered array output.
- Migration path → 4 commits → 6 commits (added 2.5 for villainRanges + schema v3, split 3 for variantRecipes).
- Preamble → explicit note: Path 2 chosen over roundtable's default Path 1.
- 7+ new risks; 2 new open questions (Q7 reveal button, Q8 authored/templated fallback).

## Files I Own (this session)

- `docs/design/surfaces/bucket-ev-panel-v2.md` (draft; will revise post-synthesis)
- `.claude/handoffs/lsw-g4-spec-path2.md` (this file)
- `.claude/BACKLOG.md` (LSW-G4, LSW-G4-IMPL, LSW-J1, LSW-J2 rows)
- `.claude/STATUS.md` (Active Sessions line)

## Files I Will NOT Touch (this session)

- `src/components/views/PostflopDrillsView/BucketEVPanel.jsx` — implementation starts after spec sign-off.
- `src/utils/postflopDrillContent/*` — same.
- `docs/design/jtbd/domains/drills-and-study.md` — LSW-J1 is a separate ticket.
- `docs/design/personas/*` — LSW-J2 is a separate ticket.

## Next actions after review synthesis

1. Revise spec to address all P0/P1 findings.
2. Commit spec + reviews summary.
3. Push.
4. Open Gate-4 heuristic audit (walking the revised spec through Nielsen-10 / PLT / ML sets).
5. Ship Gate-3 work (LSW-J1 JTBDs + LSW-J2 persona) — unblocks the Gate-4 audit.
6. Start Commit 1 of the 5-commit migration (primitive extraction, non-breaking).
