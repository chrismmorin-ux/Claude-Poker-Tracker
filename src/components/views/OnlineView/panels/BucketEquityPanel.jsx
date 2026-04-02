/**
 * BucketEquityPanel.jsx — Hero equity vs each villain range bucket
 *
 * Shows 5 horizontal bars (Nuts → Air) with hero's equity percentage
 * against villain hands in each bucket. A 50% midline marker helps
 * the user see where they're ahead vs behind.
 */

import React from 'react';
import { SURFACE, BORDER, TEXT, FONT, BUCKET, R } from '../panelTokens';

const BUCKET_META = [
  { key: 'nuts',     label: 'Nuts',     color: BUCKET.nuts },
  { key: 'strong',   label: 'Strong',   color: BUCKET.strong },
  { key: 'marginal', label: 'Marginal', color: BUCKET.marginal },
  { key: 'draw',     label: 'Draw',     color: BUCKET.draw },
  { key: 'air',      label: 'Air',      color: BUCKET.air },
];

export const BucketEquityPanel = ({ bucketEquities, segmentation }) => {
  if (!bucketEquities) return null;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={sectionHeader}>Bucket Equity vs Villain Range</div>

      {BUCKET_META.map(({ key, label, color }) => {
        const eq = bucketEquities[key];
        if (eq == null) return null;
        const pct = Math.round(eq * 100);
        const rangePct = segmentation?.buckets?.[key]?.pct;

        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            {/* Label */}
            <span style={{
              fontFamily: FONT.mono, fontSize: 9, color: TEXT.secondary,
              width: 52, textAlign: 'right', flexShrink: 0,
            }}>
              {label}
              {rangePct != null && (
                <span style={{ color: TEXT.faint, fontSize: 7 }}> {Math.round(rangePct)}%</span>
              )}
            </span>

            {/* Bar */}
            <div style={{
              flex: 1, height: 10, borderRadius: 3, overflow: 'hidden',
              background: SURFACE.inset, position: 'relative',
            }}>
              {/* Fill */}
              <div style={{
                width: `${pct}%`, height: '100%', borderRadius: 3,
                background: `linear-gradient(90deg, ${color}99, ${color})`,
                transition: 'width 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              }} />
              {/* 50% midline */}
              <div style={{
                position: 'absolute', left: '50%', top: 0, width: 1, height: '100%',
                background: TEXT.faint, opacity: 0.3,
              }} />
            </div>

            {/* Percentage */}
            <span style={{
              fontFamily: FONT.mono, fontSize: 10, fontWeight: 600,
              color: pct >= 50 ? '#4ade80' : '#f87171',
              width: 32, textAlign: 'right', flexShrink: 0,
            }}>
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
};

const sectionHeader = {
  fontSize: 9, fontWeight: 700, color: TEXT.muted,
  textTransform: 'uppercase', letterSpacing: 0.8,
  marginBottom: 6, paddingBottom: 3,
  borderBottom: `1px solid ${BORDER.default}`,
};
