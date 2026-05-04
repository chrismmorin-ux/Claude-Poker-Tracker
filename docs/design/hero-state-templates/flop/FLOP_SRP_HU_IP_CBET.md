---
archetypeId: FLOP_SRP_HU_IP_CBET
family: FLOP_SRP_HU_CBET
voiceNotes: |
  Hand-conditioned headline. Body emphasizes IP range advantage,
  texture-driven cbet sizing (small on dry/static, larger or check
  on dynamic/connected), and equity realization through position.
  Branches: villain calls (turn plan), villain raises (range read),
  villain folds (got the dead money).
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

**{{handContext.hand}} on {{handContext.boardTexture}} — IP cbet decision in a single-raised pot.**

## Body

We're IP in a single-raised pot with the preflop initiative. Range advantage is structural: we chose to put money in first, with a tighter, more concentrated range than villain's calling range. That advantage is most pronounced on textures we hit harder — A-high, K-high, paired low boards — and least on textures villain's flat range connects with (middling connected boards like T87, 988, 765).

Cbet sizing is texture-driven. Small ({{plan.primary.sizing}} on dry/static boards) gets thin value from villain's marginal made hands and folds the bottom of their range cheaply. Larger sizing on dynamic/wet boards charges draws and concentrates value-betting. Some textures favor a check (board favors villain; we don't have enough strong made hands to credibly value-bet a polarized range).

Position is the underrated edge. We close the action and see one more card before committing further; villain has to play OOP without the SPR or initiative. Even when our range advantage is marginal, the IP advantage compounds through the turn.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) called → turn plan depends on whether the turn card improves us, villain's likely call range, and SPR. (2) raised → tight range; villain raise here on most boards is value-heavy. (3) folded → we took the dead money; the cbet was correct ex-ante regardless of whether we had value.
