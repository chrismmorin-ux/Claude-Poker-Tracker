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
    <div className="mb-2.5">
      {/* Collapsible header with quality dots */}
      <div
        onClick={() => hasProfile && setRecsExpanded(!recsExpanded)}
        className={`flex justify-between items-center select-none ${isCollapsed ? 'mb-0' : 'mb-1.5'} ${hasProfile ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-1.5">
          <h4 className="text-[11px] m-0 uppercase tracking-[0.5px] text-[#d4a847]">
            {hasProfile && (
              <span className="mr-1 text-[9px]">{isCollapsed ? '▼' : '▲'}</span>
            )}
            Live Recommendations
          </h4>
          {/* Data quality dots + progress hint */}
          <div className="flex items-center gap-1">
            <div className="flex gap-0.5">
              {qualityDots.map((c, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-[3px]" style={{ background: c }} />
              ))}
            </div>
            {advice.treeMetadata?.depthReached > 1 && (
              <span className="text-[8px] font-bold px-1 py-0 rounded-[2px] bg-[#1e3a5f] text-blue-400">
                D{advice.treeMetadata.depthReached}
              </span>
            )}
            {advice.modelQuality?.overallSource && (
              <span
                className={`text-[8px] font-bold px-1 py-0 rounded-[2px] ${advice.modelQuality.overallSource === 'population' ? 'bg-gray-700 text-gray-500' : 'bg-green-900 text-green-400'}`}
              >
                {advice.modelQuality.overallSource === 'population' ? 'pop.' : 'model'}
              </span>
            )}
            {advice.dataQuality?.confidenceNote && (
              <span className="text-[9px] italic text-gray-600">
                {advice.dataQuality.confidenceNote}
              </span>
            )}
          </div>
        </div>
        {/* Collapsed summary: top rec action + EV */}
        {isCollapsed && topRec && (
          <span className="text-[11px] text-gray-400">
            Best: <span
              className="font-extrabold uppercase"
              style={{ color: ACTION_COLORS[topRec.action.toLowerCase()]?.base || '#e0e0e0' }}
            >
              {topRec.action}
            </span>
            <span
              className={`ml-1 font-bold ${topRec.ev > 0 ? 'text-green-500' : topRec.ev === 0 ? 'text-gray-500' : 'text-red-500'}`}
            >
              {topRec.ev >= 0 ? '+' : ''}{topRec.ev.toFixed(1)} EV
            </span>
          </span>
        )}
      </div>

      {/* Full recommendations (shown when expanded or no profile) */}
      {!isCollapsed && (
        <>
          {/* Situation + Hero Equity row */}
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-400">
              {advice.situationLabel || advice.situation}
              {advice.heroAlreadyActed && (
                <span className="text-[9px] text-gray-500 ml-1.5 px-[5px] py-px rounded-[3px] bg-gray-800">review</span>
              )}
            </span>
            <span
              className={`text-[15px] font-bold ${advice.heroEquity >= 0.5 ? 'text-green-500' : 'text-red-500'}`}
            >
              {Math.round(advice.heroEquity * 100)}%
              <span className="text-[10px] font-normal text-gray-500 ml-0.5">eq</span>
            </span>
          </div>

          {/* Board texture pills */}
          {advice.boardTexture && (
            <div className="flex gap-1 mb-1 flex-wrap">
              {[
                { key: 'texture', show: true, label: advice.boardTexture.texture },
                { key: 'paired', show: advice.boardTexture.isPaired, label: 'paired' },
                { key: 'flushDraw', show: advice.boardTexture.flushDraw, label: 'flush draw' },
                { key: 'monotone', show: advice.boardTexture.monotone, label: 'monotone' },
              ].filter(p => p.show).map(p => {
                const pill = TEXTURE_PILLS[p.key] || TEXTURE_PILLS.medium;
                return (
                  <span
                    key={p.key}
                    className="text-[9px] px-1.5 py-px rounded-[3px] font-bold"
                    style={{ background: pill.bg, color: pill.color }}
                  >
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
            <div className="mb-1.5">
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
            <div className="flex flex-col gap-0.5">
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
      className="px-2.5 py-2 mb-1 rounded-md bg-[#0d1117] cursor-pointer"
      style={{
        borderLeft: `4px solid ${actionColor}`,
        boxShadow: `inset 0 1px 0 0 ${actionColor}33`,
      }}
    >
      {/* Row 1: Action + Sizing + EV pill */}
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-baseline gap-2">
          <span
            className="text-lg font-extrabold uppercase tracking-[0.5px]"
            style={{ color: actionColor }}
          >
            {'★ '}{topRec.action}
          </span>
          {topRec.mixFrequency && (
            <span className="text-[9px] font-bold px-[5px] py-px rounded-[3px] bg-amber-800 text-amber-400">
              MIX {Math.round(topRec.mixFrequency * 100)}%
            </span>
          )}
          {topRec.blockerBluff && (
            <span className="text-[9px] font-bold px-[5px] py-px rounded-[3px] bg-purple-900 text-purple-400">
              BLOCKER
            </span>
          )}
          {topRec.sizing && (
            <span className="text-[13px] text-gray-400 font-semibold">
              {Math.round(topRec.sizing.betFraction * 100)}% pot
              <span className="text-gray-500 font-normal"> (${topRec.sizing.betSize.toFixed(0)})</span>
            </span>
          )}
        </div>
        {/* EV pill badge */}
        <span
          className="text-[13px] font-bold px-2 py-0.5 rounded"
          style={{
            background: evBg,
            color: evColor === '#6b7280' ? '#9ca3af' : evColor,
          }}
        >
          {topRec.ev >= 0 ? '+' : ''}{topRec.ev.toFixed(1)}
        </span>
      </div>

      {/* Row 2: Equity bar + Villain response */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1 flex-1">
          <div className="flex-[0_0_120px] h-2 rounded bg-gray-700 overflow-hidden">
            <div
              className={`h-full rounded ${advice.heroEquity >= 0.5 ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${Math.round(advice.heroEquity * 100)}%` }}
            />
          </div>
        </div>
        {vr && (
          <div className="flex gap-1.5 shrink-0">
            {vr.fold && (
              <>
                <span className="text-xs font-bold text-red-600">
                  F:{Math.round(vr.fold.pct * 100)}
                </span>
                <span className="text-xs font-bold text-blue-600">
                  C:{Math.round(vr.call.pct * 100)}
                </span>
                <span className="text-xs font-bold text-orange-600">
                  R:{Math.round(vr.raise.pct * 100)}
                </span>
              </>
            )}
            {vr.check && !vr.fold && (
              <>
                <span className="text-xs font-bold text-cyan-600">
                  Ck:{Math.round(vr.check.pct * 100)}
                </span>
                <span className="text-xs font-bold text-green-600">
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
      <div
        className={`text-[11px] text-gray-500 italic mt-1 overflow-hidden text-ellipsis ${isDetailExpanded ? 'whitespace-normal' : 'whitespace-nowrap'}`}
      >
        {topRec.reasoning}
      </div>

      {/* Hand plan (always visible when available — this is the key guidance) */}
      {topRec.handPlan && (
        <HandPlanTree handPlan={topRec.handPlan} street={advice.currentStreet} />
      )}

      {/* Expanded detail: fold adjustments + supporting observations */}
      {isDetailExpanded && (
        <div className="mt-1 pt-1 border-t border-t-gray-800">
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
        className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#0d1117] cursor-pointer min-h-8"
      >
        <div
          className="w-2 h-2 rounded shrink-0"
          style={{ background: actionColor }}
        />
        <span className="text-xs font-bold uppercase text-[#e0e0e0]">
          {rec.action}
        </span>
        <span className="text-xs font-bold" style={{ color: evColor }}>
          {rec.ev >= 0 ? '+' : ''}{rec.ev.toFixed(1)}
        </span>
        {rec.sizing && (
          <span className="text-[10px] text-gray-500">
            {Math.round(rec.sizing.betFraction * 100)}% pot
          </span>
        )}
        <span className="text-[9px] text-[#4b8bbf] ml-auto">
          {isExpanded ? '▲' : '▼'}
        </span>
      </div>
      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-2 pb-1.5 pt-1 pl-6 bg-[#0d1117] rounded-b -mt-0.5">
          {rec.villainResponse?.fold && (
            <div className="text-[10px] text-[#4b8bbf] mb-0.5">
              V: folds {Math.round(rec.villainResponse.fold.pct * 100)}%
              {' · '}calls {Math.round(rec.villainResponse.call.pct * 100)}%
              {' · '}raises {Math.round(rec.villainResponse.raise.pct * 100)}%
            </div>
          )}
          {rec.villainResponse?.check && !rec.villainResponse?.fold && (
            <div className="text-[10px] text-[#4b8bbf] mb-0.5">
              V: checks {Math.round(rec.villainResponse.check.pct * 100)}%
              {' · '}bets {Math.round(rec.villainResponse.bet.pct * 100)}%
            </div>
          )}
          <div className="text-[10px] text-gray-500 italic">
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
    <div className="flex items-center gap-1.5 mt-[3px] flex-wrap">
      {sizing?.foldPct != null && (
        <span className="text-[10px] text-gray-400">
          Fold: <span className="font-bold text-[#e0e0e0]">{Math.round(sizing.foldPct * 100)}%</span>
          {srcCfg && (
            <span
              className="ml-1 text-[9px] px-[5px] py-px rounded-[3px] font-semibold"
              style={{ background: srcCfg.bg, color: srcCfg.color }}
            >
              {srcCfg.label}{meta?.observedN > 0 ? ` n=${meta.observedN}` : ''}
            </span>
          )}
        </span>
      )}
      {predLabel && (
        <span className="text-[9px] text-gray-600">
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
        <div className="text-[10px] text-gray-500">
          Fold equity: {Math.round(sizing.foldPct * 100)}%
        </div>
      );
    }
    return null;
  }

  const significantAdj = (meta.adjustments || []).filter(a => Math.abs(a.multiplier - 1) >= 0.02);
  return (
    <div>
      <div className="text-[10px] text-gray-500 mb-0.5">
        Base fold: {Math.round(meta.baseEstimate * 100)}%
        {meta.totalShiftPct !== 0 && (
          <span className={`ml-1 ${meta.totalShiftPct > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {meta.totalShiftPct > 0 ? '+' : ''}{meta.totalShiftPct}% adjusted
          </span>
        )}
      </div>
      {significantAdj.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-0.5">
          {significantAdj.map(a => {
            const pct = Math.round((a.multiplier - 1) * 100);
            return (
              <span
                key={a.factor}
                className={`text-[9px] px-1 py-px rounded-[3px] bg-gray-800 ${pct > 0 ? 'text-green-400' : 'text-red-400'}`}
              >
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
    <div className="mt-1">
      <div className="text-[9px] text-gray-600 mb-0.5">Supporting reads:</div>
      {matching.map((obs, i) => (
        <div key={i} className="text-[10px] text-gray-400 pl-2 border-l-2 border-l-gray-700 mb-0.5">
          {obs.signal}
          {obs.evidence && (
            <span className="text-gray-600 ml-1">
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
        ? `${p.favorableRunouts}/${p.totalRunouts} runouts favor ${p.plan}${p.scaryCards > 0 ? ` · ${p.scaryCards} scary` : ''}`
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
        ? `${p.favorableRunouts}/${p.totalRunouts} runouts favor ${p.plan}${p.scaryCards > 0 ? ` · ${p.scaryCards} scary` : ''}`
        : null,
    });
  }

  if (branches.length === 0) return null;

  return (
    <div className="mt-1">
      <div className="text-[9px] text-gray-600 mb-0.5 uppercase tracking-[0.5px]">Hand plan</div>
      {branches.map((b, i) => (
        <div
          key={i}
          className="flex items-start gap-1.5 py-[3px] pl-2 border-l-2 mb-0.5"
          style={{ borderLeftColor: b.color }}
        >
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold" style={{ color: b.color }}>{b.label}</span>
              <span className="text-[10px] text-gray-400">{b.note}</span>
            </div>
            {b.detail && (
              <div className="text-[9px] text-gray-600 mt-px">{b.detail}</div>
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
    <div className="mb-1">
      <div className="text-[9px] text-gray-600 mb-0.5">Hero equity vs range</div>
      <div className="flex h-[18px] rounded-[3px] overflow-hidden bg-gray-800">
        {buckets.map(b => (
          <div
            key={b.name}
            className="flex items-center justify-center border-r border-r-[#0d1117]"
            style={{
              flex: `${b.pct} 0 0`,
              background: BUCKET_COLORS[b.name] + '30',
            }}
          >
            <span
              className={`text-[8px] font-bold tracking-[-0.3px] ${b.equity >= 0.5 ? 'text-green-400' : 'text-red-400'}`}
            >
              {Math.round(b.equity * 100)}%
            </span>
          </div>
        ))}
      </div>
      <div className="flex h-2.5">
        {buckets.map(b => (
          <div key={b.name} className="text-center" style={{ flex: `${b.pct} 0 0` }}>
            <span className="text-[7px] text-gray-600">{b.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
