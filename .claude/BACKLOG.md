# Project Backlog

Master execution list. Items ordered by dependency chain and priority.
Start any item with `/project start <id>` or ask Claude to implement it directly.

**Last updated:** 2026-03-09 | **Current version:** v121

---

## Status Key

| Symbol | Meaning |
|--------|---------|
| DONE | Shipped and verified |
| READY | No blockers, can start now |
| BLOCKED | Waiting on a prerequisite |
| PAUSED | Started but on hold |

---

## 1. Player Tendencies (P2) — `docs/projects/3.002.1209-player-tendencies.project.md`

Core analytics pipeline. Phases 1-7 shipped. Phase 6 superseded by exploit engine (item 9).

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | DONE | VPIP/PFR/AF engine — `tendencyCalculations.js`, 34 tests |
| 2 | DONE | actionSequence + Hand Timeline — `handTimeline.js` |
| 3 | DONE | 3-bet%, C-bet% via timeline |
| 4 | DONE | Players View stats display — `TendencyStats.jsx`, `usePlayerTendencies.js` |
| 5 | DONE | Custom exploit notes per player — `ExploitItem.jsx`, `ExploitList.jsx` |
| 6 | DONE | Auto-classification + exploit suggestions — `exploitSuggestions.js` (V1, 20 z-test rules) |
| 7 | DONE | Table seat exploit badges — `ExploitBadges.jsx` (v118) |

**Complete.** Advanced exploit work continues in item 9 (Exploit Engine).

---

## 2. Stats View — Real Session Data (P2) — from `docs/DESIGN_UX_REVIEW.md` Change 2

StatsView shows real session-scoped stats via `useSessionStats` hook, with seat grid, detail panel, and range profile integration.

| Step | Status | Description | What to build |
|------|--------|-------------|---------------|
| 2a | DONE | Session stats utility | `useSessionStats` hook: per-seat VPIP/PFR/AF/3-bet/C-bet from session hands |
| 2b | DONE | Seat grid with real data | 9-seat clickable grid with hand count, player name, mini stat line |
| 2c | DONE | Selected seat detail panel | Preflop + postflop stats + range profile with grid visualization |
| 2d | DONE | Table dynamics placeholder | Static stub section: "Table Dynamics (Coming Soon)" below seat stats. Future: aggregate table-level tendencies |

**Complete.**

---

## 3. Analysis View (P3) — from `docs/DESIGN_UX_REVIEW.md` Change 3

Between-session analysis screen. Two tabs: Player Analysis and Hand Review.

| Step | Status | Description | What to build |
|------|--------|-------------|---------------|
| 3a | DONE | Analysis view component | `src/components/views/AnalysisView/index.jsx`: tab router (Player Analysis / Hand Review) |
| 3b | DONE | Navigation + routing | `SCREEN.ANALYSIS` in uiReducer, sidebar nav button, ViewRouter case |
| 3c | DONE | Range grid panel | Reuses `RangeGrid` + range data from TendencyContext. Position/action pills, 20-hand threshold gate |
| 3d | DONE | Player/session selection UI | Player dropdown from `allPlayers`, session dropdown from `allSessions` |
| 3e | DONE | Board Equity panel | Board + hero card input, Monte Carlo equity via `useActionAdvisor` |
| 3f | DONE | Action Recommendations panel | Ranked actions with EV/reasoning via `getActionAdvice()` pipeline |
| 3g | DONE | Hand Review tab | `HandReviewPanel` + `HandBrowser` + `HandWalkthrough` + `ReviewObservations` |

**Complete.** All panels functional. Hand review analyzes hero decision points with 7 rule-based observations via `handReviewAnalyzer.js`.

---

## 4. Statistical Engine (P4) — Partially built by Exploit Engine

Heavy computation. Core modules now exist in `src/utils/exploitEngine/`. UI integration pending.

| Step | Status | Description | Notes |
|------|--------|-------------|-------|
| 4a | DONE | Range estimation from stats | `rangeMatrix.js`: 13x13 grid, 9 preflop charts, `narrowByAction` |
| 4b | DONE | Showdown observations | Shown cards persisted in `cardState.allPlayerCards`, extracted by `actionExtractor.js`, Bayesian anchors applied by `applyShowdownAnchor()` with semantic boosting (outcome-aware: 0.30 won, 0.15 lost). Full pipeline wired. |
| 4c | DONE | Board equity computation | `equityCalculator.js`: Monte Carlo hand-vs-range. `boardTexture.js`: wet/dry/paired classification |
| 4d | DONE | Algorithmic exploit generation | `generateExploits.js`: V1 z-test + V2 position/board/range-equity + PIP rules. Wired via `usePlayerTendencies` → `TableView` + `PlayersView`. |

**Complete.** All computation layers built and wired.

---

## 5. Range Analysis Tools (P4) — `docs/projects/4.001.1209-range-analysis.project.md`

Interactive range tools. Display layer exists (RangeGrid in StatsView + AnalysisView). Interactive editing not yet built.

| Phase | Status | Description | Notes |
|-------|--------|-------------|-------|
| 1 | READY | Interactive range matrix UI | Extends existing `RangeGrid` (display-only → click-to-toggle). `rangeMatrix.js` provides data layer. |
| 2 | DONE | Equity calculator | `equityCalculator.js` — Monte Carlo, chunked async |
| 3 | N/A | ~~Range vs range comparison UI~~ | `rangeVsRange()` removed from codebase. Re-evaluate if needed. |
| 4 | BLOCKED | Save/load custom ranges + presets | Needs interactive range matrix UI first (Phase 1) |

---

## 9. Exploit Engine — Integration & Quality (P1) — DONE

Engine modules built in `src/utils/exploitEngine/` (13 modules). All integration, bugs, data validation, test coverage, and cleanup items complete.

### 9.1 Integration Wiring (CRITICAL — engine is orphaned)

| ID | Status | Description | Details |
|----|--------|-------------|---------|
| EE-INT-1 | DONE | Wire `getSuggestionsV2` into `PlayerRow.jsx` | Replace V1 `getSuggestions` import with V2. Pass `positionStats` + `boardTexture` through. Backward-compatible output shape. |
| EE-INT-2 | DONE | Wire `useExploitEngine` into component tree | Either replace `usePlayerTendencies` in consumers, or merge engine features into existing hook. Must provide `positionStats` per player + `boardTexture` + `calculateEquity`. |
| EE-INT-3 | DONE | Add `deriveCategoryPercentages` to barrel export | Missing from `exploitEngine/index.js`. Used by `exploitSuggestionsV2.js` via direct import. |

### 9.2 Source Code Bugs (HIGH)

| ID | Status | Description | Details |
|----|--------|-------------|---------|
| EE-BUG-1 | DONE | Fix `adjustRangeByStats` tighter-player logic | `rangeMatrix.js:154-175`: mixes hand count with VPIP ratio, double-penalizes weak hands. Replace with uniform proportional scaling. |
| EE-BUG-2 | DONE | Track/compensate skipped trials in equity calculator | `equityCalculator.js`: adaptive batch sizing in `handVsRange`, while-loop with maxAttempts in `rangeVsRange`. |
| EE-BUG-3 | DONE | Fix misleading fold comment in `narrowByAction` | `rangeMatrix.js:219-221`: comment says opposite of what code does. |
| EE-BUG-4 | DONE | Guard `observedVpip < 0` in `adjustRangeByStats` | `rangeMatrix.js:136`: negative ratio would produce NaN. |

### 9.3 Preflop Chart Validation (HIGH)

| ID | Status | Description | Details |
|----|--------|-------------|---------|
| EE-DATA-1 | DONE | Validate all 9 preflop charts against GTO ranges | `preflopCharts.validation.test.js` — 11 tests, all 9 positions validated. BTN expanded from ~32% to ~40% GTO. |
| EE-DATA-2 | DONE | Board texture wetness formula calibration | `boardTexture.calibration.test.js` — 12 tests, 10+ boards covered |

### 9.4 Test Coverage Gaps (HIGH)

| ID | Status | Description | Details |
|----|--------|-------------|---------|
| EE-TEST-1 | DONE | Test `rangeVsRange()` | 6 tests in `equityCalculator.test.js` |
| EE-TEST-2 | DONE | Test 8 untested V2 rules | All 8 V2 rules tested in `generateExploits.test.js` |
| EE-TEST-3 | DONE | Test IP/OOP position routing | IP/OOP routing tested in `positionStats.test.js` |
| EE-TEST-4 | DONE | Test hand evaluator kicker ordering | Kicker edge cases tested (AAKKQ vs AAKK5, flush kicker) |
| EE-TEST-5 | DONE | Test board texture on 4-card and 5-card boards | 4-card and 5-card board tests in `boardTexture.test.js` |
| EE-TEST-6 | DONE | Test equity with board cards | Equity with board cards tested (AA on A-high flop) |
| EE-TEST-7 | DONE | Test `useActionAdvisor` hook | 6 tests in `useActionAdvisor.test.js`: initial state, compute, error, clear, abort |
| EE-TEST-8 | DONE | Tighten equity test tolerances | 72o vs AA (8-16%), AKs vs QQ (41-51%) at 5000 trials |

### 9.5 Cleanup (LOW)

| ID | Status | Description | Details |
|----|--------|-------------|---------|
| EE-CLEAN-1 | N/A | Remove unused exports | `createPositionStats`, `POSITION_CATS` are internal (not exported), no action needed |
| EE-CLEAN-2 | DONE | Add logging for hands missing `seatPlayers` | `positionStats.js:41`: `console.warn` before returning. Test verifies warning fires. |
| EE-CLEAN-3 | DONE | `narrowByAction` postflop heuristic note | Already has `@deprecated` JSDoc warning pointing to `narrowByBoard()`, not exported |

---

## 10. Dead Code & Documentation Cleanup (P1) — Project 0.008

CTO review identified ~1,300 lines of dead/orphaned code and stale documentation across 4 context files.

### Phase 1 — Dead Code Removal (P1, ai:capable)

| ID | Status | Description | Details |
|----|--------|-------------|---------|
| DC-1 | DONE | Delete dead functions from PokerTracker.jsx | `togglePlayerSelection`, `toggleSidebar`, `getSeatActionSummary` removed |
| DC-2 | DONE | Delete ViewRouter.jsx, update SCREEN import | SCREEN already in `uiReducer.js`; updated PokerTracker.jsx import, deleted 375-line dead file |
| DC-3 | DONE | Guard seed data imports | Wrapped `seedTestData.js` + `seedRangeTestData.js` in `import.meta.env.DEV` |
| DC-4 | DONE | Remove unused `getAssignedPlayerIds` | Removed from `usePlayerPersistence.js` return and `useAppState.js` re-export |
| DC-5 | DONE | Remove `isSeatInactive` from GameContext | GameContext version (current-street-only) was never consumed; PokerTracker.jsx version (all streets) is the live one |
| DC-6 | N/A | V1/V2 exploit suggestions not consolidatable | V2 depends on V1's `proportionZTest`, `confidenceFromPValue`, `basis`; V1's `filterDismissed` actively imported by TableView and PlayerRow. Dependency chain, not duplication. |

### Phase 2 — Documentation Sync (P2, ai:less-capable)

| ID | Status | Description | Details |
|----|--------|-------------|---------|
| DOC-1 | DONE | Update PERSISTENCE_OVERVIEW.md | v7 -> v9, added rangeProfiles store, migration history table |
| DOC-2 | DONE | Update STATE_SCHEMA.md | 5 -> 7 reducers (added auth, settings schemas), updated uiReducer views |
| DOC-3 | DONE | Update CONTEXT_SUMMARY.md | 9 screens, 18 hooks, 30 UI components, 825 lines, 7 reducers/providers |
| DOC-4 | DONE | Update HOTSPOTS.md | 2,974 tests, added AuthContext to integration points |

---

## 11. Context Migration Completion (P2) — Project 0.009 — DONE

PokerTracker.jsx reduced from 861 to 93 lines. All views consume contexts directly via zero-prop-drilling pattern.

| Phase | Status | Description | Details |
|-------|--------|-------------|---------|
| 1 | DONE | Audit & plan | All props mapped, contexts identified |
| 2 | DONE | Migrate views | 7 providers, all views receive only `scale` prop. AppRoot + ViewRouter pattern. |

**Complete.**

---

## 12. Exploit Engine UI Integration (P2) — Project 0.010

AnalysisView fully functional: PlayerAnalysisPanel (range grids + equity + action advice) and HandReviewPanel (hand browser + walkthrough + observations). `useActionAdvisor` isolated to AnalysisView — not yet surfaced during live play.

| Phase | Status | Description | Details |
|-------|--------|-------------|---------|
| 1 | DONE | AnalysisView functional | PlayerAnalysisPanel: range grids, board equity, action recommendations. HandReviewPanel: hand browser, street walkthrough, 7 observation rules. |
| 2 | DONE | Live action advice on table | Compact equity/fold%/action badge (VALUE/BLUFF/CHECK) in CommandStrip, driven by `useLiveEquity`. Shows when hero has 2 hole cards + 3+ board cards vs best villain. |
| 3 | DONE | Hand review polish | Player names resolved via allPlayers, hand count badge in HandBrowser, observation severity coloring (major=red, minor=yellow), responsive grid layout. |
| 4 | READY | Table-level exploit aggregation | Aggregate tendencies across all seats ("table is too tight preflop"). Currently only per-player exploits exist. |

---

## 6. Firebase Cloud Sync (P3, PAUSED) — `docs/projects/2.001.1210-firebase-auth.project.md`

| Status | Notes |
|--------|-------|
| PAUSED at Phase 4/5 | Auth project exists but paused. Cloud sync not started. |

Not blocking any analytics work. Resume when core analytics pipeline is complete.

---

## 7. Infrastructure & Tech Debt (P3-P4)

| ID | Task | Status | Notes |
|----|------|--------|-------|
| ARCH-001 | PokerTracker.jsx decomposition | DONE | 861 -> 93 lines. Completed via Project 0.009 (context migration). |
| TS-001 | TypeScript migration | BLOCKED | `docs/projects/4.002.1209-typescript-migration.project.md`. Low priority, do after feature work stabilizes |

---

## 8. Future Ideas (Unscoped)

Ideas that need design work before they become backlog items.

| Idea | Description | Prerequisite |
|------|-------------|--------------|
| ~~Positional stats~~ | ~~VPIP/PFR by position~~ | DONE — `positionStats.js` in exploit engine |
| Trend lines | Stats over time — is a player tightening up or going on tilt? | Stats engine (item 2) |
| Session heat maps | Profit by hour of day, day of week | Session data |
| Mobile PWA | Progressive web app packaging for home screen install | None |
| ~~Table-level exploits~~ | ~~Aggregate tendencies across all seats~~ | Tracked as item 12.4 |
| Swipe gestures | Swipe left on seat = fold, swipe right = call/check, tap = action panel | Hand entry speed (item 14) |
| Template hands | Quick-entry templates: "limped pot", "standard open + 1 caller", etc. | Hand entry speed (item 14) |
| More hand review rules | Expand beyond 7 rules: pot odds vs call size, SPR checks, multi-way adjustments | Item 12.3 |
| ~~Orphaned engine cleanup~~ | ~~`calcBluffEV()` is actively used (briefingBuilder.js, decisionTreeBuilder.js — 5+ call sites). `rangeVsRange` already removed.~~ | N/A |
| Multi-villain equity | Compute equity vs multiple non-folded opponents simultaneously (currently single-villain upper bound) | useLiveEquity refactor |

---

## 13. Range Equity & EV Analysis (P1) -- Project 0.011 — DONE

Board-aware range narrowing, equity segmentation, fold equity EV, bet sizing optimization.

| Phase | Status | Description | Key Deliverable |
|-------|--------|-------------|-----------------|
| 1 | DONE | Board-aware postflop range narrowing | `postflopNarrower.js` — `narrowByBoard()` with hand evaluation + draw detection |
| 1b | DONE | Score-based continuous multipliers + player adaptation | `comboMultiplier()`, `adaptMultipliers()`, `classifyComboFull()` |
| 2 | DONE | Range equity segmentation (buckets) | `rangeSegmenter.js` — nuts/strong/marginal/draw/air bucketing |
| 3 | DONE | Fold equity & EV calculator | `foldEquityCalculator.js` — `estimateFoldPct()`, `calculateFoldEquityEV()` |
| 4 | DONE | Action advisor pipeline orchestrator | `actionAdvisor.js` — `getActionAdvice()` end-to-end pipeline |

**Complete.** All 6 modules built, 62+ tests passing. Engine is computation-ready but not yet wired to UI (see item 9.1).

---

## 14. Hand Entry Speed Optimization (P1) — Project 0.014

Speed-of-entry audit identified ~39 clicks and 4 screen transitions per hand. Goal: reduce to ~15-20 clicks, 0-1 transitions.

### Phase 1 — Quick Wins (HIGH impact, LOW risk)

| ID | Status | Description | Details |
|----|--------|-------------|---------|
| HE-1a | DONE | "Rest Fold" / "Check Around" batch buttons | `BatchActionBar.jsx` built, integrated into `CommandStrip.jsx`. |
| HE-1b | DONE | Inline card overlay on table view | `CardSelectorPanel.jsx` (full-screen overlay) wired into `CommandStrip.jsx`. `CardSelectorOverlay.jsx` deleted (dead code, replaced by CardSelectorPanel). |
| HE-1c | DONE | Auto-select first seat after card close | `TableView.jsx` useEffect (lines 206-239): auto-selects first-to-act on card close, street change, and mount. |
| HE-1d | CUT | ~~"Hand Over" early termination button~~ | Redundant — "Rest Fold" already ends the hand when remaining players fold. |

**Also built (not originally in backlog):**
- `CommandStrip.jsx` — unified right-side control panel (ActionPanel + StreetSelector + BatchActionBar + sizing + hand controls)
- `SizingPanel.jsx` — bet/raise sizing presets with custom input
- `PotDisplay.jsx` + `potCalculator.js` — pot tracking and display

### Phase 2 — Flow Restructuring (MEDIUM risk)

| ID | Status | Description | Details |
|----|--------|-------------|---------|
| HE-2a | READY | Prominent next-to-act display | Make current seat + action buttons more prominent and centrally positioned. Reduce eye/finger travel. |
| HE-2b | READY | Preflop Quick Entry mode | Streamlined positional flow: highlight seat, show Fold/Call/Raise, auto-advance. "Skip to raiser" for fast fold runs. |
| HE-2c | READY | Showdown simplification | Auto-detect remaining players, show only active seats. Heads-up: auto-mark winner when other mucks. |

---

## 15. Architecture Monitoring (P3) — CTO Review 2026-03-07

Deferred findings from CTO review. No action unless triggers are hit.

| ID | Finding | Trigger | Action |
|----|---------|---------|--------|
| ARCH-002 | UIContext: 27 items, 28-dep useMemo | >40 items or measured perf regression | Split into UIViewContext + UITableContext |
| ARCH-003 | TableView: 594 lines, 25 handlers | >700 lines | Extract useTableDealerLogic, useTableCardActions hooks |
| ARCH-004 | PlayersView: 562 lines, 15 handlers | >700 lines | Extract useSeatAssignmentFlow, useDragDropSeating hooks |
| ARCH-005 | actionAdvisor only in AnalysisView | After HE-2a/2b/2c complete | Wire useActionAdvisor into CommandStrip with compact EV display |
| ARCH-006 | database.js inline migrations (v1-v9) | v10+ migration needed | Extract migration functions into migrations.js |

---

## 16. Weakness Detection Layer (P1)

Situational weakness detection backed by range equity analysis. Per-hand EV analysis + cross-hand pattern accumulation.

| Phase | Status | Description | Key Deliverable |
|-------|--------|-------------|-----------------|
| 1 | DONE | Hand replay EV analysis | `useHandReplayAnalysis` hook: per-action range/equity/segmentation/EV assessment. All actions clickable in HandWalkthrough. ReviewObservations enhanced with equity bars, segmentation, EV badges. |
| 2 | DONE | Weakness detection module | `decisionAccumulator.js` + `weaknessDetector.js`: situational + preflop weakness detection. 14 tests. Integrated into `usePlayerTendencies`, displayed in PlayerAnalysisPanel. |
| 3 | DONE | Exploit-weakness linkage | `runWeaknessRules()` in `generateExploits.js` — 10 weakness→exploit mappings, deduplication via `WEAKNESS_SUPERSEDES`, weakness-enriched briefings. 10 integration tests. |
| 4 | DONE | Full UI integration | Weakness count badge on SeatComponent (16.4a), briefing annotations (16.4b), mini range grid in HandWalkthrough (16.4c), player names in walkthrough (16.4d). Remaining: sizing tell tracking (future). |

**Dependencies:** Phase 3 requires Phases 1+2 validated. Phase 4 requires Phase 3.
**Key files:** `generateExploits.js`, `briefingBuilder.js`, `SeatComponent.jsx`, `ExploitBriefingCard.jsx`

---

## 17. CTO Audit Fixes — TendencyProvider, Dead Code, Doc Sync (P0-P2) — DONE

| ID | Status | Description | Details |
|----|--------|-------------|---------|
| 17.1 | DONE | TendencyProvider (P0+P1) | Shared `TendencyContext.jsx` — single `usePlayerTendencies` instance for entire app. `patchTendency()` for optimistic briefing updates. Fixes P0 stale briefing state + P1 4x redundant computation. |
| 17.2 | DONE | Dead reducer code (P1) | Removed 5 dead briefing action constants + 5 case blocks from `playerReducer.js` (~85 lines). Never dispatched. |
| 17.3 | DONE | Duplicate `parseBlinds` (P1) | Deleted `src/utils/parseBlinds.js`. `PlayerAnalysisPanel` now imports from `potCalculator.js`. |
| 17.4 | DONE | Orphaned `adjustRangeByStats` (P1) | Deleted function + export from `rangeMatrix.js`, removed test cases. |
| 17.5 | DONE | Documentation sync (P2) | CLAUDE.md v121, CONTEXT_SUMMARY v1.4.0, BACKLOG cleaned. |

---

## Open Design Questions

1. **Range grid interactivity** — Should the 13x13 grid be interactive (click to toggle combos)? Display-only exists in StatsView + AnalysisView. Interactive editing would enable custom range construction (5.1).
2. ~~**Showdown Bayesian updates**~~ — Resolved. Full pipeline: shown cards → `actionExtractor` → `applyShowdownAnchor()` → semantic boosting → cached in IndexedDB.
3. **Table-level exploits surface** — Show on table view, stats view, or both? Currently only per-player exploits exist. See item 12.4.
4. ~~**useExploitEngine vs usePlayerTendencies**~~ — Resolved. `usePlayerTendencies` imports `generateExploits` directly. Single hook.
5. ~~**Live EV during play**~~ — Resolved. Compact badge in CommandStrip showing equity %, fold %, and VALUE/BLUFF/CHECK label. Driven by `useLiveEquity`.

---

## 18. Hand Replay Health — CTO Audit 2026-03-21

Structural issues in hand replay feature identified by CTO audit. Root causes: monolithic analysis hook, missing prop wiring, duplicated utilities.

### Phase 1 — Decompose useHandReplayAnalysis (P1, ai:capable)

The 449-line monolithic hook mixes range init, postflop narrowing, equity calc, hero coaching, and showdown classification in one loop. A bug in any phase silently breaks downstream analysis. This is the root cause of most testability and maintainability issues.

| ID | Status | Description | Details |
|----|--------|-------------|---------|
| HR-1a | DONE | Extract `initSeatRanges()` pure function | Extracted to `replayAnalysis.js` |
| HR-1b | DONE | Extract `analyzeAction()` pure function | Extracted to `replayAnalysis.js` as `analyzeTimelineAction()` |
| HR-1c | DONE | Extract `computeHeroCoaching()` pure function | Extracted to `replayAnalysis.js` as `buildHeroCoaching()` |
| HR-1d | DONE | Extract `classifyShowdownAction()` pure function | Integrated into `analyzeTimelineAction()` |
| HR-1e | DONE | Hook becomes orchestrator | `useHandReplayAnalysis` is now 86 lines |

### Phase 2 — Fix broken wiring & dedup (P1, ai:capable)

| ID | Status | Description | Details |
|----|--------|-------------|---------|
| HR-2a | DONE | Pass `heroPlayerId` to HandBrowser | Wired through HandReviewPanel |
| HR-2b | DONE | Deduplicate `getPositionalOrder` | Deleted from useReplayState, imported from handTimeline via `sortByPositionalOrder` |
| HR-2c | DONE | Replace hand-coded card-to-street with `getCardsForStreet` | Both sites now import from `pokerCore/cardParser` |
| HR-2d | DONE | Deduplicate `getPlayerName` across replay components | Extracted `buildSeatNameMap()` + `getPlayerName()` to `playerNameMap.js` |

### Phase 3 — Dead code & component extraction (P2, ai:capable)

| ID | Status | Description | Details |
|----|--------|-------------|---------|
| HR-3a | DONE | Remove unused `heroDecisionPoints` from useHandReview | Removed dead code |
| HR-3b | DONE | Extract HeroCoachingCard from ReviewPanel | Extracted to `HeroCoachingCard.jsx` |
| HR-3c | DONE | Extract VillainAnalysisSection from ReviewPanel | Extracted to `VillainAnalysisSection.jsx`. ReviewPanel now 189 lines |

### Phase 4 — Test coverage (P2, ai:capable)

| ID | Status | Description | Details |
|----|--------|-------------|---------|
| HR-4a | DONE | Test heroAnalysis.js | 12 tests in `heroAnalysis.test.js` |
| HR-4b | DONE | Test handSignificance.js | 10 tests in `handSignificance.test.js` |
| HR-4c | DONE | Test hindsightAnalysis.js | 8 tests in `hindsightAnalysis.test.js` |
| HR-4d | DONE | Test extracted Phase 1 functions | 15 tests in `replayAnalysis.test.js` |

---

## 19. Codebase Health Refactors (P1-P3) — CTO Audit 2026-03-22

Structural improvements identified by CTO architecture review. Not urgent but will reduce maintenance burden.

| ID | Sev | Status | Description | Details |
|----|-----|--------|-------------|---------|
| CH-1 | P1 | N/A | Deduplicate `getSeatContributions` | Already shared via `potCalculator.js` — non-issue. |
| CH-2 | P1 | READY | Reduce CommandStrip prop explosion | CommandStrip takes ~40 props. Should consume contexts directly instead of prop-drilling from TableView. |
| CH-3 | P1 | DONE | Organize analysis utils into `src/utils/handAnalysis/` | 7 files + 6 tests moved, barrel export created, 26 imports updated. |
| CH-4 | P2 | READY | Remove raw `dispatchUi` from UIContext public API | Expose named action dispatchers instead of raw dispatch. Prevents consumers from dispatching arbitrary actions. |
| CH-5 | P2 | DONE | Use `getHandCount()` early-exit in usePlayerTendencies | O(1) count check skips expensive getAllHands() when nothing changed. |
| CH-6 | P3 | READY | Add structured error logging to usePlayerTendencies | Catch blocks currently swallow errors silently. Add structured logging for debugging tendency computation failures. |

---

## 20. Ignition Extension Audit (P1-P3) — CTO Audit 2026-03-23

Cleanup and quality findings from CTO architecture review of `ignition-poker-tracker/`.

| ID | Sev | Status | Description | Details |
|----|-----|--------|-------------|---------|
| IG-1 | P1 | DONE | Delete dead DOM probe file | `capture-dom-probe.js` (316 lines) never loaded — spike concluded WS-only. |
| IG-2 | P1 | DONE | Fix ReferenceError in storage-writer | `captureCounter` undeclared variable in `clearCapturedHands()`. |
| IG-3 | P1 | DONE | Remove unused `mapIgnitionAction` from hand-format.js | Dead code — actual decoding uses `protocol.js:decodeAction()` bitmask. |
| IG-4 | P2 | DONE | Remove unused `saveTableStates`/`getTableStates` from storage-writer.js | Dead exports never called. |
| IG-5 | P2 | DONE | Consolidate PID constants in protocol.js | `CO_TABLE_INFO`, `CO_OPTION_INFO`, `PLAY_SEAT_INFO` added to PID; string literals replaced; duplicate `CO_LAST_HAND_NUMBER` removed. |
| IG-6 | P2 | DONE | Fix misleading popup stat label | "WS Messages" renamed to "Pipeline Hands" — was showing `completedHands`, same as "Hands Captured". |
| IG-7 | P2 | READY | Add unit tests for extension pure-function modules | Zero test coverage. `protocol.js`, `hand-format.js`, `hand-state-machine.js` are all pure functions. |
| IG-8 | P3 | READY | Consolidate extension version string | Three different versions: service-worker.js "0.3.0", app-bridge.js "0.5.0", manifest.json "0.6.0". |

---

## 21. Analysis Quality Overhaul (P0)

Analysis, weakness detection, and exploit layers produce bad recommendations. Fold% estimation is wrong (VPIP used as fold-to-3bet proxy), z-tests used despite being wrong for poker, confidence doesn't gate display, EV is per-street not per-hand, and villain is modeled as a statistical distribution instead of a decision maker.

Plan: `.claude/plans/concurrent-whistling-whisper.md`

| ID | Sev | Status | Description | Details |
|----|-----|--------|-------------|---------|
| 21.1 | P0 | DONE | Fix preflop fold% estimation | Replace `1-vpip/100` with population priors + observed fold-to-3bet. Fix postflop estimateFoldPct Bayesian blend. 2 files. |
| 21.2 | P0 | DONE | Replace z-tests with Bayesian credible intervals | New `bayesianConfidence.js` Beta-Binomial model. Replaced `proportionZTest` in statRules + generateExploits. Replaced `sampleConfidence()` in weaknessDetector. 5 files. |
| 21.3 | P1 | DONE | Confidence-weighted display | Continuous worthiness filter, dataQuality metadata in live advisor, confidence dots + quality labels + bluff gating in OnlineView. 4 files. |
| 21.4a | P1 | DONE | Contextual decision tracking | Expanded situation keys to 7 dimensions (aggressor/IP/facing/contextAction). 2 new weakness rules (donks-without-equity, never-cbets). 2 files. |
| 21.4b | P1 | READY | Villain decision model | New `villainDecisionModel.js`: per-context action distributions with Bayesian hierarchical smoothing. Population fallback from `ACTION_MULTIPLIERS`. |
| 21.4c | P2 | BLOCKED (21.4b) | Game tree evaluator | New `gameTreeEvaluator.js`: recursive 2-street look-ahead. Villain decisions from decision model. Range narrowing per branch. 100-200ms budget. |
| 21.4d | P2 | BLOCKED (21.4c) | Replace actionAdvisor + live advisor | `getActionAdvice()` becomes game tree wrapper. Delete `computePreflopAdvice()`. Unified preflop+postflop pipeline. 2 files. |
| 21.5 | P1 | BLOCKED (21.4c) | Remove WEAKNESS_EXPLOIT_MAP stopgap | Delete `WEAKNESS_EXPLOIT_MAP`, `weaknessToExploit()`, `runWeaknessRules()`. Weaknesses become villain reads only. Game tree generates situation-specific exploits that reference weaknesses as inputs. Audit all `w-*` exploit IDs in IMPACT/RISK maps, ExploitList, ExploitBadges, briefingBuilder. |

---

## Recommended Execution Order

```
NEXT:   21.4b (villain decision model), 18 Phase 1-2 (hand replay health)
LATER:  21.4c-d, 21.5 (remove weakness→exploit stopgap), 14 Phase 2, 12.4, 18 Phase 3-4, 5
DEFER:  6 (Firebase), 7 (TypeScript), 8 (Future Ideas)
DONE:   1, 2, 3, 4, 9, 10, 11, 12.1, 12.2, 12.3, 13, 14-Phase 1, 16.1, 16.2, 16.3, 16.4, 17
PAUSED: 6 (Firebase auth)
```
