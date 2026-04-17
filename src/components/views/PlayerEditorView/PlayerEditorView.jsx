/**
 * PlayerEditorView.jsx — Fullscreen player create/edit screen (PEO-2)
 *
 * Route: SCREEN.PLAYER_EDITOR. Driven by uiState.editorContext.
 *
 * Flow:
 *   1. Mount → `usePlayerEditor` hydrates from allPlayers (edit) or offers
 *      draft resume (create).
 *   2. User edits; draft autosaves in background (create mode).
 *   3. Save: derive final name, atomic commit, trigger seat assignment +
 *      retroactive link if seatContext present.
 *   4. Back: flush pending draft, dispatch closePlayerEditor → prevScreen.
 *
 * The editor is fully autonomous: it reads editorContext via UIContext and
 * calls `closePlayerEditor()` to dismiss itself. Parent passes no props
 * beyond the implicit `scale` prop used by other views.
 */

import React, { useRef, useCallback } from 'react';
import { useUI } from '../../../contexts/UIContext';
import { usePlayer } from '../../../contexts/PlayerContext';
import { useToast } from '../../../contexts/ToastContext';
import { usePlayerEditor } from '../../../hooks/usePlayerEditor';
import { useScreenFocusManagement } from '../../../hooks/useScreenFocusManagement';
import BackToTableBar from './BackToTableBar';
import DraftResumeBanner from './DraftResumeBanner';
import NameSection from './NameSection';
import AvatarFeatureBuilder from './AvatarFeatureBuilder';
import PhysicalSection from './PhysicalSection';
import NotesSection from './NotesSection';
import ImageUploadSection from './ImageUploadSection';

const SEATING_TITLE = (seat) => `Assign to Seat ${seat}`;

export const PlayerEditorView = ({ scale = 1 }) => {
  const { editorContext, closePlayerEditor } = useUI();
  const {
    allPlayers,
    assignPlayerToSeat,
    linkPlayerToPriorHandsInSession,
    undoRetroactiveLink,
    loadAllPlayers,
  } = usePlayer();
  const { addToast } = useToast();

  const rootRef = useRef(null);
  const nameInputRef = useRef(null);
  useScreenFocusManagement(rootRef, nameInputRef);

  // onSaveComplete fires AFTER the atomic commit — we wire seat assignment
  // and the retroactive-link toast here so the editor hook stays concerned
  // with just the record-level lifecycle.
  const onSaveComplete = useCallback(async ({ mode, playerId, seatContext }) => {
    // commitDraft / updatePlayer wrote straight to IDB; refresh the in-memory
    // allPlayers list so the picker + PlayersView reflect the new record.
    try {
      await loadAllPlayers();
    } catch {
      // Non-fatal — reducer will catch up on next navigation.
    }

    if (mode === 'create' && seatContext?.seat && playerId) {
      try {
        await assignPlayerToSeat(seatContext.seat, playerId);
      } catch (err) {
        // Non-fatal — the player record is saved. Surface the failure but
        // continue closing.
        addToast(`Saved player but could not assign to seat: ${err.message}`, { variant: 'warning' });
      }

      if (seatContext.sessionId) {
        try {
          const linkResult = await linkPlayerToPriorHandsInSession(
            seatContext.seat, playerId, seatContext.sessionId,
          );
          if (linkResult?.handIds?.length > 0) {
            addToast(
              `Linked ${linkResult.handIds.length} prior hand${linkResult.handIds.length === 1 ? '' : 's'} to this player`,
              {
                variant: 'success',
                duration: 8000,
                action: {
                  label: 'Undo',
                  onClick: () => undoRetroactiveLink(linkResult),
                },
              },
            );
          }
        } catch (err) {
          addToast(`Could not backfill prior hands: ${err.message}`, { variant: 'warning' });
        }
      }
    }
    closePlayerEditor();
  }, [loadAllPlayers, assignPlayerToSeat, linkPlayerToPriorHandsInSession, undoRetroactiveLink, addToast, closePlayerEditor]);

  const {
    fields,
    isDraftLoading,
    draftBanner,
    resumeDraft,
    discardDraft,
    updateField,
    updateAvatarFeature,
    duplicate,
    isSaving,
    saveError,
    save,
    flushPendingDraft,
  } = usePlayerEditor({
    editorContext,
    allPlayers,
    onSaveComplete,
  });

  const handleBack = useCallback(async () => {
    await flushPendingDraft();
    closePlayerEditor();
  }, [flushPendingDraft, closePlayerEditor]);

  const handleSave = useCallback(async () => {
    await save();
  }, [save]);

  const title = editorContext?.seatContext?.seat
    ? SEATING_TITLE(editorContext.seatContext.seat)
    : (editorContext?.mode === 'edit' ? 'Edit Player' : 'New Player');

  return (
    <div
      ref={rootRef}
      className="min-h-screen bg-gray-100 flex flex-col"
      style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
      data-testid="player-editor-view"
    >
      <BackToTableBar
        onBack={handleBack}
        onSave={handleSave}
        title={title}
        isSaving={isSaving}
      />

      {draftBanner === 'visible' ? (
        <DraftResumeBanner
          draftSnippet={null}
          onResume={resumeDraft}
          onDiscard={discardDraft}
        />
      ) : null}

      {isDraftLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
          Loading…
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-3 py-3 space-y-3">
          <NameSection
            name={fields.name}
            nickname={fields.nickname}
            onNameChange={(v) => updateField('name', v)}
            onNicknameChange={(v) => updateField('nickname', v)}
            duplicate={duplicate}
            nameInputRef={nameInputRef}
          />

          <AvatarFeatureBuilder
            avatarFeatures={fields.avatarFeatures}
            onFeatureChange={updateAvatarFeature}
            previewName={fields.name}
          />

          <PhysicalSection
            ethnicity={fields.ethnicity}
            onEthnicityChange={(v) => updateField('ethnicity', v)}
            build={fields.build}
            onBuildChange={(v) => updateField('build', v)}
            gender={fields.gender}
            onGenderChange={(v) => updateField('gender', v)}
            facialHair={fields.facialHair}
            onFacialHairChange={(v) => updateField('facialHair', v)}
            hat={fields.hat}
            onHatChange={(v) => updateField('hat', v)}
            sunglasses={fields.sunglasses}
            onSunglassesChange={(v) => updateField('sunglasses', v)}
          />

          <NotesSection
            notes={fields.notes}
            onNotesChange={(v) => updateField('notes', v)}
          />

          <ImageUploadSection
            avatar={fields.avatar}
            onAvatarChange={(v) => updateField('avatar', v)}
          />

          {saveError ? (
            <div
              className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2"
              role="alert"
              data-testid="save-error"
            >
              Save failed: {saveError.message}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default PlayerEditorView;
