# Project Backlog

Master execution list. Items ordered by dependency chain and priority.
Start any item with `/project start <id>` or ask Claude to implement it directly.

**Last updated:** 2026-03-05 | **Current version:** v119

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

StatsView currently shows 100% hardcoded placeholder data. Needs real session-scoped stats.

| Step | Status | Description | What to build |
|------|--------|-------------|---------------|
| 2a | READY | Session stats utility | `src/utils/sessionStats.js`: `buildSessionStats(sessionHandIds, allHands)` -> per-seat stats. Filter `getAllHands()` by current session, run `buildPlayerStats`/`derivePercentages` scoped to that subset |
| 2b | READY | Seat grid with real data | Replace hardcoded "45 hands" with actual per-seat hand count. Show player name if assigned. Mini stat line: VPIP / PFR / AF |
| 2c | READY | Selected seat detail panel | Tap a seat -> show preflop stats (VPIP, PFR, 3-bet, Limp) and postflop stats (C-bet IP/OOP, AF, WTSD, Fold to C-bet) for that seat this session |
| 2d | READY | Table dynamics placeholder | Static stub section: "Table Dynamics (Coming Soon)" below seat stats. Future: aggregate table-level tendencies |

**Depends on:** Nothing — tendencyCalculations.js already has the stat engine.
**Key insight:** Session-scoped stats reuse the same `buildPlayerStats`/`derivePercentages` pipeline but filter hands by `sessionId` first.

---

## 3. Analysis View Stub (P3) — from `docs/DESIGN_UX_REVIEW.md` Change 3

New view for deliberate between-session analysis. Start as a stub with real UI but placeholder computation.

| Step | Status | Description | What to build |
|------|--------|-------------|---------------|
| 3a | READY | Analysis view component | `src/components/views/AnalysisView.jsx`: player dropdown, session filter, three placeholder panels (Range Estimation, Board Equity, Exploit Generation) |
| 3b | READY | Navigation + routing | Add `SCREEN.ANALYSIS` to ViewRouter, add nav link to CollapsibleSidebar (chart/grid icon) |
| 3c | READY | 13x13 range grid (display only) | `src/components/ui/RangeMatrix.jsx`: standard poker range matrix. Pairs on diagonal, suited above, offsuit below. Color-coded cells. Display only — no computation yet. Shows "Requires 20+ hands" when insufficient data |
| 3d | BLOCKED | Player/session selection UI | Dropdown of players with hands, session filter. Wire to range grid display. Blocked on: range grid component (3c) |

**Depends on:** Nothing for the stub. Computation comes in Phase 4.

---

## 4. Statistical Engine (P4) — Partially built by Exploit Engine

Heavy computation. Core modules now exist in `src/utils/exploitEngine/`. UI integration pending.

| Step | Status | Description | Notes |
|------|--------|-------------|-------|
| 4a | DONE | Range estimation from stats | `rangeMatrix.js`: 13x13 grid, 9 preflop charts, `adjustRangeByStats`, `narrowByAction` |
| 4b | BLOCKED | Showdown observations | Record shown cards for Bayesian refinement. Needs showdown data model. Blocked on: item 9 integration |
| 4c | DONE | Board equity computation | `equityCalculator.js`: Monte Carlo hand-vs-range, range-vs-range. `boardTexture.js`: wet/dry/paired classification |
| 4d | DONE | Algorithmic exploit generation | `exploitSuggestionsV2.js`: 11 advanced rules (position, board, range-equity). Orphaned — needs wiring |

**Key insight:** Computation layer is built. What's missing is UI integration (item 9) and data quality fixes (item 9.1).

---

## 5. Range Analysis Tools (P4) — `docs/projects/4.001.1209-range-analysis.project.md`

Interactive range tools. Computation layer now exists; UI layer still needed.

| Phase | Status | Description | Notes |
|-------|--------|-------------|-------|
| 1 | BLOCKED | Interactive range matrix UI | Extends 3c (display-only grid -> interactive). `rangeMatrix.js` provides data layer |
| 2 | DONE | Equity calculator | `equityCalculator.js` — Monte Carlo, chunked async |
| 3 | BLOCKED | Range vs range comparison UI | `rangeVsRange()` exists but needs UI + tests |
| 4 | BLOCKED | Save/load custom ranges + presets | Needs range matrix UI first |

**Recommendation:** Item 3c (range grid display) is the next blocker. Once that ships, interactive tools build on existing engine.

---

## 9. Exploit Engine — Integration & Quality (P1)

Engine modules built in `src/utils/exploitEngine/` (6 modules, 62 tests). Audit revealed critical integration gaps and code quality issues. This is the highest-priority work item.

### 9.1 Integration Wiring (CRITICAL — engine is orphaned)

| ID | Status | Description | Details |
|----|--------|-------------|---------|
| EE-INT-1 | READY | Wire `getSuggestionsV2` into `PlayerRow.jsx` | Replace V1 `getSuggestions` import with V2. Pass `positionStats` + `boardTexture` through. Backward-compatible output shape. |
| EE-INT-2 | READY | Wire `useExploitEngine` into component tree | Either replace `usePlayerTendencies` in consumers, or merge engine features into existing hook. Must provide `positionStats` per player + `boardTexture` + `calculateEquity`. |
| EE-INT-3 | READY | Add `deriveCategoryPercentages` to barrel export | Missing from `exploitEngine/index.js`. Used by `exploitSuggestionsV2.js` via direct import. |

### 9.2 Source Code Bugs (HIGH)

| ID | Status | Description | Details |
|----|--------|-------------|---------|
| EE-BUG-1 | READY | Fix `adjustRangeByStats` tighter-player logic | `rangeMatrix.js:154-175`: mixes hand count with VPIP ratio, double-penalizes weak hands. Replace with uniform proportional scaling. |
| EE-BUG-2 | READY | Track/compensate skipped trials in equity calculator | `equityCalculator.js:82-83`: villain card conflicts silently reduce sample size. Add skip counter, increase batch to compensate. |
| EE-BUG-3 | READY | Fix misleading fold comment in `narrowByAction` | `rangeMatrix.js:219-221`: comment says opposite of what code does. |
| EE-BUG-4 | READY | Guard `observedVpip < 0` in `adjustRangeByStats` | `rangeMatrix.js:136`: negative ratio would produce NaN. |

### 9.3 Preflop Chart Validation (HIGH)

| ID | Status | Description | Details |
|----|--------|-------------|---------|
| EE-DATA-1 | READY | Validate all 9 preflop charts against GTO ranges | UTG was originally 6% (should be ~15%), manually expanded. Other positions may be off. Add test asserting each position's width within ±5% of expected. |
| EE-DATA-2 | READY | Board texture wetness formula calibration | Baseline needed manual tuning (50->30) to make AK2r dry. Validate against known board textures: 10+ boards with expected classifications. |

### 9.4 Test Coverage Gaps (HIGH)

| ID | Status | Description | Details |
|----|--------|-------------|---------|
| EE-TEST-1 | READY | Test `rangeVsRange()` | Exported function with zero tests. Add basic equity sanity checks. |
| EE-TEST-2 | READY | Test 8 untested V2 rules | `btn-too-wide`, `oop-aggro-ip-passive`, `wet-board-equity`, `paired-board-check`, `continue-range-wide`, `high-fold-equity`, `3bet-polarized`, `capped-calling-range` |
| EE-TEST-3 | READY | Test IP/OOP position routing | `positionStats.byRelativePosition` structure exists but correctness unverified. |
| EE-TEST-4 | READY | Test hand evaluator kicker ordering | AAKKQ vs AAKK5, flush kicker comparison, full hierarchy edge cases. |
| EE-TEST-5 | READY | Test board texture on 4-card and 5-card boards | Only 3-card flop tested. Turn/river boards need coverage. |
| EE-TEST-6 | READY | Test equity with board cards | All equity tests use empty board. Add flop/turn/river scenarios. |
| EE-TEST-7 | READY | Test `useExploitEngine` hook | Zero test coverage. Test `calculateEquity` callback, board texture memoization. |
| EE-TEST-8 | READY | Tighten equity test tolerances | AA vs random allows 75-95% (true ~85%). Increase trials or narrow bounds. |

### 9.5 Cleanup (LOW)

| ID | Status | Description | Details |
|----|--------|-------------|---------|
| EE-CLEAN-1 | READY | Remove unused exports | `createPositionStats`, `POSITION_CATS` from `positionStats.js` and `index.js` |
| EE-CLEAN-2 | READY | Add logging for hands missing `seatPlayers` | `positionStats.js`: old hands silently skipped by `findPlayerSeat()` returning null |
| EE-CLEAN-3 | READY | `narrowByAction` postflop heuristic note | Preflop-only hand-strength normalization doesn't account for board interaction. Add JSDoc warning. Known limitation, not a bug. |

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

## 11. Context Migration Completion (P2) — Project 0.009

PokerTracker.jsx (861 lines) prop-drills 20+ handlers to views that already import contexts. Complete the migration.

| Phase | Status | Description | Details |
|-------|--------|-------------|---------|
| 1 | READY | Audit & plan | Map every prop drilled from PokerTracker.jsx to child views. Identify which are already available via contexts. Design handler migration. |
| 2 | BLOCKED | Migrate views | Move remaining handlers into contexts/hooks. Update all views to consume contexts directly. Target: PokerTracker.jsx < 200 lines. Blocked on: Phase 1 audit. |

**Risk:** Medium — touches all views, requires comprehensive testing.

---

## 12. Exploit Engine UI Integration Research (P3) — Project 0.010

Equity calculator + hand evaluator (~800 lines) are built but not wired to any UI.

| Phase | Status | Description | Details |
|-------|--------|-------------|---------|
| 1 | READY | Research & recommend | Evaluate whether equity calculations provide user-facing value in a live tracking context. 1-page recommendation with mockup. |

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
| ARCH-001 | PokerTracker.jsx decomposition | READY | Currently ~861 lines. Project 0.009 (context migration) addresses this — target <200 lines. |
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

## 13. Range Equity & EV Analysis (P1) -- Project 0.011

Board-aware range narrowing, equity segmentation, fold equity EV, bet sizing optimization.

| Phase | Status | Description | Entry Criteria |
|-------|--------|-------------|----------------|
| 1 | DONE | Board-aware postflop range narrowing | None |
| 1b | BLOCKED | Replace hardcoded action multipliers with equity-derived weights | Phase 3 (needs per-combo equity) |
| 2 | BLOCKED | Range equity segmentation (buckets) | Phase 1 merged |
| 3 | BLOCKED | Fold equity & EV calculator | Phase 2 merged |
| 4 | BLOCKED | Bet sizing optimization + UI | Phase 3 merged |

---

## Open Design Questions

1. **Range grid interactivity** — Should the 13x13 grid be interactive (click to toggle combos)? Start display-only (3c), add interactivity later (5.1)?
2. **Showdown Bayesian updates** — How should range estimates update when a player shows cards? Need observation data model.
3. **Table-level exploits surface** — Show on table view, stats view, or both? Currently only per-player exploits exist.
4. **useExploitEngine vs usePlayerTendencies** — Replace existing hook or keep both? Engine hook is a superset but doubles computation. Recommend: extend `usePlayerTendencies` to optionally compute position stats, keep single hook.

---

## Recommended Execution Order

```
NOW:    10.1 Dead code removal (DC-1..6) — low risk, immediate codebase hygiene
NEXT:   10.2 Documentation sync (DOC-1..4) — context files match reality
THEN:   9.1 Exploit Engine integration (EE-INT-1..3) — engine is built but orphaned
THEN:   9.2 Bug fixes (EE-BUG-1..4) — fix before users see bad data
THEN:   11 Context migration — reduce PokerTracker.jsx, complete provider pattern
LATER:  9.3-9.4 Data validation + test coverage
DEFER:  2, 3, 5-8, 12 — resume after engine is stable and codebase is clean
```
