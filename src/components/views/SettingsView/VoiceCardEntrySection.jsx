/**
 * @file VoiceCardEntrySection — Voice Card Entry settings panel.
 *
 * Surface spec: docs/design/surfaces/voice-card-entry.md
 * Ticket: WS-181
 *
 * Two controls:
 *   - Enabled (toggle): WS-181 R3 ship-or-drop spike behind a Settings flag,
 *     OFF by default.
 *   - Confidence threshold (slider, 0.5–0.9): D-3 owner-tunable parser gate.
 *
 * Copy mirrors WS-181 status_note for owner-visible context.
 */

import React from 'react';
import { SETTINGS_ACTIONS } from '../../../constants/settingsConstants';
import { GOLD } from '../../../constants/designTokens';

export const VoiceCardEntrySection = ({ settings, dispatchSettings }) => {
  const vce = settings?.voiceCardEntry || { enabled: false, confidenceThreshold: 0.65 };
  const enabled = !!vce.enabled;
  const threshold = Number.isFinite(vce.confidenceThreshold) ? vce.confidenceThreshold : 0.65;

  const onToggle = (val) => {
    dispatchSettings({
      type: SETTINGS_ACTIONS.SET_VOICE_CARD_ENTRY_ENABLED,
      payload: { enabled: val },
    });
  };

  const onThresholdChange = (e) => {
    const raw = parseFloat(e.target.value);
    if (!Number.isFinite(raw)) return;
    dispatchSettings({
      type: SETTINGS_ACTIONS.SET_VOICE_CARD_ENTRY_CONFIDENCE_THRESHOLD,
      payload: { threshold: raw },
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-5" data-testid="settings-voice-card-entry-section">
      <h3 className="text-lg font-bold mb-4" style={{ color: GOLD.base }}>
        Voice card entry
      </h3>

      <div className="mb-4">
        <label className="block text-gray-300 text-sm font-medium mb-2">
          Spike mode
        </label>
        <p className="text-gray-500 text-xs mb-3">
          Hold a mic button to speak board cards (flop / turn / river) and
          villain showdown cards. Live-table spike — your feedback determines
          whether it ships. Voice processing is on-device only (Web Speech);
          no cloud transcription.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onToggle(true)}
            className={`px-4 min-h-[44px] rounded-lg font-medium text-sm transition-colors ${
              enabled
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            aria-pressed={enabled}
            data-testid="settings-voice-card-entry-on"
          >
            Enabled
          </button>
          <button
            type="button"
            onClick={() => onToggle(false)}
            className={`px-4 min-h-[44px] rounded-lg font-medium text-sm transition-colors ${
              !enabled
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            aria-pressed={!enabled}
            data-testid="settings-voice-card-entry-off"
          >
            Disabled
          </button>
        </div>
      </div>

      <div>
        <label
          className="block text-gray-300 text-sm font-medium mb-2"
          htmlFor="vce-confidence-slider"
        >
          Recognition confidence threshold
        </label>
        <p className="text-gray-500 text-xs mb-3">
          Lower = more transcripts accepted (faster but more correction needed).
          Higher = stricter parsing (fewer false chips but more &quot;try again&quot;
          moments at the table). Default 0.65.
        </p>
        <div className="flex items-center gap-3">
          <input
            id="vce-confidence-slider"
            type="range"
            min="0.5"
            max="0.9"
            step="0.05"
            value={threshold}
            onChange={onThresholdChange}
            disabled={!enabled}
            className="flex-1"
            data-testid="settings-voice-card-entry-threshold-slider"
          />
          <span
            className="text-gray-200 text-sm w-12 text-right tabular-nums"
            data-testid="settings-voice-card-entry-threshold-value"
          >
            {threshold.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};
