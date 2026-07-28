# Grand Unified Theory (GUT) — charter, primitives, regimes, analogy register

**Status:** OPEN — charter session 2026-07-28. No production code. No engine run yet.
**Proposed by:** Owner, 2026-07-28 — *"throw a lot of accurate high dimensional concepts and theory into the same space, and once anything is built the question has to ask how they are interlinked… otherwise we observe the 'magnetic field' of poker when we should be focusing on its quarks."*
**Terminology ratified:** "Grand Unified Theory" is adopted as the project name for the search itself — the thing the individual engines, scores, and drills are fragments of.
**Precedent:** `docs/projects/poker-shape-language/` ran this exact discipline once already, for *visualisation*. Its `voices/` + `roundtable.md` (six expert voices, six graded tensions T1–T6, explicit cuts) is the format this project inherits. GUT is the same method pointed at *decision theory*.

---

## 1. The organising distinction — quarks, not the magnetic field

The owner's framing has an exact home in existing doctrine. `POKER_THEORY.md §7` already says it:

> *"Every decision derives from game state, not labels. Labels are outputs of the decision process, not inputs."*

Restated in the owner's vocabulary:

| | Poker | Status |
|---|---|---|
| **Quarks** (fundamental, measured or enumerable) | per-combo equity · combinatorics & card removal · pot size and bet size → price · effective stack → SPR · players remaining to act · action history · showdown observations | **Legal as inputs** |
| **Magnetic field** (emergent, coarse-grained) | position labels (EP/LP/IP/OOP) · style labels (Fish/TAG/LAG/Nit) · texture bands (dry/medium/wet) · hand-strength buckets (nuts/strong/air) · "range advantage" | **Outputs only. Never inputs.** |

This is not a metaphor added on top of the codebase; it *is* the codebase's stated anti-pattern discipline (§7.2, §7.3, §7.4, §7.5, §7.6/AP-RL-01). GUT's contribution is to make the distinction the project's explicit organising axis rather than a per-file rule.

**Consequence for the Flop Qualification Score (FQS, `docs/design/audits/2026-07-28-entry-flop-qualification-score.md`):** a texture band is field, not quark. FQS's whole design tension — one composite score versus two axes — is a question about *which coarse-graining preserves the sign of the underlying effect*. Framed as GUT, the answer is legible: the single `wetScore` axis destroys information that changes the direction of the answer, so it is an invalid coarse-graining. Not "imprecise" — invalid.

## 2. The interlinking requirement, and the gap in it

The owner's requirement — *"there has to be a performance and compatibility of ideas with each other"* — decomposes into two distinct checks. **One has machinery. One does not.**

### 2a. Orphan detection — HAS machinery

`.claude/programs/model-coherence.md` (ROLLOUT Phase 1, scanner shipped 2026-04-26) exists precisely for "concept exists, surface never consumes it." Every decision-relevant module exports a `__coherence__` block declaring `produces`, `expectedConsumers`, and a `targetIntegration.deadline`; `scripts/coherence-scan.cjs` flags orphans and expired deadlines.

Live example: `drillContent/shapes.js` declares `status: 'pending-absorption'` with `deadline: '2026-07-01'` — **now passed**, expected consumers `hook.live-action-advisor` and `surface.extension-sidebar` still unwired.

### 2b. Interference detection — NO machinery. This is the real gap.

Coherence asks *"is this concept consumed?"* It does not ask *"do two consumed concepts contradict or double-count each other?"* That second question is the owner's actual concern, and doctrine already names one instance of it with a number:

`POKER_THEORY.md §7.4` — style label, AF adjustment, VPIP adjustment, and villain model all encode "this player folds less." Applied multiplicatively, **a legitimate 30% fold rate becomes 23%.** Doctrine states the fix (pick exactly one tier of the four-tier hierarchy) but no scanner enforces it. The same class of hazard applies to any FQS modifier stack.

**Proposed as GUT's first concrete deliverable: an interference register.** Every pair of primitives that could encode the same information, with the arbitration rule and the magnitude of the error if the rule is violated. §7.4's quadruple-count is entry #1. Registered as AS-GUT-3 below.

## 3. Regime map — which criterion governs, and where it hands over

The owner's observation — *"decision criteria shift at different points, sometimes driven by pure statistics, other times a mandatory action from game theory"* — is correct and is the most rigorous physics parallel available. Different regimes obey different governing equations, with crossover conditions between them. Five regime axes exist in the codebase already, four with real numbers.

| Axis | Regimes | Governing criterion | Crossover | Source |
|---|---|---|---|---|
| **SPR** | MICRO 0–2 · LOW 2–4 · MED 4–8 · HIGH 8–13 · DEEP 13+ | MICRO: commit-or-fold against stack-off range (equity only). MED: range advantage drives sizing. DEEP: nut-potential and implied odds; one-pair hands retreat. | Zone boundaries are stated as sharp; whether they are sharp or smooth is **unverified** | `printableRefresher/manifests/prf-math-spr-zones.json` · `POKER_THEORY.md §3` |
| **Players remaining** | Heads-up · Multiway 3+ | HU: fold equity is a single term. Multiway: fold equity is **∏** of per-player fold rates — profitable c-bet frequency collapses from ~70% to **10–25%** | Sharp at the 3rd live player | `solverBaselines.js` `flop:cbet-decision:mw` = 0.25 · `HERO_STATE_DESIGN.md §7.4` |
| **Street / range width** | Flop · Turn · River | Flop: equity distribution, mixed strategies viable. River: pure indifference — MDF `pot/(pot+bet)` and breakeven-bluff `bet/(pot+bet)` become binding | Progressive, not sharp | `POKER_THEORY.md §3.7, §6.2, §6.3` |
| **Sample size on villain** | Prior-dominated · Read-dominated | Thin n: four-tier pool baseline governs (founder estimate → imported reference → pool aggregate → per-villain Read). Large n: observed rate governs | **Measured, not assumed** — per-stat pseudocount caps `vpip 10 · foldTo3Bet 10 · cbet 13 · pfr 21 · foldToCbet 22 · threeBet 35`, from method-of-moments between-player overdispersion on the HandHQ corpus | `POKER_THEORY.md §6.5a` · `exploitEngine/poolBaseline.js` · `docs/research/mass-pool-data-2026-07-25.md` |
| **Chips vs money** | Cash · ICM | Cash: chip EV. ICM: risk premium as a *derived* multiplier, never a label | Tournament with payout ladder | `POKER_THEORY.md §10.1–10.3` |

**Why this matters for GUT:** a unified theory does not mean one equation. It means a **map of which equation applies where, plus the crossover conditions** — and the honest admission that at a crossover, two criteria disagree and something must arbitrate. The multiway crossover is the cleanest instance: the same flop, the same hand, the same villain, and the governing quantity switches from a sum to a product. That is a regime change with a documented 45pp consequence.

## 4. Analogy register — graded on behavioural accuracy

**Admission gate.** Per the owner's constraint — *"but only if the behavior is accurate"* — an analogy is admitted only with all three of:

1. **A computable quantity** in the poker system,
2. **A number or formula** that the analogy predicts and that poker actually exhibits,
3. **A falsification** — what observation would show the mapping is decorative.

Analogies failing the gate are recorded as **DECORATIVE** and may still be used as vocabulary, clearly marked, never as reasoning. Following `poker-shape-language/roundtable.md` T1 and T4, "the math is wrong but the word is right" is a legitimate verdict — it ships as a *label*, not as a mechanism.

---

### ✅ ACCURATE — admitted as reasoning

**A1 · Renormalisation / effective field theory → the bucket-and-label layer.**
*This is the rigorous form of the owner's own quark-vs-field metaphor, and it is the strongest mapping in the register.* In EFT you coarse-grain microscopic degrees of freedom into an effective description valid at a scale, whose couplings *run* with that scale, and you must never feed a coarse-grained variable back in as fundamental. Poker: per-combo equity (micro) → hand-type buckets → style labels (macro). §7.3 "buckets are relative to the current range" is a statement that the effective coupling runs. §7.2/§7.4 "labels are outputs, not inputs" is the no-feedback rule.
**Number:** §6.5a's per-stat pseudocount caps are literally measured effective couplings — and the previous flat value `POOL_PRIOR_MAX_PSEUDOCOUNT = 200` was **refuted as ~20× too confident** and removed. An effective coupling was measured and corrected. That is the analogy working, not decorating.
**Bonus structural match:** §6.5a rule 2, leave-one-out — *"shrinking a villain toward a pool containing itself is circular"* — is self-interaction removal, the same move renormalisation makes to cancel self-energy.
**Falsified if:** bucket-level and combo-level computations agree within noise across a representative spot sample, i.e. the coarse-graining is lossless and the distinction is bookkeeping.

**A2 · Phase transition / critical point → the indifference threshold.**
Crossing the breakeven bluff frequency changes the character of the optimal response discontinuously; the response is not a smooth function of fold rate through that point.
**Number:** breakeven `= bet/(pot+bet)`; MDF `= pot/(pot+bet)`. Half-pot → 33% / 66.7%. Pot → 50% / 50%.
**Already partially present:** the shape-language topologist identified "isolated saddles (indifference points between value-bet and bluff-catch regimes)" independently.
**Falsified if:** measured EV is smooth and monotone through the threshold with no change in the argmax action.

**A3 · Entropy → how defined a range is. — ⚠️ DOWNGRADED TO PARTIAL, 2026-07-28, by measurement.**
Shannon entropy over a normalised weight distribution, `H = −Σ pᵢ log pᵢ`, is well defined and computable. **But the morphology claim was probed and failed.** See "Probe results" §5a.

What survives: **H is a valid measure of range *concentration*.** Over hand-type shares it separates `capped` from `polarized` strongly (Cohen's d = 3.13) and `capped` from `linear` (d = 1.51) — capped ranges genuinely do have mass piled into few classes.

What does not survive: **H cannot measure morphology, because entropy is permutation-invariant over classes.** Polarization is a claim about *where* mass sits on an ordered strength axis, not how spread it is. Probed directly: three share-vectors that are the same multiset in different positions — mass-at-the-ends, mass-in-the-middle, monotone decay — all have **identical H = 1.7920 bits.** Entropy is structurally blind to the distinction it was proposed to measure.
**Corrected replacement:** standardised moments over the ordered strength axis. On those same three vectors, sd and kurtosis separate them cleanly (polarized sd 3.21 / kurt 1.33; condensed sd 0.96 / kurt 6.19; linear sd 1.37 / kurt 8.61). Bimodality is a 4th-moment property, so kurtosis is the natural polarization statistic.
**Status:** admitted for concentration, rejected for morphology. `RANGE_MORPHOLOGY`'s threshold classifier is **not** replaceable by entropy.

**A4 · Measurement collapse → range narrowing on action.**
An action is a measurement; the posterior over combos renarrows by Bayes. `P(hand|action) = P(action|hand)·P(hand)/P(action)` (§6.5). Already implemented (`postflopNarrower.js`, `decisionTreeBuilder.js`), and §7.6/AP-RL-01 already *requires* per-combo derivation rather than bucket heuristics.
**"Collapsed node" is admitted vocabulary** — it names a real object in the game tree.
**Falsified if:** posterior narrowing is better modelled by bucket-level transitions than per-combo updates (AP-RL-01 asserts the opposite).

**A5 · Observer effect / measurement back-action → calibration reflexivity.**
Already documented as a live hazard: `docs/projects/predictive-model-calibration/failure-mode-taxonomy.md` describes the owner reading a divergence, adjusting strategy, and future hands recording the new equilibrium *with no awareness it was self-induced*. Mitigated by a pre-registration registry and AP-PMC-06.
**Falsified if:** pre-registered predictions and post-hoc measurements show no systematic divergence attributable to owner adjustment.

**A6 · Exact symmetry → suit isomorphism.**
Suit permutation is a genuine exact symmetry of preflop hand strength, and the codebase already exploits it structurally: 1326 combos collapse to 169 classes (the 13×13 grid, `rangeMatrix.js`), and boards collapse to `r` / `ss` / `mono` (`boardShorthand.js`). This is a real invariance group doing real work, not an analogy.
**Falsified if:** it isn't — this one is a theorem, not a hypothesis. Note the symmetry **breaks** the moment a flush draw exists, which is exactly why suit suffixes re-enter at the flop.

---

### ⚠️ PARTIAL — admitted with a correction

**P1 · "Superposition" → should be "mixed state."**
A range *is* a probability distribution over combos, and an action *does* collapse it — so the collapse half (A4) is sound. But superposition's defining feature is **interference between amplitudes**: complex phases, cancellation, negative-probability-like behaviour. Poker ranges are classical mixtures. No two combos cancel. There is no interference term anywhere in the math.
**Verdict:** use **"mixed state"** and **"collapse."** Do **not** use "superposition" — it imports an intuition (interference) that poker does not exhibit, and the owner's precision constraint should reject it. If a genuine interference term is ever found, this upgrades.

**P2 · Fluid dynamics → only two pieces survive.**
The shape-language topologist already rejected the general form on accuracy grounds: *"'attractor' requires a flow; street transitions are a Markov chain with absorbing states; the landscape metaphor overstates smoothness/determinism."* That rejection stands and generalises — laminar/turbulent/viscosity are decorative.
**Two pieces do survive:**
- **Conservation and flux — ACCURATE.** Equity sums to 1 across combos, and combo mass genuinely *flows* between hand-type classes as cards land. The shape-language roundtable independently chose a **Sankey** as the honest render of exactly this, over the basin metaphor (T4).
- **SPR as a dimensionless regime selector — ACCURATE, and the best fit in this family.** SPR is a dimensionless ratio whose *value selects which governing regime applies* — structurally the same role a Reynolds number plays. This is not "poker is a fluid"; it is "poker has a dimensionless regime-selecting parameter," which is true and useful.
**Falsified if:** SPR zone boundaries turn out to be smooth rather than switch-like, in which case SPR is a continuous modifier and not a regime selector.

---

### ❌ REJECTED — decorative, do not reason with it

**R1 · Quantum tunnelling.**
Tunnelling's content is that a system crosses a barrier it *classically cannot*, with probability decaying exponentially in barrier width. The poker candidate — a bluff getting through a range that "should" call by MDF — has no barrier and no exponential law. The villain's fold frequency is simply nonzero, and when it exceeds `bet/(pot+bet)` the bluff profits. That is arithmetic, already named **fold equity**, and it is the *common* case, not an exotic leak.
**Why the rejection matters:** "tunnelling" would import a false intuition — that these spots are rare and surprising — when `docs/research/mass-pool-data-2026-07-25.md` measures river fold rates running **12–16pp past bluff-breakeven** at scale. The pool over-folds routinely. Calling the most reliable exploit in the game "tunnelling" would make it sound like an edge case.
**Available as vocabulary?** No. Unlike "basin" or "saddle" (T1/T4 — wrong math, right word), "tunnelling" is both wrong math *and* a misleading word here. Full reject.

---

## 5. Labelled assumptions (AS-GUT-N)

```yaml
assumptions:
  - id: AS-GUT-1
    type: doctrinal
    claim: "The quark/field split (game-state primitives as inputs, labels as outputs only) is sufficient to organise every decision-relevant quantity in the codebase — no quantity resists classification."
    falsifies_if:
      threshold: ">=1 decision-relevant quantity is genuinely irreducible to game state AND genuinely required as an input (not merely convenient)"
      window: "primitive inventory pass over the six decision-relevant directories"
    revisit: "at inventory completion"
    status: unverified
    severity: medium

  - id: AS-GUT-2
    type: empirical
    claim: "Regime boundaries (SPR zones especially) are switch-like rather than smooth — i.e. 'regime' is the right object and not a rebranding of a continuous modifier."
    falsifies_if:
      threshold: "EV-optimal action frequency varies smoothly across an SPR zone boundary with no discontinuity in the argmax action, on >=3 of the 5 boundaries"
      window: "one gameTreeEvaluator sweep across SPR; cheap, no new infrastructure"
    revisit: "2026-08-15 — needs a multi-street or elastic-defence model"
    status: PARTIALLY-SUPPORTED-AMENDED
    severity: high
    probed: "2026-07-28 (probes/probe-spr.mjs)"
    result: >
      SUPPORTED for two of the four cuts by independent derivation: the geometric
      stacking law S_n(f) = ((1+2f)^n - 1)/2 gives, for pot-sized bets,
      S = 1, 4, 13, 40. The cuts at 4 and 13 are EXACT (0.0% error) and are
      genuinely discrete because n is an integer. NOT supported for 2 and 8 —
      nearest law thresholds are 2.19 (n=2 at 0.66x pot, 9.6% off) and 7.50
      (n=4 at 0.50x pot, 6.3% off), i.e. the declared set mixes three different
      implied bet sizings rather than following one law.
      The falsification test itself could NOT be run as written — see the
      circularity note below. A one-street MDF model degenerates (EV reduces to
      E*(1+2b)/(1+b), monotone in b, so "always jam" wins and switch points sit
      only where the stack cap binds, all at SPR <= 2, invariant to hero equity).
      Conclusion: SPR regimes are multi-street commitment objects and are
      invisible to single-street EV entirely.
    amendment: >
      Original falsification threshold was CIRCULAR and is retired.
      gameTreeConstants.js:93-97 hardcodes the cuts and buildHeroActions /
      adjustedRealization / foldEquityCalculator all branch on getSPRZone(), so
      an evaluateGameTree sweep would rediscover its own input. Replacement test
      requires either a multi-street commitment model or an elastic villain
      defence curve (defence better than MDF at large sizings).

  - id: AS-GUT-3
    type: structural
    claim: "Interference (double-counting between primitives) is a bounded, enumerable class — a finite register of primitive pairs covers it."
    falsifies_if:
      threshold: "interference is found to be combinatorial in the number of primitives rather than pairwise, i.e. >=1 real defect requires a 3-way interaction to describe"
      window: "first interference-register authoring pass"
    revisit: "at register v1"
    status: unverified
    severity: medium
    note: "§7.4's own example is already 4-way (style + AF + VPIP + model), which is evidence AGAINST the pairwise assumption. Treat with suspicion from the start."

  - id: AS-GUT-4
    type: empirical
    claim: "Range entropy H separates morphology classes at least as well as the existing threshold classifier in frameworks.js RANGE_MORPHOLOGY, and decreases monotonically flop→river on real histories."
    falsifies_if:
      threshold: "H's class separation is worse than the threshold classifier's on a labelled sample, OR H is non-monotone across streets on >10% of real hands"
      window: "one pass over stored hand histories; no new infrastructure"
    revisit: "closed — superseded by AS-GUT-6"
    status: FALSIFIED
    severity: low
    probed: "2026-07-28 (probes/probe-entropy.mjs)"
    result: >
      FALSIFIED on the separation criterion. 564 (range x board) pairs from 47
      real archetype ranges x 12 flops. NO class pair separates cleanly — every
      pair is either "no separation" or "shifted but overlapping".
      polarized vs linear d=0.73 (no separation). linear vs condensed d=0.73
      (no separation). The mechanism was then isolated directly: entropy is
      permutation-invariant, so mass-at-the-ends, mass-in-the-middle and
      monotone-decay share vectors built from the same multiset all return
      H = 1.7920 bits exactly. Entropy cannot see the ordering that morphology
      is defined by.
      Partial survival: H does separate capped from polarized (d=3.13) and
      capped from linear (d=1.51) — so H is a valid CONCENTRATION measure.
      The monotone-across-streets half was NOT tested (no real hand histories
      available in this environment) and remains open.
      Incidental finding: the existing classifier is heavily skewed on this
      sample — capped 294, linear 239, polarized 19, condensed 12. Polarized
      plus condensed is 5.5% of cases, which is itself suspicious and is now
      AS-GUT-7.

  - id: AS-GUT-6
    type: empirical
    claim: "Standardised moments over the ordered strength axis (sd for spread, kurtosis for bimodality) separate the four morphology classes where entropy failed."
    falsifies_if:
      threshold: "sd and kurtosis together achieve Cohen's d < 0.8 on any adjacent class pair over the same 564-pair sample"
      window: "one probe; reuses probe-entropy.mjs scaffolding"
    revisit: "next probe session"
    status: unverified
    severity: medium
    note: >
      Successor to the falsified AS-GUT-4. Motivated, not assumed: on hand-built
      vectors sd and kurtosis DID separate the three shapes entropy could not
      (sd 3.21/0.96/1.37, kurtosis 1.33/6.19/8.61). Untested on real ranges.

  - id: AS-GUT-7
    type: empirical
    claim: "frameworks.js RANGE_MORPHOLOGY's thresholds are correctly tuned — the observed 5.5% combined rate for polarized + condensed reflects reality, not mis-set cutoffs."
    falsifies_if:
      threshold: "re-tuning the four cutoffs against an order-aware statistic moves >20% of the 564-pair sample between classes"
      window: "with the AS-GUT-6 probe"
    revisit: "next probe session"
    status: unverified
    severity: medium
    note: >
      Fell out of the AS-GUT-4 probe as a side observation. If the classifier is
      mis-tuned, every framework narration keyed on morphology is affected, and
      FQS inherits the error.

  - id: AS-GUT-5
    type: methodological
    claim: "Analogy generation is productive under the three-part admission gate — i.e. the gate rejects enough to keep the register honest without rejecting everything useful."
    falsifies_if:
      threshold: "at the scrutiny roundtable, >50% of ACCURATE-graded entries are downgraded, OR zero new candidates clear the gate across two sessions"
      window: "the GUT scrutiny roundtable (§6)"
    revisit: "at roundtable"
    status: unverified
    severity: medium
    note: "This charter graded 6 accurate / 2 partial / 1 rejected. If the roundtable overturns most of the 6, the gate is too permissive and the method is a metaphor farm."
```

## 5a. Probe results — 2026-07-28

Two probes run. Scripts and run instructions in `probes/`. **Both changed the register.** Neither confirmed what it set out to confirm, which is the method working rather than failing.

### The circularity lesson — the most transferable finding

`AS-GUT-2`'s falsification test, as written in this charter's first draft, was **not runnable**. It proposed sweeping SPR through `evaluateGameTree` and looking for discontinuities at the zone boundaries. But `gameTreeConstants.js:93-97` hardcodes those boundaries and `buildHeroActions`, `adjustedRealization`, and `foldEquityCalculator` all branch on `getSPRZone()`. The probe would have rediscovered its own input and reported success.

**Standing rule, now in `probes/README.md`:** every probe must name the code path that could make its result circular and route around it. A probe that consumes the constant it is testing measures the implementation, not the game. This charter shipped one circular test out of two on its first attempt — assume the next batch has one too.

### AS-GUT-2 — SPR boundaries: two of four are exact, and the set is internally inconsistent

Derived independently of the code, from the stacking law the SPR manifest itself claims (*"zones reflect the geometry of how many pot-sized bets fit before all-in"*):

`S_n(f) = ((1+2f)ⁿ − 1) / 2` — the stack depth, in pots, at which the n-th bet of fraction `f` exactly fits.

| sizing | n=1 | n=2 | n=3 | n=4 |
|---|---|---|---|---|
| **1.00× pot** | **1.00** | **4.00** | **13.00** | **40.00** |
| 0.75× pot | 0.75 | 2.63 | 7.31 | 19.03 |
| 0.66× pot | 0.66 | 2.19 | 5.74 | 13.99 |
| 0.50× pot | 0.50 | 1.50 | 3.50 | 7.50 |

For pot-sized bets the sequence is exactly `(3ⁿ − 1)/2` = **1, 4, 13, 40**.

| stated cut | nearest law threshold | error |
|---|---|---|
| 2 | 2.19 — n=2 at 0.66× pot | 9.6% |
| **4** | **4.00 — n=2 at 1.00× pot** | **0.0%** |
| 8 | 7.50 — n=4 at 0.50× pot | 6.3% |
| **13** | **13.00 — n=3 at 1.00× pot** | **0.0%** |

**Reading:** 4 and 13 are not arbitrary — they are exactly where a second and third pot-sized bet fit, and because `n` is an integer they are genuinely discrete. That is real support for "regime, not gradient." But 2 and 8 do not come from the same law: the declared set mixes **three different implied bet sizings**. The zone vocabulary is therefore not one geometry, it is three geometries stapled together.

**Second finding — undeclared thresholds.** `getSPRZone()` declares four cuts. The engine actually branches on **six**: `gameTreeDepth2.js:988-989` adds `spr > 10` and `spr < 5`, neither of which is a zone boundary. `gameTreeDepth2.js:103` additionally applies a *continuous* `sprStiffening = 1 + (4−spr)·0.1` below SPR 4, so SPR is treated as discrete and continuous in the same engine. This is precisely the interference class §2b predicted the coherence scanner cannot see — it flags orphans, not contradictions.

**Third finding — regimes are invisible to single-street EV.** The first-principles one-street model degenerates: with villain defending at exact MDF, `EV(bet b)` reduces algebraically to `E·(1+2b)/(1+b)`, monotone increasing in `b`. So "bet the maximum" always wins, and the only switch points are where the stack cap binds — all at SPR ≤ 2, and **identical across every hero equity from 0.25 to 0.85.** Only 1 of the 4 stated cuts appeared. SPR regimes are multi-street commitment objects; a single-street EV cannot express them at all. The replacement test needs multi-street modelling or an elastic defence curve.

### AS-GUT-4 — entropy: falsified for morphology, survives for concentration

564 (range × board) pairs, from all 47 real archetype ranges × 12 flop textures, classified by the real `RANGE_MORPHOLOGY`.

`H_type` — entropy over the 22 hand-type class shares, bits:

| morphology | n | mean | sd | min | max |
|---|---|---|---|---|---|
| polarized | 19 | 2.790 | 0.252 | 2.242 | 3.114 |
| linear | 239 | 2.348 | 0.820 | 0.000 | 3.924 |
| condensed | 12 | 1.804 | 0.667 | 0.707 | 2.894 |
| capped | 294 | 1.227 | 0.660 | 0.000 | 3.283 |

Pairwise, **no class pair separates cleanly.** polarized vs linear **d = 0.73** (no separation). linear vs condensed **d = 0.73** (no separation). The strong pairs — capped vs polarized d = 3.13, capped vs linear d = 1.51 — are shifted but with fully overlapping ranges.

Then the mechanism, isolated directly. Three share-vectors built from the *same multiset* in different positions on the strength axis:

```
mass at both ends   (polarized)  H = 1.7920 bits
mass in the middle  (condensed)  H = 1.7920 bits
monotone decay      (linear)     H = 1.7920 bits
```

**Entropy is permutation-invariant, so it is structurally blind to the ordering that morphology is defined by.** Polarization is a claim about *where* mass sits, not how spread it is. This was predicted before running and it held.

Order-aware statistics on those same vectors do separate them — polarized sd 3.21 / kurtosis 1.33; condensed sd 0.96 / kurtosis 6.19; linear sd 1.37 / kurtosis 8.61. Bimodality is a 4th-moment property, so **kurtosis is the natural polarization statistic.** That is now `AS-GUT-6`.

**Not tested:** the monotone-decrease-across-streets half. No real hand histories are available in this environment; it stays open.

**Incidental finding, now `AS-GUT-7`:** the existing classifier is badly skewed on this sample — capped 294, linear 239, polarized 19, condensed 12. Polarized plus condensed is **5.5%** of cases. Either real ranges genuinely are rarely polarized on a flop, or the four cutoffs in `frameworks.js:257-261` are mis-tuned. If mis-tuned, every framework narration keyed on morphology is affected — and FQS would inherit it.

### What the two probes say about the method

`AS-GUT-5` asked whether the admission gate is productive. Early evidence: of the two ACCURATE entries probed, **one was downgraded and one was amended.** Zero survived unchanged. That is a high correction rate for a register that was authored with reasonable care, and it suggests the gate was too permissive on first pass — analogies that *feel* rigorous cleared it. The gate should be tightened: **an analogy is not ACCURATE until it has been probed.** Unprobed entries are CANDIDATE. Applied retroactively, that demotes A1, A2, A5, A6, P1 and P2 to CANDIDATE and leaves the register with **zero** ACCURATE entries — which is the honest state.

## 6. The scrutiny roundtable — specified, deliberately NOT run yet

The owner's instinct is right and the timing matters: *"worth a dedicated roundtable engine run once we think we are done, just to really put it to the test and also invite scrutiny."* Running it now would grade a register with one authoring pass behind it. **The register must be wrong in interesting ways first.**

**Trigger condition:** the register holds ≥12 candidate analogies AND ≥3 have been probed numerically (AS-GUT-2 and AS-GUT-4 are the two cheapest starts).

**Why a purpose-built engine rather than `/eng-engine`:** `/eng-engine`'s roster (architect, security, performance, failure, senior-engineer, product-ux) audits *code*. This needs to audit *claims about physics and poker*. The `poker-shape-language/voices/` precedent — a custom roster including a topologist who **rejected his own proposal's shippability** and whose objections were preserved in the spec — is the correct model. Build via `/build-engine`.

**Proposed roster (6):**

| Voice | Job |
|---|---|
`physicist-formalist` | Does the analogy's math actually hold? Is there an interference term, a conserved quantity, an exponential law — or only a shape? Empowered to reject on formal grounds alone. |
`poker-theorist` | Does the poker behaviour actually exhibit the predicted number? Cite `POKER_THEORY.md` and measured pool data. |
`live-pool-empiricist` | Does it hold for the *live pool*, given the six documented §9 divergences from solver baseline? Guards the FQS AS-4 trap at theory level. |
`reductionist-skeptic` | Adversarial. Default position: this analogy adds vocabulary and no predictive content. Must be argued down with a number. |
`coherence-architect` | Interference and double-counting. Owns §7.4's hazard class and the interference register. |
`table-pragmatist` | Does any of this change a decision at the table, or is it a study-mode ornament? The T5 role — the voice that collapsed the fiber bundle to a UX flash. |

**Output format:** graded tensions T1..Tn in `poker-shape-language/roundtable.md` style — each with an explicit winner, and the losing side's constraint preserved where it is real. Plus a promotion/demotion pass over every register entry, and findings routed to the queue.

**Pass condition, stated in advance so it cannot be softened later:** the roundtable passes when every ACCURATE entry survives `reductionist-skeptic` with a number, and every REJECTED entry has its near-miss recorded so it is not re-proposed.

## 7. What this project is not

- **Not a claim that one equation governs poker.** GUT means a regime map plus arbitration at crossovers.
- **Not permission to generate analogies freely.** Generation is cheap and verification is expensive; that asymmetry is the specific failure mode this charter exists to prevent. The admission gate is the whole governance.
- **Not a replacement for FQS or any engine.** GUT is the pre-context that makes those interlink — the layer that asks the interference question when the next primitive ships.
- **Not yet evidence of anything.** Nine graded entries, one authoring pass, zero numerical probes run. Every AS-GUT-N is `unverified`.

## 8. Links

- FQS Gate 1 Entry: `docs/design/audits/2026-07-28-entry-flop-qualification-score.md`
- Method precedent: `docs/projects/poker-shape-language/roundtable.md` · `voices/03-topologist.md` · `voices/06-scientific-viz.md`
- Doctrine: `.claude/context/POKER_THEORY.md` §3.7, §6.1–6.5a, §7.2–7.6, §9, §10
- Coherence: `.claude/programs/model-coherence.md` · `docs/engine/COHERENCE_SCHEMA.md`
- Reflexivity: `docs/projects/predictive-model-calibration/failure-mode-taxonomy.md`
- Measured pool data: `docs/research/mass-pool-data-2026-07-25.md`
- Regime numbers: `printableRefresher/manifests/prf-math-spr-zones.json` · `skillAssessment/solverBaselines.js`

## Change log

- 2026-07-28 (later, same day) — **Two probes run; both changed the register.** AS-GUT-4 **FALSIFIED** for morphology (entropy is permutation-invariant; three opposite morphologies return identical H = 1.7920 bits) and A3 downgraded to PARTIAL, surviving only as a concentration measure. AS-GUT-2 **AMENDED**: its original falsification test was circular and is retired; the stacking law independently derives the cuts at 4 and 13 exactly `((3ⁿ−1)/2)` but 2 and 8 come from different implied sizings, so the declared zone set mixes three geometries. Two undeclared engine SPR thresholds found (`spr > 10`, `spr < 5` in `gameTreeDepth2.js:988-989`) plus a continuous `sprStiffening` below 4 — SPR is treated as both discrete and continuous in one engine. Three new assumptions registered: AS-GUT-6 (order-aware moments as entropy's replacement), AS-GUT-7 (morphology classifier may be mis-tuned — polarized+condensed is 5.5% of 564 samples). Admission gate tightened: unprobed entries are CANDIDATE, not ACCURATE — which leaves the register at **zero ACCURATE**. Probe scripts committed to `probes/` with a run shim that works without `npm install`.
- 2026-07-28 — Charter authored. Quark/field distinction mapped to existing §7 doctrine. Interference identified as the gap in model-coherence (orphans covered, contradictions not). Regime map assembled from 5 axes, 4 with real numbers. Analogy register opened: 6 ACCURATE, 2 PARTIAL-with-correction, 1 REJECTED. 5 assumptions registered, all unverified. Scrutiny roundtable specified with trigger condition and pre-stated pass condition; deliberately not run. No production code.
