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

import React, { useState, useCallback, useEffect } from 'react';
import {
  evaluateDrillNode,
  computePinnedComboEV,
  villainFoldRateFromComposition,
} from '../../../utils/postflopDrillContent/drillModeEngine';
import { isKnownBucket } from '../../../utils/postflopDrillContent/bucketTaxonomy';
import {
  buildArchetypeWeightedRange,
  isKnownArchetype,
} from '../../../utils/postflopDrillContent/archetypeRangeBuilder';
import { archetypeRangeFor } from '../../../utils/postflopDrillContent/archetypeRanges';
import { parseBoard, parseAndEncode } from '../../../utils/pokerCore/cardParser';

// =============================================================================
// Pure data function — testable in isolation
// =============================================================================

/**
 * Parse a combo string like "J♥T♠" into a `{ card1, card2 }` pair of encoded
 * card integers, or null if the string is malformed. `lineSchema.COMBO_REGEX`
 * guarantees the format when authored content passes `validateLine`; this
 * helper is defensive for runtime calls with arbitrary input.
 */
export const parseComboString = (str) => {
  if (typeof str !== 'string' || str.length !== 4) return null;
  const c1 = parseAndEncode(str.slice(0, 2));
  const c2 = parseAndEncode(str.slice(2, 4));
  if (c1 < 0 || c2 < 0 || c1 === c2) return null;
  return { card1: c1, card2: c2 };
};

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
  const combosStr = node?.heroHolding?.combos;
  const pinnedComboStr = Array.isArray(combosStr) && combosStr.length === 1 ? combosStr[0] : null;
  const byBucket = Object.create(null);
  if (candidates.length === 0 && !pinnedComboStr) {
    return { archetype, byBucket, pinnedCombo: null };
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
    return { archetype, byBucket, pinnedCombo: null, rangeError };
  }

  const board = parseBoard(node.board);
  const pot = Number(node.pot) || 0;

  // LSW-H2 (2026-04-22) — hero-combo-specific EV runs alongside bucket
  // evaluation. Computes once (orthogonal to buckets), uses MC vs the
  // archetype-independent base villain range for equity, then applies the
  // archetype-weighted `foldPct` for fold-equity. Fold rate varies with
  // archetype (fish/reg/pro) via the bucket-composition shift — equity
  // does not (showdown equity is fixed once cards are pinned).
  const pinnedComboIds = pinnedComboStr ? parseComboString(pinnedComboStr) : null;
  const pinnedPromise = pinnedComboIds
    ? (async () => {
        try {
          const weightedVillain = buildArchetypeWeightedRange({
            archetype,
            baseRange: villainRange,
            board,
          });
          const foldPct = villainFoldRateFromComposition(weightedVillain);
          const block = await computePinnedComboEV({
            pinnedCombo: pinnedComboIds,
            villainRange,
            board,
            pot,
            foldPct,
          });
          return block ? { ...block, comboString: pinnedComboStr } : null;
        } catch (err) {
          // Pinned path is additive — if it errors, log onto the result
          // but don't poison the bucket response.
          return { error: err.message || String(err), comboString: pinnedComboStr };
        }
      })()
    : Promise.resolve(null);

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
  const [settled, pinnedCombo] = await Promise.all([Promise.all(jobs), pinnedPromise]);
  for (const [bucketId, entry] of settled) {
    byBucket[bucketId] = entry;
  }

  return { archetype, byBucket, pinnedCombo };
};

// =============================================================================
// Presentational component
// =============================================================================

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

/**
 * Controlled panel: `archetype` comes from the parent LineWalkthrough so a
 * single top-bar toggle drives both this panel AND the BranchButton
 * correctness badges (RT-107). Falls back to 'reg' if archetype prop is
 * missing / unknown.
 */
export const BucketEVPanel = ({ node, line, archetype }) => {
  const candidates = node?.heroHolding?.bucketCandidates;
  const hasCandidates = Array.isArray(candidates) && candidates.length > 0;
  const safeArchetype = isKnownArchetype(archetype) ? archetype : 'reg';

  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading]   = useState(false);
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
    runFor(safeArchetype);
  }, [safeArchetype, runFor]);

  // Recompute when the controlling archetype changes AFTER first reveal. The
  // first reveal handler already kicks off the initial run for the current
  // archetype; this effect keeps the table coherent with the toolbar toggle
  // on subsequent changes.
  useEffect(() => {
    if (revealed) runFor(safeArchetype);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeArchetype]);

  if (!hasCandidates) return null;

  return (
    <div className="rounded-lg border border-teal-800/60 bg-teal-900/10 p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-teal-300/90">
            Bucket-level EV
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            How does the answer change with your hand class?
          </div>
        </div>
        {revealed && (
          <div className="text-[10px] uppercase tracking-wide text-gray-500">
            vs {safeArchetype} · change archetype in the toolbar above
          </div>
        )}
      </div>

      {!revealed && (
        <button
          onClick={handleReveal}
          className="w-full bg-teal-700 hover:bg-teal-600 text-white text-sm font-medium px-3 py-2 rounded transition-colors"
        >
          Reveal bucket EVs vs {safeArchetype}
        </button>
      )}

      {revealed && loading && (
        <div className="text-xs text-gray-400 italic py-2">Computing bucket EVs…</div>
      )}

      {revealed && !loading && data && (
        <>
          {data.pinnedCombo && <PinnedComboRow pinnedCombo={data.pinnedCombo} archetype={safeArchetype} />}
          {candidates && candidates.length > 0 && (
            <BucketEVTable
              data={data}
              candidates={candidates}
              pinnedCombos={node?.heroHolding?.combos}
              demoted={Boolean(data.pinnedCombo)}
            />
          )}
        </>
      )}
    </div>
  );
};

// ---------- Sub-component: pinned-combo EV row (LSW-H2) ---------- //

/**
 * Renders the primary EV row for the pinned hero combo. Distinct typography
 * from the bucket-table rows so students read "here is MY hand's EV" as
 * different from "here is the average EV for combos in this bucket class."
 */
const PinnedComboRow = ({ pinnedCombo, archetype }) => {
  if (!pinnedCombo) return null;
  if (pinnedCombo.error) {
    return (
      <div className="rounded border border-rose-800 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
        Per-combo EV error{pinnedCombo.comboString ? ` for ${pinnedCombo.comboString}` : ''}: {pinnedCombo.error}
      </div>
    );
  }
  const bestId = pinnedCombo.ranking?.[0];
  const secondId = pinnedCombo.ranking?.[1];
  const best = bestId ? pinnedCombo.evs[bestId] : null;
  const second = secondId ? pinnedCombo.evs[secondId] : null;
  const comboLabel = pinnedCombo.comboString || `${pinnedCombo.card1},${pinnedCombo.card2}`;
  return (
    <div className="rounded-md border border-amber-700/70 bg-amber-900/20 p-3 space-y-1.5">
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] uppercase tracking-wide text-amber-300/90">
          Your hand · per-combo EV
        </div>
        <div className="text-[10px] uppercase tracking-wide text-gray-500">
          vs {archetype}
        </div>
      </div>
      <div className="flex items-baseline gap-4 flex-wrap">
        <span className="font-mono text-lg text-amber-100">{comboLabel}</span>
        <span className="text-[11px] text-gray-400">
          equity <span className="font-mono text-gray-200">{(pinnedCombo.equity * 100).toFixed(1)}%</span>
        </span>
        {best && (
          <span className="text-[11px] text-gray-400">
            best <span className="text-teal-300 font-medium">{actionLabel(bestId, best)}</span>
            <span className="ml-1.5 font-mono text-teal-200">{formatEV(best.ev)}</span>
          </span>
        )}
        {second && (
          <span className="text-[11px] text-gray-500">
            runner-up <span className="mr-1">{actionLabel(secondId, second)}</span>
            <span className="font-mono">{formatEV(second.ev)}</span>
          </span>
        )}
      </div>
    </div>
  );
};

// ---------- Sub-component: the EV table ---------- //

// LSW-H1 (2026-04-22): when the node pins a specific hero combo, buckets
// whose filter produces zero combos in the authored range are NOT "your
// hand class" — they're either infeasible for the pinned combo or absent
// from the range segment. Surfacing them inline with "No combos in range"
// under a header that reads "Your hand class" is actively misleading. Gate
// them behind a disclosure when a pinned combo is present. Nodes without
// a pinned combo (pure range-level teaching) keep the inline-every-row
// rendering — zero-sample rows are legitimate there.
//
// Heuristic for "applicable": `sampleSize > 0` for a successfully-computed
// result. Not perfect (a bucket the pinned combo doesn't fall in could
// still be non-empty in the range and show a misleading EV — S2, tracked
// under LSW-H2), but a significant honesty improvement over rendering
// every authored bucket regardless.
export const isRowApplicable = (entry) => {
  if (!entry) return false;
  if (entry.error) return false;
  if (!entry.result) return false;
  const caveats = entry.result.caveats || [];
  if (caveats.includes('empty-bucket')) return false;
  return (entry.result.sampleSize || 0) > 0;
};

const BucketEVTable = ({ data, candidates, pinnedCombos, demoted = false }) => {
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

  const hasPinnedCombo = Array.isArray(pinnedCombos) && pinnedCombos.length >= 1;
  const applicable = hasPinnedCombo
    ? candidates.filter((b) => isRowApplicable(data.byBucket[b]))
    : candidates;
  const inapplicable = hasPinnedCombo
    ? candidates.filter((b) => !isRowApplicable(data.byBucket[b]))
    : [];

  // LSW-H2 (2026-04-22): when a pinned-combo row renders above, the bucket
  // table becomes subsidiary. Demote visually (divider + label) and relabel
  // the header from "Your hand class" to something that makes explicit this
  // is NOT per-combo data. Non-demoted mode (no pinned combo) keeps the
  // original "Your hand class" header — it's accurate for pure range-level
  // teaching nodes.
  const headerLabel = demoted
    ? 'Bucket (other combos in your range)'
    : 'Your hand class';

  return (
    <div className="space-y-2">
      {demoted && applicable.length > 0 && (
        <div className="pt-1 text-[10px] uppercase tracking-wide text-gray-500">
          Range-level view · other combos in your range that fall in these buckets
        </div>
      )}
      {applicable.length > 0 ? (
        <div className={`overflow-hidden rounded border ${demoted ? 'border-gray-800' : 'border-gray-700'}`}>
          <table className={`w-full text-xs ${demoted ? 'opacity-80' : ''}`}>
            <thead>
              <tr className="bg-gray-900/60 text-gray-400">
                <th className="text-left px-2.5 py-1.5 font-medium">{headerLabel}</th>
                <th className="text-left px-2.5 py-1.5 font-medium">Best action</th>
                <th className="text-right px-2.5 py-1.5 font-medium">EV</th>
                <th className="text-right px-2.5 py-1.5 font-medium">Runner-up</th>
                <th className="text-center px-2.5 py-1.5 font-medium w-16">Sample</th>
              </tr>
            </thead>
            <tbody>
              {applicable.map((bucketId) => (
                <BucketRow key={bucketId} bucketId={bucketId} entry={data.byBucket[bucketId]} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        hasPinnedCombo && !demoted && (
          <div className="bg-gray-900/40 border border-gray-800 rounded px-3 py-2 text-xs text-gray-400 italic">
            No bucket with live combos for this authored candidate list.
          </div>
        )
      )}

      {hasPinnedCombo && inapplicable.length > 0 && (
        <InapplicableDisclosure buckets={inapplicable} byBucket={data.byBucket} />
      )}

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

// LSW-H1 (2026-04-22): collapsed disclosure for buckets that returned
// zero live combos when the node pins a specific hero combo. Keeps the
// main table focused on buckets that actually carry an EV for hero; still
// shows the inapplicable list on demand so the authored candidate list
// remains auditable from the UI.
const InapplicableDisclosure = ({ buckets, byBucket }) => {
  const [open, setOpen] = useState(false);
  const n = buckets.length;
  return (
    <div className="border border-gray-800 rounded bg-gray-900/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] text-gray-400 hover:text-gray-200"
      >
        <span>
          {n} bucket{n === 1 ? '' : 's'} not applicable to your hand
        </span>
        <span className="text-gray-600">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul className="px-3 py-1.5 text-[11px] text-gray-500 space-y-0.5">
          {buckets.map((bucketId) => {
            const entry = byBucket[bucketId];
            const reason = entry?.error
              ? entry.error
              : (entry?.result?.caveats?.includes('empty-bucket') ? 'no combos in range' : 'no combos');
            return (
              <li key={bucketId} className="font-mono">
                {bucketId} <span className="text-gray-600 italic not-italic font-normal">— {reason}</span>
              </li>
            );
          })}
        </ul>
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
