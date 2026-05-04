/**
 * @file LogoSection — wraps PaletteChipsInput with LOGO_PALETTE.
 * SPR-035 / WS-163.
 */

import React from 'react';
import { PaletteChipsInput } from './PaletteChipsInput';
import { LOGO_PALETTE } from '../../../utils/playerMatching/logoPalette';

export const LogoSection = ({ value, onChange }) => (
  <section className="mb-4" data-testid="player-editor-logo">
    <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">
      Logo
    </h3>
    <PaletteChipsInput
      palette={LOGO_PALETTE}
      value={value}
      onChange={onChange}
      testIdPrefix="player-editor-logo-chip"
    />
  </section>
);
