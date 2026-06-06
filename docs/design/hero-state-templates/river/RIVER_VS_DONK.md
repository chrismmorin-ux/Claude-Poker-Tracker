---
archetypeId: RIVER_VS_DONK
family: RIVER_VS_DONK
voiceNotes: |
  Hero was the prior-street aggressor (bet flop and/or turn) and villain donks
  the river. Distinguished from RIVER_VS_BLOCK_BET by sizing — donk leads tend
  to be polarized/medium-to-large; small-sizing leads route to BLOCK_BET. Body
  stresses: donk lead from villain who's been the caller is structurally rare
  and heavily polarized (nuts + occasional bluff with a strong blocker reason);
  raise-fold tightens vs IP-vs-bet because the lead signals strength.
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
  - handContext.handClass
  - handContext.handStrength
  - equity.overall
  - equity.vsRangeParts.vsValue
  - equity.vsRangeParts.vsBluff
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**{{handContext.hand}} on {{handContext.boardTexture}} — facing a river donk lead from villain.**

## Body

We were the prior-street aggressor — bet flop, bet turn or checked back — and villain leads into us on the river. Donk leads from a player who's been the caller all the way are structurally rare and heavily polarized: villain rarely leads with medium-strength hands (they'd check-call those), so the lead splits into a value-heavy cluster (nuts, straights, two-pair where the river card brought one in) and an occasional bluff with a strong blocker reason.

Our equity is {{equity.overall}}, decomposed as {{equity.vsRangeParts.vsValue}} when villain has it and {{equity.vsRangeParts.vsBluff}} when they don't, and the bluff portion is smaller than facing a normal river bet because of the donk-line capping effect. {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}. A {{handContext.handStrength}} {{handContext.handClass}} continues when it beats the bottom of villain's value cluster AND has a blocker reason that condenses villain's range toward bluff.

Raising as bluff is structurally weak — villain's donk-lead range is already on the value side of polarized, so raising represents nuts on our end and villain's value calls. Reserve raises for absolute nuts; bluff-raises only with the rare combo that blocks every value hand in villain's leading range.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses, weighted toward fold: (1) call — bluff-catch only with strong showdown value AND value-blockers; without both conditions the donk-lead's value-skew makes calls negative. (2) raise — nuts plus the rare blocker-bluff that folds out villain's marginal value. (3) fold — most of our range that doesn't beat villain's two-pair+ region; the donk lead's structural polarization makes marginal calls unprofitable.
