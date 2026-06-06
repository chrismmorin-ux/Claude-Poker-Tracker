---
archetypeId: FLOP_MULTIWAY_SRP
family: FLOP_MULTIWAY
voiceNotes: |
  Multiway single-raised pot — 3+ players to flop with one preflop
  raise. Body cites the four structural multiway points: equity dilution
  by player count, cascading fold equity (∏ fold rates), capped caller
  ranges (callers would have raised premiums), pot-odds dilution. Hero
  role (PFR_LEADING / CALLER_PFR_BEHIND / CALLER_PFR_ACTED) appears as
  a slot in body — same prose serves all three SRP-hero-role variants
  (the role distinction is one-sentence-deep). Plan computation lives
  in gameTreeEvaluator (already multiway-aware via numOpponents); this
  template renders, never decides.
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
  - handContext.handClass
  - handContext.rangeAdvantage
  - handContext.nutAdvantage
  - situation.playersRemaining
  - situation.multiwayHeroRole
  - situation.pot
  - situation.effStack
  - equity.overall
  - equity.realization
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**{{handContext.hand}} multiway single-raised pot on {{handContext.boardTexture}} — {{situation.multiwayHeroRole}}, value-heavy mode.**

## Body

We're in a single-raised multiway pot with {{situation.playersRemaining}} players to the flop. The heads-up range-vs-range frame doesn't hold here — our overall equity against the field is {{equity.overall}}, materially diluted from what the same hand would carry against a single villain, and equity realization is discounted further (multiway compounds positional disadvantage and reduces our freedom to bluff). The default mode is value-heavy and face up.

Fold equity collapses in the multiway shape because every opponent has to fold, not just one. The probability that everyone folds scales multiplicatively with the player count; the same bet that buys a 60% fold against one villain may buy only 25–35% against three. The plan computation already reflects this — the recommended action is {{plan.primary.action}} for {{plan.primary.sizingRationale}}, with the multiway fold-equity collapse and equity-realization discount baked into the EV math (not into a hardcoded multiplier).

Callers in this spot are typically preflop-capped — they'd have raised the strongest hands. Range/nut advantage is {{handContext.rangeAdvantage}} / {{handContext.nutAdvantage}}; the practical implication is that strong made hands belong in the value-bet pile, and marginal pairs that would happily float HU should generally fold multiway because the equity dilution stacks against us and we can't compensate with bluffs. As {{situation.multiwayHeroRole}}, we adapt: the leading player has range advantage to press value into the field; a caller behind the PFR has more reason to check and let the PFR define the betting line; a caller after the PFR has bet faces both range advantage stacked against them and a still-live opponent.

Sizing is {{plan.primary.sizing}} of the {{situation.pot}}bb pot — sized to charge multiple opponents for setting up draws when betting for value, sized smaller (or omitted) on bluff-light lines because cascading fold equity makes bluffing structurally unprofitable here.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Default branches: (1) bet for value with strong made hands that beat the field's value range. (2) bet for protection with vulnerable made hands on dynamic boards where multiway equity is most fragile. (3) check-fold most marginals — equity dilution + no compensating fold equity makes them losers multiway. (4) selective semi-bluffs only with strong draws (combo draws, open-ended + overcards) in spots where the field skews passive.
