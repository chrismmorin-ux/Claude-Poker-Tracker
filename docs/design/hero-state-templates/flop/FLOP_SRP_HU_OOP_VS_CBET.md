---
archetypeId: FLOP_SRP_HU_OOP_VS_CBET
family: FLOP_SRP_HU_VS_CBET
voiceNotes: |
  Hand-conditioned headline. Body emphasizes OOP defense penalty
  (worse equity realization), tighter calling range, and the
  importance of check-raising as a balanced-defense tool.
  Branches: call (showdown value or strong draw), check-raise
  (polarized), fold (most marginals OOP).
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

**{{handContext.hand}} on {{handContext.boardTexture}} — OOP vs cbet in a single-raised pot.**

## Body

We're OOP facing villain's cbet in a single-raised pot. Defense width is narrower than IP because equity realization OOP is meaningfully worse — marginal floats that work IP get crushed OOP when villain barrels turn and we have to fold or call out of position with no read on river action.

The calling range is showdown-value-heavy: pairs that beat villain's bluffs, strong draws (open-ended + flush draw combos), gutshots only when paired with overcards. Floats without made-hand or draw equity are folds — we won't realize the equity OOP, and we don't have the position edge to bluff turns profitably.

Check-raising is the OOP balance tool. By introducing a check-raise range, we deny villain a free run at our checking range and concentrate fold equity in spots they're cbetting wide (textures we own + textures villain bets light). The check-raise range is polarized: strong made hands (sets, two pair) and selected semi-bluffs (combo draws with overcard equity).

Sizing for the {{plan.primary.action}} is {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) call — showdown value or strong draw with realistic turn potential. (2) check-raise — polarized; strong made hands + combo draws on board-favored textures. (3) fold — most marginals; OOP equity-realization deficit means we can't profitably defend the same width as IP.
