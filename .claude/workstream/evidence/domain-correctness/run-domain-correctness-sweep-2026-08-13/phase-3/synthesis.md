# Phase 3/4 — Facilitator synthesis (roundtable-facilitator, fresh-context dispatch)
Run: run-domain-correctness-sweep-2026-08-13 | Window: 5aa1419..HEAD | Captured verbatim from agent final output.
Facilitator spot-verified 9 load-bearing claims directly against HEAD before synthesis; all 9 held.

## Synthesis

### Consensus (3+ independent lenses, high confidence)

| # | Finding | Lenses | Facilitator verification |
|---|---|---|---|
| C1 | `onFastResult` has zero production callers; both live hooks block on full refinement | product-ux, failure, senior, perf (4) | Confirmed — `computeHelpers.js:251`, `useActionAdvisor.js:59` pass neither `onFastResult` nor `refinementBudgetMs`. Because `onFastResult` is null, `yieldToHost()` at `gameTreeEvaluator.js:1507,1517` never fires — the whole evaluation is one uninterrupted synchronous block with zero paint opportunity. |
| C2 | Depth/partiality metadata (`depthReached`, `weightConsumed`, per-stage `ran/partial/gated/error`) computed and read by no rendered surface, violating DEC-036's own required-reading rule | product-ux, failure, perf (3) | Confirmed by grep; `depthReached` reaches only the Ignition HUD D1/D2 pill. |
| C3 | Shipped-but-inert instruments — 3 new instances this window: `rakeResolver.tier/reason`, `unexploitableFloor.deriveFloor`, `equityOperator`/`equitySkew` | failure, senior, product-ux, architect (4) | Confirmed. Zero non-test importers of equitySkew/equityOperator; both rake call sites destructure `rake.rakeConfig` only (`OnlineAnalysisContext.jsx:59`, `PlayerAnalysisPanel.jsx:126`). |
| C4 | `style` residue survives WS-436 in two reattachment sites | architect, senior, failure, security (4) | Confirmed. `drillModeEngine.js:803-809` (dead field + stale comment citing deleted STYLE_FOLD_DEFAULTS, lands on 0.45 baseline); `modelAudit.js:114` documented + regression-tested → cosmetic. |
| C5 | Both game-tree hotspots grew past any prior split threshold with no decomposition entry | architect, senior | Confirmed: gameTreeEvaluator.js 1922 LOC, gameTreeDepth2.js 1721, foldEquityCalculator.js 799, villainDecisionModel.js 801. |

### Disagreements — forced resolution

**D1. Is refinement wall-clock gated (non-reproducible) at HEAD?** Failure-engineer KC1 and product-ux HR1 say yes; performance-engineer says no. **RESOLVED — performance-engineer is correct.** Re-verified independently: `gameTreeEvaluator.js:987-998` sets `budgetUnits = refinementBudgetMs * REFINEMENT_UNITS_PER_MS` and `isBudgetExceeded = () => refinementBudgetMs <= 0 || workMeter.used > budgetUnits`. Remaining `Date.now()` calls (:903, :1044, :1347, :1422) are diagnostic timers. Two fresh-context lenses reproduced a 2026-08-05 evidence file past the commit that fixed it — the recall-not-derive failure occurring inside the protocol.

**D2. Is depth-2/3 reaching the live surface a defect or a decision?** **RESOLVED as drift.** DEC-036 (`system/decisions.md:834`) records "the refined answer reaches no screen yet; wiring is Phase C and design-gated." False as shipped: every `await evaluateGameTree(...)` returns the refined result by default. The design gate protects the *fast* answer (harmless) and not the *refined, WS-361-unvalidated* answer (consequential). Problem class 8.

**D3. Confidence badge severity.** **RESOLVED: not new drift, do not re-file.** FIND-049 / WS-394 already cover it. New aggravation record: `villainDecisionModel.js` touched 16× in-window including the `source`-emitting lines (:533,:549,:562,:575,:583) without fixing the vocabulary mismatch. Attach as evidence to FIND-049.

**D4. Magnitude of inert-code finding.** **RESOLVED: pattern stands (4th recorded instance, MO-9), magnitude corrected** to ~660 hand-written inert lines + a zero-runtime-cost generated data file (never reaches bundle).

**D5. Journal widening.** **RESOLVED at MEDIUM: deliberate-but-uncompensated.** WS-358's widening was the right fix for unbounded money-hand loss; the missing piece is the compensating control (TTL/purge), recorded in no ADR.

**D6. Product-ux "~2.4s per decision".** **RESOLVED: desktop-derived arithmetic, not a measurement.** Correct claim: unmeasured, plausibly seconds-scale on target hardware. Cross-ref FIND-109.

### Highest-risk unknowns (need new measurement)

1. **Net direction of the pot-odds defect on the depth-1→depth-2 delta.** The four wrong-formula sites harm in opposite directions. WS-378's "38 of 40 flips toward passivity" was measured *through* this defect — whether passivity drift is a property of depth-2 or an artifact of the formula is unresolved and must be re-measured after the fix.
2. **Wall-clock cost of a full unit-budget refinement on the Galaxy A22/S22.** No on-device measurement exists. Expands FIND-109.
3. **Whether more refinement produces a better answer.** FAULT-refinement-depth-non-monotonicity, composite 0.300, untested.
4. **`backfillOnlineStakes` derivation correctness** — persists derived stakes and never revisits (self-healing = self-sealing). Nobody checked the derivation.
5. **Reachability of the zero-combo range state** (`gameTreeContext.js:311`).
6. **Per-file test coverage density** of the two game-tree hotspots after +2,150 lines.
7. **Facilitator open question:** `gameTreeDepth2.js:1707` — `raiseEV` nets no rake at all, three lines below a correctly raked `callEV`. Flagged inside the rake finding.
8. **Facilitator open question:** `exportUtils.js` calls `clearAllData()` at the top of `importAllData` — user scope unestablished; interacts with FIND-103.

### Ranked systemic weak points

1. Villain/hero required-equity re-derived inline with the wrong formula wherever `foldEquityCalculator` is not imported (4 new sites + 1 documented). Blast radius: every depth-2/3 branch + every current-node river decision.
2. EV correctness instruments ship complete, tested, and unreachable (MO-9 LIVE; 4th/5th/6th instances this window). A known-wrong live constant (`villainObservations.js:69` blindDefendMax:25) coexists with its correct unused replacement.
3. Rake applied as flat post-hoc subtraction at stage level, taxing fold-branch mass — river functions in the same file do it right, so inconsistency, not design position.
4. Final argmax is raw EV with no confidence/completeness term; depth-2 undiscounted while depth-3 is discounted.
5. Uncertainty measured everywhere, rendered nowhere — every uncertainty quantity stops one hop short of a surface.
6. `userId` threading by convention, not mechanism — recurring in the very commit written to close it.
7. Doc/record currency has no gate — SYSTEM_MODEL 95d past its own 30d threshold, edited 6× in-window.

## Re-rulings

- **FIND-051 / WS-389 — RE-RULE: non-determinism component RESOLVED at HEAD** (logical work-unit gate, `refinementWork.js`, WS-432 / 52d0cae4; facilitator-verified). WS-389 as titled superseded by WS-432 → close with pointer. Residual (depth stamped into result + Result Card manifest, monotonicity test) re-homed on WS-364/WS-403/FIND-075. **Do not close WS-403** — cap-against-total survives the unit conversion (`refinementWork.js:117-124` verified).
- **Memory `project_advice_depth_tracks_machine_load.md` — STALE, must be rewritten.** It contaminated two Phase-1 lenses this run. Highest-value cheap action in the sweep.
- **FIND-076 — EXPANDS:** `yieldToHost()` is dead code because it is gated on `onFastResult` non-null; the only yield point in the engine is unreachable.
- **FIND-075 — EXPANDS:** `weightConsumed` ignored at ranking for depth-2 while honored for depth-3 (`gameTreeEvaluator.js:1659,:1694-1700,:1785,:1839` vs `:1896-1899`).
- **FIND-049 / WS-394 — EXPANDS** with aggravation record only (D3).
- **FIND-109 — EXPANDS and RE-WEIGHTS UPWARD:** WS-432 eliminated the correctness half and left latency as the sole exposure, made worse (unit budget consumed in full deterministically). `REFINEMENT_UNITS_PER_MS = 319` desktop-only.
- **WS-380 already covers run-strategy-profile.mjs unguarded corpus read — DO NOT FILE** (security lens rediscovered an open ticket).
- **WS-448 — ADD A SITE:** `drillModeEngine.js:803-809` is the same style-residue class at a new site.
- **WS-337 — EXPANDS:** equityOperator/equitySkew shipped ahead of their own ticket with zero importers.
- **MO-9 — RE-RULE `GUARDED` → `LIVE`:** three new instances in one window.

## Proposed findings (registered as FIND-112..FIND-126 by orchestrator; full text in findings/FIND-1NN.yaml)

1. CRITICAL — caller's required equity computed with bluffer's breakeven formula at 4 sites in gameTreeDepth2.js (:445,:639,:1549,:1656; internally contradicts its own EV formula at :644; correct shared impl exists unimported at foldEquityCalculator.js:378-400). Contaminates the scored figure AND specifically the depth-ablation deltas (WS-378's passivity result measured through it). → FIND-112 / WS-450
2. HIGH — depth-2/3 stage rake is one flat subtraction taxing the fold branch (:785/790,:926/930,:1039/1042,:1439/1449; §11.3 violation; river functions in same file correct; depth-3 rake computed on the wrong pot; :1707 raiseEV nets no rake). → FIND-113 / WS-451
3. HIGH — rakeResolver tier/reason read by nothing; estimateRake treats unknown ≡ none (potCalculator.js:447). → FIND-114 / WS-452
4. HIGH — river hero-raise priced against BET population, not RAISE (comboActionProbabilities hardcodes 'bet'; raise machinery exists unused; §11.1a). → FIND-115 / WS-453
5. HIGH — partial depth-2 undiscounted at final ranking while depth-3 discounted; argmax raw EV. → FIND-116 / WS-454
6. HIGH — import creates players/sessions under guest while hands correctly scoped (exportUtils.js:212/:224 vs :240-244; WS-368 wired 1 of 3 entity types). → FIND-117 / WS-455
7. HIGH — decisionRecord.mjs close() silently drops unparseable lines from contentHash; presents truncated capture as complete (vs atomStore.mjs discipline). → FIND-118 / WS-456
8. MEDIUM — per-combo equity baseline computed then `void`-discarded; flat POPULATION_PRIORS.bet.fold used; comment claims the opposite (gameTreeDepth2.js:373-377). → FIND-119 / WS-457
9. MEDIUM — empty villain range produces plausible coin-flip rec (heroEquity=0.5, foldPct=0) with no distinct state (gameTreeContext.js:311-333; same shape 4 sites in gameTreeDepth2). → FIND-120 / WS-458
10. MEDIUM — OnlineStakesBackfill ungated sequential IDB pass every launch, no completion flag; derivation never revisited (self-sealing). → FIND-121 / WS-459
11. MEDIUM — extension hand journal (chrome.storage.local) has no TTL/purge/retention bound; deliberate widening uncompensated. → FIND-122 / WS-460
12. MEDIUM — SYSTEM_MODEL.md 95d past own 30d threshold; omits standardOfRecord/ (49 files) + its coupling edge; hotspot ratings stale. → FIND-123 / WS-461
13. LOW — drillModeEngine dead style:'reg' field under comment citing deleted table. → FIND-124 (fold into WS-448, no new item)
14. LOW — seatPricing.js (179 lines, new) has no direct test file. → FIND-125 / WS-462
15. LOW — phase-1 MC refinement failure path writes console.warn, never the stage ledger (gameTreeEvaluator.js:1150-1179; same shape gameTreeContext.js:360-362). → FIND-126 / WS-463

## Structural improvements (things to BUILD)

- **S1. Reachability gate in CI** — every exported symbol under src/utils/ has a non-test importer or an `@inert-until WS-NNN` annotation with expiry. Kills the shipped-but-inert class (6 recorded instances). Effort M. → WS-464
- **S2. One required-equity seam** — import villainRequiredEquity at all 5 violation sites + CI grep ban on inline pot-odds arithmetic in exploitEngine/ + closed-form known-answer tests. Folded into WS-450.
- **S3. Per-branch rake helper + fold-branch invariance test** (fold EV bit-identical with rake on/off). Folded into WS-451.
- **S4. Completeness-aware ranking + rendered depth/completeness signal** on LiveAdviceBar. Folded into WS-454 (engine half); display half cross-ref FIND-075/084 items.
- **S5. userId-threading CI gate** (grep gate on bare createPlayer/createSession/saveHand). Folded into WS-455.
- **S6. Doc-currency gate in smart-test-runner.sh** reading the frontmatter SYSTEM_MODEL already declares. Folded into WS-461.
- **S7. Generated-artifact drift checks** (hash-vs-regeneration for equitySkewDecomposition.js, handhqReferencePool.js). → WS-465
- **S8. On-device refinement calibration + worker offload for gameTreeDepth2** (TD-07/08 now live). Expands FIND-109; accommodation question for founder recorded: lowering mobile budget is cheaper but its correctness direction is unknown (FAULT-refinement-depth-non-monotonicity untested) — should not be taken before the measurement exists.

## System model updates (filed as WS-461 work content)

1. Frontmatter: advance last-verified-against-code or record failing.
2. §1.1: add standardOfRecord/ (49 files).
3. §1.2: add edge standardOfRecord/layerProbes.js:55 → exploitEngine/calibrationMetrics.
4. §5.2: update LOC (1922/1721/799/801); remove "Low priority — working, well-tested" rating.
5. §6.1: add fan-in entries populationPriors (22), gameTreeConstants (16), villainModelData (13).
6. §6.1: add rakeResolver tier/reason unconsumed channel + unknown≡none collapse.
7. §2.3: replace wall-clock description with WS-432 logical work-unit meter; note WS-403 cap survives.
8. §7.1/§10: retire "26s wet flop" as operative figure; wall time on target hardware unmeasured (FIND-109).
9. §11: TD entries — game-tree decomposition, seatPricing test gap, worker offload re-rated live.
10. §9.3: record standardOfRecord/ vs decisionSystems/ boundary decision.
11. Outside SYSTEM_MODEL: rewrite project_advice_depth_tracks_machine_load.md (done by orchestrator this run).

## Sweep verdict

DRIFT-FOUND — 1 CRITICAL, 6 HIGH, 5 MEDIUM, 3 LOW new; 6 expansions; 1 re-ruling (FIND-051 non-determinism component resolved by WS-432, verified independently at HEAD). The single most consequential finding is the pot-odds formula defect (FIND-112): it runs in the depth-2/3 arm and not the depth-1 arm, so the project's headline depth-ablation result — WS-378's "80% of river top-action flips, 38 of 40 toward passivity" — was measured through a formula error whose four sites push in opposite directions. That result is load-bearing for the depth-validation gate (WS-361), RC-depth-ablation, and the founder's read of whether deeper search helps; it cannot be trusted or distrusted until the formula is fixed and the ablation re-run. The file contradicts itself three lines apart (:639 threshold vs :644 EV formula), so this is unambiguous. Procedural evidence: gameTreeDepth2.js was the largest single diff in the window, no Phase-1 lens read its internals, the failure-engineer declared that gap honestly, and the 7th targeted dispatch found the CRITICAL — the declared gap was worth more than any lens's confident coverage.

What genuinely improved this window: WS-432's logical work-unit clock (real correctness win, closing FIND-051's non-determinism half); the rake fix 24d14aed reaching the live path; WS-371's fold-quantity fix threaded into both consumers with relabeled user-facing text; WS-292 holdingKnowledge basis discipline holding structurally; INV-08 layer boundaries holding in all four directions; scripts/backtest isolation holding; WEAKNESS_EXPLOIT_MAP not resurfacing; WS-436 style removal holding on every live decision path bar two inert reattachment sites. Counter-observation: WS-432 converted a correctness risk into a latency risk on a device nobody has measured, and two independent fresh-context agents still reported the pre-fix state as current because the evidence file that says so is younger in their context than the commit that fixed it.
