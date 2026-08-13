# Phase 1 (supplemental) — targeted gameTreeDepth2.js deep review (failure-engineer lens, fresh-context dispatch)
Run: run-domain-correctness-sweep-2026-08-13 | Window: 5aa1419..HEAD | Dispatched by orchestrator to close the declared coverage gap (no Phase-1 lens read this file's internals). Captured verbatim from agent final output.

### FAILURE ENGINEER — `src/utils/exploitEngine/gameTreeDepth2.js` domain-correctness review

#### Key Concerns (top 5)

1. **Villain's required equity computed with the BLUFFER's breakeven formula (`s/(1+s)`), not the CALLER's required equity (`s/(1+2s)`), at four sites in this file — the exact anti-pattern this engine's own `CLAUDE.md` names ("DO NOT use the bluffer's breakeven formula for the caller's decision") and documents as fixed everywhere except one already-known live violation in `gameTreeEvaluator.js`. This file is a second, undocumented instance.**
   - `gameTreeDepth2.js:445` — `computePerComboEV`: `potOddsNeeded = betSize / (pot + betSize)` (should be `betSize / (pot + betSize*2)` per `foldEquityCalculator.villainRequiredEquity`, which this file never imports).
   - `gameTreeDepth2.js:639` — `computePerComboCheckEV`: `callNeeded = vBetSize / (pot + vBetSize)` — same wrong formula, here pricing **hero's own** call threshold (opposite direction of harm: hero under-calls in the simulated check-branch).
   - `gameTreeDepth2.js:1549` — `computeRiverCheckEV`: `callNeeded = vBetSize / (potSize + vBetSize)` — same bug, hero's own river call threshold.
   - `gameTreeDepth2.js:1656` — `computeRiverBetEV`: `potOddsNeeded = betSize / (potSize + betSize)` — same bug, villain's river fold/call/raise threshold, feeding `comboActionProbabilities` at `:1693`.
   - Magnitude at typical sizings (half pot: 0.333 computed vs 0.25 correct; pot-size bet: 0.5 vs 0.333 correct). Direction: over-stating required equity → `equityRatio` deflated → engine reads villain as folding more than they should on every depth-2/3 branch and every current-node river decision — the "reckless" bias POKER_THEORY §13.3/§13.4 describes.
   - `foldEquityCalculator.js:378-400` (`villainRequiredEquity`) shows the correct formula already implemented and shared elsewhere — simply not imported/used in this file.

2. **Depth-2 refinement is blended into `candidate.ev` with no discount for partial/bailed completion; depth-3 is. A bailed, low-`weightConsumed` depth-2 result competes at face value against a fully-refined depth-3 result and an unrefined depth-1 result at the final argmax.**
   - Sources of `completed`/`weightConsumed`: `gameTreeDepth2.js:789-806`, `:929-941`, `:1041-1045`.
   - Consumers that ignore both fields: `gameTreeEvaluator.js:1659`, `:1694-1700`, `:1785`, `:1839`.
   - Contrast: depth-3's `computeDepth3BarrelEV` result IS discounted — `gameTreeEvaluator.js:1896-1899` (`d3Weight` 0.70/0.80/0.90 by `completed`/`bailedAt`) — the asymmetry is an inconsistency between refinement tiers, not a uniform design choice.
   - Final argmax: `gameTreeEvaluator.js:1206` (`snapshot.sort((a,b)=>b.ev-a.ev)`) — raw EV, no confidence/variance term.

3. **Dead computation: a per-combo equity-derived population baseline is computed and explicitly discarded (`void`), and the flat population marginal is used instead — reproducing the §13.3 anti-pattern this codebase names three times elsewhere.**
   - `gameTreeDepth2.js:373-374`: `const popCallRate = computePopBaselineFromEquity(villainEquity, potOddsNeeded); void popCallRate;`
   - `gameTreeDepth2.js:377`: `const popAvgCallRate = 1 - POPULATION_PRIORS.bet.fold;` (flat constant used instead).
   - Comment above (`:371-372`) describes behavior the code does not perform — "a comment asserting what the values contradict" (§11.6/11.9 pattern, WS-285/291/300/402).
   - Fires when the villain model has bucket evidence but no situation-level rates (`:369`) — precisely where a per-combo baseline should matter most.

4. **River decisions where hero's action is `raise` are priced against the BET population/model, not the RAISE one — `comboActionProbabilities` has no facing-action parameter and hardcodes `'bet'` throughout, even though raise-specific machinery (`villainFoldLevel(..., 'raise')`, `POPULATION_PRIORS.raise`) exists and is unused here.**
   - `gameTreeDepth2.js:259` — `hasReliableModel(modelSituation, 'bet')` (hardcoded).
   - `:364,375,377,385,386,398` — all read `POPULATION_PRIORS.bet.fold` (0.45), never `POPULATION_PRIORS.raise.fold` (0.55, `villainModelData.js:92-96`).
   - `:397` — `villainFoldLevel(playerStats, 'bet')`, not `'raise'` (the latter exists: `villainModelData.js:117-122`).
   - `villainModelData.js:43-47` (`hasReliableModel`) has no `'raise'` branch at all.
   - Reachable from `computeRiverBetEV` with `heroAction: 'raise'` — `gameTreeDepth2.js:1638-1696` (`heroAction` threaded only into `resolveRiverPerceivedRange`, never into `comboActionProbabilities`); driven from `gameTreeEvaluator.js:1582-1600` where `betCandidates` includes `r.action === 'raise'`.
   - POKER_THEORY §11.1a: facing a raise is a measurably different population (marginal fold 0.4242 vs 0.5616); a bet-fitted curve must not price a raise. This is that violation, on river raise candidates, in the current-node pathway WS-378 specifically hardened.

5. **Depth-2/3 stage-level rake is a single flat subtraction from the blended (fold+call+raise) EV, taxing the fold branch — contradicting POKER_THEORY §11.3: "Rake … never affects fold-equity from villain folding." The river-level functions in the SAME FILE get this right.**
   - Violating (flat, stage-level): `gameTreeDepth2.js:785,790`, `:926,930`, `:1039,1042`, `:1439,1449` — each subtracts one `estimateRake(...)` from a `totalEV/totalWeight` average mixing fold-branch mass (no real rake) with call/raise-branch mass (real rake); `computePerComboEV`/`computePerComboCheckEV` apply no rake internally.
   - Correct (per-branch): `:1600` (showdown-only), `:1605` (call branch only), `:1699,1703` (`foldEV = potSize` untaxed, `callEV` nets `rakeOnCall`).
   - `computeDepth3BarrelEV`'s single rake figure (`:1439`) additionally computed from `potAfterFlopCall` — the pot BEFORE the turn/river barrels it discounts — not the larger pot actually reached.

#### Hidden Risks

- **Silent zero-fallback indistinguishable from genuine zero-EV.** `totalWeight > 0 ? totalEV/totalWeight : 0` at `:489`, `:650`, `:1616`, `:1714`. No flag for "sampled combo set was empty" (e.g., branch range fully blocked by dead cards for a runout) vs "EV really is 0." A degenerate 0 can silently win/lose `Math.max(checkEV, bestBetEV)` at `:761,913,1033,1147,1319`.
- **Cache-absent fallback substitutes fixed values, not a computation.** `:472-474,598-600`: `cache ? cache.cachedClassifyFull(...) : { bucket: 'marginal', drawOuts: 0 }` — silently zeroes implied-odds/realization adjustments. Dormant (all production sites pass `cache: boardCache`), not enforced.
- **No stack-depth / all-in cap on raise-branch sizing.** `villainRaiseSize(betSize, pot+betSize) = Math.min(betSize*3, pot+betSize*2)` (`gameTreeSizingHelpers.js:38`, called at `:481,1705`) — purely geometric, no effective-stack reference in this file. At low SPR (live 1/2-1/3 MICRO/LOW zones per §11.2), raise-branch EV can price a size neither player has behind.
- **Discrete 3-level confidence flag on a continuous quantity.** `computeDepth3BarrelEV` returns continuous `weightConsumed` (`:1451`) but the consumer collapses to 3-value `d3Weight` keyed only on `completed`/`bailedAt` — a bail at 15% vs 85% explored gets identical discount.

#### Likely Missing Elements

- A confidence/`weightConsumed`-aware term at the final argmax (`gameTreeEvaluator.js:1203-1206`).
- A "no-data"/degenerate-sample signal out of the four innermost bare-number functions.
- A `facingAction`-aware branch inside `comboActionProbabilities` + a `'raise'` case in `hasReliableModel`.
- Any stack/all-in legality guard on raise-branch sizing in this file.
- Per-branch (fold vs showdown) rake accounting at depth-2/3 stage level, matching this file's own river functions.

#### Dangerous Assumptions

- "`cache` is always supplied" — silent low-fidelity fallback rather than assertion or real computation.
- "Villain is always facing a bet, never a raise" — false at one real call site.
- "A range enumerated for a hypothesized branch is always non-empty" — §3.6.1's never-zero floor protects the prior range, not post-card-removal enumeration; fallback silent 0 doesn't distinguish.
- "A single stage-start-pot rake figure approximates the blended pot" — contradicted by this file's own river functions and §11.3.
- "Depth-2 and depth-3 partial results are equally reliable for ranking" — discounted for depth-3, not for depth-2, in the same evaluator.

#### Checked CLEAN (with evidence)

- **Hypothesized vs observed narrowing basis discipline** — every narrowing call routes through `narrowBranch` with `basis: BASIS.HYPOTHESIZED` (`:65-73`, used at `:833-835, :974-976, :1093-1095, :1183-1186, :1269-1272`).
- **One narrowing per villain ACTION, not per street** — depth-3 turn loop reuses `flopCallRange` without re-narrowing on the turn card (`:1245-1249`, cites WS-303 by name); asserts `maxNarrowingCount ≤ 2` (`:1205, :1277, :1461`).
- **Mid-loop budget bailout renormalization** — `createStratumGuard`/`mayBail()` + weight-based renormalization consistent across all four stage functions (`:708-724, :864-876, :1001-1013, :1119-1126, :1217-1223, :1296-1309, :1349-1351`) — WS-361 defect class structurally guarded.
- **No bucket-label decision inputs in per-combo action probabilities** — fold/call/raise derived from equity ratio, SPR, board-texture modifiers (`:234-408, :522-545`); `bucket`/`drawOuts` consulted only for realization scaling, consistent with §7.3/AP-RL-01.
- **Mutually exclusive villain-model tiers** — `if/else if` chain at `:363-399` guarantees one evidence source per decision (WS-436/§7.4 rule).
- **`shiftFoldMass` genuinely mass-preserving** (`:185-196`) — verified algebraically.
- **No unguarded `.reduce()`/`.sort()`** — all reduces supply initial 0; all sorts have comparators.

Files read: gameTreeDepth2.js (full), gameTreeEquity.js, refinementWork.js, villainModelData.js:1-140, foldEquityCalculator.js:378-420+500-610, gameTreeEvaluator.js:1190-1460+1540-1923, gameTreeSizingHelpers.js (grep), POKER_THEORY.md (§7, §11.1-11.9, §12, §13 full), exploitEngine/CLAUDE.md (full).
