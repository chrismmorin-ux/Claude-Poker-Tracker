---
archetypeId: RIVER_MULTIWAY
family: RIVER_MULTIWAY
voiceNotes: |
  3+ players to the river. Per POKER_THEORY.md §7.4, HU range-vs-range
  reasoning breaks multiway: defending tightens because each defender behind
  raises fold-equity for the bettor; value-betting thin is dangerous (more
  chances of being beaten); bluffing is almost never correct. Body explicitly
  frames the multiway-specific math and stresses tightening from both sides.
  This is the catalog's "all heads-up intuitions break here" archetype.
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
  - handContext.handStrength
  - situation.playersRemaining
  - equity.overall
  - equity.vsRangeParts.vsValue
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**{{handContext.hand}} on {{handContext.boardTexture}} — river decision with {{situation.playersRemaining}} players still in.**

## Body

Heads-up intuitions break multiway. With {{situation.playersRemaining}} players to the river, our equity is {{equity.overall}} but it's distributed across multiple opponents — each one needs to be beaten or folded, and each villain behind raises the fold-equity required to bluff (more chances someone has it). Value-betting thin is dangerous: the more opponents, the more likely the rare hand combination that beats our thin value is present.

Bluffing is almost never correct multiway — fold equity collapses geometrically as opponent count grows. Even a 70% fold rate per villain means only 49% both fold with two, 34% with three; our bluff needs to clear that bar AND beat villain's calling ranges with backup equity (which is zero on the river). The dominant action is check or check-back; thin value gets demoted to medium value at minimum.

{{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}. A {{handContext.handStrength}} that would value-bet HU often checks here, accepting showdown rather than risking the rare two-pair+ from one of multiple opponents. {{equity.vsRangeParts.vsValue}} vs the combined value range is the relevant number — and the combined value range is denser than any single HU villain's.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Defending multiway is tightest in the catalog. (1) facing a bet — fold wider than HU; calling range narrows to top-of-range only. (2) facing a bet + a call ahead of us — fold even tighter; the cold-caller has effectively confirmed value, and our range condenses to nuts only. (3) raising — restricted to absolute nuts; any thinner raise loses to one of multiple value combinations that survive.
