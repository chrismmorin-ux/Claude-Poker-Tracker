# Surface — Players View

**ID:** `players-view`
**Code paths:**
- `src/components/views/PlayersView.jsx` (509 lines — single-file view)
- `src/components/ui/PlayerFilters.jsx`, `./PlayerRow.jsx`, `./SeatAssignmentGrid.jsx`
- `src/components/ui/RangeDetailPanel.jsx`
- `src/hooks/usePlayerFiltering.js`
- Contexts: `PlayerContext`, `UIContext`, `TendencyContext`, `SessionContext`, `ToastContext`

**Route / entry points:**
- `SCREEN.PLAYERS`.
- Opens from: bottom-nav or menu.
- Closes to: `TableView` via back button; routes to `PlayerEditorView` (via `openPlayerEditor`) on create / edit; dispatches seat-assign through `PlayerContext` (no navigation).

**Product line:** Main app
**Tier placement:** Free+ (capped player count in Free per INVENTORY F-05). Full cross-session range profiles + analytics are Plus+ / Pro.
**Last reviewed:** 2026-04-21

---

## Purpose

Player database browser + bulk seat-assignment surface. Lists every player with filters (name, style tags, gender, build, ethnicity, facial hair, hat, sunglasses) and an adjacent seat-assignment grid. Primary flows: find/edit an existing player, bulk-assign players to seats at session start, drill into a player's range profile.

## JTBD served

Primary:
- `JTBD-PM-07` edit an existing player's record
- `JTBD-PM-05` (alternative) batch-assign players to seats at session start — grid-based flow lives here in parallel with the picker-based flow in `player-picker`
- `JTBD-PM-09` find a player by visual features (filter chips)

Secondary:
- `JTBD-PM-02` assign a known player to a seat (click-to-assign)
- `JTBD-PM-04` swap the player on a seat (via the replace prompt when target seat is occupied)
- `JTBD-SR-23` see per-player leak context via the drill-in `RangeDetailPanel`

## Personas served

- [Chris](../personas/core/chris-live-player.md) — primary (mostly uses seat-context menu + picker in live flow; uses this view out-of-session for edits)
- [Ringmaster](../personas/core/ringmaster-home-host.md) — primary for pre-game seat assignment
- [Rounder](../personas/core/rounder.md), [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md), [Circuit Grinder](../personas/core/circuit-grinder.md) — browse and edit their player database
- [Coach](../personas/core/coach.md) — inspect student hands by player
- [Banker / Staker](../personas/core/banker-staker.md) — partial (future staker portal downstream)

---

## Anatomy

```
┌────────────────────────────────────────────────────────┐
│ [← Back]  Players ({count})         [+ New Player]     │
├────────────────────────────────────────────────────────┤
│ PlayerFilters                                          │
│  [search]  [sort]  [tag] [gender] [build] [ethnicity]  │
│            [facialHair] [hat] [sunglasses]  [clear]    │
├──────────────────────────┬─────────────────────────────┤
│ Seat Assignment Grid     │ Player list (PlayerRow ×N)  │
│  [S1][S2][S3][S4][S5]    │   • avatar + name + tags    │
│  [S6][S7][S8][S9]        │   • VPIP/PFR/3B/hands chip  │
│  selected seat highlight │   • [edit] [delete] actions │
│                          │   drag-and-drop to assign   │
├──────────────────────────┴─────────────────────────────┤
│ Replace prompt (when clicking an already-occupied seat)│
│ Delete confirmation overlay                            │
│ RangeDetailPanel (overlay on player click)             │
└────────────────────────────────────────────────────────┘
```

Wrapped in `ScaledContainer`.

## State

- **Player context (`usePlayer`):** `allPlayers`, `seatPlayers`, `updatePlayerById`, `deletePlayerById`, `loadAllPlayers`, `assignPlayerToSeat`, `clearSeatAssignment`, `getPlayerSeat`, `isPlayerAssigned`, `clearAllSeatAssignments`.
- **UI (`useUI`):** `setCurrentScreen`, `SCREEN`, `openPlayerEditor`.
- **Tendency (`useTendency`):** `tendencyMap`, `patchTendency` — powers the style-tag filter + stat chips.
- **Session (`useSession`):** `currentSession` — passed into editor seat-context.
- **Filtering (`usePlayerFiltering`):** returns `filteredPlayers` + every filter's set/clear handler.
- **Local:** `selectedSeat`, `deletingPlayer`, `draggedPlayerId`, `showReplacePrompt`, `replacePromptData`, `rangeDetailPlayerId`.
- Writes: dispatches seat-assign / clear / delete actions; IDB writes via `PlayerContext` + `useTendency`.

## Props / context contract

- `scale: number` — viewport scale (default 1).

## Key interactions

1. **Click seat in grid** → `selectedSeat` set → subsequent player click assigns into that seat.
2. **Click a PlayerRow when a seat is selected** → if seat empty: `assignPlayerToSeat` + auto-advance to next empty seat; if occupied: open replace prompt.
3. **Drag player onto a seat cell** → same flow as click-assign.
4. **`+ New Player`** → `openPlayerEditor({ mode: 'create', seatContext })`.
5. **Edit (on PlayerRow)** → `openPlayerEditor({ mode: 'edit', playerId })`.
6. **Delete** → confirmation modal → `deletePlayerById`.
7. **Click a player's range chip** → opens `RangeDetailPanel` overlay.
8. **Filter chip toggles** → narrows `filteredPlayers` in-place.

---

## Known behavior notes

- **Parallel to picker-flow** — PlayersView is an alternative seat-assignment surface. The picker (fullscreen, PEO-3) is the in-table flow; this is the browser-style flow. Both mutate the same underlying state.
- **Auto-advance on assign** — on successful assign, `selectedSeat` bumps to the next empty seat to support rapid pre-game setup (Ringmaster flow).
- **Replace prompt** — defensive destructive-action pattern; unlike picker which moves silently, PlayersView pauses for confirmation when a target seat is already occupied.
- **Range-detail overlay** — cross-session range profile (same tendency source as StatsView). Lazy-loaded from `tendencyMap`.
- **PEO-4 migration note (in-code):** `showNewPlayerModal`, `editingPlayer`, `lastCreatedPlayerId`, `showPendingAssignmentPrompt` all migrated to the editor route — do not re-introduce modal-based editing here.

## Known issues

- **DCOMP-W4-A1 audit (2026-04-22) — verdict RED.** 4 P0 (destructive-action anti-patterns: F1 Clear All Seats native confirm, F2 Delete Player blocking modal, F3 per-seat Clear silent commit, F4 style/guard mismatch bundled with F1), 4 P1 (F5 row-action touch targets 20–35×20, F6 per-seat Clear 24×16, F7 Clear All Seats 28px height — all under ≥44 minimum; F8 filter row density 29% of viewport). P2 bulk-delete missing (F9 — deferred), P3 inline tag editing (F10 — deferred). Full audit: `../audits/2026-04-22-players-view.md`. Fixes queued as DCOMP-W4-A1-F1..F8 in BACKLOG.
- Wave 4 audit COMPLETE for players-view. Tournament + online + settings audits remain.

## Potentially missing

- **Bulk operations** — delete-many, export-selection, assign-many-to-seats — not served.
- **Cross-venue linker** (F-P02) — deduplication across venue names not served.
- **Import from sidebar / third-party** (F-P10) — no entry point here.
- **Tag editing** — can edit player → tag, but no inline-tag editor from the list.

---

## Test coverage

- `src/components/views/__tests__/PlayersView.test.jsx` — view-level tests (rewritten in PEO-4 against editor-route architecture).
- `usePlayerFiltering` + filter UI components tested separately.

## Related surfaces

- `player-editor` — create / edit sink.
- `player-picker` — alternative in-table seat-assign flow.
- `seat-context-menu` — in-table entry for per-seat player actions.
- `stats-view` — overlapping range-profile inspection.

---

## Change log

- 2026-04-21 — Created (DCOMP-W0 session 1, Tier A baseline).
- 2026-04-22 — DCOMP-W4-A1 audit appended; Known-issues updated with 13 findings (4 P0, 4 P1, 2 P2, 3 P3/deferred).
