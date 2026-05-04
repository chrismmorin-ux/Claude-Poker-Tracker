---
archetypeId: PF_VS_3BET
family: PREFLOP_VS_3BET
voiceNotes: |
  Hand-conditioned headline. Body emphasizes the capped opening
  range (no premiums slowplayed), MDF math, AJo+/TT+ defends as
  the structural anchor. Branches: call IP, 4bet for value, fold.
slotsUsed:
  - handContext.hand
  - handContext.handClass
  - situation.positionClass
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
  - equity.overall
---

## Headline

**{{handContext.hand}} from {{situation.positionClass}} — facing the 3bet.**

## Body

Our opening range is capped here. We didn't 4bet preflop, so the parts of our range that beat villain's 3bet for value (QQ+, AK) are the only profitable 4bet candidates. Everything else has to call profitably or fold.

The defense math is pot-odds-driven. Against a standard 3bet size we're getting ~2:1 on the call, which means hands that realize ~33% equity vs villain's 3bet range break even. Position and SPR shape that threshold: IP is more forgiving (we realize equity better), low SPR is less forgiving (we can't outplay them postflop). Our equity here is around {{equity.overall}}.

The defending range anchors on AJo+/TT+ and suited broadways — hands that flop top pair or better often enough to play a 3bet pot. Suited connectors are mostly folds vs aggressive 3bettors (we don't realize equity well in big pots OOP without initiative) but become reasonable defends IP vs a polarized 3bet range that has a lot of bluffs we beat when we connect.

4-bet range is tight and value-heavy: we don't have the bluffs because we'd have already 3bet them as initial bluffs. Premiums for value, occasional ace-blocker bluffs (suited Axs) when villain's 3bet range is wide enough that fold equity supports it.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) call IP — most defends; play a 3bet pot with the equity pot odds give us. (2) 4bet for value with QQ+/AK; mix in selected blocker bluffs vs wide 3bettors. (3) fold the dominated middle — offsuit broadways, weak pairs, suited connectors that don't realize equity in a 3bet pot.
