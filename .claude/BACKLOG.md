# Project Backlog

Master execution list. Items ordered by dependency chain and priority.
Start any item with `/project start <id>` or ask Claude to implement it directly.

**Last updated:** 2026-03-06 | **Current version:** v120

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

## 3. Analysis View Stub (P3) — from `docs/DESIGN_UX_REVIEW.md` Change 3

Between-session analysis screen. Player selection, session filter, three panels (range real, two stubs).

| Step | Status | Description | What to build |
|------|--------|-------------|---------------|
| 3a | DONE | Analysis view component | `src/components/views/AnalysisView.jsx`: player dropdown, session filter, three panels |
| 3b | DONE | Navigation + routing | `SCREEN.ANALYSIS` in uiReducer, sidebar nav button, ViewRouter case |
| 3c | DONE | Range grid panel (real) | Reuses `RangeGrid` + `useRangeProfile`. Position/action pills, 20-hand threshold gate |
| 3d | DONE | Player/session selection UI | Player dropdown from `allPlayers`, session dropdown from `allSessions` (cosmetic filter) |

**Complete.** Board Equity and Exploit Generation panels are placeholder stubs.

---

## 4. Statistical Engine (P4) — Partially built by Exploit Engine

Heavy computation. Core modules now exist in `src/utils/exploitEngine/`. UI integration pending.

| Step | Status | Description | Notes |
|------|--------|-------------|-------|
| 4a | DONE | Range estimation from stats | `rangeMatrix.js`: 13x13 grid, 9 preflop charts, `adjustRangeByStats`, `narrowByAction` |
| 4b | BLOCKED | Showdown observations | Record shown cards for Bayesian refinement. Needs showdown data model. Blocked on: item 9 integration |
| 4c | DONE | Board equity computation | `equityCalculator.js`: Monte Carlo hand-vs-range, range-vs-range. `boardTexture.js`: wet/dry/paired classification |
| 4d | DONE | Algorithmic exploit generation | `exploitSuggestionsV2.js`: 11 advanced rules (position, board, range-equity). Orphaned — needs wiring |

**Key insight:** Computation layer is built and wired via `usePlayerTendencies` + `TableView`. Only 4b (showdown observations) remains open.

---

## 5. Range Analysis Tools (P4) — `docs/projects/4.001.1209-range-analysis.project.md`

Interactive range tools. Computation layer now exists; UI layer still needed.

| Phase | Status | Description | Notes |
|-------|--------|-------------|-------|
| 1 | BLOCKED | Interactive range matrix UI | Extends 3c (display-only grid -> interactive). `rangeMatrix.js` provides data layer |
| 2 | DONE | Equity calculator | `equityCalculator.js` — Monte Carlo, chunked async |
| 3 | BLOCKED | Range vs range comparison UI | `rangeVsRange()` exists with tests; needs UI |
| 4 | BLOCKED | Save/load custom ranges + presets | Needs range matrix UI first |

**Recommendation:** Item 3c (range grid display) is the next blocker. Once that ships, interactive tools build on existing engine.

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

## 12. Exploit Engine UI Integration Research (P3) — Project 0.010

AnalysisView panels 2 & 3 are functional end-to-end. Action advisor pipeline wired through `useActionAdvisor`. Remaining work is UX polish and refinement.

| Phase | Status | Description | Details |
|-------|--------|-------------|---------|
| 1 | READY | UX polish & refinement | Evaluate AnalysisView UX: loading states, result formatting, mobile layout. Rescoped from pure research to polish. |

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
| Table-level exploits | Aggregate tendencies across all seats ("table is too tight preflop") | Stats View real data (item 2) |

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

## Open Design Questions

1. **Range grid interactivity** — Should the 13x13 grid be interactive (click to toggle combos)? Start display-only (3c), add interactivity later (5.1)?
2. **Showdown Bayesian updates** — How should range estimates update when a player shows cards? Need observation data model.
3. **Table-level exploits surface** — Show on table view, stats view, or both? Currently only per-player exploits exist.
4. **~~useExploitEngine vs usePlayerTendencies~~** — Resolved. `usePlayerTendencies` imports `generateExploits` directly. Single hook, no duplication.

---

## Recommended Execution Order

```
NEXT:   12 UX polish for AnalysisView panels
LATER:  5 Range Analysis Tools (interactive UI on top of engine)
DEFER:  6 (Firebase), 7 (TypeScript), 8 (Future Ideas)
DONE:   1, 2, 3, 4a/c/d, 9, 10, 11, 13
BLOCKED: 4b (showdown observations)
PAUSED: 6 (Firebase auth)
```
