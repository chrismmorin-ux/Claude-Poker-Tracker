# Engine backtest baseline — villain action prediction (WS-273)

Date: 2026-07-26 · Status: **harness shipped; first calibration run is a SMOKE baseline, not the full corpus number**
Sprint: SPR-154 · Program: `domain-correctness` · Ticket: WS-273

> **CAVEAT, BINDING, REPEATED AT EVERY NUMBER BELOW.** Every figure in this
> document comes from the HandHQ corpus: **online cash only, July 2009, numeric
> stakes** (SRC-011). It measures whether the engine predicts *that* population.
> **Live 1/2 generalisation is an assumption, not a result.** Nothing here is
> evidence about the founder's actual game until the predictionAudit readback
> accumulates live hands.

## Why this exists

The founder asked (2026-07-25) how to anchor a measurable strategy, offering
bankroll as the yardstick. Bankroll is the right ultimate goal and the wrong
instrument: a live winrate needs six figures of hands to separate from variance.

The fast anchor is **prediction calibration** — at every villain decision point,
the engine emits a predicted action distribution *before* the action is revealed,
and that prediction is scored against what the villain actually did. Seven other
queue items (WS-272/274/275/277/279) have "measure it via WS-273" in their
acceptance criteria. This is what makes them measurable instead of arguable.

## What shipped

| Piece | Location |
|---|---|
| Deterministic player partition (JS + Python mirror) | `scripts/backtest/partition.{mjs,py}` |
| PHH → app-hand adapter | `scripts/backtest/phhAdapter.mjs` |
| Executable leakage guard | `scripts/backtest/leakageGuard.mjs` |
| Walk-forward runner | `scripts/backtest/runner.mjs` |
| Hierarchy A/B variants | `scripts/backtest/hierarchyVariants.mjs` |
| Fold-vs-bet EV bridge | `scripts/backtest/evCost.mjs` |
| Shared scoring core | `src/utils/exploitEngine/calibrationMetrics.js` |
| POOL-partition miner | `scripts/backtest/mine-pool-reference.py` |
| CLI | `scripts/backtest/run.mjs` |

The harness runs the **actual production engine modules** through Vite's SSR
loader (`scripts/backtest/loader.mjs`). A reimplementation would score a
different model and the number would be worthless.

## Two corrections to the ticket, both founder-approved 2026-07-26

### 1. The split strategy

The ticket defaulted to splitting "by player." That is the wrong test for this
engine: the villain decision model is *personalised per player*, so holding out
a player's own hands leaves nothing to personalise from and could only ever
measure the generic population guess — not the product.

Approved instead: **two-level split**.

```
POOL players  ──trains──>  backtest-only Reference table
EVAL players  ──scored──>  never contributed to those priors
                └─ within each EVAL player: walk forward in time
                   train hands [0, cp)  →  predict [cp, cp+10)  →  advance
```

### 2. The leakage gate was unsatisfiable as written

`src/utils/exploitEngine/handhqReferencePool.js` (SRC-011) was mined from **all
12.9M corpus hands**. So the ticket's own acceptance criterion — "no hand used
for prior fitting may appear in the scored set" — could not be met against the
corpus by any split, because every corpus hand already trained the shipped
priors.

Approved fix: re-mine a **train-only reference table** from POOL players
(`mine-pool-reference.py`). The shipped table is untouched and is never modified
by any of this.

The guard is **executable, not prose**. `run.mjs` refuses to start without an
explicit `--reference` decision; an unstamped table is rejected on the assumption
that it is the corpus-wide one. 19 adversarial tests in
`scripts/__tests__/leakageGuard.test.js` each feed it a run that IS leaking and
assert refusal.

## Baseline results — SMOKE RUN

**Scope of this run, stated up front:** 60 files from FTP 50NL only, 51,793 hands
read, 66 eval players, **1,076 scored decisions**. This is a mechanism
demonstration at ~1k decisions, not the full-corpus baseline. Reference tier was
**disabled** (`--reference none`) because the POOL table has not been mined yet —
see *Not yet done*. Runtime 37s.

```
node scripts/backtest/run.mjs --reference none \
  --corpus-root <corpus> --max-players 150 --max-hands-per-player 250
```

### Overall — HandHQ online cash, July 2009, numeric stakes; live generalisation unproven

| Metric | Model | Population prior |
|---|---|---|
| log-loss | 0.7871 | 0.8105 |
| Brier | 0.2309 | 0.2414 |
| accuracy | 54.2% | 42.4% |
| **lift** | **+2.9%** | — |

Calibration is good: bucket errors 0.001–0.096, with the largest error in the
60–80% band (says 64.4%, happens 54.8% — mild overconfidence when the model is
most sure).

### Finding 1 — the fallback ladder is load-bearing

*HandHQ online cash, July 2009; live generalisation unproven.*

| Variant | log-loss | lift vs prior |
|---|---|---|
| `shipped` | 0.7871 | **+2.9%** |
| `texture-last` | 0.7869 | +2.9% |
| `flat` (no ladder) | 0.8189 | **−1.0%** |
| `min-n-1` | 0.7955 | +1.9% |

Removing the ladder entirely (`flat`) drops the model **below the population
prior**. The hierarchical fallback is not ceremony — it is most of what the
personalised model is worth at these sample sizes.

Lowering the evidence bar to a single observation (`min-n-1`) *hurts*: 1.9% vs
2.9%. `MIN_EFFECTIVE_N = 3` is doing real work; using a level backed by one or
two observations is worse than falling further down the ladder.

### Finding 2 — the texture-preservation ORDER is not supported

`villainDecisionModel.js:154` preserves board texture through level 3 on this
stated reasoning:

> "Texture preserved through L3 (3 levels) because wet vs dry boards have the
> largest impact on villain action distribution after street context."

That comment has never been measured. Inverting it (`texture-last`, which drops
texture *first*) scores **0.7869 vs 0.7871** — a difference of 0.0002, i.e.
nothing.

**This is NOT yet evidence the claim is false.** The two arms route identical
counts to levels 5/6/prior (323/381/341 in both), so the reordering only touches
the ~30 decisions that resolve at levels 1–4. At this sample size the arms barely
differ in what they *do*. The honest reading: **at 1k decisions the ordering
question is unresolved, and the experiment that would resolve it needs enough
per-villain depth for levels 1–3 to fire.** That is a sample-size problem, not a
poker one, and it is exactly what the full-corpus run is for.

### Finding 3 — the model under-estimates fold-to-bet by 5–10pp

*HandHQ online cash, July 2009; live generalisation unproven.*

| SPR zone | n | predicted fold | actual fold | error |
|---|---|---|---|---|
| medium | 124 | 46.4% | 55.6% | **−9.3pp** |
| high | 60 | 47.0% | 55.0% | −8.0pp |
| low | 56 | 46.5% | 51.8% | −5.3pp |
| micro | 48 | 46.5% | 45.8% | +0.6pp |
| deep | 43 | 47.9% | 58.1% | **−10.2pp** |

The bias is consistent in direction across four of five zones. This
**independently corroborates the WS-262 mining finding** that STAT_PRIORS
`foldToCbet` runs low by ~5–10pp (`docs/research/mass-pool-data-2026-07-25.md`,
scorecard item 4) — two different methods, same magnitude, same sign.

### Finding 4 — the Reference tier CANNOT reach villain action prediction

*Added 2026-07-26 after mining a real POOL table for 50NL and running both arms.*

The POOL-partition table was mined (FTP + PS 50NL, 1.26 GB materialised, **7.4 s**)
and both arms were run over 454,216 hands / 3,145 scored decisions:

| | reference OFF | reference ON |
|---|---|---|
| log-loss | 0.7821 | 0.7821 |
| accuracy | 54.1% | 54.1% |
| lift | 2.69% | 2.69% |

**Identical to four decimal places** — and the mechanism is now established rather
than guessed:

1. `resolveReferenceCounts` matches correctly (`minedLabel: 50NLH`, `seatBucket: 6max`)
   and the priors move substantially: `vpip` 0.2500 → 0.2814, **`foldToCbet` 0.4500 →
   0.5295**.
2. But `derivePercentages` applies `statPriors` **only to the credible intervals**.
   The point estimates (`vpip`, `pfr`, `af`, …) are raw counts.
3. `classifyStyle` reads those raw point estimates, so style is unchanged, so
   `buildVillainDecisionModel` receives byte-identical inputs.

The Reference tier therefore reaches the **exploit-rule confidence layer**
(`generateExploits`, `bayesianConfidence`) and **not** the prediction layer this
harness scores.

**Two consequences worth acting on.**

- *The leakage concern is narrower than the ticket assumed, for this metric.* There
  is no corpus-prior channel into villain action prediction at all. The guard is
  still correct — it protects any future harness that scores exploit generation,
  where the channel is real — but the `--reference none` runs above were not a
  compromise. They are provably the same numbers.
- *The correction for Finding 3 already exists and cannot reach the model.* The
  mined `foldToCbet` prior is **+8pp** over the static estimate, and Finding 3 shows
  the model under-predicts folds by **5–10pp**. The empirical fix is sitting in the
  Reference table with no path to the predictor. Wiring pool priors into the point
  estimates (or directly into the decision model) is a candidate ticket, and this
  harness is now the instrument that would score it.

### The cost of that error, in money

Founder-approved scope: accuracy everywhere, **bb/100 for the fold-vs-bet class
only**, because that class converts through EV maths the engine already owns
(`calcBluffEV`, POKER_THEORY §6.1/§6.3) with no new machinery.

**⚠️ THIS METRIC IS NOT READY TO QUOTE. Reported here as a work-in-progress, not
as a result.** Two grouping defects were found and one is still open.

*Fixed:* the first version grouped by SPR zone. Breakeven fold frequency is
`bet / (pot + bet)` — a function of bet-to-pot ratio only — so an SPR grouping
mixed sizings whose breakevens differ threefold and charged one group-average
fold rate against every pot in the group. Micro-SPR spots (huge pot relative to
stack) then dominated, inflating the headline ~30×. Grouping now uses the bet-size
bucket, where breakeven is near-constant within a group.

*Still open:* the distribution is severely heavy-tailed.

```
group          n     pred fold  actual   mean bb/100   MEDIAN bb/100
bet|33-66     678      43.1%    58.4%       96.86          0.00
bet|0-33      296      45.2%    43.9%        0.00          0.00
bet|66-100      8      48.5%    87.5%      819.69          0.00  (thin)
```

**The median is zero in every group.** The typical fold-estimate error costs
nothing, because it does not flip the bluff/no-bluff decision across breakeven —
which is the metric working exactly as designed. The mean is carried entirely by a
small tail of very large pots where the error does flip it. A mean quoted alone
(the run prints 83 bb/100 hands) badly misrepresents the typical case, and I do
not believe that figure.

Resolving it needs either winsorising, reporting regret as a share of pot rather
than absolute bb, or reporting the full distribution. Until then, **treat the
fold-estimate cost as "usually free, occasionally very expensive, magnitude not
yet pinned down."** The *directional* finding — the model under-predicts folds by
5–10pp — stands on its own and does not depend on this metric.

**What this number means: REGRET, not error.** A fold-estimate error costs
nothing if it does not change hero's decision. The cost is realised only when the
error flips the bluff/no-bluff call across breakeven (`betSize / (pot + betSize)`).
That is why `bet|high` shows a −8.0pp error and **0.00** bb/100 — the error was
real and free.

**It is a LOWER BOUND**, not a total: one node, one decision, no multi-street or
sizing consequences, and hero equity pinned at 0 (pure bluff). Full bb/100
coverage across all decision classes is a follow-up ticket, not part of this ship.

## Not yet done — stated, not buried

1. ~~**The POOL-partition reference table has not been mined.**~~ **DONE for 50NL
   (2026-07-26).** FTP + PS 50NL materialised (1.26 GB from the local pack, no
   download) and mined in **7.4 s**. Partition sanity-checked: POOL 6-max VPIP
   28.14% against the shipped all-players 28.83% — an unbiased half, not a skewed one.

   **It changed nothing, for a structural reason — see Finding 4.** The Reference
   tier cannot reach villain action prediction, so the earlier `--reference none`
   numbers were never a compromise. Mining the remaining stakes is therefore NOT on
   the critical path for this metric; it becomes necessary only when something scores
   the exploit layer.

   *Cost of the full mine, measured not estimated:* WS-262 recorded `_meta.elapsed_s`
   in every output file — **278 s (4.6 min)** across all 28 site×stake dirs / 21,783
   files at 8 workers. The dominant cost is materialising the corpus: **15.2 GB** from
   the local git pack. A ~15-minute job, not an overnight one. (My earlier "hours of
   unattended compute" was an unchecked inference and was wrong.)
2. **This is a 1,076-decision smoke run on one site and one stake.** Every number
   above is directional. Levels 1–3 of the ladder fired on 3 decisions total, so
   the texture-ordering question (Finding 2) is genuinely unresolved rather than
   answered.
3. **predictionAudit readback is wired but unexercised.** `reconstruct.js` now
   populates villain postflop distributions (the class the corpus harness scores),
   and `EngineCtxBridge` supplies the model. No live hands have been scored through
   it yet — it needs founder play to accumulate records.
4. **No UI surface.** A results view would be a UX change requiring Design Program
   Gates 1 and 4, neither of which has run. Output is console + JSON.
5. **Heads-up tables excluded**, consistent with WS-262 headline numbers.

## How to reproduce

```bash
# 1. Materialise a stake directory (blobs are already local — no download)
cd C:/Users/chris/data/phh-dataset
git sparse-checkout add data/handhq/FTP-2009-07-01_2009-07-23_50NLH_OBFU

# 2. Mine the POOL-partition reference table (hours; do this once per split)
python scripts/backtest/mine-pool-reference.py \
  --corpus-root C:/Users/chris/data/phh-dataset/data/handhq \
  --miner-path  C:/Users/chris/data/phh-mining \
  --out         out/pool-reference.json

# 3. Score the EVAL half against it
node scripts/backtest/run.mjs --reference out/pool-reference.json \
  --stakes 50NLH --sweep --out out/backtest.json
```

Tests: `bash scripts/smart-test-runner.sh` — partition cross-language agreement,
adapter golden-file round-trip, scoring-core arithmetic, EV-bridge arithmetic,
and the adversarial leakage-guard suite.

---

## Update — full-scale run + dimension ablation (2026-07-26, later session)

### Baseline at 3× scale — this is now the reference point to improve against

1,070,493 hands · 230 held-out players · **10,147 scored decisions** (vs 3,145 above).

| Metric | Model | Population prior |
|---|---|---|
| log-loss | 0.7932 | 0.8068 |
| accuracy | **52.2%** | 43.1% |
| lift | **1.69%** | — |

Lift fell from 2.69% to 1.69% as the sample grew — the smaller run was optimistic,
which is the expected direction. **Treat 1.69% lift / 52.2% accuracy as the number
to beat** when the game-tree model or tree depth changes.

Finding 4 re-confirmed at this scale: reference-tier ON and OFF are byte-identical
across all 10,147 decisions.

### The ladder levels, conditional on having data

| level | n | log-loss |
|---|---|---|
| level-1 (full context) | 157 | **0.737** |
| level-2 | 79 | 0.710 |
| level-3 | 135 | 0.745 |
| level-4 | 930 | 0.749 |
| level-5 | 4,095 | 0.754 |
| level-6 (street only) | 3,035 | 0.801 |
| bare prior | 1,716 | 0.909 |

**Monotone.** The more specific the level that answers, the better the prediction —
and the bare prior is far worse than any level backed by data.

### Ablation — "what should I be paying attention to at the table?"

Founder's framing, 2026-07-26: at a live table you cannot enter every hand, so
which *minimum* pieces of information carry the most predictive weight?

Each dimension was scored ALONE (single-level context, no fallback), against the
cheapest possible reference — facing-action only. Smoke run, 708 decisions:

| dimension | alone Δlog-loss | accuracy |
|---|---|---|
| in position / out of position | +0.0054 | 52.0% |
| who is the aggressor | +0.0109 | 54.7% |
| position category | +0.0254 | 47.6% |
| street | +0.0265 | 50.1% |
| board texture | +0.0273 | 48.7% |
| *all five together* | *+0.0412* | *46.3%* |

**Every dimension made it worse on its own, and all five together made it worst.**
Positive = harmful.

**This is not a contradiction of the ladder table above — it is the same fact from
the other side.** Conditioning on a dimension splits a villain's history into
smaller cells. Below the minimum-evidence bar the cell answers from the bare
population prior (log-loss 0.909), which is far worse than a well-sampled broad
estimate. So:

- **Specificity pays when it has observations** (ladder table: 0.737 at level-1).
- **Specificity costs when it doesn't** (ablation: every single-dimension arm loses).
- **The fallback ladder is the mechanism that converts the first into a net gain**,
  by using detail only when the detail is backed and retreating when it isn't.

That is the direct answer to the table question: **detail is only worth capturing
in proportion to how often you will capture it on the same villain.** A dimension
you record sporadically is worse than not recording it.

**⚠️ Confounded by depth, and the confound is the interesting part.** This smoke run
gave each villain very few decisions. The actionable version of this experiment is a
*curve* — re-run the ablation at several per-villain sample depths to find, for each
dimension, the observation count at which it starts paying. That threshold is the
real deliverable for live-capture guidance, and the harness now supports it
(`--ablate`, 13 arms in a single pass).
