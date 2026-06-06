---
archetypeId: FLOP_MULTIWAY_LIMPED
family: FLOP_MULTIWAY
voiceNotes: |
  Multiway limped pot — no preflop raise at all. Live-poker realistic
  shape. Body emphasizes the distinguishing feature: limp ranges are
  wide and capped at the high end (premiums usually open) but
  un-capped at the low end (any random suited/connected/pair). No
  preflop info to lean on for range narrowing. Bluff frequency is
  near-zero because limp callers chase everything; value sizing skews
  larger to charge multiple draws. Hero is always 'LIMPER' (no PFR
  exists in a limped pot).
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

**{{handContext.hand}} multiway limped pot on {{handContext.boardTexture}} — wide capped ranges, no preflop info.**

## Body

We're in a limped pot with {{situation.playersRemaining}} players to the flop — no preflop raise at all, so no one signaled strength. Limp ranges in live low-stakes play are wide at the bottom (any random suited connector, baby pair, suited ace) and capped at the top (premiums usually open). The practical implication: we have very little preflop information to narrow the field with, and the pot is small relative to stacks. Our overall equity is {{equity.overall}} against the field, with the standard multiway realization discount applied on top.

Cascading fold equity is unusually weak in limped pots because limp-callers have proven they like to see flops cheaply — they don't fold easily to a single bet, and even less so to one bet against multiple opponents. The probability that everyone folds is the product of low per-opponent fold rates; bluffing is structurally unprofitable here. The recommended action is {{plan.primary.action}} for {{plan.primary.sizingRationale}}, sized to capture value rather than to fold out the field.

Range/nut advantage is {{handContext.rangeAdvantage}} / {{handContext.nutAdvantage}} — typically neutral or slightly hero-favorable because limp callers can't have the strongest preflop hands. As {{situation.multiwayHeroRole}} (no PFR in this pot shape — everyone limped), we bet for value with hands that beat the wide capped limp-call ranges (top pair good kicker or better; overpairs; combo draws), and we check-fold most marginals. The pot is small enough that giving up cheap is rarely catastrophic.

Sizing is {{plan.primary.sizing}} of the {{situation.pot}}bb pot — value-sizing typically skews larger multiway to charge multiple opponents who are chasing draws and weak pairs. We should rarely bet small (block-sizing) here because limp-callers don't fold to small bets and don't pay off large for marginal hands.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Default branches: (1) value bet (often larger than HU) with strong made hands and premium draws. (2) check most of the rest — implied odds for our weak hands are good in a low-SPR limp pot, and we don't want to inflate a pot we don't want to play. (3) if the field is unusually passive, semi-bluffs with combo draws + overcards pick up rare folds. (4) raised behind = capped-into-tight signal in a limped pot; usually one of the limpers had a slowplayed monster — fold marginals, continue with strong hands only.
