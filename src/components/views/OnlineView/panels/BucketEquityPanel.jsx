/**
 * BucketEquityPanel.jsx — Hero equity vs each villain range bucket
 *
 * Shows 5 horizontal bars (Nuts → Air) with hero's equity percentage
 * against villain hands in each bucket. A 50% midline marker helps
 * the user see where they're ahead vs behind.
 */

import React from 'react';
import { SURFACE, BORDER, TEXT, BUCKET_COLORS } from '../../../../constants/designTokens';

const BUCKET_META = [
  { key: 'nuts',     label: 'Nuts',     color: BUCKET_COLORS.nuts },
  { key: 'strong',   label: 'Strong',   color: BUCKET_COLORS.strong },
  { key: 'marginal', label: 'Marginal', color: BUCKET_COLORS.marginal },
  { key: 'draw',     label: 'Draw',     color: BUCKET_COLORS.draw },
  { key: 'air',      label: 'Air',      color: BUCKET_COLORS.air },
];

export const BucketEquityPanel = ({ bucketEquities, segmentation }) => {
  if (!bucketEquities) return null;

  return (
    <div className="mb-2.5">
      <div
        className="text-[9px] font-bold uppercase tracking-[0.8px] mb-1.5 pb-[3px] border-b"
        style={{ color: TEXT.muted, borderBottomColor: BORDER.default }}
      >
        Bucket Equity vs Villain Range
      </div>

      {BUCKET_META.map(({ key, label, color }) => {
        const eq = bucketEquities[key];
        if (eq == null) return null;
        const pct = Math.round(eq * 100);
        const rangePct = segmentation?.buckets?.[key]?.pct;

        return (
          <div key={key} className="flex items-center gap-1.5 mb-1">
            {/* Label */}
            <span
              className="font-mono text-[9px] w-[52px] text-right shrink-0"
              style={{ color: TEXT.secondary }}
            >
              {label}
              {rangePct != null && (
                <span className="text-[7px]" style={{ color: TEXT.faint }}> {Math.round(rangePct)}%</span>
              )}
            </span>

            {/* Bar */}
            <div
              className="flex-1 h-2.5 rounded-[3px] overflow-hidden relative"
              style={{ background: SURFACE.inset }}
            >
              {/* Fill */}
              <div
                className="h-full rounded-[3px]"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${color}99, ${color})`,
                  transition: 'width 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                }}
              />
              {/* 50% midline */}
              <div
                className="absolute left-1/2 top-0 w-px h-full opacity-30"
                style={{ background: TEXT.faint }}
              />
            </div>

            {/* Percentage */}
            <span
              className="font-mono text-[10px] font-semibold w-8 text-right shrink-0"
              style={{ color: pct >= 50 ? '#4ade80' : '#f87171' }}
            >
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
};
