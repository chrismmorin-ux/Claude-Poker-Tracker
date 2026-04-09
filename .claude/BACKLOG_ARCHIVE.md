# Backlog Archive

Completed items moved from BACKLOG.md. Reference only — not loaded automatically.

**Last archived:** 2026-04-07

---

## R5 Sprint (2026-04-07) — ALL DONE

| ID | Pri | Description | Resolution |
|----|-----|-------------|------------|
| RT-35 | P1 | Break handAnalysis → exploitEngine coupling (INV-08 fix) | Moved monteCarloEquity.js to pokerCore/. Injected 4 exploitEngine deps into replayAnalysis via deps param. |
| RT-37 | P1 | Next Hand undo toast | Extended toast system with action buttons. 5s undo window restores game/card state + hand count. |
| RT-36 | P2 | React.memo for SeatComponent | Added React.memo with custom comparator. Wrapped 2 callbacks in useCallback in TableView. |
| RT-38 | P2 | Fix adjustedRealization double-discount + floor | Removed blanket r*=0.85 when opponentModels present. Added Math.max(r, 0.30) floor. 3 new tests. |
| RT-39 | P2 | Atomic saveHand transaction (TOCTOU fix) | Combined count + add into single readwrite IDB transaction. |
| RT-40 | P3 | Worker restart counter reset | Added 5-minute healthy timer that resets restartCountRef to 0. Cleared on crash/unmount. |
| RT-41 | P3 | NaN guard for zero-weight drawCombos | Added isFinite guard on protectionBonus before adding to EV. |
| RT-42 | P3 | Extension postMessage origin validation | Replaced '*' with window.location.origin in probe. Added event.origin check in capture listener. |

---

## 1. Player Tendencies (P2) — DONE

Core analytics pipeline. Phases 1-7 shipped.

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | DONE | VPIP/PFR/AF engine — `tendencyCalculations.js`, 34 tests |
| 2 | DONE | actionSequence + Hand Timeline — `handTimeline.js` |
| 3 | DONE | 3-bet%, C-bet% via timeline |
| 4 | DONE | Players View stats display |
| 5 | DONE | Custom exploit notes per player |
| 6 | DONE | Auto-classification + exploit suggestions (V1) |
| 7 | DONE | Table seat exploit badges |

---

## 2. Stats View — Real Session Data (P2) — DONE

All 4 steps complete (session stats, seat grid, detail panel, table dynamics placeholder).

---

## 3. Analysis View (P3) — DONE

All 7 steps complete (component, routing, range grid, player/session selection, equity panel, recommendations, hand review).

---

## 4. Statistical Engine (P4) — DONE

All 4 steps complete (range estimation, showdown observations, board equity, algorithmic exploits).

---

## 9. Exploit Engine — Integration & Quality (P1) — DONE

All 5 sub-sections complete: Integration Wiring (3), Source Code Bugs (4), Preflop Chart Validation (2), Test Coverage (8), Cleanup (3).

---

## 10. Dead Code & Documentation Cleanup (P1) — DONE

Phase 1 (6 dead code items) and Phase 2 (4 doc sync items) complete.

---

## 11. Context Migration Completion (P2) — DONE

PokerTracker.jsx reduced from 861 to 93 lines. Zero-prop-drilling pattern.

---

## 12. Exploit Engine UI Integration (P2) — Phases 1-3 DONE

Phases 1-3 complete (AnalysisView, live action advice, hand review polish). Phase 4 (table-level exploit aggregation) tracked in active backlog.

---

## 13. Range Equity & EV Analysis (P1) — DONE

All phases (1, 1b, 2, 3, 4) complete. Board-aware narrowing, equity segmentation, fold equity EV, action advisor pipeline. 62+ tests.

---

## 14. Hand Entry Speed — Phase 1 DONE

Quick wins (HE-1a through HE-1c) complete: rest fold, inline card overlay, auto-select seat. Phase 2 (flow restructuring) tracked in active backlog.

---

## 16. Weakness Detection Layer (P1) — DONE

All 4 phases complete: hand replay EV, weakness detection module, exploit-weakness linkage, full UI integration.

---

## 17. CTO Audit Fixes (P0-P2) — DONE

All 5 items complete: TendencyProvider, dead reducer code, duplicate parseBlinds, orphaned adjustRangeByStats, doc sync.

---

## 18. Hand Replay Health (P1-P2) — DONE

All 4 phases complete: decompose useHandReplayAnalysis (5 items), fix wiring/dedup (4 items), dead code extraction (3 items), test coverage (4 items).

---

## 20. Ignition Extension Audit (P1-P3) — DONE

All 8 items (IG-1 through IG-8) complete.

---

## 21. Analysis Quality Overhaul (P0) — DONE

All items complete: fold% fix (21.1), Bayesian credible intervals (21.2), confidence display (21.3), contextual tracking (21.4a), villain model (21.4b), game tree evaluator (21.4c), actionAdvisor replacement (21.4d), WEAKNESS_EXPLOIT_MAP removal (21.5).

---

## 22. Action Advice Quality (P1) — DONE

All 37 items (22.1-22.37) complete. Major: combo-counted equity distribution, texture-aware realization, analytical equity for sparse ranges, semi-bluff accounting, overcard quality adjustment.

---

## 23. Game Tree & Analysis Improvements (P0-P2) — DONE

All 13 items (23.1-23.13) complete. Major: flop miniRollout equity, CR depth-2, IP check depth-2, polarization sizing, blocker bluffs, elastic calling, equity denial scaling.

---

## 24. Game Tree Tier 1 Improvements (P0-P1) — DONE

All 4 items complete: river per-combo eval (24.1), empirical fold curves (24.2), villain range shape sizing (24.3), multiway fold correlation (24.4). 72 new tests.

---

## 25. Game Tree Wiring & Dynamic Parameters (P0-P2) — DONE

All 8 items across 2 sessions complete. Session 1: personalized fold curves, blocker effects, sizing tells, style-conditioned anchors. Session 2: realization table, style base rates, street fold curves, seed adaptMultipliers. 46 new tests.

---

## 26. Game Tree Calibration & Accuracy (P0-P2) — DONE

All 10 items across 2 sessions complete. Session 1: depth-2 raise enable, fold% clamping, variance reduction, skip redundant enrichment. Session 2: donk-bet modeling, river observation blend, depth-3 bailout, air rate correction, squeeze model, combo refactor.

---

## 27. Game Tree & Analysis Accuracy (P0-P2) — DONE

All 8 items complete: default param fix (27.1), fold curve thresholds (27.2), catch block logging (27.3), fold% compound cap (27.4), preflop realization (27.5), category-based Layer 1 (27.6), depth-3 blend (27.7), trap-aware sizing (27.8). 18 new tests.

---

## 28. Reasoning Quality & UI Display (P1) — DONE

All 10 items across 2 sessions complete. Session 1: blocker effects, breakeven fold%, model confidence, range/nut advantage, trap-aware probe, dynamic CR threshold. Session 2: confidence badge, fold curve tooltip, advantage badges, reasoning text. 24 new tests.

---

## Roundtable R2 Findings (2026-04-04) — DONE

All 19 findings from eng-engine R2 audit. 17 completed 2026-04-04, RT-7 and RT-10 deferred to active backlog.

| ID | Pri | Description | Resolution |
|----|-----|-------------|------------|
| RT-1 | P0 | Commit unstaged exploit engine refactor | 89 files committed (741a47c); 4,660 tests passing |
| RT-2 | P0 | NaN firewall at EV pipeline boundaries | safeDiv() added, operator precedence fix, division guards; 13 new tests (6783133) |
| RT-3 | P0 | Flush pending save on session persistence unmount | 3 hooks flush pending save on unmount via pendingSaveRef (b52cdbb) |
| RT-4 | P1 | Extension escapeHtml quote escaping | `"` and `'` escaped; 879 extension tests pass (76bd54a) |
| RT-5 | P1 | Test coverage for extracted game tree modules | 4 test files, 215 new tests (d61c908) |
| RT-6 | P1 | Convert comboActionProbabilities to options object | 15→1 options + 16→1 options; 8 production + 22 test call sites updated |
| RT-8 | P2 | TendencyContext per-seat memoization | useSeatTendency(playerId) selector with stable reference |
| RT-9 | P2 | Add initDB onblocked handler | onblocked handler rejects with user-facing message |
| RT-11 | P0 | Extension: downgrade chrome.storage.session | Removed UNTRUSTED access; refactored app-bridge to port pushes |
| RT-12 | P0 | Stabilize softmax in game tree | stableSoftmax (log-sum-exp trick) in mathUtils.js; 10 new tests |
| RT-13 | P1 | Verify calcFoldEquity formula | Verified correct — no fix needed |
| RT-14 | P1 | Add confirmation guard to Reset Hand | window.confirm guard in CommandStrip.jsx |
| RT-15 | P1 | Escape innerHTML in extension popup | All values wrapped in escapeHtml() |
| RT-16 | P1 | Break foldEquityCalculator circular import | Already resolved — villainModelData.js is neutral hub |
| RT-17 | P2 | Object.freeze villainModelData tables | deepFreeze on 11 exported objects |
| RT-18 | P2 | Surface advice staleness in LiveAdviceBar | 5s clock + street mismatch; fading at 20s, STALE badge at 60s |
| RT-19 | P2 | Test coverage for 6 untested modules | 6 test files, 502 new tests |

---

## CH Items (Code Health, 2026-04-04) — DONE

| ID | Description | Resolution |
|----|-------------|------------|
| CH-2 | Reduce CommandStrip prop explosion | Verified already resolved — 2 props + 8 contexts |

---

## R4 Roundtable Items (2026-04-07) — DONE

| ID | Pri | Description | Resolution |
|----|-----|-------------|------------|
| RT-27+ | P1 | Complete Worker migration (singleton + reactive state + preflop threading) | EquityWorkerContext at root, isWorkerReady useState, equityFn threaded through preflop |
| RT-28 | P1 | FM-004 tendency cascade per-player memoization | Per-player cache keyed on {playerId}:{handCount}, selective invalidation |
| RT-10 | P2 | Game tree Web Worker migration (Phase 1) | MC equity offloaded to equityWorker.js |
| RT-26 | P3 | Orbit tap-ahead batch undo | UNDO_BATCH reducer action, orbitUndoPointRef in CommandStrip |
| RT-30 | P2 | Deduplicate computeAllVillainRanges call | computeAllVillainRanges called once per cycle; preflop widths cached |
| RT-32 | P3 | Worker crash recovery and health check | Auto-restart (max 3, 100ms delay), rapid crash detection, isWorkerHealthy flag |
| RT-33 | P2 | Extract foldEquityCalculator circular import | fitFoldCurveParams + logisticFoldResponse moved to villainModelData.js; INV-08 clean |
| RT-34 | P3 | UNDO_BATCH edge case tests and UX indicator | 7 edge case tests; undo button shows batch count when orbit undo point active |
