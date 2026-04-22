# Discovery — Push/Fold Verdict Widget (≤15bb)

**ID:** `DISC-2026-04-21-push-fold-widget`
**State:** CAPTURED
**Surfaced during:** [blind-spot audit 2026-04-21 table-view §C3](../audits/2026-04-21-blindspot-table-view.md)
**Date surfaced:** 2026-04-21
**Last updated:** 2026-04-21

---

## The gap

When the hero's effective stack is ≤15bb preflop (push/fold territory), TableView's `LiveAdviceBar` shows equity-derived advice (`eq >= 0.55 = VALUE`). At push/fold depth, equity-threshold logic is the wrong model — the decision is shove-or-fold, driven by `opponent fold frequency × ICM × blockers`, not by raw equity. The persona's need (push-fold-short-stack) is a precomputed chart verdict in <1 second; the surface delivers an equity tag that doesn't answer the question.

## Evidence

- [EVID-2026-04-21-TABLE-WINDOW-CONFIRM](../evidence/LEDGER.md) (adjacent to this defect — same surface)
- [push-fold-short-stack situational persona](../personas/situational/push-fold-short-stack.md) — persona states <1s chart verdict requirement
- [blind-spot audit 2026-04-21 table-view C3](../audits/2026-04-21-blindspot-table-view.md) — "fundamental mismatch, not an adjustment issue"

---

## Personas affected

| Persona | Role | JTBD unblocked |
|---------|------|----------------|
| [push-fold-short-stack](../personas/situational/push-fold-short-stack.md) | primary | MH-07 |
| [Circuit Grinder](../personas/core/circuit-grinder.md) | primary (live MTT push/fold) | MH-07, TS-43 |
| [Online MTT Shark](../personas/core/online-mtt-shark.md) | primary (online MTT) | MH-07, TS-43 |
| [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) | secondary | MH-07 |

## JTBD(s) enabled

- `JTBD-MH-07` short-stack push/fold with ICM (already Active — this discovery is the implementation that makes it actually usable)
- `JTBD-TS-43` ICM-adjusted decision at bubble (Active; this widget is one of the primary surfaces to serve it)

---

## Proposed tier

**Tier:** Pro (ICM-adjusted version) / Plus (chip-EV chart version)
**Rationale:** Chart-based push/fold is a standard starter feature (Plus tier). ICM-corrected push/fold is the Pro differentiator.
**Alternatives considered:** Treat as audit fix rather than discovery — rejected because the scope is a new widget + chart data, not an adjustment to LiveAdviceBar.

## Product line

- Main app (primary) + Sidebar (secondary — online MTT short-stack decisions)

## Related surfaces

- Existing: `TableView/LiveAdviceBar` (will be modified to yield to this widget when ≤15bb)
- Existing: `sidebar/Z2 Decision` (cross-product counterpart — see DISC-2026-04-21-sidebar-tournament-parity)
- New (possibly): dedicated `PushFoldPanel.jsx` replacing or augmenting LiveAdviceBar below threshold

---

## Priority score

- `personas_covered`: 4 (out of 15)
- `jtbd_criticality`: 4 (MH-07 at decision time = severe cost of failure)
- `tier_fit_factor`: 1.0 (on-tier, Pro)
- **Raw priority:** 4 × 4 × 1.0 = **16**

## Effort estimate

- **Tier:** M
- **Rough breakdown:** chart data (Kelly/Nash push/fold tables) + ICM adapter (~1 session) / UI component (~1 session) / tests + visual verification (~0.5 session)
- **Dependencies:** `icmPressure` on TournamentContext (shipped); `mRatioGuidance` (shipped). No new infra.

## WSJF

- Effort in weeks: ~0.5–1
- WSJF: 16 / 0.75 = ~21

---

## Sketch of solution

When `effectiveStackBB ≤ 15` and action on hero preflop:
1. Collapse LiveAdviceBar advice text.
2. Render a single-verdict panel: `SHOVE | FOLD` (or `CALL` if facing a shove).
3. Below the verdict: one-line reason referencing the three inputs (fold-equity, ICM-adjusted call threshold, blockers).
4. Long-press verdict → reveals the full Nash / Kelly chart centered on the current stack depth.

Cross-product: mirror in sidebar Z2 when extension reports short-stack state.

## Risks / open questions

- Do we ship chart-based (fast) or game-tree based (slow, accurate)? Chart-based is MVP; game-tree depth-1 would improve accuracy post-MVP.
- ICM payout structure (TS-41 / DISC-04 from gap-list) is currently manual — the widget's ICM correction depends on knowing payout structure. Does push/fold widget ship Plus-tier first (chip-EV only) with Pro-tier ICM upgrade tracked separately?
- Does this widget replace or coexist with `LiveAdviceBar` when threshold is crossed?

---

## Status log

- 2026-04-21 — SURFACED during blind-spot-audit 2026-04-21 table-view.
- 2026-04-21 — CAPTURED in this file.

## Change log

- 2026-04-21 — Created.
