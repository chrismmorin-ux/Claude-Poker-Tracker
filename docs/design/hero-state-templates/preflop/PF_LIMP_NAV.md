---
archetypeId: PF_LIMP_NAV
family: PREFLOP_LIMP_NAV
voiceNotes: |
  Hand-conditioned headline. Body emphasizes iso-raise sizing
  (charge the dead money + isolate to HU IP), pot-bloating risk
  with marginal hands, multiway equity-realization deficit.
  Branches: iso-raise, overlimp (rare), fold most marginals.
slotsUsed:
  - handContext.hand
  - handContext.handClass
  - situation.positionClass
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**{{handContext.hand}} from {{situation.positionClass}} — navigating the limped pot.**

## Body

Limpers ahead change the math from a standard open. The dead money in the pot supports a wider iso-raise range, but the multiway risk if we don't take it down preflop also penalizes marginal hands more — equity realization in a 3+ way pot is significantly worse than HU. The iso-raise size is bigger than a standard open ({{plan.primary.sizing}}) — {{plan.primary.sizingRationale}} — both to charge the limpers for set-mining and to raise the bar for them to defend wide.

Our iso-raise range biases toward hands that play HU postflop: suited Axs and broadways (good HU equity, dominate the limpers' loose ranges), pocket pairs (set-mining + showdown value), and selected suited connectors (playability + nut potential). Hands we'd open as standard RFI without limpers (offsuit broadways, weak suited connectors) get tighter here because the multiway risk if the limpers call elastically isn't worth the dead-money premium.

Overlimping is rare. The cases that justify it: small pocket pairs and suited connectors with implied odds in deep multiway pots, when we're confident the field won't get isolated by a player behind us. Most of the time the choice is iso-raise or fold — overlimping concedes too much initiative.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) iso-raise with hands that play HU well; charge the limpers, raise the bar, take initiative. (2) overlimp narrow (small pairs/suited connectors) when implied odds and field passivity support it. (3) fold the marginals that look playable in a vacuum but lose EV multiway without dead-money compensation.
