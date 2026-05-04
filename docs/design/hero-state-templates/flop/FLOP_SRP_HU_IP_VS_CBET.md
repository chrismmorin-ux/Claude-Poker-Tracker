---
archetypeId: FLOP_SRP_HU_IP_VS_CBET
family: FLOP_SRP_HU_VS_CBET
voiceNotes: |
  Hand-conditioned headline. Body emphasizes IP defense width,
  pot odds + MDF math against typical cbet sizes, and the floats
  that work better with position. Branches: call (defend wide),
  raise (concentrated value), fold (range bottom on textures
  villain owns).
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

**{{handContext.hand}} on {{handContext.boardTexture}} — IP vs cbet in a single-raised pot.**

## Body

We're IP facing villain's cbet in a single-raised pot. The pot-odds math + MDF math gives us a defense width: against a small cbet (~33% pot) we owe ~25% folds; against a half-pot bet ~33% folds; against a pot-sized bet ~50%. Defending wider than MDF leaks chips on the call; defending tighter leaves us exploitable to over-cbetting.

Position lets us float more profitably. Marginal pairs and gutshot draws get to see a turn card cheaply; we can call with hands that wouldn't realize equity OOP and pick up pots when villain checks turn. Our equity vs villain's cbet range is around {{equity.overall}}.

Raise selectively. Raising flop OOP-or-IP signals strength (we cap our bluff range here vs decent regs) — most flop raises are value-heavy or strong semi-bluffs (combo draws, sets, two-pair). Marginal floats stay floats; bluff-raises are reserved for textures where our range advantage and blocker effects support fold equity.

Fold the bottom of the range — hands without showdown value, no draw, no realistic turn improvement, on textures villain's range hits.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) call IP — defend wide with floats, gutshots, marginal pairs; position lets us realize equity. (2) raise — concentrated value (sets, two pair, combo draws); selective bluff-raises with blockers on board-favored textures. (3) fold — range bottom on textures we don't own.
