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

**A3 · Entropy → how defined a range is. (Computable, and currently NOT computed.)**
Shannon entropy over the normalised combo-weight distribution, `H = −Σ wᵢ log wᵢ`, is well defined, and §3.7's claim that ranges narrow monotonically flop→river is exactly the claim that H decreases monotonically. The shape-language lessons already use "very high entropy" informally for a uniform-50% range.
**Number:** H in bits. Uniform over 1326 combos ≈ 10.4 bits; a range of 6 combos ≈ 2.6 bits.
**Why it earns entry:** it turns "polarised / condensed / capped" — currently threshold heuristics in `postflopDrillContent/frameworks.js` `RANGE_MORPHOLOGY` — into one continuous measured quantity. Genuine gap, genuine deliverable.
**Falsified if:** H fails to separate morphology classes that the existing threshold classifier separates, or fails to decrease monotonically across streets on real hand histories.

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
    revisit: "before any regime-conditioned coefficient ships"
    status: unverified
    severity: high
    note: "Load-bearing for the whole regime map AND for P2's Reynolds-role claim. If boundaries are smooth, §3's five zones are a teaching device, not physics, and the map must be rewritten as a gradient."

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
    revisit: "at entropy probe"
    status: unverified
    severity: low
    note: "Cheapest admitted-analogy test in the register. Run it first — it is the one that most cleanly demonstrates whether this method produces deliverables or vocabulary."

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

- 2026-07-28 — Charter authored. Quark/field distinction mapped to existing §7 doctrine. Interference identified as the gap in model-coherence (orphans covered, contradictions not). Regime map assembled from 5 axes, 4 with real numbers. Analogy register opened: 6 ACCURATE, 2 PARTIAL-with-correction, 1 REJECTED. 5 assumptions registered, all unverified. Scrutiny roundtable specified with trigger condition and pre-stated pass condition; deliberately not run. No production code.
