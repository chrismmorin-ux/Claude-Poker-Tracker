---
archetypeId: FLOP_MULTIWAY_3BP
family: FLOP_MULTIWAY
voiceNotes: |
  Multiway 3-bet (or 4-bet) pot — rare spot. Body emphasizes that 3BP
  callers are dramatically more capped than SRP callers (calling a
  3-bet implies a tight, premium-or-bust range, not a speculative
  one); SPR is lower so commitment math matters more; bluff frequency
  is structurally near-zero because cascading fold equity + tight
  capped ranges leave almost no folding-out leverage. Hero role
  descriptor distinguishes PFR (the 3-bettor) from a caller of the
  3-bet — both face tight live opponents.
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
  - situation.sprZone
  - equity.overall
  - equity.realization
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**{{handContext.hand}} multiway 3-bet pot on {{handContext.boardTexture}} — rare spot, value-only mode as {{situation.multiwayHeroRole}}.**

## Body

We're in a 3-bet (or 4-bet) pot with {{situation.playersRemaining}} players to the flop — a rare shape in live play, almost always indicating that callers in the 3BP came in with hands strong enough to call a re-raise. Their ranges are dramatically more capped than SRP-multiway callers; they'd have 4-bet (or 5-bet) the strongest hands, but everything else they continued with is narrowly value-heavy. Our overall equity is {{equity.overall}} against the field, and realization is depressed further by the multiway discount on a lower-SPR ({{situation.sprZone}}) pot.

Cascading fold equity is even worse here than in SRP-multiway because each caller's tight calling range folds less to a single bet — they paid a 3-bet to see the flop, they're not folding the same hands they'd fold in SRP. The probability that everyone folds is the product of small per-opponent fold rates; bluff frequency must be structurally near-zero. The recommended action is {{plan.primary.action}} for {{plan.primary.sizingRationale}}, with that constraint already baked into the EV math via the multiway fold-equity formula.

Range/nut advantage is {{handContext.rangeAdvantage}} / {{handContext.nutAdvantage}}; in a 3BP-multiway the picture is binary — either we have a strong made hand or a premium draw and we bet (or pot-control with marginal value), or we have a hand that doesn't beat the tight caller range and we check-fold cheaply. As {{situation.multiwayHeroRole}}, the PFR retains range-and-nut advantage but must respect that callers have premium-loaded ranges; a caller of the 3-bet has a structurally narrower range and should let the 3-bettor define the line on most textures.

Sizing is {{plan.primary.sizing}} of the {{situation.pot}}bb pot — lower SPR shifts commitment thresholds, so sizing tracks the boundary between "set-up stacks for value by river" and "keep options open if the texture turns dynamic."

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Default branches: (1) value bet hands that beat the tight caller range. (2) check-fold or pot-control everything weaker — bluffs are structurally unprofitable. (3) if the texture massively favors callers (low connected, ace-low when callers cap), check-give-up our entire range on the flop and decide on later streets. (4) if we face a raise multiway in a 3BP, the raising range is overwhelmingly value — fold all but the strongest made hands.
