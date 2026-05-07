/**
 * BoardTexturePills.jsx — Board texture classification badges
 *
 * Shows texture (wet/dry/medium), paired, flush draw, monotone as colored pills.
 */

import React from 'react';

const PILL_STYLES = {
  wet:       { bg: '#1e3a5f', color: '#60a5fa' },
  dry:       { bg: '#3b2f1a', color: '#d4a847' },
  medium:    { bg: '#1a2e2e', color: '#6ee7b7' },
  paired:    { bg: '#3b2a1a', color: '#fb923c' },
  flushDraw: { bg: '#1a2e3b', color: '#67e8f9' },
  monotone:  { bg: '#1a1a3b', color: '#a78bfa' },
};

export const BoardTexturePills = ({ boardTexture }) => {
  if (!boardTexture) return null;

  const pills = [
    { key: 'texture', show: true, label: boardTexture.texture },
    { key: 'paired', show: boardTexture.isPaired, label: 'paired' },
    { key: 'flushDraw', show: boardTexture.flushDraw, label: 'flush draw' },
    { key: 'monotone', show: boardTexture.monotone, label: 'monotone' },
  ].filter(p => p.show);

  if (pills.length === 0) return null;

  return (
    <div className="flex gap-1 mb-1.5 flex-wrap">
      {pills.map(p => {
        const style = PILL_STYLES[p.key] || PILL_STYLES.medium;
        return (
          <span
            key={p.key}
            className="text-[9px] px-1.5 py-0.5 rounded-[3px] font-bold tracking-[0.3px]"
            style={{ background: style.bg, color: style.color }}
          >
            {p.label}
          </span>
        );
      })}
    </div>
  );
};
