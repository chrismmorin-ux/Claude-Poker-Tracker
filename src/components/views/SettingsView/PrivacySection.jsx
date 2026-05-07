/**
 * @file PrivacySection — privacy controls in Settings.
 *
 * Currently scoped to one toggle: photoCaptureEnabled (PIO G5 / WS-165).
 * Per AP-PIO-03: photo capture is OFF by default; user must explicitly opt
 * in. When OFF, the camera entry button in PlayerEditor is hidden app-wide.
 *
 * Per `feedback_pio_identification_utility_first.md`: identification utility
 * binds; cultural-sensitivity is reviewing voice. The toggle exists because
 * the OWNER controls whether photos are captured at all (privacy-first), not
 * because there is a categorical refusal of demographic identification.
 *
 * SPR-036 / WS-165 (2026-05-04).
 */

import React from 'react';
import { SETTINGS_ACTIONS } from '../../../constants/settingsConstants';
import { GOLD } from '../../../constants/designTokens';

export const PrivacySection = ({ settings, dispatchSettings }) => {
  const photoCaptureEnabled = !!settings?.privacy?.photoCaptureEnabled;

  const onToggle = (enabled) => {
    dispatchSettings({
      type: SETTINGS_ACTIONS.SET_PRIVACY_PHOTO_CAPTURE_ENABLED,
      payload: { enabled },
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-5" data-testid="settings-privacy-section">
      <h3 className="text-lg font-bold mb-4" style={{ color: GOLD.base }}>Privacy</h3>

      <div className="mb-2">
        <label className="block text-gray-300 text-sm font-medium mb-2">
          Photo capture
        </label>
        <p className="text-gray-500 text-xs mb-3">
          When enabled, you can attach a photo to a player record via the
          camera button in the Player editor. Photos are stored locally only
          and never leave the device. OFF by default.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onToggle(true)}
            className={`px-4 min-h-[44px] rounded-lg font-medium text-sm transition-colors ${
              photoCaptureEnabled
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            aria-pressed={photoCaptureEnabled}
            data-testid="settings-privacy-photo-capture-on"
          >
            Enabled
          </button>
          <button
            type="button"
            onClick={() => onToggle(false)}
            className={`px-4 min-h-[44px] rounded-lg font-medium text-sm transition-colors ${
              !photoCaptureEnabled
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            aria-pressed={!photoCaptureEnabled}
            data-testid="settings-privacy-photo-capture-off"
          >
            Disabled
          </button>
        </div>
      </div>
    </div>
  );
};
