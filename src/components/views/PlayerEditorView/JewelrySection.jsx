/**
 * @file JewelrySection — wraps PaletteChipsInput with JEWELRY_PALETTE.
 * SPR-035 / WS-163.
 */

import React from 'react';
import { PaletteChipsInput } from './PaletteChipsInput';
import { JEWELRY_PALETTE } from '../../../utils/playerMatching/jewelryPalette';

export const JewelrySection = ({ value, onChange }) => (
  <section className="mb-4" data-testid="player-editor-jewelry">
    <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">
      Jewelry
    </h3>
    <PaletteChipsInput
      palette={JEWELRY_PALETTE}
      value={value}
      onChange={onChange}
      testIdPrefix="player-editor-jewelry-chip"
    />
  </section>
);
