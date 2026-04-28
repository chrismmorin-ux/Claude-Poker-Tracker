# Surface — Player Picker

**ID:** `player-picker`
**Code paths:**
- `src/components/views/PlayerPickerView/PlayerPickerView.jsx`
- `./NameSearchInput.jsx`
- `./FilterChips.jsx`
- `./ResultCard.jsx`
- `./CreateFromQueryCTA.jsx`
- `./BatchSeatRibbon.jsx`
- `src/hooks/usePlayerPicker.js`
- `src/hooks/useScreenFocusManagement.js`

**Route / entry points:**
- `SCREEN.PLAYER_PICKER` (routed via `uiReducer` + `ViewRouter`)
- Opens from: `SeatContextMenu` → "Find Player…" (with `pickerContext.seat` set); batch-mode entry via the Batch button in top bar.
- Closes to: `closePlayerPicker()` → previous screen (usually TableView). Also closes on batch completion.

**Product line:** Main app
**Tier placement:** Plus+ (full player database; Free tier has 50-player cap on source data)
**Last reviewed:** 2026-04-26 (supersession marked)

---

## Superseded by Table-Build (Gate 4 ratified 2026-04-26)

This surface is **fully absorbed** by the new [`table-build`](./table-build.md) surface.

- **NameSearchInput + FilterChips + ResultCard sorting** → Table-Build's CandidateColumn with stability-aware ranking (per `docs/projects/table-build/schema-delta.md` §4).
- **CreateFromQueryCTA** → Table-Build's inline "+ Create new" continuation past zero matches.
- **BatchSeatRibbon** → Table-Build's persistent `tableBuildSession` state (separate from per-player draft autosave).

Until Table-Build ships and is verified at Gate 5, this surface remains operative. After Gate 5 verification, `PlayerPickerView/` code paths archive.

**Cross-references:** [Gate 1](../audits/2026-04-26-entry-table-build.md) · [Gate 2](../audits/2026-04-26-blindspot-table-build.md) · [Gate 3](../../projects/table-build/gate3-research.md) · [Surface artifact](./table-build.md).

---

## Purpose

Find an existing player and assign them to a seat. Supports name search, visual-feature filtering, batch-mode seat-by-seat assignment, and a sticky "create new" CTA for when the search yields no match.

## JTBD served

Primary:
- `JTBD-PM-02` assign a known player to a seat
- `JTBD-PM-05` batch-assign players to seats at session start
- `JTBD-PM-06` retroactively link prior hands (side effect of PM-02)
- `JTBD-PM-09` find a player by visual features

Secondary:
- `JTBD-PM-03` create a new player (via CreateFromQueryCTA → editor)

## Personas served

- [Chris](../personas/core/chris-live-player.md), [Seat-swap Chris](../personas/situational/seat-swap-chris.md), [Between-hands Chris](../personas/situational/between-hands-chris.md) — primary
- [Rounder](../personas/core/rounder.md) — acute scale concerns at 200+ players
- [Ringmaster](../personas/core/ringmaster-home-host.md) — batch-mode primary user (settles game by assigning all regulars at start)
- [Weekend Warrior](../personas/core/weekend-warrior.md) — primary
- [Circuit Grinder](../personas/core/circuit-grinder.md) — less frequent (live MTT tends toward new faces per event)

---

## Anatomy

```
┌────────────────────────────────────────────────────────┐
│ [← Back]   Pick for Seat 4                   [Batch]  │ ← sticky top bar (Z20)
├────────────────────────────────────────────────────────┤
│ [BatchSeatRibbon — only if batchMode.active]           │
├────────────────────────────────────────────────────────┤
│ 🔍 [First name from the dealer's plaque…]   [X]        │ ← NameSearchInput
│ [Skin][Hair][Beard][Glasses][Hat]  [Clear all]         │ ← FilterChips row
│ [▼ Panel when a chip is tapped]                        │ ← inline expansion
├────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────┐   │
│ │ 🧑 Name (matched prefix bold)  [nickname]        │   │
│ │    [feat chip] [feat chip] …        seen 3d ago  │   │
│ │                                     140 hands    │   │
│ └──────────────────────────────────────────────────┘   │ ← ResultCard (scrollable)
│ ┌──────────────────────────────────────────────────┐   │
│ │ 🧑 …                                             │   │
│ └──────────────────────────────────────────────────┘   │
│ …                                                      │
├────────────────────────────────────────────────────────┤
│ [+ Create new: "<query>"]                              │ ← sticky CreateFromQueryCTA
└────────────────────────────────────────────────────────┘
```

Root: `min-h-screen bg-gray-100 flex flex-col` with `transform: scale(scale)`, `transformOrigin: top left`.

## State

- **From context (`useUI`):** `pickerContext` (`{ seat, batchMode }`), `closePlayerPicker`, `openPlayerEditor`.
- **From context (`usePlayer`):** `allPlayers`, `assignPlayerToSeat`, `linkPlayerToPriorHandsInSession`, `undoRetroactiveLink`.
- **From context (`useSession`):** `currentSession`.
- **Local (via `usePlayerPicker`):** `nameQuery`, `featureFilters` (skin/hair/beard/glasses/hat), `results` (scored + sorted list), `currentSeat`, `batchMode`.

## Props / context contract

- `scale: number` (default 1) — viewport scale factor.

## Key interactions

1. **Mount:** autofocus `NameSearchInput`; `useScreenFocusManagement` sets focus & keyboard-trap.
2. **Type in search:** synchronous filter + re-render results.
3. **Tap a filter chip:** opens inline panel below chips row; tap a swatch to apply filter; same swatch re-tap clears. "Clear all" resets.
4. **Tap a result card:** `handlePickPlayer` → assign seat → fire retro-link → show undo toast (8s).
5. **Batch mode:** "Batch" button in top bar → `BatchSeatRibbon` appears → each assignment advances currentSeat; completion closes picker.
6. **Tap Create-from-query CTA:** `openPlayerEditor({ mode: 'create', nameSeed: query, seatContext })` → routes to editor.
7. **Tap Back (top bar):** `closePlayerPicker()` → returns to prevScreen.

---

## Known behavior notes

- **Autofocus:** `NameSearchInput` autofocuses on mount with `preventScroll: true` where supported.
- **Escape key:** in search input, clears query.
- **Filter chip panels:** only one open at a time (`openKey` state in FilterChips).
- **Chip "Skin" category uses color swatches**; other categories use mini-avatar shape swatches.
- **Left-border gold accent on ResultCard** when every active filter matches (`allFiltersMatch`). Recognition aid.
- **No sort control visible to user.** Sort is driven by `scorePlayerMatch` — presumably match quality descending. User can't override to sort by recency alone.
- **CreateFromQueryCTA is sticky bottom** at z-10; sits above the scroll area.

## Known issues

All Session 2 audit findings now implemented.

- ✅ [AUDIT-2026-04-21-F4](../audits/2026-04-21-player-selection.md) — Filter chips bumped to `px-3 py-2 min-h-[36px]` (Session 3).
- ✅ [AUDIT-2026-04-21-F5](../audits/2026-04-21-player-selection.md) — Filter chip panels now `max-h-32 overflow-y-auto` (Session 4).
- ✅ [AUDIT-2026-04-21-F6](../audits/2026-04-21-player-selection.md) — "at seat N" badge on ResultCard + clear-prior-then-assign with move toast (Session 4).
- ✅ [AUDIT-2026-04-21-F7](../audits/2026-04-21-player-selection.md) — Root `h-screen` + `overflow-hidden` for bounded scroll (Session 3).
- ✅ [AUDIT-2026-04-21-F10](../audits/2026-04-21-player-selection.md) — Picker reads `pickerContext.swapMode`, surfaces "Swap <name> (seat N)" title (Session 4).

## Potentially missing

- **No sort control** for the case where search is empty (show most-recent-first vs. alphabetical).
- **No "clear all assignments" at session end** — Ringmaster persona would expect this.

---

## Test coverage

- Unit tests: `PlayerPickerView/__tests__/*.test.jsx` — covers NameSearchInput, FilterChips, CreateFromQueryCTA, ResultCard, BatchSeatRibbon.
- Integration: not formalized in a single test file, but component tests exercise the picker end-to-end for common paths.

## Related surfaces

- `seat-context-menu` — entry.
- `player-editor` — exit when user taps Create-from-query.

---

## Change log

- 2026-04-21 — Created Session 2.
- 2026-04-26 — Marked fully superseded by Table-Build (Gate 4 ratified). Code paths archive after Gate 5 verification.
