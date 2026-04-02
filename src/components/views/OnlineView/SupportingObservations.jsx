/**
 * SupportingObservations.jsx — Street-relevant villain behavioral reads
 *
 * Shows observations that match the current street context,
 * giving the user supporting evidence for the recommendation.
 */

import React from 'react';
import { SURFACE, BORDER, TEXT, FONT, COLOR, R } from './panelTokens';

const STREET_PREFIX = {
  preflop: 'preflop',
  flop: 'flop',
  turn: 'turn',
  river: 'river',
};

const TIER_COLORS = {
  solid: COLOR.green,
  developing: COLOR.yellow,
  early: COLOR.orange,
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
    <div style={{ marginBottom: 8 }}>
      <div style={{
        fontSize: 9, color: TEXT.faint, marginBottom: 4,
        textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600,
      }}>
        Supporting Reads
      </div>

      {matching.map((obs, i) => {
        const tierColor = TIER_COLORS[obs.tier] || TIER_COLORS.none;

        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 5,
            padding: '3px 0 3px 8px',
            borderLeft: `2px solid ${BORDER.subtle}`,
            marginBottom: 2,
          }}>
            {/* Tier dot */}
            <div style={{
              width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: tierColor, marginTop: 3,
            }} />

            <div style={{ flex: 1 }}>
              {/* Signal */}
              <span style={{ fontSize: 10, color: TEXT.secondary, lineHeight: 1.3 }}>
                {obs.signal}
              </span>

              {/* Evidence */}
              {obs.evidence && (
                <span style={{
                  fontSize: 8, fontFamily: FONT.mono, color: TEXT.faint,
                  marginLeft: 4,
                }}>
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
