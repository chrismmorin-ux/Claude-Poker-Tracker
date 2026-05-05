/**
 * usePlayerPicker.js — Player-picker orchestration (PEO-3)
 *
 * Owns:
 *   - live query state (nameQuery + featureFilters sub-object)
 *   - filtered-and-scored results list, sorted last-seen desc within match set
 *   - batch-mode state machine (D9)
 *
 * Does NOT own:
 *   - seat assignment (PlayerContext.assignPlayerToSeat)
 *   - retroactive linking (PlayerContext.linkPlayerToPriorHandsInSession)
 *   - undo toasts (ToastContext)
 *   Those belong to PlayerPickerView's submit handler — this hook stays pure
 *   over [query, allPlayers] so it's trivially testable.
 *
 * Batch mode (plan §D9):
 *   ends on: explicit exitBatchMode() call, all 9 seats assigned, or consumer
 *   navigating away from the picker (consumer must call exitBatchMode() then).
 *   Does NOT persist across app reload — batch state is hook-local only.
 */

import { useCallback, useMemo, useState } from 'react';
import { scorePlayerMatch } from './usePlayerFiltering';
// Apply legacy gender→sex / ethnicity→ethnicityTags derivation before
// matching, so unmigrated player records still respond to the chip filters.
import { migratePlayerLegacyFields } from '../utils/identityAvatar/migratePlayerLegacyFields';
import { findMatchingAccessories } from '../utils/accessoryInventory';

const EMPTY_FEATURE_FILTERS = {};
const NUM_SEATS = 9;

const EMPTY_BATCH_MODE = { active: false, assignedSeats: [] };

// Phase 4 (PIO G4 v2 §8.3) — extended 2026-05-05 to full editor parity per
// `feedback_picker_editor_field_parity.md`. Every editor identification
// axis has a corresponding picker filter slot. Scalar slots are null when
// unset; arrays are []. Matching is permissive: a player with NULL on the
// filtered axis still passes (uncertain ≠ negative match).
const EMPTY_QUICK_FILTER = {
  // Always-visible axes
  sex: null,
  ethnicity: [],
  ageDecade: null,
  // "More filters" axes (mirrors editor sections)
  skinTone: null,
  hairColor: null,
  hairLength: null,
  hairTexture: null,
  facialHair: null,
  beardColor: null,
  build: null,
  eyewear: null,
  eyewearColor: null,
  headwear: null,
  // Accessory filter — POSITIVE BOOST ONLY, never excludes a player.
  // See feedback_accessory_inventory_model.md. Filter shape:
  // { kind, color }. Setting either narrows the boost; both null = inactive.
  accessoryKind: null,
  accessoryColor: null,
};

// Map quickFilter scalar key → player record field name. Most match 1:1;
// only ethnicity is renamed (filter says `ethnicity`, record says
// `ethnicityTags`). The scalar-key list is what matchesQuickFilter walks.
const SCALAR_FILTER_TO_PLAYER_FIELD = {
  sex: 'sex',
  ageDecade: 'ageDecade',
  skinTone: 'skinTone',
  hairColor: 'hairColor',
  hairLength: 'hairLength',
  hairTexture: 'hairTexture',
  facialHair: 'facialHair',
  beardColor: 'beardColor',
  build: 'build',
  eyewear: 'eyewear',
  eyewearColor: 'eyewearColor',
  headwear: 'headwear',
  // Accessory filter axes are NOT scalar identification fields — they're
  // handled separately by accessory-inventory matching. Listed here so
  // they're explicitly excluded from the scalar walk.
};

export const usePlayerPicker = ({ allPlayers = [], initialSeat = null, initialBatchMode = EMPTY_BATCH_MODE } = {}) => {
  const [nameQuery, setNameQuery] = useState('');
  const [featureFilters, setFeatureFilters] = useState(EMPTY_FEATURE_FILTERS);
  const [quickFilter, setQuickFilter] = useState(EMPTY_QUICK_FILTER);
  const [currentSeat, setCurrentSeat] = useState(initialSeat);
  const [batchMode, setBatchMode] = useState(initialBatchMode);

  // ---- filter controls --------------------------------------------------
  const setFeatureFilter = useCallback((category, value) => {
    setFeatureFilters(prev => {
      if (value === null || value === undefined || value === '') {
        // Clear this category
        const { [category]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [category]: value };
    });
  }, []);

  const clearAllFeatureFilters = useCallback(() => {
    setFeatureFilters(EMPTY_FEATURE_FILTERS);
  }, []);

  const clearAll = useCallback(() => {
    setNameQuery('');
    setFeatureFilters(EMPTY_FEATURE_FILTERS);
    setQuickFilter(EMPTY_QUICK_FILTER);
  }, []);

  // ---- Phase 4 quick-filter (identification axes) ----------------------
  // Single setter for any scalar field; arg=null clears.
  const KNOWN_SCALAR_KEYS = new Set([
    ...Object.keys(SCALAR_FILTER_TO_PLAYER_FIELD),
    'accessoryKind',
    'accessoryColor',
  ]);
  const setQuickFilterField = useCallback((key, value) => {
    if (!KNOWN_SCALAR_KEYS.has(key)) {
      return; // ignore unknown keys (defensive — ethnicity has its own setter)
    }
    setQuickFilter((prev) => ({ ...prev, [key]: value }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const toggleQuickFilterEthnicity = useCallback((tag) => {
    setQuickFilter((prev) => {
      const next = prev.ethnicity.includes(tag)
        ? prev.ethnicity.filter((t) => t !== tag)
        : [...prev.ethnicity, tag];
      return { ...prev, ethnicity: next };
    });
  }, []);
  const clearQuickFilter = useCallback(() => {
    setQuickFilter(EMPTY_QUICK_FILTER);
  }, []);

  // Backward-compat shims: the prior API exposed dedicated setters. These
  // keep ad-hoc callers working while new code uses setQuickFilterField.
  const setQuickFilterSex = useCallback((sex) => setQuickFilterField('sex', sex), [setQuickFilterField]);
  const setQuickFilterAge = useCallback((ageDecade) => setQuickFilterField('ageDecade', ageDecade), [setQuickFilterField]);

  // ---- filtered + scored results ---------------------------------------
  const query = useMemo(
    () => ({ nameQuery, featureFilters }),
    [nameQuery, featureFilters],
  );

  // Phase 4 quick-filter, extended to full editor parity 2026-05-05.
  // AND across all set axes; permissive on player NULLs (uncertain ≠
  // negative match) — see feedback_color_independent_of_ethnicity.md.
  // Legacy records (gender, single ethnicity string) are read-side
  // migrated so they respond without needing a re-save.
  const matchesQuickFilter = useCallback((rawPlayer) => {
    const player = migratePlayerLegacyFields(rawPlayer);

    // Walk all scalar filter axes — null filter or null player attr passes.
    for (const filterKey of Object.keys(SCALAR_FILTER_TO_PLAYER_FIELD)) {
      const filterValue = quickFilter[filterKey];
      if (!filterValue) continue;
      const playerField = SCALAR_FILTER_TO_PLAYER_FIELD[filterKey];
      const playerValue = (player[playerField] || '').toString().toLowerCase();
      if (!playerValue) continue; // permissive: unset player attr passes
      if (playerValue !== filterValue.toString().toLowerCase()) return false;
    }

    // Ethnicity (array filter, OR within tags, permissive on empty player tags).
    if (quickFilter.ethnicity.length > 0) {
      const playerTags = Array.isArray(player.ethnicityTags) ? player.ethnicityTags : [];
      if (playerTags.length > 0) {
        const hasMatch = quickFilter.ethnicity.some((sel) =>
          playerTags.map((t) => (t || '').toLowerCase()).includes(sel),
        );
        if (!hasMatch) return false;
      }
      // playerTags empty → permissive, fall through.
    }

    return true;
  }, [quickFilter]);

  const results = useMemo(() => {
    const accessoryFilterActive = !!quickFilter.accessoryKind || !!quickFilter.accessoryColor;
    const accessoryFilter = accessoryFilterActive
      ? { kind: quickFilter.accessoryKind, color: quickFilter.accessoryColor }
      : null;

    const scored = [];
    for (const player of allPlayers) {
      if (!matchesQuickFilter(player)) continue;
      const score = scorePlayerMatch(player, query);
      if (!score.passesFilters) continue;
      // Accessory match attached for display — positive boost only, never excludes.
      const matchedAccessories = accessoryFilter
        ? findMatchingAccessories(player.accessoryInventory, accessoryFilter)
        : [];
      scored.push({ player, score, matchedAccessories });
    }
    // Sort: when accessory filter is active, accessory-matchers float to top.
    // Then last-seen desc; tie-break on name asc.
    scored.sort((a, b) => {
      if (accessoryFilterActive) {
        const ah = a.matchedAccessories.length > 0 ? 1 : 0;
        const bh = b.matchedAccessories.length > 0 ? 1 : 0;
        if (ah !== bh) return bh - ah;
      }
      const la = a.player.lastSeenAt || 0;
      const lb = b.player.lastSeenAt || 0;
      if (lb !== la) return lb - la;
      const na = (a.player.name || '').toLowerCase();
      const nb = (b.player.name || '').toLowerCase();
      return na.localeCompare(nb);
    });
    return scored;
  }, [allPlayers, query, matchesQuickFilter, quickFilter.accessoryKind, quickFilter.accessoryColor]);

  const hasActiveFilters = nameQuery.length > 0
    || Object.keys(featureFilters).length > 0
    || quickFilter.ethnicity.length > 0
    || Object.keys(SCALAR_FILTER_TO_PLAYER_FIELD).some((k) => !!quickFilter[k])
    || !!quickFilter.accessoryKind
    || !!quickFilter.accessoryColor;

  // ---- batch mode -------------------------------------------------------
  const enterBatchMode = useCallback(() => {
    setBatchMode(prev => ({ active: true, assignedSeats: prev.assignedSeats || [] }));
  }, []);

  const exitBatchMode = useCallback(() => {
    setBatchMode(EMPTY_BATCH_MODE);
  }, []);

  const markSeatAssigned = useCallback((seat) => {
    if (typeof seat !== 'number') return;
    setBatchMode(prev => {
      if (!prev.active) return prev;
      if (prev.assignedSeats.includes(seat)) return prev;
      const nextAssigned = [...prev.assignedSeats, seat].sort((a, b) => a - b);
      // End condition: all 9 seats assigned → leave batch mode.
      if (nextAssigned.length >= NUM_SEATS) {
        return EMPTY_BATCH_MODE;
      }
      return { ...prev, assignedSeats: nextAssigned };
    });
  }, []);

  /**
   * Next seat to advance to after an assignment in batch mode.
   * Returns the lowest-numbered unassigned seat, skipping the `justAssigned`
   * seat. Returns null if all seats are assigned.
   */
  const nextUnassignedSeat = useCallback((justAssigned) => {
    if (!batchMode.active) return null;
    const assigned = new Set(batchMode.assignedSeats);
    if (typeof justAssigned === 'number') assigned.add(justAssigned);
    for (let seat = 1; seat <= NUM_SEATS; seat += 1) {
      if (!assigned.has(seat)) return seat;
    }
    return null;
  }, [batchMode]);

  /**
   * Called after a successful assignment. Updates batch state, returns
   * `{ nextSeat }` where nextSeat is where the caller should route the picker.
   * Caller is responsible for dispatching setCurrentSeat(nextSeat) or closing
   * the picker if nextSeat === null.
   */
  const onAssignmentComplete = useCallback((assignedSeat) => {
    markSeatAssigned(assignedSeat);
    if (!batchMode.active) {
      return { nextSeat: null, batchDone: true };
    }
    const next = nextUnassignedSeat(assignedSeat);
    if (next === null) {
      return { nextSeat: null, batchDone: true };
    }
    // Clear query for the next seat so the user starts fresh.
    setNameQuery('');
    setFeatureFilters(EMPTY_FEATURE_FILTERS);
    setQuickFilter(EMPTY_QUICK_FILTER);
    setCurrentSeat(next);
    return { nextSeat: next, batchDone: false };
  }, [batchMode.active, markSeatAssigned, nextUnassignedSeat]);

  return {
    // Query
    nameQuery,
    setNameQuery,
    featureFilters,
    setFeatureFilter,
    clearAllFeatureFilters,
    // Phase 4 quick-filter (identification axes — full editor parity)
    quickFilter,
    setQuickFilterField,         // (key, value) — primary scalar setter
    setQuickFilterSex,           // backward-compat shim
    setQuickFilterAge,           // backward-compat shim
    toggleQuickFilterEthnicity,
    clearQuickFilter,
    clearAll,
    hasActiveFilters,

    // Results
    results,

    // Seat context
    currentSeat,
    setCurrentSeat,

    // Batch mode
    batchMode,
    enterBatchMode,
    exitBatchMode,
    markSeatAssigned,
    nextUnassignedSeat,
    onAssignmentComplete,
  };
};
