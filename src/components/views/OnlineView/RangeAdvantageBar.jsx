/**
 * RangeAdvantageBar.jsx — Visual range + nut advantage indicator
 *
 * Shows hero vs villain range advantage as a dual gradient bar.
 * Data from treeMetadata.advantage: { rangeAdvantage, nutAdvantage, polarization, mergedness }
 */

import React from 'react';
import { SURFACE, BORDER, TEXT } from '../../../constants/designTokens';

const GREEN = '#22c55e'; // green-500 — was COLOR.green
const RED = '#ef4444';   // red-500 — was COLOR.red

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
    <div
      className="mb-1.5 px-2 py-1.5 rounded-[5px] border"
      style={{
        background: SURFACE.card,
        borderColor: BORDER.default,
      }}
    >
      <div className="flex justify-between items-center mb-1">
        <span
          className="text-[8px] font-semibold uppercase tracking-[0.5px]"
          style={{ color: TEXT.faint }}
        >
          Range Advantage
        </span>
        <span
          className="font-mono text-[9px] font-semibold"
          style={{
            color: rangeAdvantage > 0.1 ? GREEN : rangeAdvantage < -0.1 ? RED : TEXT.muted,
          }}
        >
          {rangeAdvantage > 0 ? '+' : ''}{Math.round(rangeAdvantage * 100)}%
        </span>
      </div>

      {/* Range advantage bar */}
      <div
        className="h-1.5 rounded-[3px] overflow-hidden relative mb-1"
        style={{
          background: `linear-gradient(90deg, ${RED}33 0%, ${BORDER.default} 50%, ${GREEN}33 100%)`,
        }}
      >
        <div
          className="absolute top-0 w-[3px] h-1.5 rounded-[1px] -translate-x-1/2"
          style={{
            left: `${rangePos}%`,
            background: rangeAdvantage >= 0 ? GREEN : RED,
            boxShadow: `0 0 4px ${rangeAdvantage >= 0 ? GREEN : RED}80`,
          }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[7px]" style={{ color: TEXT.faint }}>
        <span>Villain</span>
        <span>{rangeLabel}</span>
        <span>Hero</span>
      </div>

      {/* Nut advantage (if significant) */}
      {nutLabel && (
        <div
          className="mt-1 text-[8px] font-mono opacity-80"
          style={{ color: nutAdvantage > 0 ? GREEN : RED }}
        >
          {nutLabel} ({nutAdvantage > 0 ? '+' : ''}{Math.round(nutAdvantage * 100)}%)
        </div>
      )}
    </div>
  );
};
