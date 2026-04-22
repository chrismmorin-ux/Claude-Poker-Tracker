# Surface Catalog

Index of every UX surface in the app that has (or should have) a surface artifact. A surface is any bounded region of the UI the user can interact with: a view, a menu, a panel, a modal, an inline widget.

`●` = documented, `◐` = stub, `○` = identified but not yet documented.

---

## Top-level views (routed via `SCREEN.*`)

| ID | Name | Code | State |
|----|------|------|-------|
| table-view | Table View | `src/components/views/TableView/` | ● (DCOMP-W0 S1) |
| showdown-view | Showdown | `src/components/views/ShowdownView/` | ● (DCOMP-W0 S1) |
| stats-view | Stats | `src/components/views/StatsView.jsx` | ● (DCOMP-W0 S1) |
| sessions-view | Sessions | `src/components/views/SessionsView/` | ● (DCOMP-W0 S1) |
| players-view | Players | `src/components/views/PlayersView.jsx` | ● (DCOMP-W0 S1) |
| player-picker | Player Picker | `src/components/views/PlayerPickerView/` | ● (Session 2) |
| player-editor | Player Editor | `src/components/views/PlayerEditorView/` | ● (Session 2) |
| settings-view | Settings | `src/components/views/SettingsView/` | ● (DCOMP-W0 S1) |
| analysis-view | Analysis | `src/components/views/AnalysisView/` | ● (DCOMP-W0 S2) |
| hand-replay-view | Hand Replay | `src/components/views/HandReplayView/` | ● (DCOMP-W0 S2) |
| tournament-view | Tournament | `src/components/views/TournamentView/` | ● (DCOMP-W0 S2) |
| online-view | Online | `src/components/views/OnlineView/` | ● (DCOMP-W0 S2) |
| preflop-drills | Preflop Drills | `src/components/views/PreflopDrillsView/` | ● (DCOMP-W0 S2) |
| postflop-drills | Postflop Drills | `src/components/views/PostflopDrillsView/` | ● (DCOMP-W0 S2) |

## Menus and overlays

| ID | Name | Code | State |
|----|------|------|-------|
| seat-context-menu | Seat Context Menu | `src/components/views/TableView/SeatContextMenu.jsx` | ● (Session 2) |
| showdown-overlay | Showdown Overlay | (within ShowdownView) | ○ |
| toast-container | Toast | `src/components/ui/Toast/` | ○ |

## Sidebar (extension)

The Ignition extension sidebar is its own surface system with dedicated doctrine at `docs/SIDEBAR_DESIGN_PRINCIPLES.md`. Surface artifacts here link to panel-level docs in `ignition-poker-tracker/` rather than duplicating.

| ID | Name | Code | State |
|----|------|------|-------|
| sidebar-z0-chrome | Zone 0 — Chrome | extension | doctrine only |
| sidebar-z1-table-read | Zone 1 — Table Read | extension | doctrine only |
| sidebar-z2-decision | Zone 2 — Decision | extension | doctrine only |
| sidebar-z3-street-card | Zone 3 — Street Card | extension | doctrine only |
| sidebar-z4-deep-analysis | Zone 4 — Deep Analysis | extension | doctrine only |

## Inline widgets (within views)

Add as audits surface them.

---

## Conventions

- **ID:** kebab-case, matches filename under `surfaces/`.
- **Name:** user-facing label if any, else descriptive.
- **Code:** primary file or directory. Surface artifacts may reference multiple files.

## Rules for adding a new surface

1. Create a `surfaces/<id>.md` from the template before authoring an audit that references it.
2. Link the surface from any JTBD it serves.
3. If the surface is part of a routed screen, add it to the top-level views list.
4. Update the state marker when documenting moves from ○ to ● completeness.

---

## Change log

- 2026-04-21 — Created. Initial catalog of known surfaces.
- 2026-04-21 — DCOMP-W0 session 1: flipped 6 surfaces to ● (table-view, showdown-view, stats-view, sessions-view, players-view, settings-view). 5 remaining in top-level views: analysis-view, hand-replay-view, tournament-view, online-view, preflop-drills, postflop-drills.
- 2026-04-21 — DCOMP-W0 session 2: remaining 6 top-level views flipped to ● (analysis-view, hand-replay-view, tournament-view, online-view, preflop-drills, postflop-drills). **All 14 main-app top-level views now at Tier A.** Remaining ○: showdown-overlay, toast-container (inline widgets — defer to audit-time discovery).
