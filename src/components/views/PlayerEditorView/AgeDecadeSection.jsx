/**
 * @file AgeDecadeSection — radio group for the 6-bucket AgeDecade attribute.
 * Per WS-163 / SPR-035. Per `feedback_pio_identification_utility_first.md`.
 *
 * SPR-035 / WS-163 (2026-05-04).
 */

import React from 'react';

export const AGE_DECADE_OPTIONS = ['<20', '20s', '30s', '40s', '50s', '60s+'];

export const AgeDecadeSection = ({ value, onChange }) => {
  const selected = value ?? null;

  const toggle = (option) => {
    onChange(option === selected ? null : option);
  };

  return (
    <section className="mb-4" data-testid="player-editor-age-decade">
      <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">
        Age decade
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {AGE_DECADE_OPTIONS.map((opt) => {
          const isSelected = selected === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                isSelected
                  ? 'bg-cyan-700 text-white border border-cyan-500'
                  : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
              }`}
              data-testid={`player-editor-age-${opt}`}
              aria-pressed={isSelected}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </section>
  );
};
