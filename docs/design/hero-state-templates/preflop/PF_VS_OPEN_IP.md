---
archetypeId: PF_VS_OPEN_IP
family: PREFLOP_VS_OPEN
voiceNotes: |
  Hand-conditioned headline. Body emphasizes IP value of cold-call,
  squeeze risk from blinds, and the 3bet-for-value bias when blinds
  are tight. Branches: flat IP, 3bet for value/iso, fold.
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

**{{handContext.hand}} from {{situation.positionClass}} IP vs the open — cold-call or 3bet for value.**

## Body

We're IP against the opener with closing-action position when blinds fold. That's a structural advantage we don't get often preflop, and it changes the math compared to BB defending: we realize equity better, control pot size, and can flat hands that play poorly OOP.

The default is to flat with hands that realize equity well IP (suited broadways, pocket pairs, suited connectors). Cold-calling here doesn't suffer the OOP penalty BB defending does, and we keep the opener's range capped (they didn't 3-bet) while denying the blinds their squeeze opportunity by closing the action ourselves.

3-bet for value with the top of our range — when the opener is wide and the blinds are tight enough that squeeze risk is contained. The thinner the opener's range and the tighter the blinds, the more we can 3-bet. Squeeze risk is the main reason to compress our 3-bet range here vs from a blind position: a squeezing blind puts us in a 4-way decision with our range face up.

Marginal hands that don't realize equity well even IP (offsuit broadways with weak kickers, weak suited Axs out of range) fold rather than flat-call attempts at speculative postflop play.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) flat IP with playable hands. (2) 3bet for value or iso when squeeze risk is low. (3) fold the marginals that don't fit either lane.
