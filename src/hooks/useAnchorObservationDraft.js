/**
 * useAnchorObservationDraft.js — Per-hand capture-draft sidecar
 *
 * Manages the in-memory draft state for the AnchorObservationModal: reads any
 * existing draft for the current hand from the AnchorLibrary state, exposes a
 * 400ms-debounced `updateDraft` that dispatches `DRAFT_UPDATED`, and an
 * immediate `clearDraft` that dispatches `DRAFT_CLEARED`. The persistence hook
 * (`useAnchorLibraryPersistence`) handles the actual IDB write on its 400ms
 * debounce; this hook's debounce throttles **dispatch frequency** so a fast
 * typer doesn't spam the reducer with a rerender per keystroke.
 *
 * EAL Phase 6 Stream D B3 — Session 15 (2026-04-27).
 *
 * Design choices:
 *   - **Per-hand keying** is enforced by id `draft:${handId}` (reducer auto-attaches).
 *     The hook accepts only `partial` updates and merges with the existing draft.
 *   - **Local pending state** is held in a ref so mid-debounce updates merge
 *     correctly (a callback receiving the previous draft from state would race
 *     against the debounced dispatch).
 *   - **clearDraft is non-debounced** — when the user discards or saves, the
 *     dispatch must propagate immediately so the persistence hook deletes the
 *     draft on its next debounce cycle without racing a still-pending update.
 *   - **handId change invalidates pending updates** — switching hands aborts
 *     the in-flight debounce and resets local state.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAnchorLibrary } from '../contexts/AnchorLibraryContext';
import { ANCHOR_LIBRARY_ACTIONS } from '../constants/anchorLibraryConstants';

const UPDATE_DEBOUNCE_MS = 400;

/**
 * @typedef {Object} ObservationDraft
 * @property {string} id                 — `draft:${handId}` (auto-attached by reducer)
 * @property {string} handId
 * @property {string[]} [ownerTags]
 * @property {string} [note]
 * @property {string} [streetKey]
 * @property {number} [actionIndex]
 * @property {boolean} [contributesToCalibration]
 */

/**
 * @typedef {Object} UseAnchorObservationDraftReturn
 * @property {ObservationDraft|null} draft  — current persisted draft (from state)
 * @property {boolean} hasDraft             — true if a draft exists in state for this hand
 * @property {(partial: Partial<ObservationDraft>) => void} updateDraft
 *           — merges partial into pending state + dispatches DRAFT_UPDATED on 400ms debounce
 * @property {() => void} clearDraft
 *           — dispatches DRAFT_CLEARED immediately + cancels any pending update
 */

/**
 * useAnchorObservationDraft
 *
 * @param {string} handId — required; the hand whose draft is being managed
 * @returns {UseAnchorObservationDraftReturn}
 */
export const useAnchorObservationDraft = (handId) => {
  const { selectDraftForHand, dispatchAnchorLibrary } = useAnchorLibrary();

  // Read-only view of the current persisted draft for this hand
  const draft = useMemo(
    () => (handId ? selectDraftForHand(handId) : null),
    [handId, selectDraftForHand],
  );

  // Pending-merge ref keeps multiple rapid updates coherent within a single
  // debounce window. Each updateDraft call merges into pendingRef; the timer
  // dispatches the accumulated payload.
  const pendingRef = useRef(null);
  const timerRef = useRef(null);

  // Cancel any in-flight debounce when handId changes or component unmounts.
  // The reducer doesn't care about lost mid-flight DRAFT_UPDATED actions
  // because the next dispatch (or clearDraft) supersedes them.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingRef.current = null;
    };
  }, [handId]);

  const flushPending = useCallback(() => {
    if (!pendingRef.current || !handId) {
      timerRef.current = null;
      return;
    }
    const payload = pendingRef.current;
    pendingRef.current = null;
    timerRef.current = null;
    dispatchAnchorLibrary({
      type: ANCHOR_LIBRARY_ACTIONS.DRAFT_UPDATED,
      payload: { draft: { ...payload, handId } },
    });
  }, [handId, dispatchAnchorLibrary]);

  const updateDraft = useCallback(
    (partial) => {
      if (!handId) return;
      if (!partial || typeof partial !== 'object') return;
      // Merge into pending; preserve prior fields not in this update
      pendingRef.current = { ...(pendingRef.current || {}), ...partial };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flushPending, UPDATE_DEBOUNCE_MS);
    },
    [handId, flushPending],
  );

  const clearDraft = useCallback(() => {
    if (!handId) return;
    // Cancel any pending debounce; the imminent CLEARED supersedes it
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
    dispatchAnchorLibrary({
      type: ANCHOR_LIBRARY_ACTIONS.DRAFT_CLEARED,
      payload: { handId },
    });
  }, [handId, dispatchAnchorLibrary]);

  return {
    draft,
    hasDraft: draft !== null && draft !== undefined,
    updateDraft,
    clearDraft,
  };
};
