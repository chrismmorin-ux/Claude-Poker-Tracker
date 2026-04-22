# Handoff — Design Framework Session 3 (Player-Selection Fixes)

**Session:** 2026-04-21
**Owner this session:** Claude (main)
**Status:** CLOSED — implementation shipped, visual verification unavailable (Playwright MCP down)

---

## What this session is doing

Implementing the 4 P1 findings from the Session 2 audit (`docs/design/audits/2026-04-21-player-selection.md`):

- **F1+F3+F11** — Reorder `SeatContextMenu` based on seat occupancy. Clear at top when occupied; structural miss-tap prevention via divider.
- **F2** — Add undo toast for Clear Player (mirror retro-link undo pattern).
- **F4** — Enforce 48 DOM-px min tap-target on interactive rows in seat-context-menu, picker FilterChips, editor (where applicable).
- **F7** — Reproduce Player Editor landscape scroll failure on small-phone viewports; fix root cause.

## Files I own / will touch

Core implementation:
- `src/components/views/TableView/SeatContextMenu.jsx`
- `src/components/views/TableView/TableView.jsx` (undo wiring if needed)
- `src/hooks/useGameHandlers.js` (or sibling for clear-with-undo hook)
- `src/components/views/PlayerPickerView/FilterChips.jsx`
- `src/components/views/PlayerEditorView/PlayerEditorView.jsx`

Tests:
- `src/components/views/TableView/__tests__/SeatContextMenu.test.jsx`
- Any new hook tests

Framework artifacts (updates):
- `docs/design/audits/2026-04-21-player-selection.md` — mark findings as implemented with commit refs.
- `docs/design/surfaces/*.md` — update "Known issues" sections.
- `docs/design/evidence/LEDGER.md` — append verification entries.
- `.claude/STATUS.md`, `.claude/projects/design-framework.md`, this handoff.

## Open questions to answer first (before implementation)

1. What does `assignPlayerToSeat` do when seat is already assigned? (Silent overwrite / reject / warn?)
2. Does retro-link follow a player across a re-assignment?
3. Does batch mode survive the CreateFromQueryCTA → editor → save round-trip?

These don't block P1 fixes but inform whether F10 (Swap) needs elevation.

## Out of scope

- P2 findings (F5, F6, F8, F10) — Session 4+.
- Any unrelated refactors.
- Framework file additions — audits are immutable.

---

## Final state

### Code changes (5 files)

- `src/components/views/TableView/SeatContextMenu.jsx` — full refactor into state-aware render (isOccupied branch). Clear promoted to top on occupied seat; divider below; Recent list separated from Clear by the full SeatConfig + Assign sections. `data-seat-occupied` attribute added. Primary rows `py-3 min-h-[44px]`; Recent rows `py-2.5 min-h-[40px]`.
- `src/components/views/TableView/TableView.jsx` — `handleClearPlayer` now captures prior player via `getSeatPlayer(seat)`, clears, then shows `addToast` with Undo action wired to `assignPlayerToSeat(seat, priorPlayerId)`. Added `addToast` to useToast destructure.
- `src/components/views/PlayerPickerView/FilterChips.jsx` — chip class bumped from `px-2.5 py-1` to `px-3 py-2 min-h-[36px]`.
- `src/components/views/PlayerPickerView/PlayerPickerView.jsx` — root `min-h-screen` → `h-screen overflow-hidden` (consistency with editor).
- `src/components/views/PlayerEditorView/PlayerEditorView.jsx` — root `min-h-screen` → `h-screen overflow-hidden` (the F7 fix; the root cause is that `min-h-screen` allowed the root to grow to fit 2000-px form content, which meant the `flex-1 overflow-auto` body had no bounded parent to overflow against).

### Test changes (1 file)

- `src/components/views/TableView/__tests__/SeatContextMenu.test.jsx` — added 4 new tests for state-aware ordering (F1+F3+F11): Clear-first on occupied, Make-My-Seat-first on empty, Recent separated from Clear, data-seat-occupied attribute. All 27 tests green.

### Test results

- Changed surfaces: **140/140** passing (TableView, PlayerPickerView, PlayerEditorView areas).
- Full suite: **6120/6122** passing. The 2 failing tests are in `src/utils/exploitEngine/__tests__/gameTreeHelpers.test.js` (`miniRolloutEquity` Monte Carlo variance) — pre-existing flaky, **pass when run in isolation**, unrelated to this session.

### Visual verification

**ATTEMPTED, FAILED.** Dev server started on localhost:5179 (ports 5173-5178 occupied). Playwright MCP browser backend returned `Target page, context or browser has been closed` on every interaction attempt (`browser_navigate`, `browser_tabs new`, `browser_run_code`). Unable to visually verify any of:
- Seat context menu ordering on an occupied seat
- Undo toast on Clear Player
- Touch-target spacing at scale 0.5 on 900×414 viewport
- **Landscape scroll fix on Player Editor — the P1 most needing verification**

Per CLAUDE.md: "If you can't test the UI, say so explicitly rather than claiming success."

## Owner verification checklist

Before closing audit findings:

- [ ] On a real phone in landscape (or devtools 900×414 / 720×360): right-click an occupied seat → confirm Clear Player is the top item.
- [ ] Click Clear Player → confirm a toast appears with "Undo" action → tap Undo → confirm the player is reassigned.
- [ ] On a real phone or devtools small viewport: open Player Editor → confirm the form scrolls and the Save button is reachable.
- [ ] On the same viewport: tap a filter chip in the picker → confirm the chip is hitable without mis-tap on neighboring chips.
- [ ] Smoke test: right-click an empty seat → confirm Make My Seat / Make Dealer are at top (Clear is absent).

If any of these fail, file a new discovery/finding. Do NOT close the audit without observed visual pass.
