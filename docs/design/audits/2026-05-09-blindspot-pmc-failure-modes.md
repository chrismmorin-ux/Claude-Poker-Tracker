# Blind-Spot Roundtable — 2026-05-09 — Predictive Model Calibration (PMC) — Failure-Mode Taxonomy

**Audit ID:** `blindspot-pmc-2026-05-09`
**Gate:** 2 (Blind-Spot Roundtable)
**Status:** **CLOSED 2026-05-09 sprint 2/2 (SPR-065).** Stages A-E + per-class detail + open-questions verdicts + charter close-out + Devil's-Advocate dispositioning all complete. **REPLACEMENT verdict ratified** — Devil's-Advocate Concern 1 (`predictionAudit` per-hand IDB field as simpler intervention) accepted as full replacement for the ledger / aggregator / expanded-dashboard architecture.
**Sprint 1/2:** SPR-064 (Stages A-D + 14 Tier-1 sketches)
**Sprint 2/2:** SPR-065 (Stage E + per-class detail + REPLACEMENT verdict + close-out)
**Charter:** [`.claude/projects/predictive-model-calibration.md`](../../../.claude/projects/predictive-model-calibration.md)
**Gate 1 audit:** [`docs/design/audits/2026-05-09-entry-pmc-prediction-ledger.md`](2026-05-09-entry-pmc-prediction-ledger.md)
**Taxonomy artifact:** [`docs/projects/predictive-model-calibration/failure-mode-taxonomy.md`](../../projects/predictive-model-calibration/failure-mode-taxonomy.md)
**Pre-registration registry:** [`docs/projects/predictive-model-calibration/registered-hypotheses.md`](../../projects/predictive-model-calibration/registered-hypotheses.md)

---

## Feature summary

PMC introduces a Prediction Ledger (IDB v21+ append-only store) capturing every model output (range distributions, exploit recommendations, anchor firings, hero advice) at hand-end, paired with eventually-observed outcomes (villain action, showdown reveals, realized EV). Hierarchical Bayesian aggregator surfaces drift and mis-calibration. Calibration Dashboard (absorbs WS-169) renders ledger-driven aggregates. The Gate 2 deliverable is the **failure-mode taxonomy** — load-bearing because every analyzer rule downstream traces to a class in it.

---

## Execution model used (deviation from baseline ROUNDTABLES.md)

Per founder ratification, the roundtable executed **hybrid** rather than the standard `/eng-engine` pattern:

- **6 specialist personas** (range-engine theorist, population ecology, frequentist statistician, Bayesian inference specialist, adversary modeler, devil's advocate) — none of which match the existing `/eng-engine` personas (senior, systems, security, performance, ux, failure). Domain expertise matters here.
- **Parallel general-purpose Agents** invoked simultaneously, each with a **forced-reading list** specific to their lens (PMC charter + Gate 1 audit + ROUNDTABLES.md as common base + 3-4 persona-specific files).
- **Open architectural-pushback invitation** explicit in each prompt — the founder concern was that locking agents into the proposed architecture would "optimize within a suboptimal bubble." Agents were given explicit permission to challenge the program's premises themselves.
- **No cross-pollination** — agents did not see each other's outputs before producing their stage contributions; synthesis happened in the main thread post-hoc.

This structure is documented because it diverges from `/eng-engine` and the Stage A-E sequencing was compressed (each persona produced their A-D contributions in a single pass; synthesis aggregated across 6 outputs).

---

## Stage A — Persona sufficiency

**Output: ⚠️ Patch needed (split disposition)**

5 of 6 personas (range theorist, frequentist, Bayesian, adversary, population ecology) flag that consuming the dashboard requires a posture *structurally distinct* from `post-session-chris` — variously called "model-developer Chris," "posterior-diagnostic Chris," "ledger auditor," "post-session-chris in adversarial-data mode," or "post-session-chris-population-mode." This posture reads CIs, posterior precision, prior-contribution diagnostics, and slice-selection denominators — fundamentally different from post-session-chris's natural review mode (study-time, decompression, low cognitive budget).

**Devil's Advocate dissents:** the analyst persona "will never materialize because the owner is one person." Building for a hypothetical user is the wrong move; the *real* consumer is post-session-chris reviewing his own hands, and the dashboard should collapse to that.

**Resolution:** Add a **situational sub-persona** — `post-session-chris-model-audit-mode` (parallel to the proposed `post-session-chris-population-mode`). NOT a new core persona (Devil's Advocate's concern is valid: the analyst doesn't get its own seat). This sub-persona gates dashboard rendering: when the user toggles into model-audit mode, the dashboard renders posterior diagnostics; in default mode it renders aggregates only.

**Followup:**
- Author `post-session-chris-model-audit-mode.md` situational persona spec at Gate 4.
- Author `post-session-chris-population-mode.md` situational persona spec at Gate 4.
- Both modes constrain dashboard copy density; default mode honors post-session-chris's natural budget (per AP-PMC-04 hero-grading prevention is structurally easier in default mode).
- Defer model-developer-Chris ratification or refusal to next sprint after these sub-personas are specified — at that point the question is moot if the modes cover the postures.

---

## Stage B — JTBD coverage

**Output: ⚠️ Expansion needed**

The 3 candidate JTBDs from Gate 1 (DS-NEW-PMC-01/02/03) get the following dispositions:

| Candidate | Disposition | Rationale |
|---|---|---|
| **DS-NEW-PMC-01** Detect-when-model-is-wrong | **Collapse into DS-58 with sub-clause** | Convergent across personas. DS-58 covers the parent outcome; PMC-01 is denser-data instance. |
| **DS-NEW-PMC-02** Trace-loss-to-model-or-variance | **AMEND with third-option + author AP-PMC-06** | Frequentist: "insufficient data to distinguish" must be a third option, not just model-error vs variance. Devil's Advocate: this JTBD as currently framed is "variance-rationalization codified" — owner blames model for downswings with statistical-looking cover. **Refusal:** author AP-PMC-06 forbidding any copy that lets the dashboard be the source of variance-blame. The JTBD survives only with the third option AND the AP-PMC-06 guard. |
| **DS-NEW-PMC-03** Discover-blind-spots-in-the-model | **Author — load-bearing** | Convergent across range theorist + population ecology + Bayesian. DS-58/59/SR-23 all assume a closed rule space. PMC-03 is open-rule-space — the framework doesn't have a JTBD whose answer is "we need a new rule type." Population ecology's specific case: detecting when a population-level pattern isn't modeled at all. |

**New JTBD candidates surfaced by personas (cluster, not single):**

| Candidate | Source | Disposition |
|---|---|---|
| **DS-NEW-PMC-04a** Distinguish-model-error-from-action-taxonomy-error | Range theorist (RM-06 / FM-LINEAGE-03) | **Author** — when ledger says "model wrong on multiway pots," is it taxonomy gap or calibration? Critical distinction. |
| **DS-NEW-PMC-04b** Distinguish-prior-error-from-population-drift-from-villain-drift | Bayesian (FM-INF-02 / FM-PRIOR-03) | **Author** — Bayesian's specific concern; without it AP-PMC-02 (no causal claim) is structurally impossible to honor. |
| **DS-NEW-PMC-04c** Audit-the-ledger-writer | Adversary (FM-META-02) | **Author** — confirm ledger entries reflect predictions actually made; audit dropout rate; confirm modelVersion stratification before trusting any aggregate. |
| **DS-NEW-PMC-05** Audit-the-categorical-keys | Adversary (FM-LINEAGE-01) | **Defer to Gate 3** — when situationKey/boardKey definitions change, surface lineage break explicitly. |
| **DS-NEW-PMC-06** Distinguish-prior-driven-from-data-driven-posteriors | Adversary | **Defer to Gate 3** — separate cases where N is large enough to dominate prior vs prior dominating. |

**Followup:**
- Author DS-58 sub-clause + DS-NEW-PMC-02 amendment + DS-NEW-PMC-03 + DS-NEW-PMC-04a/b/c at Gate 3 (research/jtbd authoring).
- Defer DS-NEW-PMC-05/-06 to Gate 3 adversarial follow-up.
- AP-PMC-06 (no variance-blaming-the-model copy) authored at Gate 4 alongside other AP-PMC-* extensions.

---

## Stage C — Situational stress test

**Output: ⚠️ Adjust needed**

Convergent stress signals across personas:

1. **Cognitive budget collapse (population ecology + range theorist + Bayesian + Devil's Advocate).** Post-session-chris's cognitive budget cannot simultaneously hold population-level slow-drift and per-villain fast-error signals. Dashboard will fixate on high-emotional-salience individual signals ("villain X stacked me") and ignore slow-burn population signals that matter more.

2. **Defensibility floor (frequentist).** At N=12, binomial 95% Wilson CI half-width ≈ ±28pp. With 5×10⁵ implicit comparisons and naive 95% CI, expected false-flag count ≈ 25,000. Dashboard fails at: (a) showing per-villain prose <80 firings, (b) any "outside CI" claim without FDR correction, (c) re-rendering flags every session-close.

3. **Concrete wrong-and-believed scenario (adversary).** Owner reviews dashboard; tab shows "BTN-vs-BB 3bp-IP-wet-T96 — model river-bet frequency 38% (CI 32–44%, n=84)." Observed 41%. Green dot. Owner trusts model. Hidden: 70 of 84 firings are model v1.6 (pre-T96 effStack-addendum); 14 are v1.8. v1.6 had a 9% over-predict on this slice; v1.8 corrected. **Aggregate looks calibrated; live recommendations computed by v1.8 are now under-confident on this slice because the dashboard told the owner they were fine.** PMC has *prevented* a correction.

4. **Aggregate-CI anchoring bias (Devil's Advocate, FM-PROG-01).** Once posterior shows "river-bet 22% [16,28]" on villain V, owner stops *seeing* V's deviations within the band. Pre-PMC, owner sees raw plays; the dashboard *creates* what it purports to surface.

**Resolution: dashboard MUST have all of the following at Gate 4:**

- **Time-horizon partition tabs** ("this session / this month / this quarter") — population ecology recommendation. Different signals live at different timescales.
- **Per-firing "prior contribution %"** + **"low-information" labels** — range theorist + Bayesian. If prior dominates posterior, label "low-information," not "wrong."
- **Per-version stratification NOT opt-in** — adversary FM-LINEAGE-02. The default render must show version-aware aggregates.
- **Defensibility floor (n ≥ max(30, 4/baseline_rate, 4/(1-baseline_rate)))** — frequentist FM-DISC-04. Below floor → "low information," never headline copy.
- **Two-mode toggle (default aggregate / opt-in posterior-diagnostic)** — Stage A resolution.

These are Gate 4 design constraints to ratify; calibration-dashboard.md amendment must encode them.

---

## Stage D — Cross-product / cross-surface

**Output: ❌ Scope was wrong — surface list materially under-scoped**

Charter cross-program table (lines 222-231) lists 5 programs (engine-accuracy, EAL, SCF, HSP, range-engine, domain-correctness, design). Across the 6 personas, the following surfaces / risks are NOT in the charter table and require Phase 5 implementation scope:

**Engine surfaces with priors derived from population data (drift detection ripples here):**
1. `src/utils/rangeEngine/populationPriors.js` — `NO_RAISE_FREQUENCIES`, `FACED_RAISE_FREQUENCIES`, `PRIOR_WEIGHT`, `FACED_RAISE_RATE` (population ecology)
2. `src/utils/exploitEngine/gameTreeConstants.js:124` — `POP_CALLING_RATES`, `POP_BETTING_RATES` (ecology + adversary)
3. `src/utils/exploitEngine/villainModelData.js` — `STYLE_FOLD_DEFAULTS`, style-conditioned logistic params (ecology)
4. `src/utils/rangeEngine/traitDetector.js` — `trapsPreflop`, `splitsRangePreflop` thresholds (ecology — Ignition pool may not need limp-reraise detection at all)

**Bayesian-update path concerns (Phase 5e):**
5. `src/utils/rangeEngine/bayesianUpdater.js` (or §4.5 equivalent) — selection bias (FM-SEL-01) + path-dependence on semantic-boost ordering (range theorist). Order-invariance is broken in current semantic-boost path.
6. `rangeProfiles` IDB store — needs `profileVersion`/`modelVersion` snapshotting at prediction time. Without snapshotting, calibration on old predictions becomes meaningless after any range-engine change (range theorist).
7. `pipCalculator.js` — GTO baseline could change; PIP fields silently invalidate without `gtoBaselineVersion` (range theorist).

**Anchor library feedback loop (FM-PROG-05):**
8. `useAnchorRetirement` — retirement-stops-data-flow creates permanent retirement; AP-05 violation pathway not addressed by existing copy rule. Need shadow-mode firing for retired anchors (adversary).
9. Anchor library Tier-3 retirement (`AnchorLibraryView`) — silent baseline invalidation for anchors that depend on drifted population baseline (ecology).

**HSP doctrinal violations:**
10. HSP archetype propagation — charter line 228 says "Aggregator can detect HSP archetype mis-classifications," but if dashboard renders this as "use archetype X less," archetypes become INPUTS again (HSP doctrine: archetype IDs are OUTPUTS not INPUTS to plan computation). Dashboard must NEVER let archetype-calibration-mis-classification feed back into archetype assignment (range theorist + adversary).

**Hand-end orchestrator concerns:**
11. Hand-end orchestrator becomes a **write-fan-out hotspot**. Range engine + exploit engine + anchor library + hero-leak detector all emit at hand-end (charter Phase 5b). If even one writer throws synchronously, the others may not flush. State-clear-asymmetry candidate per `STATE_CLEAR_ASYMMETRY.md`. Need Phase 5a invariant: *every emitter is async-isolated; partial writes flagged as `partialFlush: true` on the entry* (adversary).

**Documentation surfaces:**
12. `POKER_THEORY.md` §9.1-9.5 — five "live small-stakes" citation references that may not apply to Ignition. Each needs `referenceClass` tag and ledger validation (ecology).

**Sidebar / Extension impact:**
- **Confirmed GREEN — no ripple.** Calibration dashboard is study-mode-only (red line #8); sidebar/extension surfaces are unaffected. Stage D's primary concern in the original ROUNDTABLES.md frame (cross-product parity) does not apply because the program is correctly scoped to study-mode. ✓

**Followup:**
- Charter cross-program table must expand at Gate 4 charter-update (~12 surfaces).
- Phase 5 sub-phases may need re-decomposition: Phase 5b ("cross-program emit wiring") needs surface-by-surface invariants; Phase 5e ("range-engine showdown-update wiring") needs explicit selection-bias-correction spec.

---

## Stage E — Heuristic pre-check / graded-work-trap audit (sprint 2/2 close-out)

**Output: ✓ PASS under REPLACEMENT scope** (would have been ⚠️ Adjust under original scope).

Stage E is load-bearing per the audit framework — under the original ledger architecture, the expanded calibration dashboard would have been the strongest graded-work-trap surface in the codebase per Gate 1 line 111. **Under REPLACEMENT (sprint 2/2 founder verdict 2026-05-09), this is no longer true.** The graded-work-trap risk drops materially because:

1. **No aggregate dashboard exists.** Per-hand predictionAudit display in HandReplay is closer to an information event ("the model predicted X; observed Y") than to a graded surface ("you/your-model are at level X with score Y"). Aggregation is the load-bearing mechanism for graded-work — REPLACEMENT cancels it.
2. **No progression / streak / mastery framing.** No surface aggregates predictionAudit results into session-level or villain-level scores. AP-PMC-06 (authored this sprint) explicitly forbids any framing that derives a mastery-score-shaped surface from the per-hand information primitive.
3. **No visible "improvement curve."** With no aggregator, there is no temporal trajectory rendered. Owner sees per-hand divergence; no surface translates that into "model accuracy improving / declining over time."

**Mastery-score-surface distinguishability verdict (founder ratification 2026-05-09):** Per-hand predictionAudit display is **structurally distinguishable** from a mastery-score surface. AP-PMC-04 schema-level enforcement (drop `evRealized` at write for hero entries) + AP-PMC-06 copy guard (no variance-blaming + no aggregation framing) sufficient. **No further architectural fix needed.** This verdict is binding for Phase 5b render-surface design — any deviation from per-hand granularity (e.g., adding a session-level summary widget) re-opens the graded-work-trap analysis at that ticket's Gate 1.

### Owner-volunteered-grading carve-out

Devil's-Advocate concern from sprint 1/2: "Dashboard grades the *model*, but the model is the owner's authored artifact. Grading the model = grading the modeler, one indirection removed." Verdict at sprint 2/2: **carve-out applies.** Owner is volunteering by ENGAGING with predictionAudit at all (the field is silent at write; reading it is opt-in via HandReplay). The system-imposed-grading clause from `feedback_owner_volunteered_grading.md` (memory) is honored: predictionAudit produces no grade unless owner explicitly queries it.

This is contingent on AP-PMC-06's enforcement: any future surface that auto-renders predictionAudit aggregates without explicit user query (e.g., a notification badge on HandReplay saying "X% of predictions matched today") would VIOLATE the carve-out by making the grading system-imposed. Forbidden.

### AP-PMC-04..06 review

- **AP-PMC-04** (no hero-grading copy) — **Schema-level enforcement ratified.** Phase 5a writer MUST drop `evRealized` at write for hero entries. Implementation note for Phase 5a ticket: `predictionAuditWriter.js` validates schema; the writer-level guard is the hard contract.
- **AP-PMC-05** (no "model is wrong, fix it now" pressure copy) — Reviewed against simplified surface. Per-hand display has no built-in TODO affordance; "fix it" framing requires aggregate surface that REPLACEMENT cancels. AP-PMC-05 binding on Phase 5b render-surface design.
- **AP-PMC-06** (no variance-blaming-the-model copy, including no aggregation framing) — **Authored this sprint** (charter §Anti-pattern refusals). Forbidden patterns enumerated. CI grep for forbidden patterns is enforcement; Phase 5b render-surface design must include a forbidden-pattern test.

### Stage E required follow-ups (binding for Phase 5b)

- [x] AP-PMC-06 authored (this sprint)
- [x] AP-PMC-04 schema-level-enforcement ratified (this sprint, charter binding)
- [x] Mastery-score-surface distinguishability verdict (this sprint)
- [ ] **Phase 5b ticket** must include: forbidden-pattern grep test for AP-PMC-06 + per-hand-only-rendering test (no surface aggregating across hands without explicit query) + writer-level schema test ensuring `evRealized` absent on hero entries
- [ ] Any future surface adding aggregation across hands re-opens Stage E analysis at THAT ticket's Gate 1

---

## Failure-mode taxonomy summary (full file at sibling artifact)

**14 Tier-1 classes across 9 families authored as sketches this sprint:**

1. **Family I — Range-composition errors** (4 classes): FM-COMP-01 Range-Composition vs Frequency Decoupling • FM-COMP-02 Polarization vs Linearity Mis-classification • FM-COMP-03 Mixing-Weight Collapse • FM-COMP-04 Sizing-Tendency Lattice Error
2. **Family II — Population/prior mis-specification** (4 classes): FM-PRIOR-01 Reference-Class Miscalibration • FM-PRIOR-02 Sub-Population Conflation • FM-PRIOR-03 Soft-Pool Drift • FM-PRIOR-04 Latent-Class Mixture
3. **Family III — Aggregation/inference-machinery errors**: FM-INF-01 Identifiability Collapse • FM-INF-04 Hierarchical-Pooling Failure for Anonymous Identities
4. **Family IV — Selection / sampling biases**: FM-SEL-01 Showdown Selection Bias • FM-SEL-04 Reflexivity
5. **Family V — Frequentist / multiple-comparisons / discipline errors**: FM-DISC-03 Multi-Comparisons Explosion
6. **Family VII — Categorical / schema / lineage errors**: FM-LINEAGE-02 Model-Version Drift Aliasing • FM-LINEAGE-04 Sufficient-Statistic Loss
7. **Family VIII — Off-taxonomy / measurement-floor errors**: FM-META-01 Off-Taxonomy Residual
8. **Family IX — Program-induced failure classes**: FM-PROG-01 Aggregate-CI Anchoring Bias • FM-PROG-04 Auto-Tuning Loophole

Plus ~18 additional Tier-2 candidates from full persona output. Per-class detail (detection signature + required ledger fields + severity + examples) authored next sprint.

---

## Cross-cutting architectural asks (must inform Gate 4)

These bind Gate 4 design:

1. **Add a latent-class / archetype layer** between population and per-villain — per-villain shrinkage degenerates to single-level for ~95% of Ignition observations (FM-INF-04 + FM-PRIOR-04). **Charter ratification #2 must be amended.**
2. **Replace single `population_prior(situation_s)`** with `population_prior(situation_s, format, stakes, daypart)`. **Charter open Q4 verdict: NOT a single global "live pool" — explicit Ignition × format slicing.**
3. **Ledger schema must add ≥6 fields beyond charter sketch:** `priorAtDecision`, `evidenceUsed`, `likelihoodFamily`, `posteriorPrecision`, `selectionPath`, `revealMechanism`, `heroPolicyHash`, `keyDefinitionVersion`, `actionTaxonomyVersion`, `taxonomyVersion`, `partialFlush`, `referenceClass`.
4. **Tier-1/Tier-2 reporting separation** in dashboard. Pre-registered hypothesis registry at `docs/projects/predictive-model-calibration/registered-hypotheses.md` with ratchet discipline.
5. **Defensibility floor for per-cell prose:** `n ≥ max(30, 4/baseline_rate, 4/(1-baseline_rate))`.
6. **Time-horizon partition** in dashboard (this session / this month / this quarter tabs).
7. **Two-mode toggle** on dashboard (default / posterior-diagnostic), situational sub-personas cover the modes.
8. **Schema-level enforcement of AP-PMC-04** — drop `evRealized` at write for hero entries.
9. **Drift-detection estimator separation** — hierarchical Bayes for level; sequential change-point (BOCPD or windowed-with-α-spending) for drift.
10. **Off-taxonomy bucket as first-class artifact** + adversarial taxonomy maintenance (FM-META-01).

---

## Founder dissent / charter-level questions DISPOSITIONED (sprint 2/2 close-out 2026-05-09)

The Devil's Advocate persona produced a *kill-PMC* verdict at sprint 1/2 with 4 architectural concerns. Founder disposition at sprint 2/2 close-out:

| # | Concern | Disposition (2026-05-09 sprint 2/2) | Outcome |
|---|---|---|---|
| 1 | Simpler intervention (`predictionAudit` ≤200 LOC, 80% inferential value, 5% cost) | **ACCEPT as REPLACEMENT** | Full ledger / aggregator / expanded dashboard architecture CANCELLED. predictionAudit IS PMC. Charter ratifications #2 + #3 reversed; #5 amended (WS-169 re-released to original EAL Stream D 3-tab scope); Phase 5 collapsed from 5a-5e to 5a-5b. |
| 2 | CFR deferral is the giveaway — frequency-match is necessary-not-sufficient | **STAND-WITH-TRIGGER** | Charter ratification #6 stands. **WS-174** trigger-conditioned revisit ticket created (≥1000 captured hands + frequency-match-rate >0.85 + EV-bleed observed → re-evaluate CFR). FM-COMP-01 in taxonomy preserves the architectural insight. |
| 3 | Six ratifications in one day = anchoring not consensus | **AUTO-RESOLVED** by REPLACEMENT | Ratifications #2, #3, #5 reversed/amended at this very disposition. The re-litigation that the concern requested is exactly what happened. |
| 4 | 95% of Ignition villains recover the prior — hierarchical machinery wasted | **MOOT under REPLACEMENT** | No hierarchical machinery exists post-REPLACEMENT. FM-INF-04 in taxonomy preserves the architectural insight as documented invisibility. Concern's substantive claim is accepted (concern → architecture removed). |

These dispositions are **binding**. Charter §Decisions revised at Gate 2 close-out captures the same in canonical form. The Devil's Advocate's kill-PMC verdict was not adopted in full (PMC continues as a program with predictionAudit + taxonomy + AP-PMC-* + pre-registration registry), but the architectural concerns were honored architecturally.

### Status of cross-cutting architectural asks (10 from sprint 1/2) under REPLACEMENT

| Ask | Original status | Under REPLACEMENT |
|---|---|---|
| 1 | Add latent-class layer between population and per-villain | **MOOT** — no aggregator |
| 2 | population_prior(situation_s, format, stakes, daypart) slicing | **REASSIGNED** — reassigned to range-engine + populationPriors scope (charter Q4 verdict) |
| 3 | Ledger schema must add ≥6 fields | **MOOT** — no ledger; predictionAudit field captures only `{predictedDistribution, observedAction, modelVersion}` |
| 4 | Tier-1/Tier-2 reporting separation + pre-registered hypothesis registry | **PARTIAL** — pre-registration registry **shipped** (`registered-hypotheses.md`); Tier-1/Tier-2 separation moot at per-hand granularity but binds Phase 5b render-surface design if any aggregate is introduced |
| 5 | Defensibility floor n ≥ max(30, 4/baseline_rate, 4/(1-baseline_rate)) | **DEFERRED to Phase 5b** — applies only if a render surface emits aggregate prose with N implied; per-hand display is N=1 by construction |
| 6 | Time-horizon partition tabs | **MOOT** — no aggregate dashboard tabs |
| 7 | Two-mode toggle (default / posterior-diagnostic) | **MOOT** — no aggregate dashboard |
| 8 | Schema-level enforcement of AP-PMC-04 (drop evRealized at write for hero entries) | **STANDING** ✓ — Phase 5a ticket binding |
| 9 | Drift-detection estimator separation (hierarchical Bayes + sequential change-point) | **PARTIAL** — Q5 verdict resolves to BOCPD if any drift surface emerges in Phase 5b; charter records the verdict for future-proofing |
| 10 | Off-taxonomy bucket as first-class artifact + adversarial taxonomy maintenance | **STANDING** ✓ — FM-META-01 in taxonomy + quarterly re-pressure-test cadence preserved |

---

## Overall verdict

**🟢 GREEN — Gate 2 CLOSED.** Founder verdict at sprint 2/2: REPLACEMENT scope ratified. predictionAudit per-hand IDB field IS PMC. Full ledger / aggregator / expanded dashboard architecture CANCELLED. The roundtable's adversarial structure produced its load-bearing outcome: the program shipped at 5% of cost with 80% of inferential value, on the strength of the Devil's-Advocate's surfacing of a simpler architecture and the founder's willingness to ratify the simpler answer.

The roundtable surfaced substantial architectural concerns. Most are honored by REPLACEMENT (the architecture they critique no longer exists); the residuals are tracked:
- ✓ Hierarchical aggregation latent-class layer ask → MOOT (aggregator cancelled)
- ✓ Ledger schema 6+ additional fields ask → MOOT (ledger cancelled)
- ◐ Population baseline (format × stakes × daypart) slicing → REASSIGNED to range-engine scope (charter Q4 verdict)
- ✓ Pre-registration discipline → SHIPPED (registered-hypotheses.md ratchet)
- ◐ Tier-1/Tier-2 reporting separation → DEFERRED to Phase 5b (binds if any aggregate surface is introduced)
- ✓ 12+ cross-program surfaces under-scoped → MOOT for most (cross-program emit fanout cancelled); range-engine concerns reassigned (WS-175 + populationPriors slicing)
- ✓ "Frequency violations are the signal" mathematically over-stated → ACKNOWLEDGED in charter (FM-COMP-01 + WS-174 trigger)
- ✓ FM-Engine-Drift-Silent-Invalidation closure overstated → ACKNOWLEDGED in charter (predictionAudit narrows but does not close; concern stands as WS-174)

Charter §Decisions revised at Gate 2 close-out captures the canonical disposition table. WS-172 marked done. WS-174 + WS-175 created. WS-169 re-released. Phase 5a + 5b ready for next-sprint composition.

---

## Required follow-ups (sprint 2/2 close-out 2026-05-09)

Sprint 2/2 closed all sprint-1/2 follow-ups under REPLACEMENT scope. Status:

- [x] **Stage E** — graded-work-trap audit complete; AP-PMC-04..06 review complete; structural distinguishability ratified (per-hand display structurally distinct from mastery-score surface)
- [x] **Per-class detail authoring** — taxonomy refactored with visibility-status framework (DETECTABLE-VIA-PREDICTIONAUDIT / OUT-OF-SCOPE-AT-CURRENT-ARCHITECTURE / STRUCTURALLY-INVISIBLE) + per-class detection signature + severity + worked examples for all 14 Tier-1 classes
- [x] **Open-questions verdicts** — Q1 trivial under REPLACEMENT (~10MB/year storage); Q2 disposed via pre-registration registry; Q3 trivial (per-hand field re-runnable from existing hands); Q4 reassigned to range-engine + populationPriors scope (Ignition × format × stakes × daypart); Q5 resolves to BOCPD if drift surface emerges in Phase 5b; Q6 reassigned to range-engine scope as WS-175
- [x] **Charter close-out** — `.claude/projects/predictive-model-calibration.md` substantially rewritten: §Status updated, §Scope split into in-scope-under-REPLACEMENT vs cancelled-at-REPLACEMENT, §Phases collapsed (5a-5e → 5a-5b), §Workstream registry updated, §Decisions revised at Gate 2 close-out section added, §Open questions verdicts table added, §Cross-program effects updated
- [x] **Founder re-ratification** — 4 Devil's-Advocate concerns dispositioned (Concern 1 ACCEPT-as-REPLACEMENT, Concern 2 STAND-WITH-TRIGGER → WS-174, Concern 3 AUTO-RESOLVED, Concern 4 MOOT-under-REPLACEMENT)
- [x] **AP-PMC-06 authoring** — authored in charter §Anti-pattern refusals; forbidden-pattern enforcement at component level binding
- [x] **Pre-registration registry stub** — `docs/projects/predictive-model-calibration/registered-hypotheses.md` shipped with ratchet discipline rules + entry schema + empty body (FM-DISC-01 mitigation)
- [Deferred — MOOT] **Persona authoring** — `post-session-chris-model-audit-mode.md` + `post-session-chris-population-mode.md` were dashboard-mode toggles for the cancelled aggregator. Personas are MOOT under REPLACEMENT. If Phase 5b render-surface design surfaces analogous mode-toggle requirements, persona authoring re-enters at that ticket's Gate 4.
- [Deferred — REASSIGNED] **JTBD authoring at Gate 3** — DS-58 sub-clause + DS-NEW-PMC-02 amendment + DS-NEW-PMC-03 + DS-NEW-PMC-04a/b/c. Gate 3 is deferred indefinitely under REPLACEMENT (no hierarchical machinery makes Gate 3 research moot for the architecture). JTBD authoring re-enters at Phase 5b Gate 4 if the render-surface design surfaces the same coverage gap.

### New tickets created at close-out

- **WS-174** — Concern 2 trigger-conditioned revisit (CFR vs Bayesian frequency-matching)
- **WS-175** — Range-engine Q6 update gating (reassigned from PMC Phase 5e)

### Tickets re-released at close-out

- **WS-169** — RE-RELEASED to original EAL Stream D 3-tab anchor/predicate/primitive scope. No longer absorbed into PMC.

---

## Linked artifacts

- [`docs/projects/predictive-model-calibration/failure-mode-taxonomy.md`](../../projects/predictive-model-calibration/failure-mode-taxonomy.md) — sibling artifact, Tier-1 sketches
- [`.claude/projects/predictive-model-calibration.md`](../../../.claude/projects/predictive-model-calibration.md) — charter (will gain Gate 2 progress section in next sprint close-out)
- [`docs/design/audits/2026-05-09-entry-pmc-prediction-ledger.md`](2026-05-09-entry-pmc-prediction-ledger.md) — Gate 1 Entry RED audit
- [`.claude/workstream/queue/WS-172.yaml`](../../../.claude/workstream/queue/WS-172.yaml) — sprint ticket
- [`docs/design/ROUNDTABLES.md`](../ROUNDTABLES.md) — framework

---

## Change log

- 2026-05-09 — v0.1 authored (sprint 1/2 SPR-064). Stages A-D verdicts + 14 Tier-1 taxonomy class sketches + 10 cross-cutting architectural asks. Stage E + per-class detail + open-questions verdicts + charter close-out + Devil's Advocate dissent dispositioning deferred to follow-up sprint per founder split.
- 2026-05-09 — v1.0 close-out (sprint 2/2 SPR-065). REPLACEMENT verdict ratified: predictionAudit per-hand IDB field IS PMC; full ledger / aggregator / expanded dashboard architecture CANCELLED. Stage E ✓ PASS (structural distinguishability ratified). 4 Devil's-Advocate concerns dispositioned. 5 charter open Qs verdicts (Q1/Q3 trivial, Q2 pre-registration registry binds, Q5 BOCPD, Q6 reassigned to WS-175; Q4 reassigned to range-engine scope). Cross-cutting architectural asks status table added (most MOOT under REPLACEMENT; pre-registration registry shipped; AP-PMC-04 schema-level enforcement binding for Phase 5a). WS-172 ✓ done. WS-174 + WS-175 created. WS-169 re-released to EAL.
