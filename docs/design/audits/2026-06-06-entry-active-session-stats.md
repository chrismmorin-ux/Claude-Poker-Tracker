# Gate 1 — Entry — 2026-06-06 — Sessions View Improvement (Phase 4: active-session live stats)

**Date:** 2026-06-06
**Project:** Sessions View Improvement (4-phase) — final phase
**Author:** Claude (main)
**Format:** Per `docs/design/LIFECYCLE.md` Gate 1 (Entry).
**Verdict:** 🟢 **GREEN** — proceed; small, contained enhancement to one card.

---

## Feature summary

Adds a **live elapsed-time ticker** to the active-session card ("Playing for
2h 14m", updating every 30s) in place of the old static "Started Xm ago" line,
and stacks the card's stat grid to a single column on narrow phones
(`grid-cols-1 sm:grid-cols-3`) so the buy-in/rebuy entry fields stay full-size.

**Scope note — "running result" intentionally omitted.** The plan floated a live
running P&L, but the app does not track the hero's current chip count during a
cash session (only hand records), so a running result would be fabricated/
misleading. We surface what is true and useful: time elapsed and money in play
(Session Total = buy-in + rebuys, already shown). If a live-stack input is added
later, a true running result becomes a follow-up.

The bulk of Phase 4's "visual polish" was already delivered by the portrait-
native responsive pass (2026-06-06), so this phase is scoped to the concrete
active-session improvement.

## Scope classification

- **New surface?** No — enhancement to the existing `ActiveSessionCard`.
- **New interaction modality?** No — a passive live timer; `setInterval(30s)`.
- **New persistent state class?** No.
- **Cross-product impact?** None.

## Personas served

- **mid-hand-chris / between-hands-chris** — wants to know at a glance how long
  they've been playing (session-length discipline) without doing the math.

## JTBD served

- "While I'm in a session, tell me how long I've been playing, live."

## Gap analysis

| Dimension | Finding |
|---|---|
| Existing surface covers this? | 🟡 Only a coarse static "Started Xm ago"; not live, not precise. |
| Persona coverage | 🟢 Existing personas; no new persona. |
| Interaction novelty | 🟢 Passive ticker; standard pattern. |
| Data model | 🟢 None. |
| Cognitive-load risk | 🟢 One quiet line; minute precision. |

**Net:** GREEN.

## Verdict

🟢 **GREEN → proceed.** `sessions-view` surface updated. Verified via Playwright
(portrait): live "Playing for 0m" renders; stat grid stacks single-column.
