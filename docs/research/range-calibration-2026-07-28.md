# Range calibration — the inferred range excludes the hand actually held

Date: 2026-07-28 · Program `domain-correctness` · Read-only measurement, no code changed
Sample: **321,196 hands · 1,300 players · 32,779 postflop decisions · 8,996 revealed acting-seat
hands + 5,598 revealed villain-seat hands · two independent sites (FTP, PS)**

> Corpus caveat: HandHQ online cash, July 2009, 50NL (SRC-011).

## The question nobody had asked

At showdown the corpus reveals what a seat actually held. The engine, at every decision,
carries an *inferred range* for that seat. **Nothing in this repo had ever compared the
two.** Showdown cards are captured and used — for sizing tells and `showdownResults` — but
they are never fed back into range inference and never used to check it.

The check is one line of poker logic: **does the inferred range assign any probability at
all to the hand the player turned over?** A model that assigns probability zero to an event
that occurred is not miscalibrated. It is falsified.

## Headline: it assigns zero, often, and it gets worse every street

**Acting seat** — the range `decisionAccumulator` tracks:

| Street | Coverage (FTP) | Coverage (PS) | Info beyond uniform, given covered |
|---|---|---|---|
| Flop | 89.1% | 86.7% | +0.150 / +0.114 |
| Turn | 71.4% | 69.2% | +0.061 / +0.020 |
| River | **55.7%** | **56.7%** | **−0.021 / −0.026** |

Two sites, independently, to within ~2 points. By the river the range **excludes the true
hand ~44% of the time**, and on the hands where it does contain it, it is *worse than
assuming every combo equally likely*.

The preflop assignment is fine (92.6% coverage at the first postflop decision). **All of
the damage is postflop narrowing, and it compounds street by street.**

### Coverage is measured against the honest baseline

A wide range gets high coverage for free, so coverage is always reported against
`retained` — the share of all possible combos the range kept, i.e. what random elimination
of the same severity would score. `lift = coverage / retained`. A lift near 1.0 means the
eliminations are effectively arbitrary.

## Where it actually bites: the range the game tree consumes

`gameTreeContext:219` narrows the villain's range before every EV computation. That range —
the one that decides what the engine recommends — has **63.8% coverage overall**. The engine
makes its recommendation against a model of villain that has ruled out villain's actual hand
**more than a third of the time**.

Broken down by what villain did:

| Villain action | Coverage | Retained | Lift | Info given covered |
|---|---|---|---|---|
| call | 87.2% | 42.9% | 2.03 | +0.270 |
| bet | 68.2% | 31.6% | 2.16 | +0.226 |
| **check** | 60.5% | 49.9% | **1.21** | **−0.027** |
| **raise** | **55.2%** | **10.8%** | 5.09 | +0.223 |

### Two specific defects fall out of that table

**1. The engine structurally cannot see a bluff-raise.** Facing a raise it keeps the top
**10.8%** of combos by equity and discards the rest — and misses villain's actual hand
38–45% of the time (55.2% FTP / 62.4% PS coverage). That is not a tuning error; it is what
"keep the top N% by equity" *means*. A bluff-raise is by definition a bottom-equity combo,
so the representation cannot hold one.

The consequence is directional and always the same way: the engine believes a raising range
is nearly pure value, so **hero over-folds to raises**. POKER_THEORY §4.2 makes bluff-catching
depend entirely on villain's bluff frequency in exactly this spot — the model has set it near
zero by construction.

**2. The check branch is close to information-free.** Lift 1.21 (FTP) / 1.31 (PS) against a
random-elimination baseline, and *negative* information within the range (−0.027 / −0.181).
Keeping the bottom 65% plus a 10% trap slice barely distinguishes anything.

## And `gameTreeDepth2` re-applies the cut, 2–3 more times

Depth-2/3 refinement chains `narrowByBoard` inside a single evaluation
(`flopCallRange → turnRange → turnCallRange`):

| Successive narrowings | Coverage | Retained | Info given covered |
|---|---|---|---|
| 1 | 72.0% | 41.1% | +0.089 |
| 2 | 57.8% | 29.1% | +0.007 |
| 3 | **46.9%** | 21.8% | **−0.181** |

**The deep branches of the tree are evaluated against a range that excludes villain's actual
hand more often than it contains it.** Those branches are what produce the multi-street plan.

## Root cause — an anti-pattern this repo has already named twice

`postflopNarrower.js:696`:

```js
const keepCount = Math.max(1, Math.floor(allCombos.length * continuationRate));
// … keep the top `keepCount` by equity; every other cell → result[idx] = 0
```

A **hard quantile cut**. Everything below the line is zeroed, and the cut is re-applied each
street, so eliminations multiply geometrically — which is precisely the 89 → 71 → 56 decay.

The repo's own doctrine already forbids this shape, in two places, for other modules:

> *DO NOT use bucket labels when per-combo equity is available — **use the logistic**.*
> *DO NOT resolve context with a threshold … **Let the posterior self-weight**.*
> — `exploitEngine/CLAUDE.md`

WS-285 found and fixed exactly this bug in the villain model's context hierarchy and recorded
it as an overturn. The range engine has the same bug, on the live recommendation path, and it
had never been measured.

§6.5 states the correct form: `P(hand | action) ∝ P(action | hand) × P(hand)`. The code
implements `P(action | hand)` as a hard 1/0 indicator rather than a probability. The fix is to
make it a probability — a logistic of per-combo equity — so that an unlikely combo is
*down-weighted*, never *eliminated*.

## The plumbing gap that kept this invisible

Showdown cards live on `gameState.showdownCards`. Inferred ranges are computed inside
`decisionAccumulator` and, until today, were never emitted at all. Nothing joins them.

`decisionAccumulator` *does* read `playerShowdown` — and uses it only for `sizingTells`
samples and a `handShown` field on showdown results. **It never reconciles the range it is
carrying against the hand it just learned the player held.** The ground truth and the
inference sit two hundred lines apart in the same function and never meet.

That missing join is why a defect this large survived on the live path unnoticed. The
abstraction that should exist: one accessor returning, for a seat at a decision point,
`{ revealed, range, provenance }` — so that "what do we believe" and "what was true" are the
same lookup, and any consumer can be scored against reality.

## What this does to the hero-EV number (WS-287)

It makes it provisional. `π_ours` marginalizes the engine's advice over exactly these ranges.
The estimator machinery is sound — the population-vs-itself control returns exactly 0.000 on
real data — but its input is a distribution that excludes the truth up to 44% of the time.
Narrowing that confidence interval with more compute would buy precision on the wrong
quantity.

## Caveats, stated plainly

- **The villain-side arm uses DEFAULT continuation rates** (`DEFAULT_CONTINUATION_RATES`:
  raise 0.12, bet 0.40, call 0.55, check 0.65), not the model-derived rate
  `gameTreeContext` passes at runtime. Directionally representative of the engine path; exact
  numbers would move with a live villain model.
- **Selection is, if anything, favourable to the model.** Revealed hands reached showdown,
  i.e. they *continued* — and the narrowing is built to retain continuing hands. So these
  numbers likely flatter it.
- **The hand-strength breakdown failed** — nearly every revealed hand classified as "strong",
  which is a bug in my banding, not a finding. Not reported.
- One stake (50NL), 2009 online. Coverage is a structural property and unlikely to be
  era-dependent; the exact percentages are corpus-specific.

---

# AFTER — the fix, measured (WS-291, same session)

`narrowByBoard` now computes `P(action | combo)` as a **probability** — a logistic of
per-combo equity — instead of a hard top-N indicator. Nothing is ever zeroed.

## The structural defect is gone

| Surface | Before | After |
|---|---|---|
| Acting seat — flop | 89.1% | **94.0%** |
| Acting seat — turn | 71.4% | **94.2%** |
| Acting seat — river | **55.7%** | **93.9%** |
| Villain seat (game tree input) | 63.8% | **87.4%** |
| Chained ×1 / ×2 / ×3 (depth-2/3) | 72.0 / 57.8 / **46.9%** | **87.4 / 87.4 / 87.4%** |

Two things to read here. Coverage **no longer decays by street** — the compounding is
eliminated, which is the whole point. And the chained figures are now *flat*: re-narrowing
inside a single evaluation no longer destroys the range, so the deep branches that produce
the multi-street plan see the same range the top level does.

Unconditional discrimination improved in step: acting seat Δlog **−3.744 → −0.910**,
villain seat **−5.272 → −1.800**, chain-depth-3 **−8.314 → −2.168**.

**The residual ~6% (acting) and ~13% (villain) is no longer this function's doing.** Those
are hands the *preflop* range never contained — `narrowByBoard` cannot resurrect a cell its
input gives zero weight. That is a separate, upstream gap.

> **A comparison to distrust.** Δlog *given covered* is not comparable across the fix,
> because the conditioning set changed (74.6% → 94.0% of decisions). The unconditional
> Δlog above is the like-for-like number. Sweep arms below *are* directly comparable —
> every arm scores the same decisions at identical coverage.

## Both parameters were measured, and both results are humbling

**Softness** (`TAU_FRACTION`), swept at identical coverage:

| tau | 0.10 | 0.15 | 0.30 | 0.60 | 1.50 | 10 *(≈ no narrowing)* |
|---|---|---|---|---|---|---|
| Δlog | −1.874 | −1.792 | −1.636 | **−1.590** | −1.605 | −1.644 |

Sharpening toward the old cut is monotonically worse, and **anything below ~0.30 loses to
switching equity-narrowing off entirely.** The best the mechanism achieves over doing
nothing is ~0.05 nats. That is the same shape as WS-285: an elaborate, never-measured
mechanism barely beating the trivial alternative.

Shipped value is **0.30**, not the optimal 0.60, and the reason is stated rather than
hidden: at 0.60 the check branch's U-shape collapses and the model can no longer represent
a slowplay at all. Losing the ability to see a trap — which is what bluff-catching depends
on — is not worth 0.046 nats on a proxy metric.

**Floor** (`MIN_CONTINUATION_WEIGHT`) swept 0.01–0.40 across both sites: optimum 0.05, and
the surface is flat and non-monotone across 0.03–0.25. **The flatness is the finding** —
what mattered was moving off zero, not which positive value replaced it. 0.05 is also the
figure `RANGE_ENGINE_DESIGN.md §4.3` uses for its own "rare but not zero" illustration.

## Two bugs found while validating the fix

**1. The trap term could never trap.** In the check branch the bump was scaled by the
interquartile range while the weak term spans the full equity range — so it could at best
lift the strongest combos *level* with the middle, never above. The U-shape had silently
degenerated into "checks are weak hands", the exact read that loses money to a slowplayer.
Now scaled by the full span (`TRAP_LIFT`).

**2. The engine's behavioural test fixtures are inverted** (filed as WS-300). `topRange(20)`
returns the *weakest* 20% — `22 32o 42o 52o…` — and `tightRange()` decodes to
`22 33 44 55 66 32o 32s 42o 42s 52o 43o` while its comment claims "AA-TT, AK, AQ". Index 0
is deuces, not aces.

This surfaced because one behavioural test failed after the fix: hero's 33 on Q-J-T scored
0.645 equity against `tightRange()`, breaching a `< 0.60` assertion. **The engine was
right and the fixture was wrong** — 33 genuinely beats most of that junk, and the assertion
had only ever held because the old hard cut discarded the junk before equity was taken. A
broken fixture and a broken narrowing had been cancelling out. Against a real tight range
hero equity is **0.04**, the poker-correct answer.

The implication is uncomfortable and worth stating plainly: on range-dependent behaviour,
a large green suite was verifying much less than its pass count implied.

## Still open after this fix

- **Preflop ranges** supply the residual zeros (~6% / ~13%). Postflop narrowing is no
  longer the binding constraint; the preflop action-range assignment is.
- **Equity-narrowing earns very little.** ~0.05 nats over not narrowing at all. Whether the
  mechanism deserves its complexity is now a measurable question, not an aesthetic one.
- **The `check` slice is the worst performer** (Δlog −2.933 vs −0.937 for `bet`), even after
  the trap fix. Checks may simply carry little equity signal — or the U-shape may still be
  the wrong model for them.
- The villain-side arm still uses **default continuation rates**, not the model-derived
  rate `gameTreeContext` passes at runtime.

## Close-out pass — SPR-158, 2026-07-28 evening

Independent re-measurement before closing WS-291, run **separately per site** (400 files /
600 players each — 349k hands FTP, 195k PS) so the "both sites" criterion is answered
directly rather than pooled. Everything above reproduces.

### The measured floor is now the shipped floor

The sweep above concluded 0.05 and the code still held **0.03** — measured but never
applied. It is now 0.05, with the sweep table written into the constant's doc comment so
the next reader sees the evidence, not the conclusion. Re-swept independently, twice: first
on a small slice across a wide grid, then at full scale on the three values that mattered.

Wide grid (60 files/site) — establishes the shape:

| floor | 0.01 | 0.03 | **0.05** | 0.10 | 0.15 | 0.25 | 0.40 |
|---|---|---|---|---|---|---|---|
| FTP Δlog\|cov (n=974) | +0.227 | +0.242 | **+0.251** | +0.253 | +0.239 | +0.252 | +0.213 |
| PS Δlog\|cov (n=866) | +0.104 | +0.113 | **+0.117** | +0.105 | +0.090 | +0.103 | +0.074 |

Full scale — confirms the pick at ~8× the sample:

| floor | 0.03 | **0.05** | 0.10 |
|---|---|---|---|
| FTP Δlog\|cov (n=7,793) | +0.205 | **+0.210** | +0.202 |
| PS Δlog\|cov (n=6,194) | +0.163 | **+0.167** | +0.157 |

0.05 is the argmax on **both sites at both sample sizes**. The margin is small (~0.005
nats) and the wide grid is flat and non-monotone across 0.03–0.25 — so the finding is "move
off zero and land somewhere sane", not "0.05 is special". Treat further refinement as noise
until a paired test says otherwise.

One edge case was closed while applying it. `continuationRate` is clamped to a minimum of
0.05, so a floor of exactly 0.05 could land the solver on `target = 0` and return a *flat*
range — every combo equal, the action treated as carrying no information at all. The floor
is now capped at 90% of the rate. A rare action is weak evidence, not no evidence.

### Per-site, and where the criteria actually landed

Villain seat — the range the game tree consumes, so the one that decides recommendations:

| | FTP (n=7,793) | PS (n=6,194) | before |
|---|---|---|---|
| coverage overall | 87.7% | 88.6% | 63.8% |
| — facing a **raise** | 92.9% | 92.7% | **55.2%** |
| — facing a **bet** | 90.5% | 91.1% | 68.2% |
| — facing a **check** | 84.2% | 86.3% | 60.5% |
| chained ×1 / ×2 / ×3 | 87.7 flat | 88.6 flat | 72.0 / 57.8 / 46.9 |
| Δlog\|cov flop / turn / river | +0.301 / +0.193 / **+0.076** | +0.211 / +0.158 / **+0.112** | +0.150 / +0.061 / **−0.021** |

**The defect this ticket was filed for is closed.** Facing a raise, the range went from
retaining 10.8% of combos and missing villain's hand 45% of the time to covering it ~93%,
with the strongest discrimination of any branch (Δlog|cov +0.82). The engine can now hold a
bluff-raise, so hero stops systematically over-folding to raises.

**The river is no longer information-free.** It was *negative* before (−0.021 / −0.026) and
is positive on both sites now. Worth flagging that the smaller 60-file slice showed it at
≈0; the full-scale run is the one to believe, and the disagreement is a caution against
reading these slices at small n.

**Where the stated criteria still miss, and why it is not this function.** WS-291 asked for
~100% coverage and positive discrimination *overall*. Coverage plateaus at ~88% and the
*unconditional* Δlog stays negative — both driven entirely by ranges that never contained
the hand in the first place, which narrowing cannot resurrect. Filed rather than fudged:

- **WS-302** — the *preflop* range hard-zeros 30–37% of the grid (`buildBaselineRange`:
  106–119 of 169 cells non-zero by position). That is the whole remaining coverage gap, and
  the same defect one layer up. Until it lands, unconditional Δlog is a measure of preflop
  assignment, not of narrowing.
- **WS-303** — the **check** branch scores *worse than uniform* (Δlog|cov −0.082 FTP /
  −0.095 PS) despite being the most common action in the sample (3,913 of 7,793 FTP
  decisions), and re-narrowing keeps sharpening: +0.245 → +0.135 → **−0.074** (FTP),
  +0.159 → +0.010 → **−0.239** (PS). Coverage no longer decays with depth; discrimination
  still does.

### The villain model is downstream of this, and was re-scored

`narrowByBoard` feeds `decisionAccumulator`, so WS-273's harness was re-run
(`--reference none`, 104 eval players, **4,216 scored decisions**):

| | this run | 2026-07-26 baseline |
|---|---|---|
| log-loss | **0.7528** (prior 0.8062) | 0.7871 (prior 0.8105) |
| accuracy | **58.7%** (prior 42.8%) | 54.2% |
| lift | **+6.6%** | +2.9% |

No regression — better on every metric. Stated honestly, this is **not** an isolated A/B of
WS-291: the scan is larger than the baseline's (4,216 vs 1,076 decisions) and other engine
work has landed in the tree since. It establishes the model is healthy, not that this change
alone caused the improvement.

### Two things the change cost, both measured

- **Compute.** Nothing is zeroed, so `enumerateCombos` returns ~2.4× more combos (456 →
  1081 on a flop). A depth-2 evaluation went 8.09 s → 8.70 s — **7%**. The interesting
  number is the other one: 8.5 s for a single depth-2 call while `gameTreeEvaluator` budgets
  150 ms for the whole evaluation, and `computeCallDepth2EV` accepts no time budget at all.
  Filed as **WS-301**. One test's limit was raised 15 s → 30 s (it passes at 18 s).
- **A drill-content snapshot moved**, as designed (RT-108 exists to catch exactly this).
  Reviewed rather than blind-accepted: every node's combo count rises to the full live set
  (43 → 79) while total weight is roughly preserved, and bucket shares shift toward weak
  holdings (one flop node: air 8.9% → 38.9%, strong 77.4% → 41.7%). That is the correction
  itself — a continuing range that had been purged of air now carries it at low weight. One
  river node flips to `isWeaklyCapped`, consistent with its nut share falling 5.2% → 2.9%.

## Recommended work

1. **Holding-knowledge primitive** — `{ revealed, range, provenance }` for a seat at a
   decision point. The missing join.
2. **Range calibration as a standing metric** — the probe shipped here
   (`scripts/backtest/rangeCalibrationProbe.mjs`, `run-range-calibration.mjs`) becomes the
   instrument. Baseline recorded above so the fix has a before/after.
3. **Replace the quantile cut with a logistic of per-combo equity.** Never zero a combo.
   Re-measure with (2).
4. **Then** re-run hero-EV on ranges that are calibrated.

Note that (3) changes what the founder sees **at the table**, not just in the backtest:
`liveAdvisor/computeHelpers.js` narrows through the same function.
