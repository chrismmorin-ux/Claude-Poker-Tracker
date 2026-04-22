/**
 * drillModeEngine.js — RT-111 drill-mode engine wrapper.
 *
 * Single entry point for any drill-layer consumer that wants an EV ranking
 * for a hero bucket on a specific board against an archetype-weighted
 * villain range. Integrates the RT-110 bucket taxonomy + RT-112 archetype
 * range-delta builder + deterministic fold-equity math into one call.
 *
 * After this module ships, direct imports of `exploitEngine/gameTreeEvaluator`
 * from drill-content modules are forbidden — INV-08.a exception permits
 * `postflopDrillContent → exploitEngine` only via this wrapper's caveats
 * contract (see `.claude/context/INVARIANTS.md` INV-08.a).
 *
 * ## v1 scope (2026-04-21)
 *
 * The wrapper ships the **full output shape** so consumers can rely on it,
 * but uses a **simplified EV model** that does NOT call `evaluateGameTree`
 * depth-2/3 machinery:
 *
 * - Hero equity per bucket comes from a coarse authored table
 *   (`HERO_BUCKET_TYPICAL_EQUITY`) — archetype-invariant in v1.
 * - Villain fold rate is derived from the archetype-reweighted bucket
 *   composition × `POP_CALLING_RATES`. This IS archetype-responsive —
 *   fish/reg/pro shift the fold rate via their bucket multipliers.
 * - `bailedOut` is always `false` in v1 (no async depth-2 path).
 *
 * ## Depth-2 integration (forward requirement)
 *
 * The v1 output always carries `caveats: [..., 'v1-simplified-ev']`. When
 * the follow-up ticket wires `evaluateGameTree`, it should:
 *   1. Use the optional `depth2Eval` parameter as the injection point.
 *   2. Remove the `'v1-simplified-ev'` caveat when `depth2Eval` was used.
 *   3. Propagate the `bailedOut` flag from `gameTreeDepth2.js:838-839`.
 *   4. Add an EV-cache with an `engineVersion` stamp per NEV-12 — invalidate
 *      cache entries on mismatch (RT-118 forward requirement).
 *
 * ## Caveats ALWAYS present
 *
 * - `'synthetic-range'` — per the roundtable's Q2 resolution, every drill
 *   bucket-EV output carries this caveat because the villain range is an
 *   archetype stub, not a learned range from observed hands.
 * - `'v1-simplified-ev'` — removed when depth-2 integration lands.
 *
 * ## Caveats conditionally present
 *
 * - `'low-sample-bucket'` — hero bucket has < MIN_COMBO_SAMPLE live combos.
 * - `'empty-bucket'` — hero bucket has zero live combos (sampleSize === 0).
 * - `'time-budget-bailout'` — depth-2 integration hit wall-clock budget
 *   (only when `depth2Eval` is wired).
 *
 * Pure module (import-only). Async because the depth-2 injection path is
 * async; v1 returns synchronously-resolved promise.
 */

import { enumerateBucketCombos } from './bucketTaxonomy';
import {
  buildArchetypeWeightedRange,
  aggregateBucketWeights,
  isKnownArchetype,
} from './archetypeRangeBuilder';
import { MIN_COMBO_SAMPLE } from './handTypeBreakdown';
import { calcValueBetEV } from '../exploitEngine/foldEquityCalculator';
import { POP_CALLING_RATES } from '../exploitEngine/gameTreeConstants';

/**
 * Coarse "typical equity vs villain's range" table keyed by hero bucket.
 *
 * These numbers are v1 authoring priors, not fitted constants. They are
 * archetype-invariant — archetype responsiveness comes from the fold-rate
 * derivation (different bucket mix → different calling frequency), not
 * from this table.
 *
 * Full game-tree integration in a follow-up ticket will replace this with
 * per-combo equity computed by `evaluateGameTree`.
 */
export const HERO_BUCKET_TYPICAL_EQUITY = Object.freeze({
  // Monsters
  straightFlush: 0.99,
  quads:         0.99,
  boat:          0.97,
  fullHouse:     0.97,
  // Flushes
  nutFlush:      0.92,
  flush:         0.88,
  secondFlush:   0.85,
  weakFlush:     0.78,
  // Straights
  nutStraight:   0.86,
  straight:      0.82,
  // Strong made
  set:           0.87,
  trips:         0.83,
  twoPair:       0.80,
  // Pairs
  overpair:      0.72,
  tptk:          0.68,
  topPair:       0.62,
  topPairWeak:   0.55,
  middlePair:    0.45,
  bottomPair:    0.35,
  weakPair:      0.25,
  // Draws
  flushDraw:       0.35,
  nutFlushDraw:    0.40,
  nonNutFlushDraw: 0.32,
  comboDraw:       0.50,
  openEnder:       0.32,
  oesd:            0.32,
  gutshot:         0.20,
  overcards:       0.25,
  // Backdoor-only draws (LSW-G3, 2026-04-22). Rough combinatorial-anchored
  // priors vs a typical polar / made-hand range on a 3-flush / 3-connected
  // flop. BDFD completes hearts runner-runner ~4.2% of the time (two hearts
  // on turn+river); BDSD needs two running cards to complete a straight,
  // ~3% realized on a 3-connected board. Equity when hit: ~85-95% given
  // villain's range is mostly made hands. Equity when missed: ~5-8%
  // (raw air vs polar range). Linear approximation per-axis:
  //   airBackdoorFlush    ≈ 0.08 + 0.042 * (0.9 - 0.08) = ~0.11 raw, but
  //     floor-lifted to ~0.20 to account for fold-equity / realization
  //     (BDFD outs are "clean" — villain can't easily see the board texture
  //     and semi-bluff credibility is higher). Treat as upper-end of plausible.
  //   airBackdoorStraight ≈ similar math but BDSD is less reliable on
  //     highly-connected boards (villain may already have better straight
  //     draws). Pull to ~0.15.
  //   airBackdoorCombo    ≈ additive but with correlation discount ~0.25.
  //   backdoorFlushDraw (aggregate BDFD alone + BDFD-in-combo): weight-avg ~0.22.
  //   backdoorStraightDraw (aggregate BDSD alone + BDFD-in-combo): ~0.18.
  //   backdoorCombo: 0.25 (same as airBackdoorCombo — bucket aliases).
  // These are v1 authoring priors, will be tightened by LSW-D1 depth-2
  // integration once per-combo equity from the game tree replaces this
  // coarse table.
  airBackdoorFlush:     0.20,
  airBackdoorStraight:  0.15,
  airBackdoorCombo:     0.25,
  backdoorFlushDraw:    0.22,
  backdoorStraightDraw: 0.18,
  backdoorCombo:        0.25,
  // Nothing
  air:             0.10,
});

/**
 * Default action set — check, small bet, medium bet, overbet. Callers may
 * pass their own `actions` array with custom sizing or action kinds.
 */
export const DEFAULT_ACTIONS = Object.freeze([
  Object.freeze({ id: 'check',    kind: 'check' }),
  Object.freeze({ id: 'bet_33',   kind: 'bet', sizing: 0.33 }),
  Object.freeze({ id: 'bet_75',   kind: 'bet', sizing: 0.75 }),
  Object.freeze({ id: 'bet_150',  kind: 'bet', sizing: 1.50 }),
]);

/**
 * Derive villain's aggregate fold rate against a bet, given the archetype-
 * reweighted bucket composition and population calling rates.
 *
 * foldRate = 1 - Σ (bucketPct_i × POP_CALLING_RATES[bucket_i])
 *
 * Archetype-responsive: fish's up-weighted marginal bucket shifts the
 * aggregate call rate up, which drops the fold rate.
 */
export const villainFoldRateFromComposition = (weightedRange) => {
  const total = weightedRange.totalWeight;
  if (total <= 0) return 0;
  const bucketSums = aggregateBucketWeights(weightedRange);
  let callRate = 0;
  for (const [bucket, w] of Object.entries(bucketSums)) {
    const callProb = POP_CALLING_RATES[bucket] ?? 0;
    callRate += (w / total) * callProb;
  }
  const foldPct = 1 - callRate;
  return Math.max(0, Math.min(1, foldPct));
};

/**
 * Main entry — evaluate drill node.
 *
 * @param {{
 *   bucketId: string,                 // from bucketTaxonomy
 *   archetype: string,                // 'fish'|'reg'|'pro'
 *   heroRange: Float64Array,          // hero's preflop range (169-cell grid)
 *   villainRange: Float64Array,       // villain's base preflop range
 *   board: number[],                  // encoded cards (3-5)
 *   pot: number,                      // bb
 *   effStack?: number,                // bb; default 100
 *   actions?: Array<{id, kind, sizing?}>,
 *   depth2Eval?: Function | null,     // future injection point (see module doc)
 * }} args
 * @returns {Promise<{
 *   bucketId: string,
 *   archetype: string,
 *   sampleSize: number,
 *   evs: Record<string, { ev: number, action: string, kind: string, sizing?: number }>,
 *   ranking: string[],                // action IDs, best EV first
 *   bailedOut: boolean,
 *   caveats: string[],
 * }>}
 */
export const evaluateDrillNode = async ({
  bucketId,
  archetype,
  heroRange,
  villainRange,
  board,
  pot,
  // eslint-disable-next-line no-unused-vars
  effStack = 100,
  actions = DEFAULT_ACTIONS,
  depth2Eval = null,
}) => {
  if (!bucketId || typeof bucketId !== 'string') {
    throw new Error('evaluateDrillNode: bucketId required');
  }
  if (!isKnownArchetype(archetype)) {
    throw new Error(`evaluateDrillNode: unknown archetype '${archetype}'`);
  }
  if (!heroRange || !villainRange) {
    throw new Error('evaluateDrillNode: heroRange and villainRange required');
  }
  if (!Array.isArray(board) || board.length < 3 || board.length > 5) {
    throw new Error('evaluateDrillNode: board must have 3-5 encoded cards');
  }
  if (typeof pot !== 'number' || pot < 0) {
    throw new Error('evaluateDrillNode: pot must be a non-negative number');
  }
  if (!Array.isArray(actions) || actions.length === 0) {
    throw new Error('evaluateDrillNode: actions must be a non-empty array');
  }

  // 1. Enumerate hero combos in this bucket.
  const heroCombos = enumerateBucketCombos({ bucketId, board, range: heroRange });
  if (heroCombos === null) {
    throw new Error(`evaluateDrillNode: unknown bucketId '${bucketId}'`);
  }
  const sampleSize = heroCombos.sampleSize;

  // 2. Reweight villain range per archetype. Table-lookup only — no
  //    `if (archetype === ...)` branching (NEV-03/RT-112 rule).
  const weightedVillain = buildArchetypeWeightedRange({
    archetype,
    baseRange: villainRange,
    board,
  });

  // 3. Hero's typical equity for this bucket (v1 coarse prior).
  const heroEq = HERO_BUCKET_TYPICAL_EQUITY[bucketId] ?? 0.5;

  // 4. Villain's fold rate against a bet, given the archetype-weighted
  //    bucket composition.
  const foldPct = villainFoldRateFromComposition(weightedVillain);

  // 5. Per-action EV. Check is heroEq × pot (go to showdown); bets use
  //    `calcValueBetEV` from foldEquityCalculator.
  const evs = Object.create(null);
  for (const action of actions) {
    if (action.kind === 'check') {
      evs[action.id] = {
        ev: heroEq * pot,
        action: action.id,
        kind: 'check',
      };
      continue;
    }
    if (action.kind === 'bet') {
      const sizing = typeof action.sizing === 'number' ? action.sizing : 0.75;
      const betSize = pot * sizing;
      const { ev, isProfitable } = calcValueBetEV({
        potSize: pot,
        betSize,
        foldPct,
        heroEquity: heroEq,
      });
      evs[action.id] = {
        ev,
        action: action.id,
        kind: 'bet',
        sizing,
        isProfitable,
      };
      continue;
    }
    // Unknown action kinds fall through — caller must extend the wrapper
    // for their custom kinds. Defaults are check/bet only.
    evs[action.id] = {
      ev: 0,
      action: action.id,
      kind: action.kind,
      unsupported: true,
    };
  }

  // 6. Ranking — action IDs sorted by EV descending.
  const ranking = Object.entries(evs)
    .sort(([, a], [, b]) => b.ev - a.ev)
    .map(([id]) => id);

  // 7. Caveats.
  const caveats = [];
  // Always — per owner Q2 on the roundtable: ship with synthetic-range caveat.
  caveats.push('synthetic-range');
  // v1 stays present until depth-2 integration lands.
  if (!depth2Eval) caveats.push('v1-simplified-ev');
  // Sample-size caveats.
  if (sampleSize === 0) caveats.push('empty-bucket');
  else if (sampleSize < MIN_COMBO_SAMPLE) caveats.push('low-sample-bucket');

  // 8. bailedOut — always false in v1. Depth-2 integration will populate
  //    from `gameTreeDepth2.js:838-839` via the injection.
  let bailedOut = false;
  if (depth2Eval && typeof depth2Eval.wasBailout === 'function') {
    bailedOut = Boolean(depth2Eval.wasBailout());
    if (bailedOut) caveats.push('time-budget-bailout');
  }

  return {
    bucketId,
    archetype,
    sampleSize,
    evs,
    ranking,
    bailedOut,
    caveats,
  };
};
