# Situational Persona — Circuit Grinder Between Hands (Tournament In Progress)

**Type:** Situational (derived from [Circuit Grinder](../core/circuit-grinder.md))
**Evidence status:** Proto
**Last reviewed:** 2026-04-29
**Owner review:** Pending

---

## Snapshot

A live MTT hand just ended. The next hand will start in 25–60 seconds (live tournament dealing is faster than cash). The Circuit Grinder spends that window on tournament-aware tasks the Cash-game Between-Hands persona doesn't have: glance the blind timer to see how many hands remain in the level, eyeball each opponent's stack to spot newly short-stacked shovers, scan the rail for eliminations on other tables (which shifts ICM pressure), and queue a note about a villain's just-played line. Time pressure is similar to between-hands cash, but the *information demand* is denser — every interaction has a tournament-context tax.

Distinguished from [Between-Hands Chris](between-hands-chris.md): cash-game between-hands has no blind timer, no ICM, and no other-table activity. The two personas share the time budget but not the cognitive load profile.

---

## Situation trigger

- Hand concludes (showdown shown, or hero folded earlier and is watching).
- Tournament is in progress (`isTournament === true`, level timer running).
- Exits when: cards are dealt for the next hand.

## Context (deltas from core persona)

- **Time pressure:** 25–60 seconds. Live dealers are fast; multi-deck shoes shorten the window.
- **Attention:** Shared with stack-counting at adjacent seats, blind-timer glance, and rail scanning for cross-table eliminations. The app can ask for ~3–8 seconds of focused attention.
- **Hand availability:** Both hands potentially available. Phone can sit on the rail.
- **Cognitive load:** High (deltas: + blind-level awareness, + ICM pressure shifts as players bust, + multi-day note continuity if Day 1 → Day 2).
- **Stakes of error:** Rises with tournament stage. A misclick early is a recoverable EV leak; a misclick at the bubble is a career hand.

## Goals

- **Glance the blind timer** to see remaining time at this level + when the next ante kicks in or BB-ante rotates.
- **Eyeball stack changes** at adjacent seats — who doubled, who's sub-15bb and now in shove range.
- **Update opponent reads** for the just-played hand — "shoved 14bb UTG with off-suit broadway," "called all-in light at the bubble."
- **Note a cross-table elimination** that affects ICM pressure (e.g., dropping from 19 to 18 players when 18 makes the money).
- **Update own stack** if the just-played hand changed it (or eliminate self if busted).
- **Queue a question for hotel-room review** — "look at this hand later when I'm reviewing the day."

## Frustrations

- Data entry that requires both eyes off the table — live dealers don't wait.
- ICM math that takes >2 seconds to resolve. By then the next hand is dealt.
- Stack-update workflows designed for cash games (one stack at a time) that don't scale to 8-handed tournament tables where 3 stacks just changed.
- Modal interactions that block the blind timer — losing track of the level timer is a different class of error than losing input progress.
- Auto-capture features that stay on the *just-played* table when attention has already shifted to the next hand.

## Non-goals

- Deep analysis. Saved for the hotel-room review later that night.
- Setup or session-config tasks. Already done at session start.
- Coaching others. The Circuit Grinder is solo-focused at the table.

---

## Constraints

- **Time budget per interaction:** 3–15 seconds for glance / note / single-stack update. Up to 30s for a bulk stack reconciliation if multiple seats just changed.
- **Error tolerance:** Very low at bubble + final-table moments; moderate elsewhere.
- **Visibility tolerance:** Maximum density. ICM-aware grinders prefer one screen of dense numbers over three taps of progressive disclosure.
- **Recovery expectation:** Undo for any retro-link, stack edit, or elimination — same SR-program standard as cash-game between-hands, with bubble-aware messaging ("This is the bubble — confirm before committing?").

---

## Related JTBD

- `JTBD-TS-37` stack-depth strategy zone updated live (passive — they want to see it without having to compute)
- `JTBD-TS-38` multi-day note persistence (Day 1 → Day 2 — this is when the note is captured)
- `JTBD-TS-39` rebuy cost tracking for ROI (rebuy decisions surface here at late-reg boundary)
- `JTBD-TS-43` ICM-adjusted decision at bubble — read passively here, acted on mid-hand
- `JTBD-TS-44` pay-jump proximity indicator — same pattern
- `JTBD-TS-45` blind-out threshold reached (NEW; see [tournament-specific JTBD §TS-45](../../jtbd/domains/tournament-specific.md#ts-45--blind-out-threshold-reached))
- `JTBD-TS-46` rebuy decision at late-reg boundary (NEW; see [§TS-46](../../jtbd/domains/tournament-specific.md#ts-46--rebuy-decision-at-late-reg-boundary))
- `player-management/swap-player` — when someone busts and a balance-table seat fills
- `hand-entry/tag-villain-read` (placeholder)

---

## What a surface must offer

1. **Glanceable tournament state.** Level timer, current blinds, players-remaining, hero-stack-in-BB visible at all times — not behind a tap.
2. **Bulk stack-update path.** When 3 stacks shift on one hand, updating them sequentially shouldn't require navigating away from the timer.
3. **One-tap "same as last hand" elimination shortcut** — most eliminations are single-bust, single-payout.
4. **Note-tagging with auto-context.** Capturing "villain shoved 14bb UTG" should infer level + blinds + position + stack from current state, not require manual entry.
5. **Bubble-aware confirmation.** Destructive actions get a stronger confirm during high-ICM moments.
6. **Undo within ≥10s window** for any stack edit, elimination, or retro-link — same SR standard as cash, longer window because the cognitive load is higher.

## What a surface must NOT do

- Render advice that ignores ICM during tournament play (chip-EV-only push/fold verdicts at the bubble are *actively misleading* — see [DISC-2026-04-21-push-fold-widget](../../discoveries/2026-04-21-push-fold-widget.md)).
- Force a context switch that loses the level-timer's visibility.
- Bury players-remaining or blinds-next behind a tap.
- Auto-clear notes between hands. Note input must survive mid-deal.

---

## Cross-references

- Shares time-budget profile with [Between-Hands Chris](between-hands-chris.md), but diverges on cognitive load + stakes-of-error.
- Cross-product counterpart: [Online MTT Shark's between-tables moment](#) — not authored. The online shark multi-tables, so "between hands" on one table is "actively in a hand" on three others; a different cognitive frame entirely.
- Surfaces this persona acts on most often: [TournamentView](../../surfaces/tournament-view.md) (passive monitoring), [TableView](../../surfaces/table-view.md) (action recording).

---

## Change log

- 2026-04-29 — Created as DCOMP-W4-A2-F12 closeout; resolves audit Stage A1 gap.
