---
archetypeId: RIVER_3BP_BET_OOP
family: RIVER_3BP_BET
voiceNotes: |
  3BP OOP river-bet is the strongest commitment line in the catalog — usually a
  shove-or-large-bet. Block-bet rare in 3BP because SPR is too low to leverage
  the small-lead game theory. Body stresses: betting commits, OOP eliminates
  bluff-catching option, range narrows to value-heavy with select polarized
  bluffs that have nut-blocker reasons.
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

**{{handContext.hand}} on {{handContext.boardTexture}} — betting river OOP in a 3-bet pot.**

## Body

3-bet-pot river bets from OOP are the strongest commitment line we'll make. SPR is {{situation.sprZone}}; the sizing decision is usually shove or large-bet because there's no room for thin-value-and-fold. Block-betting is rare here — at this SPR the small-lead game theory breaks down (villain's pot-odds become absurd, raise-as-bluff dominates), so block sizing routes to checking instead.

{{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}. Our equity is {{equity.overall}} with {{equity.vsRangeParts.vsValue}} vs villain's value combos; a {{handContext.handStrength}} {{handContext.handClass}} earns the bet by beating that calling-range cluster, full stop. There's no recovery from being raised, so we don't bet thin-thin from OOP at low SPR.

Bluffs at this node require nut-region blocker reasons (we block villain's two-pair+ and have no showdown), and frequency stays low because villain's 3BP calling range is sticky.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

(1) villain folds — capture the bluff-catching mass + missed draws. (2) villain calls — value spot confirmed; the bet was sized for it. (3) villain raises (jam) — defending range narrows to nuts and the strongest two-pair; everything else folds. This is the catalog's clearest "we committed, accept the cost if villain has it" spot.
