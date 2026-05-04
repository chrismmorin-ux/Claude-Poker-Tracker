/**
 * @file HSP role-translator: hero equity vs villain range, decomposed into
 * the 4-class role partition (vsValue / vsBluff / vsDraw / vsAir).
 *
 * Composes existing primitives (rangeSegmenter for strength partition +
 * per-bucket equity) and translates strength → role using villain's action
 * context, style, and range polarization signal. Lives in heroState/ (not
 * rangeEngine/ or exploitEngine/) because role-conditioning depends on
 * action+style — downstream of both engines.
 *
 * See `docs/HERO_STATE_DESIGN.md §9` for the audit verdict + full API spec
 * + decision-table derivation.
 *
 * Convention (resolved 2026-05-03 via WS-144 plan-mode AskUserQuestion):
 *   `actionContext.startsWith('VS_')` → villain is aggressor (hero is facing
 *   villain's bet/raise). Bare names (OPEN/CBET/BARREL/PROBE/DONK/3BET/
 *   SQUEEZE) → hero is aggressor → villain is defender.
 *   LIMP_NAV → defender (no aggressor yet in the action history).
 *   MULTIWAY → throws from computeEquityVsRangeParts (HU range-vs-range
 *   reasoning breaks; design doc §7.4).
 */

import { segmentRange, enrichWithEquity } from '../exploitEngine/rangeSegmenter.js';
import { handVsRange } from '../pokerCore/monteCarloEquity.js';

/**
 * Pure mapping function: strength buckets → role buckets given action + style.
 * Extracted as standalone export for unit testability — no async, no equity.
 *
 * @param {object} segResult       - Output of rangeSegmenter.segmentRange().
 * @param {string} actionContext   - One of ACTION_CONTEXTS.
 * @param {object|null} villainStyle - { style, polarization, capped } | null.
 *   - style: 'Fish'|'Nit'|'LAG'|'TAG'|null
 *   - polarization: 0..1 (from gameTreeEquity.computePolarization)
 *   - capped: boolean (from gameTreeSizingHelpers.villainRangeShapeSizing)
 *
 * @returns {{
 *   vsValue: { buckets: string[], totalWeight: number },
 *   vsBluff: { buckets: string[], totalWeight: number },
 *   vsDraw:  { buckets: string[], totalWeight: number },
 *   vsAir:   { buckets: string[], totalWeight: number }
 * }}
 *   buckets: list of strength-bucket names contributing to this role.
 *   totalWeight: sum of segResult.buckets[s].weightSum for s in buckets.
 */
export const translateStrengthToRole = (segResult, actionContext, villainStyle) => {
  // VS_* contexts mean hero is facing villain's aggression → villain is aggressor.
  // Bare names (OPEN, CBET, BARREL, PROBE, DONK, 3BET, SQUEEZE) → hero is the
  // aggressor → villain is defender. LIMP_NAV → defender (no aggressor yet).
  const villainIsAggressor = actionContext.startsWith('VS_');

  const polarizationFromStyle = villainStyle?.polarization ?? 0;
  const nutsPct = segResult.buckets.nuts.pct;
  const airPct = segResult.buckets.air.pct;
  const isPolarized = polarizationFromStyle >= 0.5 || (nutsPct + airPct) > 60;

  // Per spec §9.3 decision table (mirrors §9.1 Q2):
  //   defender:                      marginal → vsValue (bluff-catcher)
  //   aggressor + polarized:         marginal → vsBluff (capped float)
  //   aggressor + linear:            marginal → vsValue (thin value)
  let marginalRole;
  if (!villainIsAggressor) {
    marginalRole = 'vsValue';
  } else if (isPolarized) {
    marginalRole = 'vsBluff';
  } else {
    marginalRole = 'vsValue';
  }

  // Per spec §9.3:
  //   aggressor + polarized:         air → vsBluff (intentional bluffs)
  //   otherwise:                     air → vsAir
  const airRole = (villainIsAggressor && isPolarized) ? 'vsBluff' : 'vsAir';

  const vsValueBuckets = ['nuts', 'strong'];
  if (marginalRole === 'vsValue') vsValueBuckets.push('marginal');

  const vsBluffBuckets = [];
  if (marginalRole === 'vsBluff') vsBluffBuckets.push('marginal');
  if (airRole === 'vsBluff') vsBluffBuckets.push('air');

  const vsDrawBuckets = ['draw']; // empty by construction on river

  const vsAirBuckets = [];
  if (airRole === 'vsAir') vsAirBuckets.push('air');

  const sumWeight = (buckets) =>
    buckets.reduce((acc, b) => acc + (segResult.buckets[b]?.weightSum ?? 0), 0);

  return {
    vsValue: { buckets: vsValueBuckets, totalWeight: sumWeight(vsValueBuckets) },
    vsBluff: { buckets: vsBluffBuckets, totalWeight: sumWeight(vsBluffBuckets) },
    vsDraw: { buckets: vsDrawBuckets, totalWeight: sumWeight(vsDrawBuckets) },
    vsAir: { buckets: vsAirBuckets, totalWeight: sumWeight(vsAirBuckets) },
  };
};

/**
 * Compute hero hand equity vs villain range, decomposed into the HSP 4-class
 * role partition.
 *
 * @param {object} args
 * @param {[number, number]} args.heroCards  - Encoded hero cards.
 * @param {Float64Array} args.villainRange   - Narrowed 169-cell range.
 * @param {number[]} args.board              - 3-5 encoded board cards (preflop: empty array).
 * @param {('preflop'|'flop'|'turn'|'river')} args.street
 * @param {string} args.actionContext        - One of ACTION_CONTEXTS.
 * @param {object|null} args.villainStyle    - { style, polarization, capped } | null.
 * @param {{trials?: number, fullRange?: Float64Array, equityFn?: function}} [args.options]
 *
 * @returns {Promise<{
 *   vsValue: number|null,
 *   vsBluff: number|null,
 *   vsDraw: number|null,
 *   vsAir: number|null,
 *   overall: number,
 *   strengthBreakdown: {segResult: object, bucketEquities: object} | null
 * }>}
 *   Each role-bucket equity is a weighted average of the strength-bucket
 *   equities that map to it, or null when the role partition has zero weight
 *   in this state (e.g., vsDraw on river; vsBluff/vsDraw preflop).
 *
 * @throws {Error} when actionContext === 'MULTIWAY' (HU range-vs-range
 *   reasoning breaks; design doc §7.4).
 */
export const computeEquityVsRangeParts = async ({
  heroCards,
  villainRange,
  board,
  street,
  actionContext,
  villainStyle,
  options = {},
}) => {
  if (actionContext === 'MULTIWAY') {
    throw new Error(
      'equityVsRangeParts: MULTIWAY not supported in v1 (design doc §7.4). ' +
      'Pass HU-narrowed range or compute per-villain.'
    );
  }

  const equityFn = options.equityFn ?? handVsRange;
  const trials = options.trials ?? 2000;

  if (street === 'preflop') {
    const overallResult = await equityFn(heroCards, villainRange, [], { trials });
    return {
      vsValue: null,
      vsBluff: null,
      vsDraw: null,
      vsAir: null,
      overall: overallResult.equity,
      strengthBreakdown: null,
    };
  }

  const segResult = segmentRange(villainRange, board, [...heroCards], null);
  const { bucketEquities, overallEquity } = await enrichWithEquity(
    segResult,
    heroCards,
    options,
  );

  const roleMapping = translateStrengthToRole(segResult, actionContext, villainStyle);

  const aggregateRole = (role) => {
    const { buckets, totalWeight } = roleMapping[role];
    if (totalWeight <= 0) return null;
    let weightedSum = 0;
    let usedWeight = 0;
    for (const b of buckets) {
      const eq = bucketEquities[b];
      const w = segResult.buckets[b]?.weightSum ?? 0;
      if (eq === null || eq === undefined || w <= 0) continue;
      weightedSum += eq * w;
      usedWeight += w;
    }
    return usedWeight > 0 ? weightedSum / usedWeight : null;
  };

  return {
    vsValue: aggregateRole('vsValue'),
    vsBluff: aggregateRole('vsBluff'),
    vsDraw: aggregateRole('vsDraw'),
    vsAir: aggregateRole('vsAir'),
    overall: overallEquity,
    strengthBreakdown: { segResult, bucketEquities },
  };
};
