/**
 * @file FacialHairSection — facial hair style + color.
 *
 * Sex-aware: when sex='female', hides this section since the avatar
 * suppresses beard rendering on feminine silhouettes regardless.
 *
 * Per feedback_color_independent_of_ethnicity.md: beardColor is a
 * user-selectable field. When unset, the avatar derives beard color from
 * hair color. When the user explicitly picks a beard color, it sticks
 * regardless of hair color changes.
 */

import React from 'react';
import ColorChip from './ColorChip';
import { HAIR_COLOR_INPUT_OPTIONS, HAIR_HEX_BY_INPUT } from './HairSection';

export const FACIAL_HAIR_OPTIONS = [
  { value: 'clean', label: 'Clean' },
  { value: 'stubble', label: 'Stubble' },
  { value: 'mustache', label: 'Mustache' },
  { value: 'goatee', label: 'Goatee' },
  { value: 'full', label: 'Full beard' },
  { value: 'soul-patch', label: 'Soul patch' },
];

export const FacialHairSection = ({
  value,
  onChange,
  sex,
  beardColor,
  onBeardColorChange,
}) => {
  // Per IdentityAvatar mapping: female suppresses beard render. Hide the
  // section to avoid offering an option that won't visually apply.
  if (sex === 'female') return null;

  const selected = (value || '').toLowerCase();
  const toggle = (option) => onChange(option === selected ? null : option);

  const colorSel = (beardColor || '').toLowerCase();
  const toggleColor = (v) => onBeardColorChange?.(v === colorSel ? null : v);

  // Hide color row when there's no beard to color.
  const hasBeard = selected && selected !== 'clean';

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

      {hasBeard ? (
        <div className="mt-2">
          <div className="text-gray-500 text-[10px] uppercase tracking-wide mb-1">
            Beard color
          </div>
          <div className="flex flex-wrap gap-1.5">
            {HAIR_COLOR_INPUT_OPTIONS.map((opt) => (
              <ColorChip
                key={opt.value}
                active={colorSel === opt.value}
                label={opt.label}
                hex={HAIR_HEX_BY_INPUT[opt.value]}
                onClick={() => toggleColor(opt.value)}
                testId={`player-editor-beard-color-${opt.value}`}
              />
            ))}
          </div>
          {!colorSel ? (
            <div className="text-[10px] text-gray-500 mt-1">
              Auto from hair color. Pick to override.
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

export default FacialHairSection;
