/**
 * @file FacialHairSection — single-select facial hair style.
 * Phase 3 (PIO G4 v2). Replaces facialHair in PhysicalSection.
 *
 * Sex-aware: when sex='female', hides this section since the avatar
 * suppresses beard rendering on feminine silhouettes regardless.
 */

import React from 'react';

export const FACIAL_HAIR_OPTIONS = [
  { value: 'clean', label: 'Clean' },
  { value: 'stubble', label: 'Stubble' },
  { value: 'mustache', label: 'Mustache' },
  { value: 'goatee', label: 'Goatee' },
  { value: 'full', label: 'Full beard' },
  { value: 'soul-patch', label: 'Soul patch' },
];

export const FacialHairSection = ({ value, onChange, sex }) => {
  // Per IdentityAvatar mapping: female suppresses beard render. Hide the
  // section to avoid offering an option that won't visually apply.
  if (sex === 'female') return null;

  const selected = (value || '').toLowerCase();
  const toggle = (option) => onChange(option === selected ? null : option);

  return (
    <section className="mb-4" data-testid="player-editor-facial-hair">
      <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">Facial hair</h3>
      <div className="flex flex-wrap gap-1.5">
        {FACIAL_HAIR_OPTIONS.map((opt) => {
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
              data-testid={`player-editor-facial-${opt.value}`}
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

export default FacialHairSection;
