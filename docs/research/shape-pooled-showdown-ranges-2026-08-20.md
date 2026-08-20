# Behavioural shape does not predict shown range — a pre-registered null

**2026-08-20. Pre-registered before any number was computed. Both predictions failed.**

## The idea under test

Showdown cards are the scarcest observable in poker — a handful per player. If behavioural
*shape* predicts the range a player shows up with, then players with near-identical shapes could
have their showdown cards **pooled**, turning a handful per player into thousands per cluster.
That would supply the hand-strength coordinate the behaviour policy has never had.

## Pre-registration

| | Claim | Predicted | Falsifier |
|---|---|---|---|
| **A6** | a player's shape-cluster range predicts his own held-out showdown cards better than the global prior | **≥5%** relative log-loss reduction | ≤0 |
| **A7** | it survives leave-one-out | effect persists | works only with him included = leakage |

**Conditioning set:** *"The player was the last preflop aggressor, was facing no bet at his first
flop decision, and bet the flop; the hand ran to a five-card board and his two hole cards were
revealed."*

## Result

| | made-hand tier (6 cat) | board-relative bucket (5 cat) |
|---|---|---|
| baseline log-loss (global, LOO) | 1.66436 | 1.34339 |
| treatment (own cluster, LOO) | 1.66195 | 1.34114 |
| **relative reduction** | **0.145%** [0.051, 0.237] | **0.167%** [0.065, 0.277] |
| MDE @80% | 0.132% | 0.156% |
| **random-cluster control** | **−0.069%** [−0.098, −0.034], perm p = 0.0033 | −0.06% |
| no-LOO (leakage) arm | 0.280% | 0.303% |

**Predicted ≥5%. Observed 0.145%.** Not underpowered — MDE is 0.13%, so a 5% effect would have
landed ~38 bootstrap SDs out. n = 16,066 showdowns, 1,740 players, full 1,756-file corpus.

The shuffled-cluster control came in **negative** — random clusters actively hurt. So the 0.145%
is a *genuine* shape effect, reproducible and distinguishable from the shuffle at p = 0.003. It is
also worth 0.15% of a 1.66-nat baseline, which is nothing.

## Why — and this is the part worth keeping

**The shape side did not fail.** Every axis cleared the 1.30 admission bar by a wide margin:

| axis | χ²/df |
|---|---|
| VPIP | **37.25** |
| PFR | 20.00 |
| OpenRaise% | 17.73 |
| FoldToOpen | 13.13 |
| AggFreqFlop | 5.74 |
| WTSD | 2.00 |

Clusters are real — k=8 centroids span VPIP 0.138 → 0.494, FoldToOpen 0.902 → 0.567. Shape
separates *hard*.

**The target side is where it dies.** Overdispersion of the shown holding, conditional on the
line, against a 50-shuffle permutation null:

| set | observed χ²/df | null median / 95th |
|---|---|---|
| line, ≥5 showdowns/player | **1.0213** | 1.0039 / 1.0256 |

**The observed value sits inside the null.** Conditional on a fixed line, players do not detectably
differ in what they show up with.

**The oracle ceiling settles it.** Replace the cluster with the player's *own* history
(leave-one-hand-out) — the thing pooling exists to approximate:

| set | relative reduction |
|---|---|
| line, ≥10 showdowns | **−4.92%** |
| line, ≥30 showdowns | **−2.99%** |
| any reveal, ≥200 showdowns | **−0.31%** |

**Every one is negative.** Knowing exactly who the player is, with 200+ of his own showdowns,
does *worse* than the pooled prior. There is nothing at the player level for a cluster to recover.
Showdown-weighted KL(cluster‖global) = 0.005 nats against a 1.66-nat baseline — a structural
ceiling near 0.3% reachable only with infinite data.

## Selection, stated plainly

Reach-showdown rate varies by cluster (**23.36% → 27.21%**), as does reveal rate (18.25% →
22.24%). So the pooled range *is* conditioned differently per cluster and the comparison is not
strictly like-for-like. The clusters differ measurably in **how often they get to showdown** and
still do not differ in **what they show**.

## What this licenses, narrowly

- **Players differ in frequencies, not in range composition** — at least in this population,
  conditional on the line. Shape predicts what a player *does*, not what he *has*.
- Therefore a per-player range model is not merely hard to estimate; **there is no per-player
  range signal to estimate.** A villain model needs per-player *frequencies* plus one *shared*
  range model conditional on the line.
- It agrees with the one other place this corpus has been asked a related question. The villain
  studied in WS-548 had an ordinary 3-bet rate (4.6% vs 4.7%) alongside a large fold-rate
  deviation, with the entire departure sitting in the call *frequency* (6.6% vs 20.8%). Two
  observations pointing the same way is a direction, not a law — recorded as agreement, not as
  replication.

## What this does NOT license

- It does **not** say players are identical. VPIP alone is 37× overdispersed.
- It is measured on **online 2009 50NLH**, a comparatively homogeneous population of regulars and
  recreational players running similar strategies. The founder's game is **live 9-handed 1/2–1/3**,
  where the spread of player types is plausibly much wider. Carrying this null to the live game is
  **transferred, not measured**, and the transfer is the least safe part of it — a null found in a
  homogeneous pool is exactly the result most likely to reverse in a heterogeneous one.
- The conditioning set is one line. Other lines are `unexamined`.

## Falsifier for the null itself

Re-run the same design on a population with wider type dispersion — live capture, or a mixed-stake
corpus slice. If between-player target overdispersion clears the permutation null there, the null is
population-specific rather than structural, and the pooling idea returns intact.
