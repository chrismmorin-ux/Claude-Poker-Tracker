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
  // Legacy fields retained for read-back of pre-Phase-3 records (deleted in Phase 7)
  ethnicity: '',
  gender: '',
  hat: false,
  sunglasses: false,
  wardrobe: [],
  jewelry: [],
  logo: [],
  styleTags: [],
  notes: '',
  avatar: '',           // legacy image upload
  avatarFeatures: null, // PEO-1 feature sub-object (kills in Phase 7)
  // Phase 3 (PIO G4 v2) — canonical identification fields, all drive
  // IdentityAvatar via avatarMapping.
  sex: null,                  // 'male' | 'female' | 'other' | null
  ageDecade: null,            // '<20' | '20s' | '30s' | '40s' | '50s' | '60s+' | null
  ethnicityTags: [],          // multi-select; replaces legacy `ethnicity` string
  build: null,                // 'slim' | 'average' | 'heavy' | 'muscular' | null
  hairColor: null,            // 'black' | 'dark-brown' | 'brown' | 'light-brown' | 'blonde' | 'red' | 'gray' | 'white' | null
  hairLength: null,           // 'bald' | 'shaved' | 'short' | 'medium' | 'long' | null
  hairTexture: null,          // 'straight' | 'curly' | 'braided' | 'receding' | null
  hairSaltPepper: null,       // boolean | null  (null = auto via age)
  facialHair: null,           // 'clean' | 'stubble' | 'mustache' | 'goatee' | 'full' | 'soul-patch' | null
  eyewear: null,              // 'none' | 'clear' | 'sunglasses' | 'readers' | null
  eyewearColor: null,         // 'black' | 'brown' | 'tortoiseshell' | 'gold' | 'silver' | 'red' | 'blue' | null
  headwear: null,             // 'cap' | 'beanie' | 'visor' | 'fedora' | 'cowboy' | null  (per-sighting; moves to Sighting in Phase 6)
  distinguishingMarks: [],    // [{ type, location, description }]
  photoBlobId: null,          // PIO G5 child B (WS-161) — captured photo blob
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
  // Phase 4 (PIO G4 v2 §8.3): when arriving from the Picker's "+ Create new"
  // CTA, the picker passes the quick-filter values (sex/ethnicity/age) so
  // the user doesn't re-enter what they already selected.
  const fieldSeeds = editorContext?.fieldSeeds || null;

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

      // Compose initial create-mode state from DEFAULT_FIELDS + nameSeed +
      // fieldSeeds (Phase 4 — picker forwards quick-filter values).
      const buildInitial = () => {
        const base = { ...DEFAULT_FIELDS };
        if (nameSeed) base.name = nameSeed;
        if (fieldSeeds && typeof fieldSeeds === 'object') {
          for (const [key, value] of Object.entries(fieldSeeds)) {
            if (value === undefined) continue;
            if (key in DEFAULT_FIELDS) base[key] = value;
          }
        }
        return base;
      };

      if (draft?.draft && !hydratedRef.current.key) {
        // Existing draft found — show banner; hold form in seed-or-empty state
        // until user chooses.
        setFields(buildInitial());
        setDraftBanner('visible');
      } else {
        setFields(buildInitial());
        setDraftBanner(null);
      }
      hydratedRef.current.key = key;
    }
  }, [mode, editingPlayerId, allPlayers, draft, isDraftLoading, nameSeed, fieldSeeds, buildHydrationKey]);

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
  // In edit mode, suppress the warning if the typed name is unchanged from
  // the loaded record. Pre-existing duplicates with the same name are not
  // being created by this save — `updatePlayer` is an in-place update, not
  // a new insert. Warning only fires when the user is actively renaming to
  // a name that conflicts with another record.
  const duplicate = (() => {
    const typed = (fields.name ?? '').toString().trim().toLowerCase();
    if (!typed) return null;
    if (mode === 'edit' && typeof editingPlayerId === 'number') {
      const original = (allPlayers.find(p => p.playerId === editingPlayerId)?.name ?? '')
        .toString().trim().toLowerCase();
      if (typed === original) return null;
    }
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
