---
archetypeId: TURN_SRP_BARREL_IP
family: TURN_SRP_BARREL
voiceNotes: |
  Hand-conditioned headline. Body frames the second-barrel decision IP in a
  single-raised pot: which turns extend our range advantage, why position lets
  us barrel wider, and which value/draw combos make up the betting range.
  Branches: villain calls (plan river), raises (fold marginal, continue nutted),
  folds.
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
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

**{{handContext.hand}} on {{handContext.boardTexture}} — barreling the turn IP in a single-raised pot.**

## Body

We cbet the flop and the turn is a second-barrel decision IP. Position is the lever: we get to see villain's reaction before committing the river, so we can barrel a wider range than OOP and still control the pot when called. Our equity vs villain's continuing range is around {{equity.overall}}; against the value portion it's {{equity.vsRangeParts.vsValue}}.

Barrel the turns that extend our range advantage — overcards and cards that complete the draws our flop-cbet range is weighted toward, where villain's flop-call range is now capped and under-equitied. Our betting range is value ({{handContext.handStrength}} and better) plus draws that picked up equity and can keep barreling rivers. {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}.

Check back the turns that favor villain's range, and the marginal made hands that prefer to realize showdown value cheaply rather than bloat the pot — position means we can take a free river with them.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three lines: (1) called — we have position to plan the river; barrel again on cards that keep us ahead, give up when the runout favors villain. (2) raised — villain's turn check-raise range is value-heavy in a single-raised pot; fold marginal barrels, continue with the top of our range and high-equity draws. (3) folded — we deny villain's equity and take it down.
