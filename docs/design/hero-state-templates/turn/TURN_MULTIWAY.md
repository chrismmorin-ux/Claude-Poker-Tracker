---
archetypeId: TURN_MULTIWAY
family: TURN_MULTIWAY
voiceNotes: |
  Structurally framed headline (applies multiway, not to one hand). Body's
  load-bearing idea is design doc §7.4: with 3+ players, HU range-vs-range
  reasoning breaks — value must beat multiple ranges, bluffs rarely work
  because someone continues, so tighten hard and lean toward pot control.
  Branches: bet (strong value only), check (everything marginal), fold to
  action (no-equity).
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
  - handContext.handStrength
  - equity.overall
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**Multiway turn on {{handContext.boardTexture}} — three or more players, so tighten hard.**

## Body

With three or more players still in on the turn, heads-up range-vs-range reasoning breaks down (design doc §7.4). A bet now has to be good against several ranges at once, not one — and the more players behind, the more often someone holds the part of the board we'd want to bluff at. Bluffs that print heads-up simply get called multiway.

So tighten dramatically. Value-bet the hands that beat the combined continuing ranges — strong made hands ({{handContext.handStrength}} and better) that want protection and can get called by worse from more than one opponent. Our equity vs the field is around {{equity.overall}}, and "equity vs one villain" overstates how we do against the whole table. {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}.

Everything marginal checks. Middle pairs, weak top pairs, and naked draws that would barrel heads-up are pot-control or pot-odds calls multiway, not bets — there are too many hands behind that continue.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three lines: (1) bet — strong value only, sized to get called by worse across multiple ranges. (2) check — the large marginal middle; realize equity cheaply rather than bet into a field. (3) fold to action — without the equity to continue against multiple committed ranges, release; multiway pots punish loose continues hardest.
