/**
 * @file WardrobeSection — wraps PaletteChipsInput with WARDROBE_PALETTE.
 * SPR-035 / WS-163.
 */

import React from 'react';
import { PaletteChipsInput } from './PaletteChipsInput';
import { WARDROBE_PALETTE } from '../../../utils/playerMatching/wardrobePalette';

export const WardrobeSection = ({ value, onChange }) => (
  <section className="mb-4" data-testid="player-editor-wardrobe">
    <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">
      Wardrobe
    </h3>
    <PaletteChipsInput
      palette={WARDROBE_PALETTE}
      value={value}
      onChange={onChange}
      testIdPrefix="player-editor-wardrobe-chip"
    />
  </section>
);
