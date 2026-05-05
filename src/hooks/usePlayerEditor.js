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
 *     duplicate,               // null | { playerId, name } if name matches another
 *     isSaving,                // true while commit is in flight
 *     saveError,               // null | Error
 *     save,                    // async () => finalPlayerId | null
 *     flushPendingDraft,       // explicit flush for Back-to-Table
 *   }
 *
 * Phase 7: updateAvatarFeature removed. Avatar is fully derived from
 * identification fields via mapIdentityToAvatarFeatures — no manual
 * picker UI exists anymore.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayerDraft } from './usePlayerDraft';
import {
  commitDraft,
  updatePlayer,
  GUEST_USER_ID,
} from '../utils/persistence';
import { deriveAutoName } from '../utils/playerAutoName';
// Phase 5 (PIO G4 v2 §11): read-side migration of legacy fields → new
// identification fields. Applied during hydration so the editor sees
// derived values; saving the player back persists the migration.
import { migratePlayerLegacyFields } from '../utils/identityAvatar/migratePlayerLegacyFields';

// Phase 7 cleanup: dropped legacy fields from DEFAULT_FIELDS:
//   ethnicity (string), gender, hat (bool), sunglasses (bool), avatar
//   (legacy image upload), avatarFeatures (PEO-1 manual SVG picker).
// Migration shim (`migratePlayerLegacyFields`) still derives these on read
// for pre-Phase-3 records. Fields kept in DEFAULT_FIELDS:
//   - wardrobe / jewelry / logo arrays — still rendered as filter axes in
//     PlayerFilters.jsx (PlayersView's filter row). Slated for removal in
//     WS-166 (the visual-redesign backlog). Phase 6 captures them into the
//     sighting record so they're preserved per-session.
//   - styleTags — drives ExploitBadges, unrelated to identity model.
//   - notes — free-text, retained.
const DEFAULT_FIELDS = {
  name: '',
  nickname: '',
  styleTags: [],
  notes: '',
  // Per-sighting / legacy-filter fields (kept until WS-166 PlayersView refactor)
  wardrobe: [],
  jewelry: [],
  logo: [],
  // Phase C accessory inventory: persistent per-player list of accessories
  // accumulated across sightings. See feedback_accessory_inventory_model.md.
  accessoryInventory: [],
  // Phase 3 canonical identification fields — drive IdentityAvatar
  sex: null,                  // 'male' | 'female' | 'other' | null
  ageDecade: null,            // '<20' | '20s' | '30s' | '40s' | '50s' | '60s+' | null
  ethnicityTags: [],          // multi-select
  build: null,                // 'slim' | 'average' | 'heavy' | 'muscular' | null
  // Distinguishing-feature colors — independent of ethnicity per
  // feedback_color_independent_of_ethnicity.md. When null, IdentityAvatar
  // falls back to ethnicity-derived (skin) or hair-color-derived (beard).
  skinTone: null,             // 'very-light' | 'light' | 'ruddy' | 'medium' | 'tan' | 'brown' | 'dark' | null
  hairColor: null,            // 'black' | 'dark-brown' | 'brown' | 'light-brown' | 'blonde' | 'red' | 'gray' | 'white' | null
  hairLength: null,           // 'bald' | 'shaved' | 'short' | 'medium' | 'long' | null
  hairTexture: null,          // 'straight' | 'curly' | 'braided' | 'receding' | null
  hairSaltPepper: null,       // boolean | null  (null = auto via age)
  facialHair: null,           // 'clean' | 'stubble' | 'mustache' | 'goatee' | 'full' | 'soul-patch' | null
  beardColor: null,           // same palette as hairColor; null = inherit from hairColor
  eyewear: null,              // 'none' | 'clear' | 'sunglasses' | 'readers' | null
  eyewearColor: null,         // 'black' | 'brown' | 'tortoiseshell' | 'gold' | 'silver' | 'red' | 'blue' | null
  headwear: null,             // 'cap' | 'beanie' | 'visor' | 'fedora' | 'cowboy' | null
  distinguishingMarks: [],    // [{ type, location, description }]
  photoBlobId: null,          // captured photo blob (PIO G5 child B / WS-161)
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
        // Phase 5: derive Phase-3 fields from legacy fields before hydrating
        // the form. The migration is non-destructive — only fills unset
        // fields. Saving the player will persist the derived values.
        const migrated = migratePlayerLegacyFields(existing);
        setFields(normalizeFields(migrated));
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
    duplicate,
    isSaving,
    saveError,
    save,
    flushPendingDraft,
  };
};

// Exported for tests and downstream components that need to reset the form.
export { DEFAULT_FIELDS, normalizeFields };
