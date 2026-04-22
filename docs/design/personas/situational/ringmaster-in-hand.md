# Situational Persona — Ringmaster In Hand

**Type:** Situational (derived from [Ringmaster / Home-Game Host](../core/ringmaster-home-host.md))
**Evidence status:** PROTO — no Chris observation yet; inferred from core persona + audit blind-spot
**Last reviewed:** 2026-04-21
**Owner review:** Pending
**Surfaced:** [Blind-spot audit 2026-04-21 table-view §A1](../../audits/2026-04-21-blindspot-table-view.md)

---

## Snapshot

The Ringmaster is in the middle of a hand he is both **dealing** and **playing** (or refereeing from the rail). He must simultaneously:
- Manage the action clock for other players.
- Answer a rules question from a guest.
- Track his own hand state if seated.
- Update the tracker so the session record is accurate.

This is a categorically different cognitive load profile from [Mid-Hand Chris](./mid-hand-chris.md) (who only plays his own hand) or [Between-hands Chris](./between-hands-chris.md) (who operates in the gap between hands, not during them).

---

## Situation trigger

- Home game is in flight, hand is being dealt OR action is in progress.
- Host is the dealer OR is refereeing while seated.
- Exits when: hand ends AND no rebuy / rules question is pending.

## Context (deltas from core persona)

- **Time pressure:** Higher than any other persona. The Ringmaster's app interactions must not stall the game for 8 other players.
- **Attention:** Split 4 ways — deal mechanics, social management, own hand, app. App gets 5-10% at most.
- **Hand availability:** Often none — hands hold cards or chips. Voice or gaze cues only.
- **Cognitive load:** Maximum. Context-switching between rule explanation, pot arithmetic, and own decision.
- **Social accountability:** Every app interaction is visible to the other players. Fumbling the tracker slows the game and costs social capital.

## Goals

- **Record action correctly on the fly** without lagging the deal.
- **Resolve a pot-correction ambiguity** without abandoning the hand to type or navigate.
- **Log a rebuy / add-on mid-hand** when a player hands over chips, without context-switching surfaces.
- **Know whether the app has captured the last action** before calling the next street.

## Frustrations (JTBD-killers for this situation)

- Modal interrupts that freeze the UI while the deal is in progress. Any `window.confirm` is lethal here. See [blind-spot audit finding C1/E1](../../audits/2026-04-21-blindspot-table-view.md).
- Recent-player lists that require scroll to find a regular who's sitting at the table tonight.
- Rebuy entry that forces a navigation away from TableView.
- Pot-correction UI that demands keyboard entry in a context where chips are physically in the hand.

## Non-goals

- Deep review. That happens after the session ends ([post-session-chris](./post-session-chris.md) analog; a dedicated `home-game-settle` persona exists).
- Strategy coaching for other guests mid-hand. The core persona cares about settlement + group fun, not teaching.

---

## Constraints

- **Time budget per interaction:** ≤2 seconds. Any longer and the next action is delayed.
- **Error tolerance:** Moderate. The Ringmaster is forgiven for fumbling because everyone knows he's dealing; but repeated fumbles erode the social value of running the game.
- **Visibility tolerance:** Low. Large on-screen modals that light up the phone draw attention from 8 guests.
- **Recovery expectation:** The app must recover silently from skipped actions. Batch-correction post-hand is acceptable; mid-hand recovery must be non-blocking.

---

## Related JTBD

- `JTBD-HE-11` one-tap seat action entry (acute — every delay is amplified)
- `JTBD-HE-12` undo / repair (acute — corrections must be one-tap and silent)
- `JTBD-MH-11` validate pot size before acting (acute — Ringmaster reconstructs pots across rebuys/add-ons)
- `JTBD-SM-18` log add-ons / rebuys (must work mid-hand)
- `JTBD-PM-01`/`PM-02`/`PM-04` player management (must work between deals without stalling the next deal)

## Related core persona

- [Ringmaster / Home-Game Host](../core/ringmaster-home-host.md) — primary

## Related situational sub-personas (outside this one)

- [home-game-settle](./home-game-settle.md) — the AFTER state (post-session).
- This file is the IN-FLIGHT state that was missing.

---

## What a surface must offer this persona

1. **Non-modal everything.** No `window.confirm`, no overlay that requires dismissal.
2. **Pot correction ≤1 tap + voice-friendly.** Or an undo-first pattern that assumes recent action may have been miskeyed.
3. **Rebuy / add-on entry available without leaving TableView.** Inline panel or toast action.
4. **Recent-players list that surfaces tonight's sit-ins first** — prioritize by `assignedToSeat` over pure recency.
5. **Silent auto-advance.** When action completes a street, advance the street without requiring a tap from the host.

## What a surface must NOT do

- Pop a modal anywhere on the primary path.
- Require keyboard entry for routine pot/action adjustments.
- Navigate away from TableView for rebuy / add-on flows.
- Surface advice text that assumes the host's attention is on the screen (it's not — it's on the dealer button).

---

## Proto-persona caveat

- **[A1]** The Ringmaster persona has zero owner-verified observations. All claims here are inferred from core persona + framework logic. **Verify** by interviewing an actual home-game host OR by Chris stepping into a host role.
- **[A2]** "5-10% attention budget" is illustrative, not measured. Verify by timing observation in a real home game.
- **[A3]** The split between this persona and [home-game-settle](./home-game-settle.md) is hypothesized. A host interview may reveal a third state (e.g., "dealing-heads-up-for-ten-hands-in-a-row") that warrants its own persona.

---

## Change log

- 2026-04-21 — Created. Closes Stage A gap from `audits/2026-04-21-blindspot-table-view.md`.
