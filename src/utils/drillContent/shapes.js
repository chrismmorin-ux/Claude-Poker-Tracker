/**
 * shapes.js — hero-indexed catalog of preflop equity "shapes" and "lanes".
 *
 * A *shape* describes hero's holding (e.g., pocket-pair, Axs). Each shape
 * exposes an ordered list of *lanes*, where a lane is a structural class of
 * villain holdings (e.g., "higher pair", "shared-ace dominated", "two overs
 * no shared"). Lanes carry a calibrated equity band and declarative modifier
 * deltas that hero can apply mentally at the table.
 *
 * Canonical classification: lanes are ordered most-specific first. The first
 * matching lane wins. Shapes are likewise ordered — shared-rank lanes like
 * `vs-higher-ax` are routed via the Ax-* shape, never via the broadway-
 * broadway shape.
 *
 * This module is the source of truth for equity numbers the UI teaches.
 * Every band is verified by shapesCatalog.test.js against exact
 * enumeration (`computeHandVsHand` in pokerCore/preflopEquity.js). Every
 * shape/lane assignment is verified by shapeClassifier.test.js.
 *
 * Pure module — no imports from UI, state, or persistence layers.
 */

import { parseHandClass } from '../pokerCore/preflopEquity';

// ---------- Helpers ---------- //

// Ranks: 0=2, ..., 8=T, 9=J, 10=Q, 11=K, 12=A.
const A = 12, K = 11, Q = 10, J = 9, T = 8;
const gap = (h) => (h.pair ? 0 : h.rankHigh - h.rankLow - 1);

const sharedRank = (hero, villain) => {
  if (villain.pair) {
    if (hero.pair) {
      return hero.rankHigh === villain.rankHigh ? hero.rankHigh : -1;
    }
    if (hero.rankHigh === villain.rankHigh || hero.rankLow === villain.rankHigh) {
      return villain.rankHigh;
    }
    return -1;
  }
  if (hero.pair) {
    if (villain.rankHigh === hero.rankHigh || villain.rankLow === hero.rankHigh) {
      return hero.rankHigh;
    }
    return -1;
  }
  if (hero.rankHigh === villain.rankHigh || hero.rankHigh === villain.rankLow) return hero.rankHigh;
  if (hero.rankLow === villain.rankHigh || hero.rankLow === villain.rankLow) return hero.rankLow;
  return -1;
};

const kickerOf = (h, sharedR) => (h.rankHigh === sharedR ? h.rankLow : h.rankHigh);

// ---------- Shape classifiers ---------- //

const isPocketPair     = (h) => h.pair;
const isAxSuited       = (h) => !h.pair && h.rankHigh === A && h.suited;
const isAxOffsuit      = (h) => !h.pair && h.rankHigh === A && !h.suited;
const isBroadwayBroadway = (h) => !h.pair && h.rankHigh < A && h.rankLow >= T;
const isKxNonBroadway  = (h) => !h.pair && h.rankHigh === K && h.rankLow < T;
const isSuitedConnectorOrGapper = (h) =>
  !h.pair && h.suited && h.rankHigh < K && h.rankLow < T;
const isMiddlingOffsuit = (h) =>
  !h.pair && !h.suited && h.rankHigh < K && h.rankLow < T && gap(h) <= 3;
const isOffsuitGarbage = (h) => !h.pair && !h.suited; // fallthrough

// ---------- Lane-matcher helpers ---------- //

const villainIsHigherPairThan = (v, rank) => v.pair && v.rankHigh > rank;
const villainIsLowerPairThan  = (v, rank) => v.pair && v.rankHigh < rank;
const villainIsAx = (v) => !v.pair && v.rankHigh === A;
const villainHasRank = (v, rank) =>
  v.pair ? v.rankHigh === rank : (v.rankHigh === rank || v.rankLow === rank);
const villainBothOver  = (v, rank) => !v.pair && v.rankLow > rank;
const villainBothUnder = (v, rank) => !v.pair && v.rankHigh < rank;
const villainSplit     = (v, rank) => !v.pair && v.rankHigh > rank && v.rankLow < rank;

// ---------- Shape definitions ---------- //
//
// Each lane:
//   id:              stable string id (kebab-case)
//   villainDesc:     human label
//   matches:         (villain, hero) => boolean  — lane predicate
//   baseEquity:      representative hero equity (teaching anchor). Not
//                    asserted by tests; the BAND is asserted.
//   band:            [lo, hi] inclusive, hero equity. Calibrated to
//                    contain every representative across hero variants.
//   modifiers:       signed deltas hero applies mentally. All optional.
//                      heroSuited, villainSuited, flushDominator,
//                      flushDominated, connectedness
//   representatives: villain hand strings for shapesCatalog.test.js.
//                    Empty = test generates villains from the 169-class
//                    space matching `matches(v, hero)`.

const POCKET_PAIR_LANES = [
  {
    id: 'vs-same-pair-mirror',
    villainDesc: 'Same pocket pair (card-removal coin flip)',
    matches: (v, h) => v.pair && v.rankHigh === h.rankHigh,
    baseEquity: 0.50,
    band: [0.49, 0.51],
    modifiers: {},
    representatives: ['AA', 'JJ', '22'],
  },
  {
    id: 'higher-pair',
    villainDesc: 'Higher pocket pair (crushed)',
    matches: (v, h) => villainIsHigherPairThan(v, h.rankHigh),
    baseEquity: 0.18,
    band: [0.17, 0.20],
    modifiers: {},
    representatives: ['AA', 'KK', 'QQ'],
  },
  {
    id: 'lower-pair',
    villainDesc: 'Lower pocket pair (dominating)',
    matches: (v, h) => villainIsLowerPairThan(v, h.rankHigh),
    baseEquity: 0.82,
    band: [0.80, 0.83],
    modifiers: {},
    representatives: ['22', '55', '77'],
  },
  {
    id: 'shared-rank-higher-kicker',
    villainDesc: 'Villain pairs your rank with a higher kicker (77 vs A7 — ahead but not crushing)',
    matches: (v, h) => !v.pair && villainHasRank(v, h.rankHigh) && kickerOf(v, h.rankHigh) > h.rankHigh,
    baseEquity: 0.68,
    band: [0.60, 0.72],
    modifiers: { villainSuited: -0.03 },
    representatives: ['A7o', 'A7s', 'K7o'],
  },
  {
    id: 'shared-rank-lower-kicker',
    villainDesc: 'Villain pairs your rank with a lower kicker (JJ vs J5 — you crush)',
    matches: (v, h) => !v.pair && villainHasRank(v, h.rankHigh) && kickerOf(v, h.rankHigh) < h.rankHigh,
    baseEquity: 0.88,
    band: [0.80, 0.95],
    modifiers: { villainSuited: -0.025 },
    representatives: ['J5o', 'J3o', 'J2s'],
  },
  {
    id: 'classic-race-overs',
    villainDesc: 'Villain has two cards both over your pair (classic race)',
    matches: (v, h) => villainBothOver(v, h.rankHigh),
    baseEquity: 0.54,
    band: [0.45, 0.58],
    modifiers: {
      villainSuited: -0.025,
      // Pair rank matters: pair 22 sits ~46–49%, small pair (33–77) ~50–55%, mid pair (88–TT) ~54–57%.
    },
    representatives: ['AKo', 'AKs', 'AQs', 'KJo'],
  },
  {
    id: 'pair-vs-split',
    villainDesc: 'Villain has one card over, one under (pair ahead)',
    matches: (v, h) => villainSplit(v, h.rankHigh) && sharedRank(h, v) < 0,
    baseEquity: 0.70,
    band: [0.65, 0.74],
    modifiers: { villainSuited: -0.025 },
    representatives: ['A5o', 'K6o', 'Q3o'],
  },
  {
    id: 'pair-vs-two-unders',
    villainDesc: 'Villain has two cards both under your pair',
    matches: (v, h) => villainBothUnder(v, h.rankHigh),
    baseEquity: 0.83,
    band: [0.76, 0.89],
    modifiers: {
      villainSuited: -0.025,
      connectedness: -0.015, // per step closer
    },
    representatives: ['72o', '32o', '87s', '65s', '54s'],
  },
];

const AX_SUITED_LANES = [
  {
    id: 'vs-aa',
    villainDesc: 'AA (crushed)',
    matches: (v) => v.pair && v.rankHigh === A,
    baseEquity: 0.13,
    band: [0.07, 0.14],
    modifiers: {},
    representatives: ['AA'],
  },
  {
    id: 'vs-mirror-suited',
    villainDesc: 'Same ranks, both suited (different suits — card-removal coin flip)',
    matches: (v, h) => !v.pair && v.suited && v.rankHigh === h.rankHigh && v.rankLow === h.rankLow,
    baseEquity: 0.50,
    band: [0.49, 0.51],
    modifiers: {},
    representatives: ['AKs', 'A5s'],
  },
  {
    id: 'vs-mirror-offsuit',
    villainDesc: 'Same ranks offsuit (AJs vs AJo — essentially a tie, you hold the flush edge)',
    matches: (v, h) => !v.pair && !v.suited && v.rankHigh === h.rankHigh && v.rankLow === h.rankLow,
    baseEquity: 0.52,
    band: [0.50, 0.56],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-higher-ax',
    villainDesc: 'Higher Ax — kicker dominated (shared Ace, villain has bigger kicker)',
    matches: (v, h) => villainIsAx(v) && sharedRank(h, v) === A && kickerOf(v, A) > h.rankLow,
    baseEquity: 0.32,
    band: [0.22, 0.48],
    modifiers: { villainSuited: -0.02 },
    representatives: ['AKo', 'AQo', 'AJs'],
  },
  {
    id: 'vs-lower-ax',
    villainDesc: 'Lower Ax — you kicker-dominate (shared Ace, hero has bigger kicker)',
    // 0.62 = mid-kicker hero anchor. Lane has wide band [0.54, 0.78] —
    // A5s vs A2o sits at ~58%, AQs vs A3o at ~75%. Anchor intentionally sits
    // below midpoint because lower-kicker heroes are more common in practice.
    baseEquity: 0.62,
    band: [0.54, 0.78],
    matches: (v, h) => villainIsAx(v) && sharedRank(h, v) === A && kickerOf(v, A) < h.rankLow,
    modifiers: { villainSuited: -0.025 },
    representatives: ['A2o', 'A5o', 'A9s'],
  },
  {
    id: 'vs-pair-equal-to-kicker',
    villainDesc: 'Pair of your kicker rank (villain pair blocks your kicker outs)',
    matches: (v, h) => v.pair && v.rankHigh === h.rankLow,
    baseEquity: 0.33,
    band: [0.27, 0.40],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-pair-above-kicker',
    villainDesc: 'Pair between your Ace and kicker (split shape — pair favored ~67%)',
    matches: (v, h) => v.pair && v.rankHigh < A && v.rankHigh > h.rankLow,
    baseEquity: 0.33,
    band: [0.22, 0.36],
    modifiers: { heroSuited: +0.02 },
    representatives: ['KK', 'QQ', 'JJ', 'TT'],
  },
  {
    id: 'vs-pair-below-kicker',
    villainDesc: 'Pair below your kicker (race shape — your two cards both over)',
    matches: (v, h) => v.pair && v.rankHigh < h.rankLow,
    baseEquity: 0.50,
    band: [0.43, 0.52],
    modifiers: { heroSuited: +0.025 },
    representatives: ['22', '33'],
  },
  {
    id: 'vs-shared-kicker-higher-card',
    villainDesc: 'Villain has a non-Ace card PLUS your kicker rank (you dominate via Ace)',
    matches: (v, h) => !v.pair && !villainIsAx(v) && villainHasRank(v, h.rankLow),
    baseEquity: 0.76,
    band: [0.64, 0.80],
    modifiers: { villainSuited: -0.025 },
    representatives: ['K5o', 'Q5o', 'K2o', 'Q2s'],
  },
  {
    id: 'vs-unpaired-no-shared',
    villainDesc: 'Unpaired, no shared rank, no Ace',
    matches: (v, h) => !v.pair && !villainIsAx(v) && sharedRank(h, v) < 0,
    baseEquity: 0.57,
    band: [0.50, 0.72],
    modifiers: { villainSuited: -0.035, heroSuited: +0.02 },
    representatives: ['KQo', 'JTo', '98s', '54s', 'QJs'],
  },
];

const AX_OFFSUIT_LANES = [
  {
    id: 'vs-aa',
    villainDesc: 'AA (crushed)',
    matches: (v) => v.pair && v.rankHigh === A,
    baseEquity: 0.08,
    band: [0.06, 0.12],
    modifiers: {},
    representatives: ['AA'],
  },
  {
    id: 'vs-mirror-offsuit',
    villainDesc: 'Same ranks, both offsuit (different suit pairings — card-removal coin flip)',
    matches: (v, h) => !v.pair && !v.suited && v.rankHigh === h.rankHigh && v.rankLow === h.rankLow,
    baseEquity: 0.50,
    band: [0.49, 0.51],
    modifiers: {},
    representatives: ['AKo', 'A5o'],
  },
  {
    id: 'vs-mirror-suited',
    villainDesc: 'Same ranks suited (A5o vs A5s — dead-even except villain holds the flush edge)',
    matches: (v, h) => !v.pair && v.suited && v.rankHigh === h.rankHigh && v.rankLow === h.rankLow,
    baseEquity: 0.46,
    band: [0.43, 0.50],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-higher-ax',
    villainDesc: 'Higher Ax — kicker dominated',
    matches: (v, h) => villainIsAx(v) && kickerOf(v, A) > h.rankLow,
    baseEquity: 0.26,
    band: [0.20, 0.45],
    modifiers: { villainSuited: -0.02 },
    representatives: ['AKs', 'AQs', 'AJo'],
  },
  {
    id: 'vs-lower-ax',
    villainDesc: 'Lower Ax — you kicker-dominate',
    matches: (v, h) => villainIsAx(v) && kickerOf(v, A) < h.rankLow,
    // 0.60 = mid-kicker anchor (A5o-A9o vs various lower Ax).
    // Wider band [0.50, 0.77] captures the full A2o-AQo hero range.
    baseEquity: 0.60,
    band: [0.50, 0.77],
    modifiers: { villainSuited: -0.025 },
    representatives: ['A2o', 'A5s', 'A9o'],
  },
  {
    id: 'vs-pair-equal-to-kicker',
    villainDesc: 'Pair of your kicker rank',
    matches: (v, h) => v.pair && v.rankHigh === h.rankLow,
    baseEquity: 0.30,
    band: [0.25, 0.38],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-pair-above-kicker',
    villainDesc: 'Pair between Ace and kicker (split)',
    matches: (v, h) => v.pair && v.rankHigh < A && v.rankHigh > h.rankLow,
    baseEquity: 0.30,
    band: [0.22, 0.34],
    modifiers: {},
    representatives: ['KK', 'QQ', 'JJ'],
  },
  {
    id: 'vs-pair-below-kicker',
    villainDesc: 'Pair below your kicker (race as two overs)',
    matches: (v, h) => v.pair && v.rankHigh < h.rankLow,
    baseEquity: 0.45,
    band: [0.41, 0.50],
    modifiers: {},
    representatives: ['22', '33'],
  },
  {
    id: 'vs-shared-kicker-higher-card',
    villainDesc: 'Villain has non-Ace card plus your kicker rank (you dominate via Ace)',
    matches: (v, h) => !v.pair && !villainIsAx(v) && villainHasRank(v, h.rankLow),
    baseEquity: 0.72,
    band: [0.62, 0.80],
    modifiers: {},
    representatives: ['K5o', 'Q5s', 'K2o', 'Q2s'],
  },
  {
    id: 'vs-unpaired-no-shared',
    villainDesc: 'Unpaired, no shared rank, no Ace',
    matches: (v, h) => !v.pair && !villainIsAx(v) && sharedRank(h, v) < 0,
    baseEquity: 0.55,
    band: [0.48, 0.70],
    modifiers: { villainSuited: -0.035 },
    representatives: ['KQo', 'JTs', '98s', '54o'],
  },
];

const BROADWAY_BROADWAY_LANES = [
  {
    id: 'vs-mirror',
    villainDesc: 'Same ranks, different suits (KQs vs KQo — essentially a tie)',
    matches: (v, h) => !v.pair && v.rankHigh === h.rankHigh && v.rankLow === h.rankLow,
    baseEquity: 0.51,
    band: [0.47, 0.56],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-pair-of-high-card',
    villainDesc: 'Pair of your high card (e.g., KQ vs KK — crushed, you hold a blocker)',
    matches: (v, h) => v.pair && v.rankHigh === h.rankHigh,
    baseEquity: 0.10,
    band: [0.07, 0.22],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-pair-of-low-card',
    villainDesc: 'Pair of your low card (e.g., KQ vs QQ — crushed, you still hold a blocker)',
    matches: (v, h) => v.pair && v.rankHigh === h.rankLow,
    baseEquity: 0.32,
    band: [0.28, 0.42],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-pair-above-high',
    villainDesc: 'Pocket pair above your high card (e.g., KQ vs AA)',
    matches: (v, h) => v.pair && v.rankHigh > h.rankHigh,
    // 0.14 = KQ-class hero vs overpair; anchor sits near AA mean. Wider band
    // captures QJ-vs-AA (~12) through KJ-vs-TT (is blocked by same-rank test).
    baseEquity: 0.14,
    band: [0.12, 0.24],
    modifiers: { heroSuited: +0.025 },
    representatives: ['AA', 'KK', 'QQ'],
  },
  {
    id: 'vs-pair-between',
    villainDesc: 'Pocket pair between your two cards (split; rare, e.g., KT vs JJ)',
    matches: (v, h) => v.pair && v.rankHigh < h.rankHigh && v.rankHigh > h.rankLow,
    baseEquity: 0.31,
    band: [0.27, 0.36],
    modifiers: {},
    representatives: ['JJ', 'TT'],
  },
  {
    id: 'vs-pair-below',
    villainDesc: 'Pocket pair below your low card (two overs race)',
    matches: (v, h) => v.pair && v.rankHigh < h.rankLow,
    baseEquity: 0.47,
    band: [0.42, 0.58],
    modifiers: { heroSuited: +0.025 },
    representatives: ['22', '55', '77'],
  },
  {
    id: 'vs-higher-broadway-shared',
    villainDesc: 'Higher broadway with shared high card — kicker dominated',
    matches: (v, h) => !v.pair && sharedRank(h, v) === h.rankHigh && !villainIsAx(v) && kickerOf(v, h.rankHigh) > h.rankLow,
    baseEquity: 0.27,
    band: [0.23, 0.33],
    modifiers: { heroSuited: +0.025 },
    representatives: ['KQo', 'KJo'],
  },
  {
    id: 'vs-lower-broadway-shared-high',
    villainDesc: 'Lower broadway sharing your high card — you kicker-dominate',
    matches: (v, h) => !v.pair && sharedRank(h, v) === h.rankHigh && kickerOf(v, h.rankHigh) < h.rankLow,
    baseEquity: 0.72,
    band: [0.66, 0.76],
    modifiers: { heroSuited: +0.025 },
    representatives: ['KJo', 'KTo'],
  },
  {
    id: 'vs-broadway-shared-low-dominated',
    villainDesc: 'Villain shares your low card with a HIGHER kicker (you are dominated)',
    matches: (v, h) => !v.pair && !villainIsAx(v) && sharedRank(h, v) === h.rankLow && kickerOf(v, h.rankLow) > h.rankHigh,
    baseEquity: 0.27,
    band: [0.20, 0.36],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-broadway-shared-low-dominating',
    villainDesc: 'Villain shares your low card with a LOWER kicker (you dominate)',
    matches: (v, h) => !v.pair && !villainIsAx(v) && sharedRank(h, v) === h.rankLow && kickerOf(v, h.rankLow) < h.rankHigh,
    baseEquity: 0.70,
    band: [0.58, 0.78],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-ax-higher',
    villainDesc: 'Ax with Ace and higher/different cards (dominator)',
    matches: (v, h) => villainIsAx(v) && sharedRank(h, v) < 0,
    baseEquity: 0.40,
    band: [0.32, 0.50],
    modifiers: { villainSuited: -0.03, heroSuited: +0.025 },
    representatives: ['AQo', 'AJs', 'ATo'],
  },
  {
    id: 'vs-ax-shared',
    villainDesc: 'Ax sharing your card (e.g., KJ vs AK — kicker dominated under)',
    matches: (v, h) => villainIsAx(v) && sharedRank(h, v) > 0,
    baseEquity: 0.27,
    band: [0.20, 0.36],
    modifiers: {},
    representatives: ['AKo', 'AQo'],
  },
  {
    id: 'vs-suited-connector',
    villainDesc: 'Non-broadway suited connector/gapper',
    matches: (v, h) => !v.pair && v.suited && v.rankHigh < T && sharedRank(h, v) < 0,
    baseEquity: 0.60,
    band: [0.54, 0.66],
    modifiers: { heroSuited: +0.02 },
    representatives: ['98s', '76s', '54s', '87s'],
  },
  {
    id: 'vs-weak-unpaired',
    villainDesc: 'Weak offsuit unpaired — dominated shape',
    matches: (v, h) => !v.pair && !v.suited && !villainIsAx(v) && v.rankHigh < T && sharedRank(h, v) < 0,
    baseEquity: 0.65,
    band: [0.58, 0.74],
    modifiers: {},
    representatives: ['87o', '76o', '65o'],
  },
  {
    id: 'vs-lower-broadway-no-shared',
    villainDesc: 'Lower broadway villain (T or J high), no shared rank — you dominate with your high cards',
    matches: (v, h) => !v.pair && !villainIsAx(v) && sharedRank(h, v) < 0 && v.rankHigh < h.rankHigh && v.rankHigh >= T,
    baseEquity: 0.66,
    band: [0.55, 0.72],
    modifiers: {},
    representatives: ['JTs', 'JTo', 'T9s'],
  },
  {
    id: 'vs-straddle-non-ax',
    villainDesc: 'Non-Ax villain straddling your range (one over, one under), no shared rank',
    matches: (v, h) => !v.pair && !villainIsAx(v) && sharedRank(h, v) < 0 && v.rankHigh > h.rankHigh && v.rankLow < h.rankLow,
    baseEquity: 0.45,
    band: [0.39, 0.50],
    modifiers: {},
    representatives: ['KTs', 'KTo'],
  },
  {
    id: 'vs-one-over-one-within-non-ax',
    villainDesc: 'Non-Ax villain with one card over you, one between your ranks (dominator), no shared',
    matches: (v, h) => !v.pair && !villainIsAx(v) && sharedRank(h, v) < 0 && v.rankHigh > h.rankHigh && v.rankLow > h.rankLow && v.rankLow < h.rankHigh,
    baseEquity: 0.38,
    band: [0.34, 0.42],
    modifiers: {},
    representatives: ['KJs', 'KJo'],
  },
  {
    id: 'vs-two-overs-non-ax',
    villainDesc: 'Non-Ax villain with both cards over your high card, no shared rank',
    matches: (v, h) => !v.pair && !villainIsAx(v) && sharedRank(h, v) < 0 && v.rankLow > h.rankHigh,
    baseEquity: 0.36,
    band: [0.33, 0.40],
    modifiers: {},
    representatives: ['KQs', 'KQo'],
  },
  {
    id: 'vs-middle-unpaired-shared',
    villainDesc: 'Middle unpaired hand sharing one of your ranks (mixed structure)',
    matches: (v, h) => !v.pair && !villainIsAx(v) && sharedRank(h, v) >= 0,
    baseEquity: 0.50,
    band: [0.30, 0.75],
    modifiers: {},
    representatives: [],
  },
];

const KX_NON_BROADWAY_LANES = [
  {
    id: 'vs-aa',
    villainDesc: 'AA (crushed)',
    matches: (v) => v.pair && v.rankHigh === A,
    baseEquity: 0.12,
    band: [0.08, 0.19],
    modifiers: {},
    representatives: ['AA'],
  },
  {
    id: 'vs-kk',
    villainDesc: 'KK (crushed, you hold a K blocker)',
    matches: (v) => v.pair && v.rankHigh === K,
    baseEquity: 0.08,
    band: [0.05, 0.15],
    modifiers: {},
    representatives: ['KK'],
  },
  {
    id: 'vs-ax-shared-king',
    villainDesc: 'Ax that shares your King (e.g., K9 vs AK — kicker dominated under an Ace)',
    matches: (v, h) => villainIsAx(v) && sharedRank(h, v) === K,
    baseEquity: 0.24,
    band: [0.20, 0.36],
    modifiers: {},
    representatives: ['AKs', 'AKo'],
  },
  {
    id: 'vs-ax-shared-kicker',
    villainDesc: 'Ax sharing your low card (e.g., K5 vs A5 — dominated via Ace over King)',
    matches: (v, h) => villainIsAx(v) && sharedRank(h, v) === h.rankLow,
    baseEquity: 0.26,
    band: [0.20, 0.34],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-ax',
    villainDesc: 'Any Ax, no shared rank (Ace dominates K — you race with a lower over)',
    matches: (v, h) => villainIsAx(v) && sharedRank(h, v) < 0,
    baseEquity: 0.37,
    band: [0.30, 0.48],
    modifiers: { villainSuited: -0.025 },
    representatives: ['AQo', 'A5s'],
  },
  {
    id: 'vs-higher-kx',
    villainDesc: 'Higher Kx — kicker dominated',
    matches: (v, h) => !v.pair && v.rankHigh === K && v.rankLow > h.rankLow && !villainIsAx(v),
    baseEquity: 0.27,
    band: [0.22, 0.50],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-lower-kx',
    villainDesc: 'Lower Kx — you kicker-dominate',
    matches: (v, h) => !v.pair && v.rankHigh === K && v.rankLow < h.rankLow,
    baseEquity: 0.65,
    band: [0.50, 0.80],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-mirror-kx',
    villainDesc: 'Same Kx ranks, different suits',
    matches: (v, h) => !v.pair && v.rankHigh === K && v.rankLow === h.rankLow,
    baseEquity: 0.51,
    band: [0.47, 0.55],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-pair-below-kicker',
    villainDesc: 'Pair below your kicker (race)',
    matches: (v, h) => v.pair && v.rankHigh < h.rankLow,
    baseEquity: 0.48,
    band: [0.42, 0.53],
    modifiers: {},
    representatives: ['22', '33'],
  },
  {
    id: 'vs-pair-above-kicker',
    villainDesc: 'Pair above kicker, below K (split)',
    matches: (v, h) => v.pair && v.rankHigh < K && v.rankHigh > h.rankLow,
    baseEquity: 0.30,
    band: [0.26, 0.36],
    modifiers: {},
    representatives: ['QQ', 'JJ', 'TT'],
  },
  {
    id: 'vs-pair-equal-kicker',
    villainDesc: 'Pair of your kicker rank',
    matches: (v, h) => v.pair && v.rankHigh === h.rankLow,
    baseEquity: 0.33,
    band: [0.27, 0.40],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-unpaired-no-shared',
    villainDesc: 'Unpaired, no Ace/King, no shared rank',
    matches: (v, h) => !v.pair && v.rankHigh < K && !villainIsAx(v) && sharedRank(h, v) < 0,
    baseEquity: 0.56,
    band: [0.48, 0.72],
    modifiers: { villainSuited: -0.035 },
    representatives: ['JTs', '98s', 'QJo', 'T9o'],
  },
  {
    id: 'vs-unpaired-shared-low',
    villainDesc: 'Unpaired non-Ax hand sharing your low card (hero-K dominates)',
    matches: (v, h) => !v.pair && !villainIsAx(v) && v.rankHigh < K && sharedRank(h, v) === h.rankLow,
    baseEquity: 0.65,
    band: [0.40, 0.80],
    modifiers: {},
    representatives: [],
  },
];

const SUITED_CONNECTOR_LANES = [
  {
    id: 'vs-mirror',
    villainDesc: 'Same ranks, different suits',
    matches: (v, h) => !v.pair && v.rankHigh === h.rankHigh && v.rankLow === h.rankLow,
    baseEquity: 0.52,
    band: [0.47, 0.56],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-pair-of-high-card',
    villainDesc: 'Pair of your high card (set-blocker, hero has 2 pair outs via low card)',
    matches: (v, h) => v.pair && v.rankHigh === h.rankHigh,
    baseEquity: 0.18,
    band: [0.13, 0.24],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-pair-of-low-card',
    villainDesc: 'Pair of your low card (set-blocker, hero has high card over-pair outs)',
    matches: (v, h) => v.pair && v.rankHigh === h.rankLow,
    baseEquity: 0.38,
    band: [0.33, 0.44],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-overpair',
    villainDesc: 'Pair over both your cards (you are two unders)',
    matches: (v, h) => v.pair && v.rankHigh > h.rankHigh,
    baseEquity: 0.21,
    band: [0.17, 0.26],
    modifiers: { connectedness: +0.01 },
    representatives: ['AA', 'KK', 'QQ', 'TT'],
  },
  {
    id: 'vs-pair-between',
    villainDesc: 'Pair between your cards (split)',
    matches: (v, h) => v.pair && v.rankHigh < h.rankHigh && v.rankHigh > h.rankLow,
    baseEquity: 0.30,
    band: [0.25, 0.36],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-pair-below',
    villainDesc: 'Pair below both your cards',
    matches: (v, h) => v.pair && v.rankHigh < h.rankLow,
    baseEquity: 0.52,
    band: [0.46, 0.58],
    modifiers: {},
    representatives: ['22', '33'],
  },
  {
    id: 'vs-broadway-unpaired',
    villainDesc: 'Broadway/Ax unpaired, no shared rank (you are the connector underneath)',
    matches: (v, h) => !v.pair && sharedRank(h, v) < 0 && (villainIsAx(v) || v.rankHigh >= T),
    baseEquity: 0.39,
    band: [0.33, 0.50],
    modifiers: { villainSuited: -0.03 },
    representatives: ['AKo', 'KQo', 'QJs', 'AJs'],
  },
  {
    id: 'vs-straddle-mid-no-shared',
    villainDesc: 'Mid-rank villain straddling your range (one over your high, one under your low), no shared rank',
    matches: (v, h) => !v.pair && !villainIsAx(v) && sharedRank(h, v) < 0 && v.rankHigh > h.rankHigh && v.rankLow < h.rankLow && v.rankHigh < T,
    baseEquity: 0.47,
    band: [0.42, 0.51],
    modifiers: {},
    representatives: ['96o', '95o'],
  },
  {
    id: 'vs-one-over-one-within-mid-no-shared',
    villainDesc: 'Mid-rank villain with one card over you, one between your ranks (dominator), no shared',
    matches: (v, h) => !v.pair && !villainIsAx(v) && sharedRank(h, v) < 0 && v.rankHigh > h.rankHigh && v.rankLow > h.rankLow && v.rankLow < h.rankHigh && v.rankHigh < T,
    baseEquity: 0.40,
    band: [0.34, 0.44],
    modifiers: {},
    representatives: ['97o'],
  },
  {
    id: 'vs-two-overs-mid-no-shared',
    villainDesc: 'Mid-rank villain with both cards over your high card, no shared rank',
    matches: (v, h) => !v.pair && !villainIsAx(v) && sharedRank(h, v) < 0 && v.rankLow > h.rankHigh && v.rankHigh < T,
    baseEquity: 0.37,
    band: [0.32, 0.41],
    modifiers: {},
    representatives: ['98o', '97s'],
  },
  {
    id: 'vs-dominating-high-card',
    villainDesc: 'Unpaired hand with a higher card sharing one of yours (dominated)',
    matches: (v, h) => !v.pair && sharedRank(h, v) >= 0 && v.rankHigh > h.rankHigh,
    baseEquity: 0.32,
    band: [0.22, 0.42],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-lower-connector-or-gapper',
    villainDesc: 'Lower unpaired hand with no shared rank (you dominate structurally)',
    matches: (v, h) => !v.pair && !villainIsAx(v) && v.rankHigh < h.rankLow && sharedRank(h, v) < 0,
    baseEquity: 0.63,
    band: [0.58, 0.75],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-similar-tier-shared',
    villainDesc: 'Overlapping-tier unpaired with shared rank (interlocking structure)',
    matches: (v, h) => !v.pair && !villainIsAx(v) && sharedRank(h, v) >= 0 && v.rankHigh <= h.rankHigh,
    baseEquity: 0.55,
    band: [0.25, 0.78],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-similar-tier-no-shared',
    villainDesc: 'Similar-tier unpaired hand, no shared rank (roughly even with small edges)',
    matches: (v, h) => !v.pair && !villainIsAx(v) && sharedRank(h, v) < 0 && v.rankHigh >= h.rankLow && v.rankHigh <= h.rankHigh,
    baseEquity: 0.50,
    band: [0.40, 0.60],
    modifiers: {},
    representatives: [],
  },
];

const MIDDLING_OFFSUIT_LANES = [
  {
    id: 'vs-mirror-suited',
    villainDesc: 'Same ranks, villain suited (you face a 2.5% flush deficit)',
    matches: (v, h) => !v.pair && v.suited && v.rankHigh === h.rankHigh && v.rankLow === h.rankLow,
    baseEquity: 0.46,
    band: [0.42, 0.50],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-mirror-offsuit',
    villainDesc: 'Same ranks, both offsuit (card-removal coin flip)',
    matches: (v, h) => !v.pair && !v.suited && v.rankHigh === h.rankHigh && v.rankLow === h.rankLow,
    baseEquity: 0.50,
    band: [0.49, 0.51],
    modifiers: {},
    representatives: ['Q9o', 'T9o', 'J8o'],
  },
  {
    id: 'vs-pair-of-high-card',
    villainDesc: 'Pair of your high card',
    matches: (v, h) => v.pair && v.rankHigh === h.rankHigh,
    baseEquity: 0.13,
    band: [0.08, 0.20],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-pair-of-low-card',
    villainDesc: 'Pair of your low card',
    matches: (v, h) => v.pair && v.rankHigh === h.rankLow,
    baseEquity: 0.36,
    band: [0.28, 0.42],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-overpair',
    villainDesc: 'Pocket pair above your high card',
    matches: (v, h) => v.pair && v.rankHigh > h.rankHigh,
    baseEquity: 0.18,
    band: [0.14, 0.24],
    modifiers: {},
    representatives: ['AA', 'KK', 'QQ'],
  },
  {
    id: 'vs-pair-between',
    villainDesc: 'Pair between your cards',
    matches: (v, h) => v.pair && v.rankHigh < h.rankHigh && v.rankHigh > h.rankLow,
    baseEquity: 0.30,
    band: [0.24, 0.36],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-pair-below',
    villainDesc: 'Pair below both your cards',
    matches: (v, h) => v.pair && v.rankHigh < h.rankLow,
    baseEquity: 0.50,
    band: [0.40, 0.58],
    modifiers: {},
    representatives: ['22', '33'],
  },
  {
    id: 'vs-shared-high-kicker-under-low',
    villainDesc: 'Villain shares your high card with a kicker below your low (you kicker-dominate)',
    matches: (v, h) => !v.pair && !villainIsAx(v) && sharedRank(h, v) === h.rankHigh && kickerOf(v, h.rankHigh) < h.rankLow,
    baseEquity: 0.62,
    band: [0.50, 0.72],
    modifiers: {},
    representatives: ['Q5o', 'Q4o'],
  },
  {
    id: 'vs-shared-high-kicker-between',
    villainDesc: 'Villain shares your high card with a kicker between your ranks (villain kicker-dominates)',
    matches: (v, h) => !v.pair && !villainIsAx(v) && sharedRank(h, v) === h.rankHigh && kickerOf(v, h.rankHigh) > h.rankLow && kickerOf(v, h.rankHigh) < h.rankHigh,
    baseEquity: 0.36,
    band: [0.25, 0.47],
    modifiers: {},
    representatives: ['QJs', 'QTo'],
  },
  {
    id: 'vs-dominator',
    villainDesc: 'Unpaired hand with a higher card sharing one of yours',
    matches: (v, h) => !v.pair && sharedRank(h, v) >= 0 && v.rankHigh > h.rankHigh,
    baseEquity: 0.28,
    band: [0.20, 0.42],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-shared-low-kicker-under-high',
    villainDesc: 'Villain shares your low card with their other card at or below your high (you high-card-dominate)',
    matches: (v, h) => !v.pair && !villainIsAx(v) && sharedRank(h, v) === h.rankLow && kickerOf(v, h.rankLow) <= h.rankHigh && v.rankHigh <= h.rankHigh,
    baseEquity: 0.66,
    band: [0.56, 0.74],
    modifiers: {},
    representatives: ['J9o', 'T9o'],
  },
  {
    id: 'vs-two-overs-no-shared',
    villainDesc: 'Two overcards, no shared rank',
    matches: (v, h) => !v.pair && v.rankLow > h.rankHigh && sharedRank(h, v) < 0,
    baseEquity: 0.38,
    band: [0.30, 0.48],
    modifiers: { villainSuited: -0.035 },
    representatives: ['AKo', 'KQo', 'AQs'],
  },
  {
    id: 'vs-ax-split-no-shared',
    villainDesc: 'Ax dominator with kicker within or below your range',
    matches: (v, h) => villainIsAx(v) && sharedRank(h, v) < 0 && v.rankLow <= h.rankHigh,
    baseEquity: 0.40,
    band: [0.33, 0.47],
    modifiers: { villainSuited: -0.03 },
    representatives: ['AJo', 'A8s', 'A5o'],
  },
  {
    id: 'vs-straddle-no-shared',
    villainDesc: 'Unpaired villain straddling your range (one higher, one lower), no shared rank',
    matches: (v, h) => !v.pair && !villainIsAx(v) && sharedRank(h, v) < 0 && v.rankHigh > h.rankHigh && v.rankLow < h.rankLow,
    baseEquity: 0.43,
    band: [0.38, 0.52],
    modifiers: {},
    representatives: ['K7o', 'J5o'],
  },
  {
    id: 'vs-one-over-one-within-no-shared',
    villainDesc: 'Villain has one card over you, one between your ranks (dominator, no shared rank)',
    matches: (v, h) => !v.pair && !villainIsAx(v) && sharedRank(h, v) < 0 && v.rankHigh > h.rankHigh && v.rankLow > h.rankLow && v.rankLow < h.rankHigh,
    baseEquity: 0.36,
    band: [0.31, 0.40],
    modifiers: {},
    representatives: ['KJs', 'KTs'],
  },
  {
    id: 'vs-weak-unpaired',
    villainDesc: 'Weak unpaired, no shared rank, no two overs',
    matches: (v, h) => !v.pair && sharedRank(h, v) < 0 && v.rankHigh <= h.rankHigh,
    baseEquity: 0.66,
    band: [0.45, 0.72],
    modifiers: {},
    representatives: ['32o', '43o'],
  },
  {
    id: 'vs-dominator-shared-low',
    villainDesc: 'Villain with a higher card sharing your low card',
    matches: (v, h) => !v.pair && v.rankHigh > h.rankHigh && sharedRank(h, v) === h.rankLow,
    baseEquity: 0.32,
    band: [0.20, 0.45],
    modifiers: {},
    representatives: [],
  },
];

const OFFSUIT_GARBAGE_LANES = [
  {
    id: 'vs-pair-below',
    villainDesc: 'Pair below both your cards (you are two-overs, weakly)',
    matches: (v, h) => v.pair && v.rankHigh < h.rankLow,
    baseEquity: 0.45,
    band: [0.33, 0.55],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-pair-of-low',
    villainDesc: 'Pair of your low card (dominating but you hold a blocker)',
    matches: (v, h) => v.pair && v.rankHigh === h.rankLow,
    baseEquity: 0.33,
    band: [0.22, 0.42],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-pair-of-high',
    villainDesc: 'Pair of your high card (dominating, you hold one blocker)',
    matches: (v, h) => v.pair && v.rankHigh === h.rankHigh,
    baseEquity: 0.15,
    band: [0.05, 0.25],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-pair-between',
    villainDesc: 'Pair between your cards',
    matches: (v, h) => v.pair && v.rankHigh > h.rankLow && v.rankHigh < h.rankHigh,
    baseEquity: 0.23,
    band: [0.10, 0.35],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-overpair',
    villainDesc: 'Pair over both your cards',
    matches: (v, h) => v.pair && v.rankHigh > h.rankHigh,
    baseEquity: 0.12,
    band: [0.05, 0.22],
    modifiers: {},
    representatives: ['AA', 'QQ'],
  },
  {
    id: 'vs-dominator',
    villainDesc: 'Higher hand sharing one of your cards',
    matches: (v, h) => !v.pair && sharedRank(h, v) >= 0 && v.rankHigh >= h.rankHigh,
    baseEquity: 0.25,
    band: [0.15, 0.45],
    modifiers: {},
    representatives: [],
  },
  {
    id: 'vs-two-overs',
    villainDesc: 'Two overcards, no shared rank',
    matches: (v, h) => !v.pair && v.rankLow > h.rankHigh && sharedRank(h, v) < 0,
    baseEquity: 0.33,
    band: [0.25, 0.45],
    modifiers: { villainSuited: -0.035 },
    representatives: ['AKo', 'KQo', 'QJs'],
  },
  {
    id: 'vs-shared-low-hero-dominates',
    villainDesc: 'Villain shares your low card with no higher card than you (you dominate via high card)',
    matches: (v, h) => !v.pair && !villainIsAx(v) && sharedRank(h, v) === h.rankLow && v.rankHigh < h.rankHigh,
    baseEquity: 0.69,
    band: [0.61, 0.75],
    modifiers: {},
    representatives: ['J7o', 'T7o', '97o'],
  },
  {
    id: 'vs-no-shared-no-dominate',
    villainDesc: 'Unpaired, no shared rank, not two overs',
    matches: (v, h) => !v.pair && sharedRank(h, v) < 0,
    baseEquity: 0.45,
    band: [0.20, 0.72],
    modifiers: {},
    representatives: ['T9s', '87o'],
  },
];

// ---------- Registry ---------- //

export const SHAPES = [
  {
    id: 'pocket-pair',
    name: 'Pocket Pair',
    matches: isPocketPair,
    lanes: POCKET_PAIR_LANES,
  },
  {
    id: 'ax-suited',
    name: 'Ax suited',
    matches: isAxSuited,
    lanes: AX_SUITED_LANES,
  },
  {
    id: 'ax-offsuit',
    name: 'Ax offsuit',
    matches: isAxOffsuit,
    lanes: AX_OFFSUIT_LANES,
  },
  {
    id: 'broadway-broadway',
    name: 'Broadway–Broadway',
    matches: isBroadwayBroadway,
    lanes: BROADWAY_BROADWAY_LANES,
  },
  {
    id: 'kx-non-broadway',
    name: 'Kx (non-broadway kicker)',
    matches: isKxNonBroadway,
    lanes: KX_NON_BROADWAY_LANES,
  },
  {
    id: 'suited-connector-or-gapper',
    name: 'Suited Connector / Gapper',
    matches: isSuitedConnectorOrGapper,
    lanes: SUITED_CONNECTOR_LANES,
  },
  {
    id: 'middling-offsuit',
    name: 'Middling Offsuit',
    matches: isMiddlingOffsuit,
    lanes: MIDDLING_OFFSUIT_LANES,
  },
  {
    id: 'offsuit-garbage',
    name: 'Offsuit Garbage',
    matches: isOffsuitGarbage,
    lanes: OFFSUIT_GARBAGE_LANES,
  },
];

// ---------- Public API ---------- //

/**
 * Classify hero's holding into exactly one shape. Shapes are tried in order;
 * first match wins. Throws if no shape matches (indicates a classifier bug —
 * all 169 hand classes should be covered).
 *
 * @param {string|{rankHigh,rankLow,suited,pair}} hero
 */
export const classifyHero = (hero) => {
  const h = typeof hero === 'string' ? parseHandClass(hero) : hero;
  for (const shape of SHAPES) {
    if (shape.matches(h)) return shape;
  }
  throw new Error(`classifyHero: no shape matched ${JSON.stringify(h)}`);
};

/**
 * Classify a (hero, villain) matchup into exactly one lane within hero's
 * shape. Lanes are tried in order; first match wins. Returns
 * { shape, lane: null } if no lane matches.
 *
 * @param {string|object} hero
 * @param {string|object} villain
 * @returns {{shape, lane}}
 */
export const classifyLane = (hero, villain) => {
  const h = typeof hero === 'string' ? parseHandClass(hero) : hero;
  const v = typeof villain === 'string' ? parseHandClass(villain) : villain;
  const shape = classifyHero(h);
  for (const lane of shape.lanes) {
    if (lane.matches(v, h)) return { shape, lane };
  }
  throw new Error(
    `classifyLane: no lane matched in shape "${shape.id}" for villain ` +
    `${JSON.stringify(v)} vs hero ${JSON.stringify(h)}. ` +
    `Every 169×169 matchup must route to a specific lane — add a predicate.`,
  );
};

/**
 * Look up a shape by id.
 */
export const getShape = (id) => SHAPES.find((s) => s.id === id) || null;

/**
 * Determine which of a lane's declared modifiers genuinely apply to this
 * specific (hero, villain) matchup. Used by Recipe Drill's modifier step
 * and by any UI surface that wants to say "these are the modifiers that
 * actually kick in for this exact hand."
 *
 * Returns a Set<string> of modifier keys drawn from the lane's `modifiers`
 * declaration. If the lane doesn't declare a modifier, it's never returned
 * (even if the condition would fire).
 *
 * Rules (per modifier key):
 *   - `heroSuited`:     hero is suited
 *   - `villainSuited`:  villain is suited
 *   - `flushDominator`: both suited AND hero's high rank > villain's high rank
 *   - `flushDominated`: both suited AND hero's high rank < villain's high rank
 *   - `connectedness`:  villain is unpaired with gap ≤ 1 (connector / 1-gap)
 *
 * @param {object} hero    parsed hand class
 * @param {object} villain parsed hand class
 * @param {object} lane    a shape lane (has .modifiers declaration)
 * @returns {Set<string>}
 */
export const detectApplicableModifiers = (hero, villain, lane) => {
  const out = new Set();
  const mods = lane?.modifiers || {};
  if ('heroSuited' in mods && hero.suited) out.add('heroSuited');
  if ('villainSuited' in mods && villain.suited) out.add('villainSuited');
  const bothSuited = hero.suited && villain.suited;
  if ('flushDominator' in mods && bothSuited && hero.rankHigh > villain.rankHigh) out.add('flushDominator');
  if ('flushDominated' in mods && bothSuited && hero.rankHigh < villain.rankHigh) out.add('flushDominated');
  if ('connectedness' in mods && !villain.pair && (villain.rankHigh - villain.rankLow - 1) <= 1) {
    out.add('connectedness');
  }
  return out;
};
