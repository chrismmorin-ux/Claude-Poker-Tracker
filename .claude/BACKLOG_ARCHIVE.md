# Backlog Archive

Completed items moved from BACKLOG.md. Reference only — not loaded automatically.

**Last archived:** 2026-04-04

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
