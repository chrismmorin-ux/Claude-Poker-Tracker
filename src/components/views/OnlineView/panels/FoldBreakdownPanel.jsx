/**
 * FoldBreakdownPanel.jsx — Base fold% + 8 adjustment factor pills
 *
 * Shows how the final fold% was computed: base estimate + each factor's
 * contribution (aggression, VPIP, position, IP, advantage, blockers, sizing).
 */

import React from 'react';
import { BORDER, TEXT } from '../../../../constants/designTokens';

const GREEN = '#22c55e'; // green-500 — was GREEN
const RED = '#ef4444';   // red-500 — was RED

const SECTION_HEADER_CLASSES = "text-[9px] font-bold uppercase tracking-[0.8px] mb-1.5 pb-[3px] border-b";

const FACTOR_LABELS = {
  af: 'Aggression',
  vpip: 'VPIP',
  position: 'Position',
  ip: 'IP/OOP',
  advantage: 'Range Adv.',
  blockers: 'Blockers',
  sizing: 'Sizing Tells',
  spr: 'SPR Zone',
};

const factorDelta = (multiplier) => {
  if (multiplier == null || multiplier === 1) return null;
  const pct = Math.round((multiplier - 1) * 100);
  if (pct === 0) return null;
  return pct;
};

export const FoldBreakdownPanel = ({ foldMeta }) => {
  const betMeta = foldMeta?.bet;
  if (!betMeta || betMeta.baseEstimate == null) return null;

  const basePct = Math.round(betMeta.baseEstimate * 100);
  const adjustments = betMeta.adjustments || [];
  const totalShift = betMeta.totalShiftPct;
  const finalPct = Math.round((betMeta.baseEstimate * (1 + (totalShift || 0) / 100)) * 100);
  const source = betMeta.source || 'population';

  return (
    <div className="mb-2.5">
      <div
        className={`${SECTION_HEADER_CLASSES} flex justify-between items-center`}
        style={{ color: TEXT.muted, borderBottomColor: BORDER.default }}
      >
        <span>Fold% Breakdown</span>
        <span
          className="font-mono text-[11px] font-bold"
          style={{ color: TEXT.primary }}
        >
          {finalPct}%
        </span>
      </div>

      {/* Base estimate */}
      <div className="flex items-center gap-1.5 mb-1.5 text-[10px]">
        <span style={{ color: TEXT.muted }}>Base estimate:</span>
        <span className="font-mono font-semibold" style={{ color: TEXT.primary }}>
          {basePct}%
        </span>
        <span
          className="text-[7px] px-1 py-px rounded-sm"
          style={{
            background: source.includes('model') ? 'rgba(34,197,94,0.15)' : '#374151',
            color: source.includes('model') ? GREEN : TEXT.faint,
          }}
        >
          {source}
        </span>
      </div>

      {/* Adjustment factor pills */}
      <div className="flex flex-wrap gap-1">
        {adjustments.map((adj, i) => {
          const delta = factorDelta(adj.multiplier);
          if (delta == null) return null;
          const isPositive = delta > 0;

          return (
            <div
              key={adj.factor || i}
              className="font-mono inline-flex items-center gap-[3px] px-1.5 py-0.5 rounded-[3px] text-[8px]"
              style={{
                background: isPositive ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${isPositive ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
              }}
            >
              <span className="font-display" style={{ color: TEXT.secondary }}>
                {FACTOR_LABELS[adj.factor] || adj.factor}
              </span>
              <span
                className="font-bold"
                style={{ color: isPositive ? GREEN : RED }}
              >
                {isPositive ? '+' : ''}{delta}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Total shift */}
      {totalShift != null && Math.abs(totalShift) > 0 && (
        <div
          className="mt-1 text-[8px] font-mono"
          style={{ color: totalShift > 0 ? GREEN : RED }}
        >
          Net shift: {totalShift > 0 ? '+' : ''}{Math.round(totalShift)}% from base
        </div>
      )}
    </div>
  );
};
