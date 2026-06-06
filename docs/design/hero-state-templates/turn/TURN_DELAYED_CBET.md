---
archetypeId: TURN_DELAYED_CBET
family: TURN_DELAYED_CBET
voiceNotes: |
  Hand-conditioned headline. Body explains the delayed cbet: we checked back
  the flop IP (pot control / induce / protect our checking range) and now bet
  the turn — for value we slow-played, for protection, or as a delayed bluff
  after villain's second check signals weakness. Branches: call, raise (we're
  capped by the flop check-back — fold marginal), fold.
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
  - handContext.handStrength
  - equity.overall
  - equity.vsRangeParts.vsValue
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**{{handContext.hand}} on {{handContext.boardTexture}} — delayed cbet on the turn after checking back the flop.**

## Body

We checked back the flop in position — for pot control, to protect our checking range, or to induce — and now we bet the turn. The delayed cbet does work the flop bet couldn't: villain checking to us a second time signals weakness we can attack, and the turn card may have improved us or the board may now favor our range.

Our delayed-betting range is the value we deliberately slow-played, the made hands that now want protection ({{handContext.handStrength}}), and give-up hands turned into delayed bluffs against a villain who has twice declined to bet. Our equity vs villain's range is around {{equity.overall}} ({{equity.vsRangeParts.vsValue}} vs value). {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}.

Note our own cap: by checking the flop back we removed our strongest hands from the picture in villain's eyes, so a turn check-raise from them is credible. Keep the betting range honest enough that we're not auto-folding to that line.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three lines: (1) called — we have position into the river; value-bet again on safe cards, check back the rest. (2) raised — villain's check-then-raise represents the strength we don't hold after capping ourselves; fold marginal delayed bluffs, continue with real value. (3) folded — the delayed line picks up the pot villain's double-check gave away.
