/**
 * StreetTendenciesPanel.jsx — Villain's per-street behavioral tendencies
 *
 * Shows preflop/flop/turn/river tendency with confidence dot,
 * deviation arrow, and aggression response. Extracted from VillainModelCard.
 */

import React from 'react';
import { SURFACE, BORDER, TEXT, FONT, GOLD, COLOR, R } from '../panelTokens';

const STREETS = ['preflop', 'flop', 'turn', 'river'];
const STREET_SHORT = { preflop: 'Pre', flop: 'Flop', turn: 'Turn', river: 'River' };

const confDotColor = (conf) => {
  if (conf >= 0.6) return COLOR.green;
  if (conf >= 0.3) return COLOR.yellow;
  return TEXT.faint;
};

export const StreetTendenciesPanel = ({ villainProfile, currentStreet }) => {
  if (!villainProfile) return null;
  const { streets, aggressionResponse } = villainProfile;
  if (!streets) return null;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={sectionHeader}>Villain Street Tendencies</div>

      {STREETS.map(s => {
        const st = streets[s];
        if (!st) return null;
        const isCurrent = s === currentStreet;

        return (
          <div key={s} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '3px 0',
            opacity: isCurrent ? 1 : 0.7,
          }}>
            {/* Confidence dot */}
            <div style={{
              width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: confDotColor(st.confidence),
            }} />

            {/* Street label */}
            <span style={{
              fontFamily: FONT.mono, fontSize: 9, fontWeight: 600,
              color: isCurrent ? GOLD.base : TEXT.muted,
              width: 32, flexShrink: 0,
            }}>
              {STREET_SHORT[s]}
            </span>

            {/* Tendency text */}
            <span style={{
              fontSize: 10, color: isCurrent ? TEXT.primary : TEXT.secondary,
              fontWeight: isCurrent ? 600 : 400,
              flex: 1,
            }}>
              {st.tendency}
            </span>

            {/* Deviation arrow */}
            {st.deviation && st.deviation.direction !== 'neutral' && (
              <span style={{
                fontFamily: FONT.mono, fontSize: 9, fontWeight: 700,
                color: st.deviation.direction === 'aggressive' ? COLOR.red : '#3b82f6',
                flexShrink: 0,
              }}>
                {st.deviation.direction === 'aggressive' ? '\u25B2' : '\u25BC'}
                {Math.abs(Math.round(st.deviation.vsPopulation * 100))}%
              </span>
            )}

            {/* Confidence % */}
            <span style={{
              fontFamily: FONT.mono, fontSize: 7, color: TEXT.faint,
              width: 24, textAlign: 'right', flexShrink: 0,
            }}>
              {Math.round((st.confidence || 0) * 100)}%
            </span>
          </div>
        );
      })}

      {/* Aggression response */}
      {aggressionResponse && (
        <div style={{
          marginTop: 6, paddingTop: 5, borderTop: `1px solid ${BORDER.default}`,
          display: 'flex', gap: 14, fontSize: 9, color: TEXT.muted,
        }}>
          <div>
            <span style={{ color: TEXT.faint }}>Facing bet: </span>
            <span style={{ color: TEXT.primary, fontWeight: 600 }}>
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
            <span style={{ color: TEXT.primary, fontWeight: 600 }}>
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

const sectionHeader = {
  fontSize: 9, fontWeight: 700, color: TEXT.muted,
  textTransform: 'uppercase', letterSpacing: 0.8,
  marginBottom: 6, paddingBottom: 3,
  borderBottom: `1px solid ${BORDER.default}`,
};
