/**
 * RangeFlopBreakdown.jsx — precise hand-type breakdown of a range on a flop.
 *
 * Renders the engine's 22-type hand-type distribution grouped by
 * HAND_TYPE_GROUPS (premium / flush / straight / trips / two-pair / top-pair /
 * mid-low pair / draws / air), each row showing:
 *   - label
 *   - combo count + weighted %
 *   - visual bar
 *   - average equity-out breakdown (draw outs + improvement outs) for types
 *     where drawing to better is meaningful
 *
 * Two ranges render side-by-side so Hero can compare hand-type shapes
 * directly. Framework chips + narrations appear below.
 */

import React, { useMemo, useEffect, useState } from 'react';
import {
  handTypeBreakdown,
  HAND_TYPE_GROUPS,
  pctMadeFlushPlus,
  pctMadeStraightPlus,
  pctSetTripsTwoPair,
  pctTopPairPlus,
  pctStrongDraws,
  pctWeakDraws,
  pctAir,
} from '../../../utils/postflopDrillContent/handTypeBreakdown';
import { nutAdvantage, rangeVsRangeEquity } from '../../../utils/postflopDrillContent/rangeVsBoard';
import { classifyScenario } from '../../../utils/postflopDrillContent/frameworks';
import { analyzeBoardTexture } from '../../../utils/pokerCore/boardTexture';

const GROUP_COLOR = {
  premium:  'bg-emerald-500',
  flush:    'bg-emerald-400',
  straight: 'bg-teal-400',
  trips:    'bg-cyan-500',
  twoPair:  'bg-cyan-400',
  topPair:  'bg-blue-400',
  midLow:   'bg-amber-500',
  draws:    'bg-orange-500',
  air:      'bg-red-500',
};

const GROUP_TIER_LABEL = {
  premium:  'made',
  flush:    'made',
  straight: 'made',
  trips:    'made',
  twoPair:  'made',
  topPair:  'top-pair tier',
  midLow:   'mid/low pair',
  draws:    'drawing',
  air:      'nothing',
};

const FRAMEWORK_COLOR = {
  range_decomposition: 'bg-purple-700 text-purple-100',
  range_advantage:     'bg-blue-700 text-blue-100',
  nut_advantage:       'bg-teal-700 text-teal-100',
  range_morphology:    'bg-indigo-700 text-indigo-100',
  board_tilt:          'bg-amber-700 text-amber-100',
  capped_range_check:  'bg-rose-700 text-rose-100',
  whiff_rate:          'bg-orange-700 text-orange-100',
};

const pctStr = (x, d = 1) => `${(x * 100).toFixed(d)}%`;

/**
 * Summary band at the top — aggregate tier stats so Hero can scan at a glance.
 */
const TierSummary = ({ bd, label }) => {
  const tiers = [
    { label: 'Flush+',      v: pctMadeFlushPlus(bd),       color: 'text-emerald-300' },
    { label: 'Straight+',   v: pctMadeStraightPlus(bd),    color: 'text-teal-300' },
    { label: 'Set/Tr/2P',   v: pctSetTripsTwoPair(bd),     color: 'text-cyan-300' },
    { label: 'TP+',         v: pctTopPairPlus(bd),         color: 'text-blue-300' },
    { label: 'Strong dr.',  v: pctStrongDraws(bd),         color: 'text-orange-300' },
    { label: 'Weak dr.',    v: pctWeakDraws(bd),           color: 'text-amber-300' },
    { label: 'Air',         v: pctAir(bd),                 color: 'text-red-300' },
  ];
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">{label}</div>
      <div className="grid grid-cols-7 gap-1">
        {tiers.map((t) => (
          <div key={t.label} className="bg-gray-900/60 border border-gray-800 rounded px-2 py-1.5 text-center">
            <div className="text-[10px] text-gray-400">{t.label}</div>
            <div className={`text-sm font-mono font-semibold ${t.color}`}>{pctStr(t.v)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Hand-type rows for one group. Collapsible.
 */
const GroupSection = ({ group, totalWeight }) => {
  const [open, setOpen] = useState(group.totalPct > 0 && group.id !== 'air');
  const nonZero = group.types.filter((t) => t.count > 0);
  const hasAny = group.totalCount > 0;

  if (!hasAny && group.id !== 'air') return null;

  return (
    <div className="border-t border-gray-800 first:border-t-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-800/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-5 rounded-sm ${GROUP_COLOR[group.id] || 'bg-gray-600'}`} />
          <span className="text-sm font-semibold text-gray-200">{group.label}</span>
          <span className="text-[10px] text-gray-500">— {GROUP_TIER_LABEL[group.id]}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{group.totalCount} combo{group.totalCount === 1 ? '' : 's'}</span>
          <span className="text-sm font-mono font-semibold text-gray-200">{pctStr(group.totalPct)}</span>
          <span className="text-gray-600 text-xs">{open ? '▾' : '▸'}</span>
        </div>
      </button>
      {open && nonZero.length > 0 && (
        <div className="px-4 pb-2 space-y-1">
          {nonZero.map((t) => {
            const showDrawOuts = t.avgDrawOuts >= 0.5;
            const showImproveOuts = t.avgImprovementOuts >= 0.5;
            return (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <div className="w-32 text-gray-300 truncate">{t.label}</div>
                <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full ${GROUP_COLOR[group.id] || 'bg-gray-500'} transition-all`}
                    style={{ width: `${Math.min(100, t.pct * 100 * 3)}%` }}
                    title={pctStr(t.pct)}
                  />
                </div>
                <div className="w-12 text-right font-mono text-gray-200">{pctStr(t.pct)}</div>
                <div className="w-10 text-right text-gray-500">{t.count}×</div>
                <div className="w-44 text-right text-[10px] text-gray-500 truncate">
                  {showDrawOuts && <span className="text-orange-400">draw {t.avgDrawOuts.toFixed(1)} out</span>}
                  {showDrawOuts && showImproveOuts && <span className="text-gray-600"> · </span>}
                  {showImproveOuts && <span className="text-amber-400">imp {t.avgImprovementOuts.toFixed(1)} out</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const HandTypePanel = ({ bd, label }) => (
  <div className="bg-gray-800/40 border border-gray-800 rounded-lg overflow-hidden">
    <div className="px-3 py-2 border-b border-gray-800 bg-gray-900/60">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-[11px] text-gray-500 mt-0.5">
        {Math.round(bd.totalWeight)} weighted combos — {bd.isCapped ? <span className="text-rose-400">capped</span> : bd.isWeaklyCapped ? <span className="text-amber-400">weakly capped</span> : <span className="text-emerald-400">uncapped</span>}
      </div>
    </div>
    <div>
      {Object.values(bd.byGroup).map((group) => (
        <GroupSection key={group.id} group={group} totalWeight={bd.totalWeight} />
      ))}
    </div>
  </div>
);

const FrameworkChip = ({ match }) => (
  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${FRAMEWORK_COLOR[match.framework.id] || 'bg-gray-700 text-gray-200'}`}>
    <span>{match.framework.name}</span>
    <span className="opacity-70">·</span>
    <span className="opacity-90">{match.subcase}</span>
  </div>
);

const NarrationBlock = ({ match }) => (
  <div className="bg-gray-800/70 border border-gray-800 rounded-lg p-3">
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-xs font-semibold text-gray-300">{match.framework.name}</span>
      <span className="text-[10px] text-gray-500 uppercase">{match.subcase}</span>
    </div>
    <p className="text-sm text-gray-300 leading-relaxed">{match.narration}</p>
  </div>
);

export const RangeFlopBreakdown = ({ range, board, opposingRange = null, context = null, opposingContext = null, heroEquityOpts = null }) => {
  const texture = useMemo(() => (board?.length === 3 ? analyzeBoardTexture(board) : null), [board]);

  const bdA = useMemo(() => {
    if (!range || board?.length !== 3) return null;
    return handTypeBreakdown(range, board, texture);
  }, [range, board, texture]);

  const bdB = useMemo(() => {
    if (!opposingRange || board?.length !== 3) return null;
    return handTypeBreakdown(opposingRange, board, texture);
  }, [opposingRange, board, texture]);

  const nut = useMemo(() => {
    if (!range || !opposingRange || board?.length !== 3) return null;
    return nutAdvantage(range, opposingRange, board);
  }, [range, opposingRange, board]);

  const [mcEquity, setMcEquity] = useState(null);
  const [mcLoading, setMcLoading] = useState(false);
  useEffect(() => {
    if (!range || !opposingRange || !heroEquityOpts || board?.length !== 3) {
      setMcEquity(null);
      return;
    }
    let cancelled = false;
    setMcLoading(true);
    setMcEquity(null);
    rangeVsRangeEquity(range, opposingRange, board, heroEquityOpts).then((r) => {
      if (!cancelled) {
        setMcEquity(r);
        setMcLoading(false);
      }
    }).catch(() => { if (!cancelled) setMcLoading(false); });
    return () => { cancelled = true; };
  }, [range, opposingRange, board, heroEquityOpts]);

  const matches = useMemo(() => {
    if (!bdA) return [];
    return classifyScenario({
      range,
      opposingRange,
      board,
      context,
      opposingContext,
      precomputed: mcEquity ? { rangeEquity: mcEquity } : undefined,
    });
  }, [range, opposingRange, board, context, opposingContext, bdA, mcEquity]);

  if (!bdA) return <div className="text-sm text-gray-400">Pick a preflop context and a 3-card flop to begin.</div>;

  const labelA = context
    ? `${context.position} ${context.action}${context.vs ? ' vs ' + context.vs : ''}`
    : 'Focal range';
  const labelB = opposingContext
    ? `${opposingContext.position} ${opposingContext.action}${opposingContext.vs ? ' vs ' + opposingContext.vs : ''}`
    : 'Opposing range';

  return (
    <div className="space-y-5">
      {/* Texture badge */}
      {texture && (
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {texture.isPaired && <span className="px-2 py-0.5 rounded bg-amber-900/60 text-amber-200">paired</span>}
          {texture.monotone && <span className="px-2 py-0.5 rounded bg-purple-900/60 text-purple-200">monotone</span>}
          {texture.twoTone && <span className="px-2 py-0.5 rounded bg-blue-900/60 text-blue-200">two-tone</span>}
          {texture.rainbow && <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300">rainbow</span>}
          {texture.straightPossible && <span className="px-2 py-0.5 rounded bg-teal-900/60 text-teal-200">straight-possible</span>}
          {texture.connected >= 2 && <span className="px-2 py-0.5 rounded bg-green-900/60 text-green-200">connected</span>}
          <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-400">wet-score {texture.wetScore}</span>
        </div>
      )}

      {/* Tier summary chips */}
      <TierSummary bd={bdA} label={`${labelA} — tier summary`} />
      {bdB && <TierSummary bd={bdB} label={`${labelB} — tier summary`} />}

      {/* Hand-type panels side by side (or single if no opposing range) */}
      <div className={bdB ? 'grid grid-cols-2 gap-4' : ''}>
        <HandTypePanel bd={bdA} label={labelA} />
        {bdB && <HandTypePanel bd={bdB} label={labelB} />}
      </div>

      {/* Advantage strip */}
      {nut && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-xs">
            <span className="text-gray-400">Nut region A:</span>{' '}
            <span className="text-teal-300 font-mono">{pctStr(nut.aNutsPct)}</span>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-xs">
            <span className="text-gray-400">Nut region B:</span>{' '}
            <span className="text-teal-300 font-mono">{pctStr(nut.bNutsPct)}</span>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-xs">
            <span className="text-gray-400">Δ:</span>{' '}
            <span className="font-mono text-amber-300">{nut.delta > 0 ? '+' : ''}{nut.delta.toFixed(1)} pp</span>
          </div>
          {mcLoading && (
            <div className="text-xs text-gray-500 italic">computing MC equity…</div>
          )}
          {mcEquity && (
            <div className="bg-gray-800 border border-blue-800 rounded-md px-3 py-1.5 text-xs">
              <span className="text-gray-400">MC equity A:</span>{' '}
              <span className="text-blue-300 font-mono">{pctStr(mcEquity.aEq)}</span>
            </div>
          )}
        </div>
      )}

      {/* Framework chips */}
      {matches.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Applicable frameworks</div>
          <div className="flex flex-wrap gap-1.5">
            {matches.map((m) => <FrameworkChip key={m.framework.id} match={m} />)}
          </div>
        </div>
      )}

      {/* Narrations */}
      <div className="space-y-2">
        {matches.map((m) => <NarrationBlock key={m.framework.id} match={m} />)}
      </div>
    </div>
  );
};

export { FRAMEWORK_COLOR };
