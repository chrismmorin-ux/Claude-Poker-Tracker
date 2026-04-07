# Project Backlog

Active work items only. Completed items archived in `BACKLOG_ARCHIVE.md`.

**Last updated:** 2026-04-06 | **Current version:** v122

---

## Status Key

| Status | Meaning |
|--------|---------|
| IN_PROGRESS | Actively being worked by a session (see Claimed By) |
| NEXT | Ready to start, not yet claimed |
| LATER | Planned but not prioritized |
| BLOCKED | Waiting on a prerequisite |
| PAUSED | Started but on hold |
| REVIEW | From eng-engine audit, needs owner approval |

---

## NEXT — Ready to Start

_Prioritized items. Claim with `/backlog claim <id>` before starting._

| ID | Pri | Status | Description | Accept Criteria | Claimed By |
|----|-----|--------|-------------|-----------------|------------|
| RT-27+ | P1 | DONE | Complete Worker migration (RT-27 + RT-29 + RT-31 bundled) | Single Worker instance app-wide via `EquityWorkerContext` at root; `isWorkerReady` as reactive `useState`; `computePreflopAdvice` uses injected `equityFn`; no duplicate Workers; preflop MC offloaded | 2026-04-07 |
| RT-28 | P1 | DONE | FM-004 tendency cascade per-player memoization | Tendency recompute only runs for players with changed handCount; new-player detection; ≥3 tests for selective invalidation | 2026-04-07 |
| RT-30 | P2 | NEXT | Deduplicate computeAllVillainRanges call | `computeAllVillainRanges` called once per compute cycle; preflop widths cached from first call; no second invocation | — |
| RT-32 | P3 | NEXT | Worker crash recovery and health check | Worker auto-restarts after crash (max 3 retries); `isWorkerHealthy` flag exposed; pending promises rejected with clear error | — |
| RT-33 | P2 | NEXT | Extract foldEquityCalculator circular import | `fitFoldCurveParams` extracted to standalone module; no circular dependency between foldEquityCalculator and villainDecisionModel; INV-08 clean | — |
| RT-34 | P3 | NEXT | UNDO_BATCH edge case tests and UX indicator | Tests cover afterIndex=0, afterIndex at boundary, orbit-then-immediate-undo; visual indicator shows batch undo scope | — |

---

## DONE (archive after next session)

| ID | Pri | Status | Description | Completed |
|----|-----|--------|-------------|-----------|
| RT-10 | P2 | DONE | Game tree Web Worker migration (Phase 1) | 2026-04-07 |
| RT-26 | P3 | DONE | Orbit tap-ahead batch undo | 2026-04-07 |

---

## PAUSED

| ID | Pri | Status | Description | Notes |
|----|-----|--------|-------------|-------|
| 6 | P3 | PAUSED | Firebase Cloud Sync | Auth at Phase 4/6. Resume after core analytics stable. |

---

## Recommended Execution Order

```
1. RT-27+ (P1) — Complete Worker migration (singleton + reactive state + preflop threading)
2. RT-28 (P1) — FM-004 tendency per-player memoization
3. RT-30 (P2) — Deduplicate computeAllVillainRanges
4. RT-33 (P2) — Extract circular import
5. RT-34 (P3) — UNDO_BATCH edge cases + UX
6. RT-32 (P3) — Worker crash recovery (depends on RT-27+)
```
