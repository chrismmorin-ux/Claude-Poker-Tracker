---
archetypeId: TURN_SRP_BARREL_OOP
family: TURN_SRP_BARREL
voiceNotes: |
  Hand-conditioned headline. Body emphasizes that barreling OOP is more
  committing — no free river, so the barrel range is tighter and more
  value-weighted than IP, and sizing leans larger to deny equity. Branches:
  call, raise (tough OOP — continue only nutted), fold.
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

**{{handContext.hand}} on {{handContext.boardTexture}} — barreling the turn OOP in a single-raised pot.**

## Body

We cbet the flop and lead the turn OOP. Out of position the barrel is more committing — we don't get to see a free river, and checking risks giving up the pot to a range that would have folded. So our OOP barrel range is tighter and more value-weighted than it would be IP: {{handContext.handStrength}} and better for value, plus the draws with enough equity to keep firing rivers profitably. Our equity vs the continuing range is around {{equity.overall}} ({{equity.vsRangeParts.vsValue}} vs value).

{{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}. Sizing leans larger here than IP: OOP we want to deny villain's realization and charge their draws, since we can't control the river as cheaply.

Check the marginal made hands and give-up hands — OOP they play better as bluff-catchers or check-folds than as barrels we'd have to abandon when raised.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three lines: (1) called — we're OOP on the river with a defined value range; barrel rivers that improve us or stay scary, check-call or give up otherwise. (2) raised — OOP facing a raise is the worst spot; villain's raising range is strongly value-weighted, so fold everything but the nutted top of our range. (3) folded — we realize the fold equity that made the barrel correct.
