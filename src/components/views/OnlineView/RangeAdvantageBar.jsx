/**
 * RangeAdvantageBar.jsx — Visual range + nut advantage indicator
 *
 * Shows hero vs villain range advantage as a dual gradient bar.
 * Data from treeMetadata.advantage: { rangeAdvantage, nutAdvantage, polarization, mergedness }
 */

import React from 'react';
import { SURFACE, BORDER, TEXT, FONT, COLOR, GOLD, R } from './panelTokens';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const RangeAdvantageBar = ({ advantage }) => {
  if (!advantage) return null;

  const { rangeAdvantage = 0, nutAdvantage = 0 } = advantage;

  // Skip if both near zero (no meaningful advantage either way)
  if (Math.abs(rangeAdvantage) < 0.05 && Math.abs(nutAdvantage) < 0.05) return null;

  // Convert [-1, 1] to a visual position [0%, 100%] where 50% = neutral
  const rangePos = clamp(50 + rangeAdvantage * 50, 5, 95);
  const nutPos = clamp(50 + nutAdvantage * 50, 5, 95);

  const rangeLabel = rangeAdvantage > 0.1 ? 'Hero range advantage'
    : rangeAdvantage < -0.1 ? 'Villain range advantage'
    : 'Neutral range';
  const nutLabel = nutAdvantage > 0.15 ? 'Hero nut advantage'
    : nutAdvantage < -0.15 ? 'Villain nut advantage'
    : null;

  return (
    <div style={{
      marginBottom: 6,
      padding: '6px 8px',
      background: SURFACE.card,
      borderRadius: R.md,
      border: `1px solid ${BORDER.default}`,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 4,
      }}>
        <span style={{ fontSize: 8, fontWeight: 600, color: TEXT.faint, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Range Advantage
        </span>
        <span style={{
          fontFamily: FONT.mono, fontSize: 9, fontWeight: 600,
          color: rangeAdvantage > 0.1 ? COLOR.green : rangeAdvantage < -0.1 ? COLOR.red : TEXT.muted,
        }}>
          {rangeAdvantage > 0 ? '+' : ''}{Math.round(rangeAdvantage * 100)}%
        </span>
      </div>

      {/* Range advantage bar */}
      <div style={{
        height: 6, borderRadius: 3, overflow: 'hidden',
        background: `linear-gradient(90deg, ${COLOR.red}33 0%, ${BORDER.default} 50%, ${COLOR.green}33 100%)`,
        position: 'relative',
        marginBottom: 4,
      }}>
        <div style={{
          position: 'absolute',
          left: `${rangePos}%`,
          top: 0,
          width: 3,
          height: 6,
          background: rangeAdvantage >= 0 ? COLOR.green : COLOR.red,
          borderRadius: 1,
          transform: 'translateX(-50%)',
          boxShadow: `0 0 4px ${rangeAdvantage >= 0 ? COLOR.green : COLOR.red}80`,
        }} />
      </div>

      {/* Labels */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 7, color: TEXT.faint,
      }}>
        <span>Villain</span>
        <span>{rangeLabel}</span>
        <span>Hero</span>
      </div>

      {/* Nut advantage (if significant) */}
      {nutLabel && (
        <div style={{
          marginTop: 4,
          fontSize: 8,
          fontFamily: FONT.mono,
          color: nutAdvantage > 0 ? COLOR.green : COLOR.red,
          opacity: 0.8,
        }}>
          {nutLabel} ({nutAdvantage > 0 ? '+' : ''}{Math.round(nutAdvantage * 100)}%)
        </div>
      )}
    </div>
  );
};
