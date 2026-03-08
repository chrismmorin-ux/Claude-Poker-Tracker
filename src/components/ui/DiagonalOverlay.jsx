import React from 'react';
import { OVERLAY_COLORS } from '../../constants/designTokens';

/**
 * DiagonalOverlay - Displays FOLD/ABSENT/MUCK/WON labels diagonally across cards
 *
 * @param {string} status - Status to display: 'folded', 'absent', 'mucked', 'won'
 * @param {object} SEAT_STATUS - SEAT_STATUS constant for checking folded/absent states
 */
export const DiagonalOverlay = ({ status, SEAT_STATUS = null }) => {
  if (!status) return null;

  const overlayConfig = {
    ...(SEAT_STATUS ? {
      [SEAT_STATUS.FOLDED]: { bg: OVERLAY_COLORS.folded, label: 'FOLD' },
      [SEAT_STATUS.ABSENT]: { bg: OVERLAY_COLORS.absent, label: 'ABSENT' },
    } : {}),
    mucked: { bg: OVERLAY_COLORS.mucked, label: 'MUCK' },
    won: { bg: OVERLAY_COLORS.won, label: 'WON' },
  };

  const config = overlayConfig[status];
  if (!config) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className="transform -rotate-45 text-xs font-bold px-3 py-1 rounded shadow-lg text-white"
        style={{ backgroundColor: config.bg }}
      >
        {config.label}
      </div>
    </div>
  );
};
