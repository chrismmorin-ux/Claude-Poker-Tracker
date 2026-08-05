# What divergence IS — both candidates measured, then attributed to a layer

> **Status:** RESULT — 2026-08-05 · **Ticket:** WS-350 (FSA Phase 3, WS-324 AC4)
> **Program:** `prog-strategy-of-record` · **Governing decision:** [ADR-009](../adr/ADR-009-standard-of-record.md)
> **Result Card:** `docs/standard-of-record/cards/RC-layer-divergence.json` — `RC-layer-divergence-aa3f0447-1389589e`
> **Instrument:** `scripts/backtest/layerAblation.mjs` → `src/utils/standardOfRecord/divergence.js`
> **Read first:** [DISCLAIMER-AND-FAULT-REGISTER.md §1](DISCLAIMER-AND-FAULT-REGISTER.md)

---

## 0. The transfer limit, before any number

The corpus is HandHQ **online** cash, **July 2009**, 50NLH (SRC-011/012). The founder's game is
**live 9-handed 1/2–1/3**. Those are distinct populations and this repo never merges them. Every
figure below is therefore **transferred, not measured**, for the founder's game — that is
`FAULT-population-mismatch`, rank 1 of the suspected-fault register by expected damage.

Second limit: every figure here is an **unsigned distance**. Nothing below says which surface is
*better*. That question is an *edge*, `estimateEdge` in the hero-EV arm owns it, and reading a
divergence as an edge is the error this card's `metrics.notAnEdge: true` exists to block.

Third limit, stated because it is on the card: **the working tree was dirty at run time**
(`manifest.engineDirty: true`). The stamped commit `1389589e` does not fully identify the code
that ran — the uncommitted change set is WS-350 itself.

---

## 1. What was asked, and what was refused

FSA open question #2 has been open since WS-322: *what is the divergence function `d`* — KL, or
EV-difference? The instruction attached to it was **"decide in Phase 3, measure both."**

WS-324 built the entire attribution substrate around that question **without answering it**, by
requiring `d` as an argument with no default. WS-350 is the measurement that was owed.

**The thing this ticket named as the failure to avoid:** computing both measures and then
reporting the one that agrees with the prior finding. That is indistinguishable, in the output,
from having chosen honestly. So the primary was **pre-registered before the run**:

> **PRE-REGISTERED 2026-08-05T06:45:55Z — primary `ev-difference`, weighting `frequency`.**
> *Rationale (recorded verbatim on the card):* the estimand this repo acts on is money; ADR-009
> binds "comparative claims about strategy, model quality, or EV", and a surface that behaves
> differently at no cost has not changed the thing being claimed. KL is reported beside it, on the
> same volume, because it is the measure that would catch a surface whose behaviour changed
> everywhere while its own EV model happened to value both choices identically — which is exactly
> what a self-grading instrument (`FAULT-self-grading-circularity`) would look like from the
> inside. **If the two rank the candidates differently, that disagreement is the headline.**

`divergence.measureBoth` **throws** without a pre-registration. That refusal is the whole
mechanism; the rationale is required for the same reason `probabilityBasis` is required in the
fault register.

---

## 2. The run

| | |
|---|---|
| Deal Book | `handhq-allsites-50NLH-aa3f0447`, 60 corpus files, `sha256:aa3f0447…` |
| Hands read | 51,793 · **60 EVAL players** · 26 walk-forward checkpoints |
| **n** | **80 paired decisions**, **62 distinct situations** |
| Partition | `pool-train@50`, walk-forward enforced by `LeakageGuard` on every scored decision |
| Field | `behavior-policy@pool-train/12191obs` |
| Cluster unit | players |
| Atom set | `sha256:e8775bf6…`, 240 atoms (80 decisions × 3 surfaces) |
| Register version | `FR-1+e3867c10fc2a` — **already superseded** (see note) |
| Runtime | 2,399 s |

**Note on the register version, because it is the mechanism working rather than a defect.** This
card stamps `FR-1+e3867c10fc2a`; the register moved to `FR-1+8c4e65578ca2` within the same
session, as entries were edited concurrently. The stamp is a content hash, so it changed without
anyone remembering to bump anything — which is exactly the property that lets a fault confirmed
tomorrow find the results that depended on it yesterday. The card is not stale; it names the
register it *stood under*, which is what the field is for.

**Three surfaces, all real configurations of the shipped engine,** differing only in the
depth-2/3 refinement budget:

- `sfc-depth1` — 0 ms. The configuration that actually shipped for the life of the project
  (WS-334 measured zero depth-2 calls on a live evaluation). **REFERENCE.**
- `sfc-depth2-fast` — 250 ms. Candidate.
- `sfc-depth2-full` — 2000 ms, production's default. Candidate.

Two candidates is the **minimum for a ranking to exist at all**. With one, the two measures
cannot disagree about an order and "they agreed" would be a claim the data could not make.

A decision was kept only if **every** arm produced a policy (one decision dropped:
`sfc-depth1:no-combos`), so the contrast is exactly paired and no skip pattern correlated with
refinement budget can enter the divergence disguised as divergence. Both measures were computed
on **identical rows** — `volume.sameVolume: true`, `excluded: {}`.

---

## 3. THE HEADLINE — the two measures rank the candidates OPPOSITELY

Divergence from `sfc-depth1`, frequency-weighted (the pre-registered weighting), 95% paired CI:

| Candidate | **KL** (nats) | **EV-difference** (engine chips) |
|---|---|---|
| `sfc-depth2-fast` | **0.45368** [0.05873, 0.84864] | **2.24528** [1.03687, 3.45369] |
| `sfc-depth2-full` | **0.41487** [0.01823, 0.81150] | **2.27033** [1.14006, 3.40060] |

```
KL order:             sfc-depth2-fast  >  sfc-depth2-full
EV-difference order:  sfc-depth2-full  >  sfc-depth2-fast
RANKS AGREE:          NO
```

**This disagreement is the finding. It is not a tie to be broken by preference,** and per the
pre-registration it is the headline rather than a footnote.

### 3.1 But only ONE of the two orderings is admissible

Sorting point estimates always returns an order, including when the quantities are
indistinguishable. So the order carries its own admissibility test — the candidates differenced
**per decision**, paired CI (`divergence.pairwiseSeparation`, on the card):

| Measure | `fast − full`, paired mean | 95% CI | Admissible? | Decisions where they differ |
|---|---|---|---|---|
| KL | **+0.03882** | [0.02164, 0.05600] | **YES** | 25 / 80 |
| EV-difference | **−0.02505** | [−0.17043, +0.12033] | **no** | 67 / 80 |

So the honest statement is **not** "the two measures conflict symmetrically". It is:

> **KL separates the two candidates. EV-difference cannot, at n = 80.**
> The EV ordering (`full > fast`) is an ordering of noise; its CI straddles zero.

That asymmetry is more informative than a symmetric conflict would have been, and it is a
statement about the **estimand**, not about which measure is nicer:

- A **250 ms** refinement budget changes hero's *advice distribution* measurably more than a
  **2000 ms** budget does, relative to no refinement at all.
- Neither budget's *monetary* distance from depth-1 is distinguishable from the other's.

The plain reading: the extra 1,750 ms buys **behaviour that settles back toward the depth-1
answer** without buying a distinguishable change in what the decision is worth. That is a
hypothesis this run supports, not a conclusion it establishes — see §6.

### 3.2 The weighting flips the disagreement — and that is decision-flag #2, answered

WS-350's second decision flag asked whether divergence volume weights situations by frequency or
treats every situation equally, and required the card to say which it measured. It measured
**both**. All four orderings are on the card (`metrics.divergence.ranking.allOrders`):

| | `frequency` | `uniform` |
|---|---|---|
| **KL** | fast > full | fast > full |
| **EV-difference** | **full > fast** | **fast > full** |

**Under `uniform` weighting the two measures AGREE.** The disagreement exists only under the
pre-registered `frequency` weighting.

This is the concrete demonstration that the two weightings are not two roundings of one number.
Frequency weighting is dominated by the situations a player meets most often; uniform weighting
gives a situation seen once the same voice as one seen forty times. `sfc-depth2-full`'s
uniform-weighted KL is also the one arm whose CI touches zero (`admissible: false`), which is
what a signal concentrated in common situations looks like when you stop weighting by commonness.

**A card that had reported one weighting would have reported a different answer to the ticket's
central question depending on which one it picked.** That is the argument for computing both,
made by the data rather than by assertion.

---

## 4. What KL turns out to BE on this instrument

This is the sharpest thing the run says about the candidates, and it is a property of `d` rather
than of the surfaces.

`heroPolicy.mjs` applies **no smoothing** — "a zero here is a real statement". Correct there, and
it means KL(A‖B) is infinite exactly where the argmax flipped. A floor is unavoidable, and
`KL_FLOOR = 1e-6` is stamped in `manifest.constants`. Then:

| | `sfc-depth2-full` vs `sfc-depth1` |
|---|---|
| Decisions where **KL is exactly 0** | **64 / 80** (identical advice distributions) |
| Decisions where **EV-difference is exactly 0** | **0 / 80** |
| KL **maximum** observed | **13.8155** = `ln(1 / 1e-6)`, to the digit |
| EV-difference maximum observed | 29.04 chips |

The KL maximum being *exactly* the floor constant is the tell. **On this instrument KL is
substantially a flip-counter multiplied by a constant chosen by taste** — it is zero on the 80%
of decisions where the two surfaces agree, and on the decisions where they disagree its value is
set by `KL_FLOOR` rather than by anything about poker. That is `FAULT-constants-by-taste` living
*inside the measuring instrument*, which is a worse place for it than inside a model.

EV-difference has **no equivalent knob**, and is non-zero everywhere. That is not an argument that
it is the better measure — it is a structural difference between the two candidates that a reader
choosing between them needs, and that neither headline mean shows.

**The floor was swept**, `[1e-9, 1e-2]`, into a `fragility` margin on the card:

> **The KL *ordering* does not flip anywhere in the swept range.** The KL *magnitude* moves by a
> factor of `ln(1e9)/ln(1e2)` ≈ 4.5 across it.

So: the ordering is robust to the floor; the number is not. A KL magnitude quoted from this card
without its floor is a setting, not a measurement.

---

## 5. Layer attribution — the divergence is at `ev`

Contrast: `sfc-depth1` vs `sfc-depth2-full`. Localization is **evaluation-free**, in each layer's
own units (`sumsToTotal: false` — these are **not** shares):

| Layer | mean | 95% CI | verdict |
|---|---|---|---|
| `range` | **0.000e+0** | [0, 0] | n.s. — identical on every decision |
| `equity` | **0.000e+0** | [0, 0] | n.s. — identical on every decision |
| **`ev`** | **2.270e+0** chips | [1.14, 3.40] | **admissible — FIRST DIVERGENT LAYER** |
| `action` | 1.000e-1 TV | [0.046, 0.154] | admissible (downstream of `ev`) |

```
first layer:   ev   (from: localization)
structural:    none — the two surfaces declare identical stacks
share of total: UNAVAILABLE
```

**This is a positive control and it passed.** The two arms differ *only* in the depth-2/3
refinement budget, which enters the stack at `ev`. An instrument that named `action` — where the
divergence is *visible* — would have failed in precisely the way that let WS-291 hide for the
life of the project. It named `ev`.

The by-situation decomposition of the same divergence totals **2.2703 chips over 62 situations**
under the primary measure and **0.41487 nats** under the secondary — the same total each measure
reports at the top, which is the by-situation half of the sum identity holding on real data.

### 5.1 Why there is no SHARE, stated rather than omitted

`shareOfTotal` is `null`, and `shareOfTotal()` **throws** rather than dividing when handed a
non-summing instrument. A share requires `decomposeByLayer{Telescoping,Shapley}`, which need
layer functions **pinned** to this atom set's engine commit and evaluated on **hybrid** inputs no
atom records — for this stack, 2^L engine re-runs per decision at ~30 s each. Unaffordable at any
n worth reporting.

So **WS-350 AC4 is met for the layer and not for the share**, and the card says so in the payload
(`shareAvailable: false` plus the reason) rather than in prose a reader can skip. The sum identity
(AC5) is asserted **by test** on the pinned closed-form fixture, under **both** measures, in
`src/utils/standardOfRecord/__tests__/divergence.test.js`.

### 5.2 An unexplained zero, filed rather than smoothed

`range` and `equity` localize to **exactly** zero on all 80 decisions. `range` is expected — the
three arms share `ctx.rangeBefore` and `sampleCombos` is deterministic. **`equity` is not
obviously expected**: each arm makes its own `evaluateGameTree` call, and that path reaches
`monteCarloEquity`, which calls `Math.random()`. Three independent Monte Carlo estimates agreeing
to the last bit, 80 times, has two possible causes and this run does not distinguish them:

1. the equity computed on this path is deterministic (exact enumeration or an unsampled branch); or
2. equity is memoized across the three arms within a decision.

**The distinction matters.** Under (2) the paired contrast never re-samples equity, and a genuine
equity-layer difference between two surfaces would be **invisible to this instrument** — a
degenerate signal in the sense of `FAULT-degenerate-signal`. Under (1) the zero is a true
statement about the layer.

**Falsifier:** run one decision twice under an identical configuration and difference the
`equity` layer emissions. Non-zero ⇒ (1) is false and the memoization hypothesis stands. This is
filed here rather than guessed at.

---

## 6. What this card does NOT establish

- **It is not an edge.** No surface is claimed better than another. `metrics.notAnEdge: true`.
- **It does not settle whether depth-2 is worth running.** WS-334's card is the instrument for
  that, and the delete option was taken off the table by the founder on 2026-08-03 regardless.
- **It does not establish that a 2000 ms budget converges back toward depth-1.** The KL ordering
  is admissible, but a single ordering at n = 80 on one site is a hypothesis. POKER_THEORY's
  standing rule applies: *a single-site result is a hypothesis; two sites agreeing is a finding.*
  This ran on PS + FTP 50NLH pooled under one Deal Book, not as two agreeing sites.
- **It does not name a winner between KL and EV-difference,** and it is not supposed to. Both are
  now computable through one module on any pair of surfaces, both are stamped on every card, and
  the pre-registration makes the primary auditable after the fact. What the run adds is the
  *evidence a chooser needs*: KL is a floor-scaled flip counter here, EV-difference has no free
  constant but could not separate these candidates at this n, and their agreement is
  weighting-dependent.

### One acceptance criterion read against its literal wording

AC2 asks that a ranking disagreement be "reported as a finding **with its own Result Card**". The
disagreement is reported on **this** card
(`metrics.divergence.ranking.{ranksAgree, swaps, allOrders, pairwiseSeparation}`) rather than on a
second one, because it is a property of *the same estimand measured on the same volume* — the two
orderings come from the same 80 paired decisions. Minting a second card would put two cards on one
measurement and split the Ladder join on `estimand`. Flagged as a judgment call rather than
silently taken.

---

## 7. Replication

```bash
node scripts/backtest/layerAblation.mjs \
  --reference none --behavior-policy out/behavior-policy.json \
  --stakes 50NLH --max-files 60 --max-players 60 --max-decisions 80 \
  --refinement-fast 250 --refinement-full 2000 \
  --combo-samples 8 --trials 200 \
  --out out/layer-ablation.json \
  --card docs/standard-of-record/cards/RC-layer-divergence.json
```

`manifestProblems(card.manifest)` returns **none** — the card is publishable. Constants stamped:
`PRIOR_WEIGHT 10`, `ACTION_TAU_FRACTION {check:1, bet:0.3, call:0.3, raise:0.3}`,
`MIN_CONTINUATION_WEIGHT 0.05`, **`KL_FLOOR 1e-6`**, `REFINEMENT_BUDGET_MS_{REFERENCE 0, FAST 250,
FULL 2000}`, `HERO_POLICY_COMBO_SAMPLES 8`, `HERO_POLICY_TRIALS 200`.

**Not bit-reproducible.** `unseededSources` names `monteCarloEquity`'s `Math.random()` reached via
`heroPolicy → evaluateGameTree → handVsRange`, plus the depth-2 arm's wall-clock refinement
budget. Two runs agree to within Monte Carlo noise and a scheduling difference, not exactly. Do
not read a small difference between two of these cards as a change.

The `pairwiseSeparation` block was computed by the exported
`divergence.pairwiseSeparation` from **this run's own stored per-decision rows** after the
function landed, with **no re-measurement**, and the card was re-validated by
`resultCardProblems` before being rewritten.
