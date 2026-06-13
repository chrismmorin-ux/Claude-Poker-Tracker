/**
 * @file AnchorCalibrationSection — anchor-calibration observation enrollment
 * toggle in Settings (EAL WS-222 / SPR-124, 2026-06-12).
 *
 * The ONLY UI write path for enrollment — autonomy red line #1's opt-in
 * mechanism. Default not-enrolled; nothing is collected until the owner
 * explicitly enrolls. Dispatches SET_ANCHOR_CALIBRATION_ENROLLMENT to the
 * settings reducer (persisted source of truth); useAnchorEnrollmentBridge
 * mirrors the value into anchorLibraryReducer at runtime. Never dispatch
 * ENROLLMENT_TOGGLED directly from a surface — the bridge would revert it.
 *
 * Copy comes from buildEnrollmentSettingsCopy() in calibrationCopy.js so it
 * stays under AP-06 FORBIDDEN_PATTERNS enforcement (model-accuracy framing;
 * never "your accuracy"; no enrollment nag per red line #5).
 *
 * Spec: docs/design/surfaces/settings-view.md §EAL-G4-SET.
 */

import React from 'react';
import { SETTINGS_ACTIONS } from '../../../constants/settingsConstants';
import { ENROLLMENT_STATES } from '../../../constants/anchorLibraryConstants';
import { buildEnrollmentSettingsCopy } from '../../../utils/anchorLibrary/calibrationCopy';
import { GOLD } from '../../../constants/designTokens';

export const AnchorCalibrationSection = ({ settings, dispatchSettings }) => {
  const copy = buildEnrollmentSettingsCopy();
  const enrolled =
    settings?.anchorCalibration?.observationEnrollment === ENROLLMENT_STATES.ENROLLED;

  const onToggle = (enrollmentState) => {
    dispatchSettings({
      type: SETTINGS_ACTIONS.SET_ANCHOR_CALIBRATION_ENROLLMENT,
      payload: { enrollmentState },
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-5" data-testid="settings-anchor-calibration-section">
      <h3 className="text-lg font-bold mb-4" style={{ color: GOLD.base }}>{copy.heading}</h3>

      <div className="mb-2">
        <label className="block text-gray-300 text-sm font-medium mb-2">
          {copy.label}
        </label>
        <p className="text-gray-500 text-xs mb-3">
          {copy.explainer}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onToggle(ENROLLMENT_STATES.ENROLLED)}
            className={`px-4 min-h-[44px] rounded-lg font-medium text-sm transition-colors ${
              enrolled
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            aria-pressed={enrolled}
            data-testid="settings-anchor-calibration-enroll-on"
          >
            {copy.enrolledLabel}
          </button>
          <button
            type="button"
            onClick={() => onToggle(ENROLLMENT_STATES.NOT_ENROLLED)}
            className={`px-4 min-h-[44px] rounded-lg font-medium text-sm transition-colors ${
              !enrolled
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            aria-pressed={!enrolled}
            data-testid="settings-anchor-calibration-enroll-off"
          >
            {copy.notEnrolledLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
