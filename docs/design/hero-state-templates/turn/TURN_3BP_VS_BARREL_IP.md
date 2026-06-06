---
archetypeId: TURN_3BP_VS_BARREL_IP
family: TURN_3BP_VS_BARREL
voiceNotes: |
  Hand-conditioned headline. Facing a barrel IP in a 3-bet pot: low SPR
  tightens bluff-catch math, villain's barrel range is more polarized toward
  value, and position helps less than usual because there's little room to
  float. References situation.sprZone. Branches: call (commit-aware), raise/jam
  (nutted), fold.
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
  - handContext.handStrength
  - situation.sprZone
  - equity.overall
  - equity.vsRangeParts.vsValue
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**{{handContext.hand}} on {{handContext.boardTexture}} — facing a turn barrel IP in a 3-bet pot.**

## Body

We called the flop in a 3-bet pot and villain barrels the turn; we're IP. The {{situation.sprZone}} SPR changes the calculus: a call here often commits us to the river, so "call turn, fold river" is rarely a real plan — we're deciding whether to play for stacks. Position helps less than in a single-raised pot because there's little room to float and outplay; the stacks are too shallow relative to the pot.

Villain's barrel range is more polarized toward value than in an SRP — the capped, strong preflop ranges leave fewer credible bluffs. So our continues need real equity against value, not just bluff-catching pretensions. Our equity vs the barrel range is around {{equity.overall}} ({{equity.vsRangeParts.vsValue}} vs value); {{handContext.handStrength}} that beats a chunk of the value range or has shove-equity as a draw continues, weaker holdings fold. {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) call — commit-aware; continue only with hands that beat value or carry enough draw equity to stack off. (2) raise/jam — the nutted top of our range, getting it in while we're ahead. (3) fold — bluff-catchers that can't beat a value-weighted barrel at this SPR.
