---
archetypeId: TURN_SRP_VS_BARREL_IP
family: TURN_SRP_VS_BARREL
voiceNotes: |
  Hand-conditioned headline. Body covers facing the second barrel IP in a
  single-raised pot: MDF/pot-odds defense width, why position lets us continue
  wider, and selective raising. Branches: call (defend wide, realize IP), raise
  (polarized value + blockers), fold (no-equity bottom).
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

**{{handContext.hand}} on {{handContext.boardTexture}} — facing a turn barrel IP in a single-raised pot.**

## Body

We called the flop and villain barrels the turn; we're IP. Pot odds plus MDF set our defense width — against a small barrel we owe fewer folds, against a large one more — and defending tighter than MDF lets villain over-barrel us profitably. Our equity vs villain's barrel range is around {{equity.overall}}; the value portion sits at {{equity.vsRangeParts.vsValue}}, which tells us how much of our continuing range is bluff-catching versus ahead.

Position widens our continue. We can call with {{handContext.handStrength}}, marginal pairs, and draws that get a cheap, in-position river — hands that wouldn't realize equity OOP take a card here and stab when villain gives up. {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}.

Raise selectively and polarized: concentrated value (sets, two pair, strong draws with equity to back the line) plus the occasional bluff-raise with blockers on runouts where our range advantage supports fold equity. Fold the bottom — no pair, no draw, no realistic river improvement.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) call IP — defend to MDF with pairs, draws, floats; position lets us realize and steal rivers. (2) raise — polarized: value plus blocker bluff-raises on board-favored runouts. (3) fold — the no-equity bottom of our flop-call range.
