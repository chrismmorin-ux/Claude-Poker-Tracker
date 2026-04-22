# Discovery — DecisionTreeView Fate (Revive or Retire)

**ID:** `DISC-2026-04-21-decision-tree-fate`
**State:** CAPTURED
**Surfaced during:** [blind-spot audit 2026-04-21 table-view §D5](../audits/2026-04-21-blindspot-table-view.md)
**Date surfaced:** 2026-04-21
**Last updated:** 2026-04-21

---

## The gap

`src/components/views/DecisionTreeView.jsx` (F-W5 in INVENTORY) is an orphaned component — code exists but is not routed. Its purpose is to surface depth-2/3 game-tree branching as a drill-in from a live recommendation. This JTBD (`MH-10` plain-English "why") is currently partially served by `LiveAdviceBar`'s reasoning text, but the *deeper* drill-in (tree visualization) is unreachable. This is a product decision, not a defect fix: either revive the component into a routed surface, or retire it and document the fuller MH-10 as handled by LiveAdviceBar.

## Evidence

- `features/INVENTORY.md` F-W5 entry
- [blind-spot audit 2026-04-21 table-view D5](../audits/2026-04-21-blindspot-table-view.md)
- [EVID-2026-04-21-ENGINE-FEATURE-INVENTORY](../evidence/LEDGER.md) — flags orphan

---

## Personas affected

| Persona | Role | JTBD unblocked |
|---------|------|----------------|
| [Apprentice](../personas/core/apprentice-student.md) | primary (wants the "why" deeper) | MH-10 |
| [Newcomer-first-hand](../personas/situational/newcomer-first-hand.md) | secondary (wants plain-English gloss; may not need tree visual yet) | MH-10 |
| [Post-session Chris](../personas/situational/post-session-chris.md) | primary (post-hand deep dive) | MH-10, SR-23 |
| [Coach](../personas/core/coach.md) | primary if coaching uses trees | CO-49 |
| [Rounder](../personas/core/rounder.md), [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) | secondary | MH-10 |

## JTBD(s) enabled

- `JTBD-MH-10` plain-English "why" for a recommendation (deep variant)
- (deferred) `JTBD-CO-49` annotate streets (if coaching workflow adopts tree view)

---

## Proposed tier

**Tier:** Pro (if revived) / n/a (if retired)
**Rationale:** Game-tree visualization is a Pro differentiator elsewhere in the market (GTO Wizard, Piosolver). Plus-tier users get text "why"; Pro users can drill.
**Alternatives considered:** Fold tree visualization into HandReplayView's ReviewPanel (no new surface).

## Product line

- Main app only (sidebar has its own Z4 Deep Analysis surface)

## Related surfaces

- If revived: new surface `docs/design/surfaces/decision-tree-view.md` (does not exist today)
- If retired: `LiveAdviceBar` remains the sole MH-10 surface; surface artifacts updated to reflect scope
- Possible alternative: fold into `hand-replay-view` / `analysis-view/HandReview` as an embedded panel

---

## Priority score (conditional on decision)

- `personas_covered`: 5 (if revived for Apprentice + Coach + Rounder + Hybrid + Post-session Chris)
- `jtbd_criticality`: 2–3 (MH-10 is already partially served; this is the deep variant)
- `tier_fit_factor`: 1.0 (Pro)
- **Raw priority (if revive):** 5 × 2.5 × 1.0 = **12.5**
- **Raw priority (if retire):** 0 × 0 × 0 = **0** (just documentation)

## Effort estimate

- **If revive — Tier: L** — the component exists but is not integrated; routing, deep-link from LiveAdviceBar, surface artifact, tests, visual verification. ~2-3 sessions.
- **If retire — Tier: S** — delete component, update INVENTORY, update surface artifacts that mention F-W5. ~0.25 session.

## WSJF

- Revive: 12.5 / 2.5 = 5
- Retire: 0 / 0.1 = 0 (low priority)

---

## Decision framing

Three outcomes, owner chooses:

**A. Revive as routed surface.** Author surface artifact, route via `SCREEN.DECISION_TREE`, wire from LiveAdviceBar long-press or dedicated "Why?" button. Cost: ~2-3 sessions. Win: Pro differentiation, closes MH-10 deep variant.

**B. Fold into HandReplayView/AnalysisView.** Keep the component, render inline within review surfaces rather than as its own route. Cost: ~1-2 sessions. Win: MH-10 deep variant exists for post-hand review; doesn't add live-table drill.

**C. Retire.** Delete the component, explicitly scope MH-10 to LiveAdviceBar's text reasoning. Cost: ~0.25 session. Win: inventory clean; no new route to support.

## Risks / open questions

- Orphaned code ages badly — every day of delay makes revival more expensive as surrounding code evolves.
- Is the live-table drill actually a use case? Mid-hand-chris won't drill mid-hand. Between-hands-chris might. This is a revival use-case question.
- If revived, is this a `main`-only or `both`-product feature? Sidebar Z4 partially covers it already.

---

## Status log

- 2026-04-21 — SURFACED during blind-spot-audit 2026-04-21 table-view.
- 2026-04-21 — CAPTURED. Awaiting owner decision between A/B/C.

## Change log

- 2026-04-21 — Created.
