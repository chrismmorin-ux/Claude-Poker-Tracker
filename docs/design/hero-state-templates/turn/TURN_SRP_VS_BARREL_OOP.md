---
archetypeId: TURN_SRP_VS_BARREL_OOP
family: TURN_SRP_VS_BARREL
voiceNotes: |
  Hand-conditioned headline. Body stresses that facing a barrel OOP is the
  hardest defending spot — tighter than IP MDF because we realize less equity,
  bluff-catchers must beat or block value, and check-raise is the polarized
  branch. Branches: call (tight bluff-catch), check-raise (nutted + blocker
  semibluff), fold (more often than IP).
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

**{{handContext.hand}} on {{handContext.boardTexture}} — facing a turn barrel OOP in a single-raised pot.**

## Body

We called the flop OOP and villain barrels the turn. This is the hardest defending spot: out of position we realize less of our equity, so our defending range is tighter than the IP version even though the pot-odds math is the same. We can't profitably float as wide — there's no cheap in-position river to steal.

Bluff-catchers earn their continue by beating villain's value or blocking it. Our equity vs the barrel range is around {{equity.overall}} ({{equity.vsRangeParts.vsValue}} vs value); a {{handContext.handStrength}} that unblocks villain's bluffs and blocks their value is a call, while the same nominal strength that blocks bluffs is closer to a fold. {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}.

Check-raise is the polarized OOP weapon: nutted value plus select semibluffs with blockers and equity, sized to set up a river commitment. Fold more than you would IP — without position, the marginal hands that float IP simply bleed chips here.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) call — tight bluff-catching with hands that beat or block value and unblock bluffs. (2) check-raise — polarized: nutted value plus blocker semibluffs that can barrel the river. (3) fold — the larger share OOP; surrender the hands that can't realize without position.
