/**
 * IcmBadge.jsx - ICM pressure badge for tournament UI
 *
 * Shows approaching/bubble/ITM badges based on ICM pressure zone.
 */

import React from 'react';

/**
 * @param {Object} props
 * @param {Object|null} props.icmPressure - { zone: 'standard'|'approaching'|'bubble'|'itm', playersFromBubble: number }
 */
export const IcmBadge = ({ icmPressure }) => {
  if (!icmPressure || icmPressure.zone === 'standard') return null;

  if (icmPressure.zone === 'itm') {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(34,197,94,0.2)', color: '#22c55e' }}>
        ITM
      </span>
    );
  }

  if (icmPressure.zone === 'bubble') {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded font-medium animate-pulse" style={{ backgroundColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
        BUBBLE ({icmPressure.playersFromBubble} away)
      </span>
    );
  }

  if (icmPressure.zone === 'approaching') {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>
        Bubble ~{icmPressure.playersFromBubble}
      </span>
    );
  }

  return null;
};
