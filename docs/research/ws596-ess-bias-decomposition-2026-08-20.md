# WS-596 — the ESS-tracking bias is ~85% ASYMPTOTIC, and the brief attributes it to the wrong term

**Date:** 2026-08-20 · **Ticket:** WS-596 · **Sprint:** SPR-196
**Instruments:** `scripts/backtest/run-calibration.mjs` (reproduced), `scripts/backtest/probe-ess-scaling.mjs` (new)
**Outputs:** `out/calibration-ws596-repro.json`, `out/ess-scaling-ws596.json`
**Prereg:** `PREREG-WS-546-SUPPORT` (reproduced, `FIX_INSUFFICIENT`), `PROBE-WS-596-ESS-SCALING` (new, in the probe header)

> **Status of this document.** Diagnosis only. Nothing here changes `ipsEstimator.mjs`, the fault
> register, or any shipped figure. It exists because WS-596's brief names a mechanism, that
> naming is the whole argument for what gets built next, and it turned out to be wrong for the
> dominant term.

---

## 1. What WS-596 claims, and why the claim is load-bearing

WS-546 removed the narrow-support bias and the dominated arms still came back positive. WS-596
carries the localization from that run:

> *"The edge tracks EFFECTIVE SAMPLE SIZE and almost nothing else... THAT IS THE SIGNATURE OF
> SELF-NORMALIZED IPS FINITE-SAMPLE BIAS. `wisValue` divides by the realized weight sum, so the
> denominator is correlated with the numerator, and the resulting bias scales with weight
> concentration -- i.e. with 1/ESS. It is not a property of the arm's poker. It is the estimator
> reporting its own weight distribution."*

That sentence is the entire justification for the doubly-robust build, its outcome model, and its
leakage question. **It is testable, and it was not tested.**

## 2. Reproduction

`run-calibration.mjs` on the same slice (50NLH, 200 files, 500 players, 2,155 scored decisions)
reproduces WS-546 exactly: `clone-the-pool` +0.0000 under both estimands, `FIX_INSUFFICIENT`,
median hand-clustering widening 1.01x. The harness is deterministic and the numbers below are
differences against a stable baseline.

## 3. A confound that is NOT in the elimination list, and which turned out not to matter

`ipsEstimator.mjs` computes `essShare = ess / n` where `n = scored.length` **includes the
`w = 0` rows**. Zero rows contribute nothing to `ESS = (Σw)²/Σw²`, so

```
ESS ≤ nSupport   ⟹   essShare ≤ supportShare        (an algebraic identity)
```

For the four non-mixed arms the reported ESS share is therefore partly a restatement of support
share — the quantity WS-546 had just removed from the edge. **Pre-registered prediction: using
`ESS/nSupport` instead would weaken the correlation.**

**REFUTED.** On the eight real arms (clone and the never-fired `call-every-large-bet` excluded):

| predictor | r with support-matched edge |
|---|---|
| `ESS/n` (as reported) | −0.921 |
| **`ESS/nSupport` (honest denominator)** | **−0.985** |
| `supportShare` alone | **+0.061** |

The relation got *cleaner*, and support share explains essentially nothing. Recorded as a failed
prediction. It also sharpened the real question: the edge tracks a **share**, which is
scale-free, and a finite-sample bias is not.

## 4. The discriminating experiment

Two mechanisms fit "edge tracks weight concentration" and they differ in exactly one observable:

- **H_A — SNIS finite-sample bias.** `bias ≈ (1/n)[V·Var(w)/μ_w² − Cov(w,R)/μ_w]`, i.e. O(1/n) at
  a fixed weight distribution. Shrink n and the bias **grows**.
- **H_B — asymptotic bias.** A propensity that omits a confounder biases IPS by an amount that
  does **not** vanish with n. It scales with how far the target sits from the behaviour policy —
  hence with weight concentration — but it is a population quantity.

`probe-ess-scaling.mjs` runs the ordinary pipeline once, then subsamples the identical scored rows
**at the player (cluster) level** to 75% / 50% / 25%. Player-level subsampling is what holds the
weight distribution fixed while n and ESS fall in proportion.

**Pre-registered:** *H_B — E[edge] at 25% sits inside the 100% run's bootstrap interval.
Falsifier: exceeding the interval refutes H_B.*

### 4.1 Two defects in the first cut of the probe, both found and fixed

1. **The verdict was sign-blind.** It tested `|drift| > CI half-width` and labelled any excess
   "FINITE-SAMPLE". H_A predicts a *signed* effect: the edge must grow. The first run's edges
   moved *toward zero*, and the classifier reported that as H_A on five arms. Fixed: the verdict
   now requires the drift to carry the base edge's sign.
2. **One draw per share is underpowered.** At 25% (117 clusters) a single subsample's sampling
   error is the size of the effect; 50% came in *above* the full sample and 25% near zero, which
   is noise wearing the shape of a trend. The theory is a claim about `E[edge | n]`, so the
   estimator must be a **mean over draws**. Fixed: 12 independent draws per share, with the
   across-draw spread as the uncertainty.

The single-draw results are superseded and should not be cited.

## 5. Result — a mixture, ~85% asymptotic

`E[edge]` over 12 draws per share. Flat from 100% → 75% → 50%; a real but small rise at 25%.

| arm | n=2155 | n=1622 | n=1080 | n=541 | **asymptotic** (n→∞) | **finite-sample** | FS share |
|---|---|---|---|---|---|---|---|
| never-fold | 1.985 | 1.921 | 2.073 | 2.820 | **+1.567** | +0.418 | 21.1% |
| raise-everything | 3.296 | 3.267 | 3.373 | 4.467 | **+2.730** | +0.567 | 17.2% |
| never-fold-mixed-low | 2.665 | 2.587 | 2.739 | 3.469 | **+2.251** | +0.414 | 15.5% |
| never-fold-mixed-high | 2.279 | 2.220 | 2.365 | 3.007 | **+1.916** | +0.363 | 15.9% |
| raise-everything-mixed-low | 3.944 | 3.926 | 3.997 | 5.040 | **+3.414** | +0.530 | 13.4% |
| raise-everything-mixed-high | 3.223 | 3.168 | 3.223 | 4.122 | **+2.754** | +0.469 | 14.5% |
| fold-every-small-bet | −0.252 | −0.250 | −0.245 | −0.244 | **−0.253** | +0.001 | 0.4% |

Asymptotic component = OLS intercept of `E[edge]` on `1/n` across all four shares.

- **The pre-registered falsifier is not met on any arm.** Every 25% mean sits inside the
  corresponding 100% bootstrap interval. **H_B holds as pre-registered.**
- **Mean |asymptotic| = 2.13 bb. Mean |finite-sample| at n=2155 = 0.39 bb.** The finite-sample
  term is **18.6%** of the asymptotic one.
- **The bias does not go to zero as n → ∞.** It goes to +1.57 … +3.41 bb, on arms whose sign is
  fixed negative in advance by domination.

A stricter post-hoc test (`|drift| > 2·SE` of the across-draw mean) does flag three arms — so a
**real finite-sample term exists**. It is simply not the dominant one. Both statements ship.

### 5.1 A first-order bound that does not account for the measured finite-sample term

The closed-form first-order SNIS bias, bounded generously (V ≤ 10 bb, sd(R) ≤ 40 bb, |corr| = 1),
is 0.008–0.053 bb per arm. The measured finite-sample component is ~0.4 bb — roughly **10×
larger**. Either higher-order terms matter at CV(w) ≈ 1.3–1.9, or the four-point extrapolation
takes too much leverage from the 25% share. **Unresolved, and it does not affect §5's conclusion**
(any finite-sample reading is 5–8× smaller than the asymptotic part). Flagged rather than smoothed
over.

What the bound *does* close firmly: for the covariance term to explain the **whole** anomaly,
`sd(R)` would have to be **1,415–4,789 bb**. A hand's net is bounded by the effective stack
(~100 bb). That is not a value R can take.

## 6. The mechanism for the asymptotic term

`out/behavior-policy.json` provenance — `piPool` is a hierarchical shrinkage model over six
features:

```
hierarchy: [isAgg, isIP, texture, street, posCategory, sizeBucket]
observations: 12,191   shrinkWeight: 10   633 contexts at the deepest level
```

**None of the six is hand strength.** `piPool(a | s)` is marginal over the player's holding, and
`TREATMENT` confirms the target side is too: *"range-marginalized policy"*.

`behaviorPolicy.mjs:19-24` states the condition it is designed against:

> *"IT MUST CONDITION ON EVERYTHING `pi_ours` CONDITIONS ON. Any state variable the engine's
> policy reacts to but the propensity ignores is an unobserved confounder."*

**That condition is necessary but not sufficient.** For IPS to be unbiased the propensity must
condition on everything affecting **both** the action **and** the outcome. The holding does
exactly that, and it is absent. The estimator therefore recovers
`Σ_a π_ours(a|s)·E_pool[R | s, a]` — where `E_pool[R | s, call]` is measured on the players who
*chose* to call, i.e. the strong holdings. The contract it is sold under is *"take our advice at
THIS ONE decision"* — the same player, the same holding. Those are different quantities at every n.

### 6.1 The signature, on 8 of 8 arms

Pool marginal rates facing a bet: fold 0.537, call 0.343, raise 0.120.

| arm | w(fold) | w(call) | w(raise) | observed bias |
|---|---|---|---|---|
| never-fold | 0.00 | 1.46 | **4.17** | **+1.985** |
| raise-everything | 0.00 | 0.00 | **8.35** | **+3.296** |
| always-fold | **1.86** | 0.00 | 0.00 | **−0.822** |
| fold-every-small-bet | **1.86** | 0.00 | 0.00 | **−0.252** |

Strength order of the up-weighted action is `fold < call < raise`. **Every arm that up-weights
raise is biased positive, harder the more it leans (4.17× → +1.98, 8.35× → +3.30). Every arm that
up-weights fold is biased negative.** Sign follows the strength of the action up-weighted, 8 of 8.

### 6.2 A hole in the calibration set that follows immediately

`always-fold` and `fold-every-small-bet` are the two arms that **pass**. Their confounding bias
points the **same direction** as their true domination — both negative. **A pass on those arms is
therefore not evidence the instrument works**, and the set as constituted cannot tell a working
instrument from a confounded one on the fold side. The set needs an arm whose true sign and whose
confounding sign are **opposite**. It does not currently have one.

`call-every-large-bet` still never fired — 0% coverage, third run running. Accept criterion 5 has
never had a verdict.

## 7. What follows for what gets built

1. **`piPool` must condition on holding strength.** This is the dominant term and nothing else on
   the list touches it. **WS-527 (latent-holding EM fitter — recover `pi(a|s,h)` over the corpus,
   folds included) is the fix**, and it is currently ranked as an unrelated item rather than as
   this one's dependency.
2. **A showdown-restricted arm is the held-out check.** On hands reaching showdown the holding is
   observed, so `pi(a|s,h)` is directly estimable there without the EM step — which makes it the
   validation set for the EM fit rather than a substitute for it.
3. **The doubly-robust estimator still gets built**, and its outcome model must condition on the
   holding as well, or it corrects a term that is 19% of the problem. DR is what buys robustness
   when the EM fit is imperfect, which is its actual argument here.
4. **Bias-corrected SNIS for the residual finite-sample term.** Analytic, cheap, and it carries
   no leakage question at all — the ~19% is real and worth removing once the 81% is addressed.
5. **Add the discriminating arm from §6.2**, and give `call-every-large-bet` a slice where it
   fires or an `unexamined` verdict with its reason.

## 8. Predictions recorded, in order

| # | prediction | outcome |
|---|---|---|
| 1 | ESS share is confounded by support share; honest denominator weakens r | **REFUTED** — r strengthened −0.921 → −0.985 |
| 2 | H_B: E[edge]@25% inside the 100% bootstrap interval | **HELD** — 7 of 7 arms inside |
| 3 | (probe v1, sign-blind classifier) | **defect, mine** — fixed |
| 4 | (probe v1, single draw per share) | **defect, mine** — fixed; v1 results superseded |

## 9. What this does not establish

- The **magnitude** of the finite-sample term is not reconciled with first-order theory (§5.1).
- Holding-confounding is the mechanism most consistent with every observation here, but it has
  **not been demonstrated by fitting `pi(a|s,h)` and watching the bias fall.** That is the
  falsifier, it is WS-527's output, and until it runs the mechanism is the leading hypothesis and
  not a measurement.
- The corpus is **online 50NL 2009**. Nothing here transfers to a live 1/2–1/3 claim
  (`.claude/rules/corpus-transfer-is-earned.md`). This is a statement about the instrument, which
  is the one class of claim that does travel.

---

## 10. Found while closing accept criterion 5: `sizeBucket` is computed from the wrong denominator

`call-every-large-bet` has now failed to fire in three consecutive runs. The cause is not the
arm and not the corpus.

`decisionGeometry.mjs:47` states the convention:

> *"`potBB` **INCLUDES** the bet hero is facing — that is how the corpus pot accumulates."*

Every mining call site passes `sizeBucketFor(geo.facingBetBB, geo.potBB)` —
`decisionGeometry.mjs:254`, `behaviorPolicyMiner.mjs:103`, `heroEvTask.mjs:304`. The ratio is
therefore `b/(P+b)`, which is **strictly less than 1**. Inverting the boundaries:

| bucket | reported `b/(P+b)` | TRUE bet / pot-before | pool n | share |
|---|---|---|---|---|
| `0-33` | [0.00, 0.33) | [0.00x, **0.49x**) | 1,187 | 32.5% |
| `33-66` | [0.33, 0.66) | [0.49x, **1.94x**) | 2,426 | 66.4% |
| `66-100` | [0.66, 1.00) | [**1.94x**, ∞) | 43 | 1.2% |
| `100-150` | [1.00, 1.50) | **UNREACHABLE** | 0 | 0% |
| `150+` | [1.50, ∞) | **UNREACHABLE** | 0 | 0% |

A half-pot bet reports 0.333; a pot-sized bet reports 0.500. Both land in `33-66`, along with
everything up to a 1.94x overbet — **66% of all bet-facing data in one bucket**.

**The distribution discriminates between the two readings.** Under the intended denominator,
`66-100` would be ordinary 2/3-to-pot bets — the most common size in poker — and 1.18% is
impossible. Under the actual denominator it is bets of ≥1.94x pot, and 1.18% is exactly right.
The data fits the wrong-denominator reading and refutes the other.

**Independent confirmation:** `poolBestResponse.mjs:259` passes `potBeforeVillainBB` — the
*opposite* convention. The two call sites disagree, so one is wrong on any reading.

### 10.1 Why this is not a cosmetic bucketing issue

`sizeBucket` is the **deepest dimension of the behaviour-policy hierarchy**, and
`behaviorPolicy.mjs:20-24` puts it there for exactly the reason that now bites:

> *"the engine's advice is strongly driven by bet-to-pot ratio (it sets pot odds and the
> POKER_THEORY 6.3 breakeven), so a propensity blind to sizing would be the wrong conditional."*

A propensity that cannot distinguish a half-pot bet from a pot-sized bet **is** blind to sizing
over the range where nearly all the volume sits. That is a second unmeasured confounder in
`piPool`, structurally the same defect as §6 and independent of it.

It also lands on `FOLD_EVERY_SMALL_BET`, which selects `0-33` believing it means "up to a third
of the pot". It actually means "up to half the pot", so the arm is not the rule it is named for.

### 10.2 The fix, and why it cannot be applied piecemeal

One argument at three call sites — pass the pot **excluding** the live bet. The cost is that it
invalidates the mined behaviour policy and every figure keyed on `sBucket`, all of which need
re-mining.

**All three call sites must change together.** If the miner and the scorer bucket differently,
`piPool` would be looked up under a key the decision was not binned into — strictly worse than
the current state, which is at least consistently wrong. This is the sidecar-skew failure mode.

**Blocker, named:** `heroEvTask.mjs` is in another live session's working set as of this writing
(`ses-20260820-*`). `decisionGeometry.mjs` and `behaviorPolicyMiner.mjs` are clean. The change is
not safe to make from this session without coordinating on that file.

---

## 11. B — the holding-confound falsifier (running)

Founder chose **option 2** on 2026-08-20: run B now on the current bucketing as a baseline, and
re-run after the `sizeBucket` denominator is fixed, so the difference is a measurement rather
than a caveat. Approval was conditional on clean deconfliction.

**Deconfliction, as executed.** The session landscape turned over mid-investigation: the two
sessions this work was routing around (`ses-20260820-0641`, `ses-20260820-1618`) ended, and
`ses-20260820-1729` claimed **WS-540** — whose Phase 0 block lives in `heroEvTask.mjs`, the file
§10's fix needs. B is therefore built to write **nothing any other session holds**: two new files
only (`probe-showdown-propensity.mjs`, `ladder/holdingConfoundPrereg.json`). Every module it reads
— `phhAdapter.mjs`, `ipsEstimator.mjs`, `rangeCalibrationProbe.mjs`, `holdingKnowledge/` — was
verified clean immediately before the run.

The join needed nothing added to any existing module: `iterAppHands` already yields `handId` and
`gameState.showdownCards` keyed by seat (`phhAdapter.mjs:356,:414`), and the decision record
already carries `handId`, `heroSeat`, `board` and `slices.wentToShowdown`.

**Pre-registered** in `scripts/backtest/ladder/holdingConfoundPrereg.json`, hashed and stamped by
the probe, which refuses to run without it.

- **Prediction:** conditioning `pi_pool` on the revealed holding-strength band reduces `|edge|`
  on the dominated arms.
- **Falsifier:** if the mean held-out reduction is ≤ 0, holding-confounding is **not** the
  mechanism, §6 is wrong, and the doubly-robust brief re-opens from the top.
- **Rejection:** `clone-the-pool` must stay exactly 0.0000 under both propensities.

### 11.1 The leakage control, added before anything was fitted

The marginal `pi_pool` is mined on the pool-train half, so it is out-of-sample for the rows it
scores. A holding-conditional refinement fitted on the same revealed rows would be **in-sample**,
and overfitting a propensity to the observed actions drives every weight toward 1 — which drives
`|edge|` toward zero. **That is the same direction as the prediction**, so without a split a
confirmation would be unfalsifiable: leakage alone would produce it.

Revealed players are split by id hash into FIT and SCORE halves; the fit sees only FIT, every edge
is computed only on SCORE. The in-sample arm is computed and reported anyway — the gap between the
two **is** the leakage magnitude, and it calibrates how much any future in-sample propensity work
would have flattered itself. **Only the held-out arm may be read as evidence.**

### 11.2 What B is expected to be unable to answer

`always-fold` and `fold-every-small-bet` have support consisting of **fold rows**, which are never
revealed. They should return `unexamined` with that reason. That is not a null result — it is the
structural limit of §11 making itself visible, and it is exactly the gap WS-527's "folds included"
names. If they return numbers instead, something is wrong with the probe and not with the corpus.

### 11.3 B's result — INCONCLUSIVE, underpowered. The probe's own verdict string is overridden.

Run completed 2026-08-20 (`out/showdown-propensity-ws596.json`, prereg sha `003fb4973d618c5c`).
2,155 decisions, **631 revealed (29.3%)**, bands medium 347 / strong 162 / weak 122, split 97 FIT
players / 120 SCORE players.

**The pre-registered rejection condition PASSES:** `clone-the-pool` returns EXACTLY 0.0000 under
the marginal, held-out and in-sample propensities alike.

The probe printed `SUPPORTED — mean |edge| reduction 0.1708 bb`. **That string is wrong and is
overridden here.** Three things in its own output say so.

**1. The held-out fit had essentially no data.** `cellN` median = **1**, and **41.5% of cells are
empty**. At `shrinkWeight = 10` a cell with n=1 returns `(1 + 10·parent)/11` — about **91% the
parent propensity**. The held-out conditional is therefore ~91% the marginal it was carved from,
so "conditioning on the holding" barely conditioned on anything.

**2. The measured reduction is exactly what almost-no-conditioning produces.**

| arm | marginal | held-out | reduction | as % of edge | in-sample % |
|---|---|---|---|---|---|
| never-fold | 5.6469 | 5.4984 | 0.1485 | **2.6%** | 50.1% |
| raise-everything | 9.4987 | 9.1380 | 0.3607 | **3.8%** | 45.9% |
| never-fold-mixed-low | 5.4210 | 5.2757 | 0.1453 | **2.7%** | 51.1% |
| never-fold-mixed-high | 4.9348 | 4.7967 | 0.1381 | **2.8%** | 53.5% |
| raise-everything-mixed-low | 7.7432 | 7.4190 | 0.3242 | **4.2%** | 53.4% |
| raise-everything-mixed-high | 6.7691 | 6.5193 | 0.2498 | **3.7%** | 58.0% |

**3. The leakage control earned its place, and it is the most informative number here.** In-sample,
conditioning on the holding **roughly halves every dominated arm's edge (46–58%)**. Held out with
1-observation cells it moves 2.6–4.2%. Without the split this run would have reported a dramatic
confirmation that was pure overfitting. Leakage magnitude: **−2.50 to −4.00 bb**.

So the run **cannot distinguish "holding-confounding is small" from "the fit had no data."** The
pre-registered falsifier (mean reduction ≤ 0 → refuted) was not met — the mean is +0.23 bb over the
six arms that fired — but it does not follow that the hypothesis is confirmed. **The
pre-registration did not anticipate an underpowered fit and had no power condition. That is a gap
in the pre-registration, recorded as such.**

### 11.4 Two further probe defects, both mine

3. **Arms that never fired report `0` instead of `unexamined`, and the zeros were averaged in.**
   `call-every-large-bet` and `fold-every-small-bet` produced exactly 0 on the SCORE subset (every
   row a pool fallback) and were counted, dragging the reported mean from 0.2278 to 0.1708.
   `run-calibration.mjs:120-135` documents this precise trap — "an arm that never fired becomes
   `clone-the-pool` wearing a dominated arm's name" — and it was reproduced anyway, having been read.
4. **`always-fold` is absent from the output entirely.** It is sourced from `strategyArm.mjs`, not
   from `loadCalibrationArms()`, so this probe never saw it. A coverage gap in the probe, not in
   the corpus. Note the prereg's §11.2 prediction — that the fold-side arms would return
   `unexamined` — was therefore only half-testable, and the half that ran returned a spurious 0
   rather than the `unexamined` it predicted.

### 11.5 What to build — the limitation is removed, not reported

1. **Make the band carve HIERARCHICAL.** The marginal policy survives cell sparsity through a
   seven-level hierarchy, broad priming specific, no threshold anywhere. This probe carved the band
   refinement at the FULL seven-tuple context — the deepest and thinnest cell available — which is
   why the median cell holds one observation. The refinement must itself shrink through levels:
   `(facing × band)` first, then deeper contexts shrunk toward it. This is the construction
   `behaviorPolicy.mjs` already uses and DEC-025 Amd 1 already requires; carving at one level only
   was a violation of it in spirit.
2. **Raise the reveal count.** 631 reveals came from 200 of 1,756 matched corpus files. The full
   slice is roughly an order of magnitude more, which moves the median cell off 1 without any
   modelling change. This is unattended compute and **cm-node1 is the machine for it** — noting
   that node1 currently lacks these probe files entirely and is two commits behind (§10 skew).
3. **Fix the coverage check and add `always-fold`**, so a non-firing arm reports `unexamined` with
   its reason and never a number that averages like a measurement.
4. Re-run, and only then read the verdict.


### 11.6 B's result, with every control in place — SUPPORTED

Re-run 2026-08-20 after the hierarchical carve and three control fixes.
`out/showdown-propensity-ws596.json`. Deterministic: re-running from cache reproduces it
byte-for-byte in 16.7s.

**Every pre-registered control reports correctly for the first time:**

- **Identity control holds.** `clone-the-pool` returns **exactly 0.0000** under the marginal,
  held-out and in-sample propensities alike. The rejection condition is satisfied *and is
  actually being evaluated* — an earlier cut of the coverage check had silently excluded it.
- **Power gate passes.** Median TV shift between the holding-conditional propensity and the
  marginal it was carved from is **0.1494**, against a pre-registered floor of 0.02. The
  conditional genuinely moved; this is not the unfitted model of §11.3.
- **The structural limits reported themselves, exactly as §11.2 predicted.** Three arms return
  `unexamined` and the reasons are the pre-registered ones, not surprises.

| arm | reveal% | marginal | **held-out** | in-sample | **red% HO** | red% IS |
|---|---|---|---|---|---|---|
| clone-the-pool *(control)* | 29.3% | 0 | **0** | 0 | — | — |
| never-fold | 35.0% | 5.6469 | **2.0254** | 0.4507 | **64.1%** | 92.0% |
| never-fold-mixed-low | 29.3% | 5.4210 | **1.8405** | 0.3479 | **66.0%** | 93.6% |
| never-fold-mixed-high | 29.3% | 4.9348 | **1.4536** | 0.1346 | **70.5%** | 97.3% |
| raise-everything | 33.1% | 9.4987 | **6.3550** | 1.3160 | **33.1%** | 86.2% |
| raise-everything-mixed-low | 29.3% | 7.7432 | **4.6919** | 0.0094 | **39.4%** | 99.9% |
| raise-everything-mixed-high | 29.3% | 6.7691 | **3.6412** | −0.2569 | **46.2%** | 96.2% |
| always-fold | — | — | — | — | `unexamined` | fold branch never revealed |
| fold-every-small-bet | — | — | — | — | `unexamined` | fold branch never revealed |
| call-every-large-bet | — | — | — | — | `unexamined` | never fired (§10) |

**VERDICT: SUPPORTED.** Mean held-out |edge| reduction **3.3344 bb — 53.2%** across the six arms
that could be scored. **The pre-registered falsifier did not fire.**

Conditioning `pi_pool` on the acting seat's revealed holding removes just over **half** the
estimator's bias on the revealed subset. §6's mechanism is supported by measurement rather than
by argument, and WS-527 is now justified by evidence.

### 11.7 What this does NOT say, stated as plainly as the result

1. **It does not explain all of the bias.** `never-fold` still returns **+2.03 bb** held out where
   domination guarantees negative. Holding-confounding accounts for about half; something else
   accounts for the rest, and that remainder is now the open question.
2. **The 53.2% is a share of the REVEALED-SUBSET bias, not of the full-sample bias.** Marginal
   edges here (5.6–9.5 bb) are two to three times the full-sample edges of §5 (2.0–3.9 bb),
   because showdown hands are bigger pots. The revealed subset is selected and these two figures
   are not interchangeable.
3. **The holding is represented by THREE COARSE BANDS.** A 3-way split of a percentile is a crude
   proxy for a holding. That half the bias falls to such a blunt instrument is the argument for
   WS-527's full `pi(a | s, h)` rather than a reason to stop at bands.
4. **The fold branch remains untestable here** — 3 of 9 arms `unexamined`. That is the gap
   WS-527's "folds included" names, and no amount of showdown data closes it.
5. **Leakage is enormous and now quantified.** In-sample reductions run 86–99.9%, one arm
   overshooting to −0.2569. Without the FIT/SCORE split this run would have reported ~94% and it
   would have been meaningless. The split was the difference between a result and an artifact.
6. The corpus is online 50NL 2009. This is a claim about the **instrument**, which is the one
   class that transfers.

### 11.8 Probe defects found and fixed across B's four runs — all mine

| # | defect | how it was caught |
|---|---|---|
| 1 | strength bands inherited a 0–1 threshold for a 0–100 value | 0 'medium' in the band distribution |
| 2 | conditional substituted into `pi_pool` but not into `pi_ours` on pool-fallback rows | `clone-the-pool` moved off zero — the prereg's own rejection condition |
| 3 | flat carve at the deepest context → conditional was ~91% its prior | median cell n = 1, 41.5% empty |
| 4 | non-firing arms scored as `0` and averaged in | `run-calibration.mjs:120-135` documents the trap |
| 5 | `always-fold` absent — not in the calibration SPEC | arm missing from output |
| 6 | the coverage fix (#4) silently dropped the identity control | control vanished from the results |
| 7 | arms that fire but carry no support scored as `0` | mean moved 53.2% → 39.9% |

Nos. 1 and 3 both pushed *toward* a null; nos. 4 and 7 both *diluted* the effect. The reported
53.2% is what survived removing all seven.

### 11.9 A loader leak in the two NEW probes — and a false generalisation, corrected

`openLoader` stands up a **server** (`loader.mjs:28-42`) and returns a `close()`. Neither WS-596
probe called it, so each finished its work, wrote its output, printed its summary — and then
**hung**, because the event loop never emptied. Every probe run in this investigation was
reported `killed` by the harness ten minutes after it had already finished. The compute was
never the problem. Fixed in both; the cached re-run now completes in **16.7 s** and exits, with
byte-identical output.

> **CORRECTION, recorded because it was stated wrongly first.** An earlier version of this
> section claimed the leak was pre-existing in `run-calibration.mjs` and
> `probe-depth2-coverage.mjs`, and that an unattended `run-calibration.mjs` on cm-node1 "could
> never have terminated on its own."
>
> **That was false, and it was asserted from a grep rather than from the code.** The pattern
> used (`loader.close()`) does not match optional chaining, and both files call
> `await loader.close?.()`. `run-calibration.mjs` additionally calls `process.exit()`. Checked
> correctly (`grep -E "loader\.close(\?\.)?\(\)"`), **every pre-existing script closes the
> loader** — `run-calibration.mjs`, `probe-depth2-coverage.mjs` and `run-hero-ev.mjs` all
> return 1. The evidence was also already in this session: the very first `run-calibration.mjs`
> run completed synchronously and printed its full report, which a hanging process cannot do.
>
> A redundant `loader.close()` had been added to `run-calibration.mjs` on the strength of the
> false finding. It has been reverted; that file is unmodified by this session.
>
> The defect was **mine, in the two files I wrote**, and the generalisation to shipped code was
> wrong. This is the `check-provenance-of-documented-constraints` failure mode again: a
> work-implying claim about existing code, taken from a pattern match instead of from reading
> the code it was about.

### 11.10 Accept criterion 3 is NOT met — the ESS relation survives conditioning intact

WS-596's third accept criterion is stated on the correlation, not on the level:

> *"The residual correlation between ESS share and the reported edge is measured and reported.
> **Driving |r| toward zero is the actual objective**; the sign flips are a symptom of it."*

Measured on the same six scored arms, each under its own propensity:

| | r(ESS share, edge) |
|---|---|
| marginal `pi_pool(a\|s)` | **−0.9432** |
| holding-conditional, held out | **−0.9835** |
| **|r| reduction** | **−0.0403 — it got WORSE** |

**Conditioning on the holding did not flatten the ESS relation. It tightened it slightly.
Criterion 3 is not met.** Verified by independent recomputation from the output JSON, not read
off the probe's own summary.

The probe's `VERDICT: SUPPORTED` string is computed on the edge LEVEL and does not evaluate
criterion 3. That is the third time in this investigation a summary string has been narrower
than the evidence underneath it (§4.1 the sign-blind classifier, §11.3 the SUPPORTED-on-an-
unfitted-model, and now this). The pattern is worth naming: **a verdict field encodes the
question its author was holding at the time, and stops being the answer as soon as the question
moves.**

#### Both statements are true, and neither replaces the other

| | |
|---|---|
| bias **level** | halves — 53.2% held out, controlled, real |
| bias **structure** | untouched — still tracks ESS at r = −0.98 |

#### Why, and it is a single number

    r(ESS share, reduction%) = +0.9973

The holding explains the bias almost exactly **in proportion to ESS share**:

| arm | ESS (marginal) | bias removed |
|---|---|---|
| never-fold-mixed-high | 0.486 | 70.5% |
| never-fold-mixed-low | 0.453 | 66.0% |
| never-fold | 0.439 | 64.1% |
| raise-everything-mixed-high | 0.300 | 46.2% |
| raise-everything-mixed-low | 0.239 | 39.4% |
| raise-everything | 0.218 | 33.1% |

High-ESS arms give up two-thirds of their bias to the holding; low-ESS arms keep two-thirds of
theirs. So the residual is concentrated exactly where the target policy leans hardest on a
**rare** action — where `pi_pool` assigns small probability and the importance weight is large.

(ESS itself RISES under the conditional — 0.44→0.63, 0.22→0.34 — because a propensity that
conditions on the holding matches the target policy better and pushes weights toward 1. The
mechanism is working. It simply does not touch the cross-arm structure.)

#### The hypothesis this leaves, with its falsifier

A weight is `pi_ours / pi_pool`. When `pi_pool(a|s)` is small, any error in it is amplified by
`1/pi_pool` — so an error in the TAIL of the propensity produces a bias that scales with weight
concentration, which is to say with ESS. Marginal `pi_pool(raise | bet) = 0.12`, and the
hierarchical shrinkage (`shrinkWeight = 10`) pulls rare-action propensities toward their parent
by construction.

WS-596's elimination list rules out the weight **cap** (`clippedShare` 0.0–0.4%, nothing hitting
it). It does **not** rule out the **estimate** of a small propensity. Those are different
quantities, and only the second one produces an ESS-scaled residual.

**Falsifiers, both cheap and neither run:**
1. Vary the behaviour policy's `shrinkWeight` and re-measure r(ESS, edge). If the relation moves
   with it, the shrinkage is the source.
2. Measure `pi_pool`'s calibration directly in its own tail — predicted versus observed frequency
   for rare actions, on held-out players. A propensity that is systematically high on rare
   actions produces systematically low weights, and vice versa.

#### Status of WS-596's five accept criteria

| # | criterion | status |
|---|---|---|
| 1 | every dominated arm returns its pre-registered sign at ESS < 40% | **NOT MET** — `never-fold` still +2.03 bb held out |
| 2 | `clone-the-pool` exactly 0.0000 under both estimands | **MET** — 0.0000 under all three propensities |
| 3 | residual r(ESS, edge) measured and reported; objective \|r\| → 0 | **MEASURED, NOT ACHIEVED** — −0.9432 → −0.9835 |
| 4 | the outcome model states what it was fitted on and its partition | **MET** — FIT/SCORE player split, leakage quantified at 86–99.9% in-sample |
| 5 | `call-every-large-bet` fires or reports `unexamined` with its reason | **MET** — `unexamined`, cause located in §10 |

**WS-596 is NOT complete.** Two of five criteria are open and both point at the same residual.
The item should stay open with this document as its state.
