/**
 * SupportingObservations.jsx — Street-relevant villain behavioral reads
 *
 * Shows observations that match the current street context,
 * giving the user supporting evidence for the recommendation.
 */

import React from 'react';
import { BORDER, TEXT } from '../../../constants/designTokens';

const STREET_PREFIX = {
  preflop: 'preflop',
  flop: 'flop',
  turn: 'turn',
  river: 'river',
};

const TIER_COLORS = {
  solid: '#22c55e',       // green-500 — was COLOR.green
  developing: '#eab308',  // yellow-500 — was COLOR.yellow
  early: '#f97316',       // orange-500 — was COLOR.orange
  none: TEXT.faint,
};

export const SupportingObservations = ({ observations, currentStreet, maxShow = 3 }) => {
  if (!observations || observations.length === 0 || !currentStreet) return null;

  const prefix = STREET_PREFIX[currentStreet];
  if (!prefix) return null;

  // Filter observations matching current street
  const matching = observations
    .filter(obs => obs.heroContext?.startsWith(prefix))
    .slice(0, maxShow);

  if (matching.length === 0) return null;

  return (
    <div className="mb-2">
      <div
        className="text-[9px] mb-1 uppercase tracking-[0.5px] font-semibold"
        style={{ color: TEXT.faint }}
      >
        Supporting Reads
      </div>

      {matching.map((obs, i) => {
        const tierColor = TIER_COLORS[obs.tier] || TIER_COLORS.none;

        return (
          <div
            key={i}
            className="flex items-start gap-[5px] py-[3px] pl-2 mb-0.5 border-l-2"
            style={{ borderLeftColor: BORDER.subtle }}
          >
            {/* Tier dot */}
            <div
              className="w-[5px] h-[5px] rounded-full shrink-0 mt-[3px]"
              style={{ background: tierColor }}
            />

            <div className="flex-1">
              {/* Signal */}
              <span className="text-[10px] leading-snug" style={{ color: TEXT.secondary }}>
                {obs.signal}
              </span>

              {/* Evidence */}
              {obs.evidence && (
                <span className="text-[8px] font-mono ml-1" style={{ color: TEXT.faint }}>
                  ({obs.evidence})
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
