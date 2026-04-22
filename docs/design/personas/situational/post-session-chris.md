# Situational Persona — Post-Session Chris

**Type:** Situational (derived from [Chris, Live Player](../core/chris-live-player.md))
**Evidence status:** Proto
**Last reviewed:** 2026-04-21
**Owner review:** Pending

---

## Snapshot

The session is over. Chris is home, or in a car, or at a coffee shop. He wants to review what happened — hands he played well, hands he misplayed, villain reads worth remembering, and occasionally a deeper dive into a specific spot. Time and attention are plentiful. Speed matters less; clarity and depth matter more.

---

## Situation trigger

- Session has ended — chips racked, cash out complete, or end-of-online-session event.
- Exits when: the next live session begins.

## Context (deltas from core persona)

- **Time pressure:** Low. 15 minutes to an hour of focused review.
- **Attention:** Full. Can read, annotate, and interact deeply.
- **Device:** Often same phone, landscape or portrait. Tablet more plausible here.
- **Cognitive load:** Low-to-moderate. Reflective mode.

## Goals

- **Review hand-by-hand** the session just played.
- **Compare what the app recommended vs. what he did** and understand discrepancies.
- **Refine villain notes** with post-game clarity.
- **Adjust player records** — fix names, add notes, correct feature tags that were guessed during play.
- **See aggregate stats** — session win rate, biggest pots, exploitable mistakes.

## Frustrations

- Review surfaces that withhold info available during the session (asymmetric staleness).
- Session data that feels incomplete or corrupted because of mid-session entry errors.
- Hand replay that doesn't expose what the app "knew" at decision time vs. in hindsight.

## Non-goals

- Speed. This isn't the mid-hand context.
- One-handed. Two-handed and relaxed.

---

## Constraints

- **Time budget:** Generous. 30s–2min per hand is fine.
- **Error tolerance:** High. Reversible actions are easy to undo; he's paying attention.
- **Visibility tolerance:** Can surface secondary and tertiary info without hiding primary.
- **Recovery expectation:** Standard undo / cancel patterns are sufficient.

---

## Related JTBD

- `session-review/*` (placeholder domain — expand as audits reach these surfaces)
- `player-management/edit-player-record`
- `player-management/merge-duplicate-players` (hypothetical; may exist or not)

---

## What a surface must offer

1. **Density is acceptable** — this persona can absorb it.
2. **Retroactive corrections** to session data with a clear history of what was changed.
3. **Drill-down paths** from summary to detail without losing context.
4. **Export or share** for occasional cross-reference with external tools.

## What a surface must NOT do

- Collapse or rush the review flow to match mid-hand cadence.
- Hide "pro" features behind gestures a mid-hand user might trigger accidentally.

---

## Change log

- 2026-04-21 — Created Session 1.
