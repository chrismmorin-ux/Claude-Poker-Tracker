# Engine backtest — first run on the SHIPPED configuration (POOL reference tier active)

Date: 2026-07-26 · Status: **real baseline; supersedes the smoke run's headline numbers**
Program: `domain-correctness` · Instrument: WS-273 · Follows: `engine-backtest-baseline-2026-07-26.md`

> **CAVEAT, BINDING, REPEATED AT EVERY NUMBER BELOW.** Every figure comes from the
> HandHQ corpus: **online cash only, July 2009, 50NL, two sites** (SRC-011). It
> measures whether the engine predicts *that* population. **Live 1/2
> generalisation is an assumption, not a result.** Nothing here is evidence about
> the founder's actual game until the predictionAudit readback accumulates live
> hands.

## What changed since the smoke run

The prior document's #1 open item was: *"The POOL-partition reference table has
not been mined. Until it runs, backtests must use `--reference none`, which
scores a configuration the app does not ship. The headline lift number will move
when this lands."*

It landed. Both changes at once:

| | Smoke run | This run |
|---|---|---|
| Reference tier | **disabled** (`--reference none`) | **pool-train** (mined from POOL half) |
| Corpus files | 60 (FTP only) | **1,756** (FTP + PS) |
| Hands read | 51,793 | **1,070,493** |
| Eval players | 66 | **230** |
| Decisions scored | 1,076 | **10,147** |
| Runtime | 37s | 467s |

The POOL table mine took **15 seconds**, not the hours the prior doc budgeted for
— the 15.2 GB working-tree materialisation it feared was already done.

**The two changes were confounded — and then de-confounded.** A control run
(`--reference none` on the identical 1,756-file corpus) was executed the same
session. See Finding 0.

## Headline

```
log-loss   0.7932   baseline 0.8068
brier      0.2333   baseline 0.2404
accuracy   52.2%    baseline 43.1%
LIFT       1.7%                        (smoke run: 2.9%)
```

## Finding 0 — the Reference tier is INERT in this measurement

The control run returns numbers that are **identical to 16 significant figures**:

| | with `pool-reference.json` | with `--reference none` |
|---|---|---|
| n | 10,147 | 10,147 |
| log-loss | 0.7931838891445275 | 0.7931838891445275 |
| brier | 0.23331471042805985 | 0.23331471042805985 |
| accuracy | 0.5223218685325712 | 0.5223218685325712 |
| lift | 0.0168946037216312 | 0.0168946037216312 |

Bit-identical is not "a small effect." **The Reference tier does not reach the
path this harness scores at all.**

Two consequences, and the first one corrects this document's own first draft:

1. **The 2.9% → 1.7% move was entirely the corpus change, not the Reference
   tier.** Any reading of that drop as evidence about WS-263's import is wrong.
   Sample went 1,076 → 10,147 decisions and gained a second site; that is the
   whole story.
2. **The harness's `--reference` decision is currently ceremony.** WS-273 makes
   `--reference` mandatory and defends it with 19 adversarial leakage tests —
   guarding a channel that provably does not influence the score. The likely
   benign explanation: the harness scores **postflop villain action
   distributions**, while the Reference tier feeds the **six scalar stat priors**
   (vpip/pfr/threeBet/cbet/foldToCbet/foldTo3Bet) through `poolBaseline`. Those
   may simply not be inputs to the scored distribution. That would mean the
   leakage guard is sound in principle and inert in practice — but it needs to be
   established, not assumed. Filed as **WS-284**.

Until WS-284 resolves it, **no result from this harness should be cited as
evidence for or against the WS-263 Reference import.**

## Finding 1 — the model's entire edge is in unopened spots

*HandHQ online cash, July 2009; live generalisation unproven.*

| Facing action | n | log-loss | lift |
|---|---|---|---|
| none (unopened) | 6,585 | 0.6999 | **+3.0%** |
| bet | 3,121 | 0.9647 | **−0.2%** |
| raise | 441 | 0.9724 | +0.1% |

**Facing aggression, the personalised model is worth nothing over the population
prior.** All of the lift comes from spots where nobody has acted. This is the
single most actionable result in the run: the machinery that estimates how a
villain responds to a bet — the fold estimate, the fold curve, the response
distribution — is the part that is not earning its keep, and it is also the part
hero's own decisions depend on most.

The line-class slice says the same thing from a different angle:

| Line class | n | lift |
|---|---|---|
| limp | 3,489 | +4.1% |
| coldCall | 2,964 | +2.3% |
| openFirstIn | 2,619 | −0.6% |
| isoRaise | 757 | −2.3% |
| cold3Bet | 245 | −2.9% |
| squeeze | 56 | −3.7% |

Passive lines: the model wins. Aggressive lines: the model is **worse than the
population prior**. (The bottom three are thin; the top two are not.)

## Finding 2 — fold-to-bet is underestimated by 13.3pp, and it is expensive

*HandHQ online cash, July 2009; live generalisation unproven.*

| Group | n | predicted fold | actual fold | error |
|---|---|---|---|---|
| bet\|33-66 | 2,073 | 44.7% | 58.0% | **−13.3pp** |
| bet\|0-33 | 1,022 | 45.5% | 41.5% | +4.0pp |
| bet\|66-100 | 26 | 48.7% | 84.6% | −36.0pp (thin) |

```
COST   45.43 bb/100 HANDS        ← smoke run reported 2.29
       36.11 bb/100 decisions of this class
```

**This is the third independent method to find the same bias in the same
direction.** WS-262's corpus mining found `foldToCbet` low by 5–10pp. The smoke
run found −5 to −10pp. This run finds **−13.3pp on 2,073 nodes** at the most
common sizing bucket.

**What the 45 bb/100 number is and is not.** It is **REGRET** — the cost realised
only when the fold-estimate error flips the bluff/no-bluff decision across
breakeven `bet/(pot+bet)`, priced at heroEquity = 0. It is a **LOWER BOUND** on
the cost of a bad villain model (one node, one decision, no multi-street or
sizing consequences) and simultaneously an **OVERSTATEMENT of realised loss**,
because it assumes hero takes the bluff decision at every applicable node. It is
not a claim that the founder is losing 45 bb/100. It is a claim that this one
error class is worth an order of magnitude more attention than the smoke run
suggested.

Note the sign flip at small sizings (+4.0pp at 0-33% vs −13.3pp at 33-66%): the
error is not a flat offset, it is **sizing-dependent**, which points at the fold
curve rather than the base rate.

## Finding 3 — the fallback ladder now has enough data to judge, and it holds

Levels 1–3 fired on **371 decisions** here versus **3** in the smoke run, which
was the sample-size problem that made the prior run's Finding 2 unresolvable.

| Level | n | log-loss |
|---|---|---|
| level-1 | 157 | 0.7372 |
| level-2 | 79 | 0.7103 |
| level-3 | 135 | 0.7452 |
| level-4 | 930 | 0.7495 |
| level-5 | 4,095 | 0.7540 |
| level-6 | 3,035 | 0.8012 |
| prior | 1,716 | 0.9089 |

Log-loss rises monotonically as the ladder falls back — specificity earns its
keep, and the gap between level-6 and bare prior (0.80 → 0.91) is large. This
corroborates the smoke run's Finding 1 at 10× the sample.

## Finding 3b — RESOLVED: the texture-preservation ORDER is not supported

The `--sweep` was run (all four arms, 10,147 decisions each). This closes the
question the smoke run explicitly could not answer.

| Arm | log-loss | lift |
|---|---|---|
| `shipped` | 0.793184 | +1.69% |
| `texture-last` | 0.793003 | **+1.71%** |
| `flat` | 0.838953 | **−3.98%** |
| `min-n-1` | 0.807356 | −0.07% |

**Why this run answers it and the smoke run did not.** The smoke run's two arms
routed identical counts to levels 5/6/prior, so the reordering only touched ~30
decisions — the arms barely differed in what they *did*. Here they differ on
**1,076 decisions**:

| Arm | L1 | L2 | L3 | L4 | L5 | L6 | prior |
|---|---|---|---|---|---|---|---|
| `shipped` | 157 | 79 | 135 | 930 | 4,095 | 3,035 | 1,716 |
| `texture-last` | 157 | **434** | **318** | **392** | 4,095 | 3,035 | 1,716 |

Levels 2–4 are massively reshuffled (79→434, 135→318, 930→392) while the
levels-1-to-4 total and the 5/6/prior tail are identical. That is a genuine
re-ordering of 1,076 decisions — **35× the smoke run's ~30** — and the resulting
log-loss difference is **0.00018**, or 0.02% of lift.

**Verdict: no detectable difference.** `villainDecisionModel.js:154` asserts

> *"Texture preserved through L3 (3 levels) because wet vs dry boards have the
> largest impact on villain action distribution after street context."*

That claim is **not supported by the data**. Inverting it — dropping texture
*first* — is if anything a hair better, well inside noise. The honest reading is
that the ordering is **arbitrary at this sample size**, not that texture-last
wins.

**Action:** do NOT promote the claim into POKER_THEORY §11.1. Either delete the
justification from the code comment or restate it as an arbitrary tie-break with
this measurement cited. An asserted-and-refuted comment is worse than no comment.

## Finding 3c — CORRECTED. The context hierarchy is OVER-SPECIFIED: pooling beats it

> **This section replaces an earlier claim in this document that "the hierarchy is
> essentially the entire personalised model."** That claim was drawn from the
> `flat` arm and from the fallback-ladder table. Both are the wrong comparison.
> The corrected result points the opposite way.

### Why the earlier reading was wrong

Two separate errors, both the same shape — comparing across **different
decisions** instead of the same decisions under different methods:

1. **The fallback-ladder table is a selection effect.** level-1 shows log-loss
   0.737 and level-6 shows 0.801, which looks like specificity paying off. But
   *different decisions reach different levels*. A decision that reaches level-1
   is one with many observations, and those are inherently more predictable. The
   table compares easy decisions to hard ones, not one method to another.
2. **`flat` is not "no ladder."** It is a single **fully-specific** level that
   falls straight to the prior — 9,990 of 10,147 decisions hit the bare prior. It
   shows that over-specificity *without* fallback is bad. It says nothing about
   whether the ladder beats **pooling**, because the CLI's `--sweep` never runs a
   pooled arm.

### The correct comparison — same decisions, different method

The ablation arms (`buildAblationArms`, shipped in WS-273 but never exposed by
the CLI) score every arm over the **identical** 10,147 decisions, so records are
index-paired and can be differenced per decision.

| Arm | log-loss | accuracy | paired Δ vs shipped | t | 95% CI |
|---|---|---|---|---|---|
| **`only:isAgg`** | **0.77645** | **55.7%** | **−0.01673** | −9.49 | [−0.0202, −0.0133] |
| **`ctrl:none`** (facingAction only) | **0.77830** | **55.0%** | **−0.01489** | −10.82 | [−0.0176, −0.0122] |
| `only:isIP` | 0.78506 | 53.7% | −0.00813 | −5.05 | [−0.0113, −0.0050] |
| `texture-last` | 0.79300 | 52.2% | −0.00018 | −0.92 | [−0.0006, +0.0002] |
| **`shipped`** | 0.79318 | 52.2% | — | — | reference |
| `only:street` | 0.80281 | 51.5% | +0.00962 | +6.69 | [+0.0068, +0.0125] |
| `only:texture` | 0.80637 | 50.5% | +0.01318 | +8.09 | [+0.0100, +0.0164] |
| `only:posCategory` | 0.80852 | 50.1% | +0.01533 | +9.01 | [+0.0120, +0.0187] |
| `ctrl:full` (5 dims, one level) | 0.83895 | 46.5% | +0.04577 | +22.91 | [+0.0419, +0.0497] |
| `drop:*` (any 4 dims, one level) | 0.832–0.839 | ~47% | +0.039…+0.046 | +20…+23 | all excl. 0 |

**Pooling everything by `facingAction` beats the shipped 6-level hierarchy by
0.0149 log-loss at t = −10.8, and by 2.8 points of accuracy (55.0% vs 52.2%).**
Adding one dimension — `isAgg`, who the aggressor is — is better still (55.7%).
Adding `street`, `texture`, or `posCategory` alone makes it *worse* than pooling.

That is roughly **80× the size of the texture-ordering effect** everyone was
arguing about, and in the opposite direction from the ladder's own diagnostics.

### What this means

At this per-villain sample depth the hierarchy is **over-specified**: the variance
of a 3-observation contextual estimate exceeds the bias from pooling. `min-n-1`
(−0.07% lift) is consistent — it is the same disease, further along. The fix is
not "keep the ladder and raise `MIN_EFFECTIVE_N`"; it is that most of the context
dimensions are not earning their place at all.

**Caveats that bound this.** (a) HandHQ online cash, July 2009, 50NL — live
generalisation unproven, and the founder's live per-villain samples are far
*smaller*, which if anything favours pooling even more strongly. (b) This scores
**villain action prediction only**. (c) Every arm still personalises per villain —
this is about the CONTEXT hierarchy, not about personalisation itself.

Filed as **WS-285**.

## Finding 4 — the model does BETTER multiway, which does not mean the math is fine

| Players in pot | n | lift | accuracy |
|---|---|---|---|
| 2 | 7,173 | +1.1% | 51.4% |
| 3 | 2,299 | +2.9% | 53.4% |
| 4 | 547 | +3.9% | 56.1% |
| 5 | 105 | +6.3% | 64.8% |

Read this precisely. The harness scores **villain action prediction**. WS-277's
multiway gap was in **hero's decision math** — the §6.1–6.4 value/bluff/MDF
spine — which this harness does not score at all. So Finding 4 is not evidence
against WS-277, and WS-277's fixes are not expected to move this table. What it
does show is that the villain decision model degrades gracefully multiway.

## Calibration

| Bucket | n | predicted | actual | error |
|---|---|---|---|---|
| 0-20% | 3,154 | 12.7% | 10.9% | 0.018 |
| 20-40% | 4,753 | 33.4% | 38.3% | 0.049 |
| 40-60% | 13,815 | 49.1% | 49.6% | 0.004 |
| 60-80% | 2,131 | 64.2% | 53.3% | **0.109** |
| 80-100% | 3 | 82.0% | 33.3% | (n=3, ignore) |

Same shape as the smoke run and slightly worse at the top: **the model is
overconfident exactly where it is most sure.** When it says 64%, it happens 53%.

## Reproduce

```bash
python scripts/backtest/mine-pool-reference.py \
  --corpus-root C:/Users/chris/data/phh-dataset/data/handhq \
  --miner-path  C:/Users/chris/data/phh-mining \
  --out out/pool-reference.json --workers 8          # 15s

node scripts/backtest/run.mjs --reference out/pool-reference.json \
  --hierarchy shipped --max-players 300 --max-hands-per-player 300 \
  --out out/backtest-shipped.json                     # 467s
```

## Finding 3d — RESOLVED (2026-07-27). The fix is shrinkage + a measured order, and they are complements

WS-285 executed. Finding 3c reproduced **bit-identically** (all 8 arms, log-loss,
accuracy, paired deltas and t-stats to 5 decimals) before anything was changed.

### Where the loss actually was — scored per ladder level

Restricting each arm to the decisions the shipped ladder resolved at that level
isolates the mechanism the aggregate hides:

| shipped level | conditions on (beyond facingAction) | n | pooling gains | +isAgg gains |
|---|---|---|---|---|
| level-4 | street + posCategory | 930 | **−0.0504** | **−0.0725** |
| level-5 | street | 4,095 | **−0.0190** | **−0.0275** |
| level-6 | — (already pooled) | 3,035 | 0.0000 | **+0.0159** ⚠ |
| prior | — | 1,716 | 0.0000 | 0.0000 |

At level-5, `only:street` scores **bit-identical** to shipped (0.75403) — the ladder
was doing nothing there but split on street.

**The ladder was ordered inversely to measured information content.** It added
`street → posCategory → texture → isIP → isAgg` broad→specific, while the evidence
ranks them `isAgg > isIP > (pool) > street > texture > posCategory`. So 5,025
decisions (49.5%) were conditioned on the two dimensions that are worse than nothing
alone, while `isAgg` reached 1.5%.

**But pooling is not the answer either** — the level-6 row shows adding `isAgg` to
already-thin decisions *hurts* by 0.0159. The correct structure pools when the cell
is thin and splits when it is not.

### Bake-off — 10 arms, same 10,147 decisions

| Arm | log-loss | acc | vs shipped | t | vs pooling |
|---|---|---|---|---|---|
| **`shrinkage:W10+reordered`** | **0.75819** | **58.7%** | **−0.03499** | −10.67 | **−0.0201 (t=−7.4)** |
| `shrinkage:W10` (old order) | 0.77596 | 55.7% | −0.01722 | −7.44 | n.s. |
| `shrinkage:W20` (old order) | 0.77641 | 54.2% | −0.01677 | −11.64 | n.s. |
| `only:isAgg` | 0.77645 | 55.7% | −0.01673 | −9.49 | n.s. |
| `ctrl:none` (pooling) | 0.77830 | 55.0% | −0.01489 | −10.82 | — |
| `reordered` (gate kept) | 0.78581 | 54.2% | −0.00737 | −5.43 | **loses** |
| `shrinkage:W5` | 0.79400 | 56.0% | +0.00081 | +0.22 | loses |
| `min-n-10` | 0.79402 | 53.1% | +0.00084 | +0.50 | loses |
| `shipped` | 0.79318 | 52.2% | — | — | +0.0149 |
| `min-n-25` | 0.82386 | 48.6% | +0.03068 | +15.03 | loses |

**The winner is the only arm that beats pooling.** Everything else either loses to
pooling or is statistically indistinguishable from it — which would have meant
deleting the hierarchy rather than reshaping it.

**A PREDICTION THAT FAILED, recorded because it was stated in advance.** The plan
predicted `reordered` at ≈ −0.018, beating pooling, and named the falsifier: *"if
`reordered` lands worse than `ctrl:none`, that prediction is wrong."* It landed at
−0.0074 and **loses to pooling** (+0.0075, t=+4.86). The reasoning error was
treating the gate as sound and the order as the whole defect. Reordering under a gate
only changes *which single level* wins; the gate still hard-commits to a thin cell.

**Order and shrinkage are complements.** Reorder alone −0.0074, shrinkage alone
−0.0172, together −0.0350 — more than the sum. Shrinkage lets every level speak,
which is only worth something once the levels nearest the root are the informative
ones.

**Hypothesis 3 refuted.** `min-n-10` is n.s. and `min-n-25` is much worse, so the
gate's *threshold* was not the defect. This is the arm that could have falsified the
ticket's diagnosis; it did not.

### `shrinkWeight` swept on the ladder actually shipped

| W | log-loss | acc | vs pooling |
|---|---|---|---|
| 5 | 0.78058 | 58.8% | n.s. |
| **10** | 0.75819 | **58.7%** | **−0.0201** |
| 20 | 0.75669 | 57.5% | −0.0216 |
| 40 | 0.76849 | 55.5% | −0.0098 |

W=5 and W=40 are both clearly worse, so the optimum is bracketed. W=10 vs W=20 is a
real split — W=20 marginally lower log-loss, W=10 higher accuracy. Head to head the
log-loss difference is **not significant** (−0.00150, t=−1.13, CI [−0.0041,+0.0011])
in aggregate or within any depth stratum, while W=10's accuracy edge holds in **all**
of them (52.1/55.8/61.6 vs 50.8/54.4/60.6). Shipped W=10.

### The gain scales with the read, and is never negative

| Villain depth | n | vs shipped | vs pooling | accuracy |
|---|---|---|---|---|
| established (≥30 obs) | 5,738 | −0.0528 | −0.0286 | 52.9% → **61.6%** |
| developing (10–30) | 3,250 | −0.0152 | −0.0114 | 51.1% → 55.8% |
| speculative (<10) | 1,090 | −0.0026 | −0.0029 | 51.7% → 52.1% |
| none | 69 | 0 | 0 | unchanged |

**This is the honest bound.** The headline 6.5pp accuracy gain is driven by
data-rich villains. Live per-villain samples are far smaller, so expect the modest
end at the table — but the change never hurts at any depth and compounds as reads
accumulate.

### One correction to Finding 3c

Finding 3c reported that adding `isAgg` to pooling is "better still." Paired against
pooling directly, `only:isAgg` is **not significant** (−0.00185, t=−1.27, CI
[−0.0047,+0.0010]). It beats *shipped*, not *pooling*. The distinction matters: the
case for keeping any hierarchy at all rests on beating pooling, and no single-level
arm does.

Shipped as POKER_THEORY §11.5.

## Open

1. ~~**Re-run with `--sweep`**~~ — superseded by Finding 3d, which measured the
   ordering question directly rather than through reordering arms under a gate.
2. ~~Isolate the Reference tier~~ — **DONE this session, see Finding 0.** The
   tier is inert in this measurement; follow-up is WS-284.
3. **Fold-estimate correction** is now the highest-value engine change the
   instrument can point at (WS-283).
4. Still one stake (50NL) and one era (July 2009). Heads-up tables excluded.
