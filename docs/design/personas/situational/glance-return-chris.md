# Situational Sub-Persona — Glance-Return Chris

**Type:** Situational (cross-persona)
**Applies to:** [Chris (live player)](../core/chris-live-player.md), [Rounder](../core/rounder.md), [Circuit Grinder](../core/circuit-grinder.md), [Hybrid Semi-Pro](../core/hybrid-semi-pro.md), [Weekend Warrior](../core/weekend-warrior.md), [Ringmaster](../core/ringmaster-home-host.md) — any live player recording a hand while it is being dealt.
**Evidence status:** **UNVERIFIED — authored 2026-07-31 to close Gate 2 finding A1 (RED).** No owner observation yet. Every claim below is inferential and marked as such. Do not treat the numbers as measured.
**Last reviewed:** 2026-07-31
**Authored by:** TVR Gate 3 (`WS-312` R1), triggered by [blind-spot roundtable 2026-07-31](../../audits/2026-07-31-blindspot-table-view-redesign.md) Stage A1.

---

## Why this persona exists

The Table View Redesign proposes a layout that **changes shape while the hand is in progress** (direction D-2: the felt narrows as players fold). Gate 2 found that the existing cast could not evaluate it, because **no persona models the cost of re-finding your place on a surface that moved while you weren't looking.**

- [`mid-hand-chris`](./mid-hand-chris.md) assumes *continuous* attention to the screen.
- [`stepped-away-from-hand`](./stepped-away-from-hand.md) and [`returning-after-break`](./returning-after-break.md) model **state** recovery — *what happened while I was gone* — over minutes, with the hand or session interrupted.

Neither models **spatial** recovery over 2–15 seconds with the hand still live. That gap is not an edge case for D-2 — **it is D-2's normal operating condition**, because a live player's eyes are mostly on the felt, the dealer and the villains, not on the phone. Any automatic reflow will therefore usually happen while nobody is watching it happen.

This persona is the one D-2 must be designed *for*. Its surface contract (below) is what Gate 4 designs against.

---

## Snapshot

> "I looked up to watch the guy in seat 6 muck, looked back down, and now I have to work out which button is which again. That's the whole time I had."

**The situation:** Chris is mid-orbit, recording actions. He looks away from the phone to observe the physical table — a villain's action, a chip count, the dealer's next card, a tell he's actively watching for. He looks back and resumes entry.

**Duration away:** ~2–15 seconds *(inferred — see Open questions Q1)*.
**Frequency:** many times per hand. Plausibly the single most repeated interaction loop in the entire product *(inferred)*.
**What is NOT lost:** the hand, the session, the context. He knows what happened — he just watched it happen.
**What IS at risk:** his place on the screen.

---

## Why this is a distinct situation

Looking away from the phone is not a lapse in this workflow — **it is the job.** The whole purpose of the app is to record what happens at a physical table, which can only be observed by looking at the physical table. A design that assumes screen attention is assuming away the product's premise.

That inverts the usual framing. The look-away is not an interruption to be recovered from; it is the primary activity, and the screen is what gets glanced at. The surface must therefore be **resumable at a glance**, not merely legible when studied.

---

## Situation triggers

### Watching a villain act
Chris looks up to see the actual action — did seat 6 hesitate before calling? Returns to record it. **This is the highest-value moment in the product** (it is where reads come from), and it is exactly when the screen is unattended.

### Tracking chips and bet sizing
Looks at the pot / a villain's stack to get a number right, returns to enter it.

### Board cards being dealt
Looks at the flop/turn/river as it lands, returns to enter cards.

### Dealer or table interaction
Posting a blind, a chop, a floor call, ordinary conversation. Attention leaves entirely.

**Detection note:** the app cannot detect this. There is no signal distinguishing "user is looking at the table" from "user is idle." **Any design that needs to know whether the user is watching cannot be built.** This is the constraint that forces D-2's transitions to be predictable-by-rule rather than adaptive.

---

## Context (deltas from core personas)

| Dimension | Delta |
|---|---|
| Attention | Intermittent by design, not by distraction |
| Time budget on return | Sub-second to re-orient, then act *(inferred)* |
| Cognitive state | Full context retained; **spatial memory of the screen is stale** |
| Physical | One-handed, phone at table level, eyes elsewhere |
| Error tolerance | Low — a mis-tap on return corrupts the read he just went to get |

---

## Primary need

**Return to a screen that is where he left it.** Same controls, same places, same sizes — or, if something had to change, a change he can absorb without reading.

## Secondary needs

- The next action to take is obvious without re-deriving it.
- If the layout *did* change, the change is attributable to something he witnessed (a card came out), never to something invisible.
- Any change happened *once*, at a predictable moment — not continuously.

---

## Frustrations (JTBD killers for this situation)

- **Controls that moved.** The thumb goes where the button was. If the button moved, the tap lands on whatever took its place — and in this surface the neighbours are destructive (Reset Street, Reset Hand).
- **Controls that resized.** Even in place, a control that shrank or grew forces a re-read.
- **Mid-action reflow.** A layout change *during* the look-away is undetectable and unattributable — it is the worst case, because he cannot even tell that something changed.
- **Animated transitions.** An animation that plays while he is not watching has, from his point of view, simply teleported. An animation that plays *as* he looks back is worse: he must wait for it to finish before he can trust what he sees.
- **State that requires reading to recover.** Any recovery cost paid in reading is a cost paid in table time.

---

## Non-goals

- Does not need a "what changed while you were away" summary — he watched it happen. That is [`stepped-away-from-hand`](./stepped-away-from-hand.md)'s need, not his.
- Does not need undo *for this situation specifically* (though `JTBD-HE-12` remains his safety net when re-orientation fails).
- Does not need the app to detect the look-away.

---

## Constraints

- **The app cannot know when he is looking.** Every mitigation must be rule-based and predictable, never adaptive.
- **The look-away cannot be designed out.** It is the product's premise.
- **Re-orientation competes with the read.** Time spent re-finding a button is time not spent watching the player — the app's own purpose is what gets sacrificed.

---

## Related JTBD

- [`JTBD-HE-11`](../../jtbd/domains/hand-entry.md) — one-tap seat action entry. Its "so I don't fall behind" clause is *this persona's* clause.
- [`JTBD-HE-23`](../../jtbd/domains/hand-entry.md) — record a full orbit without falling behind the dealer *(authored alongside this persona)*.
- [`JTBD-HE-22`](../../jtbd/domains/hand-entry.md) — accept or override a proposed action *(authored alongside)*. A pre-armed default is **more** dangerous for this persona than for a watching one: on return, the pre-arm may reflect a state he has not yet re-read.
- [`JTBD-HE-12`](../../jtbd/domains/hand-entry.md) — undo a miskey. The failure path when re-orientation goes wrong.

---

## Surface contract — what a surface MUST offer

1. **Positional stability within a street.** Controls do not move or resize between the start and end of a betting round.
2. **Change only at witnessed moments.** If layout must change, it changes when the board changes — an event he saw at the physical table, so the screen matches his own model of the hand.
3. **Settled on return.** Never animate into a new arrangement. If a transition happened while unattended, present the finished state.
4. **Anchored primary action.** The most-used control keeps a fixed screen position across every state.
5. **Recoverable by shape, not by reading.** Position, size and colour carry the identity; a control that can only be identified by its label has already cost too much.

## Surface contract — what a surface MUST NOT do

1. **Must not reflow mid-street.** This is the binding constraint on TVR direction D-2, and the reason Gate 2 amended it to street-boundary transitions (C1-A).
2. **Must not animate a layout change.** (C1-B.)
3. **Must not place destructive controls adjacent to frequently-tapped ones** — the F10 finding, but sharper here: the returning thumb is less accurate than the watching one.
4. **Must not shrink a control because it is statistically less likely.** The rare action is the one he looked up to observe. (Gate 2 C2-A.)
5. **Must not require reading to resume.**

---

## Related situational sub-personas

- [`mid-hand-chris`](./mid-hand-chris.md) — the same moment, assuming continuous attention. This persona is the honest version.
- [`stepped-away-from-hand`](./stepped-away-from-hand.md) — minutes away, hand over, state recovery.
- [`returning-after-break`](./returning-after-break.md) — session-scale.
- [`ringmaster-in-hand`](./ringmaster-in-hand.md) — looks away *more* (he is dealing). **Still PROTO** — see `WS-312` R5.

---

## Open questions (block full verification)

1. **How long is the look-away, really?** The 2–15s range is inferred from the physical task, not measured. If it is routinely longer, this persona converges with `stepped-away-from-hand` and needs state recovery too.
2. **How many look-aways per orbit?** Determines whether re-orientation cost is a minor tax or the dominant cost of hand entry. **This single number decides how much of the redesign budget D-2 deserves.**
3. **Is re-orientation actually experienced as a cost today?** The current layout is static, so this persona may currently have *no* pain — meaning D-2 would introduce a problem rather than solve one. If so, the amended (street-boundary) form is not merely safer, it is the only defensible form.
4. **Does he look at the screen while tapping, or tap by feel?** If by feel, positional stability is not a preference but a hard requirement, and D-2's amendment is load-bearing rather than protective.

**All four are answerable by watching the founder record two orbits.** Until then this persona is a design hypothesis, and Gate 4 should treat its contract as a constraint to satisfy rather than a finding to build on.

---

## Change log

- 2026-07-31 — Created by TVR Gate 3 (`WS-312` R1) to close Gate 2 finding A1. UNVERIFIED.
