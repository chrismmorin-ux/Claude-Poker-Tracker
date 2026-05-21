# Predictive Model Calibration (PMC)

**Project ID:** `predictive-model-calibration` (PMC)
**Started:** 2026-05-09
**Status:** **Gate 2 CLOSED 2026-05-09 (REPLACEMENT scope).** Devil's-Advocate Concern 1 disposed: predictionAudit per-hand IDB field replaces full ledger / aggregator / dashboard architecture. PMC scope shrunk from ~5-8-session pipeline to ~1-2-session predictionAudit primitive + render surface. Phase 5 sub-phases collapsed to 5a (predictionAudit primitive) + 5b (render surface, design-deferred to Gate 4).
**Owner program:** domain-correctness (cross-cutting — taxonomy + AP-PMC-* + pre-registration discipline still bind across engine-accuracy, EAL, SCF, HSP, range-engine)
**Parent workstream:** Workstream C (Predictive Engine Maturation) per master-plan-2026-04-30
**Charter audit:** `docs/design/audits/2026-05-09-entry-pmc-prediction-ledger.md`
**Gate 2 audit:** `docs/design/audits/2026-05-09-blindspot-pmc-failure-modes.md` (sprint 1/2 + sprint 2/2 close-out)
**Failure-mode taxonomy:** `docs/projects/predictive-model-calibration/failure-mode-taxonomy.md`
**Pre-registration registry:** `docs/projects/predictive-model-calibration/registered-hypotheses.md`
**Absorbs (revised):** ~~WS-169 (EAL Stream D — Calibration Dashboard MVP)~~ — RE-RELEASED 2026-05-09 at Gate 2 close-out back to original EAL Stream D scope

---

## Purpose

> If we don't have the feedback mechanism, we're only using theory to validate theory. — Owner, 2026-05-09

The poker model is currently validated only against theory: solver charts, Monte Carlo equity engines, range-engine invariants, exploit-engine fixture matrices. None of these tell us whether the model's predictions about real Ignition villains match what those villains actually do.

PMC closes the loop. The **predictionAudit per-hand IDB field** captures every model output at hand-end paired with the observed action, so divergence is visible — and fixable on evidence rather than authority. Model drift surfaces as an information event in HandReplay.

**Gate 2 verdict (2026-05-09 sprint 2/2): the simpler intervention is the right one.** Devil's-Advocate Concern 1 — `predictionAudit` per-hand IDB field (~200 LOC, 0.5 sessions, 80% inferential value, 5% cost) — was disposed REPLACEMENT. The original full-ledger / hierarchical-Bayesian-aggregator / 3-tab-expanded-dashboard architecture is **cancelled**.

The taxonomy (Gate 2 sprint 1/2) is preserved as an **invisibility-surface document**: it enumerates what the model can and cannot see, with each Tier-1 class tagged DETECTABLE-VIA-PREDICTIONAUDIT, OUT-OF-SCOPE-AT-CURRENT-ARCHITECTURE, or STRUCTURALLY-INVISIBLE. Off-taxonomy bucket (FM-META-01) and pre-registration registry (FM-DISC-01 mitigation) remain load-bearing.

The key inferential insight (owner, 2026-05-09): **we don't always need showdown reveals.** If our model says villain bets the river at frequency `f`, and we observe the actual river-bet frequency over N hands, we can detect range-composition error from frequency alone. Aggregate frequency violations *are* the signal — at the per-hand level. (Charter ratification #6 + Devil's-Advocate Concern 2 binding caveat: aggregate-frequency match does NOT guarantee EV match — see WS-174 trigger-conditioned revisit.)

---

## Scope (REPLACEMENT, 2026-05-09)

### In scope

- **Failure-mode taxonomy** — enumerated classes of model error against real player data, with visibility-status tagging. Documents what's detectable vs invisible-by-construction at the predictionAudit architecture. (Gate 2 deliverable, complete.)
- **predictionAudit per-hand IDB field** — `{predictedDistribution, observedAction, modelVersion}` written at hand-end on each `hands` record. ~200 LOC, ~0.5 session. Phase 5a deliverable.
- **Render surface** for predictionAudit — per-hand display in HandReplay's existing ReviewPanel (or wherever Phase 5b Gate 4 design lands). Phase 5b deliverable; render-surface-design TBD next sprint.
- **AP-PMC-01..06 anti-pattern refusals** — bind across all surfaces consuming predictionAudit data.
- **Pre-registration registry** — `registered-hypotheses.md` ratchet for any predictionAudit-derived analysis that emits Tier-1 (flag-bearing) verdicts. FM-DISC-01 mitigation. Q2 multi-comparisons rigor disposed via discipline rather than statistical correction.

### Out of scope (deferred, refused, or cancelled at REPLACEMENT)

- ~~**Prediction Ledger** — IDB-persisted append-only log per (hand, decision-node, model-output-class) tuple~~ **CANCELLED 2026-05-09 REPLACEMENT.** The lossless lossless ledger is replaced by the per-hand audit field. Decision-node-level capture is below the granularity needed for the inferential value most predictionAudit slices unlock.
- ~~**Calibration analyzer** — hierarchical Bayesian aggregation (population + per-villain shrinkage + per-situation slicing)~~ **CANCELLED 2026-05-09 REPLACEMENT.** Devil's-Advocate Concerns 1 + 4 (95% of Ignition villains recover the prior; per-villain shrinkage degenerates to single-level aggregation) made the hierarchical machinery's value-vs-cost ratio unjustifiable. predictionAudit per-hand display is the diagnostic primitive.
- ~~**Expanded Calibration Dashboard** (per-villain + per-situation tabs)~~ **CANCELLED 2026-05-09 REPLACEMENT.** WS-169 re-released to original EAL Stream D 3-tab anchor/predicate/primitive scope, independent of predictionAudit.
- ~~**Cross-program writer integration** — range engine, exploit engine, anchor library, hero-leak detector all emit ledger entries~~ **CANCELLED 2026-05-09 REPLACEMENT.** Single hand-end write captures predictedDistribution; cross-program emit fanout is unnecessary at this granularity.
- ~~**Bayesian range-engine update wiring (Phase 5e)**~~ **CANCELLED 2026-05-09 REPLACEMENT.** Q6 reassigned to range-engine program scope as **WS-175** — range-engine answers update gating independently.
- **CFR / counterfactual regret minimization.** Bayesian inference is the model. Concern 2 (Devil's Advocate) flagged predictionAudit doesn't close FM-COMP-01 (range-composition vs frequency decoupling); the concern stands as **WS-174 trigger-conditioned revisit** (≥1000 hands captured + frequency-match-rate >0.85 + EV-bleed observed).
- **Live-surface calibration display.** predictionAudit display is study-mode-only (red line #8). Live decisions consume current model output; calibration is information event in HandReplay, not live override.
- **Hero grading.** AP-06 / AP-PMC-04 model-accuracy framing throughout. Hero-action audit entries framed as "the model recommended X; observed action Y" — model accuracy, not user accuracy.
- **Engagement / streaks / mastery scores.** Refused outright.
- **Auto-modification of model output.** Detected drift surfaces as a finding; the model is not auto-tuned by predictionAudit output. AP-PMC-01 binding.
- **Variance-blaming-the-model copy.** AP-PMC-06 forbids any prose framing predictionAudit divergence as model fault rather than information event — see §Anti-pattern refusals.

---

## Phases (REPLACEMENT, 2026-05-09)

### Phase 1 — Gate 1 Entry (CLOSED 2026-05-09)

Deliverables:
- ✓ Audit at `docs/design/audits/2026-05-09-entry-pmc-prediction-ledger.md` — RED verdict
- ✓ Project charter (this file)
- ✓ WS-172 ticket for Gate 2 Roundtable
- ✓ ~~WS-169 reassigned from EAL to PMC~~ (re-released back to EAL at Gate 2 close-out)

### Phase 2 — Gate 2 Blind-Spot Roundtable (CLOSED 2026-05-09)

**Status:** ✓ closed across two sprints — SPR-064 (Stages A-D + 14 Tier-1 sketches + 10 cross-cutting architectural asks) + SPR-065 (per-class detail + Stage E + REPLACEMENT verdict + close-out).

Output:
- ✓ `docs/projects/predictive-model-calibration/failure-mode-taxonomy.md` — 14 Tier-1 classes + visibility-status framework + per-class detail (detection signature + severity + worked example)
- ✓ `docs/design/audits/2026-05-09-blindspot-pmc-failure-modes.md` — Stages A-E verdicts + Devil's-Advocate dispositioning + close-out
- ✓ `docs/projects/predictive-model-calibration/registered-hypotheses.md` — pre-registration registry stub
- ✓ JTBD dispositions captured in audit (DS-58 sub-clause + DS-NEW-PMC-02 amendment + DS-NEW-PMC-03 + DS-NEW-PMC-04a/b/c — Gate 3 deferred under REPLACEMENT)

### Phase 3 — Gate 3 Research (DEFERRED indefinitely under REPLACEMENT)

Original Phase 3 anticipated: solver-vs-population literature for Ignition small-stakes baselines, hierarchical Bayes prior-art survey, owner interview on bucket-priors confidence. Under REPLACEMENT (no hierarchical aggregator), Gate 3 is moot. JTBD authoring (DS-58 sub-clause + DS-NEW-PMC-02 amendment + DS-NEW-PMC-03 + DS-NEW-PMC-04a/b/c) re-enters at Phase 5b Gate 4 if the render-surface design surfaces the same JTBD coverage gap.

### Phase 4 — Gate 4 Design (~0.5 session)

Deliverables (revised under REPLACEMENT):
- New ticket: predictionAudit IDB-field schema (~50 lines, trivial — Q1 storage budget waived as trivial under REPLACEMENT; Q3 ledger backfill trivial — existing hands re-runnable per-hand)
- New ticket: render-surface design — Phase 5b ticket for HandReplay (or whatever surface); Gate 4 design produces a small surface artifact in `docs/design/surfaces/` if the render surface introduces new vocabulary
- ~~AP-06 extension covering aggregate model-accuracy copy~~ → AP-PMC-06 authored at Gate 2 close-out (this sprint), see §Anti-pattern refusals

### Phase 5 — Implementation (REPLACEMENT scope; ~1-2 sessions total)

Sub-phases (collapsed from 5a-5e):

**5a — predictionAudit primitive (~0.5-1 session) — ✓ SHIPPED SPR-068 / WS-177 (2026-05-10)**
- ✓ IDB migration v25 (additive `predictionAudit: null` default on legacy hands; forward-only per Q2 ratification)
- ✓ `predictionAuditWriter.js` API: `writePredictionAudit(handId, payload)` + `readPredictionAudit(handId)` + `composeModelVersion()` + `sanitizePredictionAudit()`
- ✓ Hand-end orchestrator wiring: `usePersistence` calls `reconstructPredictionAudit(handData)` + `sanitizePredictionAudit` inline before `saveHand`; predictionAudit field is atomic with the hand record (Q1 ratified — post-hoc reconstruction; zero coupling into live-decision hot paths)
- ✓ Tests: 42 new tests (migrationV25 6 + predictionAuditWriter 20 + reconstruct 16); 10756/10776 full smart-test-runner pass (zero regressions)
- ✓ AP-PMC-04 schema-level enforcement: `sanitizePredictionAudit` strips `evRealized` from hero `observedAction` entries at the writer layer; pinned by writer test
- ✓ modelVersion source (Q3 ratified): composed `range-${PROFILE_VERSION}+engine-${ENGINE_VERSION}` (currently `range-3+engine-v123`)
- **Phase 5a-2 SHIPPED SPR-070 / WS-178 (2026-05-10):** `predictedDistribution[]` engine-query population. `reconstruct.js` extended with `deps` parameter (configurable `isModeledNode` predicate, `getRangeProfile`, `evaluateGameTree`); function is now async. Hero decision-nodes get softmax-normalized policy from `evaluateGameTree`; preflop villain decision-nodes get action distribution from `rangeProfile` per-action grid sums (reuse `rangeAccessors.getVillainRange` — no new range-engine math). Postflop villain distributions remain `distribution: []` per D3=A (model-couldn't-evaluate signal preserved 1:1 with modeled nodes); a future Phase 5a-3 ticket can fill via `villainDecisionModel`/`actionRates` if consumer demand emerges. Engine context is plumbed via `<EngineCtxBridge/>` (D1=A ref-getter pattern) — bridge lives inside `TendencyProvider`, populates a ref read by `usePersistence` at hand-save time. +33 tests (31 reconstruct + 3 usePersistence; full-suite 10765 pass / 20 skip / 9 pre-existing flakes in unrelated working-tree files). Build clean. Founder ratifications: D1=ref-getter bridge / D2=configurable predicate (default = first betting action by seat per street) / D3=record `distribution: []` and continue.

**5b — Render surface (~0.5-1 session, Gate 4 design-deferred)**
- Render-surface design TBD next sprint (founder verdict at Gate 2 close-out: "TBD next sprint")
- Most likely surface: HandReplay ReviewPanel per-hand display
- AP-PMC-06 forbidden-pattern enforcement at component level
- Pre-registration registry binds any aggregate slicing if/when introduced (currently no aggregate surface)
- Mastery-score-surface distinguishability ratified at Stage E (structurally distinguishable; no architectural fix needed)

**~~Phase 5c — Aggregator~~** CANCELLED.
**~~Phase 5d — Dashboard wiring~~** CANCELLED. (WS-169 re-released to original EAL Stream D 3-tab scope.)
**~~Phase 5e — Range-engine showdown-update wiring~~** CANCELLED. (Q6 reassigned to range-engine program scope as WS-175.)

---

## Architectural primitives (REPLACEMENT, 2026-05-09)

### The predictionAudit per-hand IDB field (current architecture)

```ts
interface PredictionAuditField {
  predictedDistribution: {
    actor: 'villain' | 'hero'    // captured per actor at decision-time
    actorId: string              // playerId or 'hero'
    seat: number
    distribution: Array<{action, weight, sizing?}>  // model output at decision-time
  }[]                            // one entry per modeled decision-node within the hand
  observedAction: {              // populated at hand-end
    actor: 'villain' | 'hero'
    actorId: string
    seat: number
    actionTaken: string
    sizing: number?
  }[]
  modelVersion: string           // semver of engine bundle producing the predictions
  // AP-PMC-04 binding: evRealized field is NOT captured for hero entries.
  //   Schema-level enforcement, not copy-discipline-dependent.
}

// Stored as a field on each `hands` record (no new IDB store).
// Q1 (storage budget) trivial — ~1KB per hand × 10K hands/year = ~10MB/year IDB pressure.
// Q3 (backfill) trivial — existing hands re-runnable through engine to bootstrap field.
```

### Pre-registration registry (FM-DISC-01 mitigation)

`registered-hypotheses.md` ratchet: any predictionAudit-derived hypothesis that emits Tier-1 (flag-bearing) verdicts must be pre-registered with id / class-link / detection-signature / authored-date BEFORE first data view. Closes Q2 (multi-comparisons rigor) via discipline rather than statistical correction (Bonferroni vacuous at 5×10⁵ implicit hypotheses; FDR requires aggregate surface that REPLACEMENT cancels).

---

### Cancelled architecture (preserved for traceability)

The original full-ledger architecture and hierarchical Bayesian aggregator are documented below for archival reference. **All cancelled at REPLACEMENT (2026-05-09).** Per-class detail in failure-mode-taxonomy.md tags any class whose detection requires this architecture as `OUT-OF-SCOPE-AT-CURRENT-ARCHITECTURE`.

### ~~The Prediction Ledger entry (CANCELLED)~~

```ts
interface PredictionLedgerEntry {
  // Identity
  id: string                          // uuid
  handId: string                      // FK to hands
  sessionId: string
  decisionNodeId: string              // (street, action-index) within the hand

  // Snapshot — when prediction was made
  modelVersion: string                // semver of engine bundle producing this
  timestamp: ISO8601

  // What was predicted
  outputClass: 'range-distribution' | 'exploit-recommendation' | 'anchor-firing'
              | 'hero-advice' | 'fold-rate' | 'sizing-recommendation' | ...
  predictedDistribution: {            // shape varies by outputClass
    actor: 'hero' | 'villain' | 'system'
    actorId: string                   // playerId or 'hero' or 'system'
    seat: number
    distribution: Array<{action, weight, sizing?, range?}>
    confidence: { tier, n, ci }
    metadata: { /* class-specific */ }
  }

  // Inputs to the model at decision time
  situationKey: string                // canonical key (preflop position / 3bet pot / SPR / etc)
  boardKey: string?                   // null preflop
  actionHistoryHash: string           // hash of action history up to this node
  villainsRemaining: number
  effectiveStack: number

  // Tags
  hero_in_hand: boolean
  hero_acted_at_node: boolean         // does this prediction concern an action hero took?
  contributesToCalibration: boolean   // respects red line #9 incognito mode

  // Eventually consistent — written when hand resolves
  observedOutcome: {
    actionTaken: string?              // null if villain folded preflop unobserved
    sizing: number?
    showdownReveal: { hand, equity }? // null if no showdown
    handResult: { potDelta, evRealized } // populated at hand-end
    observedAt: ISO8601
  }?
}
```

### ~~Hierarchical Bayesian aggregation (CANCELLED)~~

```
posterior(rate | villain_v, situation_s)
  = combine(
      population_prior(situation_s),         // wide CI from population baseline
      per_villain_likelihood(v, s)           // narrow as N grows
    ) via shrinkage_factor(N_v_s)

drift_signal(rule_r, window_w)
  = posterior_at(rule_r, window_w_recent)
   vs posterior_at(rule_r, window_w_baseline)
   → flag if KL > threshold

failure_mode_match(observation, taxonomy)
  → for each class in taxonomy:
    if detection_signature(class).matches(observation): flag(class, evidence)
```

The shrinkage parameter and drift thresholds are **model-design decisions** authored Gate 4 in `aggregator-design.md`. Not arbitrary; derived from the taxonomy's per-class severity and false-positive tolerance.

---

## Anti-pattern refusals (binding through implementation)

These extend AP-01..08 from EAL into the PMC scope. AP-PMC-01..05 authored Gate 1 (2026-05-09 morning); AP-PMC-06 authored Gate 2 close-out (2026-05-09 sprint 2/2) per FM-COMP-01 + Devil's-Advocate dispositioning of DS-NEW-PMC-02.

- **AP-PMC-01 — No model auto-tuning from predictionAudit.** Audit output surfaces information events; the model is not modified by audit data. Owner-mediated overrides only.
- **AP-PMC-02 — No causal claim from correlation.** Audit surfaces divergences; prose never asserts *why* a prediction missed without explicit owner or external evidence. Forbidden patterns: "villain X is doing Y because Z" without grounded causal structure.
- **AP-PMC-03 — No villain-specific shame copy.** Per-villain audit prose never frames the villain as "exploitable" in the render surface. The frame is "model accuracy on this villain": *"For player V on this hand, the model predicted river-bet frequency 22%; observed action: bet 0.7 pot."* Not: *"Player V is bluffing — exploit by calling more."* Live recommendation flow lives in exploit engine, which consumes the corrected model.
- **AP-PMC-04 — No hero-grading copy.** Already AP-06 in EAL; PMC binds broader scope. **Schema-level enforcement (Stage E ratification 2026-05-09):** the predictionAudit field MUST drop `evRealized` for hero entries at write time. Don't depend on copy discipline to enforce a data contract — strip the field at the writer.
- **AP-PMC-05 — No "model is wrong, fix it now" pressure copy.** Divergence surfaces as data, not as TODO. Owner decides what to do.
- **AP-PMC-06 — No variance-blaming-the-model copy (authored 2026-05-09 sprint 2/2).** predictionAudit divergence is an *information event*, not a model fault verdict. Forbidden patterns:
  - "the model was wrong here"
  - "model accuracy declined this session"
  - "Y hands diverged from prediction — model is mis-calibrated"
  - any framing that lets the audit be the source of variance attribution
  - any framing that aggregates per-hand divergence into a session-level or villain-level "accuracy score" (e.g., "N matched / M total = X% accurate") — derives a mastery-score-shaped surface from a per-hand information primitive

  Required framing: "predictedDistribution: X; observedAction: Y." That's it. The owner reads divergence, forms a judgment, takes whatever action they take. AP-PMC-06 is enforced at the component level (forbidden-pattern grep at CI) for any surface rendering predictionAudit data.

  Origin: Devil's-Advocate dissent on DS-NEW-PMC-02 ("trace-loss-to-model-or-variance"). Without AP-PMC-06, the JTBD becomes variance-rationalization-codified — owner blames model for downswings with statistical-looking cover. AP-PMC-06 makes the JTBD survivable by forbidding the variance-attribution framing that would otherwise corrupt it.

---

## Cross-program effects (REPLACEMENT, 2026-05-09)

| Program | Effect (REPLACEMENT scope) |
|---|---|
| `engine-accuracy` | predictionAudit narrows but does NOT close FM-Engine-Drift-Silent-Invalidation (SYSTEM_MODEL §11). Frequency-level drift becomes visible at per-hand granularity; range-composition / sizing-conditional drift remains invisible (FM-COMP-01..04). Concern 2 binding caveat (WS-174 trigger-conditioned revisit) covers the residual. |
| `EAL (Exploit Anchor Library)` | WS-169 RE-RELEASED to original 3-tab scope at Gate 2 close-out. EAL Stream D is independent of predictionAudit. AP-08 signal separation preserved; AP-PMC-06 binds any future EAL render of predictionAudit data. |
| `SCF (Self-Coach Foundation)` | Hero-leak detector continues to operate against existing tendency infrastructure; predictionAudit is not load-bearing for SCF. AP-PMC-04 schema-level enforcement applies if SCF surfaces predictionAudit data (drop evRealized at write for hero entries). |
| `HSP (Hero State Primitive)` | HSP archetypes remain OUTPUTS of plan computation, NEVER INPUTS (HSP doctrine). predictionAudit can record archetype-at-decision, but render surfaces MUST NOT use predictionAudit divergence to feed back into archetype assignment (FM-PROG-04 doctrinal violation pathway). |
| `range-engine` | RANGE_ENGINE_DESIGN §4.5 Bayesian update path operates independently of predictionAudit. Q6 (update gating) reassigned to range-engine scope as **WS-175**. FM-SEL-01 (showdown selection bias / MNAR) remains a range-engine concern. |
| `domain-correctness` | PMC owns Predictive Model Calibration scope. New problem-class registered with reduced surface (predictionAudit + taxonomy + AP-PMC-* + pre-registration registry). |
| `design` | Gate 1/2 closed at REPLACEMENT scope (2026-05-09). Gate 4 (Phase 5b render-surface design) deferred. AP-PMC-01..06 binding. |

---

## Workstream registry (REPLACEMENT, 2026-05-09)

| WS | Title | Phase | Status |
|---|---|---|---|
| **WS-172** | Gate 2 Blind-Spot Roundtable — failure-mode taxonomy + Gate 2 close-out | 2 | ✓ done (sprint 1/2 SPR-064 + sprint 2/2 SPR-065, 2026-05-09) |
| **WS-169** | EAL Stream D — Calibration Dashboard 3-tab (RE-RELEASED 2026-05-09) | n/a (EAL) | backlog — re-released to original EAL Stream D scope at Gate 2 close-out |
| **WS-174** | Concern 2 Gate-N+ revisit — CFR vs Bayesian frequency-matching | n/a (revisit) | backlog (trigger-conditioned: ≥1000 captured hands + frequency-match-rate >0.85 + EV-bleed observed) |
| **WS-175** | Range-engine Q6 update gating (reassigned from PMC Phase 5e) | n/a (range-engine) | ✓ done (SPR-067, 2026-05-10) — every-showdown gating + FM-SEL-01 accept-with-rails |
| **WS-177** | Phase 5a — predictionAudit primitive + IDB field migration | 5a | ✓ done (SPR-068, 2026-05-10) — IDB v25 + writer + reconstructor + AP-PMC-04 schema enforcement; predictedDistribution capture deferred to WS-178 |
| **WS-178** | Phase 5a-2 — predictedDistribution engine-query population | 5a-2 | ✓ done (SPR-070, 2026-05-10) — reconstruct.js async + deps param (isModeledNode / getRangeProfile / evaluateGameTree); hero softmax + villain preflop grid-sum distributions; D1=ref-getter `<EngineCtxBridge/>` plumbing; D2=configurable predicate (default first-action-per-street-per-actor); D3=`distribution: []` for unmodeled nodes (postflop villain deferred to Phase 5a-3 if demand emerges) |
| WS-NNN | Phase 5b — Render surface design (Gate 4) + implementation | 5b | TBD (Gate 4 design pending) |

WS-177 ships the substrate (schema + writer API + observedAction capture + AP-PMC-04 enforcement). WS-178 was authored at SPR-068 close-out as the explicit follow-up for predictedDistribution engine-query population — split off the primitive to keep Phase 5a substrate-clean per Q1 ratification (post-hoc reconstruction; engine integration is its own design problem). Phase 5b WS-ID allocated when Gate 4 design composes. Cancelled phases (5c aggregator, 5d expanded dashboard, 5e range-engine wiring) have no associated tickets.

---

## Open questions — Gate 2 close-out verdicts (2026-05-09 sprint 2/2)

| Q | Topic | Verdict (REPLACEMENT) |
|---|---|---|
| Q1 | Storage budget | **Trivial.** predictionAudit is a single field per hand; ~1KB per hand × ~10K hands/year = ~10MB/year. No retention strategy needed at current architecture. |
| Q2 | Multi-comparisons rigor | **Pre-registration registry binds.** `registered-hypotheses.md` ratchet for any predictionAudit-derived analysis emitting Tier-1 (flag-bearing) verdicts. FM-DISC-01 mitigation via discipline rather than statistical correction (Bonferroni vacuous at 5×10⁵; FDR requires aggregate surface that REPLACEMENT cancels). |
| Q3 | Ledger backfill | **Trivial.** predictionAudit on existing hands is bootstrappable by re-running engine over historical hands; 1 boolean flag (`historicalReplay`) tags backfilled entries to distinguish from forward-captured. |
| Q4 | Population definition | **Preliminary verdict (sprint 1/2): NOT a single global "live pool" — explicit Ignition × format × stakes × daypart slicing.** Under REPLACEMENT, this verdict applies to range-engine priors (`populationPriors.js`, `gameTreeConstants.js POP_CALLING_RATES`, `villainModelData.js`) — not to a hierarchical aggregator that no longer exists. Q4 reassigned to range-engine + populationPriors scope; charter notes the slicing dimensions for future range-engine work. |
| Q5 | Drift detection windowing | **Resolve to BOCPD (Bayesian Online Change-Point Detection per FM-DRIFT-02).** Even if no aggregate surface exists today, the per-hand predictionAudit rendering may surface session-level drift signals at Phase 5b Gate 4. When that design is authored, drift detection uses BOCPD (Adams & MacKay 2007) rather than sliding-window-with-static-posterior comparison. KL on sparse multinomials (FM-DRIFT-01) explicitly forbidden. Phase 5b Gate 4 design must adhere. |
| Q6 | Range-engine update gating | **CLOSED 2026-05-10 SPR-067 / WS-175.** Verdict: **every-showdown gating** (status quo) ratified — see `docs/RANGE_ENGINE_DESIGN.md §4.5` for rationale. **FM-SEL-01 stance:** ACCEPT the MNAR bias with observability rails — `revealMechanism` field added to showdown anchor records (default `'showdown'`). No boost-magnitude correction today; field reserved for future extractor refinement. FM-SEL-01 stays open as long-term monitoring concern, not closed. |

---

## Decisions ratified 2026-05-09 — original Gate 1 (PRE-REPLACEMENT)

These are recorded for traceability. See §Decisions revised at Gate 2 close-out for current state.

1. **Capture scope:** every prediction at every decision node we model, tagged `hero_in_hand: bool`. Both hero-faced and villain-only-observed decisions.
2. **Aggregation hierarchy:** hierarchical Bayesian — population baseline + per-villain shrinkage. Per-situation slicing as orthogonal dimension.
3. **MVP delivery:** full pipeline (spec → ledger → analyzer → dashboard) end-to-end. Multi-sprint program.
4. **Failure-mode taxonomy authorship:** adversarial Gate 2 Blind-Spot Roundtable produces it (5 specialists + devil's advocate). Single-pass authored taxonomy refused as "theory validating theory."
5. **Project home:** new project (PMC) absorbing WS-169. Not an EAL stream extension — ledger scope is broader than anchors.
6. **CFR / regret minimization:** deferred indefinitely. Bayesian inference is the model.

## Decisions revised at Gate 2 close-out 2026-05-09 (binding under REPLACEMENT)

| # | Original | Revised state | Rationale |
|---|---|---|---|
| 1 | Capture scope: every prediction at every decision-node, hero_in_hand tagged | **REDUCED** — capture per-hand at hand-end, not per-decision-node. Decision-node-level lossless ledger cancelled. Per-hand audit field carries the full set of modeled-decisions for the hand as an array. | predictionAudit per-hand granularity is sufficient for frequency-level diagnostics; per-decision-node fan-out was the cost predictionAudit was designed to avoid. |
| 2 | Hierarchical Bayesian aggregation | **REVERSED — CANCELLED** | Devil's-Advocate Concern 4 (95% of Ignition villains recover the prior; per-villain shrinkage degenerates to single-level aggregation for anonymous opponents — `playerId = seat-within-session` makes per-villain identity fictitious; FM-INF-04 in taxonomy) — hierarchical machinery's value-vs-cost ratio unjustifiable. No aggregator. |
| 3 | Full-pipeline MVP (spec → ledger → analyzer → dashboard) | **REVERSED** | Devil's-Advocate Concern 1 (simpler intervention) disposed REPLACEMENT. predictionAudit IS the deliverable. ~0.5-1 session implementation, no multi-sprint pipeline. |
| 4 | Adversarial Gate 2 Roundtable produces taxonomy | **STANDING** ✓ | This program executed it across SPR-064 + SPR-065 (2026-05-09). Taxonomy + 10 cross-cutting architectural asks + REPLACEMENT decision are the outcome. |
| 5 | New project (PMC) absorbing WS-169 | **AMENDED** | PMC continues as a program (predictionAudit + taxonomy + AP-PMC-* + pre-registration registry are still program-scoped). WS-169 RE-RELEASED at Gate 2 close-out back to original EAL Stream D 3-tab anchor/predicate/primitive scope. WS-169 absorption was driven by the expanded-dashboard architecture; with that cancelled, the absorption is unwarranted. |
| 6 | CFR / regret minimization deferred indefinitely | **STANDING-WITH-CONCERN** | Devil's-Advocate Concern 2 (CFR is the actual mathematical answer; predictionAudit doesn't address sizing-conditional ranges) flagged as a live concern. Deferral stands but is now trigger-conditioned: WS-174 designated revisit ticket fires when ≥1000 hands captured + frequency-match-rate >0.85 + EV-bleed observed (the FM-COMP-01 signature). |

### Devil's-Advocate concerns dispositioned at Gate 2 close-out

| Concern | Disposition | Outcome |
|---|---|---|
| **1.** Simpler intervention (`predictionAudit` ≤200 LOC, 80% inferential value, 5% cost) | **ACCEPT as REPLACEMENT** | Full ledger / aggregator / expanded dashboard cancelled. predictionAudit IS PMC. Ratifications #2, #3 reversed. Ratification #5 amended (WS-169 re-released). |
| **2.** CFR deferral is the giveaway — frequency-match is necessary-not-sufficient | **STAND-WITH-TRIGGER** | Ratification #6 stands. WS-174 trigger-conditioned revisit ticket created. Concern stays live, not buried. |
| **3.** Six ratifications in one day = anchoring not consensus | **AUTO-RESOLVED** | Ratifications #2, #3, #5 reversed/amended at Gate 2 close-out (this very disposition). The re-litigation is happening; consensus-as-anchoring concern is what motivated the re-evaluation. |
| **4.** 95% of Ignition villains recover the prior — hierarchical machinery wasted | **MOOT under REPLACEMENT** | No hierarchical machinery exists post-REPLACEMENT. FM-INF-04 in taxonomy preserves the architectural insight as documented invisibility. Concern's substantive claim is accepted (concern → architecture removed). |

---

## Gate 2 progress (2026-05-09 sprint 1/2 — interim)

**Sprint scope per founder split:** Stages A-D + ≥10-class taxonomy sketches this sprint; Stage E + per-class detail + charter close-out + open-Q verdicts + Devil's-Advocate dispositioning next sprint.

**Execution model used:** hybrid roundtable — 6 parallel general-purpose Agents, each given a forced-reading list specific to their lens + open architectural-pushback invitation. Personas: range-engine theorist, population ecology, frequentist statistician, Bayesian inference specialist, adversary modeler, devil's advocate. None of `/eng-engine`'s standard personas matched the math/stats specialists this required.

**Artifacts authored:**
- [`docs/projects/predictive-model-calibration/failure-mode-taxonomy.md`](../../docs/projects/predictive-model-calibration/failure-mode-taxonomy.md) — 14 Tier-1 classes across 9 families with sketches; per-class detail deferred
- [`docs/design/audits/2026-05-09-blindspot-pmc-failure-modes.md`](../../docs/design/audits/2026-05-09-blindspot-pmc-failure-modes.md) — Stages A-D verdicts + cross-cutting architectural asks + founder dissent surfacing

**Stage outcomes:**
- **Stage A:** ⚠️ Patch needed — situational sub-personas `post-session-chris-model-audit-mode` + `post-session-chris-population-mode` (NOT a new core persona; Devil's Advocate's concern about hypothetical analyst is valid)
- **Stage B:** ⚠️ Expansion needed — DS-NEW-PMC-01 collapses into DS-58; DS-NEW-PMC-02 amended + AP-PMC-06 author; DS-NEW-PMC-03 author; DS-NEW-PMC-04a/b/c cluster author; DS-NEW-PMC-05/06 deferred to Gate 3
- **Stage C:** ⚠️ Adjust needed — dashboard MUST have time-horizon partition + per-firing prior-contribution % + per-version stratification + defensibility floor + two-mode toggle. Concrete wrong-and-believed scenario surfaced (FM-LINEAGE-02 model-version aliasing causing green-dot misleading).
- **Stage D:** ❌ Scope was wrong — ~12 cross-program surfaces under-scoped in charter; Phase 5b/5e need re-decomposition. Sidebar/extension confirmed GREEN no-ripple ✓.
- **Stage E:** DEFERRED to next sprint.

**Cross-cutting architectural asks emerged from synthesis** (10 binding for Gate 4):
1. Add latent-class/archetype layer between population and per-villain (FM-INF-04 + FM-PRIOR-04 — convergent across 4 personas)
2. Replace single `population_prior(situation_s)` with `population_prior(situation_s, format, stakes, daypart)` — preliminary Q4 verdict
3. Ledger schema must add ≥6 fields beyond current sketch (`priorAtDecision`, `evidenceUsed`, `likelihoodFamily`, `posteriorPrecision`, `selectionPath`, `revealMechanism`, `heroPolicyHash`, `keyDefinitionVersion`, `actionTaxonomyVersion`, `taxonomyVersion`, `partialFlush`, `referenceClass`)
4. Tier-1/Tier-2 reporting separation + pre-registered hypothesis registry
5. Defensibility floor `n ≥ max(30, 4/baseline_rate, 4/(1-baseline_rate))`
6. Time-horizon partition tabs (this session / this month / this quarter)
7. Two-mode toggle (default / posterior-diagnostic), situational sub-personas
8. Schema-level enforcement of AP-PMC-04 — drop `evRealized` at write for hero entries
9. Drift-detection estimator separation — hierarchical Bayes for level; sequential change-point for drift
10. Off-taxonomy bucket as first-class artifact + adversarial taxonomy maintenance

**Founder dissent surfaced (Devil's Advocate) — REQUIRES disposition next sprint before Gate 4 commitment:**
- The simpler intervention (`predictionAudit` per-hand IDB field, ≤200 LOC, 0.5 sessions, 80% inferential value, 5% cost) — accept as Phase 5a entry-point or explicitly refuse
- CFR deferral concern (charter ratification #6) — Bayesian frequency-matching may validate models that lose money via FM-COMP-01 (range-composition vs frequency decoupling)
- Six ratifications in one day on a Heavy decision — anchoring vs consensus; re-litigate ratifications #3 (full-pipeline MVP) and #5 (new project absorbing WS-169)
- "Building Bayesian machinery to recover the prior" — for ~95% of Ignition villains, per-villain shrinkage degenerates to population-only inference; the architecture spends complexity on a layer that doesn't earn its keep

**Charter ratifications status (2026-05-09):**
1. Capture scope: every prediction at every decision node — **standing**, no challenge
2. Aggregation hierarchy: hierarchical Bayesian — **AMENDMENT REQUIRED** (add latent-class layer; for Ignition pool, 3-level not 2-level)
3. MVP delivery: full pipeline (spec → ledger → analyzer → dashboard) — **RE-LITIGATE** per Devil's-Advocate concern; consider `predictionAudit` per-hand-field as Phase 5a-zero entry point
4. Failure-mode taxonomy authorship: adversarial Gate 2 — **STANDING** (this sprint executed it; outcome is the taxonomy + 10 cross-cutting asks)
5. Project home: new project absorbing WS-169 — **RE-LITIGATE** per Devil's-Advocate concern; absorption may be scope-creep if `predictionAudit` simpler-intervention path is taken
6. CFR deferred indefinitely — **STANDING with note**: Devil's Advocate flagged this as load-bearing ("CFR is the actual mathematical answer"); the deferral may be wrong but is a Gate N+ revisit, not a Gate 2 reopener

## Status

- 2026-05-09 — Project initialized. Gate 1 Entry RED. WS-172 created. WS-169 reassigned to PMC. Gate 2 next.
- 2026-05-09 — Gate 2 sprint 1/2 (SPR-064) — Stages A-D + 14 Tier-1 taxonomy class sketches authored. 10 binding cross-cutting architectural asks. Founder-dissent dispositioning required next sprint before Gate 4 commitment. WS-172 status `in_progress` — release back to backlog with status `in_progress` for next sprint to claim.
- 2026-05-09 — **Gate 2 sprint 2/2 (SPR-065) CLOSED. REPLACEMENT verdict ratified.** Devil's-Advocate Concern 1 disposed REPLACEMENT — predictionAudit per-hand IDB field IS PMC; full ledger / hierarchical-Bayesian aggregator / expanded calibration dashboard architecture CANCELLED. Phase 5 collapsed from 5a-5e (~5-8 sessions) to 5a (predictionAudit primitive, ~0.5-1 session) + 5b (render surface, design-deferred to Gate 4). WS-169 re-released to original EAL Stream D 3-tab scope. WS-174 created (CFR Concern 2 trigger-conditioned revisit). WS-175 created (range-engine Q6 update gating). AP-PMC-06 authored. Pre-registration registry stub authored. Taxonomy refactored with visibility-status framework (DETECTABLE-VIA-PREDICTIONAUDIT / OUT-OF-SCOPE-AT-CURRENT-ARCHITECTURE / STRUCTURALLY-INVISIBLE per Tier-1 class). WS-172 status `done`. Charter ratifications #2, #3 reversed; #5 amended; #6 stand-with-trigger; #1 reduced; #4 standing.
