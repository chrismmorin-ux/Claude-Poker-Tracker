---
archetypeId: PF_VS_OPEN_SB
family: PREFLOP_VS_OPEN
voiceNotes: |
  Structurally framed (hand-class-agnostic at the headline level)
  per §5.3 worked example. Body emphasizes the SB OOP penalty +
  sandwich problem + 3bet-rather-than-flat default. Branches:
  3bet polarized, set-mine, fold most marginals.
slotsUsed:
  - handContext.hand
  - situation.actionContext
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**SB vs the open — tighten + 3bet polarize.**

## Body

The SB is the worst seat for flatting. We're sandwiched between the opener (preflop initiative) and a live BB (closes the action with pot odds), and we'll be OOP postflop against the opener with a marginal range. Equity realization OOP without initiative is the worst combination of conditions in NLHE.

The default response is 3-bet rather than flat. By 3-betting, we deny the BB their cheap equity-realization look at the flop, take the initiative, and turn our positional disadvantage into a fold-equity advantage preflop. Sizing is bigger from the SB — {{plan.primary.sizing}} — to charge the BB for setting up multiway and to frontload value from the opener's continuing range.

The 3-bet range is polarized: the top (premiums for value), and selected blocker bluffs (suited Axs and low suited connectors that play well as set-mines or get to felt small pairs without dominating regret). Hands that don't fit either category — middle suited connectors, weak suited broadways — are folds rather than flats.

Small pairs are the one frequent flat: implied odds when we hit a set are excellent, the multiway risk is contained when we just call, and they don't 3-bet well as bluffs.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Default is 3-bet. Set-mine flats are a narrow exception (small pairs only). Almost everything else folds.
