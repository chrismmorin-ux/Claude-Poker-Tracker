# Data-Source Registry

> **Status:** PROMOTED 2026-07-31. Drift detection is live against this file.
> **Baseline generated:** 2026-06-19 (`provenance-audit`, run-2026-06-19-provenance-baseline)
> **Verification pass:** 2026-07-31 — every entry re-checked against the code. Corrections and
> additions marked `VERIFIED 2026-07-31` in the relevant `review_notes`. Four sources added
> (SRC-012…SRC-015) for datasets this repo is about to depend on.
> **Scope:** the **Exploit Model** data flow (`.claude/projects/exploit-model-architecture.md` §1, §1.5), plus the backtest/readiness evidence chain. Sources outside the model (drills, anchors, refresher, subscription, telemetry, tournaments) are grouped at the end, not individually registered (avoid padding).

---

## The rule that makes this registry enforceable

**Provenance is a property of the ROW, not of the file.** A source id must travel with data at
its finest grain — the street action / decision — through every join and every aggregation.

This is not bookkeeping preference. Three things in this repo are impossible without it:

1. **Composition reporting.** An aggregate that carries its rows' source ids can state its own
   mix ("83% SRC-012 online 2009 50NL, 17% SRC-014 live 1/3") without anyone remembering to
   attach it. File-level provenance evaporates at the first `GROUP BY`.
2. **Scope-leak detection.** "What this number is NOT" becomes computable rather than
   editorial: a claim about live play whose support is 100% online rows is *detectable*.
3. **The monotonicity invariant.** SRC-011 already carries the rule *"a re-aggregation with
   observed hands would be a trust-tier upgrade through the chain (violation)."* An illegal
   upgrade cannot be detected unless the chain travels with the row.

Any new pipeline that drops source id on ingest has broken the registry regardless of what it
writes here.

> **Trust tiers (generic T1–T5) mapped to the §1.5 poker ladder:**
> T1 Authoritative/regulatory · T2 Trusted vendor · T3 Internal DB (your recording) · T4 Internal derivation/assumption · T5 External unverified.
> §1.5 ladder: **Certain** (showdown) → T3+certain · **High** (observed action) → T3 · **Medium** (line-inference) → T4 · **Prior** (Field baseline) → see ⚠️ priors · **Reference** (GTO) → planned · **Variable** (physical read) → T3+user-rated.

> **`surface_class` here is NOT FSA's surface kind.** In this registry `surface_class` describes
> what kind of *store* a source is — `internal_db | vendor_api | derived | reference_data`. The
> Five-Surface Atlas uses "surface" to mean *a function from game state to action distribution*,
> and its axis is a separate field named **`surface_kind`** (`Equilibrium | Field | Read |
> Declared`) — deliberately renamed in WS-322 so the two never collide in a grep. See
> `docs/standard-of-record/VOCABULARY.md`. This registry's field and values are unchanged.

---

## Sources

### Surface class: internal_db — Empirical (your own recording, system-of-record)

#### SRC-001 — Hands store (the Empirical SSOT)
```yaml
source_id: SRC-001
name: "hands (IndexedDB store, DB v27)"
type: idb_store
surface_class: internal_db
source_evidence:
  - file: src/utils/persistence/database.js
    lines: "53"
    note: "store def; keyPath handId; indexes incl. source, userId_timestamp"
  - file: src/utils/persistence/handsStorage.js
    lines: "414-446"
    note: "saveOnlineHand stamps source:'ignition'; manual hands leave source undefined"
trust_tier: T3
confidence: High
review_notes: "The ground-truth Empirical source for the whole model. Verify the source-field convention (manual=undefined, ignition='ignition', no import path today)."
last_verified:
```

#### SRC-002 — Showdown reveals (certain card knowledge)
```yaml
source_id: SRC-002
name: "cardState.allPlayerCards (showdown-revealed cards on hand records)"
type: idb_store
surface_class: internal_db
source_evidence:
  - file: src/utils/rangeEngine/bayesianUpdater.js
    lines: "95-109"
    note: "applyShowdownAnchor on every reveal; 'every showdown' policy chosen explicitly over batch/N-threshold"
trust_tier: T3
confidence: High
review_notes: "§1.5 'Certain' tier — highest poker-trust input (it overrides inference). Lives inside SRC-001 hand records but is a distinct CERTAINTY class and should keep its own provenance stamp so a derived range can cite 'showdown-anchored' vs 'inferred'. VERIFIED 2026-07-31: line reference corrected 75-80 → 95-109 (the anchor application moved). SELECTION WARNING, load-bearing for SRC-012/SRC-014: showdown reveals are NOT a random sample of hands. A hand only reaches showdown when nobody folded, so this source systematically over-represents passive lines and calling ranges. Any P(x | showdown) is a conditional on a selected set — never quote one as a population rate (POKER_THEORY §11.8 records the concrete case: P(check | strong) inflated for every player by this effect)."
last_verified: 2026-07-31
```

#### SRC-003 — Sessions store (hero financial results, raw)
```yaml
source_id: SRC-003
name: "sessions (buyIn / cashOut / rebuyTransactions / tipAmount)"
type: idb_store
surface_class: internal_db
source_evidence:
  - file: src/utils/persistence/migrations.js
    lines: "67-77"
    note: "store def (v2)"
  - file: src/utils/sessionStats/sessionAnalytics.js
    lines: "38"
    note: "PnL = cashOut - buyIn - rebuys - tip (read-time)"
  - file: src/utils/persistence/sessionsStorage.js
    lines: "92, 314"
    note: "second PnL computation site — confirm the two agree before either is cited"
trust_tier: T3
confidence: High
review_notes: "Empirical financial truth. ⚠ No bb/100 or hand-volume weighting exists (see Finding F4) — a 1-hand +$500 is indistinguishable from a 300-hand +$500. The Financial Resolution layer (charter §3) reads from here. VERIFIED 2026-07-31: BROKEN POINTER FIXED — the draft cited `src/utils/sessionAnalytics.js`, which does not exist; the module moved to `src/utils/sessionStats/`. A second PnL computation exists in sessionsStorage.js and was not registered; two computation paths for one displayed number is the SRC-005/F7 pattern (see DP-008) and should be reconciled. F4 REMAINS OPEN and is now load-bearing: this is the source that would carry a realized bb/hr readiness figure, and per the C3 variance analysis (2026-07-31) realized results are far too slow to certify an edge — hand volume is exactly what is missing to say so quantitatively."
last_verified: 2026-07-31
```

#### SRC-004 — Players store + PIO physical reads (Variable trust)
```yaml
source_id: SRC-004
name: "players + sightingLogs (PIO identification attributes + physical reads)"
type: idb_store
surface_class: internal_db
source_evidence:
  - file: src/utils/persistence/migrations.js
    lines: "768-779, 799-829, 900-910"
    note: "sightingLogs store (v23); player attrs (age/skin/hair…); accessoryInventory firstSeenAt/lastSeenAt/timesSeen"
trust_tier: T3
confidence: High
review_notes: "§1.5 'Variable' tier — user-rated reliability; MUST never override hard action evidence. firstSeenAt/lastSeenAt/timesSeen are existing provenance stamps to unify into the model."
last_verified:
```

### Surface class: vendor_api — External capture

#### SRC-005 — Ignition WebSocket auto-capture
```yaml
source_id: SRC-005
name: "Ignition Casino WebSocket stream (via MV3 extension)"
type: external_capture
surface_class: vendor_api
source_evidence:
  - file: src/hooks/useSyncBridge.js
    lines: "16-27"
    note: "postMessage bridge → saveOnlineHand()"
  - file: ignition-poker-tracker/shared/hand-format.js
    lines: "—"
    note: "wire parse; validated by wire-schemas.js"
trust_tier: T2
confidence: High
review_notes: "Ignition is vendor-of-record for what happened at the table (T2 at source). On parse into SRC-001 it DERIVES to T4 (see chain map). Note: prior validator over-rejection dropped ~20% of live updates (fixed 2026-06-14) — capture completeness is a known historical risk."
last_verified:
```

### Surface class: derived — Computed model layers (Derived class; OUTPUTS, never inputs)

#### SRC-006 — Range profiles (Bayesian posteriors per villain)
```yaml
source_id: SRC-006
name: "rangeProfiles store (169-cell posterior grids per position/action)"
type: computed_layer
surface_class: derived
source_evidence:
  - file: src/utils/rangeEngine/bayesianUpdater.js
    lines: "32+"
    note: "posterior = population prior (SRC-009) updated by observed actions (SRC-001) + showdown anchors (SRC-002)"
trust_tier: T4
confidence: High
review_notes: "Derived. Inherits the UNION of SRC-001 + SRC-002 + SRC-009 provenance. Tier downgrades to T4 on derivation. Stateless full-rebuild pattern."
last_verified:
```

#### SRC-007 — Tendency stats (VPIP/PFR/AF/3bet/cbet/folds)
```yaml
source_id: SRC-007
name: "derivePercentages() tendency stats (+ credible intervals)"
type: computed_layer
surface_class: derived
source_evidence:
  - file: src/utils/tendencyCalculations.js
    lines: "56-361"
    note: "read-time from SRC-001; intervals via credibleInterval() at 342-358"
trust_tier: T4
confidence: High
review_notes: "VERIFIED 2026-07-31 — ⚠ FINDING F2 IS NOW CLOSED; the draft's note was STALE. Credible intervals DO render: `TendencyStatsCard.jsx` shows the ±X.X% interval (SPR-017) and `PlayerAnalysisPanel.jsx:178` carries a collapsed-by-default credible-interval summary (SPR-063 / WS-135). Both WS-116 and WS-135 shipped after the 2026-06-19 baseline. Residual: the interval is rendered on the tendency surfaces but DP-005 (hero equity) still shows a bare point estimate — see the chain map."
last_verified: 2026-07-31
```

#### SRC-008 — Exploit outputs + villain decision model
```yaml
source_id: SRC-008
name: "weaknesses / exploit suggestions / villain decision model"
type: computed_layer
surface_class: derived
source_evidence:
  - file: src/utils/exploitEngine/generateExploits.js
    lines: "—"
    note: "from SRC-006 + SRC-007 + decision buckets; persisted as player.exploitBriefings (v10)"
  - file: src/utils/exploitEngine/villainDecisionModel.js
    lines: "—"
    note: "in-memory only; rebuilt per analysis (no persisted modelVersion/timestamp — Finding F6)"
trust_tier: T4
confidence: High
review_notes: "The 'Read' frame output. ExploitList EvidencePanel DOES show n + consequence + tier + source label (best-attributed surface). Missing: which specific hands, recency decay."
last_verified:
```

#### SRC-010 — Prediction ledger (PMC)
```yaml
source_id: SRC-010
name: "predictionAudit (field on hand records, v25)"
type: computed_layer
surface_class: derived
source_evidence:
  - file: src/utils/persistence/predictionAuditWriter.js
    lines: "5, 22, 42"
    note: "modelVersion = range-${PROFILE_VERSION}+engine-${ENGINE_VERSION}; {predictedDistribution, observedAction, modelVersion}"
  - file: src/utils/persistence/migrations.js
    lines: "977-992"
    note: "v25 — predictionAudit added as a FIELD on hands records (PMC Phase 5a / WS-177)"
trust_tier: T4
confidence: High
review_notes: "⚠ Finding F5 CONFIRMED STILL OPEN 2026-07-31: it is a FIELD on hands (migrations v25), not a store → no index for aggregate predicted-vs-observed reads (cursor walk required). VERIFIED: BROKEN POINTER FIXED — the draft cited `src/utils/predictionAudit/predictionAuditWriter.js`; the writer lives in `src/utils/persistence/`, and `src/utils/predictionAudit/` now contains only `reconstruct.js`. STANDING NOTE: capture ships and nothing reads it back — this is the repo's clearest shipped-but-inert capability, and it is also the cheapest existing input to a compliance-vs-outcome measurement (which decision did hero actually follow), so it is load-bearing for any 'is the engine profitable when applied' claim."
last_verified: 2026-07-31
```

### Surface class: reference_data — the Field & (planned) Equilibrium frames

#### SRC-009 — Population priors (the Field frame) ⚠ HEADLINE FINDING
```yaml
source_id: SRC-009
name: "Population priors: STAT_PRIORS, POP_CALLING_RATES, FACED_RAISE_RATE, STYLE_PRIORS, POPULATION_PRIORS"
type: static_prior
surface_class: reference_data
source_evidence:
  - file: src/utils/exploitEngine/bayesianConfidence.js
    lines: "25-35"
    note: "STAT_PRIORS Beta(α,β) per 9 stats; pseudocount 10"
  - file: src/utils/rangeEngine/populationPriors.js
    lines: "25-57"
    note: "FACED_RAISE_RATE / frequencies per position; PRIOR_WEIGHT=10"
  - file: src/utils/exploitEngine/gameTreeConstants.js
    lines: "124-132"
    note: "POP_CALLING_RATES / POP_BETTING_RATES per bucket"
  - file: src/utils/exploitEngine/villainModelData.js
    lines: "94-132"
    note: "POPULATION_PRIORS / STYLE_PRIORS per style label"
trust_tier: T4
confidence: High
review_notes: "FINDING F1 (headline). ORIGIN ANSWERED 2026-06-19: these are the FOUNDER'S INFORMED ESTIMATE of the live 1/2 pool (not a dataset). Honest stamp = 'founder estimate', trust = author-estimate (not a measured baseline). VERIFIED 2026-07-31 — WS-235 SHIPPED, BOTH STEPS; the draft still described them as a plan. (1) Attribution closed: explicit PROVENANCE blocks now sit on the constants themselves — `bayesianConfidence.js:36-47` and `populationPriors.js:8-10, 86` both name SRC-009 and state 'FOUNDER ESTIMATE … NOT a measured dataset'. (2) The empirical baseline exists: `poolBaseline.js` (369 lines), hierarchical estimate→pool→per-villain with the leave-one-out guard. RESIDUAL, recorded at the source: `bayesianConfidence.js:45` states the preflop fold/limp/open trees remain PURE founder estimate — the empirical layer does not cover them. ⚠ POOL-IDENTITY DRIFT: this estimate is of a live **1/2** pool. The founder's play is now live **1/3 at Wind Creek** (SRC-014). Different stake, different pool; the estimate has not been restated for it and should not be silently treated as the 1/3 prior. GUARD (unchanged): prior = pool AGGREGATE; never shrink a villain toward a baseline built from that same villain (circularity)."
last_verified: 2026-07-31
```

#### SRC-011 — HandHQ imported online pool aggregates (Reference tier)
```yaml
source_id: SRC-011
name: "HandHQ Reference-tier online pool aggregates (HANDHQ_REFERENCE_STAKES + PER_STAT_PRIOR_WEIGHT)"
type: static_import
surface_class: reference_data
source_evidence:
  - file: src/utils/exploitEngine/handhqReferencePool.js
    lines: "1-45"
    note: "GENERATED module — 7 stakes × {6max, full} × 6 stats (k, n) pairs; 12.9M imported hands"
  - file: scripts/generate-handhq-reference.mjs
    lines: "1-40"
    note: "Deterministic codegen from C:/Users/chris/data/phh-mining/out/combined.json (WS-262 mining)"
  - file: src/utils/exploitEngine/poolBaseline.js
    lines: "1-60"
    note: "Consumed by resolveStatPriors as the reference stage; resolveReferenceCounts is the online-only choke point"
trust_tier: T4
confidence: High
review_notes: "WS-262/WS-263 (2026-07-25). CORPUS: uoftcprg/phh-dataset HandHQ subset — 21.6M real-money online NLHE cash hands, 6 networks, 25NL–1000NL, July 2009 (CC-BY 4.0; licensing clean). Imported buckets total 12.9M hands (6max+full; short/HU excluded). MEASURED reference (unlike SRC-009's founder estimate) — but STALENESS is real (2009 era): self-limiting because PER_STAT_PRIOR_WEIGHT (10–35, method-of-moments on between-player overdispersion) makes it a deliberately weak prior any observed data quickly overrides. RULES: online numeric-stake segments ONLY (founder-ratified live/online separation, domain spec 2026-07-22); nearest-stake by log distance with ties to lower — micro segments below the 25NL floor use 25NL (GAP: founder's 0.02/0.05 games have no exact-stake data; recorded here honestly); seat bucket (6max vs full) picked per villain from dealt-in tallies, segmentKey stays 2D (founder decision 2026-07-25). foldTo3Bet mirrors the app's CURRENT quirk definition (folds facing any raise) — comparable today; if WS-254 changes the definition, re-mine and regenerate. Blend order: founder-observed pool > imported reference > founder estimate — a re-aggregation with observed hands would be a trust-tier upgrade through the chain (violation)."
last_verified: 2026-07-25
```

#### SRC-012 — HandHQ RAW hand corpus (backtest input) ⚠ SHARES ORIGIN WITH SRC-011
```yaml
source_id: SRC-012
name: "HandHQ raw hand records (phh-dataset) — the backtest/scoring corpus"
type: external_corpus
surface_class: reference_data
source_evidence:
  - file: scripts/backtest/corpusFiles.mjs
    lines: "DEFAULT_CORPUS_ROOT"
    note: "C:/Users/chris/data/phh-dataset/data/handhq — 1,756 files as of 2026-07-31"
  - file: scripts/backtest/leakageGuard.mjs
    lines: "REFERENCE_DISABLED"
    note: "the 'none' sentinel that forbids scoring this corpus with a table mined FROM it"
  - file: scripts/backtest/partition.mjs
    lines: "—"
    note: "WS-259 two-level split: POOL/EVAL player partition AND walk-forward in time"
trust_tier: T3
confidence: High
review_notes: "ADDED 2026-07-31. Registered SEPARATELY from SRC-011 even though both come from the same underlying HandHQ data, BECAUSE they do: SRC-011 is the AGGREGATED import that ships as a prior inside the app; SRC-012 is the RAW hand stream the backtest scores against. That shared origin IS the leakage vector — scoring the engine on SRC-012 while its priors were mined from SRC-011 is grading a model on its own training data, and it is invisible unless both are registered and the relationship is stated here. This is precisely what `--reference none` / REFERENCE_DISABLED exists to block, and why WS-259's split is structural rather than advisory. RULE: any measurement using SRC-012 must state its reference table and its partition, or the number is not admissible. STALENESS: July 2009, online, 25NL-1000NL — an era and a game type, and NOT the founder's live 1/3 pool. Structural claims may transfer (WS-285); VALUE claims (a hero-EV edge) may not — that separation is unresolved and is flagged on WS-287."
last_verified: 2026-07-31
```

#### SRC-013 — GTO / Equilibrium frame ⚠ DOES NOT EXIST YET
```yaml
source_id: SRC-013
name: "Imported solver output (the Equilibrium frame)"
type: planned_import
surface_class: reference_data
source_evidence:
  - file: src/utils/pokerCore/rangeMatrix.js
    lines: "200-204"
    note: "PREFLOP_CHARTS — labelled 'GTO-approximate' but are STATIC PUBLISHED CHART STRINGS, not solves"
trust_tier: "n/a — unbuilt"
confidence: n/a
review_notes: "ADDED 2026-07-31, registered deliberately AS ABSENT so it cannot be silently claimed. The architecture charter (§1, §6) decided GTO = imported solver outputs. There is still NO store, NO ingestion, NO schema. Finding F3 stands: `PREFLOP_CHARTS` carry no solver version, stack depth, or spot coverage, so they are a SECOND FIELD-STYLE REFERENCE, not an equilibrium anchor — do not let them masquerade as one, and do not let a 'GTO shape' comparison be built on them without saying so. When this is built it must arrive with solver identity, stack depth, rake model and spot coverage, because an equilibrium claim is only meaningful relative to the game that was solved."
last_verified: 2026-07-31
```

#### SRC-014 — Live venue pool (founder's own play) ⚠ THE ONLY UNCONTAMINATED TEST SET
```yaml
source_id: SRC-014
name: "Live cash pool — Wind Creek 1/3 (founder-recorded hands + sessions)"
type: internal_db
surface_class: internal_db
source_evidence:
  - file: src/utils/persistence/handsStorage.js
    lines: "414-446"
    note: "manual hands leave source undefined — live hands are currently identified by ABSENCE of a source stamp"
trust_tier: T3
confidence: Medium
review_notes: "ADDED 2026-07-31. Registered because it is about to carry weight it has never carried before, and because it has a defect today. DEFECT: live hands are distinguished only by `source` being UNDEFINED (SRC-001 stamps 'ignition' for online and nothing for manual). Absence-as-identity does not survive a third source, and this repo is about to have several — a live hand and an un-stamped import are indistinguishable. Give live capture a positive stamp INCLUDING VENUE AND STAKE before any new ingest path lands. WHY IT MATTERS DISPROPORTIONATELY: nothing was mined from this pool, so it is the only test set in the repo that a corpus-mined prior cannot leak into — which makes it the statistically cleanest validation target for a hero-EV claim, not merely the most personally relevant one. WEAKNESS: volume. It is the smallest source by orders of magnitude, so it earns its keep as an unbiased CORRECTION to a corpus-derived shape rather than as a standalone estimate. Note volume and relevance are DIFFERENT AXES and must not be collapsed into one 'quality' score: SRC-012 is high-volume/low-relevance, SRC-014 is low-volume/high-relevance, and a single scalar would hide exactly the trade being made."
last_verified: 2026-07-31
```

#### SRC-015 — Readiness + hero-EV evidence artifacts
```yaml
source_id: SRC-015
name: "Model-readiness scorecard, hero-EV runs, and the mined behavior policy"
type: derived_artifact
surface_class: derived
source_evidence:
  - file: docs/domain/readiness/scorecard-history.yaml
    lines: "—"
    note: "append-only run history; C1-C3/C6 read from here. A row without a `source` is inadmissible by its own rule."
  - file: docs/domain/readiness/overturn-ledger.yaml
    lines: "—"
    note: "C4/C5 evidence"
  - file: out/behavior-policy.json
    lines: "—"
    note: "mined pi_pool — the DENOMINATOR of every hero-EV importance weight"
trust_tier: T4
confidence: High
review_notes: "ADDED 2026-07-31. These artifacts now gate a founder decision (whether to stop building and start studying), which makes them claim-bearing and therefore registrable. THE BEHAVIOR POLICY IS THE SUBTLE ONE: pi_pool is the denominator of every importance weight in the hero-EV estimate, so an unstated or stale policy silently decides the result — which is why run-hero-ev.mjs REFUSES to run without `--behavior-policy` named explicitly. It is mined from SRC-012 and inherits its staleness. CURRENT STATE 2026-07-31: C3 reads edge +12.042 with CI low -7.5973, from a 250-decision SMOKE run over 9 player-clusters. That is a smoke result and must not be quoted as a validated edge — the scorecard row says so, and the distinction is exactly what this registry exists to preserve."
last_verified: 2026-07-31
```

---

## Sources NOT covered (engine self-flagged gaps)

- **GTO / Equilibrium frame** — promoted to a registered-but-absent entry, **SRC-013**, so the gap is tracked rather than merely noted. Finding F3 stands.
- **Ignition HUD parallel stats engine.** `ignition-poker-tracker/shared/stats-engine.js` computes VPIP/PFR independently and **does NOT use the main app's Bayesian intervals** — raw percentages, no sample size shown. ⚠ Finding F7: attribution gap on the live surface; a second, un-stamped computation path for the same numbers.
- **Out-of-model internal_db stores (not registered individually — not part of the Exploit Model chain):** activeSession, settings, tournaments, playerDrafts, preflopDrills, postflopDrills, villainAssumptions, subscription, exploitAnchors/anchorObservations/anchorCandidates, perceptionPrimitives, userRefresherConfig/printBatches, telemetryConsent, heroLeaks, playerPhotos, shapeMastery/shapeLessons. All internal_db (T3). Register on demand if they later feed a displayed model value.

---

## Promotion checklist — closed 2026-07-31
- [x] F1: attribute/replace the uncited population priors (SRC-009) — **WS-235 shipped both steps**; provenance blocks are on the constants, `poolBaseline.js` supplies the empirical layer. Residual: preflop fold/limp/open trees remain pure estimate.
- [x] Confirm SRC-005 Ignition = T2-source / T4-derived split — held; see chain map DP-008.
- [x] Confirm SRC-002 showdown reveals keep a distinct 'Certain' stamp — held, and a selection warning added.
- [x] Set `last_verified` on each promoted source.
- [x] Accept or fill the GTO-frame gap before claiming an Equilibrium reference — **accepted as a registered absence (SRC-013)**; an Equilibrium claim is blocked until it is built.

## Open, carried forward (not promotion blockers)

| Ref | Gap | State 2026-07-31 |
|---|---|---|
| F2 | Credible intervals invisible | **CLOSED** — WS-116 + WS-135 shipped; residual on DP-005 hero equity |
| F4 | Hero $ has no volume/variance weighting | **OPEN** — now load-bearing for the readiness gate |
| F5 | Prediction ledger is a field, not a store | **OPEN** — capture ships, nothing reads it |
| F6 | Villain model has no persisted version/timestamp | **OPEN** — confirmed absent in `villainDecisionModel.js` |
| F7 | HUD parallel stats engine, no sample shown | **OPEN** |
| — | Live hands identified by ABSENCE of a source stamp | **OPEN, newly raised** — see SRC-014; fix before the next ingest path |
| — | Two PnL computation sites | **OPEN, newly raised** — see SRC-003 |

## Maintenance

Drift against this file is the responsibility of `prog-data-provenance`. Re-run the
`provenance-audit` engine when: a new data source is added, a store gains a migration, an
evidence pointer moves, or a displayed number changes its computation path. Three pointers
had already rotted between the 2026-06-19 baseline and the 2026-07-31 verification pass —
this file decays silently unless something is accountable for it.
