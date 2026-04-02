/**
 * LiveRecommendations.jsx — Collapsible live action recommendations
 *
 * Shows quality dots, hero card (top recommendation), and alternative
 * recommendations with expand/collapse detail panels.
 */

import React from 'react';
import { ACTION_COLORS } from '../../../constants/designTokens';
import { SegmentationBar } from '../../ui/SegmentationBar';
import { HandTypeBreakdown } from '../../ui/HandTypeBreakdown';
import { TEXTURE_PILLS, PRED_SOURCE_LABEL, FOLD_SOURCE_CONFIG, FOLD_ADJ_LABEL } from './onlineConstants';

export const LiveRecommendations = ({
  advice, selectedSeatData, hasProfile,
  recsExpanded, setRecsExpanded,
  expandedRec, setExpandedRec,
}) => {
  const isCollapsed = hasProfile && !recsExpanded;
  const topRec = advice.recommendations?.[0];
  const altRecs = advice.recommendations?.slice(1, 3) || [];

  // Data quality dot colors
  const qualityDots = (() => {
    const tier = advice.dataQuality?.tier || 'none';
    if (tier === 'established') return ['#22c55e', '#22c55e', '#22c55e'];
    if (tier === 'developing') return ['#eab308', '#eab308', '#4b5563'];
    if (tier === 'speculative') return ['#f97316', '#4b5563', '#4b5563'];
    return ['#4b5563', '#4b5563', '#4b5563'];
  })();

  return (
    <div style={{ marginBottom: 10 }}>
      {/* Collapsible header with quality dots */}
      <div
        onClick={() => hasProfile && setRecsExpanded(!recsExpanded)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: isCollapsed ? 0 : 6,
          cursor: hasProfile ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <h4 style={{ fontSize: 11, color: '#d4a847', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {hasProfile && (
              <span style={{ marginRight: 4, fontSize: 9 }}>{isCollapsed ? '\u25BC' : '\u25B2'}</span>
            )}
            Live Recommendations
          </h4>
          {/* Data quality dots + progress hint */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {qualityDots.map((c, i) => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: c }} />
              ))}
            </div>
            {advice.treeMetadata?.depthReached > 1 && (
              <span style={{
                fontSize: 8, fontWeight: 700, padding: '0px 4px', borderRadius: 2,
                background: '#1e3a5f', color: '#60a5fa',
              }}>
                D{advice.treeMetadata.depthReached}
              </span>
            )}
            {advice.modelQuality?.overallSource && (
              <span style={{
                fontSize: 8, fontWeight: 700, padding: '0px 4px', borderRadius: 2,
                background: advice.modelQuality.overallSource === 'population' ? '#374151' : '#14532d',
                color: advice.modelQuality.overallSource === 'population' ? '#6b7280' : '#4ade80',
              }}>
                {advice.modelQuality.overallSource === 'population' ? 'pop.' : 'model'}
              </span>
            )}
            {advice.dataQuality?.confidenceNote && (
              <span style={{ fontSize: 9, color: '#4b5563', fontStyle: 'italic' }}>
                {advice.dataQuality.confidenceNote}
              </span>
            )}
          </div>
        </div>
        {/* Collapsed summary: top rec action + EV */}
        {isCollapsed && topRec && (
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            Best: <span style={{
              fontWeight: 800, textTransform: 'uppercase',
              color: ACTION_COLORS[topRec.action.toLowerCase()]?.base || '#e0e0e0',
            }}>{topRec.action}</span>
            <span style={{
              marginLeft: 4, fontWeight: 700,
              color: topRec.ev > 0 ? '#22c55e' : topRec.ev === 0 ? '#6b7280' : '#ef4444',
            }}>
              {topRec.ev >= 0 ? '+' : ''}{topRec.ev.toFixed(1)} EV
            </span>
          </span>
        )}
      </div>

      {/* Full recommendations (shown when expanded or no profile) */}
      {!isCollapsed && (
        <>
          {/* Situation + Hero Equity row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>
              {advice.situationLabel || advice.situation}
              {advice.heroAlreadyActed && (
                <span style={{
                  fontSize: 9, color: '#6b7280', marginLeft: 6,
                  padding: '1px 5px', borderRadius: 3, background: '#1f2937',
                }}>review</span>
              )}
            </span>
            <span style={{
              fontSize: 15, fontWeight: 700,
              color: advice.heroEquity >= 0.5 ? '#22c55e' : '#ef4444',
            }}>
              {Math.round(advice.heroEquity * 100)}%
              <span style={{ fontSize: 10, fontWeight: 400, color: '#6b7280', marginLeft: 2 }}>eq</span>
            </span>
          </div>

          {/* Board texture pills */}
          {advice.boardTexture && (
            <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
              {[
                { key: 'texture', show: true, label: advice.boardTexture.texture },
                { key: 'paired', show: advice.boardTexture.isPaired, label: 'paired' },
                { key: 'flushDraw', show: advice.boardTexture.flushDraw, label: 'flush draw' },
                { key: 'monotone', show: advice.boardTexture.monotone, label: 'monotone' },
              ].filter(p => p.show).map(p => {
                const pill = TEXTURE_PILLS[p.key] || TEXTURE_PILLS.medium;
                return (
                  <span key={p.key} style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 3, fontWeight: 'bold',
                    background: pill.bg, color: pill.color,
                  }}>
                    {p.label}
                  </span>
                );
              })}
            </div>
          )}

          {/* Hand-type range breakdown (postflop only) */}
          {advice.segmentation?.handTypes && (
            <HandTypeBreakdown
              handTypes={advice.segmentation.handTypes}
              totalCombos={advice.segmentation.totalCombos || 0}
              bucketEquities={advice.bucketEquities}
              size="sm"
            />
          )}
          {/* Fallback to bucket bar if hand types not available */}
          {!advice.segmentation?.handTypes && advice.segmentation?.buckets && (
            <div style={{ marginBottom: 6 }}>
              <SegmentationBar buckets={advice.segmentation.buckets} size="sm" />
            </div>
          )}

          {/* Hero card — top recommendation */}
          {topRec && <HeroCard
            topRec={topRec}
            advice={advice}
            expandedRec={expandedRec}
            setExpandedRec={setExpandedRec}
            observations={selectedSeatData?.observations}
          />}

          {/* Alternative recommendations — compact single lines */}
          {altRecs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {altRecs.map((rec, i) => (
                <AltRecItem
                  key={rec.action + (i + 1)}
                  rec={rec}
                  idx={i + 1}
                  expandedRec={expandedRec}
                  setExpandedRec={setExpandedRec}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Hero Card (top recommendation) ─────────────────────────────────────────

const STREET_PREFIX = { preflop: 'P', flop: 'F', turn: 'T', river: 'R' };

const HeroCard = ({ topRec, advice, expandedRec, setExpandedRec, observations }) => {
  const actionColor = ACTION_COLORS[topRec.action.toLowerCase()]?.base || '#9ca3af';
  const isPositive = topRec.ev > 0;
  const evColor = isPositive ? '#22c55e' : topRec.ev === 0 ? '#6b7280' : '#ef4444';
  const evBg = isPositive ? '#166534' : topRec.ev === 0 ? '#374151' : '#7f1d1d';
  const vr = topRec.villainResponse;
  const isDetailExpanded = expandedRec === 0;

  return (
    <div
      onClick={() => setExpandedRec(isDetailExpanded ? null : 0)}
      style={{
        padding: '8px 10px', marginBottom: 4, borderRadius: 6,
        background: '#0d1117',
        borderLeft: `4px solid ${actionColor}`,
        boxShadow: `inset 0 1px 0 0 ${actionColor}33`,
        cursor: 'pointer',
      }}
    >
      {/* Row 1: Action + Sizing + EV pill */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            fontSize: 18, fontWeight: 800, textTransform: 'uppercase',
            color: actionColor, letterSpacing: 0.5,
          }}>
            {'\u2605 '}{topRec.action}
          </span>
          {topRec.mixFrequency && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
              background: '#92400e', color: '#fbbf24',
            }}>
              MIX {Math.round(topRec.mixFrequency * 100)}%
            </span>
          )}
          {topRec.blockerBluff && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
              background: '#581c87', color: '#c084fc',
            }}>
              BLOCKER
            </span>
          )}
          {topRec.sizing && (
            <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 600 }}>
              {Math.round(topRec.sizing.betFraction * 100)}% pot
              <span style={{ color: '#6b7280', fontWeight: 400 }}> (${topRec.sizing.betSize.toFixed(0)})</span>
            </span>
          )}
        </div>
        {/* EV pill badge */}
        <span style={{
          fontSize: 13, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
          background: evBg, color: evColor === '#6b7280' ? '#9ca3af' : evColor,
        }}>
          {topRec.ev >= 0 ? '+' : ''}{topRec.ev.toFixed(1)}
        </span>
      </div>

      {/* Row 2: Equity bar + Villain response */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
          <div style={{
            flex: '0 0 120px', height: 8, borderRadius: 4,
            background: '#374151', overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.round(advice.heroEquity * 100)}%`,
              height: '100%', borderRadius: 4,
              background: advice.heroEquity >= 0.5 ? '#22c55e' : '#ef4444',
            }} />
          </div>
        </div>
        {vr && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {vr.fold && (
              <>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>
                  F:{Math.round(vr.fold.pct * 100)}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>
                  C:{Math.round(vr.call.pct * 100)}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#ea580c' }}>
                  R:{Math.round(vr.raise.pct * 100)}
                </span>
              </>
            )}
            {vr.check && !vr.fold && (
              <>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0891b2' }}>
                  Ck:{Math.round(vr.check.pct * 100)}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
                  Bt:{Math.round(vr.bet.pct * 100)}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Row 2b: Fold source badge + model source (always visible) */}
      <FoldSourceBadge sizing={topRec.sizing} prediction={topRec.villainPrediction} />

      {/* Row 3: Reasoning (1-line, clipped) */}
      <div style={{
        fontSize: 11, color: '#6b7280', fontStyle: 'italic', marginTop: 4,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isDetailExpanded ? 'normal' : 'nowrap',
      }}>
        {topRec.reasoning}
      </div>

      {/* Hand plan (always visible when available — this is the key guidance) */}
      {topRec.handPlan && (
        <HandPlanTree handPlan={topRec.handPlan} street={advice.currentStreet} />
      )}

      {/* Expanded detail: fold adjustments + supporting observations */}
      {isDetailExpanded && (
        <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid #1f2937' }}>
          <FoldAdjustments sizing={topRec.sizing} />
          <SupportingObservations
            observations={observations}
            currentStreet={advice.currentStreet}
          />
        </div>
      )}
    </div>
  );
};

// ─── Alternative Recommendation Item ─────────────────────────────────────────

const AltRecItem = ({ rec, idx, expandedRec, setExpandedRec }) => {
  const actionColor = ACTION_COLORS[rec.action.toLowerCase()]?.base || '#9ca3af';
  const isPositive = rec.ev > 0;
  const evColor = isPositive ? '#22c55e' : rec.ev === 0 ? '#6b7280' : '#ef4444';
  const isExpanded = expandedRec === idx;

  return (
    <div>
      {/* Compact line */}
      <div
        onClick={() => setExpandedRec(isExpanded ? null : idx)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 8px', borderRadius: 4, background: '#0d1117',
          cursor: 'pointer', minHeight: 32,
        }}
      >
        <div style={{
          width: 8, height: 8, borderRadius: 4,
          background: actionColor, flexShrink: 0,
        }} />
        <span style={{
          fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
          color: '#e0e0e0',
        }}>
          {rec.action}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: evColor }}>
          {rec.ev >= 0 ? '+' : ''}{rec.ev.toFixed(1)}
        </span>
        {rec.sizing && (
          <span style={{ fontSize: 10, color: '#6b7280' }}>
            {Math.round(rec.sizing.betFraction * 100)}% pot
          </span>
        )}
        <span style={{ fontSize: 9, color: '#4b8bbf', marginLeft: 'auto' }}>
          {isExpanded ? '\u25B2' : '\u25BC'}
        </span>
      </div>
      {/* Expanded detail */}
      {isExpanded && (
        <div style={{
          padding: '4px 8px 6px 24px', background: '#0d1117',
          borderRadius: '0 0 4px 4px', marginTop: -2,
        }}>
          {rec.villainResponse?.fold && (
            <div style={{ fontSize: 10, color: '#4b8bbf', marginBottom: 2 }}>
              V: folds {Math.round(rec.villainResponse.fold.pct * 100)}%
              {' \u00B7 '}calls {Math.round(rec.villainResponse.call.pct * 100)}%
              {' \u00B7 '}raises {Math.round(rec.villainResponse.raise.pct * 100)}%
            </div>
          )}
          {rec.villainResponse?.check && !rec.villainResponse?.fold && (
            <div style={{ fontSize: 10, color: '#4b8bbf', marginBottom: 2 }}>
              V: checks {Math.round(rec.villainResponse.check.pct * 100)}%
              {' \u00B7 '}bets {Math.round(rec.villainResponse.bet.pct * 100)}%
            </div>
          )}
          <div style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic' }}>
            {rec.reasoning}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Fold Source Badge (always visible under hero card) ──────────────────────

const FoldSourceBadge = ({ sizing, prediction }) => {
  if (!sizing?.foldPct && !prediction) return null;
  const meta = sizing?.foldMeta;
  const srcCfg = meta ? (FOLD_SOURCE_CONFIG[meta.source] || FOLD_SOURCE_CONFIG.population) : null;
  const predLabel = prediction
    ? (prediction.source === 'prior' ? 'population estimate'
      : `${PRED_SOURCE_LABEL[prediction.source] || prediction.source}${prediction.effectiveN ? `, n=${Math.round(prediction.effectiveN)}` : ''}`)
    : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
      {sizing?.foldPct != null && (
        <span style={{ fontSize: 10, color: '#9ca3af' }}>
          Fold: <span style={{ fontWeight: 700, color: '#e0e0e0' }}>{Math.round(sizing.foldPct * 100)}%</span>
          {srcCfg && (
            <span style={{
              marginLeft: 4, fontSize: 9, padding: '1px 5px', borderRadius: 3,
              background: srcCfg.bg, color: srcCfg.color, fontWeight: 600,
            }}>
              {srcCfg.label}{meta?.observedN > 0 ? ` n=${meta.observedN}` : ''}
            </span>
          )}
        </span>
      )}
      {predLabel && (
        <span style={{ fontSize: 9, color: '#4b5563' }}>
          model: {predLabel}
        </span>
      )}
    </div>
  );
};

// ─── Fold Adjustments (expanded detail) ─────────────────────────────────────

const FoldAdjustments = ({ sizing }) => {
  const meta = sizing?.foldMeta;
  if (!meta) {
    if (sizing?.foldPct != null) {
      return (
        <div style={{ fontSize: 10, color: '#6b7280' }}>
          Fold equity: {Math.round(sizing.foldPct * 100)}%
        </div>
      );
    }
    return null;
  }

  const significantAdj = (meta.adjustments || []).filter(a => Math.abs(a.multiplier - 1) >= 0.02);
  return (
    <div>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>
        Base fold: {Math.round(meta.baseEstimate * 100)}%
        {meta.totalShiftPct !== 0 && (
          <span style={{
            marginLeft: 4,
            color: meta.totalShiftPct > 0 ? '#22c55e' : '#ef4444',
          }}>
            {meta.totalShiftPct > 0 ? '+' : ''}{meta.totalShiftPct}% adjusted
          </span>
        )}
      </div>
      {significantAdj.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
          {significantAdj.map(a => {
            const pct = Math.round((a.multiplier - 1) * 100);
            return (
              <span key={a.factor} style={{
                fontSize: 9, padding: '1px 4px', borderRadius: 3,
                background: '#1f2937', color: pct > 0 ? '#4ade80' : '#f87171',
              }}>
                {FOLD_ADJ_LABEL[a.factor] || a.factor}: {pct > 0 ? '+' : ''}{pct}%
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Supporting Observations (expanded detail) ──────────────────────────────

const SupportingObservations = ({ observations, currentStreet }) => {
  if (!observations || observations.length === 0 || !currentStreet) return null;

  const prefix = STREET_PREFIX[currentStreet];
  if (!prefix) return null;

  // Filter observations matching current street (heroContext starts with street prefix)
  const matching = observations
    .filter(obs => obs.heroContext?.startsWith(prefix))
    .slice(0, 2);

  if (matching.length === 0) return null;

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 9, color: '#4b5563', marginBottom: 2 }}>Supporting reads:</div>
      {matching.map((obs, i) => (
        <div key={i} style={{
          fontSize: 10, color: '#9ca3af', paddingLeft: 8,
          borderLeft: '2px solid #374151', marginBottom: 2,
        }}>
          {obs.signal}
          {obs.evidence && (
            <span style={{ color: '#4b5563', marginLeft: 4 }}>
              ({obs.evidence})
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Hand Plan Tree (branch guidance for rest of hand) ─────────────────────

const PLAN_COLORS = { barrel: '#22c55e', check: '#6b7280', call: '#2563eb', fold: '#dc2626', probe: '#22c55e', checkCall: '#2563eb', bet: '#22c55e' };

const HandPlanTree = ({ handPlan, street }) => {
  if (!handPlan || Object.keys(handPlan).length === 0) return null;
  const isRiver = street === 'river';

  const branches = [];

  if (handPlan.ifCall) {
    const p = handPlan.ifCall;
    branches.push({
      label: 'If they call',
      color: '#2563eb',
      note: p.note,
      detail: !isRiver && p.totalRunouts > 0
        ? `${p.favorableRunouts}/${p.totalRunouts} runouts favor ${p.plan}${p.scaryCards > 0 ? ` \u00B7 ${p.scaryCards} scary` : ''}`
        : null,
    });
  }

  if (handPlan.ifRaise) {
    branches.push({
      label: 'If they raise',
      color: '#ea580c',
      note: handPlan.ifRaise.note,
      detail: null,
    });
  }

  if (handPlan.ifVillainBets) {
    branches.push({
      label: 'If villain bets',
      color: '#ea580c',
      note: handPlan.ifVillainBets.note,
      detail: null,
    });
  }

  if (handPlan.ifVillainChecks) {
    branches.push({
      label: 'If villain checks',
      color: '#0891b2',
      note: handPlan.ifVillainChecks.note,
      detail: null,
    });
  }

  if (handPlan.nextStreet) {
    const p = handPlan.nextStreet;
    branches.push({
      label: 'Next street',
      color: '#d4a847',
      note: p.note,
      detail: p.totalRunouts > 0
        ? `${p.favorableRunouts}/${p.totalRunouts} runouts favor ${p.plan}${p.scaryCards > 0 ? ` \u00B7 ${p.scaryCards} scary` : ''}`
        : null,
    });
  }

  if (branches.length === 0) return null;

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 9, color: '#4b5563', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Hand plan</div>
      {branches.map((b, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 6,
          padding: '3px 0', borderLeft: `2px solid ${b.color}`, paddingLeft: 8, marginBottom: 2,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: b.color }}>{b.label}</span>
              <span style={{ fontSize: 10, color: '#9ca3af' }}>{b.note}</span>
            </div>
            {b.detail && (
              <div style={{ fontSize: 9, color: '#4b5563', marginTop: 1 }}>{b.detail}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Bucket Equity Bar (hero equity vs each range bucket) ──────────────────

const BUCKET_COLORS = { nuts: '#dc2626', strong: '#ea580c', marginal: '#eab308', draw: '#2563eb', air: '#6b7280' };

const BucketEquityBar = ({ bucketEquities, segmentation }) => {
  if (!bucketEquities || !segmentation?.buckets) return null;

  const buckets = Object.entries(segmentation.buckets)
    .filter(([, data]) => (data?.pct || 0) > 0.05)
    .map(([name, data]) => ({
      name,
      pct: data.pct,
      equity: bucketEquities[name],
    }))
    .filter(b => b.equity != null);

  if (buckets.length === 0) return null;

  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 9, color: '#4b5563', marginBottom: 2 }}>Hero equity vs range</div>
      <div style={{ display: 'flex', height: 18, borderRadius: 3, overflow: 'hidden', background: '#1f2937' }}>
        {buckets.map(b => (
          <div key={b.name} style={{
            flex: `${b.pct} 0 0`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: BUCKET_COLORS[b.name] + '30',
            borderRight: '1px solid #0d1117',
          }}>
            <span style={{
              fontSize: 8, fontWeight: 700, letterSpacing: -0.3,
              color: b.equity >= 0.5 ? '#4ade80' : '#f87171',
            }}>
              {Math.round(b.equity * 100)}%
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', height: 10 }}>
        {buckets.map(b => (
          <div key={b.name} style={{ flex: `${b.pct} 0 0`, textAlign: 'center' }}>
            <span style={{ fontSize: 7, color: '#4b5563' }}>{b.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
