/**
 * AllRecommendationsPanel.jsx — Ranked list of all hero action recommendations
 *
 * Shows each recommendation with action badge, sizing, EV, fold%,
 * villain response, and reasoning. Top rec is highlighted.
 */

import React, { useState } from 'react';
import { SURFACE, BORDER, TEXT, ACTION_PILL_COLORS, EV_COLORS } from '../../../../constants/designTokens';

const actionStyle = (action) => ACTION_PILL_COLORS[action?.toLowerCase()] || ACTION_PILL_COLORS.check;

const SECTION_HEADER_CLASSES = "text-[9px] font-bold uppercase tracking-[0.8px] mb-1.5 pb-[3px] border-b";

export const AllRecommendationsPanel = ({ recommendations, heroEquity }) => {
  const [expandedIdx, setExpandedIdx] = useState(null);
  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div className="mb-2.5">
      <div
        className={SECTION_HEADER_CLASSES}
        style={{ color: TEXT.muted, borderBottomColor: BORDER.default }}
      >
        All Recommendations
      </div>

      {recommendations.map((rec, i) => {
        const aStyle = actionStyle(rec.action);
        const isTop = i === 0;
        const isPositive = rec.ev > 0;
        const evColor = isPositive ? EV_COLORS['+EV'].text : rec.ev === 0 ? TEXT.muted : EV_COLORS['-EV'].text;
        const evBg = isPositive ? EV_COLORS['+EV'].bg : rec.ev === 0 ? '#374151' : EV_COLORS['-EV'].bg;
        const isExpanded = expandedIdx === i;
        const vr = rec.villainResponse;

        return (
          <div
            key={i}
            onClick={() => setExpandedIdx(isExpanded ? null : i)}
            className="px-2 py-1.5 mb-[3px] rounded-[5px] cursor-pointer transition-[background] duration-150"
            style={{
              background: isTop ? SURFACE.inset : 'transparent',
              borderLeft: `3px solid ${aStyle.bg}`,
            }}
          >
            {/* Main row */}
            <div className="flex items-center gap-1.5">
              {/* Rank */}
              <span
                className="font-mono text-[9px] font-bold w-3 shrink-0"
                style={{ color: isTop ? '#d4a847' : TEXT.faint }}
              >
                #{i + 1}
              </span>

              {/* Action badge */}
              <span
                className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-[3px] tracking-[0.3px]"
                style={{ background: aStyle.bg, color: aStyle.text }}
              >
                {rec.action}
              </span>

              {/* Sizing */}
              {rec.sizing && (
                <span className="font-mono text-[9px]" style={{ color: TEXT.secondary }}>
                  {Math.round(rec.sizing.betFraction * 100)}%
                  <span style={{ color: TEXT.faint }}> ${rec.sizing.betSize?.toFixed(0)}</span>
                </span>
              )}

              {/* Fold% */}
              {rec.sizing?.foldPct != null && (
                <span className="font-mono text-[8px]" style={{ color: TEXT.faint }}>
                  F:{Math.round(rec.sizing.foldPct * 100)}%
                </span>
              )}

              {/* Mix badge */}
              {rec.mixFrequency && (
                <span
                  className="text-[7px] font-bold px-1 py-px rounded-sm"
                  style={{ background: '#92400e', color: '#fbbf24' }}
                >MIX {Math.round(rec.mixFrequency * 100)}%</span>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* EV */}
              <span
                className="font-mono text-[11px] font-bold px-1.5 py-px rounded-[3px]"
                style={{ background: evBg, color: evColor }}
              >
                {rec.ev >= 0 ? '+' : ''}{rec.ev.toFixed(1)}
              </span>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div
                className="mt-[5px] pt-1"
                style={{ borderTop: `1px solid ${BORDER.default}` }}
              >
                {/* Villain response */}
                {vr && (
                  <div
                    className="font-mono text-[8px] mb-[3px] flex gap-2"
                    style={{ color: TEXT.muted }}
                  >
                    {vr.foldPct != null && <span>Fold: {Math.round(vr.foldPct * 100)}%</span>}
                    {vr.callPct != null && <span>Call: {Math.round(vr.callPct * 100)}%</span>}
                    {vr.raisePct != null && <span>Raise: {Math.round(vr.raisePct * 100)}%</span>}
                  </div>
                )}
                {/* Reasoning */}
                {rec.reasoning && (
                  <div
                    className="text-[9px] italic leading-snug"
                    style={{ color: TEXT.muted }}
                  >
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

