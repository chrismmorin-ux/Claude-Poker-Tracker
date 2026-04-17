# PEO-1 Handoff — Data Layer + Avatar System

**Session:** PEO-1 (first of four)
**Program:** Player Entry Overhaul — `.claude/projects/player-entry-overhaul.md`
**Plan:** `C:\Users\chris\.claude\plans\fluttering-booping-puddle.md`
**Started:** 2026-04-16
**Owner verification:** plan approved 2026-04-16

---

## Scope

All data-layer + avatar-system infrastructure. No UI changes. No entry points rewired. Dark merge — code is unreachable from existing navigation until PEO-2/PEO-3.

## Files I Own (active session)

**Creating:**
- `src/constants/avatarFeatureConstants.js`
- `src/assets/avatarFeatures/index.js`
- `src/assets/avatarFeatures/skin.js`
- `src/assets/avatarFeatures/hair.js`
- `src/assets/avatarFeatures/beard.js`
- `src/assets/avatarFeatures/eyes.js`
- `src/assets/avatarFeatures/glasses.js`
- `src/assets/avatarFeatures/hat.js`
- `src/components/ui/AvatarRenderer.jsx` (+ test)
- `src/components/ui/AvatarMonogram.jsx` (+ test)
- `src/components/ui/PlayerAvatar.jsx` (+ test)
- `src/utils/persistence/draftsStorage.js` (+ test)
- `src/utils/persistence/handLinking.js` (+ test)
- `src/utils/persistence/statsRecompute.js` (+ test)
- `src/hooks/usePlayerDraft.js` (+ test)
- `src/hooks/useRetroactiveLinking.js` (+ test)
- `src/hooks/useScreenFocusManagement.js` (+ test)

**Modifying:**
- `src/utils/persistence/database.js` — DB_VERSION 13→14, add PLAYER_DRAFTS_STORE_NAME
- `src/utils/persistence/migrations.js` — add `migrateV14`
- `src/utils/persistence/validation.js` — validate avatarFeatures, nameSource, draft shape
- `src/utils/persistence/playersStorage.js` — allow avatarFeatures + nameSource through create/update
- `src/utils/persistence/handsStorage.js` — updateSeatPlayerForHand + batch
- `src/reducers/playerReducer.js` — RETROACTIVELY_LINK_PLAYER + UNDO_RETROACTIVE_LINK
- `src/reducers/uiReducer.js` — editorContext + pickerContext + actions
- `src/contexts/PlayerContext.jsx` — expose linkPlayerToPriorHandsInSession + undoRetroactiveLink
- `src/contexts/UIContext.jsx` — expose setEditorContext + setPickerContext
- `src/hooks/usePlayerPersistence.js` — thread retro-link + stats recompute
- `src/constants/playerConstants.js` — new player action types

## Migration Runbook (v13 → v14)

**Pre-upgrade checklist:**
- Dump counts: `players`, `hands`, `sessions`, `activeSession` records.
- Record current DB_VERSION is 13 (confirmed at `database.js:50`).

**Post-upgrade expectations:**
- `playerDrafts` object store exists with `keyPath: 'userId'`.
- Existing player records: **unchanged**. No `avatarFeatures` field added to legacy records (detected as absence → renders monogram).
- Existing hand records: **unchanged**.
- No store renames, no deletes.

**Rollback:**
- v14 is additive only. Downgrading code + DB_VERSION to 13 is safe; new `playerDrafts` store becomes inert but present. Users re-upgrade cleanly.

## Invariants Shipping in This Session

Promote to `.claude/context/INVARIANTS.md`:
- **I-PEO-1** Draft singleton per user (atomic player-put + draft-delete).
- **I-PEO-2** Retro-link session scope (same sessionId only).
- **I-PEO-3** Retro-link idempotence.
- **I-PEO-4** Undo captures exact handIds.

## Acceptance Criteria

- `bash scripts/smart-test-runner.sh` green.
- New tests cover all edge cases in plan §D3 for `linkPlayerToPriorSeatHands`.
- Fake-indexeddb integration test: create player → assign to seat with prior hands → retro-link runs → `player.handCount` reflects backfill → undo → `player.handCount` reverts.
- `PlayerAvatar` renders correctly for: (a) full avatarFeatures, (b) partial (some "none"), (c) null avatarFeatures (monogram fallback), (d) missing player entirely (silhouette).
- SYSTEM_MODEL, INVARIANTS, STATE_SCHEMA updated.

## Close Criteria

- All new code merged with passing tests.
- PEO-2 unblocked (has the data layer + avatar components it needs).
- No orphan code or half-wired paths.

## Next Session Notes (PEO-2)

Will consume:
- `PlayerAvatar` component (for future list rendering).
- `usePlayerDraft` hook (for autosave + resume).
- `editorContext` reducer state (for screen routing).
- `AvatarRenderer` + `AVATAR_FEATURES` data (for builder UI).
- `useScreenFocusManagement` (for fullscreen route focus handling).
