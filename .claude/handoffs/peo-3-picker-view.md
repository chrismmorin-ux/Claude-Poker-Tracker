# PEO-3 Handoff — Fullscreen PlayerPickerView + Wire Entry Points

**Session:** PEO-3 (third of four)
**Program:** Player Entry Overhaul — `.claude/projects/player-entry-overhaul.md`
**Plan:** `C:\Users\chris\.claude\plans\fluttering-booping-puddle.md`
**Started:** 2026-04-16
**Depends on:** PEO-1 + PEO-2 (both shipped 2026-04-16)

---

## Scope

Build `SCREEN.PLAYER_PICKER` fullscreen route with live name filter + characteristic chips + recognition-oriented result cards. Wire `SeatContextMenu` so "Find Player…" opens the picker and "Create New Player" opens the editor. **This session takes the feature live** for the first time.

## Files I Own (active session)

**Creating:**
- `src/hooks/usePlayerPicker.js` (+ tests)
- `src/components/views/PlayerPickerView/PlayerPickerView.jsx`
- `src/components/views/PlayerPickerView/NameSearchInput.jsx`
- `src/components/views/PlayerPickerView/FilterChips.jsx`
- `src/components/views/PlayerPickerView/ResultCard.jsx`
- `src/components/views/PlayerPickerView/CreateFromQueryCTA.jsx`
- `src/components/views/PlayerPickerView/BatchSeatRibbon.jsx`
- Tests for each.

**Modifying:**
- `src/hooks/usePlayerFiltering.js` — expose `scorePlayerMatch(player, query)` primitive for result-card highlighting. Existing filter behavior must not regress.
- `src/PokerTracker.jsx` — add `SCREEN.PLAYER_PICKER` case.
- `src/components/views/TableView/SeatContextMenu.jsx` — add "Find Player…" item + rewire "Create New Player" to `openPlayerEditor({ mode: 'create', seatContext })`.
- `src/components/views/TableView/TableView.jsx` — handlers call `openPlayerPicker(seat)` + `openPlayerEditor({...})`.

## Recognition UX (D7)

Result cards:
- **Avatar leads** at left edge (glance-first identification).
- Typed name prefix **bolded**; rest of name normal weight.
- Active-filter feature chips at full opacity; non-matching feature badges faded (opacity 0.5). Figure/ground effect draws the eye to matches without adding bold-everywhere noise.
- Subtle gold left-border accent on cards where every active filter matches.
- Each card shows `last seen X days ago` + `N hands tracked` for quick recency check.

Sort: last-seen descending within the filter-matched set.

## Matching Semantics

- Name: prefix match on `name` AND `nickname`, case-insensitive.
- Feature chips: AND-combined with name AND among themselves.
- Results filter synchronously on every keystroke (main-thread; fine up to ~500 players per perf ceiling note).

## Batch Mode State Machine (D9)

- `pickerContext.batchMode = { active: bool, assignedSeats: number[] }`.
- End conditions: (a) explicit exit button, (b) all 9 seats assigned, (c) user navigates away.
- Does NOT persist across app reload.
- On successful pick in batch mode: mark seat as assigned, auto-advance to next unassigned seat, clear filter input, keep picker open.

## On Pick (existing player)

1. `assignPlayerToSeat(seat, playerId)` — current-hand mapping.
2. `linkPlayerToPriorHandsInSession(seat, playerId, sessionId)` — backfill.
3. Undo toast with `undoRetroactiveLink` action.
4. If batch mode → advance; else close picker → prevScreen.

## CreateFromQueryCTA

Sticky bottom button. Label updates live with typed text:
- When input blank: `+ Create new player`
- When typing: `+ Create new: "Mi…"` (truncated if long)

On click: `openPlayerEditor({ mode: 'create', seatContext, nameSeed: currentQuery })`. The editor pre-fills name and, on save, re-enters the same seat context for assignment + retro-link.

## Acceptance Criteria

- Right-click seat → "Find Player…" opens picker scoped to that seat.
- Type "Mi" → list narrows; name matches bolded; non-matching features faded.
- Tap filter chip (e.g. "Beard: Goatee") → list narrows further with AND semantics.
- Tap existing player → assigns; retro-link runs (if in session); undo-toast appears; tap Undo → reverts.
- Tap "+ Create new: 'Mi'" → opens editor with name pre-filled.
- Enable batch mode → pick seat 3 player → auto-advance to seat 4 with ribbon updating.
- Full test suite green.

## Close Criteria

- Feature goes live (entry points wired).
- PEO-4 unblocked (cutover: migrate PlayersView create path, delete old PlayerForm, remove `pendingSeatForPlayerAssignment`).
- CHANGELOG/STATUS/BACKLOG updated.
