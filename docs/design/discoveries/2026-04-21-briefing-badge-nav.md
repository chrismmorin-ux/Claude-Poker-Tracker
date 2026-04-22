# Discovery — Seat Briefing Badge → Review Queue Navigation

**ID:** `DISC-2026-04-21-briefing-badge-nav`
**State:** CAPTURED
**Surfaced during:** [blind-spot audit 2026-04-21 table-view §D2](../audits/2026-04-21-blindspot-table-view.md)
**Date surfaced:** 2026-04-21
**Last updated:** 2026-04-21

---

## The gap

TableView renders per-seat pending-briefing badges sourced from `tendencyMap[playerId].briefings` (`TableView.jsx:252–278`). The **action** to review/accept/dismiss those briefings lives on a different surface — PlayersView's ExploitReviewQueue. There is no navigation edge from a seat badge to the review queue. A user sees a count on a seat badge mid-session with no path to clear it without leaving the table. The JTBD loop (notify → action → resolve) is broken at the action step.

## Evidence

- [blind-spot audit 2026-04-21 table-view D2](../audits/2026-04-21-blindspot-table-view.md) — cross-surface finding with direct line reference.
- No evidence of user report; inferred via systems-architect agent during the roundtable.

---

## Personas affected

| Persona | Role | JTBD unblocked |
|---------|------|----------------|
| [Chris](../personas/core/chris-live-player.md) | primary | SR-23 (worst-EV spots); implicit notification→action loop |
| [Between-hands Chris](../personas/situational/between-hands-chris.md) | primary | same (the time when clearing briefings is feasible) |
| [Rounder](../personas/core/rounder.md), [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) | secondary | same |

## JTBD(s) enabled

- (implicit, not in atlas) **"resolve a notification in the surface where I saw it, not in another view."** Candidate new `CC-XX` cross-cutting JTBD.

---

## Proposed tier

**Tier:** Free+ (platform navigation hygiene — not a premium feature)
**Rationale:** This is a UX defect that should be fixed regardless of tier.

## Product line

- Main app only (sidebar has its own notification model)

## Related surfaces

- `table-view` — badge source
- `players-view` — ExploitReviewQueue is the action surface
- Cross-surface: this is the kind of loop a JOURNEY doc captures. Author `journeys/briefing-review.md` alongside the fix.

---

## Priority score

- `personas_covered`: 4
- `jtbd_criticality`: 2 (nice-to-have loop; workaround exists — navigate manually)
- `tier_fit_factor`: 1.0
- **Raw priority:** 4 × 2 × 1.0 = **8**

## Effort estimate

- **Tier:** S
- **Rough breakdown:** seat-badge onClick handler + `setCurrentScreen` + queue-filter payload (~0.25 session)
- **Dependencies:** none

## WSJF

- Effort in weeks: ~0.1
- WSJF: 8 / 0.1 = **80**

---

## Sketch of solution

1. Seat badge (`TableView.jsx:252–278`) becomes a button: `onClick` → `setCurrentScreen(SCREEN.PLAYERS)` + sets a filter on PlayersView to prefer the clicked seat's player.
2. Between-hands guardrail: during an active hand, clicking navigates away but preserves hand state (existing pattern — TableView navigation doesn't clear reducer state).
3. Journey doc (`journeys/briefing-review.md`) captures the end-to-end flow for future audit coverage.

## Risks / open questions

- Does Between-hands Chris want to leave TableView mid-session, or does he want an inline review panel? Inline is better UX but larger scope.
- Once players-view is reached, does the filter prefer the clicked seat, or surface the full queue sorted by severity? The former is hand-focused; the latter is triage-focused.

---

## Status log

- 2026-04-21 — SURFACED during blind-spot-audit 2026-04-21 table-view.
- 2026-04-21 — CAPTURED.

## Change log

- 2026-04-21 — Created.
