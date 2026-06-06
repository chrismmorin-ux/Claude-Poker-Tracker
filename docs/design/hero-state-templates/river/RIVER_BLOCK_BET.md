---
archetypeId: RIVER_BLOCK_BET
family: RIVER_BLOCK_BET
voiceNotes: |
  OOP small lead (~25-40% pot) — sizing-distinctive archetype. Body stresses:
  block sizing has thin-value-and-bluff-catch-induce semantics, structurally
  distinct from full-pot OOP bet (different MDF, different bluff-frequency
  optimum, different raise-as-bluff response). Range construction is
  value-heavy with select induce-bluffs (NOT polarized to nuts + air like the
  full-pot OOP archetype). Hero blocks themselves from nut range by block-
  betting — the small size signals "this is what I want called." Catalog
  rationale per §4.5: BLOCK_BET is separate because it's a different decision
  tree, not a hand-class variant of RIVER_*_BET_OOP.
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
  - handContext.handClass
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

**{{handContext.hand}} on {{handContext.boardTexture}} — block-betting OOP on the river ({{plan.primary.sizing}}).**

## Body

Block-betting OOP on the river ({{plan.primary.sizing}}) is a structurally different decision from a full-pot OOP bet. The small sizing changes everything: villain's pot odds are excellent (calling 30% to win pot-plus-block), their fold-rate to this size is the lowest of any river bet sizing, and their raise-as-bluff incentive is unusually high because the small bet looks like a sizing tell.

Range construction here is value-heavy with select induce-bluffs — NOT polarized to nuts + air. The block-bet is "this is what I want called" — medium-strong hands that beat villain's bluff-catching range, plus a small bluff frequency designed to look like missed thin value. Equity is {{equity.overall}} with {{equity.vsRangeParts.vsValue}} vs villain's value combos; the block sizing's purpose is to extract from the bluff-catching mass that would have hero-called a check. {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}.

We cap ourselves by block-betting — the nut region usually picks a larger sizing — so when villain raises, we're defending a value-medium range, not nuts. Pick the block-bet hand classes that can absorb a raise as a check-call (medium top-pair, weaker two-pair) rather than ones that hate getting raised (set with poor blocker).

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses to plan for: (1) villain folds — rare given the sizing-induced great odds; usually missed nut-blockers without showdown. (2) villain calls — the default outcome the size was designed for; thin value extracted from the bluff-catching mass. (3) villain raises — sized-up bluff-or-value; defending range is tighter than full-pot OOP bet because we capped ourselves by block-betting. Fold the bottom of our value-medium range; call with the top and the rare value-blocker bluff-catchers that beat villain's raise-bluffs.
