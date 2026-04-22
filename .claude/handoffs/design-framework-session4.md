# Handoff — Design Framework Session 4 (P2 Player-Selection Fixes)

**Session:** 2026-04-21
**Owner this session:** Claude (main)
**Status:** CLOSED — all 4 P2 findings implemented

---

## Scope

Close the four remaining P2 findings from `docs/design/audits/2026-04-21-player-selection.md`:

- **F5** — Constrain filter-chip panel height so expansion doesn't push result list below fold on short viewports.
- **F6** — Warn when the picked player is already assigned to another seat; prevent silent double-assign.
- **F8 + F9** — Collapse AvatarFeatureBuilder categories; align density pattern with PhysicalSection.
- **F10** — Add direct "Swap Player…" flow from seat context menu (alternative to clear-then-assign two-step).

## Files I will touch

- `src/components/views/PlayerPickerView/FilterChips.jsx` — F5 max-height
- `src/components/views/PlayerPickerView/ResultCard.jsx` — F6 "at seat N" badge
- `src/components/views/PlayerPickerView/PlayerPickerView.jsx` — F6 pre-pick check + toast; F10 swap-mode handling
- `src/hooks/usePlayerPicker.js` — F10 swapMode state
- `src/components/views/PlayerEditorView/AvatarFeatureBuilder.jsx` — F8 collapsibility
- `src/components/views/TableView/SeatContextMenu.jsx` — F10 new "Swap Player…" action
- `src/components/views/TableView/TableView.jsx` — F10 handleSwapPlayer wiring
- `src/contexts/UIContext.jsx` + `src/reducers/uiReducer.js` — F10 pickerContext.swapMode
- Tests for each

## Out of scope

- New surface audits (TableView, ShowdownView, etc.) — Session 5+ if owner wants.
- Changes beyond the 4 P2 findings.

---

## Final state

### Code changes (7 files)

- `src/components/views/PlayerPickerView/FilterChips.jsx` — `ColorPanel` + `ShapePanel` both gained `max-h-32 overflow-y-auto` + test IDs.
- `src/components/views/PlayerPickerView/ResultCard.jsx` — new `assignedToSeat` prop renders blue "at seat N" badge next to the name when set.
- `src/components/views/PlayerPickerView/PlayerPickerView.jsx` — pulls `clearSeatAssignment`, `getPlayerSeat`, `getSeatPlayer` from `usePlayer`. `handlePickPlayer` checks if picked player has an existing other-seat assignment, clears it first, shows "Moved from seat X to seat Y" toast. Results loop computes `assignedToSeat` per card. New `swapMode` derived from `pickerContext.swapMode`; title branches to "Swap <name> (seat N)" accordingly.
- `src/components/views/PlayerEditorView/AvatarFeatureBuilder.jsx` — secondary rows now collapsed behind a "More details" toggle. `useState(() => hasAnySecondarySelection(features))` auto-opens for records that already have non-default secondary selections. Exported `__INTERNAL__` for testing.
- `src/components/views/TableView/SeatContextMenu.jsx` — new `SwapPlayerButton`; renders after Clear when `onSwapPlayer` is provided and seat is occupied.
- `src/components/views/TableView/TableView.jsx` — `handleSwapPlayer` calls `openPlayerPicker({ seat, swapMode: true })`. Wired via `onSwapPlayer` prop.

### Test changes (2 files)

- `src/components/views/TableView/__tests__/SeatContextMenu.test.jsx` — +1 test: Swap Player button visibility + handler wiring.
- `src/components/views/PlayerEditorView/__tests__/AvatarFeatureBuilder.test.jsx` — updated 2 existing tests to expand "More details" before asserting secondary-row interactions; +3 new tests for collapsibility (default-hidden, reveal-on-tap, auto-open-on-edit).

### Test results

- Changed surfaces: **144/144** passing.
- Full suite not re-run; changes are additive and isolated to these surfaces.

### Visual verification

Playwright MCP still unavailable (same issue as Session 3). Owner checklist for both Session 3 + 4 behaviors:

- [ ] Occupied seat: Clear Player at top; Swap Player… directly below it.
- [ ] Tap Swap Player → picker labeled "Swap <name> (seat N)" in top bar.
- [ ] Pick a player who's at another seat → toast says "Moved <name> from seat X to seat Y"; both seats now correct.
- [ ] Picker with a player already seated elsewhere shows blue "at seat N" badge on their result row.
- [ ] Filter chip panel opened on short landscape viewport: results still visible; panel scrolls internally if many swatches.
- [ ] Player Editor: primary rows (Skin/Hair/Beard) visible; Eyes/Glasses/Hat hidden by default; "More details" chevron expands them.
- [ ] Editing an existing player with glasses/hat already set → secondary rows auto-visible.
