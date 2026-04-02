/**
 * FlopBreakdownPanel.jsx — Preflop flop-conditional EV breakdown
 *
 * When on preflop, shows the stratified flop archetype analysis:
 * set, overpair, top_pair, second_pair, flush_draw, overcards, miss
 * with probability and EV for each.
 */

import React from 'react';
import { SURFACE, BORDER, TEXT, FONT, COLOR, R } from '../panelTokens';

const ARCHETYPE_LABELS = {
  set: 'Set', overpair: 'Overpair', top_pair: 'Top Pair',
  second_pair: 'Second Pair', flush_draw: 'Flush Draw',
  overcards: 'Overcards', miss: 'Miss',
};

const ARCHETYPE_COLORS = {
  set: COLOR.green, overpair: COLOR.green, top_pair: '#60a5fa',
  second_pair: COLOR.yellow, flush_draw: COLOR.cyan,
  overcards: COLOR.orange, miss: COLOR.red,
};

export const FlopBreakdownPanel = ({ flopBreakdown }) => {
  if (!flopBreakdown || flopBreakdown.length === 0) return null;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={sectionHeader}>Flop Archetype Breakdown</div>

      {flopBreakdown.map((arch, i) => {
        const label = ARCHETYPE_LABELS[arch.archetype] || arch.archetype;
        const color = ARCHETYPE_COLORS[arch.archetype] || TEXT.muted;
        const probPct = Math.round((arch.probability || 0) * 100);
        const ev = arch.ev;
        const isPositive = ev != null && ev >= 0;

        return (
          <div key={arch.archetype || i} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '3px 0',
          }}>
            {/* Probability bar */}
            <div style={{
              width: 40, height: 6, borderRadius: 3, overflow: 'hidden',
              background: SURFACE.inset, flexShrink: 0,
            }}>
              <div style={{
                width: `${probPct}%`, height: '100%', borderRadius: 3,
                background: color,
                transition: 'width 0.5s ease',
              }} />
            </div>

            {/* Probability % */}
            <span style={{
              fontFamily: FONT.mono, fontSize: 9, color: TEXT.muted,
              width: 28, textAlign: 'right', flexShrink: 0,
            }}>
              {probPct}%
            </span>

            {/* Label */}
            <span style={{
              fontSize: 10, color: TEXT.secondary, flex: 1,
            }}>
              {label}
            </span>

            {/* EV */}
            {ev != null && (
              <span style={{
                fontFamily: FONT.mono, fontSize: 9, fontWeight: 600,
                color: isPositive ? COLOR.green : COLOR.red,
                flexShrink: 0,
              }}>
                {isPositive ? '+' : ''}{ev.toFixed(2)}
              </span>
            )}
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
