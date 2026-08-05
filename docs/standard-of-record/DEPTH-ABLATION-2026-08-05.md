# Depth-1 vs depth-2 advice — the WS-334 AC5 measurement

> **Status:** RESULT — 2026-08-05 · **Ticket:** WS-334 (AC5) · also serves WS-361's AC5
> **Program:** `prog-strategy-of-record` · **Governing decision:** [ADR-009](../adr/ADR-009-standard-of-record.md)
> **Result Card:** `docs/standard-of-record/cards/RC-depth-ablation.json`
> **Instrument:** `scripts/backtest/run-depth-ablation.mjs` → `depthAblationReport.mjs`
> **Read first:** [DISCLAIMER-AND-FAULT-REGISTER.md §1](DISCLAIMER-AND-FAULT-REGISTER.md)

---

## 0. What this is, and what it is not

**This is information. It is not a keep/delete verdict on depth-2.** The delete option was
taken off the table by the founder on 2026-08-03 (WS-334 `decision_flags`), on two grounds
that generalise past this ticket:

1. A null result is only evidence if the instrument is trustworthy, and this engine is not in
   a verified state. The subsystem under test was discovered dead a week ago; WS-300 had
   inverted range fixtures; WS-291 had a doc claim the data refuted; WS-276 shipped an inert
   parameter. A "no difference" measured on that substrate is a statement about the substrate.
2. A capability's worth is not its marginal effect on one axis today. Deleting is the one
   irreversible move.

The card carries `metrics.notAVerdict: true` so a reader who reaches it out of context still
meets the refusal.

**And the transfer limit, stated before any number.** The corpus is HandHQ **online** cash,
**July 2009**, numeric stakes (SRC-011/012). The founder's game is **live 9-handed 1/2–1/3**.
Those are distinct populations and this repo never merges them. Every figure below is
therefore **transferred, not measured**, for the founder's game — that is
`FAULT-population-mismatch`, rank 1 of the suspected-fault register by expected damage.

---

## 1. Which harness, and why the obvious one was wrong

"The WS-273 calibration harness" names two things, and only one of them can see depth-2.

**WS-273 as shipped** (`run.mjs` → `runner.mjs` → `calibrationMetrics.js`) scores **villain
action prediction**: Brier score, log-loss and a calibration curve over
`pi(villain action | state)`. Depth-2/3 does not touch that quantity at all. It refines
**hero's** EV across hero's options; the villain model it consumes is byte-identical either
way. Run a depth ablation against that harness and it returns exactly zero — for a reason
with nothing to do with depth-2. `FAULT-degenerate-signal`: a metric that cannot fail is not
evidence.

**WS-287 extended the same harness with a hero-EV arm** (`run-hero-ev.mjs` →
`heroEvRunner.mjs`), reusing its corpus reader, its POOL/EVAL partition, its leakage guard and
its walk-forward checkpointing — *"reuses the villain-side harness rather than standing up a
second pipeline"*. That arm scores the **recommendation** against realized chips. It is the
only instrument in the repo that can see a depth-2 change, so it is the one used here.

**No second comparison path was created.** ADR-009 guarantees every surface is scored by the
same instrument. The ablation enters as one more `piOurs` remap through the same
`estimateEdge` the headline, the baselines, the control and PBR already go through — exactly
how WS-331 added the PBR ceiling.

### One axis was available and deliberately not used

`calibrationMetrics.js` could score each arm's advice distribution against the action the
2009 player actually took, producing a log-loss per arm on one scale. That number would be
**agreement with the field**, and the field is the thing hero is trying to beat. A strategy
that improved would be expected to *disagree* more. Reporting it as a quality metric would be
`FAULT-degenerate-signal` in the other direction — a metric that moves for a reason opposite
to the one a reader would assume. It is named here so nobody re-derives it as an oversight.

---

## 2. Design — why the contrast is paired, and what that buys

Both arms are evaluated **at the same decision, in the same pass**, against the same realized
outcome and the same propensity denominator. A decision is kept only if *every* arm produced
a policy for it, so a skip pattern that correlates with depth cannot enter the contrast
disguised as a depth effect.

The population term then cancels identically:

```
edge(depth2) − edge(depth1) = (V₂ − V_pool) − (V₁ − V_pool) = V₂ − V₁
```

This matters more than it looks. `heroEvReport.MIN_CLUSTERS_FOR_CI = 30` exists because
**between-player variance is the dominant term** in an absolute hero-EV edge — it is what
moved the edge across earlier runs at fixed *n*. The pairing differences that term away. So:

| Quantity | Bar | Why |
|---|---|---|
| **Paired delta** | ≥ 2 players | Between-player variance is differenced out |
| **Advice divergence** | none | Outcome-free; needs no chips, no propensities, no CI |
| **Absolute arm edges** | ≥ 30 players | Exactly what the 30-cluster bar guards |

`admissibility.absoluteArmsQuotable` is a separate field from `admissibility.admissible` for
this reason. Conflating them is how a 3-player run got quoted on 2026-07-31.

### Two families of number, because one of them alone is ambiguous

1. **Advice divergence** — how often, and how far, refinement moved the recommendation.
   Outcome-free, so it is well determined at a sample size where the EV delta is not.
2. **The EV delta** — whether that movement was toward money, in bb.

Reporting only (2) would let *"the advice never changed"* and *"the advice changed and it did
not help"* print the same number. Those are opposite findings.

### The arms are two REAL configurations, not one real and one hypothetical

`depth1` is `refinementBudgetMs: 0`. That is not a synthetic control — WS-334 measured **zero
depth-2/3 calls on a live evaluation**, so depth-1-only is what actually shipped to the
founder for the life of the project. The contrast is between the engine as it was and the
engine as it now is.

---

## 3. Results

<!-- RESULTS:BEGIN -->

**Run:** 260 paired decisions · 22 contributing players · complete
**Deal Book:** `handhq-allsites-50NLH-1c560bcc` (300 files, 50NLH, `path+size`)
**Card:** `RC-depth-ablation-1c560bcc-67e9e14e` · register `FR-1+e3867c10fc2a`
**Control:** population-typical scored against itself = **0.0000 bb** ✅

### 3.1 The advice moved — and almost entirely on one street

| Street | decisions | top-action flips | flip rate |
|---|---:|---:|---:|
| flop | 138 | 1 | **0.7%** |
| turn | 77 | 3 | **3.9%** |
| **river** | **45** | **36** | **80.0%** |

Overall: **62.7% of decisions byte-identical**, **15.4% top-action flips**, mean
total-variation distance **0.130** (max 1.0).

**Direction of every flip:**

| flip | count |
|---|---:|
| `bet → check` | 30 |
| `raise → fold` | 6 |
| `raise → call` | 2 |
| `fold → call` | 1 |
| `call → fold` | 1 |

**38 of 40 flips move toward passivity**, and 36 of 40 are on the river.

This is the sharpest thing in the run. It is also a **localisation**, which the ad-hoc
`dumpGameTreeEV` measurement could not produce: on the river the refinement that fires is
**`riverPerCombo`** (`gameTreeEvaluator.js:1327`) — `computeRiverCheckEV` /
`computeRiverBetEV` / exact call equity — **not** the depth-2 sampling framework. Every
depth-2 branch is explicitly `needsDepth2: street !== 'river'`. So the flop and turn, where
`computeCallDepth2EV` / `computeBetCallDepth2EV` / `computeDepth3BarrelEV` actually run,
changed the top action **4 times in 215 decisions**.

### 3.2 The EV delta does not resolve

| Quantity | Value | 95% CI (cluster bootstrap over players) |
|---|---:|---|
| **depth2 − depth1 (paired)** | **−0.4711 bb** | **[−2.7653, +1.3290]** |

The interval **includes zero**. Decisions where the two arms carry different importance
weights: **95 of 260 (36.5%)**.

**Read that as "not resolved", not as "no effect".** At 260 decisions and 22 players the
instrument cannot separate a half-big-blind effect from nothing, and §0 already says why a
null here is a statement about the instrument.

### 3.3 The absolute arms — recorded, NOT quotable

| Arm | edge vs population-typical | CI | ESS |
|---|---:|---|---:|
| depth1 (`refinementBudgetMs: 0`) | −1.0007 bb | [−11.6971, +9.7036] | 39.5 |
| depth2 (`refinementBudgetMs: 2000`) | −1.4719 bb | [−12.1990, +7.6727] | 48.0 |

`admissibility.absoluteArmsQuotable: false` — **22 players is below the 30-cluster bar.**
Their intervals span 20 bb, which is what that bar exists to prevent anyone quoting past.
They are printed because suppressing arithmetic hides trends, and flagged because between-player
variance is the dominant term in them and the pairing does not help them.

### 3.4 Against WS-361

WS-361 records two suspicious depth-2 outputs and names one common suspect:
`E[max(check, bet)]` optimism, i.e. WS-295's optimizer's curse.

**Neither of WS-361's two named spots is reproduced here** — this run scores corpus decisions,
not the eight hand-picked `dumpGameTreeEV` scenarios, so the OESD-priced-at-−26.2 spot and the
AA-on-A72 spot were not in the decision set. Nothing here confirms or refutes them.

**What the run does add is a location, and it is not where the suspect lives.** The
pull toward passivity is real, large and one-directional — but it is concentrated **80% on the
river**, where the depth-2 `E[max(...)]` machinery **does not execute at all**. Two candidate
readings, and this run does not separate them:

1. `riverPerCombo` has its own, separate bias toward `check` — plausible because
   `computeRiverCheckEV` replaces the check candidate's EV wholesale (`checkCandidate.ev = riverCheck.ev`)
   while `computeRiverBetEV` replaces the bet candidate's, so the two are re-priced by
   different functions and any asymmetry between them lands directly on the comparison.
2. Depth-2's flop/turn effect is genuinely small on corpus spots, and WS-361's two examples
   are unrepresentative of the spots the corpus actually contains.

**This does not weaken WS-361 — it widens it.** Its accept criteria are written entirely
around `gameTreeDepth2`; the measurement says the largest observed behaviour change is
somewhere else. Worth adding `riverPerCombo` to its scope before the optimism bias is
quantified, or the quantification will be run on the stage that moved the fewest decisions.

### 3.5 Read alongside WS-295 — and one caveat it raises about the flip count

WS-295 landed independently the same night (`5e9969f3`) and measured the `E[max(...)]` suspect
directly with a replicate design: **the optimizer's curse is real but accounts for ~9%** of
depth-2's stated-EV rise, and is non-zero on only 1 of 8 nodes. It is **refuted as the primary
cause** of WS-361's disagreements. The mechanism it found instead is **estimator variance** —
depth-2 inflates per-action estimator SD by 1.4x to 9.1x, and on one node argmax stability
falls to **0.50**, i.e. the recommendation flips on the RNG seed alone.

**That is a direct threat to the flip count above, and it has to be said.** This run evaluates
each decision **once** per arm, so a top-action flip cannot be distinguished from seed noise
*decision by decision*. Two features of the distribution argue the bulk of it is not noise, and
neither is conclusive:

- **Direction.** 38 of 40 flips move the same way. Seed noise is roughly symmetric; a 38–2 split
  is not what re-rolling an unstable argmax produces.
- **Street.** The flips are on the river, and the river is the one street where refinement is
  **not** Monte Carlo — `riverPerCombo`'s equity is exact hand comparison, no sampling
  (`gameTreeEvaluator.js:1325`). WS-295's variance mechanism lives in the sampled depth-2/3
  path, which is precisely the flop and turn, where this run measured **4 flips in 215
  decisions**.

So the two results are consistent and point the same way: the sampled depth-2 path changes the
recommendation rarely and noisily, while the exact river path changes it often and in one
direction. **The falsifier is cheap and is not run here** — replicate this ablation at k seeds
and report the flip rate that survives across all of them. Until then the 80% river figure is
an upper bound on a systematic effect.

<!-- RESULTS:END -->

---

## 4. Replication

```bash
node scripts/backtest/run-depth-ablation.mjs \
  --reference none \
  --behavior-policy out/behavior-policy.json \
  --stakes 50NLH --max-files 300 --max-players 300 \
  --max-hands-per-player 60 --max-decisions 260 \
  --out out/depth-ablation.json \
  --card docs/standard-of-record/cards/RC-depth-ablation.json
```

Runtime ≈ **100 minutes** on this desktop: 260 decisions × 10 sampled combos × 2 arms = 5,200
`evaluateGameTree` calls, and the depth-2 arm is the expensive half by construction.

`--max-hands-per-player 60` is doing real statistical work and is not a speed knob.
Uncapped, the first EVAL player supplied **100 consecutive decisions and the run still had
one cluster** — a cluster bootstrap over one player returns `null`, so the delta had no
interval at all. Capping hands per player spreads the same budget over ~8 decisions each and
bought 22 clusters for the same wall time. It is part of the Deal Book's `sliceSpec` and
therefore inside the content hash.

Everything else needed is in `manifest` on the card: the engine commit, the Deal Book hash,
the partition, the bootstrap seed, and the constants — including the two refinement budgets
that *define* the arms, which a card without them could not reconstruct.

### What the manifest admits it cannot promise

`unseededSources` is a **positive claim** when empty, so it carries three entries here:

| Source | Kind |
|---|---|
| `pokerCore/monteCarloEquity.js` | `Math.random()` in the shuffle and weighted draw — present in **both** arms |
| `gameTreeSampling.js` / `gameTreeDepth2.js` | `Math.random()` in stratified sampling and mini-rollouts — **depth-2 only** |
| `gameTreeEvaluator.js` refinement clock | **Wall-clock dependence, not randomness** |

The third is the one that matters and it is not ordinary Monte Carlo noise. The refinement
budget is enforced against `Date.now()`, and per-stage time is capped by `MAX_STAGE_SHARE`.
**Which refinement stages complete depends on machine speed and load**, so the depth-2 arm is
not reproducible even in principle on another machine — a re-run can differ because a stage
that finished before did not finish again. The depth-1 arm (budget 0) has no such dependence
and is stable.

`MAX_STAGE_SHARE` itself is a module-local `const` in `gameTreeEvaluator.js:783` and is not
exported, so it cannot be read through the harness loader. It is recorded as a
**`knownDivergence` with `agrees: null`** rather than dropped into `constants`: `null` is the
honest three-valued statement *"transcribed from source, unverified at run time"*. Putting it
in `constants` would assert a reading that did not happen — the exact commitment
`replicationStamp` refuses to make for `PRIOR_WEIGHT`.

---

## 5. Where this sits against the register

**Eleven of the eighteen entries' matchers select this card**, none threw, and none of them
flags every card — so the retroactive-contamination mechanism has a real domain for the first
time. The table below is the register's own verdict, not an author's declaration.

| Entry | Matcher selects it? | How it bites here |
|---|---|---|
| `FAULT-population-mismatch` (1) | **no — and correctly so** | Its matcher is `isLiveFacing(card) && onOnlineCorpus(card)`; this card makes **no live claim**, so it is not selected. The limit binds the moment anyone reads a figure here as a statement about the founder's game — which is why §0 states it before any number. |
| `FAULT-temporal-staleness` (2) | yes | Sixteen years of drift in the field this is scored against. |
| `FAULT-modelled-rake` (3) | yes | 5%/$3 cap assumed; live 1/2 rake is roughly twice as punishing. |
| `FAULT-static-field-overstatement` (4) | yes | The corpus field never adapts to hero's advice. |
| `FAULT-masked-hole-cards` (5) | yes | Advice is range-marginalized over sampled combos, not cards-known. |
| `FAULT-self-grading-circularity` (6) | yes | Scored on realized chips (an outside check), but *which* action is recommended comes from the arithmetic WS-361 suspects. |
| `FAULT-horizon-bias` (8) | yes | One-decision horizon. Not a winrate. |
| `FAULT-monte-carlo-irreproducibility` (9) | yes — **and worse than usual** | Plus wall-clock stage selection, above. |
| `FAULT-precision-overstatement` (7) | yes | ESS, not *n*, and for the delta specifically the honest denominator is the **discordant** count (95, not 260). |
| `FAULT-constants-by-taste` (10) | yes | `MAX_STAGE_SHARE` is unswept and unreadable at run time. |
| `FAULT-degenerate-signal` (17) | yes | Why the villain-prediction axis was refused — see §1. |
| `FAULT-hand-clustering` (15) | yes | Clustered on players, which is the mitigation, not an exemption. |

---

## 6. Consequences

<!-- CONSEQUENCES:BEGIN -->

1. **WS-334 AC5 is closed.** The delta is on one scale (bb of hero hand value, through the
   same `estimateEdge` every other arm uses) and resolves to a Result Card with a complete
   manifest. It reports **no resolvable EV difference** and **a large, localised advice
   difference** — and per the founder's 2026-08-03 ruling, neither is a verdict.

2. **WS-361 should widen to `riverPerCombo`.** Its accept criteria target `gameTreeDepth2`;
   80% of the observed flips happen on the street where that module does not run. WS-295 has
   already refuted `E[max(...)]` as the primary cause and located a variance mechanism in the
   *sampled* path — which is the flop and turn, where this run measured 4 flips in 215
   decisions. Neither result explains the river.

3. **The next measurement on this instrument is a seed replicate, and it is cheap.** Run the
   same ablation at k seeds and report the flip rate that survives all of them. WS-295 measured
   argmax stability as low as 0.50 at depth-2, so the single-evaluation flip counts here are an
   **upper bound** on a systematic effect. Nothing else in this card needs re-running to get it.

4. **The three published `dumpGameTreeEV` percentages should not be re-quoted.** They are
   percentage changes in the engine's own EV numbers on eight hand-picked scenarios, carry no
   manifest, and cannot be placed beside any other figure. This card supersedes them as the
   citable form of the comparison.

5. **The repo now has a second Result Card, and the fault register has a domain.** The
   baseline audit (2026-08-04, F3) recorded `result_cards_in_repo: 0`, which left
   `contaminatedCards` / `flagContaminated` as correct code that could never flag anything.
   This card is selected by **11 of 18** register entries, no matcher threw, and none of them
   flags every card — so confirming one of those faults tomorrow now retroactively reaches
   something.

   `FAULT-population-mismatch`, the top-ranked entry, does **not** select it: its matcher is
   `isLiveFacing(card) && onOnlineCorpus(card)`, and this card makes no live claim. That is
   the matcher working correctly. The transfer limit binds the moment anyone reads a number
   here as a statement about the founder's game, which is why §0 states it before any figure.

6. **One honest weakness in this run, stated rather than buried.** `manifest.engineDirty` is
   `true` and several sessions were editing `src/utils/exploitEngine/` concurrently (WS-334
   uncommitted work, WS-365 landing mid-run). The engine graph is loaded once at run start, so
   the *run* is internally consistent — but the stamped commit `67e9e14e` does **not** identify
   the code that produced these numbers. A clean-tree re-run is the cheapest way to upgrade
   this card, and it needs no new code.

<!-- CONSEQUENCES:END -->
