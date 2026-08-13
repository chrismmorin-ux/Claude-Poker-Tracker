# Phase 1 — senior-engineer (fresh-context dispatch)
Run: run-domain-correctness-sweep-2026-08-13 | Window: 5aa1419..HEAD | Captured verbatim from agent final output.

### SENIOR ENGINEER

#### Key Concerns (top 3-5)

1. **~9,100 lines of new code shipped this window with zero production callers** — `src/utils/pokerCore/equityOperator.js` (486 lines), `equitySkew.js` (175 lines), `data/equitySkewDecomposition.js` (8,107-line generated artifact), plus their 323-line test file. `grep -rln "equitySkew"` across `src/**/*.{js,jsx}` returns only the module's own files and its test — no engine, hook, or view imports `equitySkew.js` or `equityOperator.js`. The module's own docblock (`equitySkew.js:14-17`) is honest: "the estimation claim ... is NOT YET RUN and therefore unknown, not favourable" (also POKER_THEORY.md WS-337 changelog, 2026-08-05). Same shape as three prior instances named in `feedback_shipped_but_inert_capability.md` (WS-276 perceivedHeroRange, WS-284, predictionAudit).

2. **WS-436's style-tier removal left two call sites reconstructing a `style` field that is now provably inert, one with a stale comment referencing a deleted table.**
   - `src/utils/postflopDrillContent/drillModeEngine.js:804-810` — comment reads `"opponents-behind = STYLE_FOLD_DEFAULTS['reg']"` and constructs `villains.slice(1).map(() => ({ playerStats: { style: 'reg' } }))` passed into `multiwayFoldPct(...)`. `STYLE_FOLD_DEFAULTS` was deleted by WS-436. `multiwayFoldPct` (`gameTreeEquity.js:1110-1140`) branches on `opp.villainModel?._buckets` then `opp.playerStats?.shrunk` — the object has neither, so every villain silently falls to the `oppFold = 0.45` unknown-baseline branch regardless of the `style: 'reg'` label. The comment describes behavior the code cannot execute. Predates the window (2026-05-08, `d92f28e5`); NOT touched by the WS-436 close-out commit (`faf1b275`) whose changelog claims "stale docblocks cleaned" — the cleanup pass missed this caller.
   - `src/utils/exploitEngine/modelAudit.js:114` — `buildVillainDecisionModel(decisionSummary, { ...pct, style: classifyStyle(pct) })`. Documented as deliberately inert and covered by a regression test (`villainDecisionModel.test.js:124`). Lower risk, but the struct still carries a `style` key at exactly this reattachment point — nothing but a docblock and one test stops a future edit from reading it.

3. **`src/hooks/useActionAdvisor.js:59` awaits `evaluateGameTree()` without `refinementBudgetMs: 0` or `onFastResult`**, and no other production file passes `onFastResult` either. Matches DEC-036's recorded open item, re-confirmed still true at HEAD: the WS-334 two-phase architecture is fully implemented and tested, but the caller serving the founder's manual "what-if" panel (`PlayerAnalysisPanel` via `useActionAdvisor`) still blocks on the full refined result — measured up to 26 seconds on a wet flop. The UI-responsiveness problem the two-phase split was built to solve is not solved for any live surface yet.

4. **`src/utils/exploitEngine/seatPricing.js` (179 lines, new this window) has no dedicated test file.** `priceSeats`, `orStandIns`, `reraiseRiskFrom`, `overcallRiskFrom`, `splitRaiseOutcomes` are exercised only indirectly through `preflopAdvisor.test.js` and `unexploitableFloor.test.js`. Real arithmetic (`OUTCOME_HEADROOM`, risk composition); edge cases internal to `priceSeats` (empty seat list, single stand-in seat) have no direct assertion path.

5. **`gameTreeEvaluator.js` (1,922 lines) and `gameTreeDepth2.js` (1,721 lines) continue to grow** (+1330 and +822 this window) with no split despite SYSTEM_MODEL §5.2 flagging both pre-window. `evaluateGameTree` (`gameTreeEvaluator.js:840-1083`, ~243 lines) takes 22 destructured parameters; no schema/type validation at the boundary — only runtime `Number.isFinite` clamps on three of the twenty-two.

#### Hidden Risks

- `readFoldVs3BetAfterOpenPct` (`preflopFoldQuantities.js:147`) is a hardcoded `() => null` stub, honestly documented as deliberate — but no test asserts it stays `null` deliberately; a future "just wire it up" edit could silently return `FOLD_VS_3BET_AFTER_OPEN`'s broad number, precisely the substitution its own docblock says was "the original defect."
- Generated artifacts `data/equitySkewDecomposition.js` (8,107 lines) and `handhqReferencePool.js` (455 lines) carry "GENERATED. Do not hand-edit." headers with regeneration commands outside `package.json` scripts (one needs Python `scripts/research/spectrum.py`). No staleness/drift check in `smart-test-runner.sh` for either — nothing catches a hand-edit or stale regeneration.
- Naming inversion: `useActionAdvisor` (manual live table — the founder's actual 1/2 game, per its own corrective comment at `useActionAdvisor.js:36-39`) vs `useLiveActionAdvisor` (Ignition-extension-only). A contributor asked to touch "the live advisor" has a 50% chance of editing the wrong hook.
- Three `chore(wip): land N uncommitted file(s) from a closed session` commits in this window (`5315fc74`, `18f49f22`, `b6cce98d`) — sessions ending without `/session-end` running cleanly (consistent with the documented 12% completion rate).

#### Likely Missing Elements

- A CI/test guard asserting `equitySkewDecomposition.js` / `handhqReferencePool.js` match fresh regeneration (hash check or generator-diff), mirroring `check-idb-additive.sh`.
- A direct unit test file for `seatPricing.js` with edge-case seat configurations.
- A lint/grep CI check flagging any object literal in `src/` constructing a `.style` key destined for engine consumption.
- A `hooks/CLAUDE.md` or directory note naming the `useActionAdvisor` / `useLiveActionAdvisor` split explicitly.

#### Dangerous Assumptions

- The WS-436 changelog's "the engine's playerStats struct no longer carries a style field at all" is true of the type surface the villain decision model core reads, but not absolutely — `modelAudit.js:114` reattaches it deliberately (tested), `drillModeEngine.js:810` reattaches it as dead weight (untested, comment stale).
- `evaluateGameTree`'s two-phase split is documented as though it delivers a UX improvement, but that describes a capability, not a shipped outcome — no production caller realizes it.
- `seatPricing.js`'s absence of a direct test file is easy to read as "fully covered" via its two consumers — but integration coverage only exercises the paths those consumers' fixtures happen to hit.

#### Areas checked and found CLEAN

- **Style-tier removal (WS-436) core claim**: zero remaining STYLE_* table/function definitions in `src/` (excluding tests) — only removal-documenting comments. `villainDecisionModel.js` and `villainModelData.js` contain no `.style` reads. Regression test directly asserts a passed `style` field changes nothing (`villainDecisionModel.test.js:124-136`).
- **Test-to-production ratio this window**: ~20,957 added production lines vs ~12,960 added test lines (≈0.62:1); production figure includes the 8,107-line generated artifact, so hand-written ratio is healthier still.
- **No `it.skip`/`xit`/`xdescribe`** in exploitEngine/rangeEngine/pokerCore test directories for this window.
- **`preflopFoldQuantities.js` beta machinery** (`betaCdf`, `betaQuantile`, `betaMomentMatch`) directly unit-tested with closed-form known-answer checks in `populationBaselineSelfTrip.test.js:314-320` — ground-truth anchor discipline satisfied despite no dedicated file.
- **`gameTreeDepth2.narrowingCount.test.js`** wraps the real `narrowByBoard` with a spy — legitimate call-counting, not over-mocking.
- **No dangling IDB schema changes** in this window's engine-focused commits.
