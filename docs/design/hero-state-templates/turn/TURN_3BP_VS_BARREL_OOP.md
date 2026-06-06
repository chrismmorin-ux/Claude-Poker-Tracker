---
archetypeId: TURN_3BP_VS_BARREL_OOP
family: TURN_3BP_VS_BARREL
voiceNotes: |
  Hand-conditioned headline. The toughest and lowest-SPR defending spot:
  3-bet pot, OOP, facing a barrel. Mostly call-or-fold for us, check-raise
  becomes a jam, bluff-catchers must beat a value-heavy range and blockers to
  value matter most. References situation.sprZone. Branches: call (commit),
  check-raise-jam (nutted + premium blockers), fold (often).
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

**{{handContext.hand}} on {{handContext.boardTexture}} — facing a turn barrel OOP in a 3-bet pot.**

## Body

We called the flop OOP in a 3-bet pot and villain barrels the turn. This is the toughest, lowest-SPR defending spot in the catalog: out of position, the pot already huge relative to stacks, deciding whether to play for it all. There's no float-and-steal here — it's call (and commit) or fold.

Villain's barrel range is heavily value-weighted at this SPR, so bluff-catchers earn their continue by the blockers they hold. The hands that beat or block value and unblock the few credible bluffs are calls; the same {{handContext.handStrength}} that blocks bluffs and beats nothing is a fold. Our equity vs the barrel range is around {{equity.overall}} ({{equity.vsRangeParts.vsValue}} vs value). {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}.

Check-raising is a jam, not a sizing decision — reserve it for nutted value and the premium blocker semibluffs that have fold equity plus outs when called.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) call — commit-aware bluff-catching, gated on blockers to value. (2) check-raise — a jam with nutted value and premium-blocker semibluffs only. (3) fold — the largest share of all the vs-barrel spots; without position or stack depth, marginal holdings can't continue profitably.
