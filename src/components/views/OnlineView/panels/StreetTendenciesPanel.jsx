/**
 * StreetTendenciesPanel.jsx — Villain's per-street behavioral tendencies
 *
 * Shows preflop/flop/turn/river tendency with confidence dot,
 * deviation arrow, and aggression response. Extracted from VillainModelCard.
 */

import React from 'react';
import { BORDER, TEXT, GOLD } from '../../../../constants/designTokens';

const STREETS = ['preflop', 'flop', 'turn', 'river'];
const STREET_SHORT = { preflop: 'Pre', flop: 'Flop', turn: 'Turn', river: 'River' };

const GREEN = '#22c55e';   // green-500 — was COLOR.green
const YELLOW = '#eab308';  // yellow-500 — was COLOR.yellow
const RED = '#ef4444';     // red-500 — was RED

const SECTION_HEADER_CLASSES = "text-[9px] font-bold uppercase tracking-[0.8px] mb-1.5 pb-[3px] border-b";
const sectionHeaderStyle = { color: TEXT.muted, borderBottomColor: BORDER.default };

const confDotColor = (conf) => {
  if (conf >= 0.6) return GREEN;
  if (conf >= 0.3) return YELLOW;
  return TEXT.faint;
};

export const StreetTendenciesPanel = ({ villainProfile, currentStreet }) => {
  if (!villainProfile) return null;
  const { streets, aggressionResponse } = villainProfile;
  if (!streets) return null;

  return (
    <div className="mb-2.5">
      <div className={SECTION_HEADER_CLASSES} style={sectionHeaderStyle}>Villain Street Tendencies</div>

      {STREETS.map(s => {
        const st = streets[s];
        if (!st) return null;
        const isCurrent = s === currentStreet;

        return (
          <div
            key={s}
            className={`flex items-center gap-1.5 py-[3px] ${isCurrent ? 'opacity-100' : 'opacity-70'}`}
          >
            {/* Confidence dot */}
            <div
              className="w-[5px] h-[5px] rounded-full shrink-0"
              style={{ background: confDotColor(st.confidence) }}
            />

            {/* Street label */}
            <span
              className="font-mono text-[9px] font-semibold w-8 shrink-0"
              style={{ color: isCurrent ? GOLD.base : TEXT.muted }}
            >
              {STREET_SHORT[s]}
            </span>

            {/* Tendency text */}
            <span
              className={`text-[10px] flex-1 ${isCurrent ? 'font-semibold' : 'font-normal'}`}
              style={{ color: isCurrent ? TEXT.primary : TEXT.secondary }}
            >
              {st.tendency}
            </span>

            {/* Deviation arrow */}
            {st.deviation && st.deviation.direction !== 'neutral' && (
              <span
                className="font-mono text-[9px] font-bold shrink-0"
                style={{ color: st.deviation.direction === 'aggressive' ? RED : '#3b82f6' }}
              >
                {st.deviation.direction === 'aggressive' ? '▲' : '▼'}
                {Math.abs(Math.round(st.deviation.vsPopulation * 100))}%
              </span>
            )}

            {/* Confidence % */}
            <span
              className="font-mono text-[7px] w-6 text-right shrink-0"
              style={{ color: TEXT.faint }}
            >
              {Math.round((st.confidence || 0) * 100)}%
            </span>
          </div>
        );
      })}

      {/* Aggression response */}
      {aggressionResponse && (
        <div
          className="mt-1.5 pt-[5px] border-t flex gap-3.5 text-[9px]"
          style={{ borderTopColor: BORDER.default, color: TEXT.muted }}
        >
          <div>
            <span style={{ color: TEXT.faint }}>Facing bet: </span>
            <span className="font-semibold" style={{ color: TEXT.primary }}>
              {aggressionResponse.facingBet?.summary}
            </span>
            {aggressionResponse.facingBet?.foldPct != null && (
              <span style={{ color: TEXT.faint }}>
                {' '}({Math.round(aggressionResponse.facingBet.foldPct * 100)}% fold)
              </span>
            )}
          </div>
          <div>
            <span style={{ color: TEXT.faint }}>Facing raise: </span>
            <span className="font-semibold" style={{ color: TEXT.primary }}>
              {aggressionResponse.facingRaise?.summary}
            </span>
            {aggressionResponse.facingRaise?.foldPct != null && (
              <span style={{ color: TEXT.faint }}>
                {' '}({Math.round(aggressionResponse.facingRaise.foldPct * 100)}% fold)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
