/**
 * @file PaletteChipsInput — shared multi-select chip input for fixed palettes.
 *
 * Renders a fixed palette (array of `{id, label}`) as tappable chips. Selected
 * chips are highlighted (mirrors AvatarFeatureBuilder SelectionRing aesthetic).
 *
 * Reused by WardrobeSection / JewelrySection / LogoSection per WS-163.
 *
 * SPR-035 / WS-163 (2026-05-04).
 */

import React from 'react';

export const PaletteChipsInput = ({
  palette,
  value,
  onChange,
  testIdPrefix = 'palette-chip',
}) => {
  const selected = Array.isArray(value) ? value : [];

  const toggle = (id) => {
    if (selected.includes(id)) {
      onChange(selected.filter((v) => v !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div
      className="flex flex-wrap gap-1.5"
      data-testid={`${testIdPrefix}-container`}
    >
      {palette.map((entry) => {
        const isSelected = selected.includes(entry.id);
        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => toggle(entry.id)}
            className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
              isSelected
                ? 'bg-cyan-700 text-white border border-cyan-500'
                : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
            }`}
            data-testid={`${testIdPrefix}-${entry.id}`}
            aria-pressed={isSelected}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
};
