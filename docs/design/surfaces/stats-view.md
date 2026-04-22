# Surface — Stats View

**ID:** `stats-view`
**Code paths:**
- `src/components/views/StatsView.jsx` (296 lines — single-file view)
- `src/components/ui/RangeGrid.jsx` — 13×13 grid rendering
- `src/components/ui/ScaledContainer.jsx`
- `src/hooks/useSessionStats.js` — per-seat stats for the current session
- `src/contexts/TendencyContext.jsx` — `tendencyMap` (cross-session aggregated)
- `src/utils/rangeEngine/*` — `RANGE_POSITIONS`, range profile shape

**Route / entry points:**
- `SCREEN.STATS`.
- Opens from: bottom-nav during an active session; secondary from Players / Session review.
- Closes to: `TableView` via "Back to Table" button.

**Product line:** Main app
**Tier placement:** Plus+ (full per-seat range profiles + position-split tables). Basic VPIP/PFR exposed in Free.
**Last reviewed:** 2026-04-21

---

## Purpose

At-a-glance live-session dashboard: for each of the 9 seats in the current session, show hand count, core frequencies (VPIP / PFR / 3-bet / fold-to / cbet), and the selected seat's full per-position range profile (first-in + facing-a-raise split, with showdown-anchor overlays on the 13×13 grid).

## JTBD served

Primary:
- `JTBD-SR-23` highlight "leakiest" seats / range deviations at a glance
- `JTBD-SR-24` filter by position (per-seat, per-position range view)
- (implicit) identify hero vs. villain frequency gaps in-session

Secondary:
- `JTBD-MH-03` check bluff-catch frequency context (read, not decide)
- `JTBD-SR-88` similar-spot context via the range grid (proposed; not wired)

## Personas served

- [Chris](../personas/core/chris-live-player.md) — primary (reads stats between hands)
- [Rounder](../personas/core/rounder.md) — primary consumer of per-seat range profiles
- [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md), [Circuit Grinder](../personas/core/circuit-grinder.md) — primary
- [Multi-Tabler](../personas/core/multi-tabler.md) — partial (sidebar is their primary surface; this view is post-session cash verification)
- [Apprentice](../personas/core/apprentice-student.md), [Coach](../personas/core/coach.md) — reviewing student/seat tendencies
- [Post-session Chris](../personas/situational/post-session-chris.md) — situational primary

---

## Anatomy

```
┌─────────────────────────────────────────────────────┐
│ Session Stats                        [Back to Table]│
├─────────────────────────────────────────────────────┤
│ Seat selector grid (5 × 2 buttons)                  │
│   [S1] [S2] [S3] [S4] [S5]                           │
│   [S6] [S7] [S8] [S9]                                │
│   selected seat highlighted, mySeat accented blue   │
├─────────────────────────────────────────────────────┤
│ Selected seat stat block                            │
│   VPIP  PFR  AF  3-bet  cbet  fold-to-cbet          │
├─────────────────────────────────────────────────────┤
│ Range Profile (per-position)                        │
│   First In:    Pos | Fold | Limp | Open | n         │
│   Facing Raise: Pos | Fold | CC   | 3B   | n         │
├─────────────────────────────────────────────────────┤
│ 13×13 RangeGrid with showdown anchors overlaid       │
│   grid position / action toggles                    │
└─────────────────────────────────────────────────────┘
```

Wrapped in `ScaledContainer` with width/height pinned to `LAYOUT.TABLE_WIDTH/HEIGHT`.

## State

- **Game (`useGame`):** `mySeat` (defaults selectedSeat to hero's seat on mount).
- **Session (`useSession`):** `currentSession` → `sessionId`.
- **Player (`usePlayer`):** `seatPlayers`, `getSeatPlayerName`.
- **Tendency (`useTendency`):** `tendencyMap` → per-player range profile + range summary.
- **Derived via `useSessionStats(sessionId, seatPlayers)`:** `seatStats` map (hands, frequencies), `isLoading`.
- **Local:** `selectedSeat`, `gridPosition` ('EARLY' | 'MIDDLE' | 'LATE' | 'BLINDS'), `gridAction` ('open' | 'call' | '3bet' etc.).
- Writes: none — read-only view.

## Props / context contract

- `scale: number` — viewport scale.

## Key interactions

1. **Tap a seat button** → updates `selectedSeat` → all panels rerender for that seat.
2. **Toggle grid position / action** → re-filters `showdownAnchors` via `useMemo`.
3. **Back to Table** → `setCurrentScreen(SCREEN.TABLE)`.

---

## Known behavior notes

- **No active session** case: empty state with BarChart3 icon + prompt to start a session.
- **Loading case:** "Loading stats..." placeholder while `useSessionStats` resolves.
- **Range profile comes from cross-session data** (`TendencyContext`), so a seat with 3 hands this session may still show a substantial range profile if the same player has prior sessions.
- **Session-level stats come from this session only** (`useSessionStats`). Source-of-truth asymmetry between the two halves of the view — not surfaced to the user.
- **`noRaiseFreqs` vs `facedRaiseFreqs`** — range summary splits by "first in" vs "facing a raise" (two tables).

## Known issues

- **DCOMP-W2-A3 audit shipped 2026-04-22 (verdict YELLOW).** 9 findings: 0 P0 (read-only surface), 3 P1 (touch targets <44 on seat-selector + toggles + Back; sample-size + confidence rendering missing; dual-source scope labeling asymmetry), 3 P2 (position-group filter missing, range-profile export missing, empty-state bundled), 3 P3 (test file missing, skill-map pointer to DISC-12, grid toggle text-size bundled). Full audit: `../audits/2026-04-22-stats-view.md`.
- Wave 2 audit COMPLETE. All 3 Wave-2 surfaces (hand-replay, analysis, stats) audited.

## Potentially missing

- **No confidence indicator** per stat — a 3-hand sample renders identically to a 300-hand sample.
- **No filter by position** at the view level — selection is seat-only.
- **No export** of the current seat's range profile (would satisfy DE-72).
- **Skill-map / mastery surfacing** (DS-47) — would belong here for self-review use cases.

---

## Test coverage

- `useSessionStats` tests cover the data hook.
- `RangeGrid` has its own rendering tests.
- This view has no dedicated test file today (single-file, heavily composed of memoized computations against context).

## Related surfaces

- `table-view` — entry / exit.
- `players-view` → drilldown into a specific player's cross-session range profile.
- `analysis-view` — deeper analysis of individual hands behind the stats.
- `hand-replay-view` — per-hand review.

---

## Change log

- 2026-04-21 — Created (DCOMP-W0 session 1, Tier A baseline).
- 2026-04-22 — DCOMP-W2-A3 Gate-4 audit appended. Verdict YELLOW. 9 findings.
