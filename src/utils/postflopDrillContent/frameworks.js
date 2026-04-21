/**
 * frameworks.js — catalog of postflop range-vs-board frameworks.
 *
 * Each framework is a teachable lens with `applies()` + `narrate()`.
 * Frameworks compose — any scenario (range + flop, or two ranges + flop)
 * may match ≥ 1 of them.
 *
 * Input to every framework is a `scenario` object:
 *   {
 *     range:           Float64Array,        — focal range
 *     board:           number[],            — 3 encoded flop cards
 *     opposingRange:   Float64Array | null, — optional second range
 *     context:         { position, action, vs? }  — focal preflop context
 *     opposingContext: { position, action, vs? } | null,
 *     precomputed:     { rangeEquity? }     — optional MC equity attachment
 *   }
 *
 * Narrations are hand-type-precise: instead of fuzzy bucket labels, they
 * cite explicit hand-type %s ("14% overpair, 7% top pair, 12% gutshots")
 * drawn from the engine's 22-type taxonomy via `handTypeBreakdown`.
 *
 * Pure module — no imports from UI or state layers.
 */

import {
  handTypeBreakdown,
  pctMadeFlushPlus,
  pctMadeStraightPlus,
  pctSetTripsTwoPair,
  pctTopPairPlus,
  pctStrongDraws,
  pctWeakDraws,
  pctAir,
  pctAnyPairPlus,
} from './handTypeBreakdown';
import { analyzeBoardTexture } from '../pokerCore/boardTexture';
import { cardRank, parseBoard } from '../pokerCore/cardParser';
import { MULTIWAY_FRAMEWORKS, MULTIWAY_FRAMEWORK_ORDER } from './multiwayFrameworks';

// ---------- Helpers ---------- //

const pct = (x, digits = 0) => `${(x * 100).toFixed(digits)}%`;

const RANK_LABELS = '23456789TJQKA';
const rankLabel = (r) => RANK_LABELS[r];

const boardLabel = (board) => board.map((c) => rankLabel(cardRank(c))).join('');

const ensureBoardArray = (board) => {
  if (!board) return [];
  if (Array.isArray(board) && typeof board[0] === 'number') return board;
  if (Array.isArray(board) && typeof board[0] === 'string') return parseBoard(board);
  return [];
};

/**
 * Format non-zero hand-type %s as a compact comma-separated list for
 * narration. E.g. "overpair 14%, TPTK+ 7%, OESD 4%".
 */
const describeHandTypes = (byGroup, { minPct = 0.01, limit = 6 } = {}) => {
  const items = [];
  for (const g of Object.values(byGroup)) {
    for (const t of g.types) {
      if (t.pct >= minPct) items.push({ label: t.label, pct: t.pct });
    }
  }
  items.sort((a, b) => b.pct - a.pct);
  return items.slice(0, limit).map((t) => `${t.label} ${pct(t.pct, 1)}`).join(', ');
};

// ---------- Frameworks ---------- //

/**
 * RANGE_DECOMPOSITION — always applies (3-card flop). Surfaces the full
 * hand-type distribution plus aggregate made-hand / draw / air shares.
 *
 * This is the decomposition spine: "every range on every flop has a specific
 * hand-type composition. Don't think in fuzzy labels — know the %s."
 */
export const RANGE_DECOMPOSITION = {
  id: 'range_decomposition',
  name: 'Range Decomposition',
  shortDescription: 'Hand-type-precise breakdown of the range on this flop.',
  subcases: [{ id: 'always', claim: 'Decompose the range into every hand-type category.', band: null }],
  applies: (s) => {
    const board = ensureBoardArray(s.board);
    if (board.length !== 3) return null;
    const bd = handTypeBreakdown(s.range, board);
    return { subcase: 'always', favored: null, details: bd };
  },
  narrate: (s, match) => {
    const bd = match.details;
    const flushPlus = pctMadeFlushPlus(bd);
    const straightPlus = pctMadeStraightPlus(bd);
    const setTripsTwoPair = pctSetTripsTwoPair(bd);
    const topPairPlus = pctTopPairPlus(bd);
    const strongDraws = pctStrongDraws(bd);
    const weakDraws = pctWeakDraws(bd);
    const air = pctAir(bd);
    const specifics = describeHandTypes(bd.byGroup, { minPct: 0.015, limit: 8 });
    return (
      `On ${boardLabel(ensureBoardArray(s.board))} — `
      + `flush+ ${pct(flushPlus, 1)}, straight+ ${pct(straightPlus, 1)}, `
      + `set/trips/two-pair ${pct(setTripsTwoPair, 1)}, top pair+ ${pct(topPairPlus, 1)}, `
      + `strong draws (combo/FD/OESD) ${pct(strongDraws, 1)}, weak draws (gutshot/overcards) ${pct(weakDraws, 1)}, `
      + `air ${pct(air, 1)}. `
      + (specifics ? `Top hand types: ${specifics}.` : '')
    );
  },
};

/**
 * RANGE_ADVANTAGE — applies when two ranges are in play. Compares
 * weighted-average rank of made-hand-or-better categories. If MC equity is
 * precomputed and attached, we narrate the numeric delta; otherwise narrate
 * structurally from hand-type shares.
 */
export const RANGE_ADVANTAGE = {
  id: 'range_advantage',
  name: 'Range Advantage',
  shortDescription: 'Which range has more overall equity against the other on this flop.',
  subcases: [
    { id: 'significant', claim: 'Significant advantage (≥6 pp)', band: null },
    { id: 'moderate',    claim: 'Moderate advantage (3–6 pp)',    band: null },
    { id: 'slight',      claim: 'Slight advantage (1–3 pp)',      band: null },
    { id: 'neutral',     claim: 'Near equity (within 1 pp)',      band: null },
  ],
  applies: (s) => {
    if (!s.opposingRange) return null;
    const rEq = s.precomputed && s.precomputed.rangeEquity;
    if (rEq) {
      const delta = (rEq.aEq - rEq.bEq) * 100;
      const abs = Math.abs(delta);
      const sub = abs >= 6 ? 'significant' : abs >= 3 ? 'moderate' : abs >= 1 ? 'slight' : 'neutral';
      return { subcase: sub, favored: delta > 0 ? 'A' : delta < 0 ? 'B' : null, details: { delta, aEq: rEq.aEq, bEq: rEq.bEq } };
    }
    // Structural fallback: weighted hand-type-tier score.
    const board = ensureBoardArray(s.board);
    const bdA = handTypeBreakdown(s.range, board);
    const bdB = handTypeBreakdown(s.opposingRange, board);
    // Approximate equity of a range by summing tier weights × tier-midpoint-equity.
    // Tiers decay geometrically from flush+ (~92%) to air (~15%).
    const tierScore = (bd) => (
      pctMadeFlushPlus(bd) * 0.95 +
      (pctMadeStraightPlus(bd) - pctMadeFlushPlus(bd)) * 0.88 +
      pctSetTripsTwoPair(bd) * 0.80 +
      (bd.handTypes.overpair.pct + bd.handTypes.topPairGood.pct) * 0.68 +
      bd.handTypes.topPairWeak.pct * 0.58 +
      bd.handTypes.middlePair.pct * 0.48 +
      bd.handTypes.bottomPair.pct * 0.42 +
      bd.handTypes.weakPair.pct * 0.45 +
      (bd.handTypes.comboDraw.pct) * 0.52 +
      (bd.handTypes.nutFlushDraw.pct + bd.handTypes.nonNutFlushDraw.pct) * 0.38 +
      bd.handTypes.oesd.pct * 0.34 +
      bd.handTypes.gutshot.pct * 0.22 +
      bd.handTypes.overcards.pct * 0.22 +
      bd.handTypes.air.pct * 0.12
    );
    const eqA = tierScore(bdA);
    const eqB = tierScore(bdB);
    const norm = eqA + eqB > 0 ? eqA / (eqA + eqB) : 0.5;
    const delta = (norm - (1 - norm)) * 100;
    const abs = Math.abs(delta);
    const sub = abs >= 6 ? 'significant' : abs >= 3 ? 'moderate' : abs >= 1 ? 'slight' : 'neutral';
    return {
      subcase: sub,
      favored: delta > 0 ? 'A' : delta < 0 ? 'B' : null,
      details: { delta, heuristic: true, aEq: norm, bEq: 1 - norm },
    };
  },
  narrate: (s, match) => {
    const { delta, aEq, bEq, heuristic } = match.details;
    const sign = delta > 0 ? '+' : '';
    const label = match.favored ? (match.favored === 'A' ? 'focal range' : 'opposing range') : 'neither range';
    const src = heuristic ? ` (tier-weighted estimate — exact MC not run)` : ``;
    return `Range advantage: ${sign}${delta.toFixed(1)} pp for ${label} (${pct(aEq, 1)} vs ${pct(bEq, 1)})${src}. `
      + `${match.subcase === 'neutral' ? 'Near-equity spots reward positional play.' : 'The advantaged side can bet at higher frequencies; sizing depends on the nut-advantage shape.'}`;
  },
};

/**
 * NUT_ADVANTAGE — compares strictly-made strong-hand shares (straight+ plus
 * sets/trips/two-pair). Overpairs and TPTK explicitly EXCLUDED — they
 * belong to top-pair tier, not the "nut region."
 */
export const NUT_ADVANTAGE = {
  id: 'nut_advantage',
  name: 'Nut Advantage',
  shortDescription: 'Who has more straight+ / set / two-pair combos on this flop.',
  subcases: [
    { id: 'crushing', claim: 'One side holds the nut region lopsidedly (≥ 8 pp)', band: null },
    { id: 'real',     claim: 'Real nut advantage (3–8 pp)',                         band: null },
    { id: 'nominal',  claim: 'Nominal advantage (<3 pp)',                           band: null },
  ],
  applies: (s) => {
    if (!s.opposingRange) return null;
    const board = ensureBoardArray(s.board);
    const bdA = handTypeBreakdown(s.range, board);
    const bdB = handTypeBreakdown(s.opposingRange, board);
    // Nut region = straight+ ∪ sets/trips/two-pair.
    const aNuts = pctMadeStraightPlus(bdA) + pctSetTripsTwoPair(bdA);
    const bNuts = pctMadeStraightPlus(bdB) + pctSetTripsTwoPair(bdB);
    const delta = (aNuts - bNuts) * 100;
    const abs = Math.abs(delta);
    const sub = abs >= 8 ? 'crushing' : abs >= 3 ? 'real' : 'nominal';
    const favored = delta > 0.5 ? 'A' : delta < -0.5 ? 'B' : null;
    return { subcase: sub, favored, details: { aNutsPct: aNuts, bNutsPct: bNuts, delta, bdA, bdB } };
  },
  narrate: (s, match) => {
    const { aNutsPct, bNutsPct, delta, bdA, bdB } = match.details;
    const who = match.favored === 'A' ? 'focal range' : match.favored === 'B' ? 'opposing range' : 'neither';
    const aFlush = pctMadeFlushPlus(bdA);
    const bFlush = pctMadeFlushPlus(bdB);
    const aStraight = pctMadeStraightPlus(bdA) - aFlush;
    const bStraight = pctMadeStraightPlus(bdB) - bFlush;
    const flushLine = (aFlush > 0.005 || bFlush > 0.005)
      ? ` Flush+ share — A ${pct(aFlush, 1)} vs B ${pct(bFlush, 1)}.` : '';
    const straightLine = (aStraight > 0.005 || bStraight > 0.005)
      ? ` Straight share — A ${pct(aStraight, 1)} vs B ${pct(bStraight, 1)}.` : '';
    return `Nut region (straight+/set/trips/two-pair): A ${pct(aNutsPct, 1)} vs B ${pct(bNutsPct, 1)} — `
      + `delta ${delta > 0 ? '+' : ''}${delta.toFixed(1)} pp favors ${who}.${flushLine}${straightLine} `
      + `${match.subcase === 'crushing' ? 'Overbets and pressure sizings are available to the advantaged side.' : match.subcase === 'real' ? 'Polarized larger bets by the advantaged side are supported.' : 'Both sides can credibly rep the nut region — sizing is less constrained.'}`;
  },
};

/**
 * RANGE_MORPHOLOGY — classifies the focal range on the board as
 * linear / polarized / condensed / capped using hand-type shares.
 *
 *   - capped    : flush+straight+sets+two-pair < 2%  (engine's isCapped OK as sanity)
 *   - polarized : (strong made ≥ 18%) AND (air ≥ 30%) AND (medium pairs ≤ 25%)
 *   - condensed : (middle/bottom/weak pair + weak draws ≥ 55%) AND (nut region ≤ 5%)
 *                 AND (air ≤ 25%)
 *   - linear    : otherwise (merged top-down distribution)
 */
export const RANGE_MORPHOLOGY = {
  id: 'range_morphology',
  name: 'Range Morphology',
  shortDescription: 'Is this range polarized, condensed, linear, or capped on this flop?',
  subcases: [
    { id: 'capped',    claim: 'Range has essentially no nut-region combos here',      band: null },
    { id: 'polarized', claim: 'Strong made + air heavy, little medium middle',          band: null },
    { id: 'condensed', claim: 'Mostly mid/low pairs + weak draws, few nuts, low air',    band: null },
    { id: 'linear',    claim: 'Monotonic top-down distribution (merged)',                 band: null },
  ],
  applies: (s) => {
    const board = ensureBoardArray(s.board);
    if (board.length !== 3) return null;
    const bd = handTypeBreakdown(s.range, board);
    const nutRegion = pctMadeStraightPlus(bd) + pctSetTripsTwoPair(bd);
    const topPairTier = bd.handTypes.overpair.pct + bd.handTypes.topPairGood.pct + bd.handTypes.topPairWeak.pct;
    const midLow = bd.handTypes.middlePair.pct + bd.handTypes.bottomPair.pct + bd.handTypes.weakPair.pct;
    const weakDraws = pctWeakDraws(bd);
    const air = pctAir(bd);
    const strongMade = nutRegion + topPairTier;

    let sub;
    if (bd.isCapped || nutRegion <= 0.02) sub = 'capped';
    else if (strongMade >= 0.20 && air >= 0.30 && (midLow + weakDraws) <= 0.30) sub = 'polarized';
    else if ((midLow + weakDraws) >= 0.55 && nutRegion <= 0.05 && air <= 0.25) sub = 'condensed';
    else sub = 'linear';

    return {
      subcase: sub,
      favored: null,
      details: { morphology: sub, nutRegion, topPairTier, midLow, weakDraws, air, bd },
    };
  },
  narrate: (s, match) => {
    const { morphology, nutRegion, topPairTier, midLow, weakDraws, air } = match.details;
    const desc = morphology === 'capped'
      ? `capped: only ${pct(nutRegion, 1)} nut-region combos — the range can't credibly rep straight+/set/two-pair`
      : morphology === 'polarized'
        ? `polarized: ${pct(nutRegion + topPairTier)} strong made + ${pct(air)} air — big bets natural; bluff selection matters`
        : morphology === 'condensed'
          ? `condensed: ${pct(midLow + weakDraws)} medium-strength (mid/low pair + weak draws), ${pct(nutRegion, 1)} nuts — small pot-control sizing`
          : `linear: a top-down distribution (${pct(nutRegion + topPairTier)} strong, ${pct(midLow + weakDraws)} medium, ${pct(air)} air)`;
    return `Morphology on ${boardLabel(ensureBoardArray(s.board))} — ${desc}.`;
  },
};

/**
 * BOARD_TILT — texture-based classification of which preflop archetype is
 * structurally favored. Uses analyzeBoardTexture + rank inspection only.
 */
export const BOARD_TILT = {
  id: 'board_tilt',
  name: 'Board Tilt',
  shortDescription: 'Which preflop archetype does this board structurally favor.',
  subcases: [
    { id: 'high_favors_pfr',     claim: 'High broadway board — favors the PFR / open range',          band: null },
    { id: 'low_favors_defender', claim: 'Low connected board — favors the defender / caller',         band: null },
    { id: 'paired',              claim: 'Paired board — trips/boats concentrated in the wider range', band: null },
    { id: 'monotone',            claim: 'Monotone board — flush blockers matter more than pairs',     band: null },
    { id: 'neutral',             claim: 'Middling board — no strong structural tilt',                 band: null },
  ],
  applies: (s) => {
    const board = ensureBoardArray(s.board);
    if (board.length !== 3) return null;
    const tx = analyzeBoardTexture(board);
    if (!tx) return null;
    const ranks = board.map(cardRank).sort((a, b) => b - a);
    const topRank = ranks[0];
    const allHigh = ranks.every((r) => r >= 9);      // T or higher
    const allLow  = ranks.every((r) => r <= 6);      // 8 or lower
    const anyHigh = topRank >= 10;                   // J or higher
    let sub;
    if (tx.monotone) sub = 'monotone';
    else if (tx.isPaired) sub = 'paired';
    else if (allHigh || (anyHigh && ranks[1] >= 8)) sub = 'high_favors_pfr';
    else if (allLow) sub = 'low_favors_defender';
    else sub = 'neutral';
    return { subcase: sub, favored: null, details: { texture: tx, ranks, topRank } };
  },
  narrate: (s, match) => {
    const sub = match.subcase;
    if (sub === 'high_favors_pfr')
      return 'High-card board: the PFR holds every AA/KK/QQ and all the AK/AQ combos — an overwhelming nut-and-top-pair advantage. Defender is capped; bet small at high frequency and polarize later.';
    if (sub === 'low_favors_defender')
      return 'Low connected board: the open range skews high and whiffs heavily here, while the defending range has more small pairs and connectors that connected. Defender has more sets, two-pairs, and straights — BTN\'s AK has nothing.';
    if (sub === 'paired')
      return 'Paired board: the range with more suited/connected hands holds more trips, but the nut advantage shrinks because quads/boats are rare. Widest range often has most trips — usually the defender.';
    if (sub === 'monotone')
      return 'Monotone flop: the suited holdings in each range dominate equity. Flush blockers (holding one card of the suit) become more valuable than pairs. Bluff frequency drops sharply unless you block the flush.';
    return 'Middling board — no strong structural tilt. Fall back to specific range advantage and nut advantage.';
  },
};

/**
 * CAPPED_RANGE_CHECK — flags when the focal range's preflop action excludes
 * premiums that the board specifically rewards.
 */
export const CAPPED_RANGE_CHECK = {
  id: 'capped_range_check',
  name: 'Capped Range Check',
  shortDescription: 'Does the preflop action exclude premiums that the board rewards?',
  subcases: [
    { id: 'capped_no_aces',      claim: 'Call range misses AA on an ace-high flop',   band: null },
    { id: 'capped_no_kings',     claim: 'Call range misses KK on a king-high flop',   band: null },
    { id: 'capped_no_sets_high', claim: 'Call range has no high-pair sets here',      band: null },
    { id: 'uncapped',            claim: 'Preflop action allows the board-rewarded premiums', band: null },
  ],
  applies: (s) => {
    const ctx = s.context || {};
    const passiveActions = new Set(['call', 'limp']);
    if (!passiveActions.has(ctx.action)) return null;
    const board = ensureBoardArray(s.board);
    if (board.length !== 3) return null;
    const ranks = board.map(cardRank);
    const topRank = Math.max(...ranks);
    const uniq = new Set(ranks);
    if (uniq.size < 3) return null;
    if (topRank === 12) return { subcase: 'capped_no_aces',      favored: null, details: { topRank } };
    if (topRank === 11) return { subcase: 'capped_no_kings',     favored: null, details: { topRank } };
    if (topRank >= 9)   return { subcase: 'capped_no_sets_high', favored: null, details: { topRank } };
    return { subcase: 'uncapped', favored: null, details: { topRank } };
  },
  narrate: (s, match) => {
    const top = rankLabel(match.details.topRank);
    if (match.subcase === 'capped_no_aces')
      return `This range called preflop — typical defending ranges exclude AA (which 3bets for value). On an A-high flop, the caller cannot credibly represent top set or an overpair. Hero can apply pressure asymmetrically.`;
    if (match.subcase === 'capped_no_kings')
      return `Call range typically excludes KK (value-3bet). On a K-high flop, top set is not in the caller's range — unlike the PFR who opens KK. Expect the caller to play top-pair-max, not two-pair+, against aggression.`;
    if (match.subcase === 'capped_no_sets_high')
      return `Passive preflop lines under-represent the top pair sets on boards ${top}-high and higher. The caller's strongest likely holding is TP with a decent kicker — their range is capped at ~two pair.`;
    return `Preflop action allows the board-rewarded premiums to be in range; no structural capping on this flop.`;
  },
};

/**
 * WHIFF_RATE — % of the range that has neither made hand nor meaningful outs.
 * Uses engine's hand-type 'air' directly. (Gutshots + overcards are NOT air
 * — they live in `weakDraws` and are called out separately.)
 */
export const WHIFF_RATE = {
  id: 'whiff_rate',
  name: 'Whiff Rate',
  shortDescription: 'What % of this range is outright air on this flop (no pair, no draw, no overcards).',
  subcases: [
    { id: 'heavy_whiff',     claim: 'Range whiffs ≥ 50%',               band: null },
    { id: 'moderate_whiff',  claim: 'Range whiffs 30–50%',              band: null },
    { id: 'light_whiff',     claim: 'Range whiffs 15–30%',              band: null },
    { id: 'well_connected',  claim: 'Range whiffs < 15% — dense board', band: null },
  ],
  applies: (s) => {
    const board = ensureBoardArray(s.board);
    if (board.length !== 3) return null;
    const bd = handTypeBreakdown(s.range, board);
    const air = pctAir(bd);
    const weakDraws = pctWeakDraws(bd);
    let sub;
    if (air >= 0.50) sub = 'heavy_whiff';
    else if (air >= 0.30) sub = 'moderate_whiff';
    else if (air >= 0.15) sub = 'light_whiff';
    else sub = 'well_connected';
    return { subcase: sub, favored: null, details: { air, weakDraws } };
  },
  narrate: (s, match) => {
    const { air, weakDraws } = match.details;
    return `Whiff rate: ${pct(air)} of the range is outright air (no pair, no draw, no overcards). `
      + `An additional ${pct(weakDraws)} holds weak draws (gutshot or overcard pair-outs). `
      + `${match.subcase === 'heavy_whiff' ? 'Cbet-bluff frequency can climb, but size down — defenders adjust by floating wider.' : match.subcase === 'well_connected' ? 'Range is dense with pairs and draws — bluffs run into more defense. Smaller bets, tighter bluff selection.' : 'Mid-range whiff — sizing depends on nut-advantage and capping, not structural tilt.'}`;
  },
};

// ---------- Registry ---------- //

export const FRAMEWORKS = {
  RANGE_DECOMPOSITION,
  RANGE_ADVANTAGE,
  NUT_ADVANTAGE,
  RANGE_MORPHOLOGY,
  BOARD_TILT,
  CAPPED_RANGE_CHECK,
  WHIFF_RATE,
  ...MULTIWAY_FRAMEWORKS,
};

export const FRAMEWORK_ORDER = [
  RANGE_DECOMPOSITION,
  RANGE_ADVANTAGE,
  NUT_ADVANTAGE,
  RANGE_MORPHOLOGY,
  BOARD_TILT,
  CAPPED_RANGE_CHECK,
  WHIFF_RATE,
  ...MULTIWAY_FRAMEWORK_ORDER,
];

/**
 * Run every framework against a scenario and return those that apply.
 */
export const classifyScenario = (scenario) => {
  const out = [];
  for (const fw of FRAMEWORK_ORDER) {
    const match = fw.applies(scenario);
    if (!match) continue;
    out.push({
      framework: fw,
      subcase: match.subcase,
      favored: match.favored,
      details: match.details || null,
      narration: fw.narrate(scenario, match),
    });
  }
  return out;
};
