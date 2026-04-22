# Situational Persona — Between-Hands Chris

**Type:** Situational (derived from [Chris, Live Player](../core/chris-live-player.md))
**Evidence status:** Proto
**Last reviewed:** 2026-04-21
**Owner review:** Pending

---

## Snapshot

A hand just ended. The next hand will start in 30–90 seconds. Chris is doing cleanup: finalizing what just happened, adjusting a villain read, adding a note, and — occasionally — swapping a player on the seat next to him who just busted. He has more time and attention than mid-hand, but the clock is still running.

---

## Situation trigger

- Hand concludes (showdown shown, or hero folded earlier and is watching).
- Exits when: cards are dealt for the next hand.

## Context (deltas from core persona)

- **Time pressure:** 30–90 seconds. Dealer takes ~20s to scoop + shuffle + deal. Variable shoe / stub handling can extend this.
- **Attention:** Shared with shuffle-watching, small talk, rack-counting. App can ask for up to 5–10 seconds of focused attention.
- **Hand availability:** Both hands potentially available. Phone can sit on the rail.
- **Cognitive load:** Moderate. Processing the just-played hand, queuing up notes.

## Goals

- **Log villain actions and sizes** for the hand that just ended, if not auto-captured.
- **Tag a villain read** — "overbet bluff 2× this session," "station," "passed on river bluff spot."
- **Swap a player** when a seat changes hands.
- **Glance stats** — quick look at an opponent profile without committing to review.
- **Queue a question for post-session** — "check this hand later" kind of tagging.

## Frustrations

- Data entry that requires precision while the dealer is preparing to deal.
- Re-entering information the app could have captured automatically.
- Losing partial progress if a modal collapses mid-entry.
- Destructive actions still within reach — misclicks are cheaper here than mid-hand but still cost a reset.

## Non-goals

- Deep analysis. Saved for post-session.
- Setup tasks. Already done at session start.

---

## Constraints

- **Time budget per interaction:** 5–30 seconds for logging / tagging; up to 60s for a player swap.
- **Error tolerance:** Low. Misclicks force re-entry that may run into the next hand.
- **Visibility tolerance:** Secondary actions acceptable at one tap. Tertiary at two.
- **Recovery expectation:** Undo for any retro-link or destructive seat change.

---

## Related JTBD

- `player-management/swap-player`
- `player-management/remove-player`
- `hand-entry/tag-villain-read` (placeholder — future domain)
- `session-review/flag-for-later` (placeholder)

---

## What a surface must offer

1. **Fast player swap path.** The most common between-hands cross-surface action is "Player X left, Player Y sat down in seat 4."
2. **Autosave of partial input.** If I start typing and the dealer deals, my input must survive.
3. **Two-tap access to villain profile** from the seat.
4. **Undo within ≥8s window** for any retro-link or reassignment.

## What a surface must NOT do

- Require modal commitment before the next hand deals.
- Force a context switch that discards input on the previous surface.
- Bury swap/clear behind a primary-action hierarchy designed for mid-hand.

---

## Change log

- 2026-04-21 — Created Session 1.
