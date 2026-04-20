import React, { useState } from 'react';
import { EquityDecompositionPanel } from './EquityDecompositionPanel';

/**
 * MatchupBreakdown — shared panel showing exact equity and framework
 * explanations. Used by all four drill modes (Explorer in v1; Estimate,
 * Framework Drill, Library in v2).
 *
 * Props:
 *   handALabel, handBLabel — display strings
 *   result: { equity, winRate, tieRate, loseRate, boardsEnumerated, elapsedMs, cached }
 *   frameworkMatches: output of classifyMatchup (array of { framework, subcase, narration, favored, details })
 *   loading: boolean
 *   hideEquity: optional, for drill modes where the user must guess first
 */
export const MatchupBreakdown = ({
  handALabel,
  handBLabel,
  result,
  frameworkMatches,
  loading = false,
  hideEquity = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  if (loading) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-gray-600 border-t-purple-500 rounded-full animate-spin" />
          <div className="text-sm text-gray-400">Computing exact equity over 1.7M runouts…</div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500 text-sm">Pick two hands to compute equity.</div>
      </div>
    );
  }

  const equityPct = (n) => `${(n * 100).toFixed(1)}%`;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 min-h-[400px]">
      <div className="text-sm font-semibold text-gray-400 mb-2">Exact equity</div>
      <div className="text-xs text-gray-500 mb-4">
        {handALabel} vs {handBLabel}
        {result.cached ? ' · cached' : ''}
        {result.boardsEnumerated ? ` · ${result.boardsEnumerated.toLocaleString()} boards` : ''}
        {typeof result.elapsedMs === 'number' && !result.cached ? ` · ${result.elapsedMs}ms` : ''}
      </div>

      {!hideEquity && (
        <>
          <div className="text-6xl font-bold text-emerald-400 mb-2">
            {equityPct(result.equity)}
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Stat label={`${handALabel} wins`} value={equityPct(result.winRate)} color="text-emerald-300" />
            <Stat label="Tie" value={equityPct(result.tieRate)} color="text-gray-300" />
            <Stat label={`${handBLabel} wins`} value={equityPct(result.loseRate)} color="text-rose-300" />
          </div>
        </>
      )}

      {frameworkMatches?.length > 0 && (
        <div className="border-t border-gray-700 pt-4">
          <div className="text-sm font-semibold text-gray-300 mb-3">Applicable frameworks</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {frameworkMatches.map((m) => (
              <FrameworkChip key={m.framework.id} match={m} />
            ))}
          </div>
          <div className="space-y-2 text-sm text-gray-200">
            {frameworkMatches.map((m) => (
              <div key={m.framework.id} className="flex gap-2">
                <span className="text-gray-500 whitespace-nowrap">{m.framework.name}:</span>
                <span className="flex-1">{m.narration}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {frameworkMatches?.some((m) => m.framework.id === 'straight_coverage') && (
        <div className="mt-4">
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-200 underline"
          >
            {showDetails ? 'Hide' : 'Show'} straight combo details
          </button>
          {showDetails && (
            <CoverageDetails
              match={frameworkMatches.find((m) => m.framework.id === 'straight_coverage')}
              handALabel={handALabel}
              handBLabel={handBLabel}
            />
          )}
        </div>
      )}

      {!hideEquity && (
        <EquityDecompositionPanel handALabel={handALabel} handBLabel={handBLabel} />
      )}
    </div>
  );
};

const Stat = ({ label, value, color }) => (
  <div className="bg-gray-900/60 rounded px-3 py-2">
    <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
    <div className={`text-lg font-semibold ${color}`}>{value}</div>
  </div>
);

const FrameworkChip = ({ match }) => {
  const hue = FRAMEWORK_COLOR[match.framework.id] || 'bg-gray-700 text-gray-200';
  const delta = match.equityDelta;
  const deltaLabel = delta && (delta.favored !== delta.other)
    ? ` ${formatSigned(delta.favored)}`
    : delta && delta.favored === delta.other && delta.favored !== 0
      ? ` ${formatSigned(delta.favored)} each`
      : '';
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${hue}`} title={match.framework.shortDescription}>
      {match.framework.name}{deltaLabel}
    </span>
  );
};

const formatSigned = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

export const FRAMEWORK_COLOR = {
  decomposition: 'bg-slate-700 text-slate-200',
  domination: 'bg-rose-900 text-rose-200',
  pair_over_pair: 'bg-purple-900 text-purple-200',
  race: 'bg-emerald-900 text-emerald-200',
  broadway_vs_connector: 'bg-amber-900 text-amber-200',
  straight_coverage: 'bg-blue-900 text-blue-200',
  flush_contention: 'bg-cyan-900 text-cyan-200',
};

const CoverageDetails = ({ match, handALabel, handBLabel }) => {
  if (!match?.details) return null;
  const { details } = match;
  const fmt = (patterns) =>
    patterns.length === 0 ? 'none' : patterns.map(patternLabel).join(', ');
  return (
    <div className="mt-2 bg-gray-900/60 rounded p-3 text-xs text-gray-300 space-y-3">
      <div className="flex items-center justify-between bg-gray-800/80 rounded px-2 py-1.5">
        <span className="text-gray-400">Coverage score</span>
        <span className="font-mono text-gray-100">
          {handALabel} {details.aCoverageScore.toFixed(1)}  ·  {handBLabel} {details.bCoverageScore.toFixed(1)}
        </span>
      </div>

      <div className="text-[11px] text-gray-500 leading-tight">
        "All" = every 5-card straight this hand can make. "Live" = those still reachable after
        removing blockers (cards the other hand already holds).
      </div>

      <div className="space-y-1">
        <div className="text-[11px] uppercase tracking-wide text-gray-500">{handALabel}</div>
        <div><span className="text-gray-500">Direct (both hole cards) — all:</span> {fmt(details.aPatterns)}</div>
        <div><span className="text-gray-500">Direct — live:</span> {fmt(details.aLivePatterns)}</div>
        <div><span className="text-gray-500">Single-card (one hole card + 4 board) — all:</span> {fmt(details.aSingleCardPatterns)}</div>
        <div><span className="text-gray-500">Single-card — live:</span> {fmt(details.aSingleCardLivePatterns)}</div>
      </div>

      <div className="space-y-1">
        <div className="text-[11px] uppercase tracking-wide text-gray-500">{handBLabel}</div>
        <div><span className="text-gray-500">Direct (both hole cards) — all:</span> {fmt(details.bPatterns)}</div>
        <div><span className="text-gray-500">Direct — live:</span> {fmt(details.bLivePatterns)}</div>
        <div><span className="text-gray-500">Single-card (one hole card + 4 board) — all:</span> {fmt(details.bSingleCardPatterns)}</div>
        <div><span className="text-gray-500">Single-card — live:</span> {fmt(details.bSingleCardLivePatterns)}</div>
      </div>
    </div>
  );
};

const RANK_LABELS = '23456789TJQKA';
const patternLabel = (ranks) => {
  const sorted = [...ranks].sort((a, b) => a - b);
  // Detect wheel: 12, 0, 1, 2, 3
  if (sorted[0] === 0 && sorted[4] === 12) return 'A2345';
  return sorted.map((r) => RANK_LABELS[r]).join('');
};
