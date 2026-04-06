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

## NOW — In Progress

_Items actively being worked. Check `.claude/handoffs/` for session details._

| ID | Pri | Status | Description | Accept Criteria | Claimed By |
|----|-----|--------|-------------|-----------------|------------|
| GOV-1 | P0 | IN_PROGRESS | Governance & workflow overhaul (5-phase) | Programs system, INVARIANTS.md, failure library, health snapshots, staleness detection, auto-archival, health-check command, CONSTRAINTS.md, WSJF scoring — all integrated into commands | this session |

---

## NEXT — Ready to Start

_Prioritized items. Claim with `/backlog claim <id>` before starting._

### Roundtable Remaining (from R2, 2026-04-04)

| ID | Pri | Status | Description | Accept Criteria | Claimed By |
|----|-----|--------|-------------|-----------------|------------|
| RT-7 | P1 | NEXT | Profile game tree on Galaxy A22 | Timing data from physical device; time budget adjusted if >150ms on Helio G80; no UI blocking during live decisions | — |
| RT-10 | P2 | NEXT | Game tree Web Worker migration | evaluateGameTree + MC equity run in Web Worker; main thread unblocked during live play; postMessage interface; fallback for worker failure | — |

### Existing Ready Items

| ID | Pri | Status | Description | Accept Criteria | Claimed By |
|----|-----|--------|-------------|-----------------|------------|
| 12.4 | P2 | NEXT | Table-level exploit aggregation | Aggregate tendencies across all seats shown in TableView ("table is too tight preflop") | — |
| HE-2a | P2 | NEXT | Prominent next-to-act display | Current seat + action buttons more prominent and centrally positioned | — |
| HE-2b | P2 | NEXT | Preflop Quick Entry mode | Positional flow: highlight seat, Fold/Call/Raise, auto-advance, "skip to raiser" | — |
| HE-2c | P2 | NEXT | Showdown simplification | Auto-detect remaining players; heads-up auto-mark winner when other mucks | — |
| CH-4 | P2 | NEXT | Remove raw dispatchUi from UIContext | Named action dispatchers instead of raw dispatch | — |
| CH-6 | P3 | NEXT | Add structured error logging to usePlayerTendencies | Catch blocks log structured errors instead of swallowing silently | — |

---

## LATER — Planned

| ID | Pri | Status | Description | Accept Criteria | Claimed By |
|----|-----|--------|-------------|-----------------|------------|
| 5.1 | P4 | BLOCKED | Interactive range matrix UI | Click-to-toggle 13x13 grid extends existing RangeGrid | — |
| 5.4 | P4 | BLOCKED | Save/load custom ranges | Needs interactive range matrix (5.1) first | — |

---

## PAUSED

| ID | Pri | Status | Description | Notes |
|----|-----|--------|-------------|-------|
| 6 | P3 | PAUSED | Firebase Cloud Sync | Auth at Phase 4/6. Resume after core analytics stable. |
| TS-001 | P4 | BLOCKED | TypeScript migration | Low priority, after feature work stabilizes |

---

## Architecture Watch

_Deferred findings. No action unless triggers are hit._

| ID | Finding | Trigger |
|----|---------|---------|
| ARCH-002 | UIContext: 27 items, 28-dep useMemo | >40 items or measured perf regression |
| ARCH-003 | TableView: 594 lines, 25 handlers | >700 lines |
| ARCH-004 | PlayersView: 562 lines, 15 handlers | >700 lines |
| ARCH-005 | actionAdvisor only in AnalysisView | After HE-2a/2b/2c complete |

---

## Future Ideas (Unscoped)

| Idea | Description | Prerequisite |
|------|-------------|--------------|
| Trend lines | Stats over time — tilt detection | Stats engine |
| Session heat maps | Profit by hour/day | Session data |
| Mobile PWA | Home screen install | None |
| Swipe gestures | Swipe fold/call on seats | Hand entry speed (14) |
| Template hands | Quick-entry: "limped pot", "standard open + 1 caller" | Hand entry speed (14) |
| Multi-villain equity | Equity vs multiple opponents simultaneously | useLiveEquity refactor |

---

## Open Design Questions

1. **Range grid interactivity** — Should 13x13 grid be interactive (click to toggle combos)? Display-only exists. Interactive enables custom range construction (5.1).
2. **Table-level exploits surface** — Show on table view, stats view, or both? See 12.4.

---

## Recommended Execution Order

```
NEXT:      RT-7 (device profiling), HE-2a/2b/2c (hand entry UX)
THEN:      12.4 (table exploits), CH-4 (UIContext cleanup), RT-10 (Web Worker)
LATER:     CH-6 (error logging)
DEFER:     6 (Firebase), TS-001 (TypeScript), 5.x (range tools)
```
