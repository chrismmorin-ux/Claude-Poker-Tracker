# Surface — Tournament View

**ID:** `tournament-view`
**Code paths:**
- `src/components/views/TournamentView/TournamentView.jsx` (218 lines — orchestrator)
- `./BlindTimerBar.jsx` (153 lines) — level + blinds + timer
- `./ChipStackPanel.jsx` (269 lines) — per-seat stacks, eliminations, players remaining
- `./PredictionsPanel.jsx` (254 lines) — ICM / M-ratio / lockout / blind-out projections
- `src/contexts/TournamentContext.jsx` — single source of truth for tournament lifecycle
- Cross-surface: `TableView` reads `isTournament`, `currentBlinds`, `icmPressure`, `mRatioGuidance` directly from TournamentContext

**Route / entry points:**
- `SCREEN.TOURNAMENT`.
- Opens from: `sessions-view` on creating a tournament session (`initTournament` + `createNewTournament`); direct nav while a tournament session is active.
- Closes to: `TableView` (continue playing); `sessions-view` via "End Tournament" flow (records finish position + payout).

**Product line:** Main app
**Tier placement:** Free+ (basic blind timer + stacks). ICM pressure + M-ratio guidance are Pro. Proposed extensions (payout import, bounty EV, satellite mode) are Pro+.
**Last reviewed:** 2026-04-21

---

## Purpose

The tournament cockpit. Blind-level timer, stack tracking per seat, elimination recording, players-remaining count, and projection panel (ICM pressure, M-ratio guidance, level lockout, blind-out risk). Cash-game state is insufficient for tournaments — this view owns the additional lifecycle (levels, antes, eliminations, finish-position recording) and feeds the live-table surfaces with the tournament context they need to adjust strategy.

## JTBD served

Primary:
- `JTBD-TS-35` ICM-pressure indicator at bubble
- `JTBD-TS-36` BB-ante vs per-player antes handling (delegated; surface presents the result)
- `JTBD-TS-37` stack-depth strategy zone updated live (M-ratio guidance)
- `JTBD-TS-39` rebuy cost tracking for ROI (via session payout recording on end)
- `JTBD-SM-19` pause without closing session (pause / resume timer)
- `JTBD-MH-07` short-stack push/fold with ICM — not served here directly; consumed by `table-view` advice via context

Secondary:
- `JTBD-SM-21` clean cash-out / finish recording — lands on end-tournament flow here
- `JTBD-TS-38` multi-day note persistence — not served (Day 1 → Day 2 carry-over)
- `JTBD-TS-40/41/42` per-seat FT ICM / satellite / bounty — not served (proposed)

## Personas served

- [Circuit Grinder](../personas/core/circuit-grinder.md) — primary persona for live MTT / circuit grinds
- [Online MTT Shark](../personas/core/online-mtt-shark.md) — primary for online MTT (usually via the sidebar; this view is post-session context)
- [Chris](../personas/core/chris-live-player.md) — when playing the occasional tournament
- [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) — shared live/online time
- [Push/Fold short-stack](../personas/situational/push-fold-short-stack.md), [Bubble decision](../personas/situational/bubble-decision.md), [Final table play](../personas/situational/final-table-play.md) — situational primary
- [Ringmaster](../personas/core/ringmaster-home-host.md) — home tournaments (limited breadth today)

---

## Anatomy

```
┌────────────────────────────────────────────────────┐
│ [← Back to Table]   Tournament    [End Tournament] │
├────────────────────────────────────────────────────┤
│ BlindTimerBar                                      │
│   Level N   SB/BB/ante   Next: SB/BB/ante          │
│   ⏱  7:23          [⏸ Pause]  [Advance Level]     │
├────────────────────────────────────────────────────┤
│ PredictionsPanel                                   │
│   ICM pressure   |   M-ratio guidance              │
│   Blind-out ETA  |   Lockout / level projections   │
├────────────────────────────────────────────────────┤
│ ChipStackPanel                                     │
│   Seat grid  |  Stacks (editable)                  │
│   Players remaining: 47                            │
│   [Eliminate a seat]  [Undo elimination]           │
├────────────────────────────────────────────────────┤
│ End-tournament form (modal):                       │
│   [Finish position] [Payout] → Confirm             │
└────────────────────────────────────────────────────┘
```

## State

- **Tournament (`useTournament`):** `tournamentState`, `isTournament`, `currentBlinds`, `nextBlinds`, `levelTimeRemaining`, `predictions`, `lockoutInfo`, `blindOutInfo`, `icmPressure`, `mRatioGuidance`, `advanceLevel`, `pauseTimer`, `resumeTimer`, `updateStack`, `recordElimination`, `setPlayersRemaining`, `resetTournament`.
- **UI (`useUI`):** `setCurrentScreen`.
- **Game (`useGame`):** `mySeat`.
- **Session (`useSession`):** `updateSessionField` — end-tournament flow writes finish position + payout + total entrants + format into the session record.
- **Local:** `showEndForm`, `finishPosition`, `payoutAmount`.
- Writes: TournamentContext reducer + SessionContext on end. Timer lives in TournamentContext (single source of truth).

## Props / context contract

- `scale: number` — viewport scale.

## Key interactions

1. **Back to Table** → `setCurrentScreen(SCREEN.TABLE)` without ending the tournament.
2. **Pause / Resume** → timer control.
3. **Advance Level** → immediately jump to the next blind level.
4. **Update stack (per seat)** → `updateStack`.
5. **Eliminate a seat** → `recordElimination`; players-remaining decrements.
6. **Set Players Remaining** → when external info updates the field count.
7. **End Tournament** → modal → records `tournamentFinishPosition`, `tournamentPayout`, `tournamentTotalEntrants`, `tournamentFormat` to session → `resetTournament` → navigate to SESSIONS.

---

## Known behavior notes

- **Empty state** (not in a tournament): shows "No active tournament" with back-to-table button. `isTournament` is false when no tournament session is active.
- **Timer is canonical in TournamentContext** — avoided dual-ownership failure mode (prior bug in SR program).
- **BB-ante vs per-player antes** — `currentBlinds` surfaces the resolved structure; see `project_rake_spr_antes.md`.
- **ICM pressure / M-ratio guidance** are computed in context and merely rendered here.
- **End Tournament is irreversible** without undo — session record is written on confirm.

## Known issues

- No prior audit findings.
- Known atlas gaps: **TS-38 multi-day note persistence**, **TS-40 per-seat FT ICM payout delta**, **TS-41 satellite survival mode**, **TS-42 bounty-adjusted EV** all flagged as proposed / not served.
- Wave 4 audit (specialized surfaces) will Gate-2 roundtable this view because the atlas flags three distinct discovery clusters (ICM / bounty / satellite).

## Potentially missing

- **ICM payout structure import** (F-P04) — payouts currently entered manually at end.
- **Bounty-adjusted EV mode** (F-P05) — not served.
- **Satellite / seat-bubble strategy switch** (F-P06) — not served.
- **Multi-day stack / note persistence** (TS-38) — no "resume Day 2 with prior stack" flow.
- **Final-table ICM payout delta per seat** (TS-40) — calculable but not surfaced.

---

## Test coverage

- Sub-panels have component-level tests.
- TournamentContext / reducer has lifecycle tests (pause, resume, advance, eliminate, reset).

## Related surfaces

- `table-view` — primary consumer of tournament context (overlay on TableHeader).
- `sessions-view` — creation and recording of tournament sessions.
- `online-view` — (currently decoupled) the Online MTT Shark persona's primary surface is the sidebar, with this view as supplementary.

---

## Change log

- 2026-04-21 — Created (DCOMP-W0 session 2, Tier A baseline).
