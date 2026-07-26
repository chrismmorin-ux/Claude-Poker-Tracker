# Are the player archetypes real? — k-means on the HandHQ pool

Date: 2026-07-26 · Ticket: WS-273 follow-on · Program: `domain-correctness`
Script: `scripts/backtest/cluster-player-types.py` · Data: `out/player-clusters.json`

> **CAVEAT, BINDING.** HandHQ online cash, July 2009, numeric stakes (SRC-011).
> 1,390 players with ≥200 preflop hands and all six canonical stats, drawn from
> 1.07M hands of 50NL. **Live 1/2 generalisation is an assumption, not a result** —
> and archetype composition is exactly the kind of thing that differs between a
> 2009 online pool and a live 1/2 game.
>
> `Reg` is folded into `TAG` throughout: the miner does not compute aggression
> factor, which is the only thing `classifyStyle` uses to separate them.

## The question

Founder, 2026-07-26: *"did we just use our existing player archetypes or did we do
any sort of k clustering to see if there are predominant types in the data?"*

Answer at the time: **existing archetypes only, and no clustering anywhere in the
repo.** `tendencyCalculations.classifyStyle` partitions villains with six
hand-authored thresholds, and that label selects `STYLE_PRIORS`, which seed the
villain decision model. The thresholds were authored, never derived.

This matters beyond tidiness. The WS-273 ablation showed the model is
**data-starved**: conditioning on a dimension splits a villain's history into cells
too thin to beat the population prior. Archetype is a conditioning dimension too.
If the authored buckets cut along the wrong seams they impose that cost while
delivering less separation than a derived partition would.

## Result 1 — the pool has TWO poles, not six types

| k | inertia | silhouette |
|---|---|---|
| **2** | 6040 | **0.3428** |
| 3 | 5153 | 0.1906 |
| 4 | 4610 | 0.1966 |
| 5 | 4195 | 0.1814 |
| 6 | 3805 | 0.1747 |
| 8 | 3328 | 0.1794 |
| 10 | 3102 | 0.1696 |

Silhouette is **twice as good at k=2** as at any other k, and inertia falls
smoothly with no elbow. That is the signature of a **continuum with one dominant
axis**, not a set of discrete types. Six natural archetypes are not in this data.

| cluster | share | vpip | pfr | 3bet | foldTo3Bet | cbet | foldToCbet |
|---|---|---|---|---|---|---|---|
| 0 — tight / foldy | 76.7% | 19.9% | 12.3% | 3.6% | 85.4% | 57.0% | 57.6% |
| 1 — loose / sticky | 23.3% | 40.5% | 19.6% | 5.8% | 66.4% | 56.7% | 49.2% |

The separating axis is **looseness and stickiness together** — the loose cluster
also folds far less to 3-bets (66% vs 85%) and to c-bets (49% vs 58%). Note c-bet
frequency is nearly identical across both (57% vs 57%): **how often someone c-bets
carries almost no type information in this pool.** What separates players is how
much they enter with and how hard they are to move off a hand.

## Result 2 — "what is a Fish, in the data?"

**The authored `Fish` threshold sits in the middle of the natural group, not around it.**

`classifyStyle` calls `vpip > 40` a Fish. The loose cluster's centroid VPIP is
**40.5%** — the threshold cuts straight through the densest part of the group it is
meant to isolate.

The damage shows in the cross-tab:

| authored label | share of pool | where it lands |
|---|---|---|
| TAG | 53.8% | **spans both clusters** — 63% of cluster 0 AND 22% of cluster 1 |
| Unknown | 21.1% | falls through all six buckets entirely |
| Nit | 10.7% | cluster 0 |
| Fish | 10.3% | cluster 1, but only **44%** of it |
| LAG | 3.2% | cluster 1 |
| LP | 0.9% | cluster 0 |

Cluster purity is **0.63** and **0.44**. If the authored archetypes were the natural
partition, purity would be high. Instead:

- **The natural loose group is shattered across four labels** — Fish 44%, TAG 22%,
  Unknown 20%, LAG 14%. Four different `STYLE_PRIORS` are being applied to players
  the data says behave alike.
- **TAG is not a type, it is a catch-all.** It is 54% of the pool and spans both
  clusters.
- **21% of players are `Unknown`** — one in five gets no style prior at all.

So: there is no discrete "Fish" in this data. There is a loose-sticky pole, and the
VPIP>40 line clips its densest region.

## What this implies — the founder's convergence idea

Founder, same session:

> *"what we might be missing is the directional convergence of a particular
> villain… we might go from playing against a pool where each player emerges, to
> playing against a pool where each player gets sucked into their archetype the
> more they display that archetype."*

That is **hierarchical Bayesian shrinkage with a learned group level**, and it is
the right response to the starvation finding. Today the fallback ladder ends at the
whole population:

```
villain's exact spot  →  broader spots  →  ENTIRE POOL prior   (log-loss 0.909, worst predictor)
```

The proposal inserts the missing rung:

```
villain's exact spot  →  broader spots  →  villain's TYPE  →  entire pool
```

A thin cell would then fall back to "how do players like this one behave here",
which should beat the global prior substantially — and the global prior is where
**1,716 of 10,147 scored decisions (17%)** currently land.

Three design constraints this study puts on that work:

1. **Do not use the six authored archetypes as the group level.** They are not the
   natural partition; using them would inherit the shattering above. Use the
   empirical structure — at minimum the two poles, better a continuous position on
   the loose-sticky axis.
2. **Membership must be soft and evidence-weighted**, which is exactly what
   "sucked into their archetype the more they display it" describes. Hard
   thresholds are what produce the 21% `Unknown` and the TAG catch-all. A player at
   VPIP 39.8% and one at 40.2% are currently in different worlds.
3. **It is directly testable.** The WS-273 harness already measures exactly this —
   add an archetype rung to the hierarchy and the ablation machinery scores whether
   it beats falling straight to the pool. The number to beat is the current
   baseline: **1.69% lift, 52.2% accuracy** over 10,147 held-out decisions.

## Reproduce

```bash
python scripts/backtest/cluster-player-types.py \
  --corpus-root C:/Users/chris/data/phh-dataset/data/handhq \
  --miner-path  C:/Users/chris/data/phh-mining \
  --min-hands 200 --out out/player-clusters.json
```

k-means++ with a fixed seed (a clustering that moves between runs cannot be cited);
sklearn is not a dependency, the algorithm is implemented in the script.
