# Two Directions — Human Transform of Equity, and Game-Theoretic Primitives

**Founder, 2026-08-05.** Captured at a session boundary. Neither is chartered; both are grounded in
pieces that already exist. Written compact per `feedback_record_shape_outlives_questions`.

---

## The framing that governs both

> *"the whole existing system of poker is made up, and we're building knowing that... now that you
> have a huge criticism on what is considered in some circles to be gospel, the understanding has to
> follow, and there has to be a great degree of trust in the engine itself (this is where the
> standards measuring roots us)"*

**Today's research is the evidence for the first half.** MDF is a post-2015 coinage that **none of ten
sources cites**. The street ratios 2:1/1:1/1:2 trace to a single origin — Janda 2013 p.144 → Ryan Fee
→ Upswing 2019 — and everything downstream is restatement. Three sites publish α where the bluff
fraction belongs. "10–15% of players are long-term winners" has **no traceable study**. **No
data-backed live standard deviation exists anywhere**; every circulating figure traces to one author's
tutorial worked examples. Ten distinct shared-origin collapses; the postflop corpus reduces to five
lineages. **Two numbers in 41 sources carry a stated live sample.**

**The obligation that follows:** removing borrowed authority means the engine must carry the epistemic
weight itself. A criticism of unsourced doctrine is only legitimate if our own numbers are
reproducible, conditioned and falsifiable. That is what the Standard of Record is for, and it is why
the measurement work precedes the theory work rather than following it.

---

## Direction 1 — a human transform of equity

**The hypothesis.** A percentage may be the wrong representation *for a human*. It is precise and
unmemorable. A transform — a memorizable set of interactions, known defaults, and trigger points —
may be less precise and **more executable**, and executed-correctly beats computed-correctly-and-
misapplied.

**Founder doctrine this sits under:** [[feedback_teachable_model_may_differ_if_scored]] — a novel
method a player can execute outranks a right answer he cannot. Permission already granted; the
obligation is that a teachable rule must be **run on the corpus and scored on the same metric**.

**Precedent that the shape works.** POKER_THEORY §11.9 scored a **15-number human-holdable rule** as
an arm against the engine on one identical decision set, POOL/EVAL split — it recovered **~56–57%** of
the engine's edge. The harness is `scripts/backtest/run-teachable-arms.mjs`.

**Pieces already in the repo, unjoined.** §15 says it outright: *"Both are compositions of functions
this repo already has: `comboStrengthPercentile` for the x-axis, `computePerComboEV` /
`computePerComboCheckEV` for the y-axis. Nothing new is required to produce the curve; the pieces have
simply never been joined."* And §15.2's **neutral-zone width** is computed rather than asserted.

**Candidate transforms, to be scored against the percentage — not assumed better:**

- **Percentile within the range**, not equity against it. `comboStrengthPercentile`
  (`pokerCore/handEvaluator.js:356`) exists and reaches only `decisionAccumulator`.
- **Neutral-zone width** — *"is this a region where the whole class of hands plays the same way, or
  does my exact holding matter here?"* Two scalars: my percentile, and the width of the flat region.
  **That answers whether to think or to apply a rule**, which is the scarcest judgement at the table.
- **Trigger points** — the cards or actions that flip the decision, rather than the decision's current
  margin.
- **Interaction structure** — what you beat, what beats you, what changes it. §16's equity operator
  is antisymmetric and its intransitivity map already ships (`equitySkewDecomposition.js`) with no
  production consumer.

**How to score it, and this is the part that must not be fudged.** The metric is **human accuracy**,
which is not engine accuracy: did a person applying the transform take the action the engine
recommends, more often than a person applying the percentage? That requires a metric for
*action agreement under human execution*, not EV. Design it before running it.

**The falsifier.** If the transform's action-agreement rate does not beat the percentage's on the same
decision set, the transform is decoration and should be dropped rather than tuned. State the margin
that counts as a pass before measuring.

---

## Direction 2 — game-theoretic primitives in the engine

**The founder's claim:** *"Perhaps there needs to be some primitive Game theory modeling woven into
the engines in some places. It might save us compute and increase the speed of the plumbing."*

**Two payoffs, and the second is the larger one.**

1. **Compute.** Where a quantity has a closed form, deriving beats searching. Indifference conditions
   give a frequency directly; MDF, α, breakeven fold equity and the caller's threshold are all
   identities (`Pot/(Pot+Bet)`, `Bet/(Bet+Pot)`, `B/(P+2B)`).
2. **Determinism.** A closed form is **exact and reproducible**. Two of today's confirmed defects are
   sampling-driven — unseeded depth-2/3 runouts (fixed today) and wall-clock refinement gating
   (`gameTreeEvaluator.js:954/961/985`, open as WS-411). Every node answered in closed form is a node
   that cannot contribute run-to-run variance. **This is a reproducibility fix disguised as a
   performance one**, and reproducibility is what the EV figure needs most.

**Where closed form is available:** indifference-derived bluff frequency (`bluffValueConstruction.js`,
**zero production consumers**); MDF/α identities; breakeven fold equity (`actionClassifier.js:135`,
gated behind `useGameTree`); push/fold, already solved this way in `pushFoldEngine/`; §16's
antisymmetry results.

**The boundary that must be stated with it.** GTO is an **imported reference frame**, not the target —
this engine is deliberately exploitative and live-population-facing, and the founder has excluded
solver completeness as the yardstick. A GT primitive is admissible as a **fast exact computation of a
quantity we already need**, never as a claim about what hero should do.

**Verified constraint on the equilibrium frame:** it is **not procurable**. Every open-source solver is
two-player and rake-free; every commercial "live" library tops out at 8-max; Pluribus was withheld.
**Multiway NLHE equilibrium is an open computational problem.** `equilibriumPost.mjs` returning `null`
is correct. What *is* buildable in-house: `postflop-solver` is AGPL-3.0, callable as a library, and
already implements bunching for up to four folded players. Introduce it as a **new source id with its
own scope statement** — never by relaxing SRC-013.

---

## Sequencing note

Both directions depend on a trustworthy scored figure, and the figure is not yet trustworthy: the
engine still raises **82.3%** facing aggression against a pool at **15.2%**, ESS is ~30%, and the
baseline run has never completed at ≥30 clusters. **Measure first.** A transform scored against a
miscalibrated engine measures the miscalibration.
