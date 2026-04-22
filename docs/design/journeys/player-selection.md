# Journey — Player Selection

**ID:** `player-selection`
**Last reviewed:** 2026-04-21

---

## Purpose

Documents the four distinct flows users take to manage seat-to-player associations: **clear**, **assign-known**, **create-new-and-assign**, and **swap**. Each crosses 1–3 surfaces and has its own time budget and failure modes.

## Surfaces involved

- [seat-context-menu](../surfaces/seat-context-menu.md) — entry point for all flows
- [player-picker](../surfaces/player-picker.md) — primary for assign-known, secondary for swap
- [player-editor](../surfaces/player-editor.md) — primary for create-new

## Primary JTBD

- `JTBD-PM-01` clear a seat
- `JTBD-PM-02` assign a known player
- `JTBD-PM-03` create a new player and assign
- `JTBD-PM-04` swap the player on a seat
- `JTBD-PM-05` batch-assign at session start
- `JTBD-PM-06` retroactively link prior hands (cross-cutting side effect)

## Personas

Primary:
- [Seat-swap Chris](../personas/situational/seat-swap-chris.md) — the defining situational persona for this journey. Both known issues surfaced by owner live here.

Cross-persona:
- [Chris](../personas/core/chris-live-player.md) — reference
- [Weekend Warrior](../personas/core/weekend-warrior.md)
- [Rounder](../personas/core/rounder.md) — acute scale (200+ players)
- [Ringmaster](../personas/core/ringmaster-home-host.md) — batch-mode primary
- [Circuit Grinder](../personas/core/circuit-grinder.md) — tournament seat-change handling
- [Newcomer](../personas/core/newcomer.md) — first-time-use concern
- [Between-hands Chris](../personas/situational/between-hands-chris.md) — most common invocation context

---

## Flow A — Clear a seat (highest frequency on occupied seats per owner)

### Entry trigger

Seated player leaves the table; seat will be empty until someone new sits.

### Steps

| # | Surface | Action | State change | Time target |
|---|---------|--------|--------------|-------------|
| 1 | `TableView` | Right-click / long-press on occupied seat | `contextMenu` state set with `{ x, y, seat }` | < 1s |
| 2 | `seat-context-menu` | Tap "Clear Player" at bottom of menu | `onClearPlayer(seat)` fires → seat cleared | < 1s (found + tapped) |
| 3 | `TableView` | Menu dismisses; seat renders empty | stats for that seat pause under departed player | < 0.5s |

**Target total:** < 3 seconds from intent to confirmation.

### Current reality (evidence-based)

Per [EVID-2026-04-21-CLEAR-PLAYER](../evidence/LEDGER.md#evid-2026-04-21-clear-player): Clear Player is the *last* item in the menu (after Make My Seat / Make Dealer / Find Player / Create New Player / Recent Players). User has to scan past 5+ items to reach the most likely intent. Step 2 takes longer than target.

### Failure paths

- **User taps a Recent Player by mistake** (Recent is adjacent to Clear at bottom) → wrong player assigned; has to reopen menu and Clear, undoing the mistaken assign.
- **No undo after Clear** — if the wrong seat was cleared, reassignment from memory is required; retro-link does not help here because retro-link is triggered by *assign*, not by clear.
- **User abandons** → seat stays assigned to departed player; stats pollute into next hand.

---

## Flow B — Assign a known player (standard case)

### Entry trigger

New player sits in an empty seat and hero remembers seeing them before OR hero was told their name.

### Steps

| # | Surface | Action | State change | Time target |
|---|---------|--------|--------------|-------------|
| 1 | `TableView` | Right-click / long-press on seat | contextMenu opens | < 1s |
| 2 | `seat-context-menu` | Tap "🔍 Find Player…" | `openPlayerPicker({ seat })` → route to PlayerPickerView | < 1s |
| 3 | `player-picker` | Type name prefix | results filtered live | 2–5s |
| 3a | `player-picker` | (alternative) Tap feature chips to narrow | results re-scored | 3–10s |
| 4 | `player-picker` | Tap ResultCard of target player | `assignPlayerToSeat(seat, playerId)` → retro-link fires → 8s undo toast → close picker | < 1s |
| 5 | `TableView` | Seat renders with player name; toast "Linked N prior hands" | session prior hands re-attributed | < 0.5s |

**Target total:** 5–10 seconds if name is distinctive; up to 30s if feature search is needed.

### Failure paths

- **No match** → user taps `CreateFromQueryCTA` → branches to Flow C with `nameSeed` pre-filled.
- **Wrong player picked** (look-alike) → undo toast (8s window) lets user revert the retro-link; but the seat assignment itself requires manual clear + reassign.
- **Network / IDB error** → toast surfaces error; assignment is rolled back.

---

## Flow C — Create a new player and assign

### Entry trigger

Player is new to the app; hero wants to start tracking them immediately.

### Steps

| # | Surface | Action | State change | Time target |
|---|---------|--------|--------------|-------------|
| 1 | `TableView` | Right-click / long-press on seat | contextMenu opens | < 1s |
| 2 | `seat-context-menu` | Tap "+ Create New Player" | `openPlayerEditor({ mode: 'create', seatContext: { seat, sessionId } })` → route to editor | < 1s |
| 2' | (alternative) `player-picker` → `CreateFromQueryCTA` | Tap with nameSeed set | editor opens with name pre-filled | < 1s |
| 3 | `player-editor` | Type name (optional) | fields update; duplicate warning if matches | 2–5s |
| 4 | `player-editor` | Tap avatar feature swatches | live preview updates | 5–30s (depending on depth) |
| 5 | `player-editor` | Tap Save | `save()` → commit to IDB → assign seat → retro-link → undo toast | < 2s (IDB write) |
| 6 | `TableView` | Player added, seat assigned, toast "Linked N prior hands" | | < 0.5s |

**Target total:** 30–90 seconds for feature-rich entry; < 15 seconds for name-only fallback.

### Failure paths

- **Interrupted mid-entry (phone sleep, dealer starts next hand):** draft autosaves → next mount offers DraftResumeBanner. (Mostly handled by PEO-1.)
- **Form doesn't fit viewport** (known issue) → user can't reach Save button without scroll that doesn't work → user retreats to Back. [EVID-2026-04-21-LANDSCAPE-SCROLL]
- **Save error** → inline error banner; data not committed; user may retry or abandon.

---

## Flow D — Swap the player on a seat

### Entry trigger

A player leaves AND a new player sits, or a player moves seats mid-session.

### Current path (synthesized from Flow A + B)

No direct "Swap" action exists. User must either:
- **Clear first, then Assign** — two-step via seat-context-menu (Flow A → reopen → Flow B).
- **Assign directly** — if picker/editor allow assigning over an occupied seat, this is an implicit swap. Current code appears to allow this (`assignPlayerToSeat` overwrites), but the flow isn't labeled as "Swap" anywhere.

### Steps (two-step current path)

| # | Surface | Action | State change | Time target |
|---|---------|--------|--------------|-------------|
| 1 | `seat-context-menu` | Clear Player | seat cleared | < 3s per Flow A |
| 2 | `TableView` | Reopen context menu on same seat | menu opens again | < 1s |
| 3 | `seat-context-menu` | Find Player or Create New | route to picker or editor | < 1s |
| 4 | `player-picker` | Pick player | seat assigned | < 10s per Flow B |

**Target total:** 10–15 seconds. Current reality: higher due to double-entry and Clear Player burial.

### Potential optimization

A direct "Swap Player…" action could appear in seat-context-menu when seat is occupied, routing to picker with context "swap for seat N." Would halve flow length. NOT proposed as a finding here — captured as observation.

---

## Flow E — Batch-assign at session start (Ringmaster primary, Chris secondary)

### Entry trigger

Session starts. Multiple seats are empty and need assignment in one sitting.

### Steps

| # | Surface | Action | State change | Time target |
|---|---------|--------|--------------|-------------|
| 1 | `TableView` | Right-click any seat → Find Player | route to picker | < 1s |
| 2 | `player-picker` | Tap "Batch" in top bar | `enterBatchMode()` → BatchSeatRibbon appears | < 1s |
| 3 | `player-picker` | Pick a player for current seat | assignment happens; currentSeat advances to next empty | < 10s per seat |
| 4 | (repeat 3) | Continue until all seats filled | BatchSeatRibbon updates pips | |
| 5 | `player-picker` | Last assignment → auto-close | returns to TableView | < 1s |

**Target total:** ~60 seconds for a full 8-opponent table (with all known players).

### Failure paths

- **User exits batch mid-way** — partial assignments persist; exit button visible.
- **User encounters an unknown player** mid-batch → must tap CreateFromQueryCTA → branches to editor → returns to picker still in batch mode? (Verify in Session 3 — behavior not fully traced.)

---

## Cross-flow observations

1. **Clear Player asymmetry.** Chris's "most common post-departure intent is Clear" observation is sharp, but Flow D (Swap) compounds the problem — half of all Swap flows include a Clear. So Clear's burial is paid twice in the Swap path, once in the Clear path.

2. **Undo coverage is asymmetric.** Assign+retro-link has 8s undo toast (gold standard, per PEO-1). Clear has no undo. Create+assign also has the retro-link undo but not a "undo the save" undo. Asymmetric coverage across conceptually-paired actions.

3. **Picker → Editor is smooth, Editor → Picker is not.** Create-from-query seeds editor with name. If user decides mid-edit they actually want to pick an existing player (maybe the duplicate warning triggered), Back returns to picker only if they came from picker. If they came from seat-context-menu → editor direct, they'd Back to TableView and have to reopen context menu.

4. **Batch mode is discoverable but one-way.** Entering batch mid-assignment is impossible — you have to start with an unassigned seat. If you've assigned 2/9 and decide to batch the rest, no path exists.

---

## Linked audits

- [AUDIT-2026-04-21-player-selection](../audits/2026-04-21-player-selection.md) — full audit of the three surfaces + this journey.

---

## Change log

- 2026-04-21 — Created Session 2.
