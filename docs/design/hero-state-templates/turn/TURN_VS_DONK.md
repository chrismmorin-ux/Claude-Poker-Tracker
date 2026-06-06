---
archetypeId: TURN_VS_DONK
family: TURN_VS_DONK
voiceNotes: |
  Structurally framed headline. Body: hero (the prior-street aggressor) faces a
  turn donk lead. Donk leads on the turn often signal a hand that just improved
  (two pair, completed straight/flush) or a draw setting its own price;
  classify the donk before responding. Read-dependent — references the
  adjustments layer conceptually but stays presentation-only. Branches: raise
  (value/strong vs a merged donk), call (bluff-catch + position), fold (air).
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
  - handContext.handStrength
  - equity.overall
  - equity.vsRangeParts.vsValue
  - equity.vsRangeParts.vsDraw
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**Facing a turn donk lead on {{handContext.boardTexture}} — read the lead before you respond.**

## Body

We were the aggressor on the previous street and villain leads into us on the turn — a donk. The first job is to classify the lead, because turn donks are not one thing. Frequently the turn card just changed villain's hand: a card that completes a straight or flush, or pairs the board, turns a passive caller into someone who suddenly leads with two pair, a made draw, or a hand that wants to set its own price rather than face our barrel.

Weigh our equity against the two halves of that range separately: {{equity.vsRangeParts.vsValue}} against the value the card brought in, {{equity.vsRangeParts.vsDraw}} against the draws still leading for price. Our overall equity is around {{equity.overall}}. A {{handContext.handStrength}} that beats the value the turn completed can raise; one that only beats draws should keep the pot small. {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}.

Against a villain whose donk range is merged and weak, we lean toward raising for value and denying equity; against one who only leads when the turn smacked them, we respect it and shift toward calling and folding.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) raise — value that beats the part of the board the turn completed, plus denial against a merged/weak donk range. (2) call — bluff-catchers and our own draws, using position to realize and to see the river cheaply. (3) fold — air with no equity against a lead that credibly improved.
