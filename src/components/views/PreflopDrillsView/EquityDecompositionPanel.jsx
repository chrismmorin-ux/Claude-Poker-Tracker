import React, { useState, useEffect, useMemo } from 'react';
import {
  decomposeHandVsHand,
  BUCKETS,
} from '../../../utils/pokerCore/equityDecomposition';
import { parseHandClass } from '../../../utils/pokerCore/preflopEquity';
import {
  ruleOf4And2,
  flushCompletionExact,
  flopPairOneRank,
  flopPairEitherRank,
  directStraightRuns,
  singleCardStraightRuns,
} from '../../../utils/pokerCore/combinatorics';

/**
 * EquityDecompositionPanel — shows where a matchup's equity comes from,
 * broken down by made-hand category, with combo-math explanations.
 *
 * Renders:
 *   1. A stacked bar where each segment's width = bucket.equityShare
 *   2. A table of buckets with hitRate / conditionalWin / equityShare
 *   3. On-demand combo-math hints for the hero hand (flop-pair, flush
 *      outs, straight combos) tied to the most relevant buckets
 *
 * Props:
 *   handALabel, handBLabel — display strings (also used to run decomposition)
 *   loading                — if true, show a spinner instead
 *
 * Decomposition runs lazily when the panel is first expanded — ~1s for an
 * un-cached matchup; subsequent calls are instant (module-level cache).
 */
export const EquityDecompositionPanel = ({ handALabel, handBLabel, loading = false, defaultExpanded = true }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [decomposition, setDecomposition] = useState(null);
  const [computing, setComputing] = useState(false);

  // Compute on first expand (lazy). Re-run when matchup changes.
  useEffect(() => {
    if (!expanded || loading) return;
    if (decomposition && decomposition.handAKey === handALabel && decomposition.handBKey === handBLabel) return;
    setComputing(true);
    // Defer to next tick so the expanding animation doesn't stall.
    const id = setTimeout(() => {
      try {
        const r = decomposeHandVsHand(handALabel, handBLabel);
        setDecomposition({ ...r, handAKey: handALabel, handBKey: handBLabel });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('decomposition failed:', err);
      } finally {
        setComputing(false);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [expanded, loading, handALabel, handBLabel, decomposition]);

  // Reset when matchup changes while collapsed so expand re-triggers compute.
  useEffect(() => { setDecomposition(null); }, [handALabel, handBLabel]);

  const heroCombo = useMemo(() => {
    try { return parseHandClass(handALabel); } catch { return null; }
  }, [handALabel]);

  const comboHints = useMemo(() => {
    if (!heroCombo) return [];
    return buildComboHints(heroCombo);
  }, [heroCombo]);

  if (loading) return null;

  return (
    <div className="mt-4 border-t border-gray-700 pt-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-gray-300 hover:text-white font-semibold"
      >
        {expanded ? '▾' : '▸'} Combinatorics — where the equity comes from
      </button>
      {expanded && (
        <div className="mt-3 space-y-4">
          {computing && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="w-3 h-3 border-2 border-gray-600 border-t-purple-500 rounded-full animate-spin" />
              Decomposing 1.7M runouts…
            </div>
          )}
          {decomposition && !computing && (
            <>
              <BucketBar decomposition={decomposition} handALabel={handALabel} />
              <BucketTable decomposition={decomposition} handALabel={handALabel} />
              <ComboMath hints={comboHints} />
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ---------- Stacked bar ---------- //

const BUCKET_COLORS = [
  'bg-slate-700',      // 0 high card
  'bg-slate-600',      // 1 weak pair
  'bg-purple-700',     // 2 tp/overpair
  'bg-purple-500',     // 3 two pair
  'bg-indigo-500',     // 4 set
  'bg-blue-500',       // 5 straight
  'bg-cyan-500',       // 6 flush
  'bg-amber-500',      // 7 full house
  'bg-rose-500',       // 8 quads
  'bg-pink-500',       // 9 straight flush
];

const BucketBar = ({ decomposition, handALabel }) => {
  // Include buckets where hero has non-trivial equity contribution.
  const totalEquity = decomposition.total;
  if (totalEquity <= 0) {
    return <div className="text-xs text-gray-500">Hero has ~0% equity — nothing to decompose.</div>;
  }
  return (
    <div>
      <div className="text-xs text-gray-400 mb-1">
        {handALabel} equity decomposition (each segment = that bucket's contribution to the {(totalEquity * 100).toFixed(1)}% total)
      </div>
      <div className="flex h-6 rounded overflow-hidden bg-gray-900">
        {decomposition.buckets.map((b) => {
          const share = b.equityShare / totalEquity;
          if (share < 0.005) return null; // don't render tiny slivers
          return (
            <div
              key={b.id}
              className={`${BUCKET_COLORS[b.id]} flex items-center justify-center text-[10px] text-white font-medium`}
              style={{ width: `${share * 100}%` }}
              title={`${b.label}: ${(b.equityShare * 100).toFixed(1)}pp of hero equity · makes it ${(b.hitRate * 100).toFixed(1)}% · wins when made ${(b.conditionalWin * 100).toFixed(1)}%`}
            >
              {share >= 0.08 ? b.shortLabel : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------- Table ---------- //

const BucketTable = ({ decomposition, handALabel }) => {
  const rows = decomposition.buckets.filter((b) => b.hitRate > 0.001);
  return (
    <div className="bg-gray-900/50 rounded p-3">
      <div className="text-xs text-gray-400 mb-2">Per-bucket breakdown</div>
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-1 text-xs font-mono">
        <div className="text-gray-500">Hand category</div>
        <div className="text-gray-500 text-right">Make it</div>
        <div className="text-gray-500 text-right">Win when made</div>
        <div className="text-gray-500 text-right">Equity share</div>
        {rows.map((b) => {
          const color = BUCKET_COLORS[b.id].replace('bg-', 'text-');
          return (
            <React.Fragment key={b.id}>
              <div className={`${color} font-semibold`}>{b.label}</div>
              <div className="text-gray-300 text-right">{(b.hitRate * 100).toFixed(1)}%</div>
              <div className="text-gray-300 text-right">{(b.conditionalWin * 100).toFixed(0)}%</div>
              <div className="text-emerald-300 text-right">{(b.equityShare * 100).toFixed(1)}pp</div>
            </React.Fragment>
          );
        })}
      </div>
      <div className="mt-2 text-[11px] text-gray-500 leading-tight">
        "Make it" = fraction of all 1.7M runouts where {handALabel}'s best 5 is that category.
        {' '}"Win when made" = given {handALabel} makes that hand, how often it wins vs villain.
        {' '}"Equity share" adds up to {handALabel}'s total equity.
      </div>
    </div>
  );
};

// ---------- Combo math ---------- //

const buildComboHints = (heroCombo) => {
  const hints = [];
  const { rankHigh, rankLow, suited, pair } = heroCombo;

  if (pair) {
    // Pair: flop a set with 2 remaining cards of rank.
    const h = flopPairOneRank(2, 50, 3);
    hints.push({
      title: 'Flop a set',
      text: `2 cards of your rank remain in 50 unseen. ${h.note} Flop a set ≈ ${h.pctExact}.`,
    });
  } else {
    // Unpaired: flop a pair of either rank.
    const pair = flopPairEitherRank(3, 3, 50);
    hints.push({
      title: 'Flop a pair',
      text: `3 of ${rankToLabel(rankHigh)} and 3 of ${rankToLabel(rankLow)} remain. ${pair.note}`,
    });
  }

  if (suited && !pair) {
    // Flopped 4-flush to river math (naked case).
    const flush = flushCompletionExact(0, 'flop');
    hints.push({
      title: 'Complete a flush (flopped 4-flush)',
      text: `${flush.note}`,
    });
    const ruleFlop = ruleOf4And2(9, 'flop');
    hints.push({
      title: 'Rule of 4 & 2 (flush draw)',
      text: `${ruleFlop.note}`,
    });
  }

  if (!pair) {
    // Straight combo counts.
    const direct = directStraightRuns(rankHigh, rankLow);
    const single = singleCardStraightRuns(rankHigh, rankLow);
    if (direct.length > 0 || single.length > 0) {
      hints.push({
        title: 'Straight coverage',
        text: `Direct 5-card runs containing BOTH hole cards: ${direct.length} (${direct.map(runHighLabel).join(', ') || 'none'}). ` +
              `Single-card runs (one hole card + 4 board): ${single.length}. ` +
              `Rule of thumb: each direct run is worth ~2pp river equity, each single-card run ~0.7pp.`,
      });
    }
  }

  return hints;
};

const ComboMath = ({ hints }) => {
  if (!hints || hints.length === 0) return null;
  return (
    <div className="bg-gray-900/50 rounded p-3">
      <div className="text-xs text-gray-400 mb-2">Combo math — ways to verify equity in your head</div>
      <div className="space-y-2 text-[12px] text-gray-200">
        {hints.map((h, i) => (
          <div key={i}>
            <div className="font-semibold text-amber-200">{h.title}</div>
            <div className="text-gray-300 font-mono text-[11px] leading-tight mt-0.5">{h.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------- Helpers ---------- //

const RANK_LABELS = '23456789TJQKA';
const rankToLabel = (r) => RANK_LABELS[r];
const runHighLabel = (r) => {
  if (r === 3) return 'A2345 (wheel)';
  const high = RANK_LABELS[r];
  const low = RANK_LABELS[r - 4];
  return `${low}-${high}`;
};
