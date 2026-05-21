# Gate 1 Entry — 2026-05-09 — Predictive Model Calibration (PMC) — Prediction Ledger

**Feature working name:** Predictive Model Calibration (PMC) — Prediction Ledger + Failure-Mode Taxonomy + Calibration Surface
**Audit ID:** `entry-pmc-2026-05-09`
**Proposed by:** Owner-driven (2026-05-09 conversation — "we need to be enumerating the possible failure modes of the model when it interacts with real player data")
**Gate:** 1 (Entry) — mandatory
**Next gate:** Gate 2 (Blind-Spot Roundtable, mandatory due to RED verdict — see §Gap analysis)
**Status:** RED — new program, new architectural primitive, new failure-mode taxonomy, absorbs WS-169 (Calibration Dashboard MVP)

---

## Feature summary (as proposed)

The model is currently validated only by theory (solver charts, MC engines, internal invariants). When the engine recommends a 4-bet with `predicted_villain_fold% = 62%`, we have no mechanism to ask after N hands: *did villain actually fold ~62% of the time, or are we systematically wrong about this villain class?*

PMC closes the loop. Three deliverables stack:

1. **Failure-mode taxonomy** — enumerated classes of model error against real player data (range-composition error, frequency error, sizing-tendency error, population-baseline drift, skill-tier mismatch, texture-sensitivity error, prior overconfidence, etc.). Authored adversarially in Gate 2 Blind-Spot Roundtable. Every analyzer rule downstream traces to a class in this taxonomy.

2. **Prediction Ledger** — append-only log written at hand-end. For every model prediction we generated during the hand (range engine output, exploit-engine recommendation, anchor firing, hero-leak detection, fold% / call% / raise% distributions at each villain decision-node), the ledger captures:
   - Snapshot of inputs (situation key, board, action history, who's-in)
   - Snapshot of model output (predicted distribution, range composition, EV, confidence tier, model version)
   - Eventual observed outcome (action taken, sizing, showdown reveal if any, hand result)
   - Tagged `hero_in_hand: bool` so we capture villain-action data even on hands where hero folded preflop

3. **Calibration analysis + surface** — hierarchical Bayesian aggregation (population baseline + per-villain shrinkage + per-situation slice). Compares observed-vs-predicted at every level. Surfaces drift, mis-calibrated rules, and population-baseline gaps. Absorbs WS-169 (Calibration Dashboard MVP) — its 3-tab anchor/predicate/primitive surface becomes the renderer for ledger-driven aggregates rather than computing on the fly.

**The owner's framing:** *"If we don't have the feedback mechanism, we're only using theory to validate theory."* Inferential power without showdown — owner's own example: villain river-bet frequency observed >> our model's predicted (P(value-bet | range) + P(bluff | range)) → range composition or frequency assumption is wrong, even without seeing the hand. Aggregate frequency violations ARE the signal.

---

## Output 1 — Scope classification

**Primary classification:** **System-coherence audit** (per LIFECYCLE.md 2026-04-27 amendment) — surfaces all exist or are imminent (range engine ✓, exploit engine ✓, anchor library ✓, hero-leak detector ✓, calibration dashboard backlog), but a **concept** ("model prediction" as a first-class capturable artifact) is not represented anywhere in the data layer. Predictions are computed transiently and discarded. PMC adds the missing data primitive (the ledger) and a cross-cutting feedback mechanism.

**Secondary classifications:**
- **Surface addition.** Calibration Dashboard becomes a real shipping surface (was backlog, now load-bearing). WS-169 absorbed.
- **New IDB store.** `predictionLedger` store at IDB v21+ (additive migration).
- **New analysis pipeline.** Aggregator computing observed-vs-predicted with hierarchical Bayesian shrinkage (population → per-villain).
- **New failure taxonomy artifact.** First taxonomy of its kind — model error classes traced to analyzer rules. Lives at `docs/projects/predictive-model-calibration/failure-mode-taxonomy.md`.

**NOT a live-surface change.** Live-surface predictions (LiveAdviceBar, sidebar) are unchanged. Ledger writes happen at hand-end. Calibration dashboard is study-mode only (red line #8).
**NOT a CFR / regret-minimization integration.** Bayesian inference (prior × likelihood) is the model. CFR is explicitly out-of-scope; the ledger captures the data CFR would consume if we ever introduce it.
**NOT a hero-grading surface.** AP-06 model-accuracy-only framing throughout. The ledger captures hero predictions (e.g., "we recommended 4-bet with EV +0.31bb") but the analysis frames model accuracy ("our 4-bet recommendations realized -0.18bb on average vs +0.31bb predicted — model is over-optimistic in this spot"), never observer accuracy.

---

## Output 2 — Personas identified

### In scope

| Persona | Role | Core/Situational |
|---|---|---|
| [Post-Session Chris](../personas/situational/post-session-chris.md) | Primary; reviews calibration dashboard post-game | Situational — primary |
| [Scholar Drills Only](../personas/core/scholar-drills-only.md) | Primary; deep-dive on rule-level mis-calibration during study blocks | Core |
| [Chris (live player)](../personas/core/chris-live-player.md) | Inherits post-session-chris when reviewing post-session | Core |

### Out of scope (explicit excluded)

| Persona | Why excluded |
|---|---|
| Mid-Hand Chris | Calibration dashboard is study-mode only (red line #8) |
| Presession-Preparer | Drift visibility pre-session causes decision-hesitation (calibration-dashboard.md persona exclusion) |
| Newcomer-First-Hand | Empty/banner state until threshold crossed |

### Persona sufficiency check (Stage A pre-roundtable)

**Existing personas cover the consumers.** The new wrinkle is *who Chris sees through*: the dashboard is observational about VILLAINS (and about the model's representation of them). The ledger captures villain decisions that Chris-the-user never saw at decision-time (preflop folds aren't observed in 9-handed play; only the seats that act publicly). This is a new analytical posture but **does not require a new persona** — it's still post-session-chris doing post-session review with denser data.

**Gate 2 should still verify.** A "model-developer Chris" persona may emerge — Chris-the-user reviewing aggregate model accuracy is structurally different from Chris-the-user reviewing his own play. But this can collapse onto post-session-chris with situational notes; flagged for Gate 2 Stage A.

---

## Output 3 — JTBD identified

### Existing JTBDs the program serves

| JTBD | Source | Coverage |
|---|---|---|
| **`JTBD-DS-58`** Validate-confidence-matches-experience | `jtbd/domains/drills-and-study.md` | **Primary — full fulfillment.** DS-58 is the reason this program exists. The current calibration dashboard partially serves DS-58 (anchor-level only); PMC ledger generalizes to every model output. |
| **`JTBD-DS-59`** Retire-advice-that-stopped-working | `jtbd/domains/drills-and-study.md` | Secondary — drift-detected rules surface as candidates for retirement / re-tuning |
| **`JTBD-SR-23`** Worst-EV spots from session | `jtbd/domains/session-review.md` | Tertiary — ledger query: "spots where realized EV diverged most from predicted EV" |
| **`JTBD-DS-47`** Skill map / mastery grid | `jtbd/domains/drills-and-study.md` | Tertiary — calibration drift on hero predictions ↔ leak signal for SCF |

### Proposed new JTBDs (Gate 2 to ratify)

Three outcomes the existing atlas does **not** cleanly cover. Flagged as candidates for Gate 3 Research → JTBD authoring:

| Candidate | Statement |
|---|---|
| **`JTBD-DS-NEW-PMC-01`** Detect-when-model-is-wrong | "When the model has been making predictions about a villain (or population) for N hands, I want to know if the predictions match observed reality — so I trust the model on evidence, not authority." |
| **`JTBD-DS-NEW-PMC-02`** Trace-loss-to-model-or-variance | "When I get stacked or have a large losing hand, I want to know whether the loss was a tail event the model priced in, OR a model error — so I can update the model rather than blaming variance." |
| **`JTBD-DS-NEW-PMC-03`** Discover-blind-spots-in-the-model | "When my villain population behaves in a way the model doesn't anticipate (e.g., live-pool river over-bluffs at frequencies our priors don't capture), I want to surface the systematic gap — so we can re-prior the model rather than patch one rule." |

Gate 2 Stage B (JTBD coverage) explicitly tests whether DS-58 + DS-59 + SR-23 already cover these outcomes or whether new JTBD entries are warranted.

### Not served (explicit non-goals)

- **JTBD-DS-57** Capture-the-insight — capture flow lives on `hand-replay-observation-capture`. Ledger writes are automatic, not capture-flow.
- **JTBD-MH-\*** live mid-hand jobs — calibration is study-mode-only.

---

## Output 4 — Gap analysis

| Question | Result | Notes |
|---|---|---|
| Does this introduce a new surface class? | **Yes (partial)** | Calibration Dashboard already specced (calibration-dashboard.md, 371 lines, 2026-04-24). Ledger absorbs as data backbone. Dashboard spec needs amendment — currently anchor/predicate/primitive scope only, must extend to all model predictions |
| Does this introduce new copy patterns requiring AP-06 audit? | **Yes** | Aggregate model-accuracy summaries ("our 4-bet recommendations realized X vs Y predicted") are new copy; AP-06 enforcement extends from anchor-only to all model-output classes |
| Does this introduce a new IDB store / migration / schema field? | **Yes — large** | `predictionLedger` store at IDB v21+; ledger entry shape is new; ~2-50KB per hand depending on prediction count; storage-budget pressure expected |
| Does this introduce new red-line risk? | **Yes — Red Line #5 (engagement-pressure)** | Aggregate model-vs-reality dashboard is the strongest graded-work-trap surface in the codebase. Copy discipline must guarantee model-accuracy framing on every aggregate, including loss-attribution prose. Gate 2 Stage E mandatory |
| Does this introduce new failure-mode classes? | **Yes — taxonomy is the deliverable** | Failure-mode taxonomy is its own artifact; first of kind. Gate 2 Roundtable produces it adversarially per owner ratification 2026-05-09 |
| Does this require Gate 2 Blind-Spot Roundtable? | **Yes — mandatory** | RED verdict; new analytical posture; new JTBD candidates; new failure-mode taxonomy is the deliverable; cross-program effects (range engine, exploit engine, EAL, SCF, HSP) |
| Does this require a new Gate 4 surface artifact? | **Yes — extension** | calibration-dashboard.md (371 lines) extended to cover ledger-driven aggregates beyond anchor/predicate/primitive; new aggregator surface sub-spec authored Gate 4 |

**Verdict: 🔴 RED.** New analytical primitive (the ledger), new failure-mode taxonomy, new IDB store, new copy class with strongest graded-work-trap surface in codebase, new JTBD candidates, cross-program effects on five active programs (engine-accuracy, EAL, SCF, HSP, range-engine). Gate 2 Blind-Spot Roundtable mandatory before Gate 4.

---

## Gate 2 disposition

**REQUIRED — runs as the next sprint after this Gate 1 ratifies.**

**Charter for the roundtable** (carried into WS-172):

> The Predictive Model Calibration program adds a Prediction Ledger that captures every model output (range distributions, exploit recommendations, anchor firings, hero advice) at hand-end and compares to observed villain action / showdown reveals / realized EV. The first deliverable is the **failure-mode taxonomy** — enumerated classes of model error against real player data. The taxonomy is load-bearing: every analyzer rule downstream traces to a class in it, and the ledger schema must capture the fields needed to detect each class.
>
> Charter question: **What classes of model error against real player data are we likely to encounter — including ones that the framework itself cannot see?**

**Personas to convene** (5 specialists + devil's advocate):

1. **Range-engine theorist** — Bayesian range model, prior-vs-likelihood balance, mixing-weight invariants. *What range errors compound vs. self-correct?*
2. **Population ecology** — live-pool behavior at small-stakes Ignition; cash vs SNG; soft-pool drift over time. *What population-level priors are we likely to mis-calibrate?*
3. **Frequentist statistician** — sample-size / credible interval / multiple-comparisons rigor. *When do we have the data to claim a leak vs. when are we pattern-matching on noise?*
4. **Bayesian inference** — hierarchical shrinkage, posterior collapse, identifiability. *What aggregation hierarchy gives us per-villain detection without N=1 false positives?*
5. **Adversary modeler** — what are the model errors that would persist undetected? *Hard-to-falsify failure classes are the dangerous ones.*
6. **Devil's advocate** — when is "the model is wrong" the wrong frame? When is the deviation correct and the data noisy? When does the dashboard itself become a bias?

**Stage A through E** per ROUNDTABLES.md. Stage E especially load-bearing (graded-work trap is strongest here in the codebase).

**Output:** authored `docs/projects/predictive-model-calibration/failure-mode-taxonomy.md` enumerating top failure classes with detection signature + ledger fields required per class.

---

## Gate 3 disposition

**Triggered by Gate 2 verdict.** Likely YELLOW or RED — JTBD candidates DS-NEW-PMC-01..03 likely require authoring; potential new persona ("model-developer-Chris") may emerge.

Research scope (anticipated, not committed):

- **Owner interview**: clarify per-bucket priors (did owner feel certain populations behave outside our model?), how aggressive to be on auto-flagging suspected mis-calibration, threshold for "drift" vs "expected variance".
- **Solver-vs-population literature**: GTO baselines from PioSolver / GTO+ for each canonical situation; deviation signatures of small-stakes live pools (overcalling, under-3-betting, river over-bluffing trends).
- **Hierarchical Bayes in poker analytics**: prior art on per-villain shrinkage models (Hold'em Manager / PokerTracker — likely none use formal Bayes; check academic poker literature).

Authored as needed. JTBD candidates ratified or merged into existing DS-58 with sub-clause amendments.

---

## Gate 4 disposition

**Required.** Two artifacts:

1. **Amendment to `docs/design/surfaces/calibration-dashboard.md`** — extend scope from anchor/predicate/primitive (3 tabs) to include ledger-driven aggregates: per-villain calibration view, per-situation calibration view, hero-recommendation realized-EV view. Tabs may grow to 5 or get reorganized.

2. **New artifact: `docs/projects/predictive-model-calibration/charter.md`** — already drafted at `.claude/projects/predictive-model-calibration.md` (this sprint). Authored before Gate 4 since cross-program coordination begins Gate 2.

3. **New artifact: `docs/projects/predictive-model-calibration/ledger-schema.md`** — formal schema for `predictionLedger` IDB store; ledger entry shape; write API; query API. Authored Gate 4 after taxonomy ratifies (taxonomy → field requirements → schema).

---

## Acceptance criteria (carried into Gate 2)

1. WS-172 (Gate 2 Blind-Spot Roundtable) enumerates ≥10 failure-mode classes
2. Each class has: detection signature, ledger fields required, severity, examples
3. Stage E graded-work-trap audit explicit; AP-06 extension drafted
4. JTBD candidates DS-NEW-PMC-01..03 dispositioned (author / merge into DS-58 / drop)
5. Persona check: model-developer-Chris ratified or collapsed onto post-session-chris
6. Population-ecology stage produces priors-likely-to-be-wrong list specific to Ignition small-stakes
7. Failure-mode taxonomy file authored at canonical path
8. Charter updated with Gate 2 outputs
9. Gate 4 ledger-schema.md scope ratified (depends on taxonomy)

---

## Linked artifacts

- `.claude/projects/predictive-model-calibration.md` — project charter (sibling artifact, this sprint)
- `.claude/workstream/queue/WS-172.yaml` — Gate 2 Roundtable ticket (sibling artifact, this sprint)
- `.claude/workstream/queue/WS-169.yaml` — Calibration Dashboard MVP (absorbed by PMC; reassigned this sprint)
- `docs/design/surfaces/calibration-dashboard.md` — existing surface spec (to be amended Gate 4)
- `docs/design/jtbd/domains/drills-and-study.md` §DS-58, §DS-59 — JTBDs primarily served
- `docs/RANGE_ENGINE_DESIGN.md` §4.5 — Bayesian update rules from showdown observation (PMC ledger feeds these updates)
- `.claude/context/POKER_THEORY.md` — first-principles decision modeling (PMC must respect labels-are-outputs-not-inputs)
- `.claude/context/SYSTEM_MODEL.md` §11 — tech debt register (FM-Engine-Drift-Silent-Invalidation; PMC closes this)
- `docs/projects/exploit-anchor-library/anti-patterns.md` AP-06 — model-accuracy framing (extended scope under PMC)
- `.claude/projects/master-plan-2026-04-30.md` — Workstream C (Predictive Engine Maturation) — PMC sits under C

---

## Change log

- 2026-05-09 — v1.0 authored as Gate 1 Entry artifact. RED verdict ratified by owner choice for adversarial Gate 2 taxonomy generation. PMC project charter + WS-172 ticket authored same session. Gate 2 mandatory; Gate 3 likely; Gate 4 required.
