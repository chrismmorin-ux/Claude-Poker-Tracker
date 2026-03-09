import React from 'react';

const BUCKET_COLORS = {
  nuts: 'bg-red-600', strong: 'bg-orange-500', marginal: 'bg-yellow-400',
  draw: 'bg-blue-400', air: 'bg-gray-300',
};

const SIZE_CONFIG = {
  sm: { height: 'h-4', text: 'text-[8px]', threshold: 10 },
  md: { height: 'h-5', text: 'text-[9px]', threshold: 8 },
};

export const SegmentationBar = ({ buckets, size = 'md' }) => {
  if (!buckets) return null;
  const cfg = SIZE_CONFIG[size] || SIZE_CONFIG.md;
  return (
    <div className={`flex ${cfg.height} rounded overflow-hidden w-full`}>
      {['nuts', 'strong', 'marginal', 'draw', 'air'].map((b) => {
        const pct = buckets[b]?.pct || 0;
        if (pct < 1) return null;
        return (
          <div
            key={b}
            className={`${BUCKET_COLORS[b]} flex items-center justify-center ${cfg.text} font-bold text-white`}
            style={{ width: `${pct}%` }}
            title={`${b}: ${Math.round(pct)}%`}
          >
            {pct >= cfg.threshold ? `${Math.round(pct)}%` : ''}
          </div>
        );
      })}
    </div>
  );
};
