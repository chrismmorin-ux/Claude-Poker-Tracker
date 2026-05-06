/**
 * PlayerEditorView.jsx — Fullscreen player create/edit screen (Phase 3 rewrite)
 *
 * Route: SCREEN.PLAYER_EDITOR. Driven by uiState.editorContext.
 *
 * Phase 3 IA per audit §8.2: 4 sections (Must-haves / Helpful /
 * Distinguishing / Optional) with live IdentityAvatar at the top that
 * updates on every keystroke. AvatarFeatureBuilder removed (avatar is
 * fully derived from identification fields). Wardrobe/Jewelry/Logo
 * removed (over-specific palettes — see audit §A4).
 *
 * Flow:
 *   1. Mount → `usePlayerEditor` hydrates from allPlayers (edit) or offers
 *      draft resume (create).
 *   2. User edits; live avatar reflects every change immediately.
 *   3. Save: derive final name, atomic commit, trigger seat assignment +
 *      retroactive link if seatContext present.
 *   4. Back: flush pending draft, dispatch closePlayerEditor → prevScreen.
 */

import React, { useRef, useCallback } from 'react';
import { useUI } from '../../../contexts/UIContext';
import { usePlayer } from '../../../contexts/PlayerContext';
import { useToast } from '../../../contexts/ToastContext';
import { usePlayerEditor } from '../../../hooks/usePlayerEditor';
import { useScreenFocusManagement } from '../../../hooks/useScreenFocusManagement';
// Phase C (2026-05-05): editor renders portrait-native — no ScaledContainer,
// no fixed 1600×720 frame. See feedback_portrait_mode_player_screens.md.
import IdentityAvatar from '../../ui/IdentityAvatar';
import BackToTableBar from './BackToTableBar';
import DraftResumeBanner from './DraftResumeBanner';
import NameSection from './NameSection';
import NotesSection from './NotesSection';
// Phase 3 sections (must-haves → optional)
import { SexSection } from './SexSection';
import { AgeDecadeSection } from './AgeDecadeSection';
import { EthnicityTagsSection } from './EthnicityTagsSection';
import { HairSection } from './HairSection';
import { FacialHairSection } from './FacialHairSection';
import { SkinToneSection } from './SkinToneSection';
import { BuildSection } from './BuildSection';
import { EyewearSection } from './EyewearSection';
import { DistinguishingMarksSection } from './DistinguishingMarksSection';
import { HeadwearSection } from './HeadwearSection';
import { AccessoryInventorySection } from './AccessoryInventorySection';
// Camera capture (PIO G5 child B / WS-161)
import { CameraButton } from './CameraButton';

const SEATING_TITLE = (seat) => `Assign to Seat ${seat}`;

const SectionGroup = ({ title, children }) => (
  <div className="mb-5 pb-3 border-b border-gray-300/40 last:border-b-0 last:pb-0">
    <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-semibold">
      {title}
    </div>
    {children}
  </div>
);

export const PlayerEditorView = ({ scale: _scale = 1 }) => {
  const { editorContext, closePlayerEditor } = useUI();
  const {
    allPlayers,
    assignPlayerToSeat,
    loadAllPlayers,
  } = usePlayer();
  const { addToast } = useToast();

  const rootRef = useRef(null);
  const nameInputRef = useRef(null);
  useScreenFocusManagement(rootRef, nameInputRef);

  // onSaveComplete fires AFTER the atomic commit — wires seat assignment +
  // retroactive-link toast. Editor hook stays focused on record lifecycle.
  const onSaveComplete = useCallback(async ({ mode, playerId, seatContext }) => {
    try {
      await loadAllPlayers();
    } catch {
      // Non-fatal — reducer will catch up on next navigation.
    }

    if (mode === 'create' && seatContext?.seat && playerId) {
      try {
        await assignPlayerToSeat(seatContext.seat, playerId, {
          sessionId: seatContext.sessionId ?? null,
          source: 'editor-create-then-assign',
        });
      } catch (err) {
        addToast(`Saved player but could not assign to seat: ${err.message}`, { variant: 'warning' });
      }

      // Owner-revised 2026-05-05: NO auto retroactive linking after a
      // create-then-assign flow. Newly-created players start at zero hands;
      // they only attribute hands going forward. Past behavior surprised the
      // owner with phantom hand counts after table-clears + new sessions.
    }
    closePlayerEditor();
  }, [loadAllPlayers, assignPlayerToSeat, addToast, closePlayerEditor]);

  const {
    fields,
    isDraftLoading,
    draftBanner,
    resumeDraft,
    discardDraft,
    updateField,
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
      className="bg-gray-100 h-dvh w-full flex flex-col overflow-hidden"
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
        // Always single-column (portrait-style stack), regardless of viewport
        // width. Owner uses the phone in landscape for TableView; the editor
        // body should still stack vertically. See feedback_portrait_mode_player_screens.md.
        <div className="flex-1 overflow-y-auto px-3 py-3">

          {/* Live IdentityAvatar — sticky-top, scrolls with the form. */}
          <div className="sticky top-0 z-10 mb-3 bg-gray-100 pb-2">
            <div
              className="bg-white border border-gray-300 rounded-lg p-2 flex items-center gap-3"
              data-testid="player-editor-live-avatar"
            >
              <div className="w-[96px] h-[96px] rounded-full overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                <IdentityAvatar
                  player={fields}
                  size={96}
                  headwearOverride={fields.headwear}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-700 truncate">
                  {fields.name || (
                    <span className="text-gray-400 italic">No name yet</span>
                  )}
                </div>
                {fields.nickname ? (
                  <div className="text-xs text-gray-500 truncate">
                    "{fields.nickname}"
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Sections — must-haves → helpful → distinguishing → optional */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
              <NameSection
                name={fields.name}
                nickname={fields.nickname}
                onNameChange={(v) => updateField('name', v)}
                onNicknameChange={(v) => updateField('nickname', v)}
                duplicate={duplicate}
                nameInputRef={nameInputRef}
              />

              <SectionGroup title="Must-haves">
                <SexSection
                  value={fields.sex}
                  onChange={(v) => updateField('sex', v)}
                />
                <AgeDecadeSection
                  value={fields.ageDecade}
                  onChange={(v) => updateField('ageDecade', v)}
                />
                <EthnicityTagsSection
                  value={fields.ethnicityTags}
                  legacyEthnicity={fields.ethnicity}
                  onChange={(v) => updateField('ethnicityTags', v)}
                />
              </SectionGroup>

              <SectionGroup title="Helpful">
                <SkinToneSection
                  value={fields.skinTone}
                  onChange={(v) => updateField('skinTone', v)}
                  ethnicityHint={
                    Array.isArray(fields.ethnicityTags) && fields.ethnicityTags.length > 0
                  }
                />
                <HairSection
                  hairColor={fields.hairColor}
                  hairLength={fields.hairLength}
                  hairTexture={fields.hairTexture}
                  hairSaltPepper={fields.hairSaltPepper}
                  onColorChange={(v) => updateField('hairColor', v)}
                  onLengthChange={(v) => updateField('hairLength', v)}
                  onTextureChange={(v) => updateField('hairTexture', v)}
                  onSaltPepperChange={(v) => updateField('hairSaltPepper', v)}
                />
                <FacialHairSection
                  value={fields.facialHair}
                  onChange={(v) => updateField('facialHair', v)}
                  sex={fields.sex}
                  beardColor={fields.beardColor}
                  onBeardColorChange={(v) => updateField('beardColor', v)}
                />
                <BuildSection
                  value={fields.build}
                  onChange={(v) => updateField('build', v)}
                />
                <EyewearSection
                  value={fields.eyewear}
                  color={fields.eyewearColor}
                  onChange={(v) => updateField('eyewear', v)}
                  onColorChange={(v) => updateField('eyewearColor', v)}
                />
              </SectionGroup>

              <SectionGroup title="Distinguishing marks">
                <DistinguishingMarksSection
                  value={fields.distinguishingMarks}
                  onChange={(v) => updateField('distinguishingMarks', v)}
                />
              </SectionGroup>

              <SectionGroup title="Accessories">
                <AccessoryInventorySection
                  inventory={fields.accessoryInventory}
                  onChange={(v) => updateField('accessoryInventory', v)}
                />
              </SectionGroup>

              <SectionGroup title="Optional">
                <HeadwearSection
                  value={fields.headwear}
                  onChange={(v) => updateField('headwear', v)}
                />
                <CameraButton
                  playerId={editorContext?.playerId ?? null}
                  photoBlobId={fields.photoBlobId}
                  onPhotoSaved={(blobId) => updateField('photoBlobId', blobId)}
                />
                <NotesSection
                  notes={fields.notes}
                  onNotesChange={(v) => updateField('notes', v)}
                />
              </SectionGroup>

            {saveError ? (
              <div
                className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2 mt-3"
                role="alert"
                data-testid="save-error"
              >
                Save failed: {saveError.message}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerEditorView;
