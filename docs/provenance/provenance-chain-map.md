# Provenance Chain Map

> **Status:** PROMOTED 2026-07-31 · **Baseline:** 2026-06-19 (`provenance-audit`, run-2026-06-19-provenance-baseline)
> **Verification pass:** 2026-07-31 — chains re-walked against the code; corrections marked `VERIFIED 2026-07-31`.
> **Cross-references:** `docs/provenance/data-source-registry.md`
>
> **Monotonicity verified:** an inline cross-check walked every chain below; no step upgrades trust tier (the load-bearing invariant). All Derived stats settle at T4. Hero PnL stays T3 (same-source arithmetic).
>
> **What a chain is for.** A displayed number is only as good as the weakest step behind it, and
> the tier at display is not the tier at source. These chains exist so that a claim can be
> checked against its own support instead of against how confident it looks on screen. A chain
> that cannot be walked is a number that cannot be defended — see the registry's row-grain rule.

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
    transform: "vpipCount/handsSeenPreflop → round(%); credibleInterval() at 342-358"
    tier_at_step: T4
  - step: display
    file: src/components/views/StatsView/StatsView.jsx:162
tier_at_display: T4
confidence: High
review_notes: "VERIFIED 2026-07-31 — F2 IS CLOSED and this note was STALE. The interval is no longer discarded at the UI: `TendencyStatsCard.jsx` renders ±X.X% (SPR-017) and `PlayerAnalysisPanel.jsx:178` carries a collapsed credible-interval summary (SPR-063 / WS-135). sampleSize was already shown (StatsView.jsx:158). This chain now carries both count-attribution AND uncertainty at display."
last_verified: 2026-07-31
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
    file: src/utils/sessionStats/sessionAnalytics.js:38
    transform: "cashOut - buyIn - rebuys - tip (same-source arithmetic — tier unchanged)"
    tier_at_step: T3
  - step: display
    file: src/components/.../SessionDetailModal.jsx:62
tier_at_display: T3
confidence: High
review_notes: "VERIFIED 2026-07-31 — BROKEN POINTER FIXED: the derive step cited `src/utils/sessionAnalytics.js`, which no longer exists (moved to `src/utils/sessionStats/`). A SECOND computation of the same quantity lives at `src/utils/persistence/sessionsStorage.js:92,314` and is not part of any registered chain — two paths to one displayed number, the DP-008 pattern again. ⚠ F4 REMAINS OPEN: pure $ figure with NO hand-volume weighting / variance, no bb/100, so a 1-hand and a 300-hand result render identically. Newly load-bearing: this is the chain a realized-profitability claim would travel, and without volume it cannot even state the sample behind an edge — see registry SRC-015 on why realized results are the wrong readiness instrument."
last_verified: 2026-07-31
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

- **GTO/Equilibrium-anchored recommendations** — no chain exists because the Equilibrium frame is unbuilt (**SRC-013**, registered as absent). Once GTO is imported, exploit chains (DP-003/004/006) gain a second source leg.
- **Weakness observations** (`PlayerAnalysisPanel.jsx:476-478`) — displayed with no visible n / triggering-hand link; chain traceable but attribution absent at the surface. Add when surfacing provenance.
- **DP-009, the hero-EV / readiness chain — NOT YET WALKED.** Added as a known gap 2026-07-31.
  `SRC-012` (raw corpus) + `SRC-015` (mined behavior policy) → `heroEvRunner.mjs` → the C3 figure
  in `scorecard-history.yaml` → the founder's stop-building decision. This chain now terminates
  in a **decision rather than a pixel**, which is a class of chain the baseline audit did not
  model, and it crosses the SRC-011/SRC-012 shared-origin boundary that the leakage guard
  exists to police. It should be walked before C3 is quoted as validated.

## Promotion checklist — closed 2026-07-31
- [x] Re-walk monotonicity — held; no step upgrades tier.
- [x] Confirm SRC-005 T2→T4 parse step on DP-008 — held.
- [x] Decide attribution surfacing for DP-001/002/005/007/008 — **F2 closed** (DP-001); F4 (DP-007) and F7 (DP-008) remain open and are tracked in the registry's carried-forward table; DP-005 hero equity still shows a bare point estimate.
- [x] Set `last_verified` per chain at promotion.
