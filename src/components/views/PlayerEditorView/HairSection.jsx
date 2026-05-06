/**
 * @file HairSection — combined hair color + length + texture + salt-pepper.
 * Phase 3 (PIO G4 v2). New section combining the three hair attributes
 * (color/length/texture) plus the salt-pepper treatment toggle.
 *
 * Layout:
 *   Hair
 *     Color:   [chips with color swatches]
 *     Length:  [chips: bald/shaved/short/medium/long]
 *     Texture: [chips: straight/curly/braided/receding]
 *     [✓ Salt & pepper] (toggle — adds white streaks overlay)
 *
 * Sex-aware: if sex=female, the salt-pepper toggle still applies (women
 * also get gray streaks). No suppression here.
 */

import React from 'react';
import { HAIR_COLORS } from '../../../constants/avatarFeatureConstants';
import ColorChip from './ColorChip';

// Order revised 2026-05-06 per owner: white → gray → red → blonde →
// light-brown → brown → dark-brown → black. Red sits as a warm-medium
// outlier between gray and the warm browns; the brown family stays
// internally light → dark. Salt-pepper is a treatment overlay (toggle on
// the hair section), not a base color choice — not in this array.
export const HAIR_COLOR_INPUT_OPTIONS = [
  { value: 'white', label: 'White' },
  { value: 'gray', label: 'Gray' },
  { value: 'red', label: 'Red' },
  { value: 'blonde', label: 'Blonde' },
  { value: 'light-brown', label: 'Light brown' },
  { value: 'brown', label: 'Brown' },
  { value: 'dark-brown', label: 'Dark brown' },
  { value: 'black', label: 'Black' },
];

const HEX_BY_INPUT = Object.fromEntries(
  HAIR_COLORS.map((c) => [c.id.replace(/^color\./, ''), c.hex]),
);

export { HEX_BY_INPUT as HAIR_HEX_BY_INPUT };

// Hair-length options. Owner-confirmed 2026-05-06: "Shaved" implies the
// head is shaved CLEAN (no visible hair), distinct from a buzz cut which
// has visible short stubble. `buzz` is now its own option between shaved
// and short.
//   bald   → naturally bald (no hair grows) — visually no hair
//   shaved → head shaved clean — visually no hair (same render as bald)
//   buzz   → very short stubble — distinct rendering with stubble pattern
//   short  → conventional short haircut
//   medium → shoulder/jaw length
//   long   → past shoulders
export const HAIR_LENGTH_OPTIONS = [
  { value: 'bald', label: 'Bald' },
  { value: 'shaved', label: 'Shaved' },
  { value: 'buzz', label: 'Buzz cut' },
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
];

export const HAIR_TEXTURE_OPTIONS = [
  { value: 'straight', label: 'Straight' },
  { value: 'curly', label: 'Curly' },
  { value: 'braided', label: 'Braided' },
  { value: 'receding', label: 'Receding' },
];

const Chip = ({ active, label, onClick, testId, swatch = null }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors ${
      active
        ? 'bg-cyan-700 text-white border border-cyan-500'
        : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
    }`}
    data-testid={testId}
    aria-pressed={active}
  >
    {swatch ? (
      <span
        style={{ background: swatch, width: 10, height: 10 }}
        className="rounded-full border border-gray-500 inline-block shrink-0"
      />
    ) : null}
    {label}
  </button>
);

export const HairSection = ({
  hairColor,
  hairLength,
  hairTexture,
  hairSaltPepper,
  onColorChange,
  onLengthChange,
  onTextureChange,
  onSaltPepperChange,
}) => {
  const colorSel = (hairColor || '').toLowerCase();
  const lengthSel = (hairLength || '').toLowerCase();
  const textureSel = (hairTexture || 'straight').toLowerCase();

  const toggleColor = (v) => onColorChange(v === colorSel ? null : v);
  const toggleLength = (v) => onLengthChange(v === lengthSel ? null : v);
  const toggleTexture = (v) => onTextureChange(v === textureSel ? null : v);

  return (
    <section className="mb-4" data-testid="player-editor-hair">
      <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">Hair</h3>

      <div className="mb-2">
        <div className="text-gray-500 text-[10px] uppercase tracking-wide mb-1">Color</div>
        <div className="flex flex-wrap gap-1.5">
          {HAIR_COLOR_INPUT_OPTIONS.map((opt) => (
            <ColorChip
              key={opt.value}
              active={colorSel === opt.value}
              label={opt.label}
              hex={HEX_BY_INPUT[opt.value]}
              onClick={() => toggleColor(opt.value)}
              testId={`player-editor-hair-color-${opt.value}`}
            />
          ))}
        </div>
      </div>

      <div className="mb-2">
        <div className="text-gray-500 text-[10px] uppercase tracking-wide mb-1">Length</div>
        <div className="flex flex-wrap gap-1.5">
          {HAIR_LENGTH_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              active={lengthSel === opt.value}
              label={opt.label}
              onClick={() => toggleLength(opt.value)}
              testId={`player-editor-hair-length-${opt.value}`}
            />
          ))}
        </div>
      </div>

      <div className="mb-2">
        <div className="text-gray-500 text-[10px] uppercase tracking-wide mb-1">Texture</div>
        <div className="flex flex-wrap gap-1.5">
          {HAIR_TEXTURE_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              active={textureSel === opt.value}
              label={opt.label}
              onClick={() => toggleTexture(opt.value)}
              testId={`player-editor-hair-texture-${opt.value}`}
            />
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 mt-2 text-xs text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          checked={!!hairSaltPepper}
          onChange={(e) => onSaltPepperChange?.(e.target.checked)}
          data-testid="player-editor-hair-salt-pepper"
        />
        <span>Salt &amp; pepper (overlay)</span>
      </label>
    </section>
  );
};

export default HairSection;
