# Phase 1 — failure-engineer (fresh-context dispatch)
Run: run-domain-correctness-sweep-2026-08-13 | Window: 5aa1419..HEAD | Captured verbatim from agent final output.

### FAILURE ENGINEER

Scope covered: SYSTEM_MODEL.md, STATE_SCHEMA.md, POKER_THEORY.md (§1-§3.6.1, changelog through WS-436/2026-08-12), MEASUREMENT_OVERSIGHTS.md, exploitEngine/CLAUDE.md, rangeEngine/CLAUDE.md, pokerCore/CLAUDE.md, plus targeted `git diff 5aa1419..HEAD` reads of gameTreeEvaluator.js, gameTreeContext.js, decisionAccumulator.js, modelAudit.js, unexploitableFloor.js, rakeResolver.js, useLiveActionAdvisor.js, useActionAdvisor.js, PlayerAnalysisPanel.jsx, crossRangeConstraints.js, softWeights.js, populationPriors.js, preflopFoldQuantities.js, gameTreeEquity.js, drillModeEngine.js. Given the window's size (183 commits / 54k lines), this is a targeted sweep against the failure lens, not exhaustive file-by-file coverage.

#### Key Concerns (top 5)

1. **Refinement is wall-clock gated and non-reproducible, and the founder never sees which depth he got.** `gameTreeEvaluator.js` — `refinementBudgetMs = 2000` default, bailout on `Date.now() - refinementStart > timeBudgetMs`. Identical inputs produce different top actions depending on machine load (FIND-051, HIGH, open: NUTTED_UNCAPPED hero 33 on QJT returns RAISE at 60000ms budget, NOT-RAISE at the shipped 2000ms; 80% of top-action flips are depth-1→depth-2 and 38/40 move toward passivity — directionally systematic). `treeMetadata.latency` records per-stage `ran/partial/gated/error`, but **nothing on the consuming side reads it**.

2. **`onFastResult` — the whole WS-334 two-phase design — has zero production callers.** `gameTreeEvaluator.js:1446-1454` invokes it internally; `useLiveActionAdvisor.js` and `useActionAdvisor.js` never pass it. (FIND-076, MEDIUM, open.) Consequence: the `await evaluateGameTree(...)` call in both production hooks blocks for the full refinement window — up to the 2000ms budget, or up to **26s measured on a wet flop** (SYSTEM_MODEL §2.3/§7.1) when refinement isn't tightly capped. Availability failure at the table.

3. **Rake resolution can silently degrade to the exact pre-WS-333 defect, with no surface reporting it.** `src/utils/rakeResolver.js:142-206` returns `{ rakeConfig: null, tier: 'unknown', reason }` when a stake/venue can't be resolved — explicitly documented as different from `tier: 'none'`. But `src/utils/potCalculator.js:447` — `if (!rakeConfig || potSize <= 0) return 0;` — treats `unknown` and `none` **identically**: zero rake either way. Repo-wide grep: **zero consumers read `tier` or `reason` anywhere**. New code in this window reproducing WS-333's own headline finding one layer up. The EV figure looks identically confident whether rake is genuinely zero or simply unresolved.

4. **`unexploitableFloor.js` (WS-333, this window) has no production consumer, while the constant it was built to correct is still live in weakness detection.** `villainObservations.js:69-72` (`blindDefendMax: 25`) still drives production over-fold flagging; `unexploitableFloor.deriveFloor` computes the correct MDF-derived floor (perDefenderMDF = 0.375 for the same reference spot per MO-3) but has zero `src/` callers. Tracked (WS-398, WS-400, WS-422, FIND-050, FIND-052) but still open at HEAD.

5. **Boundary: a genuinely empty villain range (0 combos) silently produces a plausible coin-flip EV rather than an error.** `gameTreeContext.js:310-317` — `let heroEquity = 0.5;` unconditional default; only overwritten if `comboDistribution` exists or `segmentation.totalCombos > 0`. If `totalCombos === 0`, `foldPct` also defaults to `{ value: 0, meta: null }` (`:332-333`). The engine emits full ranked recommendations built from `heroEquity=0.5, foldPct=0` — indistinguishable at the output from a genuinely-measured 50/50 spot. No `treeMetadata` field flags "zero-combo range" as a distinct failure state.

#### Hidden Risks

- **Phase-1 (mandatory, unbudgeted) MC refinement swallows failures more weakly than phase-2.** `gameTreeEvaluator.js:1150-1179` — the depth-1 close-candidate MC refinement loop catches per-candidate and does `console.warn?.(...)`, keeping the "algebraic estimate" — but unlike every phase-2 stage (`endStage('...', 'error', e)`), this failure is **not recorded in the stage ledger**. `candidate.refined` stays `false` with nothing in `treeMetadata` explaining why.
- **`decisionAccumulator.js:280-390` swallows `buildTimeline`, `narrowHolding`, and `segmentRange` failures with bare `catch { continue; }`.** Correct fail-skip pattern per holdingKnowledge/CLAUDE.md, but a systematic parse/schema defect would silently shrink the accumulated sample rather than surfacing — the villain model would quietly train on fewer decisions with no count discrepancy logged (`modelAudit.js:115-129`/`:203-209` same shape).
- **MO-7**: `ConfidenceBadge` in `LiveAdviceBar.jsx:68-87` has 3 branches, only 1 (`PARTIAL`) reachable — `DATA` requires a `source` containing `"model"` that `queryActionDistribution` never emits; `EST` requires `effectiveN < 5` but `effectiveN` is floored at `PSEUDOCOUNT = 10`. A villain with 0 observed hands and one with 500 render identical badges.
- **MO-2**: `decisionAccumulator.js:611-628` computes a bucket's point estimate from a **decayed** weight sum (`recencyWeight = 0.5^(handAge/50)`) but gates confidence badge and sparsity check on the **raw** occurrence count — 40 hands decayed to effective weight 10 still reports confidence as if n=40.
- **`villainDecisionModel.js:535` vs `betaMath.js:166-167`**: `evidenceN` passed into `bayesianSampleConfidence` is a decayed sum at one call site while the function's docblock states "raw observed count at every call site" — same estimator on two different scales, undocumented at either site.
- **MO-5**: `weaknessDetector.js` runs 16 independent detectors per villain with no multiple-comparison correction (grep for fdr/bonferroni/holm returns zero `src/` hits). At per-test α=0.05, ~56% chance of ≥1 false weakness flag per villain under the null — feeds exploit generation directly.
- **WS-436 style-removal left no dangling references** — every STYLE_* hit in `src/` is a tombstone comment. One residual: `drillModeEngine.js:801-815` still constructs `{ playerStats: { style: 'reg' } }` and passes it to `multiwayFoldPct` — harmless (falls to documented 0.45 unknown-baseline), but a dead field that reads as if style still matters.

#### Likely Missing Elements

- No assertion in `gameTreeEvaluator.js` or `gameTreeContext.js` that `segmentation.totalCombos > 0` before emitting recommendations.
- No consumer anywhere reads `rakeResolver`'s `tier`/`reason` — the observability this module was built to provide is unwired end to end.
- No test/invariant enforcing that `treeMetadata.depthReached` is read before a caller treats a depth-1 and a depth-2/3-refined EV as equally confident.
- No stage-ledger entry for the phase-1 MC-refinement catch block (`gameTreeEvaluator.js:1176-1179`).
- `unexploitableFloor.js` has no production caller — the corrected defensive-floor math cannot influence a live decision.

#### Dangerous Assumptions

- **"The refined EV is the final EV" is assumed by every current caller**, but per FIND-051 it is a function of wall-clock contention, not just game state.
- **"A resolved `rakeConfig` object (even `null`) means rake was considered" is assumed downstream** — `estimateRake` and every EV formula cannot distinguish "correctly zero" from "unresolved."
- **"A range with `totalCombos > 0` is the only reachable state" is assumed by `gameTreeContext.js`'s default-equity path** — no assertion enforces it, so a future regression would silently reactivate the `heroEquity = 0.5` fallback rather than erroring.
- **"`console.warn` is sufficient failure signaling"** in the phase-1 MC-refinement catch and `gameTreeContext.js:360-362`'s `enrichWithEquity` catch — neither reaches `treeMetadata`.

#### Areas Checked and Found CLEAN (with evidence)

- **Division-by-zero in range math**: `crossRangeConstraints.js:32-106` — both scaling divisions guarded before dividing.
- **`pokerCore/softWeights.js`**: `tau = Math.max(1e-9, spread) * tauFraction` and `spread = Math.max(1e-6, IQR)` — denominators guarded; no step-function/tau=0 regression in this window's shipped code.
- **`sort()` without comparator**: every numeric `.sort()` in exploitEngine/ production files carries a comparator; the one bare `.sort()` (`thoughtSignatureEvaluators.js:226`) sorts string IDs correctly. WS-300 grid-index defect not reintroduced.
- **`.reduce()` without initial value**: no matches in exploitEngine/ production code.
- **`betaMomentMatch` division-by-sd²** (`preflopFoldQuantities.js:413-415`): only called with fixed non-zero measured constants at module scope; not reachable with sd=0.
- **`multiwayFoldPct`** (`gameTreeEquity.js:1110-1141`): falls through to a named 0.45 "true unknown baseline", clamped [0.10, 0.90] per opponent.

#### Not Covered (honest gap, not a finding)

Did not review: `gameTreeDepth2.js` (822 diff lines, largest single file, WS-361 already flags its EV outputs as unvalidated), `preflopFoldResolver.js`/`preflopFoldQuantities.js` beyond cited sections, `pokerCore/equityOperator.js` + `equityDecomposition.js` + generated `equitySkewDecomposition.js`, `villainModelData.js`'s full WS-436/WS-283 fold-curve refit, `icmEngine/riskPremium.js`'s 2-line change. A second pass should prioritize `gameTreeDepth2.js`.
