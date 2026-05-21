# PMC Failure-Mode Taxonomy

**Project:** Predictive Model Calibration (PMC)
**Status:** Tier 1 per-class detail authored 2026-05-09 sprint 2/2 (Gate 2 close-out). Visibility-status framework added under REPLACEMENT scope. 14 Tier-1 classes across 9 families.
**Source:** Gate 2 Blind-Spot Roundtable (sprint 1/2 SPR-064), 6 specialist personas (range theorist, population ecology, frequentist, Bayesian, adversary modeler, devil's advocate). 32 candidate classes consolidated into 9 families and 14 Tier-1 entries.
**Architecture (post-2026-05-09 sprint 2/2 REPLACEMENT):** PMC ships as a `predictionAudit` per-hand IDB field — `{predictedDistribution, observedAction, modelVersion}` — replacing the original full-ledger / hierarchical-Bayesian-aggregator / expanded-dashboard architecture. Most failure modes in this taxonomy are NOT detectable at this architecture; the taxonomy now functions as a **documented invisibility surface** rather than a measurement specification.
**Charter:** [`.claude/projects/predictive-model-calibration.md`](../../../.claude/projects/predictive-model-calibration.md)
**Audit:** [`docs/design/audits/2026-05-09-blindspot-pmc-failure-modes.md`](../../design/audits/2026-05-09-blindspot-pmc-failure-modes.md)
**Pre-registration registry:** [`registered-hypotheses.md`](registered-hypotheses.md)

---

## How to read this taxonomy

This is the **invisibility surface** for PMC under REPLACEMENT scope. It enumerates classes of model error and tags each with what the architecture can see.

**Critical meta-property (per Adversary):** the taxonomy IS the floor of what the system *could* see if architecture allowed. Errors outside the taxonomy are invisible by construction. Therefore:

1. **Append-only with versioning** — old entries don't get re-classified silently. Visibility-status revisions must add a new dated tag rather than overwrite.
2. **Off-taxonomy bucket as first-class artifact** — every observation that no class matches is recorded under `FM-META-01`. The off-taxonomy rate IS the most important calibration signal even at predictionAudit granularity.
3. **Adversarial maintenance** — taxonomy is re-pressure-tested at each Gate 2-quality review (~quarterly or after any major engine change). Single-shot authorship of an instrument is the same anti-pattern as "theory validating theory."

### Visibility-status framework (added 2026-05-09 sprint 2/2 REPLACEMENT)

Each Tier-1 class is tagged with one of three visibility states:

- **`DETECTABLE-VIA-PREDICTIONAUDIT`** — the predictionAudit per-hand field carries enough signal that a query of one or many hands can reveal divergence consistent with this class. Frequency-level mismatches between predicted-action-distribution and observed-action-taken are the dominant signal at this level.
- **`OUT-OF-SCOPE-AT-CURRENT-ARCHITECTURE`** — the class would be detectable if the architecture captured additional fields or aggregated across hands. Predict-Audit's per-hand `{predictedDistribution, observedAction, modelVersion}` is not enough. **Recoverable** by extending the architecture; the class names what extension would be needed in its "Required architecture extension" line.
- **`STRUCTURALLY-INVISIBLE`** — the class is invisible by construction regardless of architecture. Off-taxonomy errors, reflexivity, system-self-confirming patterns. No extension recovers visibility; the class names what mitigation (e.g., process discipline, reviewer pressure-test) is needed instead.

**Severity scale:**
- **S0 silent** — invisible to render surface by construction; requires architectural fix or process discipline
- **S1 high** — distorts headline reading; misleads owner
- **S2 medium** — distorts edge-case reading; visible if owner queries deliberately
- **S3 low** — degrades signal quality; doesn't mis-direct conclusions

---

## Family I — Range-composition errors (the model's belief about hand distributions is wrong)

### FM-COMP-01 — Range-Composition vs Frequency Decoupling
**Sketch:** A villain's aggregate frequency for an action (e.g., river-bet 35%) can match the model's prediction while the within-range composition (value/bluff/medium ratio) is materially wrong. Frequency-only signal is necessary but **NOT sufficient** for calibration — this directly refutes the charter's load-bearing premise that "aggregate frequency violations ARE the signal." The most dangerous failure mode because it is silently self-confirming: model loses EV at showdown while reporting "model accurate" on aggregates.
**Source personas:** Range theorist (RM-01), Adversary (FM-PMC-A1), Devil's Advocate, Frequentist (FM-FREQ-04 adjacent).
**Visibility status (REPLACEMENT 2026-05-09):** `OUT-OF-SCOPE-AT-CURRENT-ARCHITECTURE`. predictionAudit captures `predictedDistribution` (which includes per-hand value/bluff weights inside the predicted action) and `observedAction` (action + sizing taken), but does NOT capture villain's actual hand composition unless showdown reveals. Frequency match between predicted-action and observed-action is detectable; range-composition divergence is invisible without showdown-stratified equity-realized.
**Severity (ratified):** S1 high.
**Detection signature:** None at predictionAudit alone. Would require: aggregate showdown-revealed hands stratified by (villain action × predicted range bucket) and equity-realized per stratum compared against predicted-stratum equity. Per-hand showdown reveal alone is insufficient (n=1 doesn't distinguish polarized from linear).
**Required architecture extension:** showdown-stratified equity-realized aggregator per (villain × action × board-texture) — explicitly cancelled at REPLACEMENT. Mitigation: WS-174 trigger-conditioned revisit ticket fires if frequency-match-rate >0.85 AND realized hero EV persistently below model-expected EV (the FM-COMP-01 signature).
**Worked example:** Model predicts villain river-bets 35% on T96r BTN-vs-BB 3bp-IP. Hand replay shows villain river-bet on this hand (consistent with prediction). Owner reads "predicted 35%, observed bet" — green. Hidden: model's 35% was supposed to be 25% value + 10% bluffs; villain's actual range was 5% value + 30% bluffs (a maniac with the same frequency). Hero called wrongly because model said "value-heavy 35% bet." predictionAudit shows match. Hero loses pot. The class is **silently self-confirming** at predictionAudit granularity.

### FM-COMP-02 — Polarization vs Linearity Mis-classification
**Sketch:** A 35% river bet is consistent with three different range shapes — polarized (25v + 10b), linear/merged (35v + 0b), or over-bluff (15v + 20b) — that produce identical frequency. Marginal-action aggregation cannot distinguish them. Detection requires equity-realized at showdown stratified by villain action.
**Source personas:** Range theorist (RM-03).
**Visibility status (REPLACEMENT 2026-05-09):** `OUT-OF-SCOPE-AT-CURRENT-ARCHITECTURE`. predictionAudit captures action-frequency only (action + sizing); doesn't carry equity-realized or showdown stratification. Same architectural gap as FM-COMP-01.
**Severity (ratified):** S1 high.
**Detection signature:** None at predictionAudit. Would require: per-villain-action stratified equity-realized at showdown; at least 30 showdowns per stratum (FM-DISC-04 defensibility floor) before drawing conclusions on range shape.
**Required architecture extension:** showdown-conditional equity-realized stratification — cancelled at REPLACEMENT. Distinguishing polarized vs linear ranges from observation requires architecture this taxonomy class would re-introduce.
**Worked example:** Model assumes villain rivers polarized on T96r. Owner-observed showdowns show villain often shows medium-strength hands at showdown (range was actually linear/merged). The aggregate frequency (35%) matched predictions all session, so predictionAudit per-hand display showed "predicted 35%, observed bet" → match → green. The shape error is invisible without explicit equity-realized aggregation by villain-action.

### FM-COMP-03 — Mixing-Weight Collapse
**Sketch:** When the same hand legitimately appears in multiple action ranges (AA in both `open` and `limp` for traps), a single observed showdown can erode alternative-action weight in the posterior even though no evidence contradicted mixing. Range engine's existing weight-anchoring path (`bayesianUpdater.js`, RANGE_ENGINE_DESIGN §4.5) is the failure surface.
**Source personas:** Range theorist (RM-02).
**Visibility status (REPLACEMENT 2026-05-09):** `OUT-OF-SCOPE-AT-CURRENT-ARCHITECTURE`. The class lives inside the range-engine update path (RANGE_ENGINE_DESIGN §4.5), not at the predictionAudit layer. Reassigned partially to **WS-175** (range-engine Q6 update gating); the order-invariance + mixing-weight question is the range-engine theorist's pushback at sprint 1/2 Stage D.
**Severity (ratified):** S2 medium.
**Detection signature:** None at predictionAudit. Would require: range-engine-internal posterior tracking comparing pre-update vs post-update mixing weights when an alternative-action hand appears in only one observed action.
**Required architecture extension:** range-engine internal logging of posterior shifts on mixing-eligible hands — owned by range-engine program (WS-175 + future range-engine work).
**Worked example:** Hero has played villain V for 20 hands. V open-raises AA in 1 hand → showdown reveals AA. Range engine updates open range posterior to over-weight AA. Now V's predicted limp-with-AA frequency (a legitimate trap subset) collapses to ~0 even though no observation contradicted limp-with-AA. Future predictions of villain-limp ranges are now systematically value-light. predictionAudit cannot see this because it captures the OUTPUT of the range engine, not the engine's internal posterior shifts.

### FM-COMP-04 — Sizing-Tendency Lattice Error (action-conditional sizing unmodeled)
**Sketch:** Two villains "3-bet at 8% frequency" can have radically different sizing distributions (small-3bet-bluff vs large-3bet-value as separate skill stacks). Sizing exists in `actionSequence.potRelative` but is not modeled per-hand within action ranges. Realized fold-equity diverges from predicted at fixed action+frequency.
**Source personas:** Range theorist (RM-07).
**Visibility status (REPLACEMENT 2026-05-09):** `DETECTABLE-VIA-PREDICTIONAUDIT`. predictionAudit captures predicted sizing distribution within `predictedDistribution.distribution[].sizing` AND observed sizing within `observedAction.sizing`. Per-hand divergence between predicted and observed sizing is directly visible. Per-villain aggregate sizing mismatch over many hands is recoverable by manual reading.
**Severity (ratified):** S2 medium.
**Detection signature:** For each hand in HandReplay, render `predictedDistribution[i].sizing` (with weight) alongside `observedAction.sizing` for the same actor+action. When the observed sizing falls outside the predicted sizing distribution's mass (e.g., predicted: 2.5x mean, σ=0.5x; observed: 5x), surface the divergence per-hand. No aggregation needed for class detection at single-hand granularity.
**Worked example:** Model predicts villain 3-bets at 8% frequency with sizing distribution {2.5x: 0.7, 4x: 0.3} (mostly small). Observed: villain 3-bet 5x. Per-hand predictionAudit shows the sizing mismatch immediately. Owner forms judgment: this villain's small-3bet-bluff range may be underweighted. (Reading multiple hands accumulates the pattern.) AP-PMC-06 forbids any aggregate "sizing accuracy" framing; per-hand surfacing only.

---

## Family II — Population/prior mis-specification (the prior is wrong)

### FM-PRIOR-01 — Reference-Class Miscalibration
**Sketch:** Codebase priors (`populationPriors.js`, `gameTreeConstants.js:124 POP_CALLING_RATES`, `villainModelData.js`) are sourced to "live small-stakes 1/2-5/10 cash" or unspecified pools. The actual data stream is anonymous Ignition online. Reference class is wrong at the source. Concrete: `NO_RAISE_FREQUENCIES.EARLY.open = 0.12` is likely too tight for online; `POP_CALLING_RATES.air = 0.08` is likely too low for Ignition rec pool.
**Source personas:** Population ecology (FM-POP-01), Adversary, Devil's Advocate.
**Visibility status (REPLACEMENT 2026-05-09):** `OUT-OF-SCOPE-AT-CURRENT-ARCHITECTURE` for the architectural correction (recompute the prior). `DETECTABLE-PER-HAND-ONLY` for the symptom (individual prediction-vs-observation divergence). Per-hand divergence accumulates in the owner's reading; aggregating to "the prior is off by X%" requires cross-hand aggregation that REPLACEMENT cancels.
**Severity (ratified):** S1 high.
**Cross-program:** populationPriors.js, gameTreeConstants.js, villainModelData.js, POKER_THEORY §9.1-9.5.
**Detection signature:** Per-hand: `predictedDistribution.action.weight` differs from observed action by margin > expected variance for low-N villains. Aggregate: median per-hand divergence across N hands of similar situation-key shows systematic bias. Aggregate detection is OUT-OF-SCOPE under REPLACEMENT.
**Required architecture extension:** range-engine + populationPriors aggregator (separate from predictionAudit) that re-derives baseline frequencies from observed data + writes back to populationPriors.js. Reassigned to range-engine + populationPriors program scope; charter Q4 verdict (Ignition × format × stakes × daypart slicing) governs.
**Worked example:** Model predicts EP-open-rate = 12% from `populationPriors.js`. Owner reads 50 EP open opportunities in HandReplay; sees ~18 opens (36%). Per-hand predictionAudit shows per-hand mismatches accumulating. Owner forms judgment that priors need raising; manually adjusts populationPriors.js. Architecture does NOT auto-tune (AP-PMC-01 binding); owner-mediated adjustment only.

### FM-PRIOR-02 — Sub-Population Conflation
**Sketch:** Single `popCallRate` averages across cash 9-max + cash 6-max + Zone Poker (fast-fold) + SNG/tournament. These pools draw different distributions. Prior is the average of multimodal pools — wrong for every sub-population. Charter's hierarchical Bayes sketch does NOT list `format` as a slicing dimension.
**Source personas:** Population ecology (FM-POP-02, FM-POP-08).
**Visibility status (REPLACEMENT 2026-05-09):** `OUT-OF-SCOPE-AT-CURRENT-ARCHITECTURE`. Sub-pool slicing requires aggregating predictionAudit across hands grouped by format/stakes. predictionAudit field captures `modelVersion` and the prediction itself per hand, but NOT the format/stakes context as a queryable axis.
**Severity (ratified):** S1 high.
**Detection signature:** None at predictionAudit alone. Would require: aggregator that groups hands by format (cash 9max / cash 6max / Zone / SNG / tournament) × stakes × daypart and computes per-stratum frequency-match rates. Stratum-level mismatches reveal sub-pool conflation.
**Required architecture extension:** populationPriors range-engine slicing per charter Q4 verdict — reassigned to range-engine + populationPriors scope. PMC does NOT own this aggregator under REPLACEMENT.
**Worked example:** Owner plays mix of cash 9max + Zone Poker. Model uses unified `POP_CALLING_RATES` (not format-stratified). Per-hand predictionAudit shows mismatches but owner cannot tell which format is over-/under-calibrated without aggregating by format. The "single prior averaging multimodal pools" claim is invisible at per-hand granularity.

### FM-PRIOR-03 — Soft-Pool Drift / Secular Toughening
**Sketch:** Live-pool literature shows 90-day-to-multi-year secular drift; Ignition specifically post-2024 RNG/anonymous-table changes. Priors don't have a half-life. POKER_THEORY §9.5 (river over-bluff calibration) was authored against 2-3-year-old pool data; rolling 90-day vs trailing 12-month posteriors will diverge monotonically on aggression metrics.
**Source personas:** Population ecology (FM-POP-05).
**Visibility status (REPLACEMENT 2026-05-09):** `OUT-OF-SCOPE-AT-CURRENT-ARCHITECTURE`. Time-series drift requires aggregating predictionAudit across calendar windows. Per-hand display has no temporal aggregation.
**Severity (ratified):** S2 medium.
**Detection signature:** None at predictionAudit alone. Would require: rolling 90-day vs 12-month aggregator per situation-key with BOCPD change-point detection (charter Q5 verdict).
**Required architecture extension:** time-series aggregator with BOCPD change-point detection. Phase 5b Gate 4 design must adhere if drift surface emerges; otherwise this class is invisible under REPLACEMENT.
**Worked example:** POKER_THEORY §9.5 says river over-bluff rate is 38% (authored 2024). Actual 2026 Ignition rate is 28% (pool toughened). Owner reads dozens of HandReplay hands across months; some show divergence, some don't. Without temporal stratification, drift looks like noise. Pre-registration registry mitigates: a hypothesis "river over-bluff has declined since 2024" can be registered, and if the data slice supports it, owner adjusts POKER_THEORY §9.5.

### FM-PRIOR-04 — Latent-Class Mixture / No-Individual-Matches-Mean
**Sketch:** Ignition pool is a mixture of latent classes (bot/grinder/recreational at non-trivial fractions). Hierarchical Bayes shrinks toward a population mean — but the population is a *mixture* whose mean matches no individual's behavior. Per-villain posterior bimodal histograms on VPIP/PFR/AGG would surface this; current pipeline assumes unimodal. **Critical convergent recommendation across personas:** add a latent-archetype layer between population and per-villain.
**Source personas:** Population ecology (FM-POP-06), Bayesian (FM-BAY-07 adjacent).
**Visibility status (REPLACEMENT 2026-05-09):** `MOOT-UNDER-REPLACEMENT`. The original architectural ask was to add a latent-class layer between population and per-villain in the hierarchical Bayesian aggregator. REPLACEMENT cancelled the aggregator entirely. The class's substantive concern (population is a mixture, not a unimodal pool) remains valid as a range-engine + populationPriors concern but is no longer a PMC ask. Per-villain shrinkage (the failure surface this class targeted) does not exist at REPLACEMENT.
**Severity (ratified):** S1 high (when applicable). **Effective severity under REPLACEMENT:** N/A — failure mode does not manifest at this architecture.
**Detection signature:** Bimodal histograms on per-villain VPIP/PFR/AGG. Detection requires hierarchical aggregator with per-villain posteriors. Cancelled at REPLACEMENT.
**Required architecture extension:** hierarchical aggregator with latent-class layer (3-level: population → cluster centroid → per-villain). Cancelled at REPLACEMENT. The substantive concern (mixture population) re-applies if range-engine introduces population-prior estimation that assumes unimodality — see range-engine + populationPriors program scope.
**Worked example:** Three Ignition villains. Villain A = grinder (VPIP 22%, PFR 18%). Villain B = recreational (VPIP 38%, PFR 8%). Villain C = unknown anonymous. Hierarchical aggregator (cancelled) would have shrunk villain C toward the population mean (VPIP ~28%, PFR ~12%) — which matches NEITHER A nor B. Under REPLACEMENT, predictionAudit just shows per-hand divergence; no shrinkage, no failure mode of this shape.

---

## Family III — Aggregation/inference-machinery errors (the math is wrong)

### FM-INF-01 — Identifiability Collapse on (villain × situation)
**Sketch:** When a villain is observed almost exclusively in one situation-key, the per-villain effect and per-situation effect become un-separable. Posterior over `villain_effect_v` and `situation_effect_s` is determined only along the line `v + s = const`. Diagnostic: posterior credible intervals **expand** rather than contract as N grows for that cell — but charter doesn't render this diagnostic.
**Source personas:** Bayesian (FM-BAY-01), Adversary (FM-PMC-A5).
**Visibility status (REPLACEMENT 2026-05-09):** `MOOT-UNDER-REPLACEMENT`. Identifiability collapse is a property of the cancelled hierarchical aggregator's per-(villain × situation) cells. predictionAudit per-hand has no posterior to collapse; no per-villain × per-situation aggregation surface exists.
**Severity (ratified):** S0 silent (when applicable). **Effective under REPLACEMENT:** N/A.
**Detection signature:** Posterior credible interval expansion as N grows for a (villain × situation) cell. Cancelled at REPLACEMENT.
**Required architecture extension:** variance decomposition surfaced on aggregator output. Cancelled at REPLACEMENT.
**Worked example:** Villain V is observed only in BTN-vs-BB-3bp. Aggregator (cancelled) would compute posterior P(V's river-bet | BTN-vs-BB-3bp) without being able to separate "this is what V does" from "this is what people do in this situation." Posterior CI would expand at higher N. Under REPLACEMENT, no aggregate exists; predictionAudit shows per-hand prediction-vs-observation only.

### FM-INF-02 — Posterior Domination by Wrong Prior
**Sketch:** `PRIOR_WEIGHT = 10` means per-(villain, situation, outputClass) cells with N<5 real obs have prior dominating by 2:1+. Combined with FM-PRIOR-* (wrong prior), every low-N villain inherits the same wrong posterior; dashboard shows them all as "calibrated" because they match the prior. **Test:** if you remove a player's last 5 hands and recompute, change is below shrinkage threshold across most cells — there is no signal, only prior.
**Source personas:** Bayesian (FM-BAY-02), Range theorist (RM-04).
**Severity (provisional):** S1 high.

### FM-INF-03 — Mean-Field Independence Violation
**Sketch:** Schema treats `outputClass: 'fold-rate' | 'sizing-recommendation' | 'range-distribution'` as separable axes. They are NOT independent — wider 3bet range necessarily implies different sizing distribution and fold-to-4bet rate. Aggregating as independent overstates effective sample size and produces over-tight CIs. Posterior predictive checks on joint cells will fail even when marginals match.
**Source personas:** Bayesian (FM-BAY-03).
**Severity (provisional):** S2 medium.

### FM-INF-04 — Hierarchical-Pooling Failure for Anonymous Identities
**Sketch:** On Ignition, `playerId = seat-within-session` for anonymous opponents. Across sessions, the same playerId is a different human. Per-villain shrinkage uses fictitious individuals whose 200-hand sample is actually ~9 different players × ~20 hands each. Per-villain posteriors look high-N and falsely confident. Per-villain N stays in single digits indefinitely; **hierarchical aggregation degenerates to single-level (population-only) for ~95% of Ignition observations** — the middle level is fictitious. **This is the core devil's-advocate critique made architecturally specific.**
**Source personas:** Population ecology (FM-POP-03), Bayesian (FM-BAY-07), Devil's Advocate.
**Visibility status (REPLACEMENT 2026-05-09):** `MOOT-UNDER-REPLACEMENT`. **This class's existence is what motivated REPLACEMENT** — Devil's-Advocate Concern 4 (sprint 1/2). The ~95%-of-villains-recover-the-prior critique said the hierarchical machinery would not earn its keep on Ignition's anonymous pool. Founder accepted REPLACEMENT precisely because this class made the per-villain aggregator non-load-bearing.
**Severity (ratified):** S1 high (when applicable). **Effective under REPLACEMENT:** N/A — the class is preserved as the architectural-decision rationale, not as an active failure mode.
**Detection signature:** Posterior shape on per-villain inference would be ≈ population prior for ~95% of villains. Cancelled at REPLACEMENT.
**Required architecture extension:** cluster/archetype shrinkage in place of per-villain shrinkage (the latent-class layer in FM-PRIOR-04). Cancelled at REPLACEMENT.
**Worked example:** A 200-hand session against 9 anonymous Ignition opponents. Pre-REPLACEMENT aggregator would have computed per-villain posteriors for each playerId (9 individuals × ~22 hands each). Each per-villain posterior would be dominated by the prior (PRIOR_WEIGHT=10 vs N=22 → prior dominates 1:2). Posterior ≈ prior for all 9 → aggregator surfaced "calibrated" reading that was actually just the prior. Under REPLACEMENT, no aggregator exists; predictionAudit shows raw per-hand prediction-vs-observation, no false confidence layer.

---

## Family IV — Selection / sampling biases (the data is wrong)

### FM-SEL-01 — Showdown Selection Bias (MNAR)
**Sketch:** Showdowns are non-random — they require both players reach the river, conditional on action history. Bayesian updates from showdown likelihoods (RANGE_ENGINE_DESIGN §4.5) treat showdowns as MAR (missing-at-random) when they are MNAR. Range-engine update fed only this biased subset systematically over-weights value-and-stubborn-bluff portion of range. Per-firing tightening of posteriors on a non-representative slice. Convergent across 4 personas.
**Source personas:** Range theorist (RM-08), Bayesian (FM-BAY-04), Adversary (FM-PMC-A7), Frequentist (FM-FREQ-05).
**Visibility status (REPLACEMENT 2026-05-09):** `OUT-OF-SCOPE-FOR-PMC`. The class lives inside the range-engine §4.5 update path which is independent of predictionAudit. Reassigned to range-engine + WS-175 scope. PMC's predictionAudit doesn't see range-engine internal updates; range-engine is the failure surface.
**WS-175 disposition (2026-05-10 SPR-067):** **ACCEPTED with observability rails.** Range-engine §4.5 documents the bias as a known limitation with explicit rationale. `revealMechanism` field shipped on showdown anchor records (default `'showdown'`); reserved values `'mucked-shown' | 'all-in-runout' | 'inferred-from-fold'` available for future extractor refinement. **No boost-magnitude correction today** — the math correction would be calibrated against a feature the engine cannot yet populate. Class stays open as long-term monitoring concern; magnitude must be measured before correction is applied.
**Severity (ratified):** S0 silent.
**Detection signature:** Bias detection requires range-engine-internal logging of showdown-update events with `revealMechanism` field plus comparison of pre-update vs post-update posterior on the same range. Range-engine territory. The `revealMechanism` rail shipped 2026-05-10; per-anchor records now persist the field, providing the substrate for future detection.
**Required architecture extension:** range-engine adds `revealMechanism: 'showdown' | 'mucked-shown' | 'all-in-runout' | 'inferred-from-fold'` field at update-event log + selection-bias correction in §4.5 update math. WS-175 (Q6 update gating) must explicitly choose: accept the bias / mitigate via reveal-mechanism weighting / refuse showdown updates from biased streets. **Rail shipped (WS-175 / SPR-067, 2026-05-10).** Stance: ACCEPT.
**Worked example:** Hero plays vs villain V over 100 hands; reaches showdown 12 times. Of those 12, 9 are big pots where V went to showdown with strong hands (stubborn bluff or value). Range-engine's §4.5 update path sees 12 showdowns, treats each as random sample → V's range posterior tightens around "value-or-stubborn-bluff." V's actual range across all 100 hands has plenty of medium-strength hands that folded to bets earlier (never reached showdown). Posterior is systematically biased; range engine uses biased posterior; predictions to hero are biased. predictionAudit observes the biased predictions matching biased observations → green.

### FM-SEL-02 — Hero-Policy-Conditional Selection
**Sketch:** Hero's action selection determines which villain decision-nodes the ledger records. If hero cbets only A-high boards, river ledger entries for villain are conditioned on "hero cbet A-high" — not on the population baseline the priors were calibrated to. Aggregator treats every recorded entry as exchangeable. The ledger is a non-random sample of decision-nodes weighted by hero's policy.
**Source personas:** Adversary (FM-PMC-A3).
**Severity (provisional):** S1 high.

### FM-SEL-03 — Survivorship in Action History
**Sketch:** Preflop folds in 9-handed games are observed only as "fold," with no information about the hand the villain folded. Model's predicted P(fold | range) is conditional on a prior range we never observe. Marginalization over unobserved ranges produces a frequency that looks correctly calibrated even when per-combo predictions are systematically wrong.
**Source personas:** Adversary (FM-PMC-A1).
**Severity (provisional):** S0 silent.

### FM-SEL-04 — Reflexivity (the dashboard changes what it measures)
**Sketch:** Owner reads dashboard, adjusts cbet frequency, ledger captures hero-adjusted-policy decisions, population baseline drifts toward the new policy. Within ~200 hands the baseline IS hero's adjusted policy and the dashboard shows perfect calibration. **Required ledger field:** `heroPolicyHash` covering hero's current advice-bundle config + aggregator MUST stratify by it. Without this, AP-PMC-01 ("no model auto-tuning from ledger") is the *only* thing keeping the system from devouring its own tail.
**Source personas:** Adversary, Devil's Advocate.
**Visibility status (REPLACEMENT 2026-05-09):** `STRUCTURALLY-INVISIBLE` for the dashboard-driven reflexivity; `MOOT-UNDER-REPLACEMENT` for the dashboard surface itself. Dashboard cancelled, so dashboard-as-source-of-reflexivity does not exist. **Residual reflexivity at per-hand HandReplay display:** owner reads predictionAudit divergence on a hand, adjusts strategy, future hands reflect new strategy → predictionAudit captures the new equilibrium with no awareness that it was self-induced. Mitigated by AP-PMC-06 (forbids variance-blame framing that would amplify the reflexivity loop) + pre-registration registry (forces hypothesis registration before adjustment).
**Severity (ratified):** S0 silent.
**Detection signature:** Owner-driven strategy drift correlated with predictionAudit reading patterns. Detection requires `heroPolicyHash` field on each entry plus stratification — both cancelled at REPLACEMENT. Pre-registration registry catches some cases (registered hypotheses surface owner-driven adjustments).
**Mitigation (no architectural fix possible):** AP-PMC-06 binding (no variance-blame framing); pre-registration registry binding for any hypothesis that informs strategy adjustment; AP-PMC-01 binding (no model auto-tuning). The class is structurally invisible at any architecture; process discipline is the only defense.
**Worked example:** Owner reads HandReplay, sees model predicted 35% river-bet but villain checked. After 5 such observations, owner adjusts cbet frequency in their own play (perhaps unconsciously). Future predictionAudit captures hero's new strategy → predictions and observations re-align → predictionAudit shows "model is calibrated." Hero's strategy may now be sub-optimal because it was driven by sample noise, not signal. AP-PMC-06 + pre-registration registry catch the "I noticed something on these hands" case by forcing it to be registered as a hypothesis before adjustment.

---

## Family V — Frequentist / multiple-comparisons / discipline errors (the inference protocol is wrong)

### FM-DISC-01 — Garden of Forking Paths (retroactive slicing)
**Sketch:** Owner can re-slice ledger by villain × situation × board-texture × villain-style × time-window post-hoc. Each slice is a new test never pre-registered. Ratio of *queries executed* to *findings surfaced* is invisible unless dashboard logs queries. **Required:** pre-registration file at `docs/projects/predictive-model-calibration/registered-hypotheses.md` ratchet — new hypothesis = explicit ratchet entry, not retroactive add.
**Source personas:** Frequentist (FM-FREQ-01).
**Severity (provisional):** S0 silent.

### FM-DISC-02 — Optional Stopping / Live Peeking
**Sketch:** Owner watches calibration drift between sessions, reaches verdict the moment CI lower bound first clears baseline. The "first crossing" is biased high (sequential testing without α-spending). Aggregator firing on every session-close write *creates* this surface.
**Source personas:** Frequentist (FM-FREQ-02).
**Severity (provisional):** S1 high.

### FM-DISC-03 — Multi-Comparisons Explosion
**Sketch:** ~50 output classes × ~50 villains × ~200 situation keys ≈ **5×10⁵ implicit hypotheses**. At nominal 95% CI, ~25,000 spurious "out-of-CI" flags expected by chance. Bayesian shrinkage narrows posteriors but does **not** correct family-wise error of *which slice you decided to look at*. Bonferroni at this scale is vacuous (α'≈10⁻⁷). **Required discipline:** Tier-1 (pre-registered rules, FDR-controlled q=0.10) vs Tier-2 (exploratory, displayed without flag semantics).
**Source personas:** Frequentist (FM-FREQ-03).
**Visibility status (REPLACEMENT 2026-05-09):** `MOOT-UNDER-REPLACEMENT-FOR-AGGREGATES`, `MITIGATED-BY-PRE-REGISTRATION-REGISTRY` for any future slicing. predictionAudit per-hand has no implicit hypotheses (each hand is its own observation). Multi-comparisons explosion only re-emerges if Phase 5b adds aggregate slicing.
**Severity (ratified):** S0 silent (when applicable).
**Detection signature:** Owner-query rate >> reported-finding rate. Without query logging, invisible. Detection requires query log on any aggregate surface.
**Mitigation (no statistical correction needed under REPLACEMENT):** Pre-registration registry (`registered-hypotheses.md`) binds Tier-1 verdicts (charter Q2 verdict 2026-05-09 sprint 2/2). Any predictionAudit-derived hypothesis that emits flag-bearing prose must be pre-registered with id + class-link + detection-signature + authored-date BEFORE first data view. Tier-2 (exploratory) views are unrestricted but MUST be labeled non-flag-bearing in any future render surface. FDR / Bonferroni / hierarchical pooling not needed — the discipline replaces statistical correction.
**Worked example:** Owner browses HandReplay, slices predictionAudit by villain × board-texture × position post-hoc, finds "villain V over-folds to triple-barrel on monotone boards in 4 of 7 observed hands." Without pre-registration, this is a garden-of-forking-paths finding — owner queried hundreds of slices, found one. Pre-registration registry refuses verdict status: the hypothesis "V over-folds triples on monotone boards" was not registered before owner saw the data, so it cannot be a Tier-1 (flag-bearing) finding. To make it Tier-1, owner registers the hypothesis NOW (post-hoc) and waits for fresh data; the next 30+ qualifying hands generate the verdict.

### FM-DISC-04 — Power Asymmetry / N-Threshold Slippage
**Sketch:** AP-SCF-04 sets n≥30 floor at the rule level. Many ledger queries sit at n=10-25 forever. Floor is enforced on rules; on aggregator dashboard slices it is not. Owner reads point-estimate prose for slices the framework would refuse to flag. **Required:** report-only-after-N gate at `n ≥ max(30, 4/baseline_rate, 4/(1-baseline_rate))` for low-base-rate events.
**Source personas:** Frequentist (FM-FREQ-06).
**Severity (provisional):** S2 medium.

---

## Family VI — Drift detection errors

### FM-DRIFT-01 — KL on Sparse Multinomials
**Sketch:** KL(P || Q) is undefined / explodes when Q has zero mass on outcomes P observed. With sparse cells (~50 output classes × per-villain × per-situation), sparse cells are the rule. KL fires as "drift" simply because the recent window happened to sample a rare-but-prior-zero outcome. **Recommended replacement:** Hellinger distance OR Bayes factor, not raw KL.
**Source personas:** Bayesian (FM-BAY-05).
**Severity (provisional):** S2 medium.

### FM-DRIFT-02 — Window-Choice Dominance
**Sketch:** Sliding window forces a hyperparameter choice that cannot be right for both fast-changing villains (a villain going on tilt) and slow population drift (Ignition pool maturity over months). Window choice dominates the signal. **Recommended:** Bayesian online change-point detection (BOCPD, Adams & MacKay 2007), not static-posterior comparison via KL.
**Source personas:** Bayesian, Range theorist (architectural pushback).
**Severity (provisional):** S1 high.

### FM-DRIFT-03 — Sequential-Test Type-I Inflation
**Sketch:** Drift threshold without α-spending. Repeated peeking at KL inflates type-I. Charter §HBA "flag if KL > threshold" recomputed each window has no sequential correction.
**Source personas:** Frequentist (FM-FREQ-07).
**Severity (provisional):** S2 medium.

---

## Family VII — Categorical / schema / lineage errors

### FM-LINEAGE-01 — Categorical-Key Churn
**Sketch:** `situationKey`, `boardKey`, `actionHistoryHash` are computed by code that itself changes. A refactor that re-buckets boards (e.g., adds "monotone-paired" texture class) silently splits historical ledger entries; per-bucket posteriors reset to uninformative. Dashboard shows "n=12, low confidence" for what was actually n=400 of stable behavior — drift is invisibly *re-introduced* as low-data noise.
**Source personas:** Adversary (FM-PMC-A8).
**Severity (provisional):** S0 silent. **Required:** `keyDefinitionVersion` snapshot + lineage-break detection + explicit re-bucketing UI.

### FM-LINEAGE-02 — Model-Version Drift Aliasing
**Sketch:** `modelVersion` field tags entries, but model bundles change between sessions. Aggregating a 90-day window aggregates across model versions. If v1.7 over-predicted fold and v1.8 under-predicted, aggregator over the union shows "calibrated" by cancellation. Per-version stratification requires the dashboard query to opt in; "calibrated" green dot at rollup is the default render — exactly the wrong default.
**Source personas:** Adversary (FM-PMC-A6).
**Visibility status (REPLACEMENT 2026-05-09):** `DETECTABLE-PER-HAND-VIA-PREDICTIONAUDIT`. predictionAudit captures `modelVersion` per hand. Per-hand HandReplay display can render the modelVersion. Cross-version aggregation aliasing is OUT-OF-SCOPE for aggregate (no aggregator under REPLACEMENT) but the underlying signal (which model produced this prediction) is preserved at per-hand level.
**Severity (ratified):** S1 high.
**Detection signature:** Per-hand: render modelVersion alongside predictedDistribution. Owner browsing HandReplay sees model-version on each hand. Aggregate detection (cross-version drift) requires aggregator and is OUT-OF-SCOPE.
**Required architecture extension:** per-version-stratified aggregator (cancelled at REPLACEMENT). Phase 5b render surface design MUST display modelVersion on per-hand surface — non-negotiable Phase 5b binding. If Phase 5b ever adds aggregate surface, per-version stratification MUST be the default render (not opt-in) per sprint 1/2 architectural ask.
**Worked example:** Hero plays 100 hands across 2 weeks. Mid-week, model bundle updates from v1.7 to v1.8 (sizing-binned tendency refactor). Hands 1-50 use v1.7, hands 51-100 use v1.8. Per-hand HandReplay display shows modelVersion on each hand → owner can spot version transition. Without the modelVersion column, cross-version drift would be invisible aliasing. AP-PMC-06 binding: aggregate prose like "the model has been Y% accurate this week" forbidden — would alias across versions.

### FM-LINEAGE-03 — Action-Taxonomy Gap (e.g., squeeze, multiway)
**Sketch:** `rangeEngine/CLAUDE.md` §4 explicitly notes squeeze is unimplemented. Every multi-way `(open + caller + villain-decision)` collapses to either coldCall or threeBet. Ledger entries with `villainsRemaining > 2` will systematically under-predict aggression and aggregator will read this as "model wrong" when in fact the model's *action space* is wrong. **Required field:** `actionTaxonomyVersion` so taxonomy gaps are distinguishable from calibration gaps.
**Source personas:** Range theorist (RM-06).
**Severity (provisional):** S1 high.

### FM-LINEAGE-04 — Sufficient-Statistic Loss / Replay Non-Determinism
**Sketch:** Ledger entry stores `predictedDistribution` and `observedOutcome` but NOT the prior at decision time, NOT the likelihood that produced the prediction, NOT the posterior precision. Re-running the aggregator at a later modelVersion against historical ledger entries CANNOT reconstruct what the model *would have* believed given updated priors. The ledger is informationally lossy for counterfactual model evaluation. **Required ledger schema additions:** `priorAtDecision { distributionType, params, virtualObsWeight }`, `evidenceUsed { fromLedger: string[], fromShowdownAnchors: string[] }`, `likelihoodFamily`, `posteriorPrecision`, `selectionPath`.
**Source personas:** Bayesian (FM-BAY-06), Range theorist.
**Visibility status (REPLACEMENT 2026-05-09):** `OUT-OF-SCOPE-AT-CURRENT-ARCHITECTURE`. predictionAudit captures predictedDistribution + observedAction + modelVersion only — strictly less than the full sketch ledger. Counterfactual replay is impossible at this granularity (would require capturing the prior + likelihood + posterior precision to be even theoretically replayable).
**Severity (ratified):** S0 silent.
**Detection signature:** None at predictionAudit. Detecting non-replayability requires actually attempting replay and seeing it fail — a property of the cancelled lossless ledger.
**Required architecture extension:** ledger schema with `priorAtDecision`, `evidenceUsed`, `likelihoodFamily`, `posteriorPrecision`, `selectionPath` fields per entry. Cancelled at REPLACEMENT. The class is preserved as documentation of what predictionAudit explicitly does NOT capture — useful if architecture extension is ever revisited.
**Worked example:** Hero played hand 6 weeks ago at modelVersion v1.6. predictionAudit captured `{predicted: river-bet 35%, observed: bet, modelVersion: v1.6}`. Today at v1.8 (which uses different priors), owner asks "what would v1.8 have predicted on that same hand?" — IMPOSSIBLE because v1.6's prior + likelihood at decision-time was not captured. Re-running v1.8 against the hand re-uses TODAY's data accumulation, not what v1.8 would have done with only the data available 6 weeks ago. The class names this loss; predictionAudit accepts the loss as the cost of architectural simplicity.

---

## Family VIII — Off-taxonomy / measurement-floor errors (errors invisible by construction)

### FM-META-01 — Off-Taxonomy Residual
**Sketch:** This taxonomy IS the measurement floor. Errors outside the taxonomy are invisible by construction. Single-shot taxonomy authoring is the same anti-pattern as "theory validating theory" the program purports to fix. **Required:** taxonomy is append-only with versioning + every observation that no class matches is recorded under FM-META-01 + the off-taxonomy rate IS the most important calibration signal — if it grows, the taxonomy is rotting + adversarial re-pressure-testing on a quarterly cadence (or after major engine change).
**Source personas:** Adversary.
**Visibility status (REPLACEMENT 2026-05-09):** `STRUCTURALLY-INVISIBLE`. By construction, errors outside the taxonomy are invisible to any architecture that uses the taxonomy as its measurement instrument. predictionAudit per-hand display surfaces frequency-level divergence; off-taxonomy errors (model errors that don't match any enumerated class) appear as "no anomaly to flag" or as "miscellaneous" without further attribution.
**Severity (ratified):** S0 silent. **Most important class in the taxonomy** — the off-taxonomy rate IS the most important meta-calibration signal.
**Detection signature:** None directly. Off-taxonomy rate is computed indirectly: total observed model errors minus errors-attributable-to-known-classes. Without an aggregator, this rate is not surfaced at predictionAudit; mitigated by adversarial taxonomy maintenance (process discipline).
**Mitigation (no architectural fix recovers visibility):**
1. **Append-only taxonomy versioning** — class additions recorded with date; old class definitions never silently re-classified
2. **Adversarial re-pressure-test on quarterly cadence** — schedule: 2026-08-09 (90 days post-Gate 2 close-out), then quarterly thereafter or after any major engine change
3. **Off-taxonomy bucket process** — when owner observes a divergence in HandReplay that doesn't fit any class, owner registers it as a candidate for taxonomy expansion (manual, owner-discretion) in pre-registration registry under class `FM-META-01-CANDIDATE-NNN`
**Worked example:** Owner reads HandReplay, sees an unusual prediction-vs-observation divergence pattern. The pattern matches no Tier-1 class. Without the off-taxonomy process, owner accepts the divergence as "noise." With the off-taxonomy process, owner registers it under `FM-META-01-CANDIDATE-001`. After accumulating 3-5 similar candidates, owner-driven adversarial review either promotes the cluster to a new Tier-1 class (taxonomy version bump) or refutes them (records as exemplar of FM-META-01 noise). The class is the program's bypass for its own theory-validating-theory failure mode.

### FM-META-02 — Writer Asymmetry / Dropout Under Failure
**Sketch:** Hand-end orchestrator may crash, app may close mid-hand, IDB may throttle. If failure is correlated with prediction class (e.g., long-hand triple-barrel sessions cause more crashes), ledger missingness is systematic. There is no telemetry on intended-but-not-written entries. **Required:** `partialFlush: true` flag + intended-vs-written telemetry (write-attempt count vs success count per session).
**Source personas:** Adversary (FM-PMC-A9).
**Severity (provisional):** S1 high.

### FM-META-03 — Confounder Collapse (situationKey treated as sufficient)
**Sketch:** Two hands with identical situationKeys can have wildly different unobserved confounders (table dynamics, recent stack history, prior tilt-trigger 6 hands ago). Aggregator slicing by `situationKey × villainId` implicitly assumes situationKey is a sufficient statistic for villain decision. It isn't — and aggregating across un-modeled confounders produces a posterior that *looks tight* (narrow CI) while being systematically biased.
**Source personas:** Adversary (FM-PMC-A2).
**Severity (provisional):** S1 high.

---

## Family IX — Program-induced failure classes (failures PMC creates that don't exist now)

These are unique because they didn't exist before PMC. Devil's Advocate's primary contribution.

### FM-PROG-01 — Aggregate-CI Anchoring Bias
**Sketch:** Once posterior shows "river-bet 22% [16,28]" on villain V, owner stops *seeing* V's deviations — the band defines "normal." Pre-PMC, owner sees raw plays. The dashboard *creates* what it purports to surface (drift inside the CI is invisible).
**Source personas:** Devil's Advocate.
**Visibility status (REPLACEMENT 2026-05-09):** `MOOT-UNDER-REPLACEMENT`. The class requires aggregate-CI display to manifest. REPLACEMENT cancelled the aggregator and the CI surface. Per-hand predictionAudit display does NOT compute or render CIs (each hand is its own observation). The anchoring bias mechanism is structurally absent.
**Severity (ratified):** S2 medium (when applicable). **Effective under REPLACEMENT:** N/A.
**Detection signature:** Owner attention regression — does owner stop noticing villain deviations after CI is rendered? Behavioral; no architectural detection. Cancelled at REPLACEMENT.
**Required architecture extension:** aggregate-CI surface (cancelled). If Phase 5b ever introduces a CI display (it should not — Stage E ratification 2026-05-09 binds), this class returns to active status and re-opens Stage E analysis at THAT ticket's Gate 1.
**Worked example:** Pre-REPLACEMENT scenario (now MOOT): aggregator computes "villain V river-bet 22% CI [16, 28]" over 84 firings. Owner reads dashboard, internalizes "22% is normal." V then bets 3 of next 5 rivers (60%) — well above CI upper bound, but each individual hand is in the band's tail. Owner doesn't notice. Pre-PMC owner would have noticed "V is betting more rivers." Aggregator surfaces post-hoc trend after enough hands accumulate, but by then owner has lost EV on those 5 hands. **Under REPLACEMENT:** no aggregator → no CI → owner sees per-hand divergence directly → no anchoring bias of this shape.

### FM-PROG-02 — False-Confidence-from-Aggregates
**Sketch:** A well-calibrated dashboard makes the *model* feel right when the residual error is in unmodeled situations the ledger never tagged. Combined with FM-LINEAGE-03 (action-taxonomy gap), the dashboard's most positive readings are systematically the cells where the model is structurally blind.
**Source personas:** Devil's Advocate, Adversary.
**Severity (provisional):** S1 high.

### FM-PROG-03 — Cognitive-Cost Capability Regression
**Sketch:** Owner reads `[16%, 28%]` instead of forming a gut read. Capability regression dressed as instrumentation. Replacing working memory with hierarchical Bayes shifts agency away from owner-mediated trust toward dashboard-mediated trust — a structural shift that contradicts the operator-dial pattern.
**Source personas:** Devil's Advocate.
**Severity (provisional):** S2 medium. **Notes:** primarily a UX/persona-level concern; addressed by Stage A two-mode toggle.

### FM-PROG-04 — Auto-Tuning Loophole (Phase 5e)
**Sketch:** Charter AP-PMC-01 prohibits "model auto-tuning from ledger." But Phase 5e (showdown-update path) IS auto-tuning the range engine from ledger output, and the charter exempts it as "already designed (RANGE_ENGINE_DESIGN §4.5)." Either the rule applies (Phase 5e is gated, not exempted), or the rule should explicitly state "no auto-tuning except range engine via §4.5" with FM-SEL-01 acknowledged as the cost. Current ambiguity is a doctrinal hole.
**Source personas:** Adversary.
**Visibility status (REPLACEMENT 2026-05-09):** `MOOT-UNDER-REPLACEMENT`. Phase 5e cancelled. PMC no longer drives range-engine updates from PMC-output. The doctrinal hole between AP-PMC-01 and Phase 5e closes by removal of Phase 5e. The underlying range-engine §4.5 update path remains active but it's a range-engine concern, not a PMC concern.
**Severity (ratified):** S1 high (when applicable). **Effective under REPLACEMENT:** N/A — doctrinal hole closed.
**Detection signature:** N/A — class names a charter doctrinal inconsistency, resolved at REPLACEMENT.
**Mitigation (closed at REPLACEMENT):** Charter §Out of scope (REPLACEMENT) explicitly cancels Phase 5e. AP-PMC-01 (no model auto-tuning from predictionAudit) stands binding. RANGE_ENGINE_DESIGN §4.5 update path remains active; its update gating decision is reassigned to range-engine scope as **WS-175**. The "is range-engine §4.5 a PMC concern?" question resolves to "no, it's a range-engine concern."
**Worked example:** Pre-REPLACEMENT charter line "ledger triggers the existing RANGE_ENGINE_DESIGN §4.5 update path" was self-contradictory with AP-PMC-01 ("no model auto-tuning from ledger"). Adversary surfaced the inconsistency at sprint 1/2. Founder REPLACEMENT verdict at sprint 2/2 cancelled Phase 5e entirely; the contradiction is resolved by removal. Range-engine continues its §4.5 update path independently (it predates PMC); WS-175 owns the update-gating decision.

### FM-PROG-05 — Anchor-Retirement Feedback Loop
**Sketch:** Calibration drift retires anchor → anchor stops firing → no new ledger entries for retired anchor → posterior never updates → anchor stays retired permanently. AP-05 forbids un-retirement nudges, but here the *data flow itself* enforces permanent retirement — a new AP-05 violation pathway not addressed by the existing copy rule. Need: retired anchors get periodic re-firing in shadow-mode for posterior maintenance.
**Source personas:** Adversary.
**Severity (provisional):** S2 medium.

---

## Tier 2 — Additional candidates (from persona outputs; full-detail authoring next sprint may promote/demote)

The following classes were named by personas but not selected for Tier 1 priority. They are placeholders for the next sprint's per-class detail authoring; some will be promoted, others merged, some demoted. **Total Tier 1 + Tier 2 ≈ 32 candidates pre-deduplication.**

- **FM-COMP-extra:** Anchor-Boost Contamination (RM-05) — semantic-boosting feedback loop; requires held-out validation slice
- **FM-PRIOR-extra:** Time-of-Day / Day-of-Week Pool Drift (FM-POP-04); Table-Selection / Stake-Laddering Effect (FM-POP-07); Tilt/Late-Session Stationarity Violation (FM-POP-09); Format/Structure Stationarity Violation (FM-POP-08, partially merged into FM-PRIOR-02 above)
- **FM-INF-extra:** Mixing-Weight Path-Dependence in Range-Engine Updates (range theorist's order-invariance concern); Posterior Collapse from Over-Confident Priors (FM-BAY-02 strong form)
- **FM-DRIFT-extra:** Hierarchical-Pooling-vs-Change-Point estimator confusion (range theorist: hierarchical Bayes is for level estimation, NOT change-point detection — separate the two estimators)
- **FM-LINEAGE-extra:** GTO-Baseline-Version Silent Invalidation (PIP drift); RangeProfile Snapshotting Gap (no profileVersion at prediction time); HSP Archetype-as-Input Doctrinal Violation (charter line 228 risks reading "archetype X has 35% mis-calibration" as "use archetype X less" — violates HSP hard guard)

---

## Cross-cutting architectural asks — disposition under REPLACEMENT (2026-05-09 sprint 2/2)

The 10 cross-cutting asks from sprint 1/2 each have a disposition at Gate 2 close-out. See `docs/design/audits/2026-05-09-blindspot-pmc-failure-modes.md` for canonical table. Summary:

| Ask | Disposition |
|---|---|
| 1. Latent-class / archetype layer between population and per-villain | **MOOT** — aggregator cancelled; FM-INF-04 + FM-PRIOR-04 are MOOT-UNDER-REPLACEMENT |
| 2. `population_prior(situation_s, format, stakes, daypart)` slicing | **REASSIGNED** to range-engine + populationPriors scope; charter Q4 verdict captures the slicing dimensions |
| 3. Ledger schema 6+ additional fields | **MOOT** — no ledger; predictionAudit field captures only `{predictedDistribution, observedAction, modelVersion}` |
| 4. Tier-1/Tier-2 reporting separation + pre-registration registry | **PARTIAL** — pre-registration registry **shipped** (`registered-hypotheses.md`); Tier-1/Tier-2 separation moot at per-hand granularity but binds Phase 5b if any aggregate is introduced |
| 5. Defensibility floor `n ≥ max(30, 4/baseline_rate, 4/(1-baseline_rate))` | **DEFERRED to Phase 5b** — applies if a render surface emits aggregate prose with N implied; per-hand display is N=1 by construction |
| 6. Time-horizon partition tabs | **MOOT** — no aggregate dashboard tabs |
| 7. Two-mode toggle (default / posterior-diagnostic) | **MOOT** — no aggregate dashboard |
| 8. Schema-level enforcement of AP-PMC-04 (drop evRealized at write for hero entries) | **STANDING** ✓ — Phase 5a ticket binding; charter §Anti-pattern refusals binding |
| 9. Drift-detection estimator separation | **PARTIAL** — Q5 verdict resolves to BOCPD if any drift surface emerges in Phase 5b; charter records the verdict for future-proofing |
| 10. Off-taxonomy bucket + adversarial taxonomy maintenance (FM-META-01) | **STANDING** ✓ — FM-META-01 mitigation list defines the discipline; quarterly re-pressure-test cadence binding |

---

## Open questions — Gate 2 close-out 2026-05-09 sprint 2/2

All sprint-1/2 deferred items are now closed:

- ✓ Per-class detection signature + visibility status + severity ratification + worked examples authored for all 18 Tier-1 classes (4+4+2+2+1+2+1+2 across Families I/II/III/IV/V/VII/VIII/IX). Tier-2 classes remain at sketch depth — promote/demote on next adversarial re-pressure-test (2026-08-09 quarterly cadence).
- ✓ Stage E graded-work-trap audit completed in audit doc (PASS under REPLACEMENT scope; structural distinguishability ratified)
- ✓ Charter open questions 1-6 verdicts (Q1 trivial, Q2 pre-registration, Q3 trivial, Q4 reassigned to range-engine, Q5 BOCPD, Q6 reassigned to WS-175)
- ✓ AP-PMC-06 authored in charter §Anti-pattern refusals (no variance-blaming-the-model copy + no aggregation framing)
- [Reassigned] Charter cross-program table expansion → most surfaces MOOT under REPLACEMENT (cross-program emit fanout cancelled); range-engine concerns reassigned (WS-175 + populationPriors scope)

---

## Change log

- 2026-05-09 — v0.1 authored as Tier-1 sketches from Gate 2 Roundtable sprint 1/2 (SPR-064). 14-18 Tier-1 classes + 9 families + 10 cross-cutting architectural asks. Per-class detail deferred to follow-up sprint per founder split.
- 2026-05-09 — v1.0 close-out (sprint 2/2 SPR-065). REPLACEMENT scope ratified: predictionAudit per-hand IDB field IS PMC; full ledger / aggregator / expanded dashboard architecture cancelled. Visibility-status framework added (DETECTABLE-VIA-PREDICTIONAUDIT / OUT-OF-SCOPE-AT-CURRENT-ARCHITECTURE / STRUCTURALLY-INVISIBLE / MOOT-UNDER-REPLACEMENT). Per-class detail authored for all 18 Tier-1 classes: visibility status + severity ratification + detection signature + required architecture extension (or mitigation for STRUCTURALLY-INVISIBLE) + worked example. Cross-cutting architectural asks dispositioned (most MOOT; pre-registration registry shipped; AP-PMC-04 schema-level enforcement binding for Phase 5a).
- **Next adversarial re-pressure-test:** 2026-08-09 (quarterly cadence) — FM-META-01 mitigation #2.
