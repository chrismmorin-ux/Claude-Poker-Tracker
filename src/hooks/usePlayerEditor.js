/**
 * usePlayerEditor.js — Player editor form orchestration (PEO-2)
 *
 * Binds the in-progress form fields to `usePlayerDraft`, wires auto-name
 * derivation at save time, and provides atomic save via `commitDraft`
 * (create mode) or `updatePlayer` (edit mode).
 *
 * Contract:
 *   editorContext = {
 *     mode: 'create' | 'edit',
 *     playerId?: number,              // required for mode='edit'
 *     seatContext?: { seat, sessionId } | null,
 *     prevScreen: string,
 *     nameSeed?: string,              // pre-fill for name
 *   }
 *
 * Public API:
 *   {
 *     fields,                  // current form state
 *     isDraftLoading,          // true during initial load
 *     draftBanner,             // null | 'visible' | 'dismissed'
 *     resumeDraft, discardDraft,
 *     updateField(key, value),
 *     updateAvatarFeature(category, featureId),
 *     duplicate,               // null | { playerId, name } if name matches another
 *     isSaving,                // true while commit is in flight
 *     saveError,               // null | Error
 *     save,                    // async () => finalPlayerId | null
 *     flushPendingDraft,       // explicit flush for Back-to-Table
 *   }
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayerDraft } from './usePlayerDraft';
import {
  commitDraft,
  updatePlayer,
  GUEST_USER_ID,
} from '../utils/persistence';
import { deriveAutoName } from '../utils/playerAutoName';

const DEFAULT_FIELDS = {
  name: '',
  nickname: '',
  ethnicity: '',
  build: '',
  gender: '',
  facialHair: '',
  hat: false,
  sunglasses: false,
  styleTags: [],
  notes: '',
  avatar: '',           // legacy image upload
  avatarFeatures: null, // PEO-1 feature sub-object
};

// Fields we accept from a loaded player or draft. Anything outside this set
// is ignored to avoid dragging DB-internal metadata (createdAt, handCount,
// stats, etc.) into the in-memory form state.
const EDITOR_FIELD_KEYS = Object.keys(DEFAULT_FIELDS);

const normalizeFields = (src = {}) => {
  const next = { ...DEFAULT_FIELDS };
  for (const key of EDITOR_FIELD_KEYS) {
    if (src[key] !== undefined && src[key] !== null) {
      next[key] = src[key];
    }
  }
  return next;
};

export const usePlayerEditor = ({
  editorContext,
  userId = GUEST_USER_ID,
  allPlayers = [],
  onSaveComplete,
} = {}) => {
  const mode = editorContext?.mode || 'create';
  const editingPlayerId = editorContext?.playerId ?? null;
  const seatContext = editorContext?.seatContext || null;
  const nameSeed = editorContext?.nameSeed || '';

  // Draft lifecycle (autosave + resume + discard) from PEO-1 hook.
  const {
    draft,
    isLoading: isDraftLoading,
    saveDraft,
    flushDraft,
    resumeDraft: resumeStored,
    discardDraft: discardStored,
  } = usePlayerDraft(userId);

  // Form state.
  const [fields, setFields] = useState(DEFAULT_FIELDS);
  // Banner flow: `null` → not shown (never had a draft or already decided);
  //              'visible' → offering resume/discard;
  //              'dismissed' → user has made a choice, do not re-show.
  const [draftBanner, setDraftBanner] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Hydration sentinel: prevents the draft-banner effect from firing on
  // re-mounts of the same context. Keyed by a sealed copy of editorContext.
  const hydratedRef = useRef({ key: null });

  const buildHydrationKey = useCallback(() => {
    return [mode, editingPlayerId, nameSeed, seatContext?.seat ?? 'no-seat'].join('|');
  }, [mode, editingPlayerId, nameSeed, seatContext]);

  // ---- Hydration: edit mode → load by id; create mode → seed or offer resume
  useEffect(() => {
    const key = buildHydrationKey();
    if (hydratedRef.current.key === key) return;

    if (mode === 'edit' && typeof editingPlayerId === 'number') {
      const existing = allPlayers.find(p => p.playerId === editingPlayerId);
      if (existing) {
        setFields(normalizeFields(existing));
        hydratedRef.current.key = key;
      }
      return;
    }

    if (mode === 'create') {
      // Wait until draft load settles to avoid flashing seed → draft resume.
      if (isDraftLoading) return;

      if (draft?.draft && !hydratedRef.current.key) {
        // Existing draft found — show banner; hold form in seed-or-empty state
        // until user chooses.
        setFields(nameSeed ? { ...DEFAULT_FIELDS, name: nameSeed } : DEFAULT_FIELDS);
        setDraftBanner('visible');
      } else {
        setFields(nameSeed ? { ...DEFAULT_FIELDS, name: nameSeed } : DEFAULT_FIELDS);
        setDraftBanner(null);
      }
      hydratedRef.current.key = key;
    }
  }, [mode, editingPlayerId, allPlayers, draft, isDraftLoading, nameSeed, buildHydrationKey]);

  // ---- Field update handlers ------------------------------------------
  const updateField = useCallback((key, value) => {
    setFields(prev => {
      const next = { ...prev, [key]: value };
      // Only autosave in create mode — edit mode writes straight to the
      // player record on save; keeping a draft there would fight the
      // single-draft invariant.
      if (mode === 'create') saveDraft(next, seatContext);
      return next;
    });
  }, [mode, saveDraft, seatContext]);

  const updateAvatarFeature = useCallback((category, featureId) => {
    setFields(prev => {
      const nextFeatures = { ...(prev.avatarFeatures || {}), [category]: featureId };
      const next = { ...prev, avatarFeatures: nextFeatures };
      if (mode === 'create') saveDraft(next, seatContext);
      return next;
    });
  }, [mode, saveDraft, seatContext]);

  // ---- Draft resume / discard ------------------------------------------
  const resumeDraft = useCallback(async () => {
    const payload = await resumeStored();
    if (payload) {
      setFields(normalizeFields(payload));
    }
    setDraftBanner('dismissed');
  }, [resumeStored]);

  const discardDraft = useCallback(async () => {
    await discardStored();
    setFields(nameSeed ? { ...DEFAULT_FIELDS, name: nameSeed } : DEFAULT_FIELDS);
    setDraftBanner('dismissed');
  }, [discardStored, nameSeed]);

  // ---- Duplicate-name detection (non-blocking warning, D5) -------------
  const duplicate = (() => {
    const typed = (fields.name ?? '').toString().trim().toLowerCase();
    if (!typed) return null;
    const other = allPlayers.find(p => {
      if (!p?.name) return false;
      if (mode === 'edit' && p.playerId === editingPlayerId) return false;
      return p.name.toLowerCase() === typed;
    });
    return other ? { playerId: other.playerId, name: other.name } : null;
  })();

  // ---- Save ------------------------------------------------------------
  const save = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      // Ensure any debounced autosave is written to the draft store before
      // commit, so commitDraft's delete call clears the right record.
      await flushDraft();

      // Derive final name (runs autoName fallback if typed is empty).
      const { name, nameSource } = deriveAutoName(fields, seatContext);

      if (mode === 'edit' && typeof editingPlayerId === 'number') {
        // Edit path: direct update, no draft lifecycle.
        const updates = { ...fields, name, nameSource, lastSeenAt: Date.now() };
        await updatePlayer(editingPlayerId, updates, userId);
        setIsSaving(false);
        if (onSaveComplete) onSaveComplete({ mode: 'edit', playerId: editingPlayerId });
        return editingPlayerId;
      }

      // Create path: atomic player-add + draft-delete.
      const record = {
        ...fields,
        name,
        nameSource,
      };
      const newId = await commitDraft(userId, record);
      setIsSaving(false);
      if (onSaveComplete) {
        onSaveComplete({ mode: 'create', playerId: newId, seatContext });
      }
      return newId;
    } catch (err) {
      setSaveError(err);
      setIsSaving(false);
      return null;
    }
  }, [mode, editingPlayerId, fields, seatContext, userId, flushDraft, onSaveComplete]);

  // ---- Back-to-Table flush --------------------------------------------
  const flushPendingDraft = useCallback(async () => {
    if (mode === 'create') await flushDraft();
  }, [mode, flushDraft]);

  return {
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
  };
};

// Exported for tests and downstream components that need to reset the form.
export { DEFAULT_FIELDS, normalizeFields };
