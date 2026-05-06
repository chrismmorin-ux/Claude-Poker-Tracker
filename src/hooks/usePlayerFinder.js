/**
 * @file usePlayerFinder.js — unified state machine for the PlayerFinder.
 *
 * Replaces `usePlayerEditor` + `usePlayerPicker`. The PlayerFinder is one
 * surface; this hook is its one state machine. Pure over inputs — no IDB
 * calls. Persistence happens in the view layer.
 *
 * What this hook owns:
 *   - filters (scalar identification axes + ethnicity scalar +
 *     ethnicityNote + accessory composite)
 *   - nameQuery
 *   - activeTab (which Features tab is open)
 *   - activeRecord (currently-loaded existing player, null if composing)
 *   - decisions (per-axis "filter" / "player" / "add" / "skip" picks
 *     when the loaded record's existing values differ from filter values)
 *   - capturedPreviewUrl / cameraOpen (camera modal lifecycle)
 *
 * What this hook computes:
 *   - results — filtered + sorted player list
 *   - hasActiveFilters
 *   - tabBadges — per-tab active-filter counts
 *   - totalActiveCount
 *   - congruencyItems — diff between filters and activeRecord
 *   - livePlayer — synthetic player for the live builder avatar
 *
 * What this hook does NOT do (view layer's job):
 *   - IDB writes (commitDraft / updatePlayer / appendSighting / savePhoto)
 *   - seat assignment (PlayerContext.assignPlayerToSeat)
 *   - retroactive linking
 *   - toasts / route navigation
 *
 * @see .claude/plans/floating-questing-conway.md (Phase B — extraction)
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import { skinKeyForFilter } from '../utils/identityAvatar/avatarMapping';
import {
  matchesInRange,
  RANGE_NEIGHBORS_BY_AXIS,
} from '../utils/playerFilterRange';
import { findMatchingAccessories } from '../utils/accessoryInventory';
import { migratePlayerLegacyFields } from '../utils/identityAvatar/migratePlayerLegacyFields';

// ===========================================================================
// CONSTANTS — exported so the view + tests can share them
// ===========================================================================

// Scalar axes — single-value identification fields. Walked by the filter
// match loop and the congruency diff. Ethnicity is here as a SINGLE-select
// scalar (was an array; UI is single-select per owner 2026-05-06; the
// underlying record still stores it as `ethnicityTags: string[]` of
// length 0 or 1, decoupling UI shape from persistence shape).
export const SCALAR_KEYS = [
  'sex', 'ageDecade', 'ethnicity', 'skinTone', 'hairColor', 'hairLength',
  'hairTexture', 'hairTreatment', 'facialHair', 'beardColor',
  'beardTreatment', 'build', 'height',
];

// Empty filter shape — the canonical "no filters set" record.
export const EMPTY_FILTERS = {
  sex: null,
  ageDecade: null,
  ethnicity: null,
  ethnicityNote: '',
  build: null,
  height: null,
  skinTone: null,
  hairColor: null,
  hairLength: null,
  hairTexture: null,
  hairTreatment: null,
  facialHair: null,
  beardColor: null,
  beardTreatment: null,
  accessory: { kind: null, subtype: null, color: null, note: '' },
};

// Field-label map for diff/decision UI. View extends this with its own
// localized strings if needed.
export const FIELD_LABEL = {
  sex: 'Sex',
  ageDecade: 'Age',
  ethnicity: 'Ethnicity',
  ethnicityNote: 'Heritage',
  skinTone: 'Skin tone',
  hairColor: 'Hair color',
  hairLength: 'Hair length',
  hairTexture: 'Hair texture',
  hairTreatment: 'Hair treatment',
  facialHair: 'Facial hair',
  beardColor: 'Beard color',
  beardTreatment: 'Beard treatment',
  build: 'Build',
  height: 'Height',
  accessory: 'Accessory',
};

// ===========================================================================
// PURE HELPERS (exported for view + tests)
// ===========================================================================

// Project a player record into the canonical effective-attribute shape the
// filter and congruency layers walk. Pulls migrated values where available;
// derives skinTone via skinKeyForFilter; falls back beardColor → hairColor;
// reads height from the player record (Phase A migration adds height as a
// canonical field). Reads `hairSaltPepper` / `beardSaltPepper` legacy
// booleans for the salt-pepper treatment.
export const playerEffective = (rawPlayer) => {
  // Apply legacy-field migration so unmigrated records still respond to
  // chip filters. Does not mutate the original.
  const player = migratePlayerLegacyFields(rawPlayer);
  return {
    sex: player.sex,
    ageDecade: player.ageDecade,
    // Ethnicity exposed as single scalar — first tag from the array shape
    // stored on the record. Stored as array; consumed as scalar by the
    // filter UI per owner 2026-05-06.
    ethnicity: Array.isArray(player.ethnicityTags) && player.ethnicityTags.length > 0
      ? player.ethnicityTags[0]
      : null,
    ethnicityNote: player.ethnicityNote || '',
    skinTone: skinKeyForFilter(player),
    hairColor: player.hairColor,
    hairLength: player.hairLength,
    hairTexture: player.hairTexture,
    hairTreatment: player.hairSaltPepper === true ? 'salt-pepper' : (player.hairTreatment || null),
    facialHair: player.facialHair,
    beardColor: player.beardColor || player.hairColor || null,
    beardTreatment: player.beardSaltPepper === true ? 'salt-pepper' : (player.beardTreatment || null),
    build: player.build,
    height: player.height || null,
  };
};

// Match a single scalar axis: filter null = match anything; player null =
// permissive (uncertain ≠ negative match); range axes use neighbor sets;
// strict axes use lowercase string equality.
export const matchesScalar = (axis, filterValue, playerValue) => {
  if (!filterValue) return true;
  if (!playerValue) return true;
  if (RANGE_NEIGHBORS_BY_AXIS[axis]) {
    return matchesInRange(axis, filterValue, playerValue);
  }
  return playerValue.toString().toLowerCase() === filterValue.toString().toLowerCase();
};

// Filter logic — pure over (filters, nameQuery, player). Returns true if
// the player satisfies the filter set.
export const matchesFilters = (filters, nameQuery, rawPlayer) => {
  const eff = playerEffective(rawPlayer);
  for (const axis of SCALAR_KEYS) {
    const fv = filters[axis];
    if (!fv) continue;
    if (!matchesScalar(axis, fv, eff[axis])) return false;
  }
  if (nameQuery && nameQuery.trim().length > 0) {
    const q = nameQuery.toLowerCase().trim();
    const haystack = `${rawPlayer.name || ''} ${rawPlayer.nickname || ''}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
};

// Congruency diff: per-axis difference between filters and player. Returns
// an array of items: { axis, kind: 'mismatch' | 'addition', filterValue,
// playerValue }. Only populated for axes with a set filter value.
export const computeCongruency = (filters, rawPlayer) => {
  const eff = playerEffective(rawPlayer);
  const items = [];
  for (const axis of SCALAR_KEYS) {
    const fv = filters[axis];
    if (!fv) continue;
    const pv = eff[axis];
    if (!pv) {
      items.push({ axis, kind: 'addition', filterValue: fv, playerValue: null });
      continue;
    }
    if (fv.toString().toLowerCase() !== pv.toString().toLowerCase()) {
      items.push({ axis, kind: 'mismatch', filterValue: fv, playerValue: pv });
    }
  }
  // ethnicityNote — free-form. Surfaces as a diff so owner can choose:
  // keep player's existing note, OR overwrite, OR add when player has none.
  const noteFilter = (filters.ethnicityNote || '').trim();
  const notePlayer = (eff.ethnicityNote || '').trim();
  if (noteFilter && noteFilter.toLowerCase() !== notePlayer.toLowerCase()) {
    if (!notePlayer) {
      items.push({ axis: 'ethnicityNote', kind: 'addition', filterValue: noteFilter, playerValue: null });
    } else {
      items.push({ axis: 'ethnicityNote', kind: 'mismatch', filterValue: noteFilter, playerValue: notePlayer });
    }
  }
  // Accessory — append-only. Filter has fields → if no inventory item
  // matches the kind+subtype+color+note shape, surface as +NEW.
  const acc = filters.accessory;
  const accFilterActive = !!(acc.kind || acc.subtype || acc.color || (acc.note && acc.note.trim()));
  if (accFilterActive) {
    const inv = Array.isArray(rawPlayer.accessoryInventory) ? rawPlayer.accessoryInventory : [];
    const matchKind = acc.kind ? (e) => e.kind === acc.kind : () => true;
    const matchSub = acc.subtype ? (e) => e.subtype === acc.subtype : () => true;
    const matchColor = acc.color ? (e) => e.color === acc.color : () => true;
    const matchNote = (acc.note && acc.note.trim())
      ? (e) => (e.note || '').toLowerCase().includes(acc.note.toLowerCase().trim())
      : () => true;
    const found = inv.find((e) => matchKind(e) && matchSub(e) && matchColor(e) && matchNote(e));
    if (!found) {
      items.push({ axis: 'accessory', kind: 'addition', filterValue: acc, playerValue: null });
    }
  }
  return items;
};

// Format a value for the decision pill labels.
export const formatValue = (axis, value) => {
  if (Array.isArray(value)) return value.join(', ');
  if (axis === 'accessory' && typeof value === 'object' && value) {
    const parts = [];
    if (value.color) parts.push(value.color);
    if (value.subtype) parts.push(value.subtype);
    if (value.kind) parts.unshift(value.kind);
    const head = parts.join(' ');
    return head + (value.note ? ` (${value.note})` : '');
  }
  return String(value || '—');
};

// Tab grouping — used by tabBadges + the view's tab strip.
export const TABS = [
  { id: 'skin',      label: 'Skin' },
  { id: 'hair',      label: 'Hair' },
  { id: 'beard',     label: 'Beard' },
  { id: 'accessory', label: 'Accessory' },
];

const HAIR_KEYS = ['hairColor', 'hairLength', 'hairTexture', 'hairTreatment'];
const BEARD_KEYS = ['facialHair', 'beardColor', 'beardTreatment'];

const countActiveInGroup = (filters, keys) =>
  keys.filter((k) => !!filters[k]).length;

const accessoryFilterCount = (filters) =>
  (filters.accessory.kind ? 1 : 0)
  + (filters.accessory.subtype ? 1 : 0)
  + (filters.accessory.color ? 1 : 0)
  + ((filters.accessory.note || '').trim() ? 1 : 0);

// ===========================================================================
// HOOK
// ===========================================================================

/**
 * usePlayerFinder({ allPlayers, initialFilters, initialActiveTab })
 *
 * @param {Object[]} allPlayers — current Player records (raw, unmigrated).
 * @param {Object}   [initialFilters] — pre-seed filter values (used in
 *                   edit mode to show the loaded record's identification
 *                   axes + when the picker forwards quick-filter values
 *                   into create mode).
 * @param {Object}   [initialActiveRecord] — pre-loaded record (edit mode).
 * @param {string}   [initialActiveTab='skin']
 */
export const usePlayerFinder = ({
  allPlayers = [],
  initialFilters = null,
  initialActiveRecord = null,
  initialActiveTab = 'skin',
} = {}) => {
  const [filters, setFilters] = useState(() => ({
    ...EMPTY_FILTERS,
    ...(initialFilters || {}),
    accessory: { ...EMPTY_FILTERS.accessory, ...(initialFilters?.accessory || {}) },
  }));
  const [nameQuery, setNameQuery] = useState('');
  const [activeTab, setActiveTab] = useState(initialActiveTab);
  const [activeRecord, setActiveRecord] = useState(initialActiveRecord);
  const [decisions, setDecisions] = useState({});
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState(null);

  // Re-hydrate when initialActiveRecord changes (edit-mode reopens).
  useEffect(() => {
    if (initialActiveRecord && initialActiveRecord !== activeRecord) {
      setActiveRecord(initialActiveRecord);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialActiveRecord]);

  // ---- Filter setters ----------------------------------------------------

  // Toggle-on-tap for scalar fields. Setting the same value clears it.
  const setScalar = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? null : value }));
  }, []);

  // Single-select ethnicity. Tap active to clear; tap different to switch.
  const setEthnicity = useCallback((tag) => {
    setFilters((prev) => ({ ...prev, ethnicity: prev.ethnicity === tag ? null : tag }));
  }, []);

  const setEthnicityNote = useCallback((note) => {
    setFilters((prev) => ({ ...prev, ethnicityNote: note }));
  }, []);

  // Patch the accessory composite. Caller passes a partial of the accessory
  // sub-shape; the hook spreads it into the existing accessory record.
  const setAccessory = useCallback((patch) => {
    setFilters((prev) => ({ ...prev, accessory: { ...prev.accessory, ...patch } }));
  }, []);

  const clearAll = useCallback(() => {
    setFilters({ ...EMPTY_FILTERS, accessory: { ...EMPTY_FILTERS.accessory } });
    setNameQuery('');
  }, []);

  // ---- Result computation -----------------------------------------------

  const accFilterActive = !!(filters.accessory.kind || filters.accessory.color);

  const results = useMemo(() => {
    const out = [];
    for (const p of allPlayers) {
      if (!matchesFilters(filters, nameQuery, p)) continue;
      const matched = accFilterActive
        ? findMatchingAccessories(p.accessoryInventory, {
            kind: filters.accessory.kind,
            color: filters.accessory.color,
          })
        : [];
      out.push({ player: p, matchedAccessories: matched });
    }
    out.sort((a, b) => {
      if (accFilterActive) {
        const ah = a.matchedAccessories.length > 0 ? 1 : 0;
        const bh = b.matchedAccessories.length > 0 ? 1 : 0;
        if (ah !== bh) return bh - ah;
      }
      return (b.player.lastSeenAt || 0) - (a.player.lastSeenAt || 0);
    });
    return out;
  }, [allPlayers, filters, nameQuery, accFilterActive]);

  const hasActiveFilters = useMemo(() => Boolean(
    nameQuery
    || SCALAR_KEYS.some((k) => !!filters[k])
    || (filters.ethnicityNote && filters.ethnicityNote.trim())
    || accFilterActive
    || (filters.accessory.note && filters.accessory.note.trim()),
  ), [filters, nameQuery, accFilterActive]);

  const tabBadges = useMemo(() => ({
    skin: filters.skinTone ? 1 : 0,
    hair: countActiveInGroup(filters, HAIR_KEYS),
    beard: countActiveInGroup(filters, BEARD_KEYS),
    accessory: accessoryFilterCount(filters),
  }), [filters]);

  const totalActiveCount = useMemo(() => (
    SCALAR_KEYS.filter((k) => !!filters[k]).length
    + (filters.ethnicityNote && filters.ethnicityNote.trim() ? 1 : 0)
    + accessoryFilterCount(filters)
  ), [filters]);

  // ---- Loaded record + decisions ----------------------------------------

  const loadRecord = useCallback((player) => {
    setActiveRecord(player);
    const items = computeCongruency(filters, player);
    const initial = {};
    for (const item of items) {
      const key = `${item.axis}-${item.kind}`;
      // Default: mismatches keep the player's existing value; additions
      // get added. Reasonable conservative default — users can override.
      initial[key] = item.kind === 'mismatch' ? 'player' : 'add';
    }
    setDecisions(initial);
  }, [filters]);

  const cancelLoaded = useCallback(() => {
    setActiveRecord(null);
    setDecisions({});
  }, []);

  const decideAxis = useCallback((key, side) => {
    setDecisions((prev) => ({ ...prev, [key]: side }));
  }, []);

  const congruencyItems = useMemo(() => (
    activeRecord ? computeCongruency(filters, activeRecord) : []
  ), [activeRecord, filters]);

  // ---- Live builder avatar ---------------------------------------------

  // Synthetic player from filter values, used when composing a new record.
  // When a record is loaded, return that record so the avatar reflects it.
  const livePlayer = useMemo(() => {
    if (activeRecord) return activeRecord;
    return {
      playerId: 'live-builder',
      sex: filters.sex,
      ageDecade: filters.ageDecade,
      ethnicityTags: filters.ethnicity ? [filters.ethnicity] : [],
      ethnicityNote: filters.ethnicityNote,
      skinTone: filters.skinTone,
      hairColor: filters.hairColor,
      hairLength: filters.hairLength,
      hairTexture: filters.hairTexture,
      hairSaltPepper: filters.hairTreatment === 'salt-pepper',
      facialHair: filters.facialHair,
      beardColor: filters.beardColor,
      beardSaltPepper: filters.beardTreatment === 'salt-pepper',
      build: filters.build,
      height: filters.height,
      // Hat / glasses route through the accessory filter for the live preview.
      // hatColor recolors the avatar via --hat / --hat-trim CSS vars
      // (AvatarRenderer.buildColorVars resolves the key via getClothingColor).
      headwear: filters.accessory.kind === 'hat' ? filters.accessory.subtype : null,
      hatColor: filters.accessory.kind === 'hat' ? filters.accessory.color : null,
      eyewear: filters.accessory.kind === 'glasses' ? filters.accessory.subtype : null,
    };
  }, [filters, activeRecord]);

  // ---- Camera ------------------------------------------------------------

  const openCamera = useCallback(() => setCameraOpen(true), []);
  const closeCamera = useCallback(() => setCameraOpen(false), []);

  return {
    // State
    filters,
    setFilters,
    nameQuery,
    setNameQuery,
    activeTab,
    setActiveTab,
    activeRecord,
    decisions,

    // Filter setters
    setScalar,
    setEthnicity,
    setEthnicityNote,
    setAccessory,
    clearAll,

    // Loaded record + decisions
    loadRecord,
    cancelLoaded,
    decideAxis,

    // Computed
    results,
    hasActiveFilters,
    tabBadges,
    totalActiveCount,
    congruencyItems,
    livePlayer,
    accFilterActive,

    // Camera
    cameraOpen,
    openCamera,
    closeCamera,
    capturedPreviewUrl,
    setCapturedPreviewUrl,
  };
};
