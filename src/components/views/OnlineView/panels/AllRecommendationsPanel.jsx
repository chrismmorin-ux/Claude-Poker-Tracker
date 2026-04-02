/**
 * AllRecommendationsPanel.jsx — Ranked list of all hero action recommendations
 *
 * Shows each recommendation with action badge, sizing, EV, fold%,
 * villain response, and reasoning. Top rec is highlighted.
 */

import React, { useState } from 'react';
import { SURFACE, BORDER, TEXT, FONT, ACTION, EV, R } from '../panelTokens';

const actionStyle = (action) => ACTION[action?.toLowerCase()] || ACTION.check;

export const AllRecommendationsPanel = ({ recommendations, heroEquity }) => {
  const [expandedIdx, setExpandedIdx] = useState(null);
  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={sectionHeader}>All Recommendations</div>

      {recommendations.map((rec, i) => {
        const aStyle = actionStyle(rec.action);
        const isTop = i === 0;
        const isPositive = rec.ev > 0;
        const evColor = isPositive ? EV.pos : rec.ev === 0 ? TEXT.muted : EV.neg;
        const evBg = isPositive ? EV.posBg : rec.ev === 0 ? '#374151' : EV.negBg;
        const isExpanded = expandedIdx === i;
        const vr = rec.villainResponse;

        return (
          <div
            key={i}
            onClick={() => setExpandedIdx(isExpanded ? null : i)}
            style={{
              padding: '6px 8px',
              marginBottom: 3,
              borderRadius: R.md,
              background: isTop ? SURFACE.inset : 'transparent',
              borderLeft: `3px solid ${aStyle.bg}`,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {/* Main row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Rank */}
              <span style={{
                fontFamily: FONT.mono, fontSize: 9, fontWeight: 700,
                color: isTop ? '#d4a847' : TEXT.faint, width: 12, flexShrink: 0,
              }}>
                #{i + 1}
              </span>

              {/* Action badge */}
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                padding: '2px 6px', borderRadius: 3,
                background: aStyle.bg, color: aStyle.text,
                letterSpacing: 0.3,
              }}>
                {rec.action}
              </span>

              {/* Sizing */}
              {rec.sizing && (
                <span style={{ fontFamily: FONT.mono, fontSize: 9, color: TEXT.secondary }}>
                  {Math.round(rec.sizing.betFraction * 100)}%
                  <span style={{ color: TEXT.faint }}> ${rec.sizing.betSize?.toFixed(0)}</span>
                </span>
              )}

              {/* Fold% */}
              {rec.sizing?.foldPct != null && (
                <span style={{ fontFamily: FONT.mono, fontSize: 8, color: TEXT.faint }}>
                  F:{Math.round(rec.sizing.foldPct * 100)}%
                </span>
              )}

              {/* Mix badge */}
              {rec.mixFrequency && (
                <span style={{
                  fontSize: 7, fontWeight: 700, padding: '1px 4px', borderRadius: 2,
                  background: '#92400e', color: '#fbbf24',
                }}>MIX {Math.round(rec.mixFrequency * 100)}%</span>
              )}

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* EV */}
              <span style={{
                fontFamily: FONT.mono, fontSize: 11, fontWeight: 700,
                padding: '1px 6px', borderRadius: 3,
                background: evBg, color: evColor,
              }}>
                {rec.ev >= 0 ? '+' : ''}{rec.ev.toFixed(1)}
              </span>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div style={{ marginTop: 5, paddingTop: 4, borderTop: `1px solid ${BORDER.default}` }}>
                {/* Villain response */}
                {vr && (
                  <div style={{
                    fontFamily: FONT.mono, fontSize: 8, color: TEXT.muted,
                    marginBottom: 3, display: 'flex', gap: 8,
                  }}>
                    {vr.foldPct != null && <span>Fold: {Math.round(vr.foldPct * 100)}%</span>}
                    {vr.callPct != null && <span>Call: {Math.round(vr.callPct * 100)}%</span>}
                    {vr.raisePct != null && <span>Raise: {Math.round(vr.raisePct * 100)}%</span>}
                  </div>
                )}
                {/* Reasoning */}
                {rec.reasoning && (
                  <div style={{
                    fontSize: 9, fontStyle: 'italic', color: TEXT.muted,
                    lineHeight: 1.35,
                  }}>
                    {rec.reasoning}
                  </div>
                )}
              </div>
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
