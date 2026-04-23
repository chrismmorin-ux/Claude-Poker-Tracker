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
 *
 * Commit 1 of LSW-G4-IMPL (2026-04-22): sub-components (PinnedComboRow,
 * DominationMapDisclosure, BucketEVTable, BucketRow, InapplicableDisclosure)
 * extracted to `./panels/` with no behavior change. The pure data functions
 * and the composition shell remain here. `isRowApplicable` moved to
 * `./panels/panelHelpers.js` and re-exported below for test back-compat.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  evaluateDrillNode,
  computePinnedComboEV,
  computeDominationMap,
  villainFoldRateFromComposition,
} from '../../../utils/postflopDrillContent/drillModeEngine';
import { isKnownBucket } from '../../../utils/postflopDrillContent/bucketTaxonomy';
import {
  buildArchetypeWeightedRange,
  isKnownArchetype,
} from '../../../utils/postflopDrillContent/archetypeRangeBuilder';
import { archetypeRangeFor } from '../../../utils/postflopDrillContent/archetypeRanges';
import { parseBoard, parseAndEncode } from '../../../utils/pokerCore/cardParser';
import { PinnedComboRow } from './panels/PinnedComboRow';
import { DominationMapDisclosure } from './panels/DominationMapDisclosure';
import { BucketEVTable } from './panels/BucketEVTable';
import { isRowApplicable as isRowApplicableImpl } from './panels/panelHelpers';

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
          const [block, dominationMap] = await Promise.all([
            computePinnedComboEV({
              pinnedCombo: pinnedComboIds,
              villainRange,
              board,
              pot,
              foldPct,
            }),
            // LSW-G5 (2026-04-22): domination map runs alongside the EV
            // computation. Uses the BASE villain range (archetype-invariant)
            // since hero's showdown equity vs JJ doesn't change based on
            // whether villain is fish or pro — only the weightPct distribution
            // would shift slightly with archetype-weighting, and the base-
            // range composition is the dominant structural signal. A future
            // refinement could feed the archetype-weighted range in for
            // weightPct precision; v1 keeps the simpler base-range path.
            computeDominationMap({
              pinnedCombo: pinnedComboIds,
              villainRange,
              board,
            }).catch(() => null),
          ]);
          return block ? { ...block, comboString: pinnedComboStr, dominationMap } : null;
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

/**
 * Re-exported from `./panels/panelHelpers.js` for test back-compat.
 * Tests import `isRowApplicable` from this file's surface; moving the
 * implementation is an internal reorganization.
 */
export const isRowApplicable = isRowApplicableImpl;

// =============================================================================
// Presentational component
// =============================================================================

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
          {data.pinnedCombo?.dominationMap && data.pinnedCombo.dominationMap.length > 0 && (
            <DominationMapDisclosure dominationMap={data.pinnedCombo.dominationMap} />
          )}
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
