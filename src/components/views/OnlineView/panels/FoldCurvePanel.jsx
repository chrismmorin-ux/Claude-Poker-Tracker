/**
 * FoldCurvePanel.jsx — Fold curve SVG chart (enlarged for deep analysis)
 *
 * Shows population curve (dashed) vs personalized curve (solid gold/green),
 * with current bet size marker. Extracted from VillainModelCard and enlarged.
 */

import React from 'react';
import { SURFACE, BORDER, TEXT, FONT, COLOR, GOLD, R } from '../panelTokens';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Mirrors foldEquityCalculator.logisticFoldResponse
const logisticFold = (baseFold, fraction, params) => {
  const { maxDelta = 0.25, steepness = 3.0, midpoint = 0.75, steepnessUp, steepnessDown } = params;
  const effSteepness = fraction < midpoint ? (steepnessUp ?? steepness) : (steepnessDown ?? steepness);
  const x = effSteepness * (fraction - midpoint);
  const sigmoid = 1 / (1 + Math.exp(-x)) - 0.5;
  return clamp(baseFold + sigmoid * maxDelta, 0, 1);
};

const POP_CURVE = { maxDelta: 0.25, steepness: 3.0, steepnessUp: 4.0, steepnessDown: 2.0, midpoint: 0.75 };

export const FoldCurvePanel = ({ foldMeta, foldCurve, currentBetFraction }) => {
  // Chart dimensions (larger than VillainModelCard's 130×50)
  const W = 340, H = 100, PAD_L = 28, PAD_R = 8, PAD_T = 8, PAD_B = 18;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const baseFold = 0.45;
  const fractions = [0.25, 0.33, 0.50, 0.67, 0.75, 1.0, 1.5, 2.0];
  const minF = 0.25, maxF = 2.0;

  const toX = (f) => PAD_L + ((f - minF) / (maxF - minF)) * plotW;
  const toY = (v) => PAD_T + (1 - v) * plotH;

  const buildPath = (params) => {
    return fractions.map((f, i) => {
      const y = logisticFold(baseFold, f, params);
      return `${i === 0 ? 'M' : 'L'}${toX(f).toFixed(1)},${toY(y).toFixed(1)}`;
    }).join(' ');
  };

  // Use curve data from foldMeta if available, otherwise foldCurve params
  const hasCurveData = foldMeta?.bet?.curve?.length > 0;
  const personalParams = foldCurve;

  // Build paths
  const popPath = buildPath(POP_CURVE);
  const personalPath = personalParams ? buildPath(personalParams) : null;

  // Data-driven curve from foldMeta.bet.curve (actual computed points)
  const dataPath = hasCurveData
    ? foldMeta.bet.curve.map((pt, i) =>
        `${i === 0 ? 'M' : 'L'}${toX(pt.sizing).toFixed(1)},${toY(pt.foldPct).toFixed(1)}`
      ).join(' ')
    : null;

  const curveSource = foldMeta?.bet?.curveSource || (personalParams ? 'personalized' : 'population');
  const observedN = foldMeta?.bet?.observedN;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        ...sectionHeader,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>Fold Curve · Sizing Response</span>
        <span style={{
          fontWeight: 400, textTransform: 'none', fontSize: 8,
          color: curveSource === 'personalized' ? COLOR.green
            : curveSource === 'style' ? COLOR.yellow : TEXT.faint,
        }}>
          {curveSource}{observedN ? ` (n=${observedN})` : ''}
        </span>
      </div>

      <svg width={W} height={H} style={{ display: 'block' }}>
        {/* Grid lines */}
        {[0.20, 0.40, 0.60, 0.80].map(v => (
          <line key={v} x1={PAD_L} y1={toY(v)} x2={W - PAD_R} y2={toY(v)}
            stroke={BORDER.default} strokeWidth={0.5} />
        ))}

        {/* Y-axis labels */}
        {[0.20, 0.40, 0.60, 0.80].map(v => (
          <text key={v} x={PAD_L - 3} y={toY(v) + 3} textAnchor="end"
            fill={TEXT.faint} fontSize={7} fontFamily={FONT.mono}>
            {Math.round(v * 100)}%
          </text>
        ))}

        {/* X-axis labels */}
        {[
          [0.33, '⅓×'], [0.50, '½×'], [0.75, '¾×'],
          [1.0, '1×'], [1.5, '1½×'], [2.0, '2×'],
        ].map(([f, label]) => (
          <text key={f} x={toX(f)} y={H - 2} textAnchor="middle"
            fill={TEXT.faint} fontSize={7} fontFamily={FONT.mono}>
            {label}
          </text>
        ))}

        {/* Population curve (dashed gray) */}
        <path d={popPath} fill="none" stroke={TEXT.faint} strokeWidth={1} strokeDasharray="4,3" />

        {/* Data-driven curve (solid gold — preferred when available) */}
        {dataPath && (
          <path d={dataPath} fill="none" stroke={GOLD.base} strokeWidth={2} />
        )}

        {/* Personalized logistic curve (solid green — when no data curve) */}
        {!dataPath && personalPath && (
          <path d={personalPath} fill="none" stroke={COLOR.green} strokeWidth={1.5} />
        )}

        {/* Current bet size marker */}
        {currentBetFraction != null && currentBetFraction >= minF && currentBetFraction <= maxF && (
          <>
            <line
              x1={toX(currentBetFraction)} y1={PAD_T}
              x2={toX(currentBetFraction)} y2={H - PAD_B}
              stroke={COLOR.cyan} strokeWidth={1} strokeDasharray="2,2" opacity={0.6}
            />
            <circle
              cx={toX(currentBetFraction)}
              cy={toY(hasCurveData
                ? (foldMeta.bet.curve.find(p => Math.abs(p.sizing - currentBetFraction) < 0.1)?.foldPct ?? baseFold)
                : baseFold
              )}
              r={3} fill={COLOR.cyan} stroke={SURFACE.inset} strokeWidth={1}
            />
          </>
        )}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, fontSize: 7, color: TEXT.faint, marginTop: 2 }}>
        <span>
          <span style={{ color: TEXT.faint }}>---</span> Population
        </span>
        {(dataPath || personalPath) && (
          <span>
            <span style={{ color: dataPath ? GOLD.base : COLOR.green }}>——</span> {curveSource}
          </span>
        )}
        {currentBetFraction != null && (
          <span>
            <span style={{ color: COLOR.cyan }}>|</span> Current sizing
          </span>
        )}
      </div>
    </div>
  );
};

const sectionHeader = {
  fontSize: 9, fontWeight: 700, color: TEXT.muted,
  textTransform: 'uppercase', letterSpacing: 0.8,
  marginBottom: 6, paddingBottom: 3,
  borderBottom: `1px solid ${BORDER.default}`,
};
