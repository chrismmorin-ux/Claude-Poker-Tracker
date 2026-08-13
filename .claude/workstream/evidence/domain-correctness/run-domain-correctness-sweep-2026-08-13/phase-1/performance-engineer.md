# Phase 1 — performance-engineer (fresh-context dispatch)
Run: run-domain-correctness-sweep-2026-08-13 | Window: 5aa1419..HEAD | Captured verbatim from agent final output.

### PERFORMANCE ENGINEER

#### Key Concerns (top 3-5)

**1. Depth-2/3 refinement was inert for the project's life and is now LIVE, main-thread, unbudgeted by wall clock, and calibrated only on desktop — the live poker-table path can block the JS thread far longer than its nominal 2000ms.**

- `gameTreeEvaluator.js:880-997` (WS-334, `f6737ed4`, 2026-08-05; converted to logical clock by WS-432, `52d0cae4`, 2026-08-07) — `refinementBudgetMs` defaults to 2000, converted to `budgetUnits = refinementBudgetMs * REFINEMENT_UNITS_PER_MS` (`REFINEMENT_UNITS_PER_MS = 319`, `refinementWork.js:51`). Before WS-334, the pre-existing single wall-clock gate was spent before refinement's first check ever ran, so depth-2/3 was **effectively dead code on the live path** (SYSTEM_MODEL.md:154-156, DEC-036). WS-334 made it run for the first time; WS-432 made its stopping point deterministic across devices by switching from `Date.now()` to a logical work-unit meter charged per combo evaluated (`refinementWork.js:16,90,103`).
- `REFINEMENT_UNITS_PER_MS`/`COMBO_EVAL_COST` calibrated **exclusively on desktop** ("reference machine: MorinComputer (G16)... idle, mains power" — `docs/standard-of-record/REFINEMENT-CLOCK-CALIBRATION.md:22-26`). No mobile/Galaxy-A22 recalibration anywhere in the diff.
- Because the gate counts combo evaluations, wall-clock cost of exhausting the same 638,000-unit budget scales with device throughput — "2000ms" no longer describes wall time on the target device at all.
- Refinement is synchronous, single-thread, **no worker offload**: `gameTreeDepth2.js` has zero references to `equityFn` — computes directly via pokerCore, never through `useEquityWorker`'s Worker. Unchanged debt (TD-07/TD-08) but its consequence changed materially: before WS-334 that debt was latent because refinement never ran; now it runs on every live postflop decision.
- `onFastResult` **still unwired on the production live caller**: `computeHelpers.js:251-272` calls `evaluateGameTree({...})` with no `onFastResult` and no `refinementBudgetMs` override; `useActionAdvisor.js:59-70` likewise. Because `onFastResult` is null, `yieldToHost()` at `gameTreeEvaluator.js:1507,1517` never runs — the ENTIRE evaluation executes as one uninterrupted synchronous block with zero paint opportunity. Flagged pre-window (SYSTEM_MODEL.md:167), unresolved by WS-334 or WS-432.
- Net: WS-432 is a genuine correctness win (identical inputs now reach identical *logical* stopping points across devices/load, closing a real non-determinism bug). But it did nothing to bound *wall-clock* cost on mobile, and by making the previously-dead refinement stage actually execute, it converts a formerly-latent mobile-blocking risk into a live one on every postflop decision.

**2. Whether MORE refinement produces a BETTER answer is an open, explicitly untested fault — any future mobile-driven budget reduction has an unknown correctness direction.**

- `DISCLAIMER-AND-FAULT-REGISTER.md:108`: `FAULT-refinement-depth-non-monotonicity` — likelihood 0.60, impact 0.50, composite 0.300, status **untested**.
- `WS-432.yaml:86-89`: "Either ASSERT refinement monotonicity or DISCLOSE its absence in the card. WS-378 saw depth-2 move 38 of 40 flips toward passivity, so monotonicity is not assumable... depth is pinned as a CONTROLLED variable."
- `refinementWork.js:53-73` (`MAX_STAGE_SHARE = 0.4`, cap-not-reserve): stage completion is first-come-first-served among hero-action candidates — a budget-exhaustion event can leave one candidate refined and a competitor un-refined, comparing a depth-2/3 EV to a depth-1 EV when picking the argmax. A second, distinct source of budget-dependent-answer risk beyond truncation.
- Any device-based mitigation (lower budget on mobile/battery per `gameTreeEvaluator.js:994-995`'s own comment) is unimplemented and, per this fault entry, not known to be monotonically safe to gate without measurement first.

**3. `OnlineStakesBackfill` runs an ungated, sequential, un-batched IndexedDB migration pass on every app launch, with no persisted completion flag.**

- `OnlineStakesBackfill.jsx:22-39` fires in a `useEffect` on every mount per resolved `userId`, deduped only in-memory (`attemptedRef`).
- `backfillOnlineStakes.js:57-87`: one `readTx` over the full SESSIONS index, then a sequential `for...of` issuing two more IDB transactions per un-healed session. No `navigator.storage.estimate()`, no batching, no work-queue/backoff.
- First-launch-after-ship cost (self-healing after), but a long-history user pays N sequential round trips on every launch until converged, serializing against startup-critical IDB reads.

#### Hidden Risks

- **Cross-device answer consistency vs per-device latency tradeoff invisible to the founder.** `treeMetadata.latency`/`computeMs`/`unitsAt` exist (`gameTreeEvaluator.js:1044,1347,1422,1430`) but nothing surfaces them — SYSTEM_MODEL §10's "No performance metrics for game tree evaluation" gap remains open despite richer metadata now existing.
- **"In parallel" (`computeHelpers.js:75`) describes two different things**: worker-backed equityFn (genuinely off-main-thread) vs gameTreeDepth2 (no worker path at all). Nothing prevents a future edit assuming worker-safety it doesn't have.
- **Unit-denominated budget means every device reaches the same stopping POINT — the risk is purely latency, not answer-divergence.** The fix converted "sometimes-wrong, always-fast" mobile into "provably-consistent, possibly very slow" — and nobody has measured which is worse for a founder acting in real time.
- **Depth-2/3 validated on desktop-reference timing only.** RC-depth-ablation/RC-layer-divergence are desktop runs; no evidence anyone has run `evaluateGameTree` on an actual Android device.

#### Likely Missing Elements

- Device/CPU-tier detection (hardwareConcurrency, on-device micro-benchmark, low-power toggle) feeding `refinementBudgetMs` — acknowledged as the intended lever in-code, no caller implements it.
- A yield point *inside* refinement — a single MAX_STAGE_SHARE-capped stage can run uninterrupted for up to 40% of the whole budget even if `onFastResult` were wired.
- Worker offload for `gameTreeDepth2.js` per-combo evaluation — the single largest unaddressed item given it now executes on the live path.
- On-device recalibration path for `REFINEMENT_UNITS_PER_MS`/`COMBO_EVAL_COST` — `calibrate-refinement-units.mjs` is Node-only desktop tooling.
- A persisted "backfill complete" flag for `backfillOnlineStakes`.
- Real-device latency telemetry for `treeMetadata.computeMs` on the live path.

#### Dangerous Assumptions

- **That a deterministic logical clock is a complete fix.** It resolves answer-determinism (correctness) but not wall-clock blocking (performance); no downstream consumer treats them as separate concerns requiring separate mobile handling.
- **That "2000ms" still means ~2000ms of real time at the table.** Pre-window open item (A-07/DEC-036); this window makes the mismatch more consequential (guaranteed full-budget consumption in unit terms).
- **That `Promise.all` around `equityFn` implies concurrency** — true only when worker-backed; inapplicable to gameTreeDepth2 which has no equityFn seam.
- **That `OnlineStakesBackfill` is "cheap because idempotent"** — idempotent means converges, not that each pre-convergence launch is cheap.

#### Areas checked and found CLEAN (with evidence)

- **MC/equity determinism (FIND-074, WS-393):** default `equityFn` (`gameTreeEvaluator.js:896-901`) now seeds a single `boardDerivedRng` stream per evaluation, threaded through `handVsRange`'s `opts.rng` seam. No lingering unseeded `Math.random()` MC path in the reworked files.
- **Stratified-sample category-dropping bias (WS-361, `a36ae595`):** `stratifiedSample` raises `targetCount` to non-empty category count rather than redistributing dropped mass (`gameTreeSampling.js:227-230`).
- **Discarded runout weights (WS-355 pt2, `7b563919`):** `perceivedEquityWithRunouts` carries `{cards, weight}` through the average.
- **`equitySkewDecomposition.js` (8,107 lines) does not reach the app bundle** — only `equitySkew.js` imports it; only production reference is a doc comment in `rangeProfile.js:21`. No bundle/memory risk.
- **WS-433 `worker_threads` pool is Node-only backtest tooling** — never reaches the browser bundle.
- **`EquityWorkerContext` singleton (RT-27) holds** — live path depth-1 equity genuinely off-main-thread.
- **`reasoningNoteWriter.js`** one `updateTx` per discrete user write — no hot-loop batching problem.
