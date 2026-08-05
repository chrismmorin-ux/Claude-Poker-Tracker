/**
 * equityDecomposition.js — break down hand-vs-hand equity by made-hand bucket.
 *
 * For a given hand-vs-hand matchup, enumerate all C(48,5) boards and categorize
 * each board by hero's final made-hand category (high-card, weak pair, top
 * pair / overpair, two pair, set, straight, flush, full house, quads, straight
 * flush). For each bucket we report:
 *   - hitRate:          fraction of boards where hero's best 5 is that category
 *   - winShare:         fraction of boards where hero wins AND hero's hand is
 *                       that category (sums to hero's total win rate)
 *   - tieShare:         same but for ties
 *   - conditionalWin:   winShare / hitRate — "given I make this, how often does
 *                       it win?"
 *   - equityShare:      winShare + 0.5 * tieShare — contribution to total equity
 *
 * The sum of equityShare across all buckets equals total equity from
 * computeHandVsHand.
 *
 * The "pair" category is split into two buckets to reflect how players think
 * about strength at the table:
 *   - TOP_PAIR_OR_OVERPAIR: hero's pair rank is >= the highest board rank.
 *     Includes overpairs (pocket pair with no overcard on board) and
 *     top-pair-of-board (pairing the highest community card).
 *   - WEAK_PAIR: any other pair (underpair, middle pair, bottom pair,
 *     second pair, etc.).
 *
 * Pure module — depends only on preflopEquity.js internals that are exported
 * (parseHandClass, enumerateHandCombos, evaluate7) and on cardParser.js
 * constants (TOTAL_CARDS).
 */

import { TOTAL_CARDS } from './cardParser';
import {
  evaluate7,
  parseHandClass,
  enumerateHandCombos,
  handClassToNotation,
} from './preflopEquity';
import { decodeIndex, rangeIndex } from './rangeMatrix';
import { comboCountAfterRemoval } from './combinatorics';

// Bucket IDs. Ordered weakest → strongest so stacked-bar UIs render
// naturally (weakest on left).
export const BUCKETS = Object.freeze({
  HIGH_CARD:             0,
  WEAK_PAIR:             1,
  TOP_PAIR_OR_OVERPAIR:  2,
  TWO_PAIR:              3,
  SET:                   4,
  STRAIGHT:              5,
  FLUSH:                 6,
  FULL_HOUSE:            7,
  QUADS:                 8,
  STRAIGHT_FLUSH:        9,
});

export const BUCKET_COUNT = 10;

export const BUCKET_LABELS = [
  'High card',
  'Weak pair',
  'Top pair / Overpair',
  'Two pair',
  'Set / Trips',
  'Straight',
  'Flush',
  'Full house',
  'Quads',
  'Straight flush',
];

// Short labels for compact UI.
export const BUCKET_SHORT = [
  'High',
  'Weak pr',
  'TP/OP',
  '2pr',
  'Set',
  'Str',
  'Flush',
  'Full',
  'Quads',
  'SF',
];

// ---------- Bucket classification ---------- //

/**
 * Convert an evaluate7 score + board max rank into a bucket id.
 *
 * Score bit layout (from handEvaluator / preflopEquity):
 *   Bits 20-23: category  (0=high card .. 8=straight flush)
 *   Bits 16-19: primary rank (pair rank, trip rank, straight high, etc.)
 *
 * The only case that requires extra context beyond the score is the
 * one-pair category, where we need the board max rank to distinguish
 * top pair / overpair from weaker pairs.
 */
export const scoreToBucket = (score, maxBoardRank) => {
  const category = (score >> 20) & 0xF;
  switch (category) {
    case 0: return BUCKETS.HIGH_CARD;
    case 1: {
      // One pair. Discriminate top/overpair vs weak pair by primary rank
      // vs max board rank.
      const pairRank = (score >> 16) & 0xF;
      return pairRank >= maxBoardRank
        ? BUCKETS.TOP_PAIR_OR_OVERPAIR
        : BUCKETS.WEAK_PAIR;
    }
    case 2: return BUCKETS.TWO_PAIR;
    case 3: return BUCKETS.SET;
    case 4: return BUCKETS.STRAIGHT;
    case 5: return BUCKETS.FLUSH;
    case 6: return BUCKETS.FULL_HOUSE;
    case 7: return BUCKETS.QUADS;
    case 8: return BUCKETS.STRAIGHT_FLUSH;
    default: return BUCKETS.HIGH_CARD;
  }
};

// ---------- Board enumeration with bucketing ---------- //

// Reused buffers — single-threaded JS allows safe reuse across calls.
const _sevenA = new Array(7);
const _sevenB = new Array(7);
const _alive = new Int8Array(50);
const _dead = new Uint8Array(TOTAL_CARDS);

/**
 * Enumerate all boards and accumulate per-bucket win/tie/lose tallies.
 *
 * Returns a 4-row table (Float64Array of length BUCKET_COUNT*4) where:
 *   row 0: hits (board count in this bucket, regardless of outcome)
 *   row 1: wins
 *   row 2: ties
 *   row 3: losses
 */
const enumerateWithBuckets = (handACards, bCombos) => {
  const numCombos = bCombos.length;
  // Per-bucket: hits, wins, ties, losses. Weighted by bCombo count to
  // average properly across B combos.
  const buckets = new Float64Array(BUCKET_COUNT * 4);

  _dead.fill(0);
  _dead[handACards[0]] = 1;
  _dead[handACards[1]] = 1;

  let n = 0;
  for (let c = 0; c < TOTAL_CARDS; c++) {
    if (!_dead[c]) _alive[n++] = c;
  }
  // n === 50

  _sevenA[0] = handACards[0]; _sevenA[1] = handACards[1];

  const bCard1 = new Int8Array(numCombos);
  const bCard2 = new Int8Array(numCombos);
  for (let b = 0; b < numCombos; b++) {
    bCard1[b] = bCombos[b][0];
    bCard2[b] = bCombos[b][1];
  }

  for (let i = 0; i < 46; i++) {
    const ci = _alive[i];
    _sevenA[2] = ci;
    const ri = ci >> 2;
    for (let j = i + 1; j < 47; j++) {
      const cj = _alive[j];
      _sevenA[3] = cj;
      const rj = cj >> 2;
      const maxIJ = ri > rj ? ri : rj;
      for (let k = j + 1; k < 48; k++) {
        const ck = _alive[k];
        _sevenA[4] = ck;
        const rk = ck >> 2;
        const maxIJK = maxIJ > rk ? maxIJ : rk;
        for (let l = k + 1; l < 49; l++) {
          const cl = _alive[l];
          _sevenA[5] = cl;
          const rl = cl >> 2;
          const maxIJKL = maxIJK > rl ? maxIJK : rl;
          for (let m = l + 1; m < 50; m++) {
            const cm = _alive[m];
            _sevenA[6] = cm;
            const rm = cm >> 2;
            const maxBoardRank = maxIJKL > rm ? maxIJKL : rm;
            const sA = evaluate7(_sevenA);
            const bucket = scoreToBucket(sA, maxBoardRank);
            const bucketBase = bucket * 4;

            for (let b = 0; b < numCombos; b++) {
              const b1 = bCard1[b], b2 = bCard2[b];
              if (b1 === ci || b1 === cj || b1 === ck || b1 === cl || b1 === cm ||
                  b2 === ci || b2 === cj || b2 === ck || b2 === cl || b2 === cm) {
                continue;
              }
              _sevenB[0] = b1; _sevenB[1] = b2;
              _sevenB[2] = ci; _sevenB[3] = cj; _sevenB[4] = ck;
              _sevenB[5] = cl; _sevenB[6] = cm;
              const sB = evaluate7(_sevenB);
              buckets[bucketBase]++; // hit
              if (sA > sB) buckets[bucketBase + 1]++;
              else if (sA === sB) buckets[bucketBase + 2]++;
              else buckets[bucketBase + 3]++;
            }
          }
        }
      }
    }
  }

  return buckets;
};

// ---------- Public API ---------- //

// Hero-specific cache. Unlike total-equity caching (which is symmetric and
// can canonicalize on lo-hi), decomposition buckets are HERO-specific — a
// board where AKs has a flush and JTs has a straight contributes to
// AKs.FLUSH if hero=AKs but to JTs.STRAIGHT if hero=JTs. So cache keys
// preserve hero/villain order.
const MAX_CACHE = 200;
const decompositionCache = new Map();

export const clearDecompositionCache = () => { decompositionCache.clear(); };
export const getDecompositionCacheSize = () => decompositionCache.size;

/**
 * Decompose hero's equity by made-hand bucket.
 *
 * @param {string|object} handA  hero hand class (e.g., 'AKs')
 * @param {string|object} handB  villain hand class
 * @param {object} [options]
 * @param {boolean} [options.useCache=true]
 * @returns {{
 *   total: number,             // hero total equity (matches computeHandVsHand)
 *   winRate: number,
 *   tieRate: number,
 *   loseRate: number,
 *   boardsEnumerated: number,
 *   elapsedMs: number,
 *   cached?: boolean,
 *   buckets: Array<{
 *     id: number,
 *     label: string,
 *     shortLabel: string,
 *     hitRate: number,          // fraction of all runouts where hero's best 5 = this bucket
 *     winShare: number,         // fraction of all runouts where hero wins AND hand is this bucket
 *     tieShare: number,
 *     loseShare: number,
 *     equityShare: number,      // winShare + 0.5*tieShare
 *     conditionalWin: number,   // given hero makes this, P(win)
 *     conditionalEquity: number // given hero makes this, expected equity
 *   }>
 * }}
 */
export const decomposeHandVsHand = (handA, handB, options = {}) => {
  const { useCache = true } = options;
  const hA = typeof handA === 'string' ? parseHandClass(handA) : handA;
  const hB = typeof handB === 'string' ? parseHandClass(handB) : handB;
  const keyA = handClassToNotation(hA);
  const keyB = handClassToNotation(hB);
  const cacheKey = `${keyA}_${keyB}`;

  if (useCache && decompositionCache.has(cacheKey)) {
    return { ...decompositionCache.get(cacheKey), cached: true };
  }

  const start = performance.now();

  const aCombos = enumerateHandCombos(hA);
  const allBCombos = enumerateHandCombos(hB);
  const aCombo = aCombos[0];

  const validBCombos = [];
  for (const bCombo of allBCombos) {
    if (bCombo[0] === aCombo[0] || bCombo[0] === aCombo[1] ||
        bCombo[1] === aCombo[0] || bCombo[1] === aCombo[1]) {
      continue;
    }
    validBCombos.push(bCombo);
  }

  const raw = enumerateWithBuckets(aCombo, validBCombos);
  let totalBoards = 0;
  for (let b = 0; b < BUCKET_COUNT; b++) totalBoards += raw[b * 4];

  let totalWin = 0, totalTie = 0, totalLose = 0;
  const buckets = [];
  for (let b = 0; b < BUCKET_COUNT; b++) {
    const base = b * 4;
    const hits = raw[base];
    const wins = raw[base + 1];
    const ties = raw[base + 2];
    const losses = raw[base + 3];
    totalWin += wins;
    totalTie += ties;
    totalLose += losses;
    const hitRate = totalBoards > 0 ? hits / totalBoards : 0;
    const winShare = totalBoards > 0 ? wins / totalBoards : 0;
    const tieShare = totalBoards > 0 ? ties / totalBoards : 0;
    const loseShare = totalBoards > 0 ? losses / totalBoards : 0;
    const equityShare = winShare + 0.5 * tieShare;
    const conditionalWin = hits > 0 ? wins / hits : 0;
    const conditionalEquity = hits > 0 ? (wins + 0.5 * ties) / hits : 0;
    buckets.push({
      id: b,
      label: BUCKET_LABELS[b],
      shortLabel: BUCKET_SHORT[b],
      hitRate,
      winShare,
      tieShare,
      loseShare,
      equityShare,
      conditionalWin,
      conditionalEquity,
    });
  }

  const winRate = totalBoards > 0 ? totalWin / totalBoards : 0;
  const tieRate = totalBoards > 0 ? totalTie / totalBoards : 0;
  const loseRate = totalBoards > 0 ? totalLose / totalBoards : 0;
  const total = winRate + 0.5 * tieRate;

  const result = {
    total,
    winRate,
    tieRate,
    loseRate,
    boardsEnumerated: totalBoards,
    elapsedMs: Math.round(performance.now() - start),
    buckets,
  };

  if (useCache) {
    if (decompositionCache.size >= MAX_CACHE) {
      decompositionCache.delete(decompositionCache.keys().next().value);
    }
    decompositionCache.set(cacheKey, result);
  }

  return result;
};

// ==================================================================== //
// Hand/range-vs-range decomposition (WS-305)
// ==================================================================== //
//
// WHAT THIS RETURNS, AND WHY IT IS NOT A MEAN.
//
// A scalar equity against a range is a summary that destroys the thing worth
// knowing. KJo holds respectable average equity against a tight range while
// being crushed by AJ/KQ/AK and comfortable against 22-99; the mean cannot see
// that, and realization is worst precisely in the branch where the hand DOES
// connect. So the object returned here is the DECOMPOSITION — every element of
// the ranged side kept separate, each with its own equity and its own made-hand
// bucket profile. `equity` is summed OUT of that object (literally: the sum of
// per-bucket `equityShare`), never the other way round.
//
// EXACTNESS. Class-level aggregation was expected to force a suit-averaging
// approximation. It does not, and the reason is worth stating because it is the
// argument that licenses the whole fast path:
//
//   1. `decomposeHandVsHand(a, b)` is the exact uniform average over (valid b
//      combo, board) pairs for a fixed representative of class a.
//   2. That value is identical for EVERY representative of class a, because a
//      suit permutation maps one representative to another and carries the set
//      of valid b combos bijectively onto the new valid set, preserving equity.
//   3. A 169-grid cannot express suit preference — it weights all combos within
//      a class equally, by construction.
//   4. Expectation is linear, so weighting exact class conditionals by their
//      exact combo counts gives the exact answer over the full combo pair set.
//
// Therefore the only thing (1)-(4) give up is the ability to represent a range
// that IS suit-skewed ("villain has hearts here"), which a 169-grid never could.
//
// MEASURED, NOT ASSUMED (2026-08-05, this machine, three hero-vs-range cases
// validated combo-by-combo against `enumerateHeroVsCombosExact`; the assertion
// is kept live in `__tests__/preflopEquity.test.js`):
//
//   AKo vs QQ+,AKs        (14 combos)  KJo vs TT+,AQs+,AKo  (40)  76s vs JJ+,AKs (28)
//   aggregate vs full enumeration   max |err| 5.6e-17  — one ulp, i.e. exact
//   per-CLASS equity                max |err| 5.6e-17  — one ulp, i.e. exact
//
// What is NOT zero is the per-combo spread WITHIN a class, which the class mean
// averages over: max 2.78pp, mean 0.63pp, widest on 76s vs AKs (suit interaction
// between hero's suited holding and the range's suited combos, exactly where it
// was predicted). That spread is real and is not lost — `decomposeVsRange`
// reports the class mean because a 169-grid weights those combos equally by
// construction, and `enumerateHeroVsCombosExact` exposes the individual combos
// for anything that needs them.
//
// PROPENSITIES ARE NOT A DISTRIBUTION. Grid weights are propensities —
// P(action | hand) — not probability mass, and they are never normalised here.
// The weighting is stated rather than hidden: an element's weight is
// `liveComboCount x propensity`, `weightShare` is the only normalised figure
// reported, and `propensityMass` is exposed raw so no caller has to reconstruct
// it by renormalising.
//
// CARD REMOVAL IS THE POINT. Hero's two cards change the live combo count of
// every class in the villain range, unevenly — that is what a blocker IS, and a
// per-combo decomposition exists to expose it. Counts come from
// `comboCountAfterRemoval`, in closed form, per (hero class, villain class) pair.
//
// DETERMINISM. No sampling, no `Math.random`, on any path reachable from here.

const GRID_SIZE = 169;

/** 4-bit mask of the suits in `cards` that carry rank `rank`. */
const suitMaskForRank = (cards, rank) => {
  let mask = 0;
  for (let i = 0; i < cards.length; i++) {
    if ((cards[i] >> 2) === rank) mask |= 1 << (cards[i] & 3);
  }
  return mask;
};

/** Combos of a class in a full deck: 6 / 4 / 12. */
const baseComboCount = (hc) => comboCountAfterRemoval(hc.pair, hc.suited, 0, 0);

/**
 * Normalise an EquityTarget into the list of classes it covers.
 * A hand target is a one-element list at propensity 1, so both sides go through
 * exactly the same weighting arithmetic and there is no hand-only special case.
 */
const expandTarget = (target, label) => {
  if (!target || typeof target !== 'object') {
    throw new Error(`${label}: expected an EquityTarget object`);
  }
  if (target.type === 'hand') {
    const handClass = parseHandClass(target.notation);
    return [{
      index: rangeIndex(handClass.rankHigh, handClass.rankLow, handClass.suited),
      notation: handClassToNotation(handClass),
      handClass,
      propensity: 1,
    }];
  }
  if (target.type !== 'range') {
    throw new Error(`${label}: unknown target type "${target.type}"`);
  }
  const grid = target.range;
  if (!grid || typeof grid.length !== 'number' || grid.length !== GRID_SIZE) {
    throw new Error(
      `${label}: range target needs a ${GRID_SIZE}-element grid, got ` +
      `${grid && typeof grid.length === 'number' ? grid.length : String(grid)}`,
    );
  }
  const out = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    const propensity = grid[i];
    if (!Number.isFinite(propensity)) {
      throw new Error(`${label}: range[${i}] is not finite (${propensity})`);
    }
    if (propensity < 0) {
      throw new Error(`${label}: range[${i}] is negative (${propensity}) — propensities cannot be < 0`);
    }
    if (propensity === 0) continue;
    const { rank1, rank2, suited, isPair } = decodeIndex(i);
    const handClass = {
      rankHigh: rank1,
      rankLow: rank2,
      suited: isPair ? false : suited,
      pair: isPair,
    };
    out.push({ index: i, notation: handClassToNotation(handClass), handClass, propensity });
  }
  if (out.length === 0) {
    throw new Error(`${label}: range target carries no positive propensity anywhere`);
  }
  return out;
};

// Compact class-pair cache. Deliberately separate from `decompositionCache`
// above: that one holds rich objects for the live UI and is capped at 200, and
// a range sweep touching thousands of pairs would evict it into uselessness.
// This one stores only the four per-board rates per bucket — 40 doubles, ~320
// bytes a pair — so the full 169x169 ordered matrix fits in ~9MB. Once warm,
// every further range query on those classes is arithmetic. That is what makes
// a fixed-point iteration (GUT P3) affordable; see the cost note in the header.
const RANGE_PAIR_CACHE_LIMIT = 30000;
const rangePairCache = new Map();

export const clearRangePairCache = () => { rangePairCache.clear(); };
export const getRangePairCacheSize = () => rangePairCache.size;

/**
 * Per-board rates for one ORDERED class pair, as [hitRate, winShare, tieShare,
 * loseShare] per bucket. Hero-specific, hence ordered.
 */
const classPairRates = (hero, villain, stats, useCache) => {
  const key = `${hero.notation}|${villain.notation}`;
  if (useCache) {
    const cached = rangePairCache.get(key);
    if (cached) {
      stats.classPairsCached++;
      return cached;
    }
  }
  // useCache:false keeps the 200-entry live-UI cache above untouched.
  const d = decomposeHandVsHand(hero.handClass, villain.handClass, { useCache: false });
  const rates = new Float64Array(BUCKET_COUNT * 4);
  for (let b = 0; b < BUCKET_COUNT; b++) {
    const bucket = d.buckets[b];
    const base = b * 4;
    rates[base] = bucket.hitRate;
    rates[base + 1] = bucket.winShare;
    rates[base + 2] = bucket.tieShare;
    rates[base + 3] = bucket.loseShare;
  }
  if (useCache) {
    if (rangePairCache.size >= RANGE_PAIR_CACHE_LIMIT) {
      rangePairCache.delete(rangePairCache.keys().next().value);
    }
    rangePairCache.set(key, rates);
  }
  stats.classPairsComputed++;
  stats.boardsEnumerated += d.boardsEnumerated;
  return rates;
};

/** Turn weighted [hit, win, tie, lose] accumulators into the public bucket rows. */
const bucketsFromAccumulator = (acc, totalWeight) => {
  const buckets = [];
  for (let b = 0; b < BUCKET_COUNT; b++) {
    const base = b * 4;
    const hitRate = totalWeight > 0 ? acc[base] / totalWeight : 0;
    const winShare = totalWeight > 0 ? acc[base + 1] / totalWeight : 0;
    const tieShare = totalWeight > 0 ? acc[base + 2] / totalWeight : 0;
    const loseShare = totalWeight > 0 ? acc[base + 3] / totalWeight : 0;
    const equityShare = winShare + 0.5 * tieShare;
    buckets.push({
      id: b,
      label: BUCKET_LABELS[b],
      shortLabel: BUCKET_SHORT[b],
      hitRate,
      winShare,
      tieShare,
      loseShare,
      equityShare,
      conditionalWin: hitRate > 0 ? winShare / hitRate : 0,
      conditionalEquity: hitRate > 0 ? equityShare / hitRate : 0,
    });
  }
  return buckets;
};

/** The mean, summed OUT of the decomposition. Never computed independently. */
const totalsFromBuckets = (buckets) => {
  let winRate = 0, tieRate = 0, loseRate = 0, equity = 0;
  for (const b of buckets) {
    winRate += b.winShare;
    tieRate += b.tieShare;
    loseRate += b.loseShare;
    equity += b.equityShare;
  }
  return { equity, winRate, tieRate, loseRate };
};

/**
 * Decomposed preflop all-in equity where either or both sides may be a range.
 *
 * Reported from targetA's perspective; `buckets` are A's made-hand buckets.
 *
 * @param {{type:'hand'|'range', notation?:string, range?:ArrayLike<number>}} targetA
 * @param {{type:'hand'|'range', notation?:string, range?:ArrayLike<number>}} targetB
 * @param {Object} [options]
 * @param {boolean} [options.useCache=true]  reuse/populate the class-pair cache
 * @returns {{
 *   equity: number, winRate: number, tieRate: number, loseRate: number,
 *   exact: true,
 *   buckets: Array<Object>,          // same row shape as decomposeHandVsHand
 *   decomposition: {
 *     axis: 'hero'|'villain',        // which side `elements` enumerates
 *     weighting: string,             // stated, not implied
 *     totalWeight: number,
 *     hero: { classes, liveCombos, propensityMass },
 *     villain: { classes, liveCombos, propensityMass },
 *     elements: Array<{
 *       index, notation,
 *       propensity,                  // RAW grid value — a propensity, not a probability
 *       comboCount,                  // this class's live combos after card removal
 *       opposingLiveCombos,          // propensity-weighted live combos it faces (blocker effect)
 *       weight, weightShare,
 *       equity, winRate, tieRate, loseRate,
 *       buckets: Array<Object>
 *     }>
 *   },
 *   classPairsEvaluated: number, classPairsComputed: number, classPairsCached: number,
 *   boardsEnumerated: number, elapsedMs: number
 * }}
 */
export const decomposeVsRange = (targetA, targetB, options = {}) => {
  const { useCache = true } = options;
  const start = performance.now();

  const heroSide = expandTarget(targetA, 'targetA');
  const villainSide = expandTarget(targetB, 'targetB');

  const stats = { classPairsComputed: 0, classPairsCached: 0, boardsEnumerated: 0 };

  // `elements` enumerates the ranged side that carries the interesting
  // variation. Hand-vs-range: the villain range (what hero is up against).
  // Anything else: hero's own classes — which of hero's hands are dominated is
  // the ranking question, and with a single villain hand the villain axis is
  // one trivial row.
  const axis = (targetA.type === 'hand' && targetB.type === 'range') ? 'villain' : 'hero';
  const elementSide = axis === 'hero' ? heroSide : villainSide;

  const grand = new Float64Array(BUCKET_COUNT * 4);
  let grandWeight = 0;

  const elemAcc = elementSide.map(() => new Float64Array(BUCKET_COUNT * 4));
  const elemWeight = new Float64Array(elementSide.length);
  const elemCombos = new Float64Array(elementSide.length);
  const elemOpposing = new Float64Array(elementSide.length);

  // Hero's side is dealt first, so nothing removes cards from it; its live
  // count is just its class combos. The villain side's live count IS
  // removal-adjusted, and is exact only when hero is a single class — with a
  // ranged hero the removal differs per pair, so the reported figure is the
  // unblocked total and the per-pair truth lives in each element's
  // `opposingLiveCombos`.
  let heroLiveCombos = 0;
  for (const hero of heroSide) heroLiveCombos += baseComboCount(hero.handClass);

  let villainLiveCombos = 0;
  if (heroSide.length === 1) {
    const heroCards0 = enumerateHandCombos(heroSide[0].handClass)[0];
    for (const villain of villainSide) {
      villainLiveCombos += comboCountAfterRemoval(
        villain.handClass.pair,
        villain.handClass.suited,
        suitMaskForRank(heroCards0, villain.handClass.rankHigh),
        suitMaskForRank(heroCards0, villain.handClass.rankLow),
      );
    }
  } else {
    for (const villain of villainSide) villainLiveCombos += baseComboCount(villain.handClass);
  }

  for (let ai = 0; ai < heroSide.length; ai++) {
    const hero = heroSide[ai];
    const heroCards = enumerateHandCombos(hero.handClass)[0];
    const heroCombos = baseComboCount(hero.handClass);

    for (let bi = 0; bi < villainSide.length; bi++) {
      const villain = villainSide[bi];
      const villainCombos = comboCountAfterRemoval(
        villain.handClass.pair,
        villain.handClass.suited,
        suitMaskForRank(heroCards, villain.handClass.rankHigh),
        suitMaskForRank(heroCards, villain.handClass.rankLow),
      );
      // Zero means hero physically holds every card of that class — it is
      // impossible, not merely unlikely, so it leaves the sum entirely.
      if (villainCombos === 0) continue;

      const weight = heroCombos * hero.propensity * villainCombos * villain.propensity;
      if (!(weight > 0)) continue;

      const rates = classPairRates(hero, villain, stats, useCache);

      const ei = axis === 'hero' ? ai : bi;
      const acc = elemAcc[ei];
      for (let k = 0; k < BUCKET_COUNT * 4; k++) {
        const contribution = weight * rates[k];
        grand[k] += contribution;
        acc[k] += contribution;
      }
      grandWeight += weight;
      elemWeight[ei] += weight;

      if (axis === 'villain') {
        elemCombos[ei] = villainCombos;
        elemOpposing[ei] += heroCombos * hero.propensity;
      } else {
        elemCombos[ei] = heroCombos;
        elemOpposing[ei] += villainCombos * villain.propensity;
      }
    }
  }

  if (grandWeight <= 0) {
    throw new Error('decomposeVsRange: no live combo pairs between the two targets');
  }

  const buckets = bucketsFromAccumulator(grand, grandWeight);
  const totals = totalsFromBuckets(buckets);

  const elements = elementSide.map((el, i) => {
    const w = elemWeight[i];
    const elBuckets = bucketsFromAccumulator(elemAcc[i], w);
    const elTotals = totalsFromBuckets(elBuckets);
    return {
      index: el.index,
      notation: el.notation,
      propensity: el.propensity,
      comboCount: elemCombos[i],
      opposingLiveCombos: elemOpposing[i],
      weight: w,
      weightShare: w / grandWeight,
      equity: elTotals.equity,
      winRate: elTotals.winRate,
      tieRate: elTotals.tieRate,
      loseRate: elTotals.loseRate,
      buckets: elBuckets,
    };
  });

  const propensityMass = (side) => side.reduce((sum, el) => sum + el.propensity, 0);

  return {
    ...totals,
    exact: true,
    buckets,
    decomposition: {
      axis,
      weighting: 'weight = liveComboCount x propensity; propensities are NOT normalised',
      totalWeight: grandWeight,
      hero: {
        classes: heroSide.length,
        liveCombos: heroLiveCombos,
        propensityMass: propensityMass(heroSide),
      },
      villain: {
        classes: villainSide.length,
        liveCombos: villainLiveCombos,
        propensityMass: propensityMass(villainSide),
      },
      elements,
    },
    classPairsEvaluated: stats.classPairsComputed + stats.classPairsCached,
    classPairsComputed: stats.classPairsComputed,
    classPairsCached: stats.classPairsCached,
    boardsEnumerated: stats.boardsEnumerated,
    elapsedMs: Math.round(performance.now() - start),
  };
};
