# Surface — Seat Context Menu

**ID:** `seat-context-menu`
**Code paths:**
- `src/components/views/TableView/SeatContextMenu.jsx`
- Triggered from `src/components/views/TableView/TableView.jsx` (right-click / long-press on seat)

**Route / entry points:**
- Not a routed screen — rendered as an absolutely-positioned overlay on `TableView`.
- Opens from: right-click (desktop) or long-press (touch) on a seat in `TableView`.
- Closes to: any menu item tap → stays on `TableView` with side effect.

**Product line:** Main app
**Tier placement:** Free+ (core table UX)
**Last reviewed:** 2026-04-21

---

## Purpose

Contextual command menu for a single seat. Primary vehicle for every player-management job except the picker and editor views themselves. Also carries two seat-configuration actions (Make My Seat, Make Dealer) unrelated to player management.

## JTBD served

Primary:
- `JTBD-PM-01` clear a seat when a player leaves — entry point
- `JTBD-PM-02` assign a known player to a seat — entry to picker
- `JTBD-PM-03` create a new player and assign to seat — entry to editor
- `JTBD-PM-04` swap the player on a seat — entry point (currently indirect: clear then assign)

Secondary:
- Seat/dealer configuration (not in player-management domain): "Make My Seat", "Make Dealer"
- Recent-player fast-assign

## Personas served

- [Chris](../personas/core/chris-live-player.md) — primary (current user)
- [Seat-swap Chris](../personas/situational/seat-swap-chris.md) — acute situation
- [Weekend Warrior](../personas/core/weekend-warrior.md) — primary
- [Rounder](../personas/core/rounder.md) — primary
- [Ringmaster](../personas/core/ringmaster-home-host.md) — primary (multi-player seat management)
- [Circuit Grinder](../personas/core/circuit-grinder.md) — primary (tournament seat changes)
- [Newcomer](../personas/core/newcomer.md) — first-time-use concern

---

## Anatomy

Current menu order (`SeatContextMenu.jsx:29-99`):

```
┌──────────────────────────────────┐
│  Make My Seat            [bold]  │  ← seat config #1
│  Make Dealer             [bold]  │  ← seat config #2
├──────────────────────────────────┤
│  ASSIGN PLAYER           [label] │  ← section header
│  🔍 Find Player…         [blue]  │  ← opens picker
│  + Create New Player     [blue]  │  ← opens editor
├──────────────────────────────────┤
│  RECENT                  [label] │  ← conditional section (if recentPlayers)
│  [Recent player 1]               │  ← tap to assign
│  [Recent player 2]               │
│  …                               │
├──────────────────────────────────┤
│  Clear Player           [red]    │  ← conditional (if seat occupied)
└──────────────────────────────────┘
```

Rendered as `<div>` absolute-positioned at cursor/tap location with `left` + `top` styled, `max-h-96 overflow-y-auto`, `minWidth: 180px`.

## State

- **Props:** `contextMenu` object (`{x, y, seat}`), handlers (`onMakeMySeat`, `onMakeDealer`, `onCreateNewPlayer`, `onFindPlayer`, `onAssignPlayer`, `onClearPlayer`), `recentPlayers` list, `getSeatPlayerName(seat)` predicate.
- **Stateless** — all state is parent-owned.
- **Side effects:** each handler dispatches via the usual flow (assign → PlayerContext mutation → reducer update); `onFindPlayer` / `onCreateNewPlayer` navigate to the picker / editor respectively.

## Props / context contract

- `contextMenu: { x, y, seat } | null` — null hides the menu.
- `onMakeMySeat(seat), onMakeDealer(seat), onCreateNewPlayer(seat), onFindPlayer(seat), onAssignPlayer(seat, playerId), onClearPlayer(seat)` — handlers.
- `recentPlayers: Array<{ playerId, name }>` — up to N recent players.
- `getSeatPlayerName(seat): string | null` — used to conditionally render "Clear Player".

## Key interactions

1. **Open menu:** right-click (desktop) or long-press (touch) on seat → menu renders at (x,y).
2. **Tap item:** handler fires → menu closes (via `contextMenu = null` set in parent).
3. **Tap outside:** (handled in parent, not in this component).
4. **Destructive "Clear Player":** fires immediately; **no confirmation, no undo.**

---

## Known behavior notes

- **Conditional Clear:** Clear Player is only rendered when `getSeatPlayerName(seat)` returns truthy. Good Nielsen H-N08 (no irrelevant actions), but see finding F2 below.
- **Menu order is fixed** regardless of seat occupancy state. Violates [H-PLT07](../heuristics/poker-live-table.md) state-aware primary action.
- **No max height safeguard for menu when N recent players is large:** `max-h-96` caps at ~24rem; if `recentPlayers` has 15+ entries, menu scrolls internally. Fine for now; potential issue at scale for Rounder (200+ players, though recentPlayers is typically truncated).
- **Touch-target size:** rows are `py-2` (8px) + content height ≈ 36–40px tall. At scale 0.5 (smaller landscape phones), effective touch target drops to ~18–20px visually. Violates [H-ML06](../heuristics/mobile-landscape.md) ≥44px rule.
- **Destructive adjacency:** Clear Player follows the Recent Players list immediately. On a seat with an assigned player where Recent also shows that player (possible), tapping slightly too low from the intended recent-player row can land on Clear. Violates [H-N05](../heuristics/nielsen-10.md) error prevention.

## Known issues

All four seat-context-menu findings addressed Session 3 (2026-04-21). Awaiting visual verification on physical device.

- ✅ [AUDIT-2026-04-21-F1](../audits/2026-04-21-player-selection.md) — Clear Player now at top when seat occupied (state-aware render).
- ✅ [AUDIT-2026-04-21-F2](../audits/2026-04-21-player-selection.md) — Undo toast added; 6s window; mirrors retro-link pattern. Implemented in `TableView.jsx handleClearPlayer`.
- ✅ [AUDIT-2026-04-21-F3](../audits/2026-04-21-player-selection.md) — Menu branches on `getSeatPlayerName(seat)`; `data-seat-occupied` exposed.
- ✅ [AUDIT-2026-04-21-F4](../audits/2026-04-21-player-selection.md) — Primary rows now `min-h-[44px]`; Recent list `min-h-[40px]` pragmatic (secondary tier). Further work would require layout redesign for 88 DOM-px at scale 0.5.
- ✅ [AUDIT-2026-04-21-F10](../audits/2026-04-21-player-selection.md) — "⇄ Swap Player…" added for occupied seats; routes to picker with swap mode.

---

## Test coverage

- Unit tests: `src/components/views/TableView/__tests__/SeatContextMenu.test.jsx` (exists; exact coverage not reviewed for this surface artifact).

## Related surfaces

- `player-picker` — opened via "Find Player…"
- `player-editor` — opened via "Create New Player"
- Recent Players are an inline shortcut that skips both the picker and editor.

---

## Change log

- 2026-04-21 — Created Session 2.
