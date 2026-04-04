# Project Backlog

Active work items only. Completed items archived in `BACKLOG_ARCHIVE.md`.

**Last updated:** 2026-04-04 | **Current version:** v122

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
| PM-1 | P0 | IN_PROGRESS | Project management architecture overhaul | STATUS.md + handoffs/ + slimmed backlog + updated commands all functional | this session |

---

## NEXT — Ready to Start

_Prioritized items. Claim with `/backlog claim <id>` before starting._

### Roundtable Findings (2026-04-04)

| ID | Pri | Status | Description | Accept Criteria | Claimed By |
|----|-----|--------|-------------|-----------------|------------|
| RT-1 | P0 | NEXT | Commit unstaged exploit engine refactor | All 40+ modified files committed; tests pass on committed HEAD | — |
| RT-2 | P0 | NEXT | NaN firewall at EV pipeline boundaries | No NaN in any advice output; `safeDiv()` in mathUtils.js; `Number.isFinite()` guards at evaluateGameTree entry/exit; 12+ tests | — |
| RT-3 | P0 | NEXT | Flush pending save on session persistence unmount | Rebuy/notes persist when switching views during debounce window; useSessionPersistence + useTournamentPersistence both flush on unmount | — |
| RT-4 | P1 | NEXT | Extension escapeHtml quote escaping | `"` and `'` escaped in render-utils.js; no XSS possible via player names in 64 innerHTML assignments | — |
| RT-5 | P1 | NEXT | Test coverage for extracted game tree modules | heroActionBuilder.js, actionClassifier.js, gameTreeContext.js, liveGameContext.js each have test files with core function + edge case coverage | — |
| RT-6 | P1 | NEXT | Convert comboActionProbabilities to options object | 15 positional params replaced with named options object; all call sites updated; no advice regressions | — |
| RT-7 | P1 | NEXT | Profile game tree on Galaxy A22 | Timing data from physical device; time budget adjusted if >150ms on Helio G80; no UI blocking during live decisions | — |
| RT-8 | P2 | NEXT | TendencyContext per-seat memoization | Per-seat selectors; consumers only re-render when their seat changes; measured before/after render counts | — |
| RT-9 | P2 | NEXT | Add initDB onblocked handler | User-facing message when DB upgrade blocked by another tab; retry logic; test coverage | — |
| RT-10 | P2 | NEXT | Game tree Web Worker migration | evaluateGameTree + MC equity run in Web Worker; main thread unblocked during live play; postMessage interface; fallback for worker failure | — |

### Existing Ready Items

| ID | Pri | Status | Description | Accept Criteria | Claimed By |
|----|-----|--------|-------------|-----------------|------------|
| 12.4 | P2 | NEXT | Table-level exploit aggregation | Aggregate tendencies across all seats shown in TableView ("table is too tight preflop") | — |
| HE-2a | P2 | NEXT | Prominent next-to-act display | Current seat + action buttons more prominent and centrally positioned | — |
| HE-2b | P2 | NEXT | Preflop Quick Entry mode | Positional flow: highlight seat, Fold/Call/Raise, auto-advance, "skip to raiser" | — |
| HE-2c | P2 | NEXT | Showdown simplification | Auto-detect remaining players; heads-up auto-mark winner when other mucks | — |
| CH-2 | P1 | NEXT | Reduce CommandStrip prop explosion | CommandStrip consumes contexts directly instead of ~40 props from TableView | — |
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
NOW:    PM-1 (this session)
NEXT:   RT-1, RT-2, RT-3 (P0 — data safety + correctness)
THEN:   RT-4 (XSS fix), RT-5 (test coverage), CH-2 (prop cleanup)
LATER:  RT-6 through RT-10, 12.4, HE-2a/b/c
DEFER:  6 (Firebase), TS-001 (TypeScript), 5.x (range tools)
```
