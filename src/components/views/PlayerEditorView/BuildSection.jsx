/**
 * @file BuildSection — single-select chip row for body build.
 * Phase 3 (PIO G4 v2). Replaces the build field in PhysicalSection.
 */

import React from 'react';

export const BUILD_OPTIONS = ['slim', 'average', 'heavy', 'muscular'];

export const BuildSection = ({ value, onChange }) => {
  const selected = (value || '').toLowerCase();
  const toggle = (option) => onChange(option === selected ? null : option);

  return (
    <section className="mb-4" data-testid="player-editor-build">
      <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">Build</h3>
      <div className="flex flex-wrap gap-1.5">
        {BUILD_OPTIONS.map((opt) => {
          const isSelected = selected === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`px-3 py-1.5 rounded-full text-xs capitalize transition-colors ${
                isSelected
                  ? 'bg-cyan-700 text-white border border-cyan-500'
                  : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
              }`}
              data-testid={`player-editor-build-${opt}`}
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

export default BuildSection;
