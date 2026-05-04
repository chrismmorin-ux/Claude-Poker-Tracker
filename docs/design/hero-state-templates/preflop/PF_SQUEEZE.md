---
archetypeId: PF_SQUEEZE
family: PREFLOP_3BET
voiceNotes: |
  Hand-conditioned headline. Body emphasizes wider squeeze range
  (caller-heavy fields), bigger sizing for dead money, and the
  isolation goal (push to HU 3bp, not multiway 3bp). Branches:
  opener calls (HU 3bp), called multiway (rare/careful), opener
  4bets (fold mostly).
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

**{{handContext.hand}} {{situation.positionClass}} — squeeze the open + caller(s).**

## Body

We're squeezing into a multiway pot. The dead money in the pot from the opener and caller(s) widens our profitable squeezing range — there's more EV in the steal — but it also raises the sizing bar. Standard squeeze sizing is {{plan.primary.sizing}}, larger than a normal 3bet, because (a) the dead money makes a smaller bet under-charge for set-mining and (b) we want to fold the caller out — a multiway 3bet pot with us OOP or sandwiched is the worst possible outcome.

Range construction is more polarized than a normal 3bet — wider on the bluff side (the dead money supports more aggression) and value-heavy on top. Hands like suited Axs and low suited connectors get more weight as squeeze bluffs because they have blocker equity vs the opener's 4bet range and play passably on postflop SPR if called.

The goal is isolation — pushing into a HU 3bet pot vs the opener with initiative. If we get called multiway, we're playing a 3bet pot OOP or sandwiched with a marginal range; that's a structural disaster we accept rarely with the strongest part of our squeeze range.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three outcomes: (1) opener calls, caller(s) fold → HU 3bp with initiative (the goal). (2) called multiway → tighten postflop dramatically; play face-up value, no bluffs. (3) opener 4bets → fold most squeezes (we don't have the equity vs a 4bet range from the original raiser when they know we squeezed wide).
