/**
 * @file VoiceCardEntrySection — Voice Card Entry settings panel.
 *
 * Surface spec: docs/design/surfaces/voice-card-entry.md
 * Ticket: WS-181
 *
 * Controls:
 *   - Enabled (toggle): R3 ship-or-drop spike behind a Settings flag, OFF default.
 *   - Confidence threshold (slider, 0.5–0.9): D-3 owner-tunable parser gate.
 *   - Activation mode (radio): hold (default) / tap-toggle (walkie-talkie).
 *   - PTT position (radio): bottom-left (default, ergonomic near mic) / top-right.
 */

import React from 'react';
import { SETTINGS_ACTIONS } from '../../../constants/settingsConstants';
import { GOLD } from '../../../constants/designTokens';

export const VoiceCardEntrySection = ({ settings, dispatchSettings }) => {
  const vce = settings?.voiceCardEntry || {
    enabled: false,
    confidenceThreshold: 0.65,
    activationMode: 'hold',
    position: 'bottom-left',
  };
  const enabled = !!vce.enabled;
  const threshold = Number.isFinite(vce.confidenceThreshold) ? vce.confidenceThreshold : 0.65;
  const activationMode = vce.activationMode === 'tap' ? 'tap' : 'hold';
  const position = vce.position === 'top-right' ? 'top-right' : 'bottom-left';

  const onToggleEnabled = (val) => {
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

  const onActivationChange = (mode) => {
    dispatchSettings({
      type: SETTINGS_ACTIONS.SET_VOICE_CARD_ENTRY_ACTIVATION_MODE,
      payload: { mode },
    });
  };

  const onPositionChange = (pos) => {
    dispatchSettings({
      type: SETTINGS_ACTIONS.SET_VOICE_CARD_ENTRY_POSITION,
      payload: { position: pos },
    });
  };

  const radioBtn = (active, label, onClick, testId) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      data-testid={testId}
      aria-pressed={active}
      className={`px-3 min-h-[44px] rounded-lg font-medium text-sm transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : enabled
            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-gray-800 rounded-lg p-5" data-testid="settings-voice-card-entry-section">
      <h3 className="text-lg font-bold mb-4" style={{ color: GOLD.base }}>
        Voice card entry
      </h3>

      {/* Enabled toggle */}
      <div className="mb-4">
        <label className="block text-gray-300 text-sm font-medium mb-2">
          Spike mode
        </label>
        <p className="text-gray-500 text-xs mb-3">
          Hold (or tap) a mic button to speak board cards (flop / turn / river)
          and villain showdown cards. Live-table spike — your feedback decides
          if it ships. Voice processing is on-device only (Web Speech); no
          cloud transcription.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onToggleEnabled(true)}
            className={`px-4 min-h-[44px] rounded-lg font-medium text-sm transition-colors ${
              enabled ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            aria-pressed={enabled}
            data-testid="settings-voice-card-entry-on"
          >
            Enabled
          </button>
          <button
            type="button"
            onClick={() => onToggleEnabled(false)}
            className={`px-4 min-h-[44px] rounded-lg font-medium text-sm transition-colors ${
              !enabled ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            aria-pressed={!enabled}
            data-testid="settings-voice-card-entry-off"
          >
            Disabled
          </button>
        </div>
      </div>

      {/* Activation mode */}
      <div className="mb-4">
        <label className="block text-gray-300 text-sm font-medium mb-2">
          Activation
        </label>
        <p className="text-gray-500 text-xs mb-3">
          <strong>Hold</strong> = press and hold while speaking; release to
          commit. Best accidental-activation protection.{' '}
          <strong>Tap-toggle</strong> = tap once to start, tap again to stop;
          auto-stops after 8&nbsp;s of silence. Walkie-talkie style — useful
          if your grip can&apos;t maintain a hold near the phone&apos;s mic.
        </p>
        <div className="flex gap-2">
          {radioBtn(activationMode === 'hold', 'Hold', () => onActivationChange('hold'), 'settings-vce-mode-hold')}
          {radioBtn(activationMode === 'tap', 'Tap-toggle', () => onActivationChange('tap'), 'settings-vce-mode-tap')}
        </div>
      </div>

      {/* PTT position */}
      <div className="mb-4">
        <label className="block text-gray-300 text-sm font-medium mb-2">
          PTT button position
        </label>
        <p className="text-gray-500 text-xs mb-3">
          <strong>Bottom-left</strong> (default) sits near the phone&apos;s
          mic and speaker on Galaxy A22 landscape — closest to natural grip
          when phone is tilted for speakerphone use.{' '}
          <strong>Top-right</strong> is the legacy placement; further from
          the bottom controls but on the opposite side of the screen.
        </p>
        <div className="flex gap-2">
          {radioBtn(position === 'bottom-left', 'Bottom-left', () => onPositionChange('bottom-left'), 'settings-vce-pos-bl')}
          {radioBtn(position === 'top-right', 'Top-right', () => onPositionChange('top-right'), 'settings-vce-pos-tr')}
        </div>
      </div>

      {/* Confidence threshold */}
      <div>
        <label
          className="block text-gray-300 text-sm font-medium mb-2"
          htmlFor="vce-confidence-slider"
        >
          Recognition confidence threshold
        </label>
        <p className="text-gray-500 text-xs mb-3">
          Lower = more transcripts accepted (faster but more correction
          needed). Higher = stricter parsing (fewer false chips but more
          &quot;try again&quot; moments). Default 0.65.
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
