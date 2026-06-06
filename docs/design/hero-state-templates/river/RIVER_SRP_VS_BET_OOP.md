---
archetypeId: RIVER_SRP_VS_BET_OOP
family: RIVER_SRP_VS_BET
voiceNotes: |
  Hardest defending spot in the catalog. Body emphasizes: raise-as-bluff harder
  OOP (villain's IP betting range is more value-heavy because they bluff less
  when checked to), bluff-catch wider when villain's bluff frequency exceeds
  pot-odds threshold via MDF. Tighter raising than IP; mostly call/fold.
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

**{{handContext.hand}} on {{handContext.boardTexture}} — facing a river bet OOP in a single-raised pot.**

## Body

Facing a river bet OOP after checking is the hardest defending spot we'll see. Villain bet because we checked, so their range is sized to capture our check-down — typically a polarized mix of value picks (the hands that wanted thin value vs our checking range) and selected bluffs with blocker reasons.

Our equity is {{equity.overall}}, decomposed as {{equity.vsRangeParts.vsValue}} when villain has it and {{equity.vsRangeParts.vsBluff}} when they don't. MDF says defend roughly pot-odds-implied frequency or villain auto-prints. A {{handContext.handStrength}} {{handContext.handClass}} continues when it beats or blocks villain's value AND unblocks villain's bluffs — the more both conditions hold, the cleaner the call. {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}.

Raise-as-bluff from OOP is structurally weak — villain knows we have no rep'd bluffing line (we checked the turn, we check the river, suddenly we raise?) so our raises are read as value-heavy. Reserve check-raises for the nuts plus a tiny frequency of perfect-blocker bluffs.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses, weighted toward call/fold: (1) call — bluff-catchers that unblock bluffs and beat the bottom of villain's value range. (2) raise — narrowest in the catalog; nuts plus a tiny blocker-bluff frequency. (3) fold — the share is larger than IP because we realize less equity OOP and our raise-as-bluff is structurally weak; the marginal bluff-catchers that float IP simply bleed chips here.
