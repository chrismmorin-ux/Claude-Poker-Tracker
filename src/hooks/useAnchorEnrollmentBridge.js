// Instantiated in: useAppState.js
/**
 * useAnchorEnrollmentBridge.js — settings → anchor-library enrollment sync
 *
 * EAL WS-222 / SPR-124 (2026-06-12). Enrollment's persisted source of truth
 * is the settings store (`settings.anchorCalibration.observationEnrollment`,
 * Q1-A "enrollment is a Settings field"); the runtime read model all
 * consumers use is `anchorLibraryState.enrollment.observation_enrollment_state`
 * (via `isEnrolled()` on AnchorLibraryContext). This hook keeps the runtime
 * mirror in sync, one-directionally: settings → anchor-library. Nothing
 * writes settings from anchor-library state, so no ping-pong is possible;
 * convergence is one dispatch.
 *
 * The sync is RECONCILING, not one-shot: ANCHOR_LIBRARY_HYDRATED rebuilds
 * the anchor-library state with default (not-enrolled) enrollment, so a
 * sync that fired before hydration would be clobbered. Because this effect
 * depends on BOTH values, the hydration clobber changes the runtime value,
 * the effect re-fires, and the settings value is re-asserted — order of
 * settings-hydration vs anchor-library-hydration doesn't matter.
 *
 * Red line #1: default everywhere is not-enrolled; before settings hydrate,
 * both sides hold the default and zero dispatches occur. Note this also
 * means Settings "Reset to defaults" un-enrolls calibration (fails safe).
 */

import { useEffect } from 'react';
import {
  ANCHOR_LIBRARY_ACTIONS,
  VALID_ENROLLMENT_STATES,
} from '../constants/anchorLibraryConstants';

/**
 * useAnchorEnrollmentBridge - Mirror persisted enrollment into anchor-library state
 *
 * @param {Object} settingsState - Settings state from settingsReducer
 * @param {Object} anchorLibraryState - Anchor library state from anchorLibraryReducer
 * @param {Function} dispatchAnchorLibrary - Anchor library dispatcher
 */
export const useAnchorEnrollmentBridge = (
  settingsState,
  anchorLibraryState,
  dispatchAnchorLibrary,
) => {
  const settingsEnrollment =
    settingsState?.settings?.anchorCalibration?.observationEnrollment;
  const runtimeEnrollment =
    anchorLibraryState?.enrollment?.observation_enrollment_state;

  useEffect(() => {
    if (!VALID_ENROLLMENT_STATES.includes(settingsEnrollment)) return;
    if (settingsEnrollment === runtimeEnrollment) return;
    dispatchAnchorLibrary({
      type: ANCHOR_LIBRARY_ACTIONS.ENROLLMENT_TOGGLED,
      payload: { observation_enrollment_state: settingsEnrollment },
    });
  }, [settingsEnrollment, runtimeEnrollment, dispatchAnchorLibrary]);
};
