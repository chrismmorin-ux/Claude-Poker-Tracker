# Provenance Chain Map — DRAFT

> **Status:** Draft — `provenance-audit` engine (baseline run) · **Generated:** 2026-06-19 · **Run ID:** run-2026-06-19-provenance-baseline
> **Cross-references:** `docs/provenance/data-source-registry.draft.md`
>
> **Draft — review every chain before promoting.** Promote with:
> ```
> mv docs/provenance/provenance-chain-map.draft.md docs/provenance/provenance-chain-map.md
> ```
> **Monotonicity verified:** an inline cross-check walked every chain below; no step upgrades trust tier (the load-bearing invariant). All Derived stats settle at T4. Hero PnL stays T3 (same-source arithmetic). Independent failure-engineer cross-check available on request.

---

## Data points

### DP-001 — Villain VPIP % (and PFR/AF, same chain)
```yaml
data_point_id: DP-001
label: "VPIP %"
displayed_at: { file: src/components/views/StatsView/StatsView.jsx, lines: "162", surface: view }
chain:
  - step: source
    source_id: SRC-001
    tier_at_step: T3
    file: src/utils/persistence/handsStorage.js:getAllHands
  - step: ingest
    file: src/utils/handAnalysis/handTimeline.js:buildTimeline
    transform: "actionSequence normalized to primitive timeline"
    tier_at_step: T3
  - step: derive
    file: src/utils/tendencyCalculations.js:308-361
    transform: "vpipCount/handsSeenPreflop → round(%); credibleInterval() computed but NOT returned to UI render"
    tier_at_step: T4
  - step: display
    file: src/components/views/StatsView/StatsView.jsx:162
tier_at_display: T4
confidence: High
review_notes: "⚠ F2 — sampleSize IS shown (StatsView.jsx:158) but the credible interval is computed and discarded at the UI. The displayed number carries count-attribution but not weight/uncertainty."
last_verified:
```

### DP-002 — Style label (Fish/Nit/LAG/TAG/Reg/LP)
```yaml
data_point_id: DP-002
label: "Style label"
displayed_at: { file: src/components/views/StatsView/StatsView.jsx, lines: "99", surface: view }
chain:
  - step: source
    source_id: SRC-001
    tier_at_step: T3
    file: src/utils/persistence/handsStorage.js
  - step: derive
    file: src/utils/tendencyCalculations.js:287-302
    transform: "classifyStyle(vpip,pfr,af) — hardcoded thresholds (vpip>40→Fish…); requires MIN_STYLE_SAMPLE=20"
    tier_at_step: T4
  - step: display
    file: src/components/views/StatsView/StatsView.jsx:99
tier_at_display: T4
confidence: High
review_notes: "Thresholds are uncited population heuristics (relates SRC-009/F1). The label is the OUTPUT the PJX project tests for circularity — UI shows the label but not the sample/threshold it rests on."
last_verified:
```

### DP-003 — Exploit suggestion (star rating + confidence) — BEST-ATTRIBUTED
```yaml
data_point_id: DP-003
label: "Exploit suggestion + confidence tier"
displayed_at: { file: src/components/.../ExploitList.jsx, lines: "50-113 (EvidencePanel)", surface: view }
chain:
  - step: source
    source_id: SRC-006
    tier_at_step: T4
    file: src/utils/rangeEngine/bayesianUpdater.js
  - step: ingest
    source_id: SRC-009
    transform: "population prior (uncited) feeds the deviation baseline"
    tier_at_step: T4
    file: src/utils/exploitEngine/bayesianConfidence.js:25-35
  - step: derive
    file: src/utils/exploitEngine/generateExploits.js
    transform: "bayesianDeviationTest → posteriorProb → confidenceFromPosterior (strong/moderate/weak)"
    tier_at_step: T4
  - step: display
    file: src/components/.../ExploitList.jsx:50-113
tier_at_display: T4
confidence: High
review_notes: "Best provenance surface in the app: EvidencePanel shows n, consequence weight, Supported/Confirmed/Speculative tier, source label, showdown-corroboration flag. Missing: which specific hands, recency decay. Inherits SRC-009 uncited-prior risk."
last_verified:
```

### DP-004 — Villain fold % (live prediction) — BEST WEIGHT-BADGE
```yaml
data_point_id: DP-004
label: "Fold % (villain) + DATA/PARTIAL/EST badge"
displayed_at: { file: src/components/.../LiveAdviceBar.jsx, lines: "196 (val), 68-87 (badge)", surface: view }
chain:
  - step: source
    source_id: SRC-008
    tier_at_step: T4
    file: src/utils/exploitEngine/villainDecisionModel.js
  - step: ingest
    source_id: SRC-009
    transform: "style/population priors back the fold curve when personal n is thin"
    tier_at_step: T4
    file: src/utils/exploitEngine/villainModelData.js:94-132
  - step: derive
    file: src/utils/exploitEngine/foldEquityCalculator.js
    transform: "action rates → fold curve at current sizing; effectiveN gates badge"
    tier_at_step: T4
  - step: display
    file: src/components/.../LiveAdviceBar.jsx:196
tier_at_display: T4
confidence: High
review_notes: "The model's best 'weighted input' surface: badge = DATA (effectiveN≥15) / PARTIAL (n≥5) / EST; source = personalized vs style-based (FoldCurveTooltip:122). This is the attribution pattern to propagate to DP-001/002/005."
last_verified:
```

### DP-005 — Hero equity %
```yaml
data_point_id: DP-005
label: "Hero equity %"
displayed_at: { file: src/components/.../LiveAdviceBar.jsx, lines: "195", surface: view }
chain:
  - step: source
    source_id: SRC-006
    tier_at_step: T4
    file: src/utils/rangeEngine (villain range posterior)
  - step: derive
    file: src/utils/exploitEngine/gameTreeEquity.js
    transform: "MC/approx equity from villainRange + heroCards + board"
    tier_at_step: T4
  - step: display
    file: src/components/.../LiveAdviceBar.jsx:195
tier_at_display: T4
confidence: High
review_notes: "⚠ Point estimate with NO uncertainty indicator shown. Equity inherits the range posterior's confidence but the UI presents it as a hard number."
last_verified:
```

### DP-006 — Action recommendation (VALUE/BLUFF/CHECK/FOLD + sizing)
```yaml
data_point_id: DP-006
label: "Action recommendation + sizing"
displayed_at: { file: src/components/.../LiveAdviceBar.jsx, lines: "190-194", surface: view }
chain:
  - step: source
    source_id: SRC-008
    tier_at_step: T4
    file: src/utils/exploitEngine/villainDecisionModel.js
  - step: derive
    file: src/utils/exploitEngine/gameTreeEvaluator.js
    transform: "EV-max over villain range + equity + SPR + pot odds + fold model"
    tier_at_step: T4
  - step: display
    file: src/components/.../LiveAdviceBar.jsx:190-194
tier_at_display: T4
confidence: High
review_notes: "The recommendation label has no explicit evidence-quality link beside it (the DATA/PARTIAL/EST badge lives on the separate ConfidenceBadge). Reconnect recommendation ↔ evidence quality."
last_verified:
```

### DP-007 — Hero PnL / session result
```yaml
data_point_id: DP-007
label: "Session PnL ($)"
displayed_at: { file: src/components/.../SessionDetailModal.jsx, lines: "62", surface: view }
chain:
  - step: source
    source_id: SRC-003
    tier_at_step: T3
    file: src/utils/persistence (sessions store)
  - step: derive
    file: src/utils/sessionAnalytics.js:33-38
    transform: "cashOut - buyIn - rebuys - tip (same-source arithmetic — tier unchanged)"
    tier_at_step: T3
  - step: display
    file: src/components/.../SessionDetailModal.jsx:62
tier_at_display: T3
confidence: High
review_notes: "⚠ F4 — pure $ figure with NO hand-volume weighting / variance. No bb/100. A 1-hand and a 300-hand result render identically. Financial Resolution layer (charter §3) must add volume + variance attribution."
last_verified:
```

### DP-008 — HUD villain VPIP/PFR (Ignition side panel)
```yaml
data_point_id: DP-008
label: "Villain VPIP/PFR in live HUD"
displayed_at: { file: ignition-poker-tracker/shared/stats-engine.js, lines: "—", surface: cli_output }
chain:
  - step: source
    source_id: SRC-005
    tier_at_step: T2
    file: src/hooks/useSyncBridge.js:16-27
  - step: ingest
    file: ignition-poker-tracker/shared/hand-format.js
    transform: "wire → hand objects (parse/validate) — derive to T4"
    tier_at_step: T4
  - step: derive
    file: ignition-poker-tracker/shared/stats-engine.js:computePlayerStats
    transform: "raw VPIP/PFR % — PARALLEL engine, does NOT use main-app Bayesian intervals"
    tier_at_step: T4
  - step: display
    file: ignition-poker-tracker/shared/stats-engine.js
tier_at_display: T4
confidence: High
review_notes: "⚠ F7 — live HUD shows raw % with NO sample size and a separate computation path from the main app. Highest-stakes surface (live decisions) has the weakest attribution."
last_verified:
```

---

## Chains NOT covered (engine self-flagged gaps)

- **GTO/Equilibrium-anchored recommendations** — no chain exists because the Equilibrium frame is unbuilt (registry gap). Once GTO is imported, exploit chains (DP-003/004/006) gain a second source leg.
- **Weakness observations** (`PlayerAnalysisPanel.jsx:476-478`) — displayed with no visible n / triggering-hand link; chain traceable but attribution absent at the surface. Add when surfacing provenance.

## Promotion checklist
- [ ] Re-walk monotonicity (done inline; re-confirm on edit)
- [ ] Confirm SRC-005 T2→T4 parse step on DP-008
- [ ] Decide attribution surfacing for DP-001/002/005/007/008 (the F2/F4/F7 gaps)
- [ ] Set `last_verified` per chain at promotion
