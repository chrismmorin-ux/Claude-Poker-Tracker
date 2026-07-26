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

---

## Part 2 — behavioural clustering (the founder's objection, tested)

> *"it is a little concerning that the labels don't encompass potential
> sub-behavior… It certainly feels like there are more styles of play when at a
> live table (observing trapping frequencies, bluff frequencies, aggression, limp
> raises, triple barrel bluff capable) but that all finds its way into a specific
> player's history."*

**The objection was correct and Part 1 over-claimed.** Part 1 clustered on six
stats — five preflop plus one c-bet frequency. Not one of the behaviours above was
in the feature set. So the real Part 1 finding is *"the stats we currently record
resolve two types"*, not *"the pool contains two types"*.

New pass: `mine-behavioral-features.py` extracts those behaviours **per player**
(the WS-262 miner computed several of them, but pooled only). 59,736 players, 10s.

### Finding 5 — the reads you most want are not individually estimable

Per-player denominators across all 59,736 corpus players:

| behaviour | median n | p90 | p99 | max |
|---|---|---|---|---|
| triple barrel | 0 | 2 | **9** | 80 |
| flop check-raise | 0 | 4 | **13** | 86 |
| river bet shown (bluff rate) | 0 | 3 | **10** | 51 |
| double barrel | 1 | 7 | 46 | 456 |
| donk flop | 3 | 18 | 63 | 425 |

**Even the 99th-percentile player offers under a dozen observations** of triple
barrelling, check-raising, or river bluffing. A per-villain rate for these is not
estimable at any realistic sample size — and that is a property of poker, not of
the mining.

This is the strongest argument yet for the founder's convergence idea. You cannot
learn *whether this villain triple-barrels*. You may be able to learn *whether
players like him do*. Archetype-level pooling is not a convenience here; for these
behaviours it is the only way to have an estimate at all.

### Finding 6 — behaviour splits the same way: two poles, not six

2,812 players cleared the (relaxed) minimums. Fitted on double-barrel, donk, WTSD,
fold-to-small, postflop AF.

| k | silhouette |
|---|---|
| **2** | **0.3128** |
| 3 | 0.1837 |
| 4 | 0.1946 |
| 6 | 0.1636 |
| 8 | 0.1466 |

Same signature as Part 1: k=2 wins by ~1.7×, no elbow. Independent feature set,
same conclusion.

| | cluster 0 (75.3%) | cluster 1 (24.7%) |
|---|---|---|
| double barrel | 17.0% | **28.7%** |
| triple barrel *(descr.)* | 22.4% | **30.8%** |
| donk flop | 11.4% | **20.5%** |
| WTSD | 18.9% | 23.5% |
| fold to small bet | **84.4%** | 62.4% |
| postflop AF | 2.69 | 2.34 |
| **river bet shown as air** *(descr.)* | 3.5% | **7.4%** |
| showdown slowplay *(descr.)* | 49.3% | 44.9% |

Cluster 1 barrels more, donks more, folds far less to small bets, and **bluffs the
river at twice the rate**. That is a genuine behavioural axis and it is not visible
in VPIP/PFR — so the behaviours the founder named *are* real and *do* separate
players. They simply separate them along **one** axis, not six.

**Interesting null: trapping does not separate.** Showdown slowplay is 49.3% vs
44.9% — essentially equal. In this pool, checking a strong flop is universal
behaviour rather than a player type.

### Known defect in this pass

`fold_big` is degenerate — 99.9% vs 99.5%, no variance, contributed nothing to the
fit. Cause: the denominator uses pot AFTER the bet is added rather than before, so
the "≥66% of pot" bucket actually captures overbets only, which are near-always
folded to. `fold_small` (84.4% vs 62.4%) is unaffected and is doing real work.
Fix before this feature is cited.

### What this changes about the plan

Nothing about direction, one thing about design. The archetype rung is *more*
justified, not less — it is the only route to an estimate for the rare-but-decisive
behaviours. But the group level should be built on **both** axes measured here
(preflop looseness × postflop aggression/bluffiness), which are separate: Part 1's
poles were 76.7/23.3 and Part 2's are 75.3/24.7, similar in size but fitted on
disjoint features. Whether they identify the *same* players is the next question,
and it needs `cluster-player-types.py` to persist member ids.

---

## Part 3 — do players change in steps, or drift?

> *"I am optimistically expecting to see little cliffs where one player sort of
> slides or drops into another bucket, probably based on skill/education level…
> I have to think that we will see a sharp change in particular behaviors."*

**Binding limitation, before any number.** The corpus spans **2009-07-01 to
2009-07-23 — twenty-three days**. Learning of the kind the hypothesis describes
happens over months. This tests whether changes are *sharp or gradual*, and can see
session-to-session mode switching. It **cannot** test the education arc.

Method: block each player's hands by calendar day (≥30 hands to count as a block,
≥5 blocks required). Dispersion = χ²/df against a single fixed rate — 1.0 means the
day-to-day variation is exactly what coin-flipping would produce. Shape chosen by
BIC among flat / linear drift / single step. ~1,976 players qualify.

### Finding 7 — 95% of players are stationary over 23 days

| | VPIP | PFR |
|---|---|---|
| players tested | 1,976 | 1,975 |
| **median dispersion** | **1.079** | **1.026** |
| non-stationary (p<0.01) | 6.1% | 5.1% |
| best shape = flat | **95.6%** | **96.0%** |
| best shape = drift | 3.3% | 3.3% |
| best shape = step | **1.1%** | 0.7% |
| step ≥5pp | 4.9% | 3.7% |
| median \|Δ\| among changers | **8.3pp** | 7.1pp |

**The cliffs are real but rare.** Only ~5–6% of players change detectably in three
weeks. Among those who do, the change is *large* — a median 8pp swing in VPIP is a
different player. But 95% are indistinguishable from a fixed rate plus noise.

And among changers, **drift beats step ~3:1** (3.3% vs 1.1%). Hold that ratio
loosely: with only 5–8 blocks, BIC has weak power to separate a mid-series step
from a ramp. What is solid is the flat-vs-changing split, not the shape breakdown.

### Finding 8 — this makes `DECAY_HALFLIFE = 50` look actively harmful

`decisionAccumulator.js` halves an observation's weight every 50 hands, so hands
older than ~150 carry under 13%. That is the right model for a player who changes.

**For the 95% who don't, it discards most of the evidence for nothing.** And it
compounds the starvation finding: the model's central weakness is cells too thin to
beat the population prior, and recency decay makes every cell thinner still. We are
paying an accuracy cost on the overwhelming majority of villains to track a minority
that a change-point detector could identify explicitly.

That is the founder's own intuition arriving somewhere he did not aim it: the
adaptation mechanism should be **detection, not decay**. Use a villain's full
history by default; watch for a break; reset when one fires.

### The next experiment, with a stated prediction

This is directly testable on the existing harness — `DECAY_HALFLIFE` is one
constant, and the backtest measures exactly the affected quantity.

**Prediction: raising the half-life (or disabling decay) improves overall
log-loss**, because the stationary majority dominates the decision count. If that
holds, the follow-up is a per-villain change-point detector rather than a global
constant.

Number to beat: **1.69% lift / 52.2% accuracy** over 10,147 held-out decisions.

### Reproduce

```bash
python scripts/backtest/mine-stationarity.py \
  --corpus-root C:/Users/chris/data/phh-dataset/data/handhq \
  --out out/stationarity.json --workers 12
```

---

## Part 4 — is a behaviour a SWITCH or a DIAL?

> *"I was referring to villains being in different stages of their poker
> lifecycle. I would expect that there are categories of things that if a player
> does, they do regularly, and if they don't, they almost never."*

A cross-sectional claim, distinct from Part 3: a behaviour like 3-bet bluffing is
governed by a latent binary "has this player acquired it" trait, so the population
should be **bimodal or zero-inflated**, not a smooth spread.

Parts 1–2 could not have detected this. Euclidean k-means on continuous rate
vectors reports a continuum unless clusters separate in the metric it optimises; a
set of binary latent traits is not what that method recovers. Testing it needs a
mixture model on **counts** — and it must use counts, never rates, because a player
with 8 opportunities and 0 successes is perfectly consistent with a 10% true rate.
Rate histograms manufacture fake zero-inflation.

Three models per behaviour, compared by BIC:

| model | meaning | params |
|---|---|---|
| single binomial | one rate for everyone | 1 |
| **beta-binomial** | a **DIAL** — continuum of personal rates | 2 |
| **2-component mixture** | a **SWITCH** — two discrete classes | 3 |

### Finding 9 — they are dials, not switches

| behaviour | n players | pooled | winner | BIC margin |
|---|---|---|---|---|
| threeBet | 10,555 | 3.9% | dial | 1644 |
| cbet | 2,814 | 58.5% | dial | 1020 |
| donk_flop | 7,657 | 14.6% | dial | 815 |
| double_barrel | 3,613 | 18.5% | dial | 69 |
| foldToCbet | 1,345 | 54.8% | dial | 55 |
| limp_raise | 13,926 | 0.9% | dial | 25 |
| river_bet_air | 3,285 | 5.7% | dial | 8 |
| check_raise_flop | 1,191 | 2.3% | dial | 7 |
| **triple_barrel** | 1,361 | 24.1% | *mixture* | **2** |

**Eight of nine are dials, decisively.** Triple-barrel nominally picks the switch
model, but by a BIC margin of **2** — below the threshold worth more than a bare
mention. Treat it as a tie, not a win.

So the literal hypothesis — two discrete classes — is **not supported**.

### Finding 10 — but the "almost never" group is real for two behaviours

The model comparison is not the whole story. Excess zeros — players with zero
occurrences versus the number a single pooled rate predicts:

| behaviour | players at zero | expected | **excess** |
|---|---|---|---|
| **donk_flop** | 638 | 249 | **2.56×** |
| **threeBet** | 1,440 | 671 | **2.15×** |
| double_barrel | 131 | 91 | 1.44× |
| triple_barrel | 169 | 135 | 1.25× |
| check_raise_flop | 868 | 843 | 1.03× |
| limp_raise | 11,461 | 11,163 | 1.03× |
| river_bet_air | 2,172 | 2,127 | 1.02× |

**For 3-betting and donk-betting there genuinely is a "never does this" population**
— more than double the zeros chance allows. The intuition is right; the mechanism is
a heavily zero-skewed *continuum* rather than a discrete class.

That distinction is not pedantic, it is the design: you do **not** need a latent
class variable. You need a prior with real mass near zero — which a Beta prior
provides and a fixed population rate does not. `STAT_PRIORS` is already a Beta
family, so the engine has the right shape; whether its fitted parameters match
these is a direct, checkable follow-up.

### Finding 11 — which spots are actually worth modelling per villain

> *"it should feed our frequencies and which spots are most important to
> study/model."*

The beta-binomial concentration answers this directly. Low concentration = players
genuinely differ = a per-villain read pays. High concentration = everyone is alike =
use the population number and spend the modelling effort elsewhere.

Ranked by spread relative to the base rate:

| behaviour | pooled | across-player SD | per-villain read |
|---|---|---|---|
| limp_raise | 0.9% | 1.0pp | **HIGH** |
| check_raise_flop | 2.3% | 1.7pp | **HIGH** |
| donk_flop | 14.6% | 9.1pp | medium |
| river_bet_air (bluff rate) | 5.7% | 3.4pp | medium |
| threeBet | 3.9% | 2.0pp | medium |
| triple_barrel | 24.1% | 8.1pp | low |
| double_barrel | 18.5% | 5.1pp | low |
| cbet | 58.5% | 11.1pp | low |
| foldToCbet | 54.8% | 8.3pp | low |

**C-betting and folding-to-c-bet are the two stats the engine leans on hardest, and
they are the two where players differ least.** Everyone c-bets around 58%. Tracking
it per villain buys little; it is close to a constant.

Meanwhile limp-raising and flop check-raising carry the most individual signal
relative to their base rate — and Finding 5 showed they are also the least
observable. **The most diagnostic behaviours are the rarest.** That tension, not the
switch-vs-dial question, is the real constraint on villain modelling, and it is
another argument for pooling reads at an archetype level rather than per player.

---

## Part 5 — CORRECTION: most of these features are intent-blind

> *"Triple barrel bluff and triple barrel are not the same, of course a value
> player can intuitively triple barrel a good hand. And I bet there are a lot of
> these small distinctions."* — founder, 2026-07-26

Correct, and it invalidates the interpretation of most of Part 2 and Part 4.

`triple_barrel` as implemented is "bet river, having bet turn, having c-bet flop".
That is **every competent player betting a good hand three times**. It measures an
ACTION; the read a live player wants is an INTENT. Conflating them is why Finding
11 scored triple-barrel as *low* individual variation — near-universal value
barrelling drowns whatever bluff signal exists.

This is the same error class as WS-278 (protection vs value vs bluff): **a bet's
motivation is not recoverable from the bet alone.**

### Audit — which features are intent-blind

| feature | conflates | status |
|---|---|---|
| `triple_barrel` | value barrel vs bluff barrel | ✗ **blind** |
| `double_barrel` | value barrel vs bluff barrel | ✗ **blind** |
| `check_raise_flop` | nutted check-raise vs bluff check-raise | ✗ **blind** |
| `donk_flop` | value lead vs probe/bluff lead | ✗ **blind** |
| `limp_raise` | trapping AA vs light limp-raise | ✗ **blind** |
| `cbet` | value c-bet vs bluff c-bet vs **protection** (WS-278) | ✗ **blind** |
| `threeBet` | value 3-bet vs 3-bet **bluff** — the founder's own example | ✗ **blind** |
| `river_bet_air` | — uses showdown cards to identify air | ✓ intent-aware |
| `foldToCbet` | — a fold is a fold | ✓ intent-free by nature |
| `wtsd` | — reaching showdown is unambiguous | ✓ intent-free by nature |

**Seven of ten are blind.** Every headline "aggression" number in Parts 2 and 4 is
an action-frequency, not a strategic read. They are not wrong, but they answer a
question nobody asked at the table.

### The hard limit on fixing it

Intent is recoverable only from **shown** cards, and that sample is severely
censored in a direction that matters:

**A bluff that works is never shown.** The opponent folds and the hand is mucked.
So showdown-derived bluff rates measure *caught* bluffs — bluffs that got called.
A player who bluffs often and successfully looks, in this data, like a player who
rarely bluffs.

That is not a mining defect to be engineered away; it is what the medium permits.
Three consequences, all binding:

1. Any intent-split feature must be labelled as the conditional it is —
   *"air-shown rate GIVEN called and shown"*, never "bluff frequency".
2. Level comparisons across players are unsafe (different call rates against them
   produce different censoring). Rank comparisons are *probably* safer, unverified.
3. `river_bet_air` (Part 2, 3.5% vs 7.4% between clusters) already carries this
   caveat and should be read as caught-bluff rate. The 2× difference is real; its
   absolute level is not.

### What to build instead

Intent-split versions of the blind features, computed only over shown hands:

```
triple_barrel_shown_air   / triple_barrel_shown      "caught triple-barrel bluff"
check_raise_shown_air     / check_raise_shown        "caught check-raise bluff"
donk_shown_air            / donk_shown
cbet_shown_air            / cbet_shown
```

plus their value counterparts, so the SPLIT is visible rather than the total. The
denominators will be small — Finding 5 already showed these behaviours are rare per
player, and requiring a showdown shrinks them further. Expect these to be
pool-level or archetype-level statistics, not per-villain reads. That is not a
failure of the method; it is the same conclusion Finding 5 reached, arrived at from
a second direction.

**Status: flagged, not fixed.** Parts 2 and 4 stand as action-frequency findings.
Their *interpretation* as strategic reads does not, and the ranking in Finding 11
must be re-derived once the intent splits exist.

---

## Part 6 — the intent splits, measured

`mine-intent-splits.py`. Every aggressive action classified against the board **as
it stood on the acting street** (a flop c-bet with a flush draw that rivers the
flush is a flop semi-bluff, not flop value), and only where the player showed.

> **CENSORING, BINDING.** A bluff that works is never shown. These are **caught**-
> bluff rates and understate true bluffing, probably severely. Level comparisons
> across players are unsafe. Read the *composition*, not the absolute bluff rate.

### Finding 12 — a triple barrel is a value bet

| action | n shown | air (bluff) | draw (semi) | pair | strong (value) |
|---|---|---|---|---|---|
| c-bet flop | 43,294 | 14.9% | 16.0% | **52.2%** | 16.9% |
| barrel turn | 71,154 | 4.1% | 24.2% | 31.7% | 40.0% |
| **barrel river** | 60,047 | **6.1%** | 0.0% | 27.7% | **66.3%** |
| check-raise flop | 9,784 | 5.7% | 16.0% | 41.6% | 36.7% |
| donk flop | 43,019 | 9.5% | 21.3% | **50.6%** | 18.6% |

**The founder's objection, quantified: two thirds of shown river barrels are made
with two pair or better, and 6% with air.** Part 2's `triple_barrel` feature —
24.1% pooled, scored as a behavioural trait — was overwhelmingly measuring *value
betting*. "Triple-barrel capable" and "triple barrels" are different populations,
and we were counting the second while reasoning about the first.

(River `draw` is 0.0% by construction — there are no draws on the river. The
classifier collapses them to air, correctly.)

### Finding 13 — WS-278's ambiguous category is the MODAL case

**52.2% of shown flop c-bets, and 50.6% of donk bets, are made with exactly one
pair** — precisely the holding WS-278 identified as ambiguous between thin value
and protection/equity denial.

Half of all c-betting sits in the category the taxonomy was incomplete about. WS-278
was filed as a correctness fix for a missing motive; this measures the size of the
hole it closed. Any rule that classifies c-bets as value-or-bluff is mis-filing
about half of them, and the c-bet is the single most common postflop action.

That also re-frames Finding 11. `cbet` scored *low* individual variation (58.5%
pooled, 11.1pp across-player SD) — but that was the intent-blind total. The
composition may vary far more between players than the frequency does. Two villains
both c-betting 58% can be doing completely different things, and the total cannot
see it.

### Finding 14 — intent reads are not per-villain, confirmed a third time

Shown observations available **per player**:

| action | players with ≥1 | ≥10 | **≥30** | max |
|---|---|---|---|---|
| c-bet flop | 17,490 | 624 | 38 | 105 |
| barrel turn | 27,377 | 863 | 33 | 85 |
| barrel river | 25,106 | 549 | **12** | 49 |
| donk flop | 21,733 | 249 | 4 | 43 |
| **check-raise flop** | 7,137 | **10** | **1** | 30 |

**Exactly one player out of 59,700 has 30+ shown flop check-raises.** The best-
observed player in the entire corpus has 49 shown river barrels. A per-villain
bluff-rate read is not thin — it does not exist.

This is now the **third independent route** to the same conclusion (Finding 5 from
raw frequency, Finding 11 from across-player variance, this from showdown
availability). Intent-split statistics must live at the **pool or archetype level**.
Three methods agreeing is reasonable evidence it is a property of poker rather than
an artefact of any one of them.

### What this changes

1. **Finding 11's ranking is superseded for the aggressive actions.** It ranked
   intent-blind totals. The re-derivation needs composition, and composition is only
   available pooled — which is itself the answer to "what should I model per
   villain": *not these*.
2. **The archetype rung gains its clearest justification yet.** Bluff composition is
   exactly the read that cannot be learned per player but might be learnable per
   type.
3. **WS-278's fix should be checked against Finding 13.** If `isProtectionMotivated`
   fires on materially fewer than ~half of one-pair c-bets on wet boards, it is
   under-triggering.

---

## Part 7 — do leaks travel together? (and are lines missing entirely?)

Two claims from the founder, 2026-07-26. They came out differently.

### Finding 15 — CONFIRMED: players are missing whole lines

> *"some players may be missing whole lines entirely (board texture and full bet
> line, check bet shove, donk bet bet, check check donk, etc)"*

7,594 players with ≥30 postflop actions. Mean lines used: **7.76 of 10**.

| line | share of players who EVER use it |
|---|---|
| flop donk / turn probe | 99.7% |
| river probe | 98.2% |
| flop c-bet | 96.5% |
| flop check-call | 94.1% |
| turn barrel | 89.3% |
| river barrel | 76.5% |
| flop check-raise | 64.5% |
| turn check-raise | 43.0% |
| **river check-raise** | **14.1%** |

**86% of players never check-raise a river. 57% never check-raise a turn.** The
claim is correct and the gradient is steep — line absence is real, and it
concentrates in exactly the aggressive, high-skill lines.

This has immediate table value, and it runs in the useful direction: a villain who
has *never* check-raised a river tells you little (most haven't). A villain who
*does* is instantly in the top 14%. **Presence is informative; absence is not.**
That is a cheap, robust read available from a small sample — the opposite of the
frequency estimates that need hundreds of hands.

### Finding 16 — NOT SUPPORTED: leaks do not visibly travel together

> *"if a player has not learned this... then we probably see a whole host of other
> sizing mistakes... we can jump the statistical gate because we know how they are
> correlated"*

Spearman correlations across 564 players clearing every minimum:

| | sizing spread | line cov | dbl barrel | donk | wtsd | fold small |
|---|---|---|---|---|---|---|
| **sizing_spread** | 1.000 | −0.064 | −0.072 | 0.001 | 0.010 | −0.027 |
| line_coverage | | 1.000 | 0.102 | −0.098 | 0.096 | −0.126 |
| double_barrel | | | 1.000 | 0.071 | 0.135 | −0.072 |
| donk_flop | | | | 1.000 | −0.090 | 0.054 |

**3-bet sizing adjustment correlates with nothing** — every |ρ| ≤ 0.07. PCA's first
factor explains **26.7%** of covariance against ~14.3% for pure independence, and
most of that excess comes from one pair.

The only strong relationship, `fold_small` ↔ `postflop_af` at **0.627**, is
**mechanical, not behavioural**: AF is aggression divided by calls, and a player who
folds more to small bets calls less, shrinking the denominator. Same for
`wtsd` ↔ `postflop_af` at −0.283. Neither is evidence of a skill factor.

**No dominant sophistication axis is visible in these measures.**

### Why this is "not supported" rather than "refuted"

Three reasons the null is weak, in descending order of seriousness:

1. **Range restriction, and it is severe.** Requiring every metric's minimum
   simultaneously cut 59,700 players to **564** — the highest-volume players in the
   corpus, who are disproportionately regulars. If a sophistication axis separates
   regs from recreationals, testing only inside the reg population is exactly where
   it would be invisible. This alone could produce the null.
2. **Regression dilution.** Every per-player rate is noisy, and noise attenuates
   correlation. Observed values are a lower bound on true ones.
3. **The sizing metric is crude.** `sizing_spread` is |blinds − non-blinds| 3-bet
   ratio, which merges late position into "non-blinds" and discards sign. The
   founder's hypothesis distinguishes late position *and* blinds; this test does not.

**What would settle it:** relax the joint-minimum requirement (test each metric pair
on its own qualifying population rather than the intersection), split position
properly into early/late/blinds, and use shrunk per-player estimates instead of raw
rates. Until then the gate-jumping strategy is unproven, not disproven — and it
remains the highest-value hypothesis outstanding, because it is the only proposed
route around the starvation wall that Findings 5, 11 and 14 all ran into.

---

## Part 8 — nesting, bluff share by line, and what one rare act licenses

22,003 players with ≥30 postflop actions. Q3 uses the **whole** population with no
intersection filter — the range-restriction flaw that weakened Finding 16 is gone.

### Finding 17 — YES, it is the same folks (nesting confirmed)

> *"did we look at if this is same folks who are check raising the turn are the
> same ones daring enough to check raise the river?"*

| | base rate | given flop CR | given turn CR | given river CR |
|---|---|---|---|---|
| flop check-raise | 42.9% | — | 78.4% | 60.4% |
| turn check-raise | 26.3% | 35.8% | — | **41.5%** |
| river check-raise | 8.2% | 10.9% | **13.0%** | — |

P(turn CR | river CR) = 41.5% against a 26.3% base — **1.58×**. P(river CR | turn CR)
= 13.0% against 8.2% — **1.59×**. The lines are genuinely nested.

Not a strict hierarchy though: 58.5% of river check-raisers never check-raised a
turn. It is a strong tendency, not a ladder.

### Finding 18 — bluff share collapses street by street, and the river is pure value

> *"you again are missing BLUFFS... 86% never check raised the river. So how much
> of those were bluffs?"*

Correct again — Part 7 counted actions. The split, over shown hands:

| line | shown | air | **bluff share** |
|---|---|---|---|
| flop donk | 43,019 | 3,859 | **9.0%** |
| flop check-raise | 9,784 | 526 | 5.4% |
| turn barrel | 23,229 | 1,076 | 4.6% |
| turn probe | 47,925 | 1,561 | 3.3% |
| turn check-raise | 5,448 | 92 | 1.7% |
| river barrel | 14,639 | 141 | 1.0% |
| river probe | 45,408 | 294 | 0.6% |
| **river check-raise** | **1,526** | **0** | **0.0%** |

**Zero of 1,526 shown river check-raises held air. Not one.**

And the gradient is monotone within every line family independently — check-raise
5.4 → 1.7 → 0.0, barrel 4.6 → 1.0, probe 3.3 → 0.6. **Bluffing collapses as streets
advance**, three separate families agreeing.

This corroborates WS-262's river findings (called big river bets: 76–83% two-pair+,
≤7% air) by a different route, and lands *more* extreme.

**The table read is unusually clean: in this pool, a river check-raise is value.
Always.** Rare (14% of players ever), and when it happens it is not a bluff. That is
a stronger read than any frequency estimate in this entire study, and it needs a
sample of exactly one.

*Censoring caveat still binds — a bluff that works is never shown, and a caught
bluffer may muck rather than show. True bluff share is above zero. But 0/1,526 puts
a hard ceiling on how far above.*

### Finding 19 — the gate does NOT jump sideways to unrelated behaviour

> *"what does that one act say is statistically likely about them across the board?
> how confident can we classify their archetype and immediately adjust in seemingly
> unrelated way on different board textures streets and positions"*

Lift = E[Y | ever did X] / E[Y | never did X]:

| marker | target | lift | p |
|---|---|---|---|
| flop check-raise | donk_flop | **0.77×** | 3e-44 |
| turn check-raise | donk_flop | 0.82× | 8e-24 |
| river check-raise | limp_raise | 1.16× | 4e-10 |
| river check-raise | double_barrel | 1.07× | 5e-03 |
| river check-raise | wtsd | 1.06× | 4e-12 |
| any check-raise | **river_bet_air** | 0.82–0.88× | **n.s.** |

**Nearly every lift sits between 0.8× and 1.2×.** The microscopic p-values are an
artefact of n in the thousands, not evidence of a useful effect — at these sample
sizes a 3% difference is "highly significant" and practically worthless.

The largest real effect, check-raisers donking **23% less**, is a strategic
*substitution* (they check-raise instead of leading), not a skill factor. And most
telling: **observing a check-raise says nothing at all about the player's river
bluffing** — not significant for any marker.

**This is now a much stronger null than Finding 16.** That test was crippled by
range restriction; this one uses 22,003 players with no intersection filter and
still finds nothing. The gate-jumping hypothesis, as stated — one caught act
licensing adjustment on *seemingly unrelated* streets and textures — is **not
supported by the data**.

### What DOES transfer, and it is worth having

Inference works **within a skill family, not across families**:

- **Sideways within aggression: yes.** A river check-raiser is 1.6× more likely to
  check-raise turns. Rare-line usage predicts other rare-line usage.
- **Across to unrelated frequencies: no.** ~1.0× on everything.

So the usable rule is narrower than hoped but real: *a villain who shows you one
bold line is more likely to hold the rest of the bold lines* — and that is exactly
the inference the starvation wall blocked, since bold lines are the ones you can
never observe enough of directly. It does not license adjusting their fold-to-c-bet
or their showdown tendencies.
