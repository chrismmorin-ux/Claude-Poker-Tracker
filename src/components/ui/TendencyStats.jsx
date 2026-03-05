/**
 * TendencyStats.jsx - Compact tendency stat display for player rows
 *
 * Shows VPIP, PFR, AF, 3-bet%, C-bet% in a single line.
 * Only renders when sample >= 10.
 * Style classification shown when sample >= 20.
 */

import React from 'react';

const MIN_DISPLAY_SAMPLE = 10;
const MIN_STYLE_SAMPLE = 20;

/**
 * Get color class for style classification
 */
const getStyleColor = (style) => {
  switch (style) {
    case 'Fish':
    case 'LP':
      return 'text-green-700 bg-green-100'; // exploitable
    case 'TAG':
    case 'Reg':
      return 'text-yellow-700 bg-yellow-100'; // reg
    case 'LAG':
    case 'Nit':
      return 'text-red-700 bg-red-100'; // danger/tricky
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

/**
 * Format a stat value for display
 */
const formatStat = (value, suffix = '%') => {
  if (value === null || value === undefined) return '—';
  if (value === Infinity) return '∞';
  return `${value}${suffix}`;
};

/**
 * TendencyStats component
 * @param {Object} props
 * @param {Object} props.stats - { vpip, pfr, af, threeBet, cbet, sampleSize, style }
 */
export const TendencyStats = ({ stats }) => {
  if (!stats || stats.sampleSize < MIN_DISPLAY_SAMPLE) return null;

  const { vpip, pfr, af, threeBet, cbet, sampleSize, style } = stats;

  return (
    <div className="flex items-center gap-2 text-xs mt-1">
      {/* Stat values */}
      <span className="text-gray-500">
        <span className="font-medium text-gray-700">VPIP</span> {formatStat(vpip)}
      </span>
      <span className="text-gray-400">|</span>
      <span className="text-gray-500">
        <span className="font-medium text-gray-700">PFR</span> {formatStat(pfr)}
      </span>
      <span className="text-gray-400">|</span>
      <span className="text-gray-500">
        <span className="font-medium text-gray-700">AF</span> {formatStat(af, '')}
      </span>
      {threeBet !== null && (
        <>
          <span className="text-gray-400">|</span>
          <span className="text-gray-500">
            <span className="font-medium text-gray-700">3B</span> {formatStat(threeBet)}
          </span>
        </>
      )}
      {cbet !== null && (
        <>
          <span className="text-gray-400">|</span>
          <span className="text-gray-500">
            <span className="font-medium text-gray-700">CB</span> {formatStat(cbet)}
          </span>
        </>
      )}

      {/* Style badge */}
      {style && sampleSize >= MIN_STYLE_SAMPLE && (
        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStyleColor(style)}`}>
          {style}
        </span>
      )}
    </div>
  );
};

export default TendencyStats;
