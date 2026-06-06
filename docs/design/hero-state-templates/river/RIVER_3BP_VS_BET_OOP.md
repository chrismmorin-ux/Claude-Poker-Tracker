---
archetypeId: RIVER_3BP_VS_BET_OOP
family: RIVER_3BP_VS_BET
voiceNotes: |
  Lowest-MDF defending spot in the catalog. OOP + low SPR + capped 3BP villain
  bluff range = defending narrows to value-plus-nut-blockers. Body explicitly
  names this as the catalog's tightest defending node and frames it for the
  reader. Raise rare (jam-only). Most decisions resolve to call-with-nuts or
  fold-everything-else.
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
  - handContext.handClass
  - handContext.handStrength
  - situation.sprZone
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

**{{handContext.hand}} on {{handContext.boardTexture}} — facing a river bet OOP in a 3-bet pot.**

## Body

This is the tightest defending spot in the catalog. OOP, low SPR ({{situation.sprZone}}), villain's bluff combos are capped by a tight 3-bet-pot range, and we have no position to compensate. Our equity is {{equity.overall}} with {{equity.vsRangeParts.vsValue}} when villain has it and {{equity.vsRangeParts.vsBluff}} when they don't — and at this node those numbers usually argue for folding most of our checking range.

MDF is a soft pressure here, not a binding constraint. At low SPR villain's bet is typically a jam, and our calling threshold compresses to "we beat enough of villain's value range to make calling positive." A {{handContext.handStrength}} {{handContext.handClass}} continues when it beats or strongly blocks villain's nut region and unblocks their bluffs; bluff-catching without value-blocker AND bluff-unblocker is a fold. {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}.

Check-raise from OOP at this SPR is effectively jam-or-fold — and jam only with the absolute nuts because villain's calling threshold is already low, so a check-raise gets called by the value range we're trying to charge.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Two practical responses: (1) call — narrow; nut region and the strongest two-pair combos that beat villain's value calls. (2) fold — the dominant response; without position, blocker reasons, AND enough showdown vs villain's tightened range, the call doesn't break even. Raise-as-bluff is structurally dead at this node.
