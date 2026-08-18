# Does the "average villain" ruleset describe individual villains?

**Measured 2026-08-18.** 246,890 hands, 22,471 distinct villains, 400 stratified corpus
files (HandHQ 50NL, online, 2009). Artifact: *Nine Players, Five Villains*.

## The question

The engine prices opponents against a single pooled population — `NO_RAISE_FREQUENCIES`,
`FACED_RAISE_FREQUENCIES`, `FOUR_BET_FREQUENCIES`, and the R0–R4 rule ladder all state
one rate per decision context. The founder's question: how well does that correlate with
*individual* villains, and if poorly, is it because multiple villain types are interacting
at a 9-handed table?

## The instrument, and why the control is the whole design

A tail always exists. Any pool shows spread around its own mean, so exhibiting spread
proves nothing — the failure mode recorded in
`feedback_test_archetype_before_building_channel`.

Each rule is therefore tested against a **permutation null**: pool every decision in that
rule's conditioning set, reshuffle, redeal to synthetic villains with the *identical*
n-profile, recompute dispersion (χ²/df). 200 reshuffles per rule. That is what one
population genuinely looks like at these exact sample sizes.

**The control returned 1.00 on every rule**, which is the value it must produce if it is
working. Anything above is real dispersion.

Per-villain stats are computed with `buildPlayerStats` from
`src/utils/tendencyCalculations.js` — the application's own extractor — so the definitions
match the shipped engine rather than a parallel reimplementation.

**Prerequisite verified first:** corpus player IDs are stable across hands. 4,073 distinct
IDs over 28,699 hands, max 1,087 hands for one player. Under per-hand salting the falsifier
predicted ~172,194 distinct IDs; it failed decisively.

## Result

| Rule | Villains | Pool | Within ±5pp | χ²/df | Ctrl p95 | Types (BIC) | ΔBIC vs one |
|---|---|---|---|---|---|---|---|
| Enters the pot (VPIP) | 10,454 | 22.6% | 31% | **12.76** | 1.03 | 5 | 88,807 |
| Folds facing any preflop raise | 4,186 | 85.6% | 33% | **6.72** | 1.04 | 5 | 13,414 |
| Raises preflop (PFR) | 10,454 | 11.5% | 53% | **4.83** | 1.02 | 5 | 22,953 |
| C-bets as preflop aggressor | 338 | 57.7% | 30% | **3.59** | 1.13 | 4 | 480 |
| Folds to a c-bet | 83 | 53.2% | 30% | **2.57** | 1.27 | 2 | 44 |
| Folds to a 3-bet — opener | 399 | 51.0% | 17% | **2.06** | 1.12 | 2 | 142 |
| 3-bets facing a raise | 4,186 | 3.9% | 92% | **1.93** | 1.04 | 4 | 1,020 |
| **Folds to a 3-bet — cold** | 442 | 96.7% | 32% | **1.22** | 1.13 | **1** | — |

Type counts are EM mixtures of binomial rates selected by BIC. `C = 1` is the current
model — one average villain.

**VPIP's five types:** 10.4% @ 12% of villains · 18.0% @ 29% · 27.1% @ 30% · 42.9% @ 24% ·
65.0% @ 5%.

## Findings

1. **The founder's hypothesis is supported.** Seven of eight rules select more than one
   villain type, and dispersion runs to 12.8× what sampling noise permits. A single pooled
   rate is not a description of any individual villain on those rules.

2. **The exception is the mechanism.** `fold to a 3-bet — cold` is the only rule where a
   single population beats every mixture on BIC, with 96% of villains inside ±10pp. Facing
   an open *and* a re-raise having invested nothing voluntarily, everyone folds ~96.7%.
   That is a **forced** decision. Every rule involving a genuine choice fragments.

   This is also the strongest evidence the heterogeneity elsewhere is not instrument
   noise: the same pipeline, players, and estimator find one population exactly where
   theory predicts one.

   Stated exactly — cold is **not** perfectly homogeneous (1.22× vs control p95 1.13). A
   small real residual survives. Its significance is its size against 1.9×–12.8× elsewhere.

3. **Worst-fitting rule is the one shipped today.** `fold to a 3-bet — opener` has only
   **17%** of villains within ±5pp of its claimed rate — the lowest compliance in the set,
   on the conditioning set introduced by WS-521. The role split was necessary but is not
   sufficient: the opener population is itself two types (29.1% @ 25%, 58.1% @ 75%).

## Limits — stated, not buried

- **Population.** Online 50NL 2009 vs the founder's live 9-handed 1/2–1/3. Every figure is
  *transferred, not measured* (`DISCLAIMER-AND-FAULT-REGISTER` §1). The *heterogeneity
  finding* is likely to transfer; the specific rates must not be quoted for a live table.
- **Type counts are model selection, not a census.** BIC choosing five components means
  five binomial rates fit better than four — not that five kinds of human exist. The robust
  claim is "materially more than one".
- **Pool rates are volume-selected.** Only villains meeting the minimum-n bar enter each
  rule; high-volume players are not a random draw. This is why opener-fold reads 51.0% here
  against 43.0% corpus-wide.
- **±5pp is an absolute band.** At a 3.9% base rate almost everyone falls inside it by
  arithmetic (3-bet scores 92% compliance while dispersing at 1.9×). Where median n per
  villain is small the band is finer than the data's resolution — at n=14 an observed rate
  moves in 7-point steps. **The dispersion ratio is the honest column.**
- **Interaction is untested.** Multiple types are shown to *exist*. That they *interact* —
  that one player's type shifts another's decision at the same table — is a further claim
  this instrument does not measure.

## What this does not yet resolve

No Result Card was emitted. Under ADR-009 the comparative claim "a mixture model describes
villains better than the pooled model" needs one before it can be cited as an EV claim.
This document reports a measurement and its control; it does not yet claim an EV delta.
