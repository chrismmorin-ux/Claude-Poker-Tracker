/**
 * useAnchorLibraryPersistence.js — IDB persistence for anchor library state
 *
 * Hydrates the anchor library reducer from the v19 EAL stores on mount;
 * debounce-writes state changes back to IDB. Mirrors useEntitlementPersistence
 * pattern — receives `state` + `dispatch` as params (composed from inside
 * AnchorLibraryProvider).
 *
 * EAL Phase 6 Stream D B3 — Session 13 (2026-04-26).
 *
 * Hydration strategy:
 *   - Parallel `Promise.all` over the 4 wrapper getAlls (anchors + observations
 *     + drafts + primitives). Faster than sequential reads; safe because the
 *     wrappers are independent stores.
 *   - Single `ANCHOR_LIBRARY_HYDRATED` dispatch with the full payload. Reducer
 *     bulk-loads in one render.
 *
 * Write strategy:
 *   - 400ms debounce per state change (mirrors useEntitlementPersistence +
 *     usePlayerPersistence convention).
 *   - **Per-slice diff-write:** the previous-state ref is compared to the new
 *     state to compute which slices changed. Only changed slices are written
 *     (avoids re-writing all 4 stores on every dispatch).
 *   - Within a changed slice, all records in the slice are written. This is
 *     simpler than per-record diff (which would require tracking touched ids)
 *     and acceptable performance at expected scale (4 seed anchors, ≤100
 *     observations, ≤10 drafts, 8 primitives).
 *   - For the drafts slice: deletions (key removed from dict) require explicit
 *     `deleteDraft` calls; ref-based diff identifies removed keys.
 *   - For the observations slice: deletions handled the same way.
 *   - Anchors + primitives have no delete actions in the reducer (per WRITERS.md
 *     I-WR-7 retirement uses status-update not delete; perception primitive
 *     overrides via W-PP-3 don't delete).
 */

import { useEffect, useRef, useState } from 'react';
import { getAllAnchors, putAnchor } from '../utils/persistence/exploitAnchorsStore';
import {
  getAllObservations,
  putObservation,
  deleteObservation,
} from '../utils/persistence/anchorObservationsStore';
import {
  getAllDrafts,
  putDraft,
  deleteDraft,
} from '../utils/persistence/anchorObservationDraftsStore';
import {
  getAllPrimitives,
  putPrimitive,
} from '../utils/persistence/perceptionPrimitivesStore';
import { ANCHOR_LIBRARY_ACTIONS } from '../constants/anchorLibraryConstants';

const WRITE_DEBOUNCE_MS = 400;

/**
 * useAnchorLibraryPersistence
 *
 * @param {Object} state - State from anchorLibraryReducer
 * @param {Function} dispatch - Dispatcher for anchor library actions
 * @returns {{ isReady: boolean }}
 */
export const useAnchorLibraryPersistence = (state, dispatch) => {
  const [isReady, setIsReady] = useState(false);
  const writeTimerRef = useRef(null);
  const hasHydratedRef = useRef(false);
  const prevStateRef = useRef(null);

  // ==========================================================================
  // HYDRATION (on mount)
  // ==========================================================================

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        // Parallel reads across the 4 stores. Wrappers are independent so
        // they don't contend on the same transaction.
        const [anchors, observations, drafts, primitives] = await Promise.all([
          getAllAnchors(),
          getAllObservations(),
          getAllDrafts(),
          getAllPrimitives(),
        ]);

        if (cancelled) return;

        dispatch({
          type: ANCHOR_LIBRARY_ACTIONS.ANCHOR_LIBRARY_HYDRATED,
          payload: {
            anchors,
            observations,
            drafts,
            primitives,
            // Enrollment hydration: defer to settings store / persisted user
            // preference. Phase 6+ wires this; for now defaults to not-enrolled
            // (red line #1 opt-in).
            enrollment: undefined,
          },
        });

        hasHydratedRef.current = true;
        setIsReady(true);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[useAnchorLibraryPersistence] hydration failed:', error);
        // Continue with default empty state. App remains usable.
        hasHydratedRef.current = true;
        setIsReady(true);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  // ==========================================================================
  // DEBOUNCED WRITE on state change (per-slice diff)
  // ==========================================================================

  useEffect(() => {
    // Skip writes until hydration completes (avoids overwriting IDB with
    // empty defaults before the actual records load).
    if (!hasHydratedRef.current) {
      prevStateRef.current = state;
      return;
    }

    if (writeTimerRef.current) {
      clearTimeout(writeTimerRef.current);
    }

    const previousState = prevStateRef.current;
    prevStateRef.current = state;

    writeTimerRef.current = setTimeout(async () => {
      try {
        // Anchors slice — write changed/new records (no deletes per W-EA spec)
        if (previousState?.anchors !== state.anchors) {
          const writes = [];
          for (const id of Object.keys(state.anchors || {})) {
            if (previousState?.anchors?.[id] !== state.anchors[id]) {
              writes.push(putAnchor(state.anchors[id]));
            }
          }
          if (writes.length > 0) await Promise.all(writes);
        }

        // Observations slice — writes for new/changed + deletes for removed keys
        if (previousState?.observations !== state.observations) {
          const writes = [];
          for (const id of Object.keys(state.observations || {})) {
            if (previousState?.observations?.[id] !== state.observations[id]) {
              writes.push(putObservation(state.observations[id]));
            }
          }
          // Detect removed observations (present in previous, absent in current)
          for (const id of Object.keys(previousState?.observations || {})) {
            if (!(id in (state.observations || {}))) {
              writes.push(deleteObservation(id));
            }
          }
          if (writes.length > 0) await Promise.all(writes);
        }

        // Drafts slice — writes for new/changed + deletes for removed keys
        if (previousState?.drafts !== state.drafts) {
          const writes = [];
          for (const id of Object.keys(state.drafts || {})) {
            if (previousState?.drafts?.[id] !== state.drafts[id]) {
              writes.push(putDraft(state.drafts[id]));
            }
          }
          // Detect cleared drafts (DRAFT_CLEARED action removed key from dict)
          for (const id of Object.keys(previousState?.drafts || {})) {
            if (!(id in (state.drafts || {}))) {
              // id format is `draft:<handId>` — extract handId for the wrapper
              const handId = id.startsWith('draft:') ? id.slice('draft:'.length) : null;
              if (handId) writes.push(deleteDraft(handId));
            }
          }
          if (writes.length > 0) await Promise.all(writes);
        }

        // Primitives slice — writes for changed records (no deletes per W-PP spec)
        if (previousState?.primitives !== state.primitives) {
          const writes = [];
          for (const id of Object.keys(state.primitives || {})) {
            if (previousState?.primitives?.[id] !== state.primitives[id]) {
              writes.push(putPrimitive(state.primitives[id]));
            }
          }
          if (writes.length > 0) await Promise.all(writes);
        }

        // Enrollment slice — Phase 6+ wires to settings store; not handled here.
        // (Settings persistence has its own hook; enrollment is a Settings field.)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[useAnchorLibraryPersistence] persistence write failed:', error);
      }
    }, WRITE_DEBOUNCE_MS);

    return () => {
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current);
      }
    };
  }, [state]);

  return { isReady };
};
