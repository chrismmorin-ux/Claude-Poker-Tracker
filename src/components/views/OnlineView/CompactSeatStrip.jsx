/**
 * CompactSeatStrip.jsx — Horizontal row of 9 seat buttons
 *
 * Each button: seat number + style dot. Shows pin/advisor indicators:
 * - Gold border = selected (active analysis target)
 * - Pulsing ring = advisor is analyzing this seat (auto-follow target)
 * - Pin icon = user has manually pinned this seat
 */

import React from 'react';
import { SEAT_ARRAY } from '../../../constants/gameConstants';
import { SURFACE, BORDER, TEXT, GOLD, FONT, COLOR, R } from './panelTokens';

const STYLE_DOTS = {
  Fish: '#dc2626', LAG: '#ea580c', TAG: '#2563eb',
  Nit: '#6b7280', LP: '#d97706', Reg: '#7c3aed',
  Unknown: '#374151',
};

export const CompactSeatStrip = ({ tendencyMap, selectedSeat, onSelectSeat, pinnedSeat, advisorSeat }) => (
  <div style={{
    display: 'flex',
    gap: 3,
    padding: '6px 10px',
    background: SURFACE.inset,
    borderBottom: `1px solid ${BORDER.default}`,
  }}>
    {SEAT_ARRAY.map(seat => {
      const data = tendencyMap?.[String(seat)];
      const style = data?.style || 'Unknown';
      const isSelected = selectedSeat === seat;
      const isAdvisorTarget = advisorSeat === seat && !pinnedSeat;
      const isPinnedSeat = pinnedSeat === seat;
      const hasSample = (data?.sampleSize || 0) > 0;

      return (
        <button
          key={seat}
          onClick={() => onSelectSeat(seat)}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            padding: '4px 2px',
            background: isSelected ? SURFACE.elevated : 'transparent',
            border: isSelected
              ? `1px solid ${GOLD.base}`
              : isAdvisorTarget
                ? `1px solid rgba(34,197,94,0.3)`
                : '1px solid transparent',
            borderRadius: R.md,
            cursor: 'pointer',
            outline: 'none',
            transition: 'all 0.15s',
            opacity: hasSample ? 1 : 0.35,
            position: 'relative',
          }}
        >
          {/* Style dot */}
          <div style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: STYLE_DOTS[style] || STYLE_DOTS.Unknown,
            boxShadow: isSelected ? `0 0 4px ${STYLE_DOTS[style]}` : 'none',
          }} />
          {/* Seat number */}
          <span style={{
            fontFamily: FONT.mono,
            fontSize: 9,
            fontWeight: isSelected ? 700 : 500,
            color: isSelected ? GOLD.base : TEXT.muted,
            lineHeight: 1,
          }}>
            {seat}
          </span>
          {/* Pin indicator */}
          {isPinnedSeat && (
            <div style={{
              position: 'absolute', top: 1, right: 2,
              fontSize: 6, lineHeight: 1,
              color: GOLD.base,
            }}>&#x1F4CC;</div>
          )}
        </button>
      );
    })}
  </div>
);
