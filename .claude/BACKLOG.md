# Project Backlog

Active work items only. Completed items archived in `BACKLOG_ARCHIVE.md`.

**Last updated:** 2026-04-07 | **Current version:** v122

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
| RT-30 | P2 | DONE | Deduplicate computeAllVillainRanges call | `computeAllVillainRanges` called once per compute cycle; preflop widths cached from first call; no second invocation | 2026-04-07 |
| RT-32 | P3 | DONE | Worker crash recovery and health check | Auto-restart (max 3, 100ms delay), rapid crash detection, isWorkerHealthy flag, main-thread fallback | 2026-04-07 |
| RT-33 | P2 | DONE | Extract foldEquityCalculator circular import | `fitFoldCurveParams` + `logisticFoldResponse` moved to villainModelData.js; INV-08 clean | 2026-04-07 |
| RT-34 | P3 | DONE | UNDO_BATCH edge case tests and UX indicator | 7 edge case tests; undo button shows batch count when orbit undo point active | 2026-04-07 |

---

## PAUSED

| ID | Pri | Status | Description | Notes |
|----|-----|--------|-------------|-------|
| 6 | P3 | PAUSED | Firebase Cloud Sync | Auth at Phase 4/6. Resume after core analytics stable. |

---

## Recommended Execution Order

```
1. RT-30 (P2) — Deduplicate computeAllVillainRanges
2. RT-33 (P2) — Extract circular import
3. RT-34 (P3) — UNDO_BATCH edge cases + UX
4. RT-32 (P3) — Worker crash recovery (depends on RT-27+)
```
