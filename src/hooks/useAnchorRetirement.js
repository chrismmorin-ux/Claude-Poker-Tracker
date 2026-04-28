/**
 * useAnchorRetirement.js — orchestrator hook for the anchor-retirement journey.
 *
 * Per `docs/design/journeys/anchor-retirement.md`:
 *   - Variations A/B/C (Retire/Suppress/Reset) — user-initiated entry from
 *     anchor-library (or calibration-dashboard, future).
 *   - Variation F (Abort) — Cancel/Escape/backdrop-tap on confirm sheet.
 *   - Variation G (Undo) — 12s toast window with reverse-dispatch action.
 *
 * Lifecycle:
 *   1. `beginRetirement(action, anchor)` — user tapped a panel action button.
 *      → opens the confirm modal (sets `pendingCopy`).
 *   2. `cancelRetirement()` — user dismissed via Cancel/Escape/backdrop.
 *      → closes modal; no persistence; no toast.
 *   3. `confirmRetirement()` — user tapped the confirm button.
 *      → builds the override payload via W-EA-3 contract, dispatches
 *        ANCHOR_OVERRIDDEN, closes modal, fires 12s undo toast.
 *      → on Undo tap: dispatches ANCHOR_OVERRIDDEN with the prior anchor
 *        record, fires 3s "Undone" confirmation toast.
 *
 * Inputs (passed by the host surface):
 *   - `dispatchAnchorLibrary` — context dispatcher
 *   - `toast` — useToast() instance from ToastContext
 *
 * Per WRITERS.md §W-EA-3:
 *   - Updates `status` (for retire/suppress; not for reset)
 *   - Always stamps `operator.lastOverrideAt` + `operator.lastOverrideBy: 'owner'`
 *     + `operator.overrideReason: 'manual-{retire|suppress|reset}'`
 *   - For `reset`: also adds `operator.calibrationResetAt` timestamp; status
 *     unchanged. (The Tier 2 calibration-posterior reset is a separate concern;
 *     S21 just stamps the override + reason. The matcher post-firing hook in
 *     Phase 8 reads `calibrationResetAt` to ignore observations before that ts.)
 *
 * EAL Phase 6 — Session 21 (S21).
 */

import { useCallback, useState } from 'react';
import { ANCHOR_LIBRARY_ACTIONS } from '../constants/anchorLibraryConstants';
import {
  buildRetirementCopy,
  isKnownRetirementAction,
} from '../utils/anchorLibrary/retirementCopy';

const UNDO_TOAST_DURATION_MS = 12_000;
const UNDONE_TOAST_DURATION_MS = 3_000;

/**
 * Build the W-EA-3 anchor record update for a confirmed retirement action.
 * Pure function — exported for testability.
 *
 * @param {Object} priorAnchor — the anchor as it existed before override
 * @param {Object} copy — bundle from buildRetirementCopy
 * @param {string} timestamp — ISO 8601 string (caller injects `new Date().toISOString()`)
 * @returns {Object} updated anchor record ready for dispatch
 */
export const buildOverridePayload = (priorAnchor, copy, timestamp) => {
  const updated = { ...priorAnchor };
  // For retire / suppress, status changes. For reset, status unchanged.
  if (typeof copy.targetStatus === 'string') {
    updated.status = copy.targetStatus;
  }
  // Always stamp operator metadata.
  const priorOperator = priorAnchor.operator || {};
  updated.operator = {
    ...priorOperator,
    lastOverrideAt: timestamp,
    lastOverrideBy: 'owner',
    overrideReason: copy.overrideReason,
  };
  // For reset, additionally stamp calibrationResetAt for the matcher hook.
  if (copy.action === 'reset') {
    updated.operator.calibrationResetAt = timestamp;
  }
  return updated;
};

/**
 * @param {Object} opts
 * @param {Function} opts.dispatchAnchorLibrary — reducer dispatch from context
 * @param {Object} opts.toast — useToast() return value (addToast/dismissToast required)
 * @param {() => string} [opts.now] — overridable timestamp source for tests
 * @returns {{
 *   pendingCopy: Object|null,
 *   beginRetirement: (action: string, anchor: Object) => void,
 *   cancelRetirement: () => void,
 *   confirmRetirement: () => void,
 * }}
 */
export const useAnchorRetirement = ({ dispatchAnchorLibrary, toast, now } = {}) => {
  const [pending, setPending] = useState(null);
  // pending shape: { copy, anchor } | null

  const beginRetirement = useCallback((action, anchor) => {
    if (!isKnownRetirementAction(action)) return;
    if (!anchor || typeof anchor !== 'object' || typeof anchor.id !== 'string') return;
    const copy = buildRetirementCopy(action, anchor);
    if (!copy) return;
    setPending({ copy, anchor });
  }, []);

  const cancelRetirement = useCallback(() => {
    setPending(null);
  }, []);

  const confirmRetirement = useCallback(() => {
    if (!pending) return;
    const { copy, anchor: priorAnchor } = pending;
    if (typeof dispatchAnchorLibrary !== 'function') {
      setPending(null);
      return;
    }

    const ts = (typeof now === 'function' ? now() : new Date().toISOString());
    const updated = buildOverridePayload(priorAnchor, copy, ts);

    try {
      dispatchAnchorLibrary({
        type: ANCHOR_LIBRARY_ACTIONS.ANCHOR_OVERRIDDEN,
        payload: { anchor: updated },
      });
    } catch (err) {
      // Reducer dispatch is synchronous + can't throw under normal use, but
      // be defensive against custom dispatch wrappers (logging, persistence
      // round-trips). Surface error toast and bail.
      if (toast && typeof toast.showError === 'function') {
        toast.showError(copy.errorToast);
      }
      setPending(null);
      return;
    }

    // Fire success toast with Undo action button (12s).
    if (toast && typeof toast.addToast === 'function') {
      toast.addToast(copy.successToast, {
        variant: 'success',
        duration: UNDO_TOAST_DURATION_MS,
        action: {
          label: copy.undoLabel || 'Undo',
          onClick: () => {
            // Reverse-dispatch with the prior anchor record (status restored).
            try {
              dispatchAnchorLibrary({
                type: ANCHOR_LIBRARY_ACTIONS.ANCHOR_OVERRIDDEN,
                payload: { anchor: priorAnchor },
              });
              if (typeof toast.showInfo === 'function') {
                toast.showInfo(copy.undoneToast, UNDONE_TOAST_DURATION_MS);
              }
            } catch (e) {
              if (typeof toast.showError === 'function') {
                toast.showError(copy.errorToast);
              }
            }
          },
        },
      });
    }

    setPending(null);
  }, [pending, dispatchAnchorLibrary, toast, now]);

  return {
    pendingCopy: pending?.copy || null,
    beginRetirement,
    cancelRetirement,
    confirmRetirement,
  };
};

export default useAnchorRetirement;
