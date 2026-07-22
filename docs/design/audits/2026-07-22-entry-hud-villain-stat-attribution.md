# Gate 1 Entry — 2026-07-22 — HUD villain stat attribution (sample size + quality badge on seat popover)

**Surface working name:** Sample-size + sample-quality attribution on the sidebar seat-popover Stats section (`buildSeatPopoverHtml`)
**Proposed by:** WS-236 / FIND-024 (provenance-audit baseline, 2026-06-19). Implementation claimed by SPR-145 (approved 2026-06-22, resumed 2026-07-22).
**Gate:** 1 (Entry) — surface-bound modification of an existing element (seat popover inside the sidebar seat arc, SHC Z1).
**Next gate:** 4 (Design) — surface artifact update to `surfaces/sidebar-zone-1.md` (new §Z1-POPOVER-ATTR section), same session.
**Status:** GREEN.

---

## Why this audit exists

FIND-024: the highest-stakes surface (live in-hand HUD) has the weakest attribution. The seat popover shows raw VPIP/PFR/AF percentages computed by a parallel engine (`ignition-poker-tracker/shared/stats-engine.js`) with **no sample size when no style label exists** (exactly the small-sample case where attribution matters most) and no quality indicator ever. A live decision is made on the least-attributed value in the system (provenance chain map DP-008). This change adds visible attribution; a companion parity seam test pins the parallel engine to the main-app `tendencyCalculations.js` semantics so the two paths cannot silently diverge.

## Output 1 — Scope classification

**Primary classification:** Surface-bound modification — attribution metadata added to an existing popover section. No new route, no new zone, **no new interaction primitive** — the popover's open/dismiss behavior is untouched; the additions are passive labels: the `Nh` raw-count form (already canonical per INV-DENSITY-3) and a categorical sample-quality badge reusing the established DATA/PARTIAL/EST vocabulary from the main app's LiveAdviceBar (DP-004) and the existing `uh-style-badge`-class badge shape (R-1.6 treatment-type consistency).

**Doctrine boundary honored:** the closed 4-tier confidence register (`shared/render-confidence.js`, V-2 §III) is scoped to *engine model outputs* (§III.5) and is NOT extended here — raw capture counts are neither model outputs nor mathematically exact, so they get the sample-quality badge (a distinct concept-class), not a `conf-tier-*` dot. `n=N` pairing stays reserved for confidence dots; this change uses the standalone `Nh` form (INV-DENSITY-3).

**Gate 2 triggers:** none fire. No new interaction pattern, no destructive action, no new surface, no underserved-persona target, no product-line crossing. The badge vocabulary was already adversarially reviewed where it shipped (LiveAdviceBar fold% DP-004).

**Verdict on Gate 2 requirement:** NOT required (per `LIFECYCLE.md` — modification of existing element with no new interaction primitive → Gates 1, 4, 5).

## Output 2 — Personas served

- Mid-hand-chris / multi-tabler — primary: glances the popover mid-session to judge whether a read is trustworthy; a bare "VPIP 67%" over 3 hands currently reads identically to one over 300 hands.
- Between-hands-chris — scouting seats between hands; sample quality determines whether to trust the style tag or keep observing.
- Out-of-scope: newcomer-first-hand (popover only appears once capture produces stats).

## Output 3 — JTBD identified

- JTBD-DS-58 — *validate-confidence-matches-experience* — the attribution is what lets the player calibrate trust in the number against how long they've watched the seat.
- Existing table-read JTBD (JTBD-MH-13 seat-activity read) — unchanged; this annotates it.

## Output 4 — Gap analysis

**Ready:** `sampleSize` already computed by `derivePercentages` and present on every `cachedSeatStats` entry; seat arc already surfaces sample bands (SR-6.11 ring bands + `Nh` title + badge + `—` placeholder) so the vocabulary is established at the arc; DP-004 badge thresholds (≥15 DATA / ≥5 PARTIAL / else EST) shipped in `LiveAdviceBar.jsx`; `uh-style-badge` badge shape reusable; popover builder is already a pure HTML-string builder (SR-6.5).

**Missing (the work):** popover builder lives inside the `side-panel.js` IIFE (untestable — violates the "put testable logic in render-orchestrator.js" rule) → extract to `render-orchestrator.js`; sample-quality tier helper (pure, in `shared/stats-engine.js` beside the stats it qualifies); always-on `Nh` + badge in the Stats section; DOM tests; parity seam test (main-app suite, importing the dependency-free `stats-engine.js`).

**At risk:**
- **Density (INV-DENSITY-1/3):** popover is a 300px overlay; additions are one badge + one count in the existing header/label rows — no new rows. Typography via existing CSS vars.
- **Vocabulary collision:** DATA/PARTIAL/EST must not be confusable with the conf-tier dots. Mitigation: badge form (text chip) vs dot form; different color set (mirrors LiveAdviceBar's).
- **Cross-engine drift (the FIND-024 root):** badge thresholds hard-coded in two places would itself be drift. Mitigation: thresholds live once in `stats-engine.js` next to `MIN_STYLE_SAMPLE`; parity test pins the stat semantics.

## Output 5 — Verdict

**GREEN.** Existing personas/JTBD cover the change; it reuses two established vocabularies (Nh raw-count form, DATA/PARTIAL/EST quality badge) rather than opening new design space; the doctrine's closed confidence register is explicitly not touched. Gate 4 obligation: add §Z1-POPOVER-ATTR to `surfaces/sidebar-zone-1.md` — done as companion edit to this audit.

**Decisions noted (autonomous execution under founder-approved SPR-145):**
1. Badge thresholds mirror DP-004 (≥15 DATA / ≥5 PARTIAL / else EST) for cross-surface consistency; single source in `stats-engine.js`.
2. Raw counts get the sample-quality badge, not conf-tier dots — extending the closed register to non-model values would need a doctrine amendment (R-1.6/§III.5) and would blur the model-vs-empirical distinction the register encodes.
3. Parity is asserted by test (accept-criterion option B), not by unifying the two engines — the extension must stay dependency-free (MV3 bundle, no main-app import path), which is the documented reason a separate path exists.

## Links

- Work item: `.claude/workstream/queue/WS-236.yaml` (sprint SPR-145)
- Finding: `.claude/workstream/findings/FIND-024.yaml` (provenance chain map DP-008)
- Surface artifact amended: [`surfaces/sidebar-zone-1.md`](../surfaces/sidebar-zone-1.md) §Z1-POPOVER-ATTR
- Badge-pattern precedent: `src/components/views/TableView/LiveAdviceBar.jsx` ConfidenceBadge (DP-004)
- Doctrine boundary: [`surfaces/sidebar-shell-spec.md`](../surfaces/sidebar-shell-spec.md) §III (closed confidence register)

## Change log

- 2026-07-22 — Created. Verdict GREEN; Gate 2 not required (no new interaction primitive); three execution decisions noted. Implementation proceeding under WS-236 / SPR-145.
