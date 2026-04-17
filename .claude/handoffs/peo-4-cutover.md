# PEO-4 Handoff — Cutover + Cleanup + Docs

**Session:** PEO-4 (last of four)
**Program:** Player Entry Overhaul — `.claude/projects/player-entry-overhaul.md`
**Plan:** `C:\Users\chris\.claude\plans\fluttering-booping-puddle.md`
**Started:** 2026-04-16
**Depends on:** PEO-1 + PEO-2 + PEO-3 (all shipped 2026-04-16)

---

## Scope

Final cleanup session. No new user-facing features — migrate the one remaining consumer (`PlayersView`) off the old modal-based `PlayerForm`, delete the defunct directory, remove the now-redundant `pendingSeatForPlayerAssignment` field, and update the governance docs to reflect the finished state.

## Files I Own (active session)

**Modifying:**
- `src/components/views/PlayersView.jsx` — replace `<PlayerForm>` mount with `openPlayerEditor()` route dispatch for both create and edit flows. Preserve SeatAssignmentGrid behavior.
- `src/reducers/uiReducer.js` — remove `pendingSeatForPlayerAssignment` field, `SET_PENDING_SEAT_FOR_PLAYER` action, and schema entry.
- `src/contexts/UIContext.jsx` — remove `pendingSeatForPlayerAssignment` destructure + `setPendingSeatForPlayerAssignment` handler exposure.
- `src/components/views/TableView/TableView.jsx` — drop unused `setPendingSeatForPlayerAssignment` import.
- Tests: update any tests that reference `pendingSeatForPlayerAssignment` (uiReducer + PlayersView + UIContext tests).

**Deleting (after verified orphan):**
- `src/components/ui/PlayerForm/index.jsx`
- `src/components/ui/PlayerForm/BasicInfoSection.jsx`
- `src/components/ui/PlayerForm/PhysicalSection.jsx`
- `src/components/ui/PlayerForm/StyleTagsSection.jsx`
- `src/components/ui/PlayerForm/AvatarSection.jsx`

**Governance (updating):**
- `.claude/context/SYSTEM_MODEL.md` — new views/hooks, PlayerEntry flow section.
- `.claude/context/STATE_SCHEMA.md` — remove pendingSeat; already has editorContext/pickerContext from PEO-1.
- `docs/CHANGELOG.md` — PEO-4 entry + program close.
- `.claude/STATUS.md` — program COMPLETE.
- `.claude/BACKLOG.md` — PEO-4 and PEO program marked COMPLETE.
- `.claude/projects/player-entry-overhaul.md` — write post-mortem section.

## Acceptance Criteria

- `grep -r "PlayerForm" src/` → zero matches after deletion.
- `grep -r "pendingSeatForPlayerAssignment" src/` → zero matches.
- PlayersView "Add Player" flow opens the fullscreen editor, not a modal.
- Edit existing player from PlayersView opens editor with `mode: 'edit', playerId`.
- Full suite green (expected ≥ 5,760).

## Close Criteria

- Program closed in STATUS + BACKLOG.
- Post-mortem written in `.claude/projects/player-entry-overhaul.md`.
- CHANGELOG updated with PEO-4 entry + program summary.
- SYSTEM_MODEL reflects final state.
