# Audit — 2026-06-19 — Entry — Tournament Strategy: ICM Foundation

**Scope:** A real $-value model for tournament chips. New `src/utils/icmEngine/` (Malmuth-Harville $EV) + a payout-ladder data model, surfaced by replacing the fake `icmPressure` zone with ICM-backed numbers (hero risk premium + per-seat $EV) on existing tournament surfaces (TableHeader mini-strip / IcmBadge / ChipStackPanel / sidebar).
**Auditor:** Claude (main), session 2026-06-19.
**Method:** LIFECYCLE.md Gate 1 — scope classification, persona check, JTBD check, gap analysis.
**Status:** Open — **GREEN** (refines existing tournament surfaces with the math their labels already promise). Proceed to Gate 4 inline / implementation.
**Owner decisions (2026-06-19):** start with the ICM foundation (payout model + engine + doctrine); proper Malmuth-Harville model, not a heuristic.
**Doctrine:** authored first — `POKER_THEORY.md` §10 (Tournament & ICM), governs `icmEngine/` under `prog-domain-correctness`.

---

## Executive summary

Tournament support today is a logistics dashboard (clock, stacks, M-ratio zones, projections) with **zero strategy math** — the "ICM" badge is a bubble-distance label, and there is no Independent Chip Model anywhere. This work supplies the missing math: chips → dollars via ICM, and a risk premium that makes tournament all-in decisions correct (chip-EV is wrong near the money). It is a **refinement of existing surfaces** — the `IcmBadge`, the TableHeader tournament strip, and `ChipStackPanel` already exist and already display tournament context; this fills their numbers in with real ICM instead of zone labels. No new routed view, no new persona. Verdict GREEN.

## Scope classification

**Surface-bound refinement + new engine.** The user-facing change upgrades existing tournament widgets (header strip, `IcmBadge`, `ChipStackPanel`) from label-only to ICM-backed numbers, plus an optional payout-entry field in the existing `TournamentSetupForm`. The substantive new work is the engine + payout data model (non-UX). No new surface artifact required; `surfaces/table-view.md` (tournament overlay) + the tournament dashboard surface get small extensions.

## Personas check

Every relevant persona is already in the cast. **No new persona required.**

| Persona | Relevance | In cast? |
|---|---|---|
| circuit-grinder | core; live-MTT player, the primary ICM consumer | ✅ |
| bubble-decision (situational) | the exact spot ICM is for — folding chip-EV+ hands near the money | ✅ |
| final-table-play (situational) | ICM is exact + largest at the final table | ✅ |
| hybrid-semi-pro, rounder | play tournaments in their mix | ✅ |
| push-fold-short-stack (situational) | short-stack shove/call decisions are $EV decisions | ✅ |

## JTBD check

The tournament JTBD domain already models this (`docs/design/jtbd/domains/tournament-specific.md`): **TS-35** (ICM-pressure indicator), **TS-43** (ICM-adjusted decision at the bubble), **TS-44** (pay-jump proximity), **TS-37** (stack-depth strategy zone). These were authored as "served" by surfaces that in fact only show labels — this work makes them genuinely served. No new JTBD required for the foundation; the consumer follow-ons (push/fold ranges TS-36, satellite TS-41) get their own entries when built.

## Gap analysis output

**GREEN** — personas + JTBDs all exist; this supplies the math behind labels already shipped.

| Dimension | Status | Notes |
|---|---|---|
| Persona coverage | GREEN | All relevant tournament personas in cast |
| JTBD coverage | GREEN | TS-35/TS-43/TS-44 already model ICM; foundation makes them real |
| Heuristic pre-check | GREEN | Reuses existing tournament-strip / badge widgets; adds one optional setup field |
| Cross-surface | GREEN (note) | Touches TableHeader strip, IcmBadge, ChipStackPanel, setup form, and the sidebar bridge — all existing tournament surfaces; payout ladder is new state |
| Autonomy red lines | GREEN | No engagement-pressure, no graded work; ICM is decision-support the user reads |
| Honesty | NOTE | Multi-table ICM is approximate (§10.6) — MUST be flagged `isApproximate`, never shown as exact |

## Required follow-ups

- [ ] **Gate 4 (inline):** extend `surfaces/table-view.md` (tournament overlay → real risk premium / $EV) + the tournament dashboard surface after wiring.
- [ ] **Consumers (separate entries when built):** push/fold Nash/SAGE ranges, ICM-aware all-in/shove verdict (the all-in-feature bridge), bubble/pay-jump $-delta indicators, satellite survival mode, real ROI/ITM tracking.

## Change log

- 2026-06-19 — Created. GREEN. Doctrine (§10) authored first. Foundation = payout model + Malmuth-Harville engine + ICM-backed surfacing.
