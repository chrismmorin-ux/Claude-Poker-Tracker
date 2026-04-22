/**
 * BucketEVPanel — surfaces per-hero-bucket EV from drillModeEngine on a
 * Line Study node that declares `heroHolding.bucketCandidates`.
 *
 * First user-visible payoff of the 2026-04-21 bucket-teaching roundtable
 * (RT-106..118). Reveal-on-click pattern matches the existing
 * `ExampleSection` — keeps the 1600×720 viewport clean until the student
 * opts in, then surfaces the EV table per bucket × archetype.
 *
 * Separation: the pure `computeBucketEVs` function does the data work
 * (testable in isolation). The component is a thin shell around reveal
 * state + archetype selection.
 */

import React, { useState, useCallback } from 'react';
import { evaluateDrillNode } from '../../../utils/postflopDrillContent/drillModeEngine';
import { isKnownBucket } from '../../../utils/postflopDrillContent/bucketTaxonomy';
import { listKnownArchetypes } from '../../../utils/postflopDrillContent/archetypeRangeBuilder';
import { archetypeRangeFor } from '../../../utils/postflopDrillContent/archetypeRanges';
import { parseBoard } from '../../../utils/pokerCore/cardParser';

// =============================================================================
// Pure data function — testable in isolation
// =============================================================================

/**
 * Compute bucket-EV results for every `heroHolding.bucketCandidates` entry
 * on a node, against a specific villain archetype.
 *
 * @param {{
 *   node: { board: string[], pot: number, heroHolding?: { bucketCandidates?: string[] } },
 *   line: { setup: { hero: object, villains: object[] } },
 *   archetype: string,
 * }} args
 * @returns {Promise<{
 *   archetype: string,
 *   byBucket: Record<string, { result?: object, error?: string }>,
 *   rangeError?: string,
 * }>}
 */
export const computeBucketEVs = async ({ node, line, archetype }) => {
  const candidates = node?.heroHolding?.bucketCandidates || [];
  const byBucket = Object.create(null);
  if (candidates.length === 0) {
    return { archetype, byBucket };
  }

  // Derive hero + villain ranges. archetypeRangeFor throws when the (position,
  // action, vs) tuple isn't in the range library (e.g., calling-a-3bet is
  // not covered in v1). When that happens we still populate `byBucket` with
  // per-bucket error entries so consumers can differentiate the taxonomy-
  // level unknown-bucket case from the library-level range-unavailable case.
  let heroRange = null;
  let villainRange = null;
  let rangeError;
  try {
    heroRange = archetypeRangeFor({
      position: line.setup.hero.position,
      action: line.setup.hero.action,
      vs: line.setup.hero.vs,
    });
  } catch (err) {
    rangeError = `Hero range (${line.setup.hero.position} ${line.setup.hero.action}): ${err.message || err}`;
  }
  if (!rangeError) {
    try {
      const v = line.setup.villains?.[0];
      if (!v) throw new Error('no villain in line setup');
      villainRange = archetypeRangeFor({
        position: v.position,
        action: v.action,
        vs: v.vs,
      });
    } catch (err) {
      rangeError = `Villain range: ${err.message || err}`;
    }
  }

  // Even on range failure, still classify each candidate so unknown-bucket
  // entries surface as their own error (taxonomy layer is independent of
  // range layer).
  if (rangeError) {
    for (const bucketId of candidates) {
      if (typeof bucketId !== 'string' || !isKnownBucket(bucketId)) {
        byBucket[bucketId] = { error: 'unknown-bucket' };
      } else {
        byBucket[bucketId] = { error: 'range-unavailable' };
      }
    }
    return { archetype, byBucket, rangeError };
  }

  const board = parseBoard(node.board);
  const pot = Number(node.pot) || 0;

  // Ranges available — run per-bucket evaluations in parallel.
  const jobs = candidates.map(async (bucketId) => {
    if (typeof bucketId !== 'string' || !isKnownBucket(bucketId)) {
      return [bucketId, { error: 'unknown-bucket' }];
    }
    try {
      const result = await evaluateDrillNode({
        bucketId, archetype, heroRange, villainRange, board, pot,
      });
      return [bucketId, { result }];
    } catch (err) {
      return [bucketId, { error: err.message || String(err) }];
    }
  });
  const settled = await Promise.all(jobs);
  for (const [bucketId, entry] of settled) {
    byBucket[bucketId] = entry;
  }

  return { archetype, byBucket };
};

// =============================================================================
// Presentational component
// =============================================================================

const ARCHETYPE_LABELS = {
  fish: 'Fish',
  reg: 'Reg',
  pro: 'Pro',
};

const formatEV = (ev) => {
  if (!Number.isFinite(ev)) return '—';
  const sign = ev >= 0 ? '+' : '';
  return `${sign}${ev.toFixed(2)}bb`;
};

const actionLabel = (actionId, evEntry) => {
  if (!evEntry) return actionId;
  if (evEntry.kind === 'check') return 'check';
  if (evEntry.kind === 'bet' && typeof evEntry.sizing === 'number') {
    return `bet ${Math.round(evEntry.sizing * 100)}%`;
  }
  return actionId;
};

const CAVEAT_LABELS = {
  'synthetic-range':    'synthetic range',
  'v1-simplified-ev':   'simplified EV',
  'low-sample-bucket':  'low sample',
  'empty-bucket':       'no combos',
  'time-budget-bailout': 'partial result',
};

export const BucketEVPanel = ({ node, line }) => {
  const candidates = node?.heroHolding?.bucketCandidates;
  const hasCandidates = Array.isArray(candidates) && candidates.length > 0;

  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [archetype, setArchetype] = useState('fish');
  const [data, setData] = useState(null);

  const runFor = useCallback(async (arch) => {
    setLoading(true);
    try {
      const out = await computeBucketEVs({ node, line, archetype: arch });
      setData(out);
    } catch (err) {
      setData({ archetype: arch, byBucket: Object.create(null), rangeError: err.message });
    } finally {
      setLoading(false);
    }
  }, [node, line]);

  const handleReveal = useCallback(() => {
    setRevealed(true);
    runFor(archetype);
  }, [archetype, runFor]);

  const handleArchetypeChange = useCallback((next) => {
    setArchetype(next);
    if (revealed) runFor(next);
  }, [revealed, runFor]);

  if (!hasCandidates) return null;

  return (
    <div className="rounded-lg border border-teal-800/60 bg-teal-900/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-teal-300/90">
            Bucket-level EV
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            How does the answer change with your hand class and villain type?
          </div>
        </div>
        {revealed && (
          <div className="flex gap-1">
            {listKnownArchetypes().map((a) => {
              const active = a === archetype;
              return (
                <button
                  key={a}
                  onClick={() => handleArchetypeChange(a)}
                  disabled={loading}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                    active
                      ? 'bg-teal-700/40 border-teal-600 text-teal-100'
                      : 'bg-gray-900/50 border-gray-700 text-gray-300 hover:border-gray-500'
                  } disabled:opacity-50`}
                  title={`Villain archetype: ${ARCHETYPE_LABELS[a] || a}`}
                >
                  {ARCHETYPE_LABELS[a] || a}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!revealed && (
        <button
          onClick={handleReveal}
          className="w-full bg-teal-700 hover:bg-teal-600 text-white text-sm font-medium px-3 py-2 rounded transition-colors"
        >
          Reveal bucket EVs
        </button>
      )}

      {revealed && loading && (
        <div className="text-xs text-gray-400 italic py-2">Computing bucket EVs…</div>
      )}

      {revealed && !loading && data && (
        <BucketEVTable data={data} candidates={candidates} />
      )}
    </div>
  );
};

// ---------- Sub-component: the EV table ---------- //

const BucketEVTable = ({ data, candidates }) => {
  if (data.rangeError) {
    return (
      <div className="bg-rose-900/30 border border-rose-800 text-rose-200 rounded px-3 py-2 text-xs">
        Range unavailable — {data.rangeError}
      </div>
    );
  }

  // Collect global caveats across all successful bucket results (dedup).
  const globalCaveats = new Set();
  for (const entry of Object.values(data.byBucket)) {
    if (entry?.result?.caveats) {
      for (const c of entry.result.caveats) globalCaveats.add(c);
    }
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded border border-gray-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-900/60 text-gray-400">
              <th className="text-left px-2.5 py-1.5 font-medium">Your hand class</th>
              <th className="text-left px-2.5 py-1.5 font-medium">Best action</th>
              <th className="text-right px-2.5 py-1.5 font-medium">EV</th>
              <th className="text-right px-2.5 py-1.5 font-medium">Runner-up</th>
              <th className="text-center px-2.5 py-1.5 font-medium w-16">Sample</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((bucketId) => (
              <BucketRow key={bucketId} bucketId={bucketId} entry={data.byBucket[bucketId]} />
            ))}
          </tbody>
        </table>
      </div>

      {globalCaveats.size > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center text-[10px] text-gray-500">
          <span className="uppercase tracking-wide">Caveats:</span>
          {[...globalCaveats].map((c) => (
            <span
              key={c}
              className="px-1.5 py-0.5 rounded bg-gray-800/70 border border-gray-700 text-gray-300"
            >
              {CAVEAT_LABELS[c] || c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const BucketRow = ({ bucketId, entry }) => {
  if (!entry) {
    return (
      <tr className="border-t border-gray-800">
        <td colSpan={5} className="px-2.5 py-1.5 text-gray-500 italic">No data for {bucketId}</td>
      </tr>
    );
  }
  if (entry.error === 'unknown-bucket') {
    return (
      <tr className="border-t border-gray-800">
        <td className="px-2.5 py-1.5 font-mono text-gray-400">{bucketId}</td>
        <td colSpan={4} className="px-2.5 py-1.5 text-gray-500 italic">
          Unknown bucket — authored content references a label not in the v1 taxonomy.
        </td>
      </tr>
    );
  }
  if (entry.error) {
    return (
      <tr className="border-t border-gray-800">
        <td className="px-2.5 py-1.5 font-mono text-gray-400">{bucketId}</td>
        <td colSpan={4} className="px-2.5 py-1.5 text-rose-300 italic">Error: {entry.error}</td>
      </tr>
    );
  }

  const result = entry.result;
  const bestId = result.ranking[0];
  const secondId = result.ranking[1];
  const best = result.evs[bestId];
  const second = secondId ? result.evs[secondId] : null;
  const sampleLow = result.caveats.includes('low-sample-bucket') || result.caveats.includes('empty-bucket');
  const emptyBucket = result.caveats.includes('empty-bucket');

  return (
    <tr className="border-t border-gray-800 hover:bg-gray-900/40">
      <td className="px-2.5 py-1.5 font-mono text-gray-200">{bucketId}</td>
      {emptyBucket ? (
        <td colSpan={3} className="px-2.5 py-1.5 text-gray-500 italic">
          No combos in range
        </td>
      ) : (
        <>
          <td className="px-2.5 py-1.5 text-teal-300 font-medium">{actionLabel(bestId, best)}</td>
          <td className="px-2.5 py-1.5 text-right font-mono text-teal-200">{formatEV(best.ev)}</td>
          <td className="px-2.5 py-1.5 text-right text-gray-400">
            {second ? (
              <span>
                <span className="text-[10px] mr-1">{actionLabel(secondId, second)}</span>
                <span className="font-mono">{formatEV(second.ev)}</span>
              </span>
            ) : (
              '—'
            )}
          </td>
        </>
      )}
      <td className="px-2.5 py-1.5 text-center">
        <span className={sampleLow ? 'text-amber-300' : 'text-gray-500'} title={`${result.sampleSize} combo${result.sampleSize === 1 ? '' : 's'}`}>
          {result.sampleSize}
        </span>
      </td>
    </tr>
  );
};
