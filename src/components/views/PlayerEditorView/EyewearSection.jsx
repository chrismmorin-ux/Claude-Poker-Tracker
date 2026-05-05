/**
 * @file EyewearSection — single-select eyewear + frame color.
 * Phase 3 (PIO G4 v2). Replaces hat/sunglasses booleans in PhysicalSection.
 *
 * Two stacked controls:
 *   - Eyewear style: none | clear | sunglasses | readers
 *   - Frame color (only shown when eyewear is set): black/brown/gold/silver/etc.
 */

import React from 'react';
import { EYEWEAR_COLORS } from '../../../constants/avatarFeatureConstants';

export const EYEWEAR_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'clear', label: 'Clear' },
  { value: 'sunglasses', label: 'Sunglasses' },
  { value: 'readers', label: 'Readers' },
];

const FRAME_COLOR_INPUT_OPTIONS = [
  { value: 'black', label: 'Black' },
  { value: 'brown', label: 'Brown' },
  { value: 'tortoiseshell', label: 'Tortoise' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'red', label: 'Red' },
  { value: 'blue', label: 'Blue' },
];

const COLOR_HEX_BY_INPUT = Object.fromEntries(
  EYEWEAR_COLORS.map((c) => [c.id.replace(/^frame\./, ''), c.hex]),
);

export const EyewearSection = ({ value, onChange, color, onColorChange }) => {
  const selected = (value || 'none').toLowerCase();
  const selectedColor = (color || 'black').toLowerCase();
  const toggleStyle = (opt) => onChange(opt === selected ? null : opt);

  // Frame color only meaningful when eyewear is present
  const showColorPicker = selected !== 'none' && selected !== '';

  return (
    <section className="mb-4" data-testid="player-editor-eyewear">
      <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">Eyewear</h3>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {EYEWEAR_OPTIONS.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleStyle(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                isSelected
                  ? 'bg-cyan-700 text-white border border-cyan-500'
                  : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
              }`}
              data-testid={`player-editor-eyewear-${opt.value}`}
              aria-pressed={isSelected}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {showColorPicker ? (
        <div>
          <div className="text-gray-500 text-[10px] uppercase tracking-wide mb-1">Frame color</div>
          <div className="flex flex-wrap gap-1.5">
            {FRAME_COLOR_INPUT_OPTIONS.map((opt) => {
              const isSelected = selectedColor === opt.value;
              const hex = COLOR_HEX_BY_INPUT[opt.value] || '#888';
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onColorChange?.(opt.value)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] transition-colors ${
                    isSelected
                      ? 'bg-cyan-700 text-white border border-cyan-500'
                      : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
                  }`}
                  data-testid={`player-editor-frame-${opt.value}`}
                  aria-pressed={isSelected}
                >
                  <span
                    style={{ background: hex, width: 10, height: 10 }}
                    className="rounded-full border border-gray-500 inline-block shrink-0"
                  />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default EyewearSection;
