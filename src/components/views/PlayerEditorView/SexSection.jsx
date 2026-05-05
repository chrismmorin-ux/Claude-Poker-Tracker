/**
 * @file SexSection — must-have field per audit §6 IA.
 * Single-select chip row: M / F / Other.
 *
 * Phase 3 (PIO G4 v2). Replaces the gender field that previously lived
 * inside the collapsible PhysicalSection. Per audit §1.2: gender is one
 * of the largest discriminators and must be in the must-haves row.
 */

import React from 'react';

export const SEX_OPTIONS = [
  { value: 'male', label: 'M' },
  { value: 'female', label: 'F' },
  { value: 'other', label: 'Other' },
];

export const SexSection = ({ value, onChange }) => {
  const selected = (value || '').toLowerCase();
  const toggle = (option) => onChange(option === selected ? null : option);

  return (
    <section className="mb-4" data-testid="player-editor-sex">
      <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">Sex</h3>
      <div className="flex flex-wrap gap-1.5">
        {SEX_OPTIONS.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-cyan-700 text-white border border-cyan-500'
                  : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
              }`}
              data-testid={`player-editor-sex-${opt.value}`}
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

export default SexSection;
