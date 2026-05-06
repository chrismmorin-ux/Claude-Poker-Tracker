/**
 * @file BuildSection — single-select chip row for body build.
 * Phase 3 (PIO G4 v2). Replaces the build field in PhysicalSection.
 */

import React from 'react';

// Title-Cased labels per the design-system-sweep capitalization rule
// (every chip label is Title Case; storage stays lowercase). Was a flat
// string array — every other option set in the codebase is a {value, label}
// pair, this one was the outlier and rendered lowercase in PrototypeFinder.
export const BUILD_OPTIONS = [
  { value: 'slim', label: 'Slim' },
  { value: 'average', label: 'Average' },
  { value: 'heavy', label: 'Heavy' },
  { value: 'muscular', label: 'Muscular' },
];

export const BuildSection = ({ value, onChange }) => {
  const selected = (value || '').toLowerCase();
  const toggle = (option) => onChange(option === selected ? null : option);

  return (
    <section className="mb-4" data-testid="player-editor-build">
      <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">Build</h3>
      <div className="flex flex-wrap gap-1.5">
        {BUILD_OPTIONS.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                isSelected
                  ? 'bg-cyan-700 text-white border border-cyan-500'
                  : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
              }`}
              data-testid={`player-editor-build-${opt.value}`}
              aria-pressed={isSelected}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default BuildSection;
