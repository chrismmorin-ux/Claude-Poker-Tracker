---
archetypeId: PF_VS_OPEN_BB
family: PREFLOP_VS_OPEN
voiceNotes: |
  Hand-conditioned headline. Body emphasizes BB defense math
  (pot odds + closing the action), wide flatting range, polarized
  3bet construction. Branches: flat vs small bet, 3bet polarized,
  fold range bottom.
slotsUsed:
  - handContext.hand
  - handContext.handClass
  - situation.actionContext
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
  - equity.overall
---

## Headline

**{{handContext.hand}} from BB — defend or 3bet vs the open.**

## Body

We're closing the action with the BB discount. Pot odds are favorable — we're getting better than 2:1 on the call against a standard open size, which means we can defend wider than position alone would suggest. The trade-off is that we're going to play the rest of the hand OOP against a tighter, more concentrated range, with limited fold equity postflop.

Our defense splits two ways. Flat with hands that realize equity well multi-street (suited connectors, small pairs, suited broadways) and that don't get dominated when we connect — we want to flop something that holds its value through turn and river. 3-bet polarized with the top (premiums for value) and the bottom of our continuing range (suited Axs, low suited connectors) where we'd rather take the pot down preflop or play a 3bet pot with initiative than get squeezed flatting OOP.

Standard equity vs the opener's range is around {{equity.overall}}. The hands we fold are dominated trash that doesn't realize equity OOP and doesn't make the pot odds work.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses cover most spots: (1) flat — playable, in-range, hits flops well. (2) 3bet — top of range or polarized bluff with blockers/playability. (3) fold — dominated marginal hands that don't realize equity OOP.
