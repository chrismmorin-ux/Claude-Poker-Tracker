/**
 * FlopBreakdownPanel.jsx — Preflop flop-conditional EV breakdown
 *
 * When on preflop, shows the stratified flop archetype analysis:
 * set, overpair, top_pair, second_pair, flush_draw, overcards, miss
 * with probability and EV for each.
 */

import React from 'react';
import { SURFACE, BORDER, TEXT } from '../../../../constants/designTokens';

const ARCHETYPE_LABELS = {
  set: 'Set', overpair: 'Overpair', top_pair: 'Top Pair',
  second_pair: 'Second Pair', flush_draw: 'Flush Draw',
  overcards: 'Overcards', miss: 'Miss',
};

const GREEN = '#22c55e';   // green-500 — was COLOR.green
const RED = '#ef4444';     // red-500 — was COLOR.red

const ARCHETYPE_COLORS = {
  set: GREEN, overpair: GREEN, top_pair: '#60a5fa',
  second_pair: '#eab308', flush_draw: '#22d3ee',
  overcards: '#f97316', miss: RED,
};

export const FlopBreakdownPanel = ({ flopBreakdown }) => {
  if (!flopBreakdown || flopBreakdown.length === 0) return null;

  return (
    <div className="mb-2.5">
      <div
        className="text-[9px] font-bold uppercase tracking-[0.8px] mb-1.5 pb-[3px] border-b"
        style={{ color: TEXT.muted, borderBottomColor: BORDER.default }}
      >
        Flop Archetype Breakdown
      </div>

      {flopBreakdown.map((arch, i) => {
        const label = ARCHETYPE_LABELS[arch.archetype] || arch.archetype;
        const color = ARCHETYPE_COLORS[arch.archetype] || TEXT.muted;
        const probPct = Math.round((arch.probability || 0) * 100);
        const ev = arch.ev;
        const isPositive = ev != null && ev >= 0;

        return (
          <div key={arch.archetype || i} className="flex items-center gap-1.5 py-[3px]">
            {/* Probability bar */}
            <div
              className="w-10 h-1.5 rounded-[3px] overflow-hidden shrink-0"
              style={{ background: SURFACE.inset }}
            >
              <div
                className="h-full rounded-[3px]"
                style={{ width: `${probPct}%`, background: color, transition: 'width 0.5s ease' }}
              />
            </div>

            {/* Probability % */}
            <span
              className="font-mono text-[9px] w-7 text-right shrink-0"
              style={{ color: TEXT.muted }}
            >
              {probPct}%
            </span>

            {/* Label */}
            <span className="text-[10px] flex-1" style={{ color: TEXT.secondary }}>
              {label}
            </span>

            {/* EV */}
            {ev != null && (
              <span
                className="font-mono text-[9px] font-semibold shrink-0"
                style={{ color: isPositive ? GREEN : RED }}
              >
                {isPositive ? '+' : ''}{ev.toFixed(2)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

