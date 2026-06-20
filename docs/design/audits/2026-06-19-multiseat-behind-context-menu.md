# Audit — Multi-seat selection moved behind the seat context menu

**ID:** `AUDIT-2026-06-19-multiseat-behind-context-menu`
**Date:** 2026-06-19
**Type:** Gate 1 (Entry) + Gate 4 (Design) record, Gate 2 skip logged
**Work item:** WS-191 (scope #3 — explicit multi-seat gesture)
**Surfaces:** [table-view](../surfaces/table-view.md), [seat-context-menu](../surfaces/seat-context-menu.md)
**Owner-decided:** 2026-06-19 (trigger + undo behavior both ratified)

---

## Problem

On `TableView`, a plain tap on a seat toggle-**appended** it to an accumulating
`selectedPlayers` array. Tapping a second seat before recording silently produced
a multi-seat batch — which changes the action buttons (no bet sizing, applies to
all selected seats). There was no mode and no deliberate gesture; multi-seat was
an accidental byproduct of routine tapping. Owner report: *"it's accidentally
making things hard. [Multi-seat] only will be used rarely."*

## Gate 1 — Entry

- **Scope classification:** Surface-bound interaction change (existing surface,
  adjusting the seat-selection gesture + adding one context-menu row). Not a new
  surface, not cross-product.
- **Personas:** Chris (core), Weekend Warrior, Rounder, Ringmaster (multi-player
  seat management), Circuit Grinder — all already served by table-view +
  seat-context-menu. Multi-seat batching primarily serves Ringmaster, already a
  primary persona on the context-menu surface.
- **JTBD:** `JTBD-HE-11` one-tap seat action entry (the single-tap path this
  change makes reliable). Multi-seat batching is a power-user shortcut under the
  same job, not a new outcome.
- **Gap analysis:** **GREEN.** No new persona or JTBD. The change makes the
  dominant single-seat path safer and demotes the rare multi-seat path to an
  explicit gesture.

## Gate 2 — Blind-Spot Roundtable

**Skipped (logged).** Per LIFECYCLE bypass policy: GREEN Gate 1, no new persona /
JTBD, and the touch-hold / right-click gesture + menu are a **pre-existing**
interaction pattern (the menu already opens this way and already carries
seat-config rows like Straddle). No new interaction pattern is introduced. The
prior long-press/right-click collision scar (straddle moved off long-press onto a
menu row, `SeatContextMenu.jsx:39-43`) is explicitly avoided by reusing the menu
rather than binding a new direct gesture.

## Gate 4 — Design decisions (owner-ratified)

1. **Plain tap = single-select-replace.** `setSelectedPlayers([seat])`. A plain
   tap also collapses an existing multi-seat selection back to one seat (escape
   hatch). Tapping the already-selected single seat keeps it selected (no
   toggle-off; use Deselect to clear) — owner-accepted default.
2. **Multi-seat trigger = context-menu row**, not a direct hold-to-append
   gesture. New "➕ Add to multi-select" row (flips to "➖ Remove from
   multi-select" when the seat is already selected). Matches the owner's
   "touch-hold / right-click" phrasing exactly and avoids gesture collision.
3. **Undo = step-back, always visible during multi-seat.** "Undo Seat" button in
   ControlZone pops the most recently added seat (insertion-order). "Deselect"
   (clear all) remains alongside it.

## Gate 5 — Implementation

- `TableView.jsx` — `handleSeatSelect` (replace) wired to `onSeatClick`;
  `handleAddToMultiSelect` wired to the new menu prop; `isSeatInSelection` passed.
- `SeatContextMenu.jsx` — `MultiSelectButton` (`data-testid="menu-multi-select"`),
  `onAddToMultiSelect` + `isSeatInSelection` props.
- `CommandStrip.jsx` — passes `isMultiSeat` + `onUndoLastSeat` to ControlZone;
  **fixed latent in-place `selectedPlayers.sort()` mutation** (line ~747) that
  corrupted insertion order — now `[...selectedPlayers].sort()`.
- `ControlZone.jsx` — step-back "Undo Seat" button (shown when `isMultiSeat`).
- Tests: `SeatContextMenu.test.jsx` (+5), `ControlZone.test.jsx` (+4). All pass.
  Production build clean.

**Pending:** owner visual verification on device (1600×720 + touch long-press).

## Invariant note

`useAutoSeatSelection` INV-SEAT-SELECTION-4 keys "manual queue" off
`selectedPlayers.length > 1`. Unchanged: autoselect still only ever sets a single
seat, and only the new menu row can produce `length > 1`, so the invariant's
load-bearing assumption holds.
