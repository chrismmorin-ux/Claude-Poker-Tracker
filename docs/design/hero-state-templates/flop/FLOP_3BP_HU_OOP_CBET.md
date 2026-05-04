---
archetypeId: FLOP_3BP_HU_OOP_CBET
family: FLOP_3BP_HU_CBET
voiceNotes: |
  Hand-conditioned headline. Mirrors §5.2 worked example (99 on
  782r). Body emphasizes 3bet pot range AND nut advantage on dry
  low boards, small sizings for value + protection, and the
  uncapped-villain-range edge case (when villain just calls 3bet
  with sets and overpairs). Branches: called, raised (tight),
  folded.
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
  - handContext.handStrength
  - handContext.rangeAdvantage
  - handContext.nutAdvantage
  - equity.vsRangeParts.vsValue
  - equity.vsRangeParts.vsBluff
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**{{handContext.hand}} on {{handContext.boardTexture}} — OOP cbet in a 3-bet pot.**

## Body

We're OOP in a 3-bet pot with both range and nut advantage on the right textures (dry low boards, paired boards villain doesn't have, A-high). Villain's 3bet calling range skips most of the unpaired bottom-of-deck combos — A8/A7/A2-type holdings — so on boards like {{handContext.boardTexture}} our overpairs and sets dominate their continuing range.

Equity decomposition matters: we're winning vs broadway floats (~{{equity.vsRangeParts.vsBluff}} vs villain bluffs/floats) but dominated by their value (~{{equity.vsRangeParts.vsValue}} vs sets and bigger overpairs). The cbet plan is small ({{plan.primary.sizing}}) for {{plan.primary.sizingRationale}} — small sizing extracts thin value from broadways, denies equity to backdoor draws, and keeps villain's bluff-raise frequency in check.

The uncapped-villain-range case: when villain's 3bet call could include sets and overpairs (some opponents flat strong hands to disguise), be more conservative with bluff frequency and avoid barreling for value on Q/J/T turns where their range now beats us.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) called → villain's range now has pairs and suited broadways with backdoors; barrel turn on equity-shifters (any A/K/Q on a low board), check-call low blanks. (2) raised → villain's flop raise OOP-vs-IP-cbettor is tight (sets, bigger overpairs, occasional combo-draw bluffs); fold to nits, call once vs bluffy villain. (3) folded → got the dead money in initiative-favored 3bp.
