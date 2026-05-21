# Gate 1 Entry — 2026-05-09 — Credible Intervals Expansive Surface Scope

**Feature working name:** Credible-interval bands on PlayerAnalysisPanel + HandReplay villain-tendency surfaces (`WS-135`, sprint `SPR-063`)
**Proposed by:** Workstream-driven (v2 staged-scope close-out from SPR-017 / WS-116 / FIND-001)
**Gate:** 1 (Entry) — mandatory
**Next gate:** none (rendering convention settled SPR-017; no new surface)
**Status:** GREEN — implementation of authored UX convention; v1→v2 staged-scope close-out

---

## Feature summary

SPR-017 (WS-116, FIND-001 close) shipped credible-interval bands as the ±X.X% suffix on `TendencyStats.jsx` inline rows + a SeatGrid fallback. Owner explicitly staged the expansive surface scope into a v2 follow-up ticket (WS-135, staged_at 2026-05-02). This sprint closes the staged scope by adding tendency-stats sections to two analysis surfaces that consume `playerTendency` but don't render the bands today:

- **PlayerAnalysisPanel** (AnalysisView) — feeds tendency stats to the game-tree advisor but doesn't render them visibly
- **HandReplay/ReviewPanel** — renders ranges/equity/segmentation but no aggregate tendency stats

Founder ratified placement (Q1a–Q1c at sprint start):
- PlayerAnalysisPanel: collapsed-by-default disclosure below VillainModelCard
- HandReplay: open card peer to VillainAnalysisSection (between sections E and G in ReviewPanel)
- Reuse: extract `TendencyStatsCard` wrapper (bare `TendencyStats` unchanged for PlayerRow + SeatGrid)

---

## Prior-art note (no scope-shifting discovery)

1. **Convention settled SPR-017.** ±X.X% suffix at `n ≤ 200`, hidden at `n > 200`, AF unchanged (no band). `formatBandSuffix(interval, sampleSize, showThreshold = 200)` is internal to `TendencyStats.jsx`.
2. **Substrate clean.** `playerTendency` available via `useSeatTendency` (PlayerAnalysisPanel:39). `tendencyMap` available at ReviewPanel level via `useTendency` (ReviewPanel:38, line 65 already reads `tendencyMap?.[playerId]?.style`).
3. **Math layer untouched.** `tendencyCalculations` produces both point estimates + intervals; this is rendering work only.
4. **Bare TendencyStats reuses cleanly.** Bare-rows component (~106 LoC) takes a `stats` prop with `{ vpip, pfr, af, threeBet, cbet, sampleSize, style, intervals }`. Returns null below MIN_DISPLAY_SAMPLE (10).
5. **Test gap noted.** No dedicated `TendencyStats.test.jsx` exists despite SPR-017 modifying it. Sprint backfills.

---

## Output 1 — Scope classification

**Primary classification:** **Implementation of authored UX convention.** v1→v2 staged-scope close-out. No new surface; no new persona; no new copy patterns.

**Secondary considerations:**

- **Net-new affordance class on existing surfaces.** Two new tendency-stats sections (one collapsed-disclosure, one open card). Card wrapper component is new (~50 LoC) but reuses existing TendencyStats body.
- **No live-surface impact.** Both host surfaces are study-mode (AnalysisView + HandReplayView).
- **No IDB / migration / schema changes.**
- **Reuses existing dark-card panel chrome** from host surfaces (`bg-gray-800` / `border border-gray-700` / `rounded-lg p-3`).

---

## Output 2 — Personas

### In scope (existing personas, unchanged)

| Persona | Role |
|---|---|
| Post-Session Chris | Primary; reviews AnalysisView post-session |
| Scholar Drills Only | Primary in HandReplay study context |

### Out of scope

- Mid-Hand Chris — study surfaces, not live
- Presession-Preparer — neither AnalysisView nor HandReplay are presession entry points

---

## Output 3 — JTBD

| JTBD | Coverage |
|---|---|
| `JTBD-AS-12` Read villain stats with confidence bounds | Primary — sections render the bands |
| `JTBD-DS-58` Validate-confidence-matches-experience | Secondary — sample-size footer caption surfaces n |

No new JTBD authored.

---

## Output 4 — Gap analysis

| Question | Result | Notes |
|---|---|---|
| New surface class? | **No** | New section on existing surface; new card component reuses existing chrome |
| New copy patterns requiring AP-06 audit? | **No** | Footer caption "Based on N hands" is purely descriptive; AP-06 forbidden patterns absent by construction |
| New IDB / migration / schema? | **No** | Read-only over existing tendency state |
| New red-line risk? | **No** | Study-mode-only; no engagement-pressure surface; no live-surface impact |
| Gate 2 Blind-Spot needed? | **No** | No autonomy-surface; rendering convention settled SPR-017 |
| Gate 4 surface artifact needed? | **No** | This is integration of an existing convention into 2 host surfaces; no new surface artifact required |
| AP-04 risk? | **Mitigated** | TendencyStatsCard MUST NOT render scalar score/grade/rank; DOM-asserted in tests |

**Verdict: 🟢 GREEN.** v1→v2 staged-scope close-out with substrate-clean upstream. Proceed.

---

## Gate 2 disposition

**N/A.** No autonomy surface. No engagement-pressure axis. No new copy patterns requiring blind-spot review. Convention was settled SPR-017 via FIND-001 / WS-116; this sprint integrates that convention into 2 host surfaces.

---

## Gate 4 disposition

**Existing convention only.** No new surface artifact. The TendencyStats ±X.X% convention is owner-ratified via SPR-017 ship + WS-135 staging note. No `surfaces/*.md` file authored or amended for this sprint.

---

## Acceptance criteria (carried into implementation)

1. New `TendencyStatsCard` component renders title + bare TendencyStats body + sample-size footer caption.
2. PlayerAnalysisPanel insertion point: below VillainModelCard, collapsed-by-default with disclosure button (≥44×44 tap target).
3. HandReplay/ReviewPanel insertion point: open card peer to VillainAnalysisSection (between sections E and G).
4. ±X.X% bands appear at `n ≤ 200`, hidden at `n > 200` (heuristic from SPR-017 preserved automatically).
5. AF has no band (SPR-017 convention).
6. AP-04 absent: no element matches `/score|grade|rank|overall/i` in rendered text.
7. TendencyStats backfill test file covers the SPR-017 ±X.X% rendering convention.
8. Zero regressions vs SPR-062 baseline.

---

## Linked artifacts

- SPR-017 / WS-116 — minimal v1 ship (TendencyStats inline bands + SeatGrid fallback)
- WS-135 staged_by note (2026-05-02) — explicit v2 deferral
- `src/components/ui/TendencyStats.jsx` — bare-rows component (unchanged)
- `src/components/views/AnalysisView/PlayerAnalysisPanel.jsx` — host surface 1
- `src/components/views/HandReplayView/ReviewPanel.jsx` — host surface 2
- `docs/projects/range-engine/CREDIBLE_INTERVALS.md` — math-layer reference (if exists)

---

## Change log

- 2026-05-09 — v1.0 authored as Gate 1 Entry artifact for SPR-063 / WS-135. GREEN verdict. v1→v2 staged-scope close-out. No Gate 2 needed. No Gate 4 surface artifact needed. Founder ratified Q1a/Q1b/Q1c placement decisions at sprint start.
