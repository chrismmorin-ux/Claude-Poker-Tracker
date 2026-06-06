---
archetypeId: RIVER_VS_BLOCK_BET
family: RIVER_VS_BLOCK_BET
voiceNotes: |
  Facing a small river lead (~25-40% pot). Body stresses: pot odds excellent
  (~3-to-1 calling 25-30% to win pot+lead); MDF very high (defending ~80%+ of
  range); raise-as-bluff exploits villain's wide block-betting range; folding
  only with combos that BOTH block villain's bluffs AND lose to value. Position
  agnostic — the small-bet pot-odds regime dominates positional considerations.
  Per §4.5.1, classifier routes here when sizingFraction <= 0.40.
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

**{{handContext.hand}} on {{handContext.boardTexture}} — facing a small river lead ({{plan.primary.sizing}} block bet).**

## Body

Villain has block-bet the river. Pot odds are excellent — calling a 25-40% block costs us roughly 1-in-4 to win the inflated pot, and MDF says we have to defend somewhere north of 80% of our range to stop villain from auto-printing with any-two. The math reshapes the decision: this is not a normal "bluff-catch or fold" spot, it's "fold the rare combos that both block villain's bluffs AND lose to value, call almost everything else."

Our equity is {{equity.overall}}, decomposed as {{equity.vsRangeParts.vsValue}} when villain has it and {{equity.vsRangeParts.vsBluff}} when they don't. Villain's block-bet range is value-heavy with select induce-bluffs (per the BLOCK_BET archetype's structure), so the bluff frequency we're catching is modest — but at these odds, even a modest bluff frequency makes the call profitable for the vast majority of our hand classes.

Raise-as-bluff is the high-leverage exploit here. Villain's wide block-betting range struggles against a big raise: their value-medium hands can't comfortably call a polarized re-raise, and their induce-bluffs are bluff-catchers themselves. {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}. A {{handContext.handStrength}} {{handContext.handClass}} that blocks villain's value and has decent showdown value is a candidate to raise as a polarized bluff; the rest call.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses heavily skewed toward call: (1) call — the default; the dominant outcome for almost every hand class with any showdown value. (2) raise — polarized: nuts (charge villain's wide range) plus blocker bluffs that fold out villain's marginal bluff-catchers and induce-bluffs. (3) fold — rare; only the combos that BOTH block villain's bluff range AND lose to their value range qualify. Without both conditions, the pot odds make calling positive.
