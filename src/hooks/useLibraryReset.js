/**
 * useLibraryReset.js — orchestrator hook for the global anchor-library reset
 * (red line #4b, three-way reversibility arm b). Parallels useAnchorRetirement
 * but operates library-wide via a single LIBRARY_CALIBRATION_RESET dispatch.
 *
 * Per `docs/design/audits/2026-06-13-entry-global-anchor-library-reset.md`
 * (Gate 1) + `docs/design/surfaces/settings-view.md` §EAL-G4-SET (Gate 4):
 *   - User-initiated from the Settings "Anchor Calibration" danger zone.
 *   - Reuses the shared RetirementConfirmModal confirm sheet (2-tap destructive)
 *     and 12s undo toast — single source of truth, no journey drift.
 *
 * Lifecycle:
 *   1. `beginReset()` — owner tapped "Reset all calibration".
 *      → builds count-aware copy (buildLibraryResetCopy) + opens the modal.
 *   2. `cancelReset()` — Cancel/Escape/backdrop. → closes; no persistence; no toast.
 *   3. `confirmReset()` — owner confirmed (2-tap checkbox + Reset all).
 *      → snapshots the prior anchors dict, dispatches LIBRARY_CALIBRATION_RESET
 *        with a timestamp, fires the 12s undo toast.
 *      → on Undo tap: dispatches LIBRARY_CALIBRATION_RESET with the prior
 *        snapshot (restoreAnchors), fires a 3s "restored" toast.
 *
 * Inputs (passed by the host surface — AnchorCalibrationResetSection):
 *   - `dispatchAnchorLibrary` — context dispatcher
 *   - `anchors` — raw anchors dict from useAnchorLibrary() (snapshot source for undo)
 *   - `toast` — useToast() instance
 *   - `now` — overridable timestamp source for tests
 *
 * EAL — WS-221 / SPR-126.
 */

import { useCallback, useState } from 'react';
import { ANCHOR_LIBRARY_ACTIONS } from '../constants/anchorLibraryConstants';
import { buildLibraryResetCopy } from '../utils/anchorLibrary/retirementCopy';

const UNDO_TOAST_DURATION_MS = 12_000;
const UNDONE_TOAST_DURATION_MS = 3_000;

/**
 * @param {Object} opts
 * @param {Function} opts.dispatchAnchorLibrary — reducer dispatch from context
 * @param {Object} [opts.anchors] — raw anchors dict (keyed by id) for undo snapshot
 * @param {Object} opts.toast — useToast() return value (addToast/showInfo/showError)
 * @param {() => string} [opts.now] — overridable timestamp source for tests
 * @returns {{
 *   pendingCopy: Object|null,
 *   beginReset: () => void,
 *   cancelReset: () => void,
 *   confirmReset: () => void,
 * }}
 */
export const useLibraryReset = ({ dispatchAnchorLibrary, anchors, toast, now } = {}) => {
  const [pendingCopy, setPendingCopy] = useState(null);

  const beginReset = useCallback(() => {
    const count = anchors && typeof anchors === 'object' ? Object.keys(anchors).length : 0;
    setPendingCopy(buildLibraryResetCopy(count));
  }, [anchors]);

  const cancelReset = useCallback(() => {
    setPendingCopy(null);
  }, []);

  const confirmReset = useCallback(() => {
    if (!pendingCopy) return;
    if (typeof dispatchAnchorLibrary !== 'function') {
      setPendingCopy(null);
      return;
    }

    // Snapshot the prior anchors dict for the undo path. Shallow copy is enough:
    // the reset produces brand-new per-anchor objects, so the prior references
    // remain untouched and restoring them is exact.
    const priorAnchors = (anchors && typeof anchors === 'object') ? { ...anchors } : {};
    const ts = (typeof now === 'function' ? now() : new Date().toISOString());

    try {
      dispatchAnchorLibrary({
        type: ANCHOR_LIBRARY_ACTIONS.LIBRARY_CALIBRATION_RESET,
        payload: { timestamp: ts },
      });
    } catch (err) {
      // Defensive against custom dispatch wrappers (logging, persistence
      // round-trips) — mirror useAnchorRetirement.
      if (toast && typeof toast.showError === 'function') {
        toast.showError(pendingCopy.errorToast);
      }
      setPendingCopy(null);
      return;
    }

    if (toast && typeof toast.addToast === 'function') {
      toast.addToast(pendingCopy.successToast, {
        variant: 'success',
        duration: UNDO_TOAST_DURATION_MS,
        action: {
          label: pendingCopy.undoLabel || 'Undo',
          onClick: () => {
            try {
              dispatchAnchorLibrary({
                type: ANCHOR_LIBRARY_ACTIONS.LIBRARY_CALIBRATION_RESET,
                payload: { restoreAnchors: priorAnchors },
              });
              if (typeof toast.showInfo === 'function') {
                toast.showInfo(pendingCopy.undoneToast, UNDONE_TOAST_DURATION_MS);
              }
            } catch (e) {
              if (typeof toast.showError === 'function') {
                toast.showError(pendingCopy.errorToast);
              }
            }
          },
        },
      });
    }

    setPendingCopy(null);
  }, [pendingCopy, dispatchAnchorLibrary, anchors, toast, now]);

  return {
    pendingCopy,
    beginReset,
    cancelReset,
    confirmReset,
  };
};

export default useLibraryReset;
