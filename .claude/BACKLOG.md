# Project Backlog

Master execution list. Items ordered by dependency chain and priority.
Start any item with `/project start <id>` or ask Claude to implement it directly.

**Last updated:** 2026-03-24 | **Current version:** v122

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
| ARCH-006 | ~~database.js inline migrations~~ | DONE | Extracted to `migrations.js` (commit 26cf0fb) |

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
| IG-7 | P2 | DONE | Add unit tests for extension pure-function modules | 9 test files covering protocol, hand-format, HSM, protocol-adapter, record-builder, stats-engine, table-manager, wire-schemas, integration pipeline. |
| IG-8 | P3 | DONE | Consolidate extension version string | manifest.json + package.json both 0.9.0; constants.js reads from manifest at runtime. |

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
| 21.4b | P1 | DONE | Villain decision model | `villainDecisionModel.js`: hierarchical Bayesian smoothing over 7-dim decision buckets, personalized ACTION_MULTIPLIERS, contextual fold% estimates. Integrated into analysisPipeline, postflopNarrower, foldEquityCalculator, actionAdvisor, useLiveActionAdvisor. 23 tests. |
| 21.4c | P2 | DONE | Game tree evaluator | `gameTreeEvaluator.js`: depth-1 tree with equity rollout, algebraic sub-range equity, MC refinement for top 2 candidates, villain response breakdown. ~135ms budget. 22 tests. |
| 21.4d | P2 | DONE | Replace actionAdvisor with game tree | `actionAdvisor.js` rewritten as thin wrapper around `evaluateGameTree()`. 245→43 lines. All 20 existing tests pass unchanged. |
| 21.5 | P1 | DONE | Remove WEAKNESS_EXPLOIT_MAP stopgap | Deleted `WEAKNESS_EXPLOIT_MAP`, `weaknessToExploit()`, `runWeaknessRules()`, `WEAKNESS_SUPERSEDES`, `applyWeaknessDeduplication()`. Removed `w-*` IDs from IMPACT/RISK maps and briefingBuilder. Weaknesses are now villain reads only. 4 files. |

---

## 22. Action Advice Quality (P1)

Game tree evaluator improvements for higher-quality action recommendations.

| ID | Sev | Status | Description | Details |
|----|-----|--------|-------------|---------|
| 22.1 | P1 | DONE | Overbet sizing candidates | Added 2.0x pot to bet sizing candidates in `foldEquityCalculator.js`. |
| 22.2 | P1 | DONE | Multiple raise sizing | Generate min-raise, optimal, pot-size raise candidates when facing a bet. `gameTreeEvaluator.js`. |
| 22.3 | P1 | DONE | Check EV calibration | Use villain's observed bet sizing instead of hardcoded half-pot. `gameTreeEvaluator.js`. |
| 22.4 | P1 | DONE | Reasoning quality + observation integration | Rewrite `buildTreeReasoning()` to reference specific numbers and villain observations. Every string includes at least one verifiable number. |
| 22.5 | P2 | DONE | Call branch depth-2 | Sample next-street cards, categorize villain combos (beats hero / elastic folder / inelastic caller), compute optimal sizing. Handles implied odds, reverse implied odds, nut-changing cards. |
| 22.6 | P2 | DONE | Preflop advisor upgrade | Positional matchup fold estimation (SB vs UTG ≠ BB vs BTN), multiple sizing candidates, position-aware reasoning strings. |
| 22.7 | P3 | DONE | Multi-street depth-2 for bet/raise branches | Expanded to depth-3 barrel planning on flop (6 turn cards × 8 river cards × 3 sizings). `gameTreeDepth2.js`. |
| 22.8 | P1 | DONE | Weighted combo sampling | Systematic weighted sampling in `computePerComboEV`/`computePerComboCheckEV`. `gameTreeHelpers.js`. |
| 22.9 | P1 | DONE | Check-raise sizing optimization | Multi-candidate CR sizing via `findOptimalBetSize`, SPR-aware shove. `gameTreeEvaluator.js`. |
| 22.10 | P1 | DONE | Expanded depth-2 sizing | Probe (0.33x) and overbet (2.0x) added to depth-2 candidates. `gameTreeHelpers.js`. |
| 22.11 | P1 | DONE | Position-conditioned fold estimation | `estimateFoldPct` now uses position context (BB/EP/IP/OOP adjustments). `foldEquityCalculator.js`. |
| 22.12 | P3 | DONE | Depth-3 for turn (currently flop-only) | Turn depth-3 wired with relaxed combo limit (1200 vs 800). `gameTreeEvaluator.js`. |
| 22.13 | P1 | DONE | Depth-2 board re-analysis bug fix | Board texture re-analyzed per sampled card in depth-2/3 loops. `cachedTexture()` in board cache. `gameTreeDepth2.js`, `gameTreeHelpers.js`. |
| 22.14 | P1 | DONE | Range/nut advantage integration | `computeAdvantage()` in `rangeSegmenter.js`, drives sizing candidates (small-bet on range advantage, overbet on nut advantage) and fold estimate adjustments. |
| 22.15 | P1 | DONE | Continuous draw realization | `comboRealization()` uses continuous function of draw outs + draw-type bonuses (combo > flush > OESD > gutshot). `classifyComboFull` returns `drawType`. |
| 22.16 | P1 | DONE | Exploitative check-raise frequency | Check-raise equity threshold adjusts based on villain c-bet % (80%+ → 35% threshold, 65%+ → 40%). |
| 22.17 | P2 | DONE | Multi-street bluff commitment penalty | `bluffCommitmentPenalty()` in depth-3: penalizes bluff barrels when compound fold equity < break-even. |
| 22.18 | P1 | DONE | Probability-weighted board runouts | `stratifiedSample()` returns `{card, weight}[]` with category-proportional weights. All depth-2/3 loops use weighted averaging. |
| 22.19 | P1 | DONE | Villain slow-play adjustment | `approximateCheckBackRangeEquity()` — check-check EV uses check-back range equity, not full range. Slow-playing villain's check-back range is stronger. |
| 22.20 | P1 | DONE | Depth-3 blend calibration | Blend weights equity-dependent (value=0.80 deep, bluff=0.55 deep) + SPR-modulated (±0.05). Replaces fixed 0.3/0.7. |
| 22.21 | P1 | DONE | Implied odds for drawing hands | `drawImpliedOddsAdjustment()` + `reverseImpliedOddsPenalty()` in call depth-2. SPR-scaled bonus when draw hits, penalty on scary cards. |
| 22.22 | P2 | DONE | Donk-bet labeling & reasoning | `isDonk` flag on OOP non-aggressor bets. Donk-specific reasoning in `buildTreeReasoning()`. `isPreflopAggressor` passed via contextHints. |
| 22.23 | P2 | DONE | Mixed strategy hints | `mixFrequency` field via softmax for close EV decisions (within 5% pot). Helps hero randomize. |
| 22.24 | P1 | DONE | Asymmetric fold response | `logisticFoldResponse()` uses separate `steepnessUp`/`steepnessDown` — fold% rises faster for small bets, flattens for overbets. |
| 22.25 | P1 | DONE | Bayesian blend weight fix | `estimateFoldPct()` blends model + observed by effective sample size instead of priority-based cutoff at confidence=0.4. |
| 22.26 | P1 | DONE | Board-texture-aware villain priors | `buildActionPriors()` accepts boardTexture — wet/dry/paired modifiers on action priors. Integrated into `queryActionDistribution()`. |
| 22.27 | P1 | DONE | Draw outs overlap | `detectDraws()` returns `effectiveOuts` accounting for paired board (−2 flush outs) and straight-heavy board (−1/−2 straight outs). |
| 22.28 | P1 | DONE | Proportional stratified sampling | `stratifiedSample()` fills remaining slots proportionally by category instead of random, reducing variance. |
| 22.29 | P1 | DONE | Per-street multiplier derivation | `derivePersonalizedMultipliers()` outputs `_perStreet` with flop/turn/river-specific multipliers. `narrowByBoard()` prefers per-street. |
| 22.30 | P1 | DONE | Counterdraw realization | `comboRealization()` accepts `villainDrawPct` — discounts hero draw realization when villain also has draws (>15%). |
| 22.31 | P0 | DONE | Combo-counted equity distribution | `computeComboEquityDistribution()` + `computeFilteredEquity()` + `computeExcludedBucketEquity()` in `gameTreeHelpers.js`. Replaces bucket-anchor approximation with per-combo equity in depth-1 evaluation. |
| 22.32 | P1 | DONE | Villain model hierarchy reorder | Texture preserved through L3 (was dropped at L2). New order: drop aggressor → IP → texture → position → street. |
| 22.33 | P1 | DONE | Semi-bluff equity in calcBluffEV | `heroEquity` parameter (default 0) enables semi-bluff EV accounting for equity when called. |
| 22.34 | P1 | DONE | Texture-aware realization | `adjustedRealization()` accepts `boardTexture`: wet OOP ×0.92, dry OOP ×1.05, paired ×0.97. |
| 22.35 | P1 | DONE | Analytical equity for sparse ranges | `exactEnumerateEquity()` fast path in `handVsRange()` for ≤20 combos on turn/river. Deterministic, zero MC variance. |
| 22.36 | P2 | DONE | TPTK wet board conditional downgrade | Only Ace kicker keeps 'strong' on wet non-flush boards; others downgrade to 'marginal'. |
| 22.37 | P2 | DONE | Overcard outs quality adjustment | Rank-adjusted: A=3, K/Q=2.5, J/T=2, 9-=1.5 outs. Replaces fixed +6. |

---

## 23. Game Tree & Analysis Improvements (P0-P2)

Advanced game tree accuracy, poker-strategic sizing, and preflop modeling improvements.

| ID | Sev | Status | Description | Details |
|----|-----|--------|-------------|---------|
| 23.1 | P0 | DONE | Flop combo equity: miniRollout replaces crude proxy | `computeComboEquityDistribution()` now calls `miniRolloutEquity()` (16 samples) instead of fixed 0.70/0.50/0.25 proxy. `gameTreeHelpers.js`. |
| 23.2 | P0 | DONE | Check-raise depth-2 refinement | CR gets `needsCRDepth2` flag + depth-2 via `computeBetCallDepth2EV` with tightened 'raise' rates. `gameTreeEvaluator.js`. |
| 23.3 | P0 | DONE | IP check-back depth-2 | Removed `!isIP` guard — both IP and OOP checks get depth-2 refinement. IP check models delayed c-bet. `gameTreeEvaluator.js`. |
| 23.4 | P1 | DONE | Polarization-aware sizing | `computePolarization()` in `gameTreeHelpers.js`, integrated into `computeAdvantage()`. Polarized ranges → larger sizes, merged → smaller. |
| 23.5 | P1 | DONE | Nut-blocker bluff strategy | Blocker-motivated bluff candidates when hero blocks nuts + has low equity. `blockerBluff` flag + dedicated reasoning. `gameTreeEvaluator.js`. |
| 23.6 | P1 | DONE | River block-bet sizing (0.25x) | 0.25x pot block-bet candidate on river when hero has 35-55% equity (showdown value, not value-bet strength). `gameTreeEvaluator.js`. |
| 23.7 | P1 | DONE | SPR-conditional calling station exploit | VPIP>40 fold discount now SPR-aware: 0.70 at low SPR, 0.80 medium, 0.85 high. Thin-value boost at low SPR. `foldEquityCalculator.js` + `gameTreeEvaluator.js`. |
| 23.8 | P1 | DONE | Villain 4-bet modeling | `POSITIONAL_FOLD_TO_4BET` table, `facing_3bet` situation detection, 4-bet sizing candidates + reasoning. `preflopAdvisor.js`. |
| 23.9 | P0 | DONE | Explicit blocker stats | Replaced heuristic blocker adjustments with baseline vs actual segmentation comparison. Exact combo-counted bucket shifts. `rangeSegmenter.js`. |
| 23.10 | P2 | DONE | Texture-conditioned depth-2/3 sizing | `textureSizingFractions()` — wet boards get smaller sizes, dry boards include overbets, paired boards cautious. 5 call sites in `gameTreeDepth2.js`. |
| 23.11 | P2 | DONE | Multi-street value coherence bonus | `valueCommitmentBonus()` rewards value hands with compounding equity advantage across streets. Inverse of `bluffCommitmentPenalty`. `gameTreeHelpers.js` + `gameTreeDepth2.js`. |
| 23.12 | P2 | DONE | Elastic/inelastic calling range | `comboActionProbabilities()` now modulates fold/call by bet size: marginals/weak draws fold more to large bets, nuts/strong inelastic. `gameTreeDepth2.js`. |
| 23.13 | P2 | DONE | Equity denial scaling by draw quality | Protection bonus weighted by avg draw outs (4 outs → 0.022, 9 outs → 0.037, 15 outs → 0.055). `gameTreeEvaluator.js`. |

---

## 24. Game Tree Tier 1 Improvements (P0-P1)

River accuracy, empirical calibration, villain-range-driven sizing, and multiway correlation.

| ID | Sev | Status | Description | Details |
|----|-----|--------|-------------|---------|
| 24.1 | P0 | DONE | River per-combo evaluation | `computeRiverCheckEV()` + `computeRiverBetEV()` in `gameTreeDepth2.js`. Step 8a-river in `gameTreeEvaluator.js` refines all river candidates with exact per-combo equity (no MC, no realization). |
| 24.2 | P1 | DONE | Empirical fold curve fitting | `fitFoldCurveParams()` in `foldEquityCalculator.js`. Grid search (693 combos) over maxDelta/steepness/midpoint with Brier score + L2 regularization. `decisionAccumulator.js` collects `foldCurveData`, `villainDecisionModel.js` stores `personalizedFoldCurve`. |
| 24.3 | P1 | DONE | Villain range shape–driven sizing | `villainRangeShapeSizing()` in `gameTreeHelpers.js`. Generates preferred/avoided bet sizing candidates based on villain's air-heavy, value-heavy, draw-heavy, capped, or polarized range composition. Integrated into `buildHeroActions()`. |
| 24.4 | P1 | DONE | Multiway fold correlation | `multiwayFoldPct()` now accepts `betFraction` parameter. Pot-odds vs information cascade adjustment: small bets → fewer folds (pot-odds improve), large bets → more folds (cascade). Backward compatible at default 0.75x. |

---

## 25. Game Tree Wiring & Dynamic Parameters (P0-P2)

Wire unused computation into decision pipeline, replace hardcoded constants with context-aware values.

Plan: `.claude/plans/binary-stargazing-hinton.md`

### Session 1 — Wire Existing Computation (Tier 1)

| ID | Sev | Status | Description | Details |
|----|-----|--------|-------------|---------|
| 25.1 | P0 | DONE | Wire personalizedFoldCurve to findOptimalBetSize | 3 call sites in `gameTreeEvaluator.js` now pass `villainModel?.personalizedFoldCurve` + style + spr + street. |
| 25.2 | P1 | DONE | Wire blockerEffects into fold estimation | `estimateFoldPct()` now adjusts fold% based on `blockerEffects.nuts/strong/air` deltas. Blocking nuts → +fold%, blocking air → −fold%. |
| 25.3 | P1 | DONE | Expand sizingTells into fold estimation | `estimateFoldPct()` now uses `sizingTells.correlation` with confidence scaling (`min(1, n/20)`). Positive correlation → +fold%. |
| 25.4 | P1 | DONE | Thread style-conditioned anchors into fallback path | Bucket equity fallback in evaluator output now uses `anchors` (already style-conditioned) instead of raw `BUCKET_EQUITY_ANCHORS`. |

17 new tests, 4,381 total passing.

### Session 2 — Dynamic Parameters (Tier 2)

| ID | Sev | Status | Description | Details |
|----|-----|--------|-------------|---------|
| 25.5 | P1 | DONE | Structured realization lookup table | `REALIZATION_TABLE` (street × position × sprZone) replaces flat REALIZATION + additive SPR hacks. Texture modifiers now multiplicative via `TEXTURE_REALIZATION`. `REALIZATION` backward compat alias. |
| 25.6 | P1 | DONE | Style/street base rates in comboActionProbabilities | `STYLE_BASE_RATE_ADJ` (Fish/Nit/LAG/TAG) applied before texture conditioning with confidence scaling. Turn calibration added. `playerStats` threaded to depth-2 functions. |
| 25.7 | P2 | DONE | Street/position fold curve dimensions + continuous scaling | `FOLD_CURVE_STREET_MODS` + `resolveFoldCurveParams()`. Continuous AF scaling: `1 - 0.05 * clamp((1.5-af)/1.5, -1, 1)`. Continuous VPIP: `1 - 0.08 * clamp((vpip-25)/25, -1, 1)`. LATE position added. |
| 25.8 | P2 | DONE | Seed adaptMultipliers from villain model | `adaptMultipliers(stats, seedMultipliers)` — when seed provided, dampening=0.5 reduces stat adjustment magnitude. `narrowByBoard` passes personalizedMultipliers as seed. |

---

## 26. Game Tree Calibration & Accuracy (P0-P2)

Calibration tightening and enabling already-built features. CTO audit found no new architecture needed.

Plan: `.claude/plans/generic-brewing-wigderson.md`

### Session 1 — High Impact (P0-P1)

| ID | Sev | Status | Description | Details |
|----|-----|--------|-------------|---------|
| 26.1 | P0 | DONE | Enable depth-2 raise response | `enableDepth2Raise` flipped to `true`, gated by `!isTimeBudgetExceeded()`. `computeRaiseResponseDepth2EV` was already implemented but never called. |
| 26.2 | P1 | DONE | Fold% compounding sanity clamp | `clamp(estimate, 0.10, 0.85)` inserted after model/observation blend, before 8 multiplicative adjustments. Prevents extreme base values from amplifying. |
| 26.3 | P1 | DONE | Reduce flop combo equity variance | `miniRolloutEquity` increased from 16→32 samples with flush-stratified turn-card selection. Proportional allocation ensures flush-completing runouts are represented. |
| 26.4 | P1 | DONE | Skip redundant enrichWithEquity | Moved `enrichWithEquity` (300 MC trials) after `comboDistribution`; only runs when combo distribution unavailable. Saves ~300 MC trials on common path. |

### Session 2 — Accuracy (P2)

| ID | Sev | Status | Description | Details |
|----|-----|--------|-------------|---------|
| 26.5 | P2 | DONE | Donk-bet response modeling | OOP check + check-raise branches query villain model with `contextAction: 'donk'` when hero is preflop aggressor. Falls through hierarchy gracefully. |
| 26.6 | P2 | DONE | River observation blend by sample size | `obsWeight = min(0.4, sampleSize/20 * 0.4)` — single observation gets ~2% influence instead of 40%. |
| 26.7 | P2 | DONE | Depth-3 mid-loop time bailout | `startTime` + `timeBudgetMs` threaded into `computeDepth3BarrelEV`. Both turn and flop loops break early with partial weighted average. |
| 26.8 | P2 | DONE | Correct air calling/betting defaults | `POP_CALLING_RATES.air`: 0.15→0.08, `POP_BETTING_RATES.air`: 0.15→0.25. Theory: air bluffs more than it calls. |
| 26.9 | P2 | DONE | Squeeze multiway fold equity | Multiplicative per-opponent model: `raiserFoldPct * pow(callerFoldPct, callerCount)`. Replaces flat +0.15 bonus. |
| 26.10 | P2 | DONE | comboActionProbabilities single-pass refactor | Layers 2-5 accumulate deltas with single renormalization (was 6 independent renormalizations). Layer 6 (model) + 7 (elasticity) + final renorm = 2 total. |

1 new test, 4,411 total passing.

---

## 27. Game Tree & Analysis Accuracy (P0-P2)

Foundation fixes, EV accuracy improvements, and calibration tightening identified by CTO audit.

| ID | Sev | Status | Description | Details |
|----|-----|--------|-------------|---------|
| 27.1 | P1 | DONE | Fix default parameter in computePerComboCheckEV/computeRiverCheckEV | `bettingRates` defaulted to `POP_CALLING_RATES` instead of `POP_BETTING_RATES`. Latent (all callers pass explicit rates). `gameTreeDepth2.js`. |
| 27.2 | P1 | DONE | Lower fold curve fitting thresholds | `MIN_FOLD_CURVE_OBS` 15→8, `MIN_DISTINCT_SIZES` 3→2. Live poker villains face 5-8 bets per session. L2 regularization prevents overfitting. `foldEquityCalculator.js`. |
| 27.3 | P1 | DONE | Add logging to 11 silent catch blocks + depthReached | All `catch (_) {}` replaced with `catch (e) { console.warn(...) }` in `gameTreeEvaluator.js`. Added `treeMetadata.depthReached` field. |
| 27.4 | P1 | DONE | Cap multiplicative fold% adjustments | 8 sequential adjustments now capped to `[baseEstimate * 0.60, baseEstimate * 1.50]` before final 0.05-0.95 clamp. Prevents compound over-correction. `foldEquityCalculator.js`. |
| 27.5 | P1 | DONE | Preflop equity realization discount | Call/raise EV now discounted by `PREFLOP_REALIZATION` (IP: 0.85, OOP: 0.70). All 7 EV branches updated. `preflopAdvisor.js`. |
| 27.6 | P1 | DONE | Category-based Layer 1 in comboActionProbabilities | Score-ratio comparisons replaced with hand category extraction (`(score >> 20) & 0xF`). Fixes intra-category comparisons (top pair vs middle pair). `gameTreeDepth2.js`. |
| 27.7 | P2 | DONE | Depth-3 completion-weighted blend | `computeDepth3BarrelEV` returns `{ev, completed}`. Full completion: 90/10 blend. Partial (time bailout): 70/30 blend. `gameTreeDepth2.js`, `gameTreeEvaluator.js`. |
| 27.8 | P2 | DONE | Trap-aware bet sizing | Villain CR rate >15%: add 0.33x probe-bet. CR rate >25%: filter overbets >1.5x. Uses villain decision model. `gameTreeEvaluator.js`. |

18 new tests, 4,429 total passing.

---

## 28. Reasoning Quality & UI Display (P1) — DONE

Engine reasoning and LiveAdviceBar display enhancements. No EV math changes.

### Session 1 — Reasoning Quality (6 improvements)

| ID | Sev | Status | Description | Details |
|----|-----|--------|-------------|---------|
| 28.1 | P1 | DONE | Blocker effects in reasoning | `describeBlockers()` helper, appends "(blocks X% of nut combos)" to bet/raise/bluff reasoning. |
| 28.2 | P1 | DONE | Breakeven fold% replaces hardcoded 0.50 | Pure bluff section computes `betSize/(pot+betSize)`, shows "need XX%" in reasoning. |
| 28.3 | P1 | DONE | Model confidence in reasoning | `confidenceSuffix()` appends "(solid read, N obs)", "(N obs)", or "(estimated)" based on villainPrediction. |
| 28.4 | P1 | DONE | Range/nut advantage in all reasoning | `advantageNote()` adds advantage context to fold/check/call reasoning, not just special-case bets. |
| 28.5 | P2 | DONE | Trap-aware probe bet reasoning | trapAware flag flows through villainResp, produces "Probe bet (trap-aware)" reasoning. |
| 28.6 | P2 | DONE | Dynamic check-raise threshold explanation | villainCbetPct stored on CR candidate, reasoning shows "exploiting X% c-bet rate". |

### Session 2 — UI Display (4 improvements)

| ID | Sev | Status | Description | Details |
|----|-----|--------|-------------|---------|
| 28.7 | P1 | DONE | Confidence source badge | Green "DATA" / yellow "PARTIAL" / gray "EST" pill badge next to EV in LiveAdviceBar. |
| 28.8 | P1 | DONE | Fold curve tooltip | "···" tap target next to F:XX% shows 6-row fold curve (33%-200% pot) with personalized/style source. |
| 28.9 | P1 | DONE | Advantage badges | Green "R+"/"N+" or red "R-"/"N-" pills for range/nut advantage in row 2 of LiveAdviceBar. |
| 28.10 | P1 | DONE | Reasoning text display | Row 1.5 shows `topRec.reasoning` as 10px single-line text, surfacing all Session 1 improvements. |

24 new tests, 4,479 total passing.

---

## Recommended Execution Order

```
NEXT:   18 Phase 1-2 (hand replay health), 14 Phase 2, 12.4
LATER:  18 Phase 3-4, 5
DEFER:  6 (Firebase), 7 (TypeScript), 8 (Future Ideas)
DONE:   1, 2, 3, 4, 9, 10, 11, 12.1, 12.2, 12.3, 13, 14-Phase 1, 16.1, 16.2, 16.3, 16.4, 17, 21 (all), 22 (all), 23 (all), 24 (all), 25 (all), 26 (all), 27 (all), 28 (all)
PAUSED: 6 (Firebase auth)
```
