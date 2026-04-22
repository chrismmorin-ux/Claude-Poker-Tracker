# Situational Persona — Mid-Hand Chris

**Type:** Situational (derived from [Chris, Live Player](../core/chris-live-player.md))
**Evidence status:** Proto — grounded in sidebar-rebuild observations
**Last reviewed:** 2026-04-21
**Owner review:** Pending

---

## Snapshot

Chris is in a hand. The action has reached him, or will within seconds. He needs to know what the app recommends *right now* without navigating, scrolling, or reading more than a glance. The decision is real money. The dealer is watching for a decision.

---

## Situation trigger

- Cards have been dealt; action is on hero (at any street: preflop, flop, turn, river).
- Or: action is about to be on hero and villain has just acted — hero is pre-processing.
- Exits situation when: hand ends (hero folds, shows down, wins uncontested).

## Context (deltas from core persona)

- **Time pressure:** 3–30 seconds. Hero has more time than villains think (dealer rarely enforces short clocks in cash), but long tanks draw attention and reveal info.
- **Attention:** Mostly on the table. App gets half-second glances. Any interaction that takes more than ~1.5s of focused reading is costly.
- **Hand availability:** Often one-handed. Dominant hand may be holding cards or stacking chips.
- **Cognitive load:** Full. Running equity estimates, remembering villain reads, reading body language. App must reduce load, not add to it.

## Goals

- **Glance the primary recommendation** — action + size if applicable — in under 1 second.
- **Trust what I'm reading is current** — stale advice from a prior hand is worse than no advice.
- **See the confidence behind the rec** — is this high-signal or a hunch?
- **Back-reference villain tendencies** — but only if it takes one tap, not a scroll.

## Frustrations (JTBD-killers for this situation)

- Advice hidden behind expansion, a tab switch, or a scroll. [EVID-2026-04-12-SIDEBAR-S1-S5]
- Freshness ambiguity — does this advice reflect the current hand or the last one? [EVID-2026-04-16-STP1-RECURRENCE]
- Invariant-violation badges that don't tell me if the advice is trustworthy.
- Layout reflow while I'm trying to read — scanning a moving target loses the second I have.

## Non-goals

- Deep explanations. That's [Post-session Chris](./post-session-chris.md)'s job.
- Adjusting villain models. That's [Between-hands Chris](./between-hands-chris.md)'s job.
- Player management. Not happening during a hand.

---

## Constraints

- **Time budget per interaction:** < 1.5 seconds to read; < 2 taps total to any secondary surface.
- **Error tolerance:** Near-zero. A misclick mid-hand can log a wrong action that poisons downstream analysis and requires cleanup between hands.
- **Visibility tolerance:** The primary recommendation must be *unambiguously* primary. Secondary surfaces can be latent but reachable.
- **Recovery expectation:** If he taps a destructive-looking button, he will assume it did something destructive and mentally abandon the half-second he had for a decision. Undo is good; *not needing* undo is better.

---

## Related JTBD

- `mid-hand-decision` domain (placeholder — will be seeded in a later session)
- `player-management/switch-view` — quickly confirm who is in each seat without leaving the hand

---

## What a surface must offer this persona

1. **Primary recommendation at glance distance.** Size, position, no scroll.
2. **Staleness signal that's binary and unmistakable.** Stale → visually degrade. Fresh → look alive.
3. **No destructive actions on the primary path.** Fold confirmation, action undo, no "clear player" next to "log bet."
4. **No layout changes during a hand.** The shape of the screen should not move unless the hand state changes.
5. **Thumb-reachable primary taps.** In landscape one-handed, the reachable arc is the bottom-right quadrant for right-handed users.

## What a surface must NOT do

- Show advice without freshness indication.
- Require swipe-scroll for primary info.
- Pop modals that block the table view.
- Auto-open panels that re-layout the screen.

---

## Proto-persona caveat

- **[A1]** 3–30s decision window bound. Basis: typical live cash cadence. Verify by observation or timing data.
- **[A2]** Thumb-reach arc is bottom-right quadrant in landscape. Basis: right-hand dominance assumption. Verify by owner statement on handedness.

---

## Change log

- 2026-04-21 — Created Session 1.
