/**
 * @file SignalToggleControls — 4 toggle buttons for SCF signal-class
 * inclusion in the composite formula.
 *
 * Mirrors the button-pair toggle pattern from PrivacySection.jsx:44-70
 * (aria-pressed binary toggle).
 *
 * Dispatches `SET_SELF_COACH_SIGNAL_TOGGLE` with `{name, enabled}` —
 * reducer at src/reducers/settingsReducer.js:155-209.
 *
 * SPR-042 / WS-159 (2026-05-06).
 */

import React from 'react';
import { useSettings } from '../../../contexts';
import { SETTINGS_ACTIONS } from '../../../constants/settingsConstants';
import { DEFAULT_TOGGLES } from '../../../utils/skillAssessment/composite';
import { GOLD } from '../../../constants/designTokens';

const TOGGLES = [
  { key: 'enableLeak',   label: 'Leak signal',     desc: 'heroLeaks store observations' },
  { key: 'enableDrill',  label: 'Drill signal',    desc: 'per-concept drill mastery' },
  { key: 'enableTest',   label: 'Test signal',     desc: 'per-concept opt-in test results (substrate pending)' },
  { key: 'enableRecent', label: 'Recency penalty', desc: 'linear decay on stale signals' },
];

const buttonStyle = (active) => ({
  minHeight: 36,
  padding: '0.25rem 0.75rem',
  background: active ? '#7c3aed' : '#1f2937',
  color: active ? '#ffffff' : '#d1d5db',
  border: '1px solid #374151',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.75rem',
  fontWeight: 500,
});

export const SignalToggleControls = () => {
  const { settings, dispatchSettings } = useSettings();
  const current = { ...DEFAULT_TOGGLES, ...(settings?.selfCoach?.signalToggles || {}) };

  const setToggle = (name, enabled) => {
    dispatchSettings({
      type: SETTINGS_ACTIONS.SET_SELF_COACH_SIGNAL_TOGGLE,
      payload: { name, enabled },
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-5" data-testid="self-coach-signal-toggles">
      <h3 className="text-lg font-bold mb-2" style={{ color: GOLD.base }}>
        Signal toggles
      </h3>
      <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
        Disable a signal class to remove it from the composite formula.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {TOGGLES.map(({ key, label, desc }) => {
          const enabled = !!current[key];
          return (
            <div
              key={key}
              data-testid={`self-coach-signal-toggle-${key}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '0.75rem',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ color: '#e5e7eb', fontSize: '0.85rem', fontWeight: 500 }}>{label}</div>
                <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>{desc}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setToggle(key, true)}
                  aria-pressed={enabled}
                  data-testid={`self-coach-signal-toggle-${key}-on`}
                  style={buttonStyle(enabled)}
                >
                  On
                </button>
                <button
                  type="button"
                  onClick={() => setToggle(key, false)}
                  aria-pressed={!enabled}
                  data-testid={`self-coach-signal-toggle-${key}-off`}
                  style={buttonStyle(!enabled)}
                >
                  Off
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
