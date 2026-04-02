/**
 * LiveAdviceBar.jsx — Multi-row glanceable equity/advice bar
 *
 * Shows action classification (VALUE/BLUFF/CHECK), equity percentage,
 * fold percentage, equity bar, villain info, board texture, confidence,
 * advantage badges, reasoning text, and fold curve tooltip.
 */

import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ADVICE_COLORS } from '../../../constants/designTokens';

const TEXTURE_LABEL = {
  wet: { text: 'wet', color: '#3b82f6' },
  dry: { text: 'dry', color: '#f59e0b' },
  medium: { text: 'mid', color: '#8b5cf6' },
};

const ARCHETYPE_STYLE = {
  set:         { label: 'Set',  bg: '#14532d', fg: '#22c55e' },
  overpair:    { label: 'OP',   bg: '#14532d', fg: '#22c55e' },
  top_pair:    { label: 'TP',   bg: '#14532d', fg: '#22c55e' },
  second_pair: { label: '2P',   bg: '#422006', fg: '#f59e0b' },
  flush_draw:  { label: 'FD',   bg: '#1e3a5f', fg: '#60a5fa' },
  overcards:   { label: 'OC',   bg: '#422006', fg: '#f59e0b' },
  miss:        { label: 'Miss', bg: '#1f2937', fg: '#6b7280' },
};

/** Compact flop archetype breakdown row */
const FlopBreakdownRow = ({ flopBreakdown }) => {
  if (!flopBreakdown || flopBreakdown.length === 0) return null;

  // Group by archetype and sum probabilities
  const grouped = {};
  for (const f of flopBreakdown) {
    if (!grouped[f.archetype]) {
      grouped[f.archetype] = { probability: 0, ev: 0, count: 0, bucket: f.bucket };
    }
    grouped[f.archetype].probability += f.probability;
    grouped[f.archetype].ev += f.ev;
    grouped[f.archetype].count++;
  }

  const entries = Object.entries(grouped)
    .map(([arch, data]) => ({ arch, ...data, avgEV: data.ev / data.count }))
    .sort((a, b) => b.probability - a.probability);

  return (
    <div className="flex items-center gap-1" style={{ marginBottom: 2, flexWrap: 'wrap' }}>
      {entries.map(({ arch, probability, avgEV }) => {
        const style = ARCHETYPE_STYLE[arch] || ARCHETYPE_STYLE.miss;
        const pct = Math.round(probability * 100);
        return (
          <span key={arch} style={{
            fontSize: 9, fontWeight: 600, padding: '0px 4px', borderRadius: 3,
            background: style.bg, color: style.fg, whiteSpace: 'nowrap',
          }}>
            {style.label} {pct}%{avgEV > 0 ? '+' : ''}
          </span>
        );
      })}
    </div>
  );
};

/** Confidence badge from villain prediction metadata */
const ConfidenceBadge = ({ villainPrediction }) => {
  if (!villainPrediction) return null;
  const { effectiveN, source } = villainPrediction;
  let label, bg, fg;
  if (effectiveN >= 15 && source && source.includes('model')) {
    label = 'DATA'; bg = '#14532d'; fg = '#22c55e';
  } else if (effectiveN >= 5) {
    label = 'PARTIAL'; bg = '#422006'; fg = '#f59e0b';
  } else {
    label = 'EST'; bg = '#1f2937'; fg = '#6b7280';
  }
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
      background: bg, color: fg, letterSpacing: 0.5,
    }}>
      {label}
    </span>
  );
};

/** Advantage pill badges (range/nut advantage indicators) */
const AdvantageBadges = ({ advantage }) => {
  if (!advantage) return null;
  const badges = [];
  if (advantage.rangeAdvantage > 0.2) badges.push({ label: 'R+', color: '#22c55e', bg: '#14532d' });
  else if (advantage.rangeAdvantage < -0.2) badges.push({ label: 'R-', color: '#ef4444', bg: '#7f1d1d' });
  if (advantage.nutAdvantage > 0.2) badges.push({ label: 'N+', color: '#22c55e', bg: '#14532d' });
  else if (advantage.nutAdvantage < -0.2) badges.push({ label: 'N-', color: '#ef4444', bg: '#7f1d1d' });
  if (badges.length === 0) return null;
  return badges.map((b, i) => (
    <span key={i} style={{
      fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
      color: b.color, background: b.bg, textTransform: 'uppercase', letterSpacing: 0.5,
    }}>
      {b.label}
    </span>
  ));
};

/** Fold curve tooltip showing fold% at multiple bet sizings */
const FoldCurveTooltip = ({ foldMeta, onClose }) => {
  if (!foldMeta?.curve?.length) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', bottom: '100%', right: 0, marginBottom: 4,
        background: '#1a1f2e', border: '1px solid #374151', borderRadius: 6,
        padding: '6px 10px', zIndex: 50, minWidth: 150,
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ fontSize: 9, color: '#9ca3af', marginBottom: 3, fontWeight: 600 }}>
        FOLD CURVE {foldMeta.curveSource === 'personalized' ? '(personalized)' : '(style-based)'}
      </div>
      {foldMeta.curve.map((pt, i) => (
        <div key={i} style={{ fontSize: 10, color: '#d1d5db', display: 'flex', justifyContent: 'space-between', gap: 12, lineHeight: 1.6 }}>
          <span style={{ color: '#9ca3af' }}>{Math.round(pt.sizing * 100)}% pot</span>
          <span style={{ fontWeight: 700, color: pt.foldPct >= 0.40 ? '#22c55e' : '#d1d5db' }}>
            {Math.round(pt.foldPct * 100)}% fold
          </span>
        </div>
      ))}
    </div>
  );
};

/**
 * Derive simple hand plan guidance from equity + fold% when full game tree advice isn't available.
 */
const deriveSimpleGuidance = (eq, fp, label) => {
  if (!eq || eq === null) return null;
  if (label === 'VALUE') {
    if (fp != null && fp >= 0.30) return 'If called \u2192 continue value betting safe turns';
    return 'If called \u2192 re-evaluate turn texture';
  }
  if (label === 'BLUFF') {
    if (fp != null && fp >= 0.50) return 'If called \u2192 check turn (they\u2019re committed)';
    return 'If called \u2192 give up unless turn improves hand';
  }
  if (eq >= 0.40 && eq < 0.55) return 'Marginal \u2192 check-call if bet is small, fold to large';
  return null;
};

export const LiveAdviceBar = ({ actionAdvice, liveEquity, boardTexture, gameTreeAdvice }) => {
  const [showFoldCurve, setShowFoldCurve] = useState(false);

  if (!actionAdvice && !liveEquity?.isComputing && !gameTreeAdvice) return null;

  // When full game tree advice is available, use the top recommendation
  const topRec = gameTreeAdvice?.recommendations?.[0];
  const useGameTree = topRec && gameTreeAdvice.heroEquity != null;

  // Derive display values
  const displayLabel = useGameTree ? topRec.action.toUpperCase() : actionAdvice?.label;
  const displayColor = useGameTree
    ? (topRec.action === 'fold' ? '#dc2626' : topRec.action === 'check' ? '#6b7280'
      : topRec.action === 'call' ? '#2563eb' : '#22c55e')
    : actionAdvice?.color || '#6b7280';
  const displayEq = useGameTree ? gameTreeAdvice.heroEquity : liveEquity?.equity;
  const displayFoldPct = useGameTree ? (topRec.sizing?.foldPct ?? gameTreeAdvice.foldPct) : liveEquity?.foldPct;

  // Hand plan: prefer game tree handPlan, fall back to simple derivation
  const handPlanNote = topRec?.handPlan
    ? (topRec.handPlan.ifCall?.note || topRec.handPlan.nextStreet?.note || topRec.handPlan.ifVillainBets?.note)
    : deriveSimpleGuidance(displayEq, displayFoldPct, displayLabel);
  const raiseNote = topRec?.handPlan?.ifRaise?.note;

  const advantage = gameTreeAdvice?.treeMetadata?.advantage;

  return (
    <div
      style={{
        borderBottom: '1px solid var(--panel-border)',
        borderLeft: `3px solid ${displayColor}`,
        background: `linear-gradient(90deg, ${displayColor}1A 0%, transparent 60%)`,
        padding: '6px 10px',
      }}
    >
      {liveEquity?.isComputing && !useGameTree ? (
        <div style={{
          height: 4, borderRadius: 2, overflow: 'hidden',
          background: ADVICE_COLORS.equityBarBg,
        }}>
          <div className="animate-pulse" style={{
            width: '60%', height: '100%', borderRadius: 2,
            background: `linear-gradient(90deg, ${ADVICE_COLORS.foldHighlight}, transparent)`,
          }} />
        </div>
      ) : (displayLabel || useGameTree) && (
        <>
          {/* Row 1: Action + sizing (game tree) or classification (fallback) */}
          <div className="flex items-center justify-between" style={{ marginBottom: 2 }}>
            <div className="flex items-center gap-1.5">
              {!useGameTree && actionAdvice?.icon === 'up' && <TrendingUp size={16} color={displayColor} />}
              {!useGameTree && actionAdvice?.icon === 'down' && <TrendingDown size={16} color={displayColor} />}
              {!useGameTree && actionAdvice?.icon === 'flat' && <Minus size={16} color={displayColor} />}
              {useGameTree && <span style={{ fontSize: 14, color: '#d4a847' }}>{'\u2605'}</span>}
              <span style={{
                fontSize: useGameTree ? 16 : 18, fontWeight: 800, color: displayColor,
                letterSpacing: '1.5px', textTransform: 'uppercase',
              }}>
                {displayLabel}
              </span>
              {useGameTree && topRec.sizing && (
                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>
                  {Math.round(topRec.sizing.betFraction * 100)}% pot
                </span>
              )}
              {useGameTree && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                  background: topRec.ev > 0 ? '#166534' : topRec.ev === 0 ? '#374151' : '#7f1d1d',
                  color: topRec.ev > 0 ? '#22c55e' : topRec.ev === 0 ? '#9ca3af' : '#ef4444',
                }}>
                  {topRec.ev >= 0 ? '+' : ''}{topRec.ev.toFixed(1)}
                </span>
              )}
              {useGameTree && <ConfidenceBadge villainPrediction={topRec.villainPrediction} />}
              {useGameTree && topRec.risk?.isHighRisk && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                  background: '#78350f', color: '#fbbf24', letterSpacing: 0.5,
                }}>
                  HIGH VARIANCE
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {displayEq != null && (
                <span style={{ fontSize: 13, color: '#9ca3af' }}>
                  Eq <span style={{ fontWeight: 700, color: '#fff' }}>{Math.round(displayEq * 100)}%</span>
                </span>
              )}
              {displayFoldPct != null && (
                <span style={{
                  fontSize: 13, position: 'relative',
                  color: displayFoldPct >= 0.30 ? ADVICE_COLORS.foldHighlight : '#9ca3af',
                }}>
                  F:<span style={{ fontWeight: 700, color: '#fff' }}>{Math.round(displayFoldPct * 100)}%</span>
                  {gameTreeAdvice?.foldMeta?.curve?.length > 0 && (
                    <span
                      onClick={(e) => { e.stopPropagation(); setShowFoldCurve(v => !v); }}
                      style={{
                        marginLeft: 3, fontSize: 10, color: '#6b7280', cursor: 'pointer',
                        padding: '0 2px', borderRadius: 2, background: showFoldCurve ? '#374151' : 'transparent',
                      }}
                    >
                      ···
                    </span>
                  )}
                  {showFoldCurve && (
                    <FoldCurveTooltip foldMeta={gameTreeAdvice.foldMeta} onClose={() => setShowFoldCurve(false)} />
                  )}
                </span>
              )}
            </div>
          </div>
          {/* Row 1.5: Reasoning text (surfaces engine reasoning to user) */}
          {useGameTree && topRec.reasoning && (
            <div style={{
              fontSize: 10, color: '#9ca3af', marginBottom: 3,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {topRec.reasoning}
            </div>
          )}
          {/* Row 1.75: Flop archetype breakdown (preflop only) */}
          {useGameTree && gameTreeAdvice?.flopBreakdown && (
            <FlopBreakdownRow flopBreakdown={gameTreeAdvice.flopBreakdown} />
          )}
          {/* Row 2: Equity bar + board texture + advantage + villain info */}
          <div className="flex items-center gap-2">
            <div style={{
              flex: '0 0 80px', height: 6, borderRadius: 3,
              background: ADVICE_COLORS.equityBarBg, overflow: 'hidden',
            }}>
              {displayEq != null && (
                <div style={{
                  width: `${Math.round(displayEq * 100)}%`,
                  height: '100%', borderRadius: 3,
                  background: displayEq >= 0.5
                    ? ADVICE_COLORS.equityGood
                    : ADVICE_COLORS.equityBad,
                }} />
              )}
            </div>
            {boardTexture?.texture && TEXTURE_LABEL[boardTexture.texture] && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                color: TEXTURE_LABEL[boardTexture.texture].color,
                background: `${TEXTURE_LABEL[boardTexture.texture].color}1A`,
                textTransform: 'uppercase', letterSpacing: 0.5,
              }}>
                {TEXTURE_LABEL[boardTexture.texture].text}
              </span>
            )}
            {useGameTree && <AdvantageBadges advantage={advantage} />}
            {useGameTree && topRec.villainResponse?.fold && topRec.villainResponse?.call && (
              <span style={{ fontSize: 10, color: '#6b7280' }}>
                F:{Math.round(topRec.villainResponse.fold.pct * 100)}
                {' C:'}{Math.round(topRec.villainResponse.call.pct * 100)}
                {' R:'}{Math.round((topRec.villainResponse.raise?.pct ?? 0) * 100)}
              </span>
            )}
            {useGameTree && topRec.risk?.isHighRisk && topRec.risk.downsideEV < 0 && topRec.risk.upsideEV > 0 && (
              <span style={{ fontSize: 10, color: '#6b7280' }}>
                <span style={{ color: '#ef4444' }}>{topRec.risk.downsideEV.toFixed(0)}</span>
                {' to '}
                <span style={{ color: '#22c55e' }}>+{topRec.risk.upsideEV.toFixed(0)}</span>
              </span>
            )}
            {!useGameTree && liveEquity?.villainName && (
              <span style={{ fontSize: 11, color: '#6b7280' }}>
                vs {liveEquity.villainName}
              </span>
            )}
          </div>
          {/* Row 3: Hand plan guidance */}
          {handPlanNote && (
            <div style={{
              fontSize: 10, color: '#9ca3af', marginTop: 3,
              paddingTop: 3, borderTop: '1px solid #1f293744',
            }}>
              <span style={{ color: '#4b8bbf' }}>{handPlanNote}</span>
              {raiseNote && (
                <span style={{ color: '#6b7280', marginLeft: 8 }}>{'\u2502'} If raised \u2192 {topRec.handPlan.ifRaise.plan}</span>
              )}
            </div>
          )}
          {useGameTree && topRec.risk?.saferAlternative && (
            <div style={{
              fontSize: 10, color: '#fbbf24', marginTop: 2,
              paddingLeft: 2,
            }}>
              {topRec.risk.saferAlternative.action.toUpperCase()} reduces risk {topRec.risk.saferAlternative.varianceReduction}%
              {' for '}{topRec.risk.saferAlternative.evSacrifice.toFixed(1)} EV
            </div>
          )}
        </>
      )}
    </div>
  );
};
