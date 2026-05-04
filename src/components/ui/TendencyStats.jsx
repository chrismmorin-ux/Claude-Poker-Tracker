/**
 * TendencyStats.jsx - Compact tendency stat display for player rows
 *
 * Shows VPIP, PFR, AF, 3-bet%, C-bet% in a single line.
 * Only renders when sample >= 10.
 * Style classification shown when sample >= 20.
 */

import React from 'react';
import { STYLE_COLORS_LIGHT } from '../../constants/designTokens';

const MIN_DISPLAY_SAMPLE = 10;
const MIN_STYLE_SAMPLE = 20;

/**
 * Format a stat value for display
 */
const formatStat = (value, suffix = '%') => {
  if (value === null || value === undefined) return '—';
  if (value === Infinity) return '∞';
  return `${value}${suffix}`;
};

/**
 * Format the credible-interval suffix (e.g. "±4.4%") for display next to a percentage stat.
 * Returns null when interval is missing, sampleSize is unknown, or sampleSize > showThreshold
 * (band becomes tight at large n; surface noise instead of signal). FIND-001 / SPR-017.
 */
const formatBandSuffix = (interval, sampleSize, showThreshold = 200) => {
  if (!interval || sampleSize == null || sampleSize > showThreshold) return null;
  const halfWidth = ((interval.upper - interval.lower) / 2) * 100;
  return `±${halfWidth.toFixed(1)}%`;
};

/**
 * Render a credible-interval band suffix span if available; otherwise nothing.
 */
const BandSuffix = ({ interval, sampleSize }) => {
  const band = formatBandSuffix(interval, sampleSize);
  if (!band) return null;
  return <span className="text-[9px] text-gray-400 ml-0.5 font-normal">{band}</span>;
};

/**
 * TendencyStats component
 * @param {Object} props
 * @param {Object} props.stats - { vpip, pfr, af, threeBet, cbet, sampleSize, style }
 */
export const TendencyStats = ({ stats }) => {
  if (!stats || stats.sampleSize < MIN_DISPLAY_SAMPLE) return null;

  const { vpip, pfr, af, threeBet, cbet, sampleSize, style, intervals } = stats;

  return (
    <div className="flex items-center gap-2 text-xs mt-1">
      {/* Stat values — credible-interval suffix per FIND-001 / SPR-017 */}
      <span className="text-gray-500">
        <span className="font-medium text-gray-700">VPIP</span> {formatStat(vpip)}
        <BandSuffix interval={intervals?.vpip} sampleSize={sampleSize} />
      </span>
      <span className="text-gray-400">|</span>
      <span className="text-gray-500">
        <span className="font-medium text-gray-700">PFR</span> {formatStat(pfr)}
        <BandSuffix interval={intervals?.pfr} sampleSize={sampleSize} />
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
            <BandSuffix interval={intervals?.threeBet} sampleSize={sampleSize} />
          </span>
        </>
      )}
      {cbet !== null && (
        <>
          <span className="text-gray-400">|</span>
          <span className="text-gray-500">
            <span className="font-medium text-gray-700">CB</span> {formatStat(cbet)}
            <BandSuffix interval={intervals?.cbet} sampleSize={sampleSize} />
          </span>
        </>
      )}

      {/* Style badge */}
      {style && sampleSize >= MIN_STYLE_SAMPLE && (
        <span
          className="px-1.5 py-0.5 rounded text-xs font-medium"
          style={{
            backgroundColor: (STYLE_COLORS_LIGHT[style] || STYLE_COLORS_LIGHT.Unknown).bg,
            color: (STYLE_COLORS_LIGHT[style] || STYLE_COLORS_LIGHT.Unknown).text,
          }}
        >
          {style}
        </span>
      )}
    </div>
  );
};

export default TendencyStats;
