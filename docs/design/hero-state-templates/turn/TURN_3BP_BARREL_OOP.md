---
archetypeId: TURN_3BP_BARREL_OOP
family: TURN_3BP_BARREL
voiceNotes: |
  Hand-conditioned headline. Most committing barrel of all — 3-bet pot, OOP,
  low SPR. Barrel range is value-heavy and the line is usually bet-call or
  bet-shove; check to control with hands that can't stack off. References
  situation.sprZone. Branches: call/shove-in, raise-jam, fold.
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

**{{handContext.hand}} on {{handContext.boardTexture}} — barreling the turn OOP in a 3-bet pot.**

## Body

We cbet the flop and lead the turn OOP in a 3-bet pot — the most committing barrel spot there is. Out of position with a {{situation.sprZone}} SPR, a turn bet is almost always the setup to getting it in: bet-call or bet-shove, rarely bet-fold. We can't see a free river and we can't easily fold once we fire, so the barrel range is value-heavy by necessity.

Bet the hands that want to stack off — {{handContext.handStrength}} and better, plus the draws with the raw equity to call a jam. Our equity vs villain's continuing range is around {{equity.overall}} ({{equity.vsRangeParts.vsValue}} vs value). {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}, sized so the river is a clean shove.

Check the hands that can't profitably commit. OOP at low SPR there's no room to barrel-then-fold, so marginal made hands play as check-calls or check-folds, not as barrels we'd have to abandon.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three lines: (1) called — we're committed; the river is a shove with our value and our backed draws, a give-up with the misses. (2) raised — facing a jam OOP, call only with hands ahead of villain's near-nutted raising range. (3) folded — we win the large pot without showdown.
