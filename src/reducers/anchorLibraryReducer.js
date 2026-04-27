/**
 * anchorLibraryReducer.js — Exploit Anchor Library state management
 *
 * Manages the in-memory dictionary of anchors / observations / drafts /
 * primitives + global enrollment state. Persistence is handled by
 * `useAnchorLibraryPersistence` which dispatches HYDRATED on mount and
 * debounce-writes state changes back to IDB via the per-store CRUD wrappers.
 *
 * Mirrors `entitlementReducer.js` pattern (frozen ACTIONS + createValidatedReducer
 * wrapper + spread immutability + STATE_SCHEMA + INITIAL_STATE export).
 *
 * EAL Phase 6 Stream D B3 — Session 13 (2026-04-26).
 *
 * Architecture:
 *   - Dispatched via `useAnchorLibrary()` hook from any descendant of AnchorLibraryProvider
 *   - State writes always come through one of W-EA-* / W-AO-* / W-PP-* writers per
 *     `docs/projects/exploit-anchor-library/WRITERS.md` I-WR-1 enumerable registry
 *   - Reducer is pure; persistence side effects live in the persistence hook
 *
 * Eight actions covering the full lifecycle:
 *   1. ANCHOR_LIBRARY_HYDRATED          (boot from IDB; bulk load)
 *   2. OBSERVATION_CAPTURED             (W-AO-1 owner capture; adds to dict)
 *   3. OBSERVATION_DELETED              (Anchor Library surface delete; rare; dev reset)
 *   4. DRAFT_UPDATED                    (capture-modal debounced edit)
 *   5. DRAFT_CLEARED                    (Save success or Discard)
 *   6. ANCHOR_OVERRIDDEN                (W-EA-3 status/operator update — retire/suppress/operator-dial)
 *   7. PRIMITIVE_VALIDITY_UPDATED       (W-PP-2 Tier-2 update; cross-anchor invalidation handled at caller via computeRipple)
 *   8. ENROLLMENT_TOGGLED               (Q1-A global enrollment state toggle)
 */

import {
  ANCHOR_LIBRARY_ACTIONS,
  ANCHOR_LIBRARY_STATE_SCHEMA,
  ENROLLMENT_STATES,
  VALID_ENROLLMENT_STATES,
  initialAnchorLibraryState,
} from '../constants/anchorLibraryConstants';
import { createValidatedReducer } from '../utils/reducerUtils';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Build a dict from an array keyed by `id`. Tolerates non-array input
 * (returns empty dict) so HYDRATED with missing slices doesn't crash.
 */
const arrayToDict = (arr) => {
  if (!Array.isArray(arr)) return {};
  const dict = {};
  for (const item of arr) {
    if (item && typeof item === 'object' && typeof item.id === 'string') {
      dict[item.id] = item;
    }
  }
  return dict;
};

/**
 * Remove a key from a dict immutably. Returns the same dict reference if the
 * key wasn't present (avoids unnecessary re-renders).
 */
const removeKey = (dict, key) => {
  if (!dict || !(key in dict)) return dict;
  const next = { ...dict };
  delete next[key];
  return next;
};

// =============================================================================
// RAW REDUCER
// =============================================================================

const rawAnchorLibraryReducer = (state, action) => {
  switch (action.type) {
    // -------------------------------------------------------------------------
    // ANCHOR_LIBRARY_HYDRATED
    // Bulk-load on mount from IDB. Caller (useAnchorLibraryPersistence) calls
    // all 4 wrapper getAlls in parallel + the enrollment slice (from settings
    // or first-launch default), then dispatches with the full payload.
    // -------------------------------------------------------------------------
    case ANCHOR_LIBRARY_ACTIONS.ANCHOR_LIBRARY_HYDRATED: {
      const payload = action.payload || {};
      return {
        ...initialAnchorLibraryState,
        anchors: arrayToDict(payload.anchors),
        observations: arrayToDict(payload.observations),
        drafts: arrayToDict(payload.drafts),
        primitives: arrayToDict(payload.primitives),
        enrollment: {
          ...initialAnchorLibraryState.enrollment,
          ...(payload.enrollment || {}),
        },
      };
    }

    // -------------------------------------------------------------------------
    // OBSERVATION_CAPTURED
    // W-AO-1 capture flow: owner clicks Save in capture modal → captureObservation
    // pure writer produces record → reducer adds to observations dict.
    // Persistence hook will then call putObservation in the next debounce cycle.
    // -------------------------------------------------------------------------
    case ANCHOR_LIBRARY_ACTIONS.OBSERVATION_CAPTURED: {
      const observation = action.payload?.observation;
      if (!observation || typeof observation !== 'object' || typeof observation.id !== 'string') {
        return state;
      }
      return {
        ...state,
        observations: {
          ...state.observations,
          [observation.id]: observation,
        },
      };
    }

    // -------------------------------------------------------------------------
    // OBSERVATION_DELETED
    // Anchor Library surface "Delete this observation" + dev-mode reset.
    // -------------------------------------------------------------------------
    case ANCHOR_LIBRARY_ACTIONS.OBSERVATION_DELETED: {
      const id = action.payload?.id;
      if (typeof id !== 'string') return state;
      return {
        ...state,
        observations: removeKey(state.observations, id),
      };
    }

    // -------------------------------------------------------------------------
    // DRAFT_UPDATED
    // Capture-modal user edits → debounced 400ms → dispatch.
    // Auto-attaches deterministic id (mirrors anchorObservationDraftsStore.putDraft
    // logic at the reducer layer; persistence hook may pass id explicitly).
    // -------------------------------------------------------------------------
    case ANCHOR_LIBRARY_ACTIONS.DRAFT_UPDATED: {
      const draft = action.payload?.draft;
      if (!draft || typeof draft !== 'object' || typeof draft.handId !== 'string') {
        return state;
      }
      const id = draft.id || `draft:${draft.handId}`;
      // If caller passed mismatched id, prefer the deterministic id (defensive)
      const persistedDraft = { ...draft, id };
      return {
        ...state,
        drafts: {
          ...state.drafts,
          [id]: persistedDraft,
        },
      };
    }

    // -------------------------------------------------------------------------
    // DRAFT_CLEARED
    // Save success → orchestrator dispatches OBSERVATION_CAPTURED then
    // DRAFT_CLEARED. Discard → orchestrator dispatches DRAFT_CLEARED only.
    // -------------------------------------------------------------------------
    case ANCHOR_LIBRARY_ACTIONS.DRAFT_CLEARED: {
      const handId = action.payload?.handId;
      if (typeof handId !== 'string') return state;
      const id = `draft:${handId}`;
      return {
        ...state,
        drafts: removeKey(state.drafts, id),
      };
    }

    // -------------------------------------------------------------------------
    // ANCHOR_OVERRIDDEN
    // W-EA-3 study override: Anchor Library or Calibration Dashboard "Retire"
    // / "Suppress" / "Reset" / operator dial change. Caller (retirement journey
    // orchestrator) constructs the updated record + dispatches.
    //
    // Per WRITERS.md I-WR-2 + I-WR-7: writer never demotes status from retired
    // back to active (un-retire requires explicit re-enable code path).
    // Reducer doesn't enforce — caller's responsibility per W-EA-3 spec.
    // -------------------------------------------------------------------------
    case ANCHOR_LIBRARY_ACTIONS.ANCHOR_OVERRIDDEN: {
      const anchor = action.payload?.anchor;
      if (!anchor || typeof anchor !== 'object' || typeof anchor.id !== 'string') {
        return state;
      }
      // Merge: preserve un-touched fields, overlay updated fields. Caller
      // passes the full record (W-EA-3 contract); the merge handles the
      // common case of "just changed status + operator.lastOverrideAt".
      const existing = state.anchors[anchor.id] || {};
      return {
        ...state,
        anchors: {
          ...state.anchors,
          [anchor.id]: { ...existing, ...anchor },
        },
      };
    }

    // -------------------------------------------------------------------------
    // PRIMITIVE_VALIDITY_UPDATED
    // W-PP-2 Tier-2 validity update: caller (matcher post-firing hook in
    // Phase 8) computes new validityScore via updatePrimitiveValidity, then
    // dispatches the updated primitive record.
    //
    // Cross-anchor invalidation ripple: caller separately dispatches
    // ANCHOR_OVERRIDDEN for each affected anchor with the penalty-applied
    // composite. Atomicity at the IDB layer is enforced by the persistence
    // hook batching writes within a single transaction (Phase 6+ I-WR-3).
    // -------------------------------------------------------------------------
    case ANCHOR_LIBRARY_ACTIONS.PRIMITIVE_VALIDITY_UPDATED: {
      const primitive = action.payload?.primitive;
      if (!primitive || typeof primitive !== 'object' || typeof primitive.id !== 'string') {
        return state;
      }
      const existing = state.primitives[primitive.id] || {};
      return {
        ...state,
        primitives: {
          ...state.primitives,
          [primitive.id]: { ...existing, ...primitive },
        },
      };
    }

    // -------------------------------------------------------------------------
    // ENROLLMENT_TOGGLED
    // Settings → enrollment toggle (Q1-A global one-toggle pattern).
    // captureObservation W-AO-1 reads this state via useAnchorLibrary +
    // forces contributesToCalibration=false when not-enrolled (I-WR-5).
    // -------------------------------------------------------------------------
    case ANCHOR_LIBRARY_ACTIONS.ENROLLMENT_TOGGLED: {
      const newState = action.payload?.observation_enrollment_state;
      if (!VALID_ENROLLMENT_STATES.includes(newState)) {
        return state;
      }
      return {
        ...state,
        enrollment: {
          ...state.enrollment,
          observation_enrollment_state: newState,
        },
      };
    }

    default:
      return state;
  }
};

// =============================================================================
// VALIDATED REDUCER (export this)
// =============================================================================

export const anchorLibraryReducer = createValidatedReducer(
  rawAnchorLibraryReducer,
  ANCHOR_LIBRARY_STATE_SCHEMA,
  'anchorLibraryReducer',
);

// Re-export initialAnchorLibraryState for AppRoot useReducer call
export { initialAnchorLibraryState, ENROLLMENT_STATES };
