---
archetypeId: RIVER_SRP_BET_IP
family: RIVER_SRP_BET
voiceNotes: |
  Hand-conditioned headline. Body frames the river value-bet as a sizing-region
  choice (block / half / 2-3rd / overbet) keyed on hand class and villain's
  bluff-catching threshold. IP advantage already played out — the bet here is
  collecting value missed bluffs would have folded; thin value + polarized bluff
  composition. Branches: villain folds (capture), villain calls (value spot,
  beware polarized raise), villain raises (rare, value-heavy + blocker bluffs).
slotsUsed:
  - handContext.hand
  - handContext.boardTexture
  - handContext.handClass
  - handContext.handStrength
  - equity.overall
  - equity.vsRangeParts.vsValue
  - equity.vsRangeParts.vsAir
  - plan.primary.action
  - plan.primary.sizing
  - plan.primary.sizingRationale
  - plan.branches[*].trigger
  - plan.branches[*].rationale
---

## Headline

**{{handContext.hand}} on {{handContext.boardTexture}} — value-betting river IP in a single-raised pot.**

## Body

The river is a sizing-region decision. Our equity is {{equity.overall}} ({{equity.vsRangeParts.vsValue}} vs villain's value-and-bluff-catch region, {{equity.vsRangeParts.vsAir}} vs the air that folds), and that distribution tells us how thin we can bet and which sizing band villain's range pays at. {{plan.primary.action}} {{plan.primary.sizing}} — {{plan.primary.sizingRationale}}.

A {{handContext.handStrength}} of our class wants the size that villain's worst calling combos still call — a {{handContext.handClass}} typically chooses the middle sizing band where villain's marginal pairs and weak top-pair will hero-call, while stronger value picks the larger size to charge villain's two-pair and better. Range advantage from preflop is already realized; bluff frequency at this node is governed by which blocker combos we hold — we bluff the hands that unblock villain's folds (no top-pair blockers, blocks villain's straights/flushes) and check back the air that blocks the folds we want.

Position lets us see villain's response before committing further. If we get raised, the line is heavily polarized — villain rarely raises bluffs on the river in position because there's no future street to barrel, so a raise compresses their range to value + select blocker bluffs.

## Branch summary

{{plan.branches[*].trigger}} → {{plan.branches[*].rationale}}.

Three responses: (1) villain folds — we captured the bluff-catching mass that would have check-folded; thin value collected. (2) villain calls — value spot confirmed; the marginal calls in their range are exactly what our sizing band targets. (3) villain raises — fold our thin value and our bluffs; call only with hands that beat villain's two-pair+ region (which means we usually went too thin to be doing this — review hand class for the bet).
