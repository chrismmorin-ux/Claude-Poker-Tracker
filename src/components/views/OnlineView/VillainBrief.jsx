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
import { SURFACE, BORDER, TEXT, FONT, GOLD, COLOR, R } from './panelTokens';
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
    <div style={{
      padding: '8px 14px',
      background: villainChanged ? 'rgba(212,168,71,0.08)' : 'transparent',
      borderBottom: `1px solid ${BORDER.default}`,
      transition: 'background 0.4s ease-out',
    }}>
      {/* Row 1: Identity + pin status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: headline ? 4 : 0,
      }}>
        {/* Seat number badge */}
        <div style={{
          fontFamily: FONT.mono,
          fontSize: 11,
          fontWeight: 700,
          color: GOLD.base,
          background: 'rgba(212,168,71,0.1)',
          padding: '2px 6px',
          borderRadius: 3,
          lineHeight: 1,
        }}>
          S{seat}
        </div>

        {/* Player name / seat label */}
        <span style={{
          fontFamily: FONT.display,
          fontSize: 12,
          fontWeight: 600,
          color: TEXT.primary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 140,
        }}>
          {displayName}
        </span>

        {/* Style badge */}
        <span style={{
          fontSize: 8,
          fontWeight: 700,
          padding: '1px 5px',
          borderRadius: 3,
          background: styleColor.bg,
          color: styleColor.text,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          lineHeight: 1.2,
        }}>
          {style || '?'}
        </span>

        {/* Sample size */}
        <span style={{
          fontFamily: FONT.mono,
          fontSize: 8,
          color: TEXT.faint,
          marginLeft: 'auto',
        }}>
          {sampleSize ? `${sampleSize}h` : '—'}
        </span>

        {/* Pin indicator / unpin button */}
        {isPinned && (
          <button
            onClick={onUnpin}
            title="Unpin — return to auto-follow"
            style={{
              background: 'rgba(212,168,71,0.15)',
              border: `1px solid ${GOLD.dim}`,
              borderRadius: 3,
              padding: '1px 5px',
              cursor: 'pointer',
              fontSize: 8,
              fontFamily: FONT.mono,
              color: GOLD.base,
              lineHeight: 1.2,
            }}
          >
            PINNED ✕
          </button>
        )}

        {/* Auto-follow indicator (when not pinned) */}
        {!isPinned && seatData && (
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: COLOR.green,
            boxShadow: '0 0 4px rgba(34,197,94,0.4)',
            flexShrink: 0,
          }}
            title="Auto-following current opponent"
          />
        )}
      </div>

      {/* Row 2: Behavioral headline */}
      {headline && (
        <div style={{
          fontSize: 11,
          fontStyle: 'italic',
          color: TEXT.secondary,
          lineHeight: 1.35,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {headline}
        </div>
      )}
    </div>
  );
};
