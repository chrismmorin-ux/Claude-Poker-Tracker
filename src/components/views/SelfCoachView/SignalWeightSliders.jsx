/**
 * @file SignalWeightSliders — 4 discrete-step sliders for SCF composite
 * formula weights.
 *
 * Per founder decision 2026-05-06: discrete 0.1 steps (touch-friendly;
 * default values 0.5 / 0.3 / 0.15 / 0.05 are already round-friendly).
 * Note: W_test default is 0.15 → snaps to 0.2 if user touches the slider;
 * the default itself is preserved in storage until the user moves it.
 *
 * Dispatches `SET_SELF_COACH_SIGNAL_WEIGHT` with `{name, weight}` —
 * reducer at src/reducers/settingsReducer.js:175-193.
 *
 * SPR-042 / WS-159 (2026-05-06).
 */

import React from 'react';
import { useSettings } from '../../../contexts';
import { SETTINGS_ACTIONS } from '../../../constants/settingsConstants';
import { DEFAULT_WEIGHTS } from '../../../utils/skillAssessment/composite';
import { GOLD } from '../../../constants/designTokens';

const SLIDERS = [
  { key: 'W_leak',   label: 'W_leak',   desc: 'leak-fire severity contribution' },
  { key: 'W_drill',  label: 'W_drill',  desc: 'drill mastery gap contribution' },
  { key: 'W_test',   label: 'W_test',   desc: 'opt-in test gap contribution' },
  { key: 'W_recent', label: 'W_recent', desc: 'recency penalty deduction' },
];

const SLIDER_STEP = 0.1;
const SLIDER_MIN = 0;
const SLIDER_MAX = 1;

const snapToStep = (n) => {
  const clamped = Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, Number(n)));
  if (!Number.isFinite(clamped)) return 0;
  return Math.round(clamped / SLIDER_STEP) * SLIDER_STEP;
};

const fmt = (n) => (Number.isFinite(n) ? n.toFixed(2) : '0.00');

export const SignalWeightSliders = () => {
  const { settings, dispatchSettings } = useSettings();
  const current = { ...DEFAULT_WEIGHTS, ...(settings?.selfCoach?.signalWeights || {}) };

  const setWeight = (name, raw) => {
    const weight = snapToStep(raw);
    dispatchSettings({
      type: SETTINGS_ACTIONS.SET_SELF_COACH_SIGNAL_WEIGHT,
      payload: { name, weight },
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-5" data-testid="self-coach-signal-weights">
      <h3 className="text-lg font-bold mb-2" style={{ color: GOLD.base }}>
        Signal weights
      </h3>
      <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
        Composite formula coefficients. Discrete 0.1 steps in [0, 1].
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {SLIDERS.map(({ key, label, desc }) => {
          const value = Number(current[key] ?? 0);
          return (
            <div
              key={key}
              data-testid={`self-coach-signal-weight-${key}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '7rem 1fr 3rem',
                gap: '0.75rem',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ color: '#e5e7eb', fontSize: '0.85rem', fontWeight: 500, fontFamily: 'monospace' }}>{label}</div>
                <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>{desc}</div>
              </div>
              <input
                type="range"
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                step={SLIDER_STEP}
                value={value}
                onChange={(e) => setWeight(key, e.target.value)}
                aria-label={`${label} weight`}
                aria-valuemin={SLIDER_MIN}
                aria-valuemax={SLIDER_MAX}
                aria-valuenow={value}
                data-testid={`self-coach-signal-weight-${key}-slider`}
                style={{ accentColor: '#7c3aed', width: '100%' }}
              />
              <span
                data-testid={`self-coach-signal-weight-${key}-value`}
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  color: '#f3f4f6',
                  textAlign: 'right',
                }}
              >
                {fmt(value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
