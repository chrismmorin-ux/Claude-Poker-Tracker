# PEO-2 Handoff — Fullscreen PlayerEditorView

**Session:** PEO-2 (second of four)
**Program:** Player Entry Overhaul — `.claude/projects/player-entry-overhaul.md`
**Plan:** `C:\Users\chris\.claude\plans\fluttering-booping-puddle.md`
**Started:** 2026-04-16
**Depends on:** PEO-1 (shipped 2026-04-16)

---

## Scope

Build the fullscreen `PlayerEditorView` route (SCREEN.PLAYER_EDITOR, already declared in PEO-1). Create + edit modes, autosave-backed draft, non-blocking save (always enabled), auto-name fallback, duplicate-name warning (non-blocking), image-upload section collapsed by default.

**Dark merge:** no entry points from existing UI are rewired in this session. PEO-3 will wire `SeatContextMenu` "Create New Player" to route here. Until then, the editor is reachable only via a direct `setCurrentScreen(SCREEN.PLAYER_EDITOR)` dispatch, which is sufficient for manual QA.

## Files I Own (active session)

**Creating:**
- `src/utils/playerAutoName.js` — pure `deriveAutoName(fields, seatContext)` + helper `pickDistinctiveFeature()`.
- `src/hooks/usePlayerEditor.js` (+ tests).
- `src/components/views/PlayerEditorView/PlayerEditorView.jsx`.
- `src/components/views/PlayerEditorView/BackToTableBar.jsx`.
- `src/components/views/PlayerEditorView/DraftResumeBanner.jsx`.
- `src/components/views/PlayerEditorView/NameSection.jsx`.
- `src/components/views/PlayerEditorView/AvatarFeatureBuilder.jsx`.
- `src/components/views/PlayerEditorView/PhysicalSection.jsx`.
- `src/components/views/PlayerEditorView/NotesSection.jsx`.
- `src/components/views/PlayerEditorView/ImageUploadSection.jsx`.
- Tests for each.

**Modifying:**
- `src/PokerTracker.jsx` — add case for `SCREEN.PLAYER_EDITOR` to screen switch.

## Contract

`editorContext` drives everything:
```
{
  mode: 'create' | 'edit',
  playerId?: number,           // only for mode='edit'
  seatContext?: { seat, sessionId } | null,
  prevScreen: string,          // captured by openPlayerEditor
  nameSeed?: string,           // pre-fill name (from picker CreateFromQueryCTA)
}
```

On save (create):
1. Flush any pending draft autosave.
2. Derive final name (user-typed → seat+feature fallback → timestamp fallback), record `nameSource`.
3. Call `commitDraft(userId, finalRecord)` — atomic: player add + draft delete in one IDB transaction.
4. If `seatContext` present:
   - `assignPlayerToSeat(seat, playerId)` (current-hand mapping).
   - `linkPlayerToPriorHandsInSession(seat, playerId, sessionId)` → fire undo-toast with action.
5. Close editor → route returns to `prevScreen`.

On save (edit): `updatePlayerById(playerId, fields)` + close.

## Non-Blocking Invariants

- Save button never disabled.
- No required fields; autoName guarantees a non-empty final name.
- Duplicate-name detection shows inline warning but does NOT block save (user may legitimately create "Mike" twice if the exact duplicate is intentional — we surface, we don't gate).
- Back-to-Table is always instant; any pending debounced autosave is flushed first.

## Acceptance Criteria

- Tests green.
- Manual dev-server walkthrough: navigate via `dispatchUi(SET_SCREEN, 'playerEditor')` → editor renders → type a name → close tab → reopen → `DraftResumeBanner` appears.
- Save with blank name + seatContext → player saved with `"Seat 3 — <feature>"` and `nameSource: 'auto'`.
- Duplicate name → warning appears inline, save still succeeds.

## Close Criteria

- PEO-3 unblocked (has the editor screen to route from `SeatContextMenu` "Create New" and `CreateFromQueryCTA`).
- No existing UI entry points touched.
- SYSTEM_MODEL, CHANGELOG updated.
