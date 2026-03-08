# Project Backlog

Master execution list. Items ordered by dependency chain and priority.
Start any item with `/project start <id>` or ask Claude to implement it directly.

**Last updated:** 2026-03-07 | **Current version:** v120

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
| 3c | DONE | Range grid panel | Reuses `RangeGrid` + `useRangeProfile`. Position/action pills, 20-hand threshold gate |
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
| 3 | READY | Range vs range comparison UI | `rangeVsRange()` exists but is orphaned (never imported). Needs UI to surface it. |
| 4 | BLOCKED | Save/load custom ranges + presets | Needs interactive range matrix UI first (Phase 1) |

**Note:** `rangeVsRange()` and `adjustRangeByStats()` in exploit engine are orphaned exports — wire or delete.

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
| 2 | READY | Live action advice on table | Wire `useActionAdvisor` into CommandStrip for compact EV display during active hands (see ARCH-005). Highest user-facing impact. |
| 3 | READY | Hand review polish | HandReviewPanel needs: player names (currently shows P{id}), hand count badges, observation severity styling, mobile layout optimization. |
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
| Orphaned engine cleanup | Delete or wire `rangeVsRange()`, `adjustRangeByStats()`, `calcBluffEV()` | Item 5 or standalone |
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
| HE-1b | DONE | Inline card overlay on table view | `CardSelectorPanel.jsx` (full-screen overlay) + `CardSelectorOverlay.jsx` (portal overlay) built, wired into `CommandStrip.jsx`. |
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

## Open Design Questions

1. **Range grid interactivity** — Should the 13x13 grid be interactive (click to toggle combos)? Display-only exists in StatsView + AnalysisView. Interactive editing would enable custom range construction (5.1).
2. ~~**Showdown Bayesian updates**~~ — Resolved. Full pipeline: shown cards → `actionExtractor` → `applyShowdownAnchor()` → semantic boosting → cached in IndexedDB.
3. **Table-level exploits surface** — Show on table view, stats view, or both? Currently only per-player exploits exist. See item 12.4.
4. ~~**useExploitEngine vs usePlayerTendencies**~~ — Resolved. `usePlayerTendencies` imports `generateExploits` directly. Single hook.
5. **Live EV during play** — How prominent should action advice be on TableView? Compact badge vs expandable panel? (See ARCH-005 / item 12.2)

---

## Recommended Execution Order

```
NEXT:   12.2 (live action advice on table), 12.3 (hand review polish)
THEN:   14 Phase 2 (HE-2a, HE-2b, HE-2c)
LATER:  12.4 (table-level exploits), 5 (Range Analysis Tools)
DEFER:  6 (Firebase), 7 (TypeScript), 8 (Future Ideas)
DONE:   1, 2, 3, 4, 9, 10, 11, 12.1, 13, 14-Phase 1
PAUSED: 6 (Firebase auth)
```
