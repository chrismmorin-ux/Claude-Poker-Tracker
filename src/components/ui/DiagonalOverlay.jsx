import React from 'react';

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
      [SEAT_STATUS.FOLDED]: { bg: 'bg-red-600', label: 'FOLD' },
      [SEAT_STATUS.ABSENT]: { bg: 'bg-gray-600', label: 'ABSENT' },
    } : {}),
    mucked: { bg: 'bg-gray-700', label: 'MUCK' },
    won: { bg: 'bg-green-600', label: 'WON' },
  };

  const config = overlayConfig[status];
  if (!config) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className={`transform -rotate-45 text-xs font-bold px-3 py-1 rounded shadow-lg ${config.bg} text-white`}>
        {config.label}
      </div>
    </div>
  );
};
