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
import { SURFACE, BORDER, TEXT, GOLD } from '../../../constants/designTokens';

const STYLE_DOTS = {
  Fish: '#dc2626', LAG: '#ea580c', TAG: '#2563eb',
  Nit: '#6b7280', LP: '#d97706', Reg: '#7c3aed',
  Unknown: '#374151',
};

export const CompactSeatStrip = ({ tendencyMap, selectedSeat, onSelectSeat, pinnedSeat, advisorSeat }) => (
  <div
    className="flex gap-[3px] px-2.5 py-1.5 border-b"
    style={{
      background: SURFACE.inset,
      borderBottomColor: BORDER.default,
    }}
  >
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
          className={`flex-1 flex flex-col items-center gap-0.5 px-0.5 py-1 rounded-[5px] cursor-pointer outline-none transition-all duration-150 relative border ${hasSample ? 'opacity-100' : 'opacity-[0.35]'}`}
          style={{
            background: isSelected ? SURFACE.elevated : 'transparent',
            borderColor: isSelected
              ? GOLD.base
              : isAdvisorTarget
                ? 'rgba(34,197,94,0.3)'
                : 'transparent',
          }}
        >
          {/* Style dot */}
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: STYLE_DOTS[style] || STYLE_DOTS.Unknown,
              boxShadow: isSelected ? `0 0 4px ${STYLE_DOTS[style]}` : 'none',
            }}
          />
          {/* Seat number */}
          <span
            className={`font-mono text-[9px] leading-none ${isSelected ? 'font-bold' : 'font-medium'}`}
            style={{ color: isSelected ? GOLD.base : TEXT.muted }}
          >
            {seat}
          </span>
          {/* Pin indicator */}
          {isPinnedSeat && (
            <div
              className="absolute top-px right-0.5 text-[6px] leading-none"
              style={{ color: GOLD.base }}
            >&#x1F4CC;</div>
          )}
        </button>
      );
    })}
  </div>
);
