---
archetypeId: RIVER_DELAYED_BET
family: RIVER_DELAYED_BET
voiceNotes: |
  Hero checked back turn IP, bets river. Body: hero's range is capped (no turn
  value bet) but contains nuts + air; river bet polarizes; small sizing common
  because villain's range is also bluff-catching (checked turn after calling
  flop). Trap-line undertone (we may have checked back to induce, or because
  hand class wanted a free card). Blocker-aware bluff selection emphasized.
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

**{{handContext.hand}} on {{handContext.boardTexture}} — delayed river bet IP after checking back the turn.**

## Body

We checked back the turn — either to induce, to take a free card with a medium-strength hand, or because our range wanted to slow down on that turn card — and now we're betting the river. Villain's range is bluff-catcher-heavy: they called flop, faced a turn check, and arrived at the river expecting showdown.

Our range is capped (no turn value bet means no top-of-range here) but contains the full spread from showdown-value pairs to busted draws, so the river bet polarizes. Equity is {{equity.overall}} with {{equity.vsRangeParts.vsValue}} vs villain's value combos; a {{handContext.handStrength}} {{handContext.handClass}} earns the bet by beating villain's calling threshold at this sizing. {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}. Sizing tends small-to-medium because both ranges are bluff-catcher-heavy and we want maximum continue from villain's marginal pairs.

Bluffs need blockers — we hold a card that makes villain's bluff-catchers more frequent in their range (so our bluffs target the folds, not the calls). Pure-air bluffs are rare given the capped range.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) villain folds — capture the bluff-catching mass that couldn't continue. (2) villain calls — value spot for the top of our capped range. (3) villain raises — heavily value-weighted; we capped ourselves on the turn, villain knows it, so raises here are value-driven and we narrow defense to the strongest hands in our river-betting range.
