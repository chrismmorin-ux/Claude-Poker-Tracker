---
archetypeId: PF_OPEN_RFI
family: PREFLOP_OPEN
voiceNotes: |
  Hand-conditioned headline. Body anchors on range construction
  + tight-vs-wide flop config. Branches cover the three responses
  hero faces (call from BTN, 3bet from later position, 3bet from
  blinds). Mirrors §5.1 worked example (AJo HJ).
slotsUsed:
  - handContext.hand
  - handContext.handClass
  - situation.positionClass
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**{{handContext.hand}} on {{situation.positionClass}} — standard open.**

## Body

We're planning to {{plan.primary.action}} {{plan.primary.sizing}}bb. {{handContext.handClass}} hand at the top of our {{situation.positionClass}} range — {{plan.primary.sizingRationale}}.

If called, we'll have a tight-vs-wide flop configuration: tighten on dynamic boards where their flat range connects, widen on textures where we own the range advantage (A-high, rainbow low, paired). Range advantage in single-raised pots is structural — we're the one who chose to put money in first, with a tighter, more concentrated range than they're calling with.

Position behind us is the asymmetry to track. Players left to act constrain how light we should mix in suited connectors and small pairs. Tight when blinds + late position are aware; wider against passive tables.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

The three branches that matter most: (1) called by a position behind — we cbet polarized on dry boards we own and tighten on draw-heavy boards. (2) 3-bet from late position (BTN/SB) — we call IP with hands that play well postflop and 4-bet for value with the top of our range. (3) 3-bet from BB — these ranges tend to be heavier on premiums; fold the marginal hands that called the 3bet would dominate.
