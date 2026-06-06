---
archetypeId: RIVER_3BP_BET_IP
family: RIVER_3BP_BET
voiceNotes: |
  Hand-conditioned headline. Body emphasizes low-SPR commitment dynamics —
  betting at the river in a 3-bet pot is often a jam-or-large-bet sizing
  decision because remaining stack-to-pot is small. Range is tighter than SRP
  (3BP polarized to value + select bluffs). Blocker-aware bluff selection is
  critical at low SPR because villain's calling range is correspondingly tight.
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
  - handContext.handClass
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

**{{handContext.hand}} on {{handContext.boardTexture}} — value-betting river IP in a 3-bet pot.**

## Body

3-bet-pot river bets live at low SPR — {{situation.sprZone}} — and that compresses the sizing decision. There's rarely room for a meaningful sizing band; the choice is usually jam, large bet, or check-back. {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}.

Both ranges are already tight from preflop: hero's 3BP opening + caller range and villain's flat/4-bet branches are narrower than SRP. Our equity is {{equity.overall}} with {{equity.vsRangeParts.vsValue}} vs villain's value combos — at low SPR even thin equity translates to a bet because villain's calling threshold can't be far above 1/(1+commitment fraction). A {{handContext.handStrength}} {{handContext.handClass}} that beats villain's call-down range is a clear bet; everything else checks back and accepts showdown.

Bluffs at this node need strict blocker selection — calling at low SPR is sticky, so we only bluff combos that block villain's value (top-pair-plus blockers) AND have no showdown value of their own. Most missed draws are too sticky to fold for villain at these odds; pick the rare bluff combos carefully.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Two practical outcomes: (1) villain folds or calls — both are fine; at low SPR thin value still prints because villain's range is condensed. (2) villain raises — usually a jam at this SPR; call only with the top of our value range (two-pair+ at minimum on most textures) because villain's raise range is value-heavy when commitment math is this lopsided.
