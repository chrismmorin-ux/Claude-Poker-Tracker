/**
 * @file VoiceReasoningNotesSection — Voice Reasoning Notes (VRN) settings panel.
 *
 * Surface spec: docs/design/surfaces/voice-reasoning-notes.md
 * Gate 1: docs/design/audits/2026-08-01-entry-voice-reasoning-notes.md
 * Gate 2: docs/design/audits/2026-08-01-blindspot-voice-reasoning-notes.md
 *
 * Phase 1 ships the replay lane only. Copy deliberately makes NO on-device
 * privacy claim: Gate 2 finding E-1 flags that browser Web Speech very likely
 * streams audio to a remote service, which has not yet been measured here. An
 * unverified privacy guarantee shown to a user is worse than no claim at all.
 */

import React from 'react';
import { SETTINGS_ACTIONS } from '../../../constants/settingsConstants';
import { GOLD } from '../../../constants/designTokens';

export const VoiceReasoningNotesSection = ({ settings, dispatchSettings }) => {
  const vrn = settings?.voiceReasoningNotes || { enabled: false };
  const enabled = !!vrn.enabled;

  const onToggleEnabled = (val) => {
    dispatchSettings({
      type: SETTINGS_ACTIONS.SET_VOICE_REASONING_NOTES_ENABLED,
      payload: { enabled: val },
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-5" data-testid="settings-voice-reasoning-notes-section">
      <h3 className="text-lg font-bold mb-4" style={{ color: GOLD.base }}>
        Voice reasoning notes
      </h3>

      <div className="mb-2">
        <label className="block text-gray-300 text-sm font-medium mb-2">
          Hand review narration
        </label>
        <p className="text-gray-500 text-xs mb-3">
          In hand review, hold the mic button and talk through a hand while you
          step through it. Each thing you say is recorded against the exact
          state on screen when you said it — street, board, pot, who is still in.
          Your own reasoning becomes evidence you can check later against what
          actually happened.
        </p>
        <p className="text-gray-500 text-xs mb-3">
          Recording keeps running while you step, so you can talk without
          stopping. Nothing you say is graded or scored — this only records.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onToggleEnabled(true)}
            className={`px-4 min-h-[44px] rounded-lg font-medium text-sm transition-colors ${
              enabled ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            aria-pressed={enabled}
            data-testid="settings-voice-reasoning-notes-on"
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
            data-testid="settings-voice-reasoning-notes-off"
          >
            Disabled
          </button>
        </div>
      </div>

      <p className="text-gray-600 text-[11px] mt-3">
        Live-table capture is not available yet — hand review only for now.
      </p>
    </div>
  );
};

export default VoiceReasoningNotesSection;
