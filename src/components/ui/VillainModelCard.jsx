/**
 * VillainModelCard.jsx — Compact inline villain decision profile
 *
 * Renders the villain's decision model in poker-native language.
 * Designed for the OnlineView detail panel — compact by default,
 * expandable for vulnerabilities, awareness, and showdown history.
 */

import React, { useState } from 'react';
import { MATURITY_COLORS } from '../../constants/designTokens';

// Villain style → border accent color
const STYLE_BORDER = {
  Fish: '#dc2626', LAG: '#ea580c', TAG: '#2563eb',
  Nit: '#6b7280', LP: '#d97706', Reg: '#7c3aed',
  Unknown: '#374151',
};

// Confidence → dot color
const CONF_DOT = (c) =>
  c >= 0.6 ? '#22c55e' : c >= 0.3 ? '#eab308' : c >= 0.1 ? '#f97316' : '#4b5563';

// Severity → bar color
const SEV_COLOR = (s) =>
  s >= 0.7 ? '#ef4444' : s >= 0.4 ? '#eab308' : '#22c55e';

const STREETS = ['preflop', 'flop', 'turn', 'river'];
const STREET_SHORT = { preflop: 'Pre', flop: 'Flop', turn: 'Turn', river: 'River' };

export const VillainModelCard = ({ villainProfile, thoughtAnalysis, currentStreet, villainStyle, onViewFullProfile, foldCurve }) => {
  const [expanded, setExpanded] = useState(false);

  if (!villainProfile || villainProfile.maturity === 'unknown') return null;

  const {
    headline, maturity, maturityLabel, streets,
    aggressionResponse, awareness, vulnerabilities,
    showdownAnchors, decisionModelDescription,
  } = villainProfile;

  const matColor = MATURITY_COLORS[maturity] || MATURITY_COLORS.unknown;
  const borderColor = STYLE_BORDER[villainStyle] || STYLE_BORDER.Unknown;

  return (
    <div style={{
      background: '#0d1117', borderLeft: `3px solid ${borderColor}`,
      borderRadius: 4, padding: '8px 10px', marginBottom: 8,
    }}>
      {/* Row 1: Headline + maturity badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: '#e0e0e0', fontWeight: 'bold', flex: 1 }}>
          {headline || 'Unknown player'}
        </span>
        <span style={{
          fontSize: 9, padding: '1px 6px', borderRadius: 3, fontWeight: 'bold',
          background: matColor.bg, color: matColor.text, whiteSpace: 'nowrap', marginLeft: 8,
        }}>
          {maturityLabel}
        </span>
      </div>

      {/* Row 2: Street tendencies */}
      {streets && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
          {STREETS.map(s => {
            const st = streets[s];
            if (!st) return null;
            const isCurrent = s === currentStreet;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: CONF_DOT(st.confidence), flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 10,
                  color: isCurrent ? '#e0e0e0' : '#6b7280',
                  fontWeight: isCurrent ? 'bold' : 'normal',
                }}>
                  <span style={{ color: isCurrent ? '#d4a847' : '#9ca3af', marginRight: 2 }}>
                    {STREET_SHORT[s]}:
                  </span>
                  {st.tendency}
                  {st.deviation && st.deviation.direction !== 'neutral' && (
                    <span style={{
                      marginLeft: 3, fontSize: 9, fontWeight: 700,
                      color: st.deviation.direction === 'aggressive' ? '#ef4444' : '#3b82f6',
                    }}>
                      {st.deviation.direction === 'aggressive' ? '\u25B2' : '\u25BC'}
                      {Math.abs(Math.round(st.deviation.vsPopulation * 100))}%
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Row 3: Aggression response + expand toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {aggressionResponse && (
          <div style={{ fontSize: 10, color: '#9ca3af', display: 'flex', gap: 12, flex: 1 }}>
            <span>
              Facing bet: <span style={{ color: '#e0e0e0' }}>
                {aggressionResponse.facingBet.summary}
                {aggressionResponse.facingBet.foldPct != null && (
                  <span style={{ color: '#6b7280' }}> ({Math.round(aggressionResponse.facingBet.foldPct * 100)}%)</span>
                )}
              </span>
            </span>
            <span>
              Facing raise: <span style={{ color: '#e0e0e0' }}>
                {aggressionResponse.facingRaise.summary}
                {aggressionResponse.facingRaise.foldPct != null && (
                  <span style={{ color: '#6b7280' }}> ({Math.round(aggressionResponse.facingRaise.foldPct * 100)}%)</span>
                )}
              </span>
            </span>
          </div>
        )}
        <span
          onClick={() => setExpanded(!expanded)}
          style={{
            fontSize: 10, color: '#4b8bbf', cursor: 'pointer',
            marginLeft: 8, whiteSpace: 'nowrap', userSelect: 'none',
          }}
        >
          {expanded ? '\u25B2 Less' : '\u25BC More'}
        </span>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div style={{ marginTop: 8, borderTop: '1px solid #1e293b', paddingTop: 6 }}>
          {/* Decision model description */}
          {decisionModelDescription && (
            <div style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic', marginBottom: 6 }}>
              {decisionModelDescription}
            </div>
          )}

          {/* Vulnerabilities */}
          {vulnerabilities?.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3, fontWeight: 'bold' }}>
                Vulnerabilities
              </div>
              {vulnerabilities.slice(0, 4).map((v, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 10, marginBottom: 2, color: '#e0e0e0',
                }}>
                  {/* Severity bar */}
                  <div style={{ width: 24, height: 3, background: '#374151', borderRadius: 2, flexShrink: 0 }}>
                    <div style={{
                      width: `${Math.round((v.severity || 0) * 100)}%`,
                      height: '100%', borderRadius: 2,
                      background: SEV_COLOR(v.severity || 0),
                    }} />
                  </div>
                  <span>{v.label}</span>
                  {v.exploitHint && (
                    <span style={{ color: '#4b8bbf', fontStyle: 'italic', fontSize: 9 }}>
                      — {v.exploitHint}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Cognitive patterns (inferred thoughts) */}
          {thoughtAnalysis?.thoughts?.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3, fontWeight: 'bold' }}>
                How They Think
              </div>
              {thoughtAnalysis.cognitiveProfile && (
                <div style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic', marginBottom: 4 }}>
                  {thoughtAnalysis.cognitiveProfile}
                </div>
              )}
              {thoughtAnalysis.thoughts.slice(0, 3).map((t, i) => (
                <div key={t.id} style={{ marginBottom: 4, paddingBottom: 3, borderBottom: i < 2 ? '1px solid #1e293b' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: '#d4a847', fontStyle: 'italic' }}>
                      &ldquo;{t.thought}&rdquo;
                    </span>
                    <span style={{
                      fontSize: 8, padding: '0 4px', borderRadius: 2,
                      background: t.confidence >= 0.6 ? '#064e3b' : t.confidence >= 0.3 ? '#422006' : '#1e293b',
                      color: t.confidence >= 0.6 ? '#34d399' : t.confidence >= 0.3 ? '#fbbf24' : '#6b7280',
                    }}>
                      {t.supporting}sig
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>
                    {t.meaning.length > 120 ? t.meaning.slice(0, 120) + '…' : t.meaning}
                  </div>
                </div>
              ))}
              {thoughtAnalysis.contradictions?.length > 0 && (
                <div style={{
                  fontSize: 9, color: '#fca5a5', fontStyle: 'italic', marginTop: 2,
                  padding: '3px 6px', background: '#1c1015', borderRadius: 3, borderLeft: '2px solid #7f1d1d',
                }}>
                  ⚠ {thoughtAnalysis.contradictions[0].insight}
                </div>
              )}
            </div>
          )}

          {/* Awareness */}
          {awareness && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 6, fontSize: 10 }}>
              {[
                { key: 'positionAware', label: 'Position' },
                { key: 'boardTextureAware', label: 'Board texture' },
                { key: 'sizingTells', label: 'Sizing' },
              ].map(({ key, label }) => {
                const a = awareness[key];
                const detected = a?.detected;
                return (
                  <span key={key} style={{ color: detected ? '#22c55e' : '#4b5563' }}>
                    {detected ? '\u2713' : '\u2717'} {label}
                  </span>
                );
              })}
            </div>
          )}

          {/* Fold response curve */}
          <FoldCurveChart foldCurve={foldCurve} />

          {/* Showdown anchors */}
          {showdownAnchors?.length > 0 && (
            <div>
              <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3, fontWeight: 'bold' }}>
                Showdowns
              </div>
              {showdownAnchors.slice(0, 3).map((s, i) => (
                <div key={i} style={{ fontSize: 10, color: '#9ca3af', marginBottom: 1 }}>
                  <span style={{ color: '#d4a847' }}>{s.handDescription}</span>
                  {s.position && <span> from {s.position}</span>}
                  {s.outcome && (
                    <span style={{ color: s.outcome === 'won' ? '#22c55e' : '#ef4444' }}>
                      {' '}({s.outcome})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Full profile link */}
      {onViewFullProfile && (
        <div
          onClick={onViewFullProfile}
          style={{
            fontSize: 10, color: '#4b8bbf', cursor: 'pointer',
            textAlign: 'right', marginTop: 6,
          }}
        >
          View full decision profile ›
        </div>
      )}
    </div>
  );
};

// ─── Fold Curve Mini-Chart ──────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Compute logistic fold response (mirrors foldEquityCalculator.logisticFoldResponse)
const logisticFold = (baseFold, fraction, params) => {
  const { maxDelta = 0.25, steepness = 3.0, midpoint = 0.75, steepnessUp, steepnessDown } = params;
  const effSteepness = fraction < midpoint ? (steepnessUp ?? steepness) : (steepnessDown ?? steepness);
  const x = effSteepness * (fraction - midpoint);
  const sigmoid = 1 / (1 + Math.exp(-x)) - 0.5;
  return clamp(baseFold + sigmoid * maxDelta, 0, 1);
};

// Default population curve params
const POP_CURVE = { maxDelta: 0.25, steepness: 3.0, steepnessUp: 4.0, steepnessDown: 2.0, midpoint: 0.75 };

const FoldCurveChart = ({ foldCurve }) => {
  // Show population curve always; overlay personalized if available
  const W = 130, H = 50, PAD_L = 18, PAD_R = 4, PAD_T = 4, PAD_B = 14;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const baseFold = 0.45; // population average
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

  const popPath = buildPath(POP_CURVE);
  const personalPath = foldCurve ? buildPath(foldCurve) : null;

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3, fontWeight: 'bold' }}>
        Fold Response
        {foldCurve && (
          <span style={{ fontWeight: 400, textTransform: 'none', color: '#4b5563', marginLeft: 4 }}>
            n={foldCurve.n}
          </span>
        )}
      </div>
      <svg width={W} height={H} style={{ display: 'block' }}>
        {/* Grid lines */}
        <line x1={PAD_L} y1={toY(0.25)} x2={W - PAD_R} y2={toY(0.25)} stroke="#1e293b" strokeWidth={0.5} />
        <line x1={PAD_L} y1={toY(0.50)} x2={W - PAD_R} y2={toY(0.50)} stroke="#1e293b" strokeWidth={0.5} />
        <line x1={PAD_L} y1={toY(0.75)} x2={W - PAD_R} y2={toY(0.75)} stroke="#1e293b" strokeWidth={0.5} />

        {/* Y-axis labels */}
        <text x={PAD_L - 2} y={toY(0.25) + 3} textAnchor="end" fill="#4b5563" fontSize={7}>25</text>
        <text x={PAD_L - 2} y={toY(0.50) + 3} textAnchor="end" fill="#4b5563" fontSize={7}>50</text>
        <text x={PAD_L - 2} y={toY(0.75) + 3} textAnchor="end" fill="#4b5563" fontSize={7}>75</text>

        {/* X-axis labels */}
        <text x={toX(0.5)} y={H - 1} textAnchor="middle" fill="#4b5563" fontSize={7}>½×</text>
        <text x={toX(1.0)} y={H - 1} textAnchor="middle" fill="#4b5563" fontSize={7}>1×</text>
        <text x={toX(2.0)} y={H - 1} textAnchor="middle" fill="#4b5563" fontSize={7}>2×</text>

        {/* Population curve (dashed gray) */}
        <path d={popPath} fill="none" stroke="#4b5563" strokeWidth={1} strokeDasharray="3,2" />

        {/* Personalized curve (solid colored) */}
        {personalPath && (
          <path d={personalPath} fill="none" stroke="#22c55e" strokeWidth={1.5} />
        )}
      </svg>
      {!foldCurve && (
        <div style={{ fontSize: 9, color: '#4b5563', fontStyle: 'italic' }}>
          Population default — need 8+ bet-facing observations
        </div>
      )}
    </div>
  );
};

export default VillainModelCard;
