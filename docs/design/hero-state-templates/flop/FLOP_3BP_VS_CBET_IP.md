---
archetypeId: FLOP_3BP_VS_CBET_IP
family: FLOP_3BP_HU_VS_CBET
voiceNotes: |
  Hand-conditioned headline. Body emphasizes the defensive math
  facing a 3bp cbet IP — wider defense width than OOP because of
  position, but tighter than SRP because villain's 3bet range is
  concentrated. Low SPR rewards aggressive raising. Branches:
  call IP (defend with showdown value), raise (commit on stack-off
  threshold), fold (range bottom).
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
  - handContext.handStrength
  - situation.sprZone
  - equity.overall
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**{{handContext.hand}} on {{handContext.boardTexture}} — IP vs cbet in a 3-bet pot.**

## Body

We're IP facing villain's cbet in a 3-bet pot. Villain's 3bet range is concentrated — they have a polarized value/bluff structure with fewer middle-equity hands than in a SRP — so our equity here ({{equity.overall}}) is bimodal: hands that beat their value combos beat them clean; hands that don't have draws or overcards are crushed.

Position helps. We close the action on this street, can take a free turn card with marginal pairs, and have the option to raise for stack-off when the SPR works. The {{situation.sprZone}} SPR is a critical lever — at low SPR, raising commits us, so any raise has to be a value-or-stack-off play; at higher SPR, we can flat more marginals.

Defense range here is mostly call: marginal pairs that beat bluffs, strong draws with overcard equity. Raises are reserved for committed-value spots (sets, two pair on disconnected boards) and selected semi-bluffs that have blocker effects + draw equity. Fold the range bottom on textures villain's value hits hardest.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) call IP — showdown value, draws, marginal pairs; position lets us realize equity. (2) raise — value-heavy or committed semi-bluff; raising in a low-SPR 3bp signals stack-off. (3) fold — range bottom on textures villain's 3bet value hits.
