# Surface — Player Editor

**ID:** `player-editor`
**Code paths:**
- `src/components/views/PlayerEditorView/PlayerEditorView.jsx`
- `./BackToTableBar.jsx`
- `./DraftResumeBanner.jsx`
- `./NameSection.jsx`
- `./AvatarFeatureBuilder.jsx`
- `./PhysicalSection.jsx`
- `./NotesSection.jsx`
- `./ImageUploadSection.jsx`
- `src/hooks/usePlayerEditor.js`
- `src/hooks/usePlayerDraft.js`
- `src/hooks/useScreenFocusManagement.js`

**Route / entry points:**
- `SCREEN.PLAYER_EDITOR` (routed via `uiReducer` + `ViewRouter`)
- Opens from: `SeatContextMenu` → "Create New Player"; or `PlayerPickerView` → CreateFromQueryCTA (with `nameSeed`); or `PlayersView` → tap-to-edit.
- Closes to: `closePlayerEditor()` → previous screen.

**Product line:** Main app
**Tier placement:** Free+ (core player-management flow, though unlimited players are Plus+)
**Last reviewed:** 2026-04-21

---

## Purpose

Create a new player or edit an existing one. Drives the avatar-feature recognition system (the Picker's killer search vector). Non-blocking form with draft autosave, so interruptions don't cost input. When seat-context is present, saving auto-assigns to seat and backfills prior hands.

## JTBD served

Primary:
- `JTBD-PM-03` create a new player and assign to seat
- `JTBD-PM-07` edit an existing player's record
- `JTBD-PM-08` resume an in-progress player draft

Secondary:
- `JTBD-PM-06` retroactively link prior hands (automatic post-save when seatContext present)

## Personas served

- [Chris](../personas/core/chris-live-player.md), [Seat-swap Chris](../personas/situational/seat-swap-chris.md) — primary.
- [Between-hands Chris](../personas/situational/between-hands-chris.md) — secondary (create during slow hand; draft resume important).
- [Post-session Chris](../personas/situational/post-session-chris.md) — edit existing records.
- [Weekend Warrior](../personas/core/weekend-warrior.md), [Rounder](../personas/core/rounder.md), [Ringmaster](../personas/core/ringmaster-home-host.md) — primary.
- [Newcomer](../personas/core/newcomer.md) — first-time; may be daunted by full feature builder.

---

## Anatomy

```
┌────────────────────────────────────────────────────────┐
│ [← Back]   Assign to Seat 4              [Save]        │ ← BackToTableBar (sticky z20)
├────────────────────────────────────────────────────────┤
│ [DraftResumeBanner — only if draftBanner === 'visible'] │
├────────────────────────────────────────────────────────┤
│ ┌─ NameSection ────────────────────────────────────┐   │
│ │  Name: [_____________]                           │   │
│ │    ⚠ duplicate warning (inline, non-blocking)    │   │
│ │  Nickname: [_____________]                       │   │
│ └──────────────────────────────────────────────────┘   │
│ ┌─ AvatarFeatureBuilder ───────────────────────────┐   │
│ │  [Avatar preview 72px]  "Pick what stands out…"  │   │
│ │  SKIN TONE:     [swatches row →]                 │   │
│ │  HAIR STYLE:    [mini-avatar swatches row →]     │   │
│ │  HAIR COLOR:    [color swatches — conditional]   │   │
│ │  BEARD/FACIAL:  [mini-avatar swatches row →]     │   │
│ │  BEARD COLOR:   [color swatches — conditional]   │   │
│ │  EYES:          [mini-avatar swatches row →]     │   │
│ │  EYE COLOR:     [color swatches row →]           │   │
│ │  GLASSES:       [mini-avatar swatches row →]     │   │
│ │  HAT:           [mini-avatar swatches row →]     │   │
│ └──────────────────────────────────────────────────┘   │
│ ┌─ PhysicalSection (collapsible, default CLOSED) ──┐   │
│ │  ▸ Physical Notes (optional)                     │   │
│ └──────────────────────────────────────────────────┘   │
│ ┌─ NotesSection ───────────────────────────────────┐   │
│ │  Notes: [textarea]                               │   │
│ └──────────────────────────────────────────────────┘   │
│ ┌─ ImageUploadSection ─────────────────────────────┐   │
│ │  Image upload…                                   │   │
│ └──────────────────────────────────────────────────┘   │
│ (saveError banner if present)                          │
└────────────────────────────────────────────────────────┘
```

Root: `min-h-screen bg-gray-100 flex flex-col` with `transform: scale(scale)`, `transformOrigin: top left`. Body is `<div class="flex-1 overflow-auto px-3 py-3 space-y-3">`.

## State

- **From context (`useUI`):** `editorContext` (`{ mode: 'create' | 'edit', playerId?, nameSeed?, seatContext? }`), `closePlayerEditor`.
- **From context (`usePlayer`):** `allPlayers`, `assignPlayerToSeat`, `linkPlayerToPriorHandsInSession`, `undoRetroactiveLink`, `loadAllPlayers`.
- **Local (via `usePlayerEditor`):** `fields` (name, nickname, avatarFeatures, notes, ethnicity, build, gender, facialHair, hat, sunglasses, avatar), `duplicate`, `draftBanner`, `isSaving`, `saveError`.

## Key interactions

1. **Mount:** `useScreenFocusManagement` sets focus to `NameSection` input; `usePlayerEditor` hydrates from editorContext (allPlayers lookup for edit) or offers draft resume.
2. **Type in name:** updates fields; duplicate-detection runs; inline warning shown if duplicate.
3. **Tap avatar swatch:** updates avatarFeatures; live preview refreshes.
4. **Tap Save:** `save()` → commit → if seatContext: assign seat + retro-link → undo toast → close.
5. **Tap Back:** `flushPendingDraft()` → close (returns to prev screen).
6. **Interrupted mid-entry:** autosave fires periodically; on next `create` mode mount, `DraftResumeBanner` offers to resume.

---

## Known behavior notes

- **Draft autosave:** debounced. Flushed on Back.
- **Non-blocking save:** duplicate name warning does NOT prevent save.
- **Auto-name fallback:** if user saves with empty name, hook derives a fallback (seat+feature, then timestamp — see `usePlayerEditor`).
- **Scale + scroll composition:** root uses `min-h-screen` + `transform: scale(top-left)`. The body is `flex-1 overflow-auto`. See F7 for landscape scroll hypothesis.
- **Many sections, long content:** full form renders ~9 avatar-feature sections + name + physical + notes + image upload → DOM content extends well past any phone landscape viewport.

## Known issues

- ✅ [AUDIT-2026-04-21-F7](../audits/2026-04-21-player-selection.md) — Root changed from `min-h-screen` to `h-screen` + `overflow-hidden`; body's `flex-1 overflow-auto` now has a bounded parent and scroll engages. Awaiting visual verification on physical phone.
- ✅ [AUDIT-2026-04-21-F8](../audits/2026-04-21-player-selection.md) — AvatarFeatureBuilder secondary rows now collapsed behind "More details" toggle (Session 4).
- ✅ [AUDIT-2026-04-21-F9](../audits/2026-04-21-player-selection.md) — Density pattern aligned with PhysicalSection — both collapsible with Chevron pattern (Session 4).

## Potentially missing

- No "save and add another" pattern for batch scenarios (Ringmaster creating 4 new players at session start).
- No way to quickly clone a player record (e.g., twins at the table).

---

## Test coverage

- Unit tests: `PlayerEditorView/__tests__/*.test.jsx` — covers AvatarFeatureBuilder, NameSection, BackToTableBar, DraftResumeBanner, PlayerEditorView integration.

## Related surfaces

- `seat-context-menu` — primary entry.
- `player-picker` — entry via CreateFromQueryCTA.
- `PlayersView` — entry for edit mode.

---

## Change log

- 2026-04-21 — Created Session 2.
