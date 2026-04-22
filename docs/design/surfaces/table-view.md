# Surface — Table View

**ID:** `table-view`
**Code paths:**
- `src/components/views/TableView/TableView.jsx` (598 lines — ARCH-003 threshold)
- `./TableHeader.jsx`, `./SeatComponent.jsx`, `./SeatContextMenu.jsx`
- `./CommandStrip.jsx`, `./ControlZone.jsx`, `./CardSelectorPanel.jsx`
- `./LiveAdviceBar.jsx`, `./SizingPresetsPanel.jsx`
- `src/hooks/useGameHandlers.js`, `./useSeatColor.js`, `./useSeatUtils.js`, `./useSessionTimer.js`, `./useAutoStreetAdvance.js`, `./useLiveEquity.js`
- Reducers: `gameReducer`, `cardReducer`, `uiReducer`
- Engines: `exploitEngine/generateExploits`, `pokerCore/boardTexture`

**Route / entry points:**
- `SCREEN.TABLE` (default landing screen after session start).
- Opens from: `ActiveSessionCard` → Resume; `SessionsView` → Start New Session; post-login redirect when an active session exists.
- Closes to: `ShowdownView` (auto-advance on river complete); `SessionsView` (manual end-session); `PlayerPickerView` / `PlayerEditorView` (via `SeatContextMenu`).

**Product line:** Main app
**Tier placement:** Free+ (core live-entry). Live advice is Plus+. Range/equity worker is Pro.
**Last reviewed:** 2026-04-21

---

## Purpose

The primary live surface. The user records actions seat-by-seat through every street of a live 9-handed hand, the engine returns real-time exploits and advice, and the table's seat/button/blind state continuously reflects the physical table. Designed for mobile-landscape (1600×720), one-handed, below-the-felt-line use.

## JTBD served

Primary:
- `JTBD-HE-11` one-tap seat action entry
- `JTBD-HE-12` undo / repair a miskeyed action
- `JTBD-HE-14` discreet entry that looks like texting
- `JTBD-HE-17` flag a hand for post-session review mid-recording *(added 2026-04-21; not yet served — surface has no flag affordance)*
- `JTBD-MH-01` see the recommended action for the current street
- `JTBD-MH-02` know whether the recommendation is fresh
- `JTBD-MH-04` sizing suggestion tied to villain's calling range
- `JTBD-MH-09` SPR-aware strategy cues
- `JTBD-MH-10` plain-English "why" for a recommendation *(added 2026-04-21; partially served via LiveAdviceBar reasoning row — Item 28)*
- `JTBD-MH-11` validate that the displayed pot is correct before sizing *(added 2026-04-21; partially served via handlePotCorrection — no explicit JTBD-linked UI)*
- `JTBD-PM-01` clear a seat when a player leaves
- `JTBD-PM-02` (entry) assign a known player to a seat → routes to Player Picker
- `JTBD-PM-04` swap the player on a seat
- `JTBD-TS-35` ICM-pressure indicator at bubble (tournament overlay)
- `JTBD-TS-37` stack-depth strategy zone updated live
- `JTBD-TS-43` ICM-adjusted decision at bubble *(added 2026-04-21; partially served — LiveAdviceBar surfaces chip-EV, not ICM-corrected)*
- `JTBD-TS-44` pay-jump proximity indicator *(added 2026-04-21; via tournament overlay)*

Secondary:
- `JTBD-MH-03` bluff-catch frequency inline
- `JTBD-MH-07` short-stack push/fold with ICM *(partially served; DISC-2026-04-21-push-fold-widget proposes dedicated widget at ≤15bb)*
- `JTBD-MH-08` blocker incorporation (in RangeDetailPanel)
- `JTBD-CC-03` navigate away without losing hand-in-progress
- `JTBD-CC-77` recover active hand state after crash

## Personas served

- [Chris](../personas/core/chris-live-player.md) — primary; this is the surface he uses every hand
- [Mid-hand Chris](../personas/situational/mid-hand-chris.md) — situational primary
- [Between-hands Chris](../personas/situational/between-hands-chris.md) — uses seat-context menu heavily
- [Weekend Warrior](../personas/core/weekend-warrior.md) — primary live entry
- [Rounder](../personas/core/rounder.md) — primary; heaviest advice consumer
- [Circuit Grinder](../personas/core/circuit-grinder.md) — primary for live MTT (with tournament overlay)
- [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) — live sessions
- [Ringmaster](../personas/core/ringmaster-home-host.md) — primary during home games
- [Ringmaster-in-hand](../personas/situational/ringmaster-in-hand.md) — situational primary for host-mode live recording *(added 2026-04-21)*
- [Apprentice](../personas/core/apprentice-student.md), [Newcomer](../personas/core/newcomer.md) — with reduced advice density
- [Newcomer-first-hand](../personas/situational/newcomer-first-hand.md) — situational primary on first use *(added 2026-04-21)*
- [Push/Fold short-stack](../personas/situational/push-fold-short-stack.md), [Bubble Decision](../personas/situational/bubble-decision.md), [Final Table](../personas/situational/final-table-play.md) — tournament-situational

---

## Anatomy

```
┌──────────────────────────────────────────────────────────────┐
│ TableHeader: stakes/venue, tournament level, M-ratio, timer │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                  ┌─ felt with 9 seats ──┐                    │
│                  │   SeatComponent ×9   │                    │
│     LiveAdvice   │   dealer button      │   Collapsible      │
│     Bar (top)    │   pot / board / SPR  │   exploit sidebar  │
│                  │   equity badges      │                    │
│                  └──────────────────────┘                    │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ CommandStrip — action buttons, next-street, end-hand         │
│ SizingPresetsPanel (when betting) / CardSelectorPanel        │
└──────────────────────────────────────────────────────────────┘
```

Root: absolute-positioned felt region with `tableRef`; right-click a seat → `SeatContextMenu` opens near that seat.

## State

- **Game state (`useGame`):** `currentStreet`, `mySeat`, `dealerButtonSeat`, `absentSeats`, `smallBlindSeat`, `bigBlindSeat`, `actionSequence`, `potInfo`, `blinds`.
- **UI state (`useUI`):** `selectedPlayers`, `contextMenu`, `isDraggingDealer`, `isSidebarCollapsed`, `showCardSelector`, `autoOpenNewSession`.
- **Card state (`useCard`):** `communityCards`, `holeCards`, `holeCardsVisible`, `allPlayerCards`.
- **Session/player/tendency/tournament contexts:** read-only for rendering; writes via dedicated handlers.
- Mutates: dispatches to `gameReducer` (actions), `cardReducer` (community/hole cards), `uiReducer` (context menu, screen). No direct IDB writes — persistence hooks observe reducer state.

## Props / context contract

- `scale: number` — viewport scale factor (from `useScale`).

## Key interactions

1. **Tap seat action button (in CommandStrip):** appends action via `ACTIONS.*` constant → `useGameHandlers` → reducer → auto-recomputes exploit/advice.
2. **Right-click a seat:** opens `SeatContextMenu` at seat coords.
3. **Drag dealer button:** pointer/touch → `findNearestSeat` → `GAME_ACTIONS.SET_DEALER`.
4. **Tap community card slot:** opens `CardSelectorPanel`.
5. **Auto-advance to showdown:** `useAutoStreetAdvance` calls `openShowdownScreen` when river is complete.
6. **Range badge tap:** opens `RangeDetailPanel` for the clicked seat's villain range profile.

---

## Known behavior notes

- **Seat coordinates** are percent-based (`SEAT_POSITIONS`) over the felt element — they recompute against `tableRef.getBoundingClientRect()`.
- **Tournament overlay** is driven by `useTournament().isTournament` and replaces cash-game blinds with level-based blinds/timer.
- **Live equity** is worker-offloaded (`useEquityWorker` + `useLiveEquity`) with fallback to in-thread computation.
- **Exploit data is precomputed per seat in a `useMemo`** — guardrail for re-render cost. See RT-36 (memoization backlog item).
- **Component size** is at the 598 / 700-line architecture threshold (ARCH-003). Structural decomposition candidate.

## Known issues

- [ARCH-003](../../../.claude/BACKLOG.md) — TableView at 598 lines; decomposition candidate.
- Legacy backlog items predating the framework: **RT-36** (memoization / render cost), **RT-37** (Next Hand guard), **RT-43** (state clear).
- [AUDIT-2026-04-21-blindspot-table-view](../audits/2026-04-21-blindspot-table-view.md) — Gate-2 blind-spot roundtable, 17 findings across 5 stages. Verdict: YELLOW. Gate 3 resolution appended same-session.
- [AUDIT-2026-04-21-table-view](../audits/2026-04-21-table-view.md) — Gate-4 heuristic audit, 12 findings (4 P1, 6 P2, 2 P3). Draft pending owner review. Dominant theme: destructive-action safety. 4 findings at severity 3. Top P1: F1 replace `window.confirm` on Reset Hand. F1+F10 sequencing dependency noted.
- **Cross-surface gaps surfaced by the audit:**
  - [DISC-2026-04-21-briefing-badge-nav](../discoveries/2026-04-21-briefing-badge-nav.md) — seat badge → review queue edge is missing.
  - [DISC-2026-04-21-push-fold-widget](../discoveries/2026-04-21-push-fold-widget.md) — equity-derived advice doesn't serve push/fold at ≤15bb.
  - [DISC-2026-04-21-decision-tree-fate](../discoveries/2026-04-21-decision-tree-fate.md) — orphaned F-W5 blocks MH-10 deep variant.
  - [DISC-2026-04-21-sidebar-tournament-parity](../discoveries/2026-04-21-sidebar-tournament-parity.md) — cross-product tournament overlay gap.
- **Framework contract:** TableView is the primary writer of the hand record persisted via ShowdownView commit. See [contracts/persisted-hand-schema.md](../contracts/persisted-hand-schema.md) for invariants + reader list. Any state-shape change to gameReducer / cardReducer that reaches the hand record must follow the change protocol in that contract.
- **Journey:** the briefing-review loop originating at this surface is documented in [journeys/briefing-review.md](../journeys/briefing-review.md) — note the step-2 navigation gap.

## Potentially missing

- No "reset current hand to empty" shortcut.
- Live advice freshness timer logic comes from the engine — no UI badge correlates "last recompute" to wall-clock for the user.
- No in-view onboarding affordance (covered by ON-82 onboarding JTBD; not served here).

---

## Test coverage

- `src/components/views/TableView/__tests__/*.test.jsx` — per-subcomponent tests (seat, context menu, command strip, etc.).
- No single integration test; behavior covered through reducer + hook tests plus component tests.

## Related surfaces

- `seat-context-menu` — embedded overlay.
- `player-picker`, `player-editor` — opened from seat-context-menu.
- `showdown-view` — auto-advance exit.
- `sessions-view` — entry.
- Sidebar (online): analogous surface for online play; not this artifact.

---

## Change log

- 2026-04-21 — Created (DCOMP-W0 session 1, Tier A baseline).
- 2026-04-21 — DCOMP-W1-S2 (Gate 3 research): added MH-10, MH-11, HE-17, TS-43, TS-44 to JTBD list; added ringmaster-in-hand + newcomer-first-hand situational personas; linked blind-spot audit + 4 discoveries + persisted-hand-schema contract + briefing-review journey.
- 2026-04-21 — DCOMP-W1-S3 (Gate 4 audit): 12 heuristic findings logged at `audits/2026-04-21-table-view.md`. Pending owner review; 4 P1 + 6 P2 + 2 P3 queued for Gate 5 implementation.
- 2026-04-21 — **DCOMP-W1 S4–S8 (Gate 5): ALL 12 TableView audit findings SHIPPED** across 5 implementation sessions. S4: F1 (`window.confirm` → toast+undo), F2 (orbit +N preview badges), F3 (sizing preset editor slot highlight), F4 (AGING badge), F5 (unified undo duration), F10 (Reset Hand / Next Hand separation). S6: F8 (recent-players 44px floor). S7: F6 (recents count + scroll fade), F9 (PotDisplay long-press + inputMode=decimal), F11 (`useAnalysisContext` rename with deprecated alias), F12 (RangeDetailPanel reopen-last button). S8: F7 (orbit strip flex-wrap — silent off-screen seats eliminated). **All findings code-complete. Pending owner visual verification on device.**
