/**
 * VillainBrief.jsx — Villain identity bar (always visible when a seat is active)
 *
 * Anchors the user's attention: WHO is this analysis about?
 * Shows seat number, player name (if available), style badge, sample size,
 * pin status, and behavioral headline.
 *
 * Flashes briefly when the auto-follow switches to a different villain,
 * so the user notices the context change.
 */

import React from 'react';
import { BORDER, TEXT, GOLD } from '../../../constants/designTokens';
import { STYLE_COLORS } from './onlineConstants';

export const VillainBrief = ({
  seat,
  seatData,
  villainName,
  style,
  sampleSize,
  isPinned,
  onUnpin,
  villainChanged,
  headline,
}) => {
  const styleColor = STYLE_COLORS[style] || STYLE_COLORS.Unknown;
  const displayName = villainName || `Seat ${seat}`;

  return (
    <div
      className="px-3.5 py-2 transition-[background] duration-[400ms] ease-out border-b"
      style={{
        background: villainChanged ? 'rgba(212,168,71,0.08)' : 'transparent',
        borderBottomColor: BORDER.default,
      }}
    >
      {/* Row 1: Identity + pin status */}
      <div className={`flex items-center gap-1.5 ${headline ? 'mb-1' : ''}`}>
        {/* Seat number badge */}
        <div
          className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-[3px] leading-none"
          style={{
            color: GOLD.base,
            background: 'rgba(212,168,71,0.1)',
          }}
        >
          S{seat}
        </div>

        {/* Player name / seat label */}
        <span
          className="font-display text-xs font-semibold overflow-hidden whitespace-nowrap max-w-[140px] text-ellipsis"
          style={{ color: TEXT.primary }}
        >
          {displayName}
        </span>

        {/* Style badge */}
        <span
          className="text-[8px] font-bold px-1 py-px rounded-[3px] uppercase tracking-[0.5px] leading-tight"
          style={{ background: styleColor.bg, color: styleColor.text }}
        >
          {style || '?'}
        </span>

        {/* Sample size */}
        <span
          className="font-mono text-[8px] ml-auto"
          style={{ color: TEXT.faint }}
        >
          {sampleSize ? `${sampleSize}h` : '—'}
        </span>

        {/* Pin indicator / unpin button */}
        {isPinned && (
          <button
            onClick={onUnpin}
            title="Unpin — return to auto-follow"
            className="rounded-[3px] px-1 py-px cursor-pointer text-[8px] font-mono leading-tight border"
            style={{
              background: 'rgba(212,168,71,0.15)',
              borderColor: GOLD.dim,
              color: GOLD.base,
            }}
          >
            PINNED ✕
          </button>
        )}

        {/* Auto-follow indicator (when not pinned) */}
        {!isPinned && seatData && (
          <div
            className="w-[5px] h-[5px] rounded-full bg-green-500 shrink-0"
            style={{ boxShadow: '0 0 4px rgba(34,197,94,0.4)' }}
            title="Auto-following current opponent"
          />
        )}
      </div>

      {/* Row 2: Behavioral headline */}
      {headline && (
        <div
          className="text-[11px] italic leading-snug overflow-hidden line-clamp-2"
          style={{ color: TEXT.secondary }}
        >
          {headline}
        </div>
      )}
    </div>
  );
};
