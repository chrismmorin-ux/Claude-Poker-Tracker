# Situational Persona — Between-Hands Driller

**Type:** Situational (derived from [Chris, Live Player](../core/chris-live-player.md), drilling intent; shares the study goals of [Scholar](../core/scholar-drills-only.md) / [Apprentice](../core/apprentice-student.md))
**Evidence status:** Proto — unverified
**Last reviewed:** 2026-06-15
**Owner review:** Ratified the gap (WS-230 Gate 3, 2026-06-15); persona authored, surface work not yet committed.

---

## Snapshot

A hand just ended; the next won't reach this seat for a couple of minutes (folded early, or watching a multiway pot play out). Instead of logging the last hand, this user wants to **steal one quick rep** — pull up a drill, get a spot, answer, see the reveal — then drop the phone when action returns. They are studying *at the table*, in the dead time, one-handed, under the rail.

This is a different INTENT from [Between-Hands Chris](./between-hands-chris.md) (who is logging/tagging the hand just played) occupying the *same* time window. A surface that serves one does not automatically serve the other.

---

## Situation trigger

- Hero is out of the current hand (folded early / not dealt in) with ≥~2 minutes of dead time, OR waiting between orbits.
- Exits when: action returns to the seat (cards dealt / decision required) — abruptly and unpredictably.

## Context (deltas from core persona)

- **Time pressure:** Hard and unpredictable. ~30 seconds of usable attention before action may return; the exit is not under the user's control.
- **Attention:** Shared with table-watching. The drill competes with "don't miss my action."
- **Hand availability:** One hand (the other holds cards / chips / phone). One-handed, thumb-reach operation.
- **Cognitive load:** Low-to-moderate; this is a warm-up rep, not a study session.

## Goals

- **One rep, fast:** cold entry → spot → answer → reveal in **≤30 seconds**, with zero configuration.
- **Resume-safe exit:** abandon mid-drill the instant action returns, losing nothing and needing no cleanup.
- **Low-commitment:** no sense of "I started a session I now have to finish."

## Frustrations

- Every current drill tab needs reading the tab + making a selection/config before a question appears — none reach answer-in-30s from cold entry (WS-229 C-4).
- Multi-step flows (pick a line, pick two hands) that can't complete in the window.
- Losing the rep — and any progress — when action returns mid-drill (the tab-switch / interruption loss; mitigated app-side by the WS-231 tab-switch guard, but cold interruption by table action is the real exit here).
- Two-handed or sustained-attention mechanics (long card-flip reads) that don't fit one-handed dead-time use.

## Non-goals

- Deep study / line walkthroughs / range painting. That's [Study Block](./study-block.md) / off-table.
- Logging the hand just played. That's [Between-Hands Chris](./between-hands-chris.md).
- Progress tracking / streaks. Out of scope and against the autonomy doctrine.

---

## Constraints

- **Time budget per interaction:** ~30 seconds cold-entry-to-reveal; abandonable at any instant.
- **Error tolerance:** Low — but the dominant failure is *interruption*, not misclick.
- **Device:** One-handed, thumb-reach, possibly dim venue lighting (H-PLT03).
- **Recovery expectation:** Interrupting a drill is normal, not exceptional — it must cost nothing.

---

## Related JTBD

- `drills-and-study/DS-43` (10-minute quick drill — the fast-entry end of it)
- `drills-and-study/DS-62` (pre-session/recency-weighted selection — a one-rep cut could reuse it)

---

## What a surface must offer

1. **A one-tap "quick rep" entry** that lands directly on a spot — no tab-reading, no config picker.
2. **Answer-then-reveal in a single screen** within the attention budget.
3. **Cost-free abandonment:** leaving mid-drill (app backgrounded, navigated away) loses nothing and requires no confirmation in *this* situation (the user is reacting to table action, not deliberating).

## What a surface must NOT do

- Require selecting a mode / line / hand before showing a spot.
- Treat an interrupted rep as a failure, a streak break, or anything to recover from.
- Assume two-handed or sustained focused attention.

---

## Status note

This persona is **not currently served** by either drill view — every tab requires configuration before a spot appears, and none completes in the dead-time window (WS-229 Stage A-3 / C-4). Authored here for coverage honesty; a fast-entry "quick rep" surface is future work, not committed. The WS-230 decision was to **keep the by-street tab split and invest in leak-targeted navigation** — a one-tap quick-rep entry is a candidate home for this persona if/when that nav work is scoped.

---

## Change log

- 2026-06-15 — Created. Output of WS-230 Gate 3 (WS-229 drills roundtable, Stage A-2 / A-3 / C-4). Distinct intent from Between-Hands Chris in the same time window.
