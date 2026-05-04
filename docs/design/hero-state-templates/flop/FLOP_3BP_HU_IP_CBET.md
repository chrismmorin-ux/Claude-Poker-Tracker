---
archetypeId: FLOP_3BP_HU_IP_CBET
family: FLOP_3BP_HU_CBET
voiceNotes: |
  Hand-conditioned headline. Body emphasizes 3bet pot range advantage
  (tighter starting ranges, more polarized villain), small sizings
  for high-equity overpairs and broadway-heavy textures, lower SPR
  changing the cbet calculus. Branches: called (turn plan tighter),
  raised (very tight range), folded (initiative wins).
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
  - handContext.handStrength
  - handContext.rangeAdvantage
  - situation.sprZone
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**{{handContext.hand}} on {{handContext.boardTexture}} — IP cbet in a 3-bet pot.**

## Body

We're IP in a 3-bet pot with the preflop initiative. Both ranges are tighter and more concentrated than in a SRP — our 3bet range, villain's 3bet calling range. Range advantage is more pronounced on broadway-heavy and A-high textures (premiums dominate); less so on middle-connected textures villain's calling range hits (suited connectors, small pairs).

SPR matters more here. We're at {{situation.sprZone}}, which constrains the depth of postflop play — at low SPR, we're often committing on the turn or river, so the cbet has to anticipate stack-off conditions. Small cbet sizings ({{plan.primary.sizing}}) work well: we get value from villain's continuing range cheaply, deny equity to draws, and preserve fold equity for turn barrels.

The cbet frequency is high — close to a range bet on textures we own — because (a) villain's calling range is narrow and our equity is concentrated, (b) the SPR rewards taking initiative, and (c) villain has fewer floats than in a SRP. On textures we don't own (low-connected boards, paired middle), check more.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) called → turn plan is tighter (villain's range now contains the pairs and combo draws that called); barrel concentrated value, check-back marginal made hands. (2) raised → very tight range; villain's flop raise in a 3bp IP is heavily value-weighted. (3) folded → initiative wins the pot; the polarized 3bet structure gets paid in fold equity.
