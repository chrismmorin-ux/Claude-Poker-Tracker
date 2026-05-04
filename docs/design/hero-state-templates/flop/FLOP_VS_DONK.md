---
archetypeId: FLOP_VS_DONK
family: FLOP_VS_DONK
voiceNotes: |
  Hand-conditioned headline. Body emphasizes that donk leads
  break HU CBET dynamics — villain seizes initiative OOP, which
  signals either a board-shift hand or a passive player's
  protection bet. Read population (passive donk = protection;
  aggressive donk = polarized). Branches: call (passive donk =
  thin value to bluff-catch), raise (passive donk + we have
  equity), fold (no read or aggressive donk + bottom).
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

**{{handContext.hand}} on {{handContext.boardTexture}} — facing the donk lead.**

## Body

A donk lead breaks the standard HU CBET flow. Villain has chosen to bet OOP into the preflop raiser — that's structurally suboptimal in a typical balanced strategy, which means we're getting information about their range. Two distinct populations donk:

Passive players donk for protection — they have a marginal made hand (top pair weak kicker, second pair, weak overpair) and don't trust the cbet to come. Their donk range is showdown-heavy, has very few bluffs, and folds to raises with the bluffs they do have. Against this population, we raise for value with strong hands and call to bluff-catch with marginal pairs; rarely bluff-raise because the donker's range is uncapped enough to call.

Aggressive players donk polarized — they have a board-shift hand (paired board, low-card monotone they hit) or a wide bluff range. Against this population, our continuing range is tighter and more value-weighted; we fold the bluff-catchers we'd defend vs a passive donk.

Sizing on the {{plan.primary.action}} is {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) call — bluff-catcher vs passive donk; weak-pair-or-better with showdown value. (2) raise — strong made hand vs passive donk for thin value; selected semi-bluffs with blocker equity. (3) fold — range bottom; aggressive donk + no value/draw means accept the spot loss.
