---
archetypeId: RIVER_3BP_VS_BET_IP
family: RIVER_3BP_VS_BET
voiceNotes: |
  Facing river bet IP in 3-bet pot. Body: villain's polarized + low SPR =
  bluff-catching threshold tighter than SRP because their bluff freq is capped
  by a tighter 3BP opener range. Pot odds are still pot odds, but the relevant
  comparison is villain's bluff combos / value combos at this exact node — and
  in 3BPs that ratio skews toward value. Raise rare (often jam given SPR).
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

**{{handContext.hand}} on {{handContext.boardTexture}} — facing a river bet IP in a 3-bet pot.**

## Body

Bluff-catching in a 3-bet pot is structurally different from SRP. Villain's range is tighter from preflop, so the bluff combos available to them are fewer; the relevant ratio — bluff frequency divided by value frequency in their betting range — skews toward value. Our equity is {{equity.overall}} with {{equity.vsRangeParts.vsValue}} when villain has it and {{equity.vsRangeParts.vsBluff}} when they don't, and those numbers usually argue for tighter defense than the analogous SRP spot.

Pot odds are still pot odds, but MDF is a soft guide rather than a hard mandate — at low SPR ({{situation.sprZone}}) villain's bet is often a jam, and the call/fold decision compresses to "do we beat villain's value range some of the time, blocking some of it." A {{handContext.handStrength}} {{handContext.handClass}} that beats villain's bottom-of-value cluster and unblocks bluffs is a call; bluff-catchers that block villain's bluffs are closer to a fold than in SRP. {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}.

Raising at this SPR is effectively a jam — only nuts and the most blocker-laden semibluffs (almost never appearing on the river since draws complete).

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses, skewed toward fold relative to SRP: (1) call — strong bluff-catchers with bluff-unblockers and value-blockers. (2) raise (jam) — nuts only at this SPR; the calling threshold for villain is so low that raising thin loses to their value calls. (3) fold — the larger share than SRP IP; villain's tighter range plus low-SPR commitment economics make the marginal bluff-catchers unprofitable.
