---
archetypeId: FLOP_SRP_HU_OOP_CBET
family: FLOP_SRP_HU_CBET
voiceNotes: |
  Hand-conditioned headline. Body emphasizes OOP cbet pressure
  (we lose IP advantage), more checking range than IP, smaller
  sizings to manage risk OOP. Branches: villain calls IP (we
  navigate turn OOP), villain raises (concentrated range), villain
  folds (dead-money win).
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
  - handContext.handStrength
  - handContext.rangeAdvantage
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**{{handContext.hand}} on {{handContext.boardTexture}} — OOP cbet decision in a single-raised pot.**

## Body

We're OOP in a single-raised pot with the preflop initiative. Range advantage is the same as IP, but we've lost the position edge and gained the disadvantage of having to act first across the turn and river. Equity realization OOP is meaningfully worse — we can't cheaply check back marginal made hands, and villain controls the size of the pot when they want to.

The cbet range is more selective than IP. We check more often: marginal made hands that don't want to bloat the pot OOP, hands that want to bluff-catch rather than barrel. When we do bet, sizing skews smaller on dry/static boards (don't commit OOP without strong equity) and is more polarized on dynamic boards (value-bet/raise lines combined with selected turn-barrel bluffs that have natural follow-ups).

Sizing is {{plan.primary.sizing}} for {{plan.primary.sizingRationale}}. Texture and SPR govern the choice. Lower SPR allows for tighter, more concentrated value; higher SPR favors checking more and avoiding building a pot OOP without a clear plan.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) called → we navigate the turn OOP without initiative-by-default; check more, fold to barrels without showdown value. (2) raised → tighter range than IP raises; villain's flop raise OOP signals strength or a polarized line. (3) folded → dead-money win; the cbet captured fold equity even though we'd have preferred IP.
