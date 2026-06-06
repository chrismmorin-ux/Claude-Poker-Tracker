---
archetypeId: RIVER_PROBE
family: RIVER_PROBE
voiceNotes: |
  History-conditioned archetype — flop and turn both checked through; hero
  leads river OOP into villain's capped range. Body stresses: villain's range
  is capped to bluff-catchers and medium pairs (would have bet for value
  earlier with stronger hands); hero leads polarized — value-rich + select
  bluffs with showdown-value blockers; sizing tends thin (~25-40%) on most
  boards because villain rarely strong. Adjacent to RIVER_BLOCK_BET but
  structurally distinct (no prior aggression history at all).
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

**{{handContext.hand}} on {{handContext.boardTexture}} — probing the river OOP after flop and turn checked through.**

## Body

Flop and turn both checked through. Villain didn't bet either street for value, so their range is capped — they'd usually have led or raised earlier with top-pair-plus or strong draws; what reaches the river checked-checked is mostly bluff-catchers, medium pairs, and missed draws.

That capped range is the lever. Our equity is {{equity.overall}} with {{equity.vsRangeParts.vsValue}} vs the small value cluster that remains, so leading polarized — value-rich plus select bluffs with showdown-value blockers — extracts where check-down would leave money. {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}. Sizing tends thin (block-region 25-40%) on most boards because villain's range can't tolerate large bets without folding, and we want even the bluff-catchers to call.

Bluff selection: pick combos that block villain's bluff-catchers (we hold the card that makes their middle-pair-plus more frequent) so our bluff frequency targets the folds we want.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) villain folds — captured the missed draws and weakest bluff-catchers. (2) villain calls — value spot confirmed against the bluff-catching mass. (3) villain raises — heavily value-weighted; villain's capped range never raises light, so a raise here compresses to two-pair+ and we fold most bluffs, calling only with the strongest value.
