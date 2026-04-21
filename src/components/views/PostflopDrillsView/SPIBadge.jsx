/**
 * SPIBadge — compact Study Priority Index pill shown on line cards.
 *
 * Visual: 5-bar fuel gauge + numeric score. Tier based on score magnitude
 * calibrated to the current catalog; re-tune as more lines are added.
 *
 * Expected score ranges (v1 catalog, 2 lines):
 *   < 50:    tier 1 (faint)
 *   50–120:  tier 2
 *   120–220: tier 3
 *   220–320: tier 4
 *   > 320:   tier 5 (full)
 */

import React from 'react';

const TIER_THRESHOLDS = [50, 120, 220, 320];

const tierFor = (score) => {
  let t = 1;
  for (const threshold of TIER_THRESHOLDS) {
    if (score >= threshold) t++;
  }
  return t; // 1..5
};

export const SPIBadge = ({ score, compact = false }) => {
  const tier = tierFor(score);
  const bars = Array.from({ length: 5 }, (_, i) => i < tier);

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-900/70 border border-gray-700 ${
        compact ? 'text-[10px]' : 'text-xs'
      }`}
    >
      <span className="flex items-center gap-0.5">
        {bars.map((on, i) => (
          <span
            key={i}
            className={`inline-block rounded-sm ${compact ? 'w-[3px] h-2' : 'w-[4px] h-2.5'} ${
              on ? 'bg-teal-400' : 'bg-gray-700'
            }`}
          />
        ))}
      </span>
      <span className="text-gray-200 font-mono text-[11px] tabular-nums">
        {Math.round(score)}
      </span>
      <span className="uppercase text-[9px] text-gray-500 tracking-wide">SPI</span>
    </div>
  );
};
