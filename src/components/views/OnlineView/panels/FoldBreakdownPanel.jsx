/**
 * FoldBreakdownPanel.jsx — Base fold% + 8 adjustment factor pills
 *
 * Shows how the final fold% was computed: base estimate + each factor's
 * contribution (aggression, VPIP, position, IP, advantage, blockers, sizing).
 */

import React from 'react';
import { SURFACE, BORDER, TEXT, FONT, COLOR, GOLD, R } from '../panelTokens';

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
    <div style={{ marginBottom: 10 }}>
      <div style={{
        ...sectionHeader,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>Fold% Breakdown</span>
        <span style={{
          fontFamily: FONT.mono, fontSize: 11, fontWeight: 700,
          color: TEXT.primary,
        }}>
          {finalPct}%
        </span>
      </div>

      {/* Base estimate */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 6, fontSize: 10,
      }}>
        <span style={{ color: TEXT.muted }}>Base estimate:</span>
        <span style={{ fontFamily: FONT.mono, fontWeight: 600, color: TEXT.primary }}>
          {basePct}%
        </span>
        <span style={{
          fontSize: 7, padding: '1px 4px', borderRadius: 2,
          background: source.includes('model') ? 'rgba(34,197,94,0.15)' : '#374151',
          color: source.includes('model') ? COLOR.green : TEXT.faint,
        }}>
          {source}
        </span>
      </div>

      {/* Adjustment factor pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {adjustments.map((adj, i) => {
          const delta = factorDelta(adj.multiplier);
          if (delta == null) return null;
          const isPositive = delta > 0;

          return (
            <div key={adj.factor || i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 6px', borderRadius: 3,
              background: isPositive ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${isPositive ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
              fontSize: 8, fontFamily: FONT.mono,
            }}>
              <span style={{ color: TEXT.secondary, fontFamily: FONT.display }}>
                {FACTOR_LABELS[adj.factor] || adj.factor}
              </span>
              <span style={{
                fontWeight: 700,
                color: isPositive ? COLOR.green : COLOR.red,
              }}>
                {isPositive ? '+' : ''}{delta}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Total shift */}
      {totalShift != null && Math.abs(totalShift) > 0 && (
        <div style={{
          marginTop: 4, fontSize: 8, fontFamily: FONT.mono,
          color: totalShift > 0 ? COLOR.green : COLOR.red,
        }}>
          Net shift: {totalShift > 0 ? '+' : ''}{Math.round(totalShift)}% from base
        </div>
      )}
    </div>
  );
};

const sectionHeader = {
  fontSize: 9, fontWeight: 700, color: TEXT.muted,
  textTransform: 'uppercase', letterSpacing: 0.8,
  marginBottom: 6, paddingBottom: 3,
  borderBottom: `1px solid ${BORDER.default}`,
};
