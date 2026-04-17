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

const EMPTY_FEATURE_FILTERS = {};
const NUM_SEATS = 9;

const EMPTY_BATCH_MODE = { active: false, assignedSeats: [] };

export const usePlayerPicker = ({ allPlayers = [], initialSeat = null, initialBatchMode = EMPTY_BATCH_MODE } = {}) => {
  const [nameQuery, setNameQuery] = useState('');
  const [featureFilters, setFeatureFilters] = useState(EMPTY_FEATURE_FILTERS);
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
  }, []);

  // ---- filtered + scored results ---------------------------------------
  const query = useMemo(
    () => ({ nameQuery, featureFilters }),
    [nameQuery, featureFilters],
  );

  const results = useMemo(() => {
    const scored = [];
    for (const player of allPlayers) {
      const score = scorePlayerMatch(player, query);
      if (score.passesFilters) {
        scored.push({ player, score });
      }
    }
    // Sort: last-seen desc; tie-break on name asc for stability.
    scored.sort((a, b) => {
      const la = a.player.lastSeenAt || 0;
      const lb = b.player.lastSeenAt || 0;
      if (lb !== la) return lb - la;
      const na = (a.player.name || '').toLowerCase();
      const nb = (b.player.name || '').toLowerCase();
      return na.localeCompare(nb);
    });
    return scored;
  }, [allPlayers, query]);

  const hasActiveFilters = nameQuery.length > 0 || Object.keys(featureFilters).length > 0;

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
