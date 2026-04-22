# Handoff — Design Compliance Wave 1 Session 6 (Layout + Touch-Target Batch)

**Session:** 2026-04-21
**Owner this session:** Claude (main)
**Project:** `.claude/projects/design-compliance.md` → DCOMP-W1
**Plan:** `C:\Users\chris\.claude\plans\twinkling-seeking-valiant.md` (Session 6 of "5 sessions" numbering)
**Status:** CLOSED — 4 P2 layout/touch-target findings shipped. Pure visual hygiene; no behavioral changes.

---

## Scope delivered

Per the plan: single batch of layout + touch-target fixes so owner visual verification can happen once, not per-finding.

### Code changes (5 source files)

**`src/components/views/ShowdownView/ShowdownHeader.jsx`** — SDV-F2
- Full layout rework. Done button moved from rightmost (adjacent to Next Hand) to LEFT anchor, with `ArrowLeft` icon for non-destructive exit semantics. Next Hand stays at rightmost with a subtle gold glow (`boxShadow: 0 0 0 3px rgba(202, 138, 4, 0.25)`) to anchor the commit path visually. BOARD display + mode toggle sit between them — ≥200px physical gap. Structural separation rather than visual-only; mis-tap risk reduced independent of F1's toast+undo.

**`src/components/views/ShowdownView/CardGrid.jsx`** — SDV-F5
- Single-line: `overflow-hidden` → `overflow-auto` on the outer div. Narrow-viewport clipping of low-rank columns is gone. Added block comment documenting the reference-viewport assumption + the discovery-candidate responsive layout.

**`src/components/views/SessionsView/SessionsView.jsx`** — SV-F5 (orchestrator side)
- Replaced three `absolute bottom-8`-positioned elements with a single `absolute bottom-0 left-0 right-0 flex justify-between items-center px-8 pb-8` container. `pointer-events-none` on the wrapper; `pointer-events-auto` on interactive children. Collision-proof at any scale.

**`src/components/views/SessionsView/BankrollDisplay.jsx`** — SV-F5 (child side)
- Stripped `absolute bottom-8 left-8 ... z-20` from root — component is now a pure content block. Positioning moved to the parent flex container. Doc comment explains the responsibility shift.

**`src/components/views/TableView/SeatContextMenu.jsx`** — TV-F8
- Added new `RECENT_ROW_CLASS` constant alongside the existing `MENU_ROW_CLASS` — both now min-h-[44px] (were drifting; recents was 40). Block comment makes the single-source-of-truth rule explicit: "every tappable row in this menu MUST use one of these classes." Prevents future drift.
- RecentPlayersSection button replaces its inline class with `RECENT_ROW_CLASS`.

### Test changes

None needed — all 278 tests across TableView + ShowdownView + SessionsView pass unchanged. Pure layout changes don't affect test semantics.

## Tests

- TableView + ShowdownView + SessionsView: **278/278 passing** (12 test files).
- No full-suite rerun this session (no rename, no schema change).

## Pattern reused (no re-invention)

- **Single-source-of-truth row classes** — TV-F8 extends the existing `MENU_ROW_CLASS` pattern that was already established in the file. Same approach could be replicated across other dense-menu surfaces as a future hygiene pass.
- **Structural destructive-action separation** — SDV-F2 mirrors the TableView F10 approach (shipped S4) of de-emphasizing destructive buttons + physical spacing. Two different implementations of the same principle.
- **Parent-owns-positioning** — SV-F5 moves absolute positioning from child (BankrollDisplay) to parent (SessionsView). Cleaner component contract; consistent with existing UI patterns where positioning is a layout concern, not a content concern.

## Visual verification — owner checklist

Playwright MCP still unavailable. Owner must verify on device:

| Finding | Check |
|---------|-------|
| SDV-F2 | ShowdownView header: Done on left with ← icon. Next Hand on right with gold glow. BOARD + mode toggle between them. No two commit/exit buttons adjacent. |
| SDV-F5 | CardGrid at reference viewport (1600×720): no visible change. At narrower viewports: horizontal scroll reveals rightmost low-rank columns (2, 3) that were previously clipped. |
| SV-F5 | SessionsView bottom: BankrollDisplay left, drill buttons right-justified. No overlap at any scale. Both drill buttons still clickable. |
| TV-F8 | Right-click a seat → Recent players section: rows visibly taller (44px) than before (40px). Consistent with primary menu rows. |

## What comes next

Plan Session 7: Minor polish + dev-clarity batch (XS/S × 8). Biggest blast radius of the remaining sessions because it bundles the `useOnlineAnalysisContext` rename. The plan notes "if scope feels too large in-session, split at TV-F11 (rename is the cleanest cut point)." Good candidate for a full-suite test run after the rename.

Remaining Wave 1: 10 findings across 3 surfaces.

## Closed

5 tasks completed. Wave-1 visual hygiene on the three core surfaces is now materially improved without any behavioral risk.
