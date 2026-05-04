---
archetypeId: FLOP_3BP_VS_CBET_OOP
family: FLOP_3BP_HU_VS_CBET
voiceNotes: |
  Hand-conditioned headline. Body emphasizes the OOP penalty
  compounded by 3bp polarization — the worst flop spot in NLHE.
  Tightest defense range; check-raise as polarized OOP balance
  tool; quick folds with no showdown value. Branches: call
  (only with strong made hands or premium draws), check-raise
  (polarized stack-off), fold (most range).
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

**{{handContext.hand}} on {{handContext.boardTexture}} — OOP vs cbet in a 3-bet pot.**

## Body

This is one of the most punishing spots in NLHE. We're OOP facing a cbet in a 3-bet pot — villain has the initiative, position, AND a more concentrated/polarized range than in a SRP. Our equity realization is at its worst: we can't outplay villain on later streets, can't extract from marginal made hands, and don't have the SPR depth to absorb misreads.

Defense range is tight. We continue with: strong made hands (sets, two pair, overpairs that beat villain's polarized continuing range), and premium draws (combo draws, OESD + overcards) that have realistic stack-off equity. Marginal pairs that would float IP get folded here — we won't realize the equity OOP, and check-call lines lose to villain's barrel frequency.

Check-raising is the polarized balance tool. By introducing a check-raise range, we punish villain for cbetting wide and prevent free turn cards. The check-raise range is value-heavy with selected combo-draw semi-bluffs that have stack-off potential at the {{situation.sprZone}} SPR.

Most of our range folds. Don't fight the structural disadvantage — accept the equity loss and look for spots in the rest of the hand.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) call — strong made hands or premium draws only; the OOP penalty makes wider defense unprofitable. (2) check-raise — polarized; strong value + combo-draw semi-bluffs with stack-off equity. (3) fold — most range; the 3bp + OOP combination is the worst possible postflop spot, accept the spot loss.
