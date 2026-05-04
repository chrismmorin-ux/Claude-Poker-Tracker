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
**Last reviewed:** 2026-04-26 (partial supersession marked)

---

## Partial supersession by Table-Build (Gate 4 ratified 2026-04-26)

The **create-from-query path** (entered from `PlayerPickerView` → CreateFromQueryCTA, with `nameSeed`) is **absorbed** by [`table-build`](./table-build.md). Table-Build presents create as a continuation past zero matches on the same screen — not a route change.

The **edit-existing path** (entered from `PlayersView` row → "Edit", with `playerId` and `mode: 'edit'`) **survives**. Post-Session-Chris's deep-edit JTBD (PM-07) is still served here. Draft autosave (`usePlayerDraft`) continues to work as today; draft-resume banner unchanged.

Net effect on this surface:
- Entry from `PlayerPickerView` deprecates after Gate 5.
- Entry from `SeatContextMenu` → "Create New Player" deprecates after Gate 5 (collapses into "Open Table-Build").
- Entry from `PlayersView` row → "Edit" remains.
- AvatarFeatureBuilder + NameSection + NotesSection + ImageUploadSection remain operative for the edit path.

**Cross-references:** [Gate 1](../audits/2026-04-26-entry-table-build.md) · [Gate 2](../audits/2026-04-26-blindspot-table-build.md) · [Surface artifact](./table-build.md).

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
- 2026-04-26 — Marked partially superseded by Table-Build (Gate 4 ratified). Create-from-query path absorbed; edit-existing path survives.
- 2026-05-02 — PIO Gate 4 PEX subsection appended (SPR-021 / WS-007). New attribute sections added to surviving edit-mode body: AgeDecadeSection / EthnicitySection / WardrobeSection / JewelrySection / LogoSection. Camera capture entry button. Hat shape envelope upgrade. Implementation deferred to PIO Gate 5 multi-PR.

---

## PIO-G4-PEX — PlayerEditor edit-mode extensions (PIO Gate 4 extension, 2026-05-02)

**Added by:** PIO Gate 4 (WS-007 / SPR-021). See `audits/2026-05-02-gate4-design-player-identification-v2.md` §PIO-G4-PEX for the full spec.

**Scope.** Targets the SURVIVING edit-mode path only. Create-from-query path is absorbed by Table-Build per existing 2026-04-26 supersession. Edit-mode body gains 5 new attribute sections + camera capture entry button. Hat section schema upgrades via migrate-on-read getter shim. PEO 60/30/10 stress-test scaling carries through (no rebuild required).

**New body sections (added after AvatarFeatureBuilder, before PhysicalSection):**

```
┌─ AgeDecadeSection ───────────────────────────────┐
│  AGE: [◯ 20s] [◯ 30s] [◯ 40s] [● 50s] [◯ 60+]    │
└──────────────────────────────────────────────────┘
┌─ EthnicitySection ───────────────────────────────┐
│  ETHNICITY: [Irish ×] [Polish ×]  [+ Add ▼]      │
│   curated-autocomplete + free-text fallback      │
│   (reuses Table-Build's EthnicityTagInput pattern)│
└──────────────────────────────────────────────────┘
┌─ WardrobeSection ────────────────────────────────┐
│  WARDROBE: [polo *] [vest] [jacket] [other ▾]    │
│   palette chips multi-select; 'other' →           │
│   free-text input → otherText capture             │
└──────────────────────────────────────────────────┘
┌─ JewelrySection ─────────────────────────────────┐
│  JEWELRY: [watch] [ring] [other ▾]               │
└──────────────────────────────────────────────────┘
┌─ LogoSection ────────────────────────────────────┐
│  LOGOS: [no-logo] [sports-team] [other ▾]        │
└──────────────────────────────────────────────────┘
```

**Section semantics.**

| Section | Type | Schema field | Notes |
|---|---|---|---|
| AgeDecadeSection | Radio (5 options) | `ageDecade: '20s' \| '30s' \| '40s' \| '50s' \| '60+'` | Default unset; owner explicit pick. Closed enum per Gate 3 ratification. |
| EthnicitySection | Multi-tag chip + autocomplete | `ethnicityTags: string[]` | Reuses Table-Build's EthnicityTagInput (~120-entry curated list + free-text fallback). |
| WardrobeSection | Palette chips multi-select + 'other' free-text | `wardrobe: { palette: string[], otherText: string }` | Initial palette in `asset-palettes.md`. |
| JewelrySection | Same as Wardrobe | `jewelry: { palette: string[], otherText: string }` | |
| LogoSection | Same as Wardrobe | `logo: { palette: string[], otherText: string }` | |

**Hat section schema upgrade.**

Existing `hat: 'hat.cap-team'` flat-string field upgrades to envelope shape `{ palette: 'cap-team', otherText: '' }` per PIO-G3-PALETTE Hat migration nuance. Migrate-on-read pattern: legacy reads adapt via getter shim; persisted-on-next-write. Avoids forcing a v22 mutation on existing records (additive-only IDB v22 invariant).

UI: AvatarFeatureBuilder's existing Hat row continues to show palette mini-avatar swatches. Envelope shape is invisible to the user; getter shim handles the bridge.

**Camera capture entry button.**

Add `[ 📷 Add photo ]` button at top of form (alongside avatar preview, near NameSection):

```
┌─ Photo (NEW) ────────────────────────────────────┐
│  [Avatar 80px or photo thumbnail]                 │
│  [ 📷 Add photo ]   or   [ Replace ] [ Remove ]   │
└──────────────────────────────────────────────────┘
```

- When no photo exists: `[ 📷 Add photo ]` button. Tap → Camera Capture Modal (PIO-G4-S2).
- When photo exists: thumbnail + `[ Replace ]` + `[ Remove ]` affordances.
- Button HIDDEN when `userSettings.photoCaptureEnabled` is `false` (Settings master toggle, PIO-G4-SET).
- AP-PIO-03 binding: button is user-initiated entry only; modal NEVER auto-launches.

**PEO scaling compliance.** Existing PEO 60/30/10 stress-test scaling validated at 1600x720 with prior section count. New PEX sections (~5 sections) fit within scaling envelope. No rebuild required.

**Anti-pattern compliance:** see audit doc §PIO-G4-PEX walkthrough. AP-PIO-03 (camera button user-tap only) + AP-PIO-04 (factual labels) + AP-PIO-05 (capture for identification utility, no recommendations) all clear. Cultural-sensitivity binding affirmed: ethnicity + age decade captured for identification, never for recommendation.
