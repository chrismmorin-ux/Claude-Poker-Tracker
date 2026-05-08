/**
 * scenarios/btnScenarios.js — BTN open-decision EV decomposition.
 *
 * BTN has 2 opponents behind: SB and BB. The full action enumeration is
 * 3×3 = 9 cells. Joint probabilities are HAND-AUTHORED (not the marginal
 * product of FACED_RAISE_FREQUENCIES — see WS-168 plan agent §C1: SB and
 * BB actions are not independent; squeezes and cold-4bets are conditional).
 *
 * Cells must sum to 1.0. Calibrated from live 1/2 baselines.
 *
 * Hero's response to a 3-bet uses heroResponseToThreeBet (or heroResponseToSqueeze
 * for squeeze branches).
 *
 * Simplification (documented in confound section of divergence report):
 *   - Squeeze caller folds the 3-bet (live-1/2 capped-flat behavior).
 *   - Rare (3bet, call) and (3bet, 3bet) cells fold into the SB-3bet branch.
 */

import { handVsRange, handVsRangesMW } from '../../../utils/pokerCore/monteCarloEquity';
import { getPopulationPrior } from '../../../utils/rangeEngine/populationPriors';
import { decodeIndex } from '../../../utils/pokerCore/rangeMatrix';
import { encodeCard } from '../../../utils/pokerCore/cardParser';
import { computeFlatScenarioPot, computeThreeBetCtx, computeFourBetCtx } from '../potMath';
import {
  heroResponseToThreeBet,
  heroResponseToSqueeze,
  heroResponseToFiveBetJam,
  VILLAIN_RESPONSE_TO_FOURBET,
} from './heroResponse';
import { hashScenarioRanges } from '../cache';

/**
 * Joint probability table for (SB action, BB action) given BTN open.
 * Hand-authored from live 1/2 baselines. Sums to 1.000.
 */
export const JOINT_PROBABILITIES_BTN = {
  fold:     { fold: 0.350, call: 0.200, threeBet: 0.060 },
  call:     { fold: 0.100, call: 0.180, threeBet: 0.050 },
  threeBet: { fold: 0.050, call: 0.007, threeBet: 0.003 },
};

const sumJoint = (table) => {
  let s = 0;
  for (const sb of Object.keys(table)) {
    for (const bb of Object.keys(table[sb])) s += table[sb][bb];
  }
  return s;
};

// Sanity: enforce sum ≈ 1.0 at module load
if (Math.abs(sumJoint(JOINT_PROBABILITIES_BTN) - 1.0) > 0.01) {
  // eslint-disable-next-line no-console
  console.warn(`[mwEquityValidation] JOINT_PROBABILITIES_BTN sums to ${sumJoint(JOINT_PROBABILITIES_BTN)} (expected ~1.0)`);
}

/**
 * Derive a deterministic combo (card1, card2) for a hand class index.
 * For preflop empty board, suit choices have negligible effect on equity
 * (dominated by hand-class semantics).
 */
const handClassIdxToCards = (idx) => {
  const { rank1, rank2, isPair, suited } = decodeIndex(idx);
  // Suits 0..3 = spades, hearts, diamonds, clubs (per cardParser convention; doesn't matter which)
  if (isPair) return [encodeCard(rank1, 0), encodeCard(rank1, 1)];
  if (suited) return [encodeCard(rank1, 0), encodeCard(rank2, 0)];
  return [encodeCard(rank1, 0), encodeCard(rank2, 1)];
};

/**
 * Build the villain ranges used for all BTN scenarios.
 * Computed once per derivation run; reused across all 169 hand classes.
 */
export const buildBtnVillainRanges = () => ({
  sbCall:     getPopulationPrior('SB', 'coldCall'),
  sbThreeBet: getPopulationPrior('SB', 'threeBet'),
  bbCall:     getPopulationPrior('BB', 'coldCall'),
  bbThreeBet: getPopulationPrior('BB', 'threeBet'),
});

/**
 * Cached HU equity (heroCards vs single villain range, empty board).
 */
const huEquityCached = async (idx, heroCards, villainRange, opts, cache) => {
  const scenarioHash = hashScenarioRanges([villainRange]);
  if (cache.has(idx, scenarioHash)) return cache.get(idx, scenarioHash);
  const result = await handVsRange(heroCards, villainRange, [], {
    trials: opts.mcTrials,
    convergenceThreshold: opts.mcConvergenceThreshold,
  });
  cache.set(idx, scenarioHash, result.equity);
  return result.equity;
};

/**
 * Cached MW equity (heroCards vs N villain ranges, empty board).
 */
const mwEquityCached = async (idx, heroCards, villainRanges, opts, cache) => {
  const scenarioHash = hashScenarioRanges(villainRanges);
  if (cache.has(idx, scenarioHash)) return cache.get(idx, scenarioHash);
  const result = await handVsRangesMW(heroCards, villainRanges, [], {
    trials: opts.mcTrials,
    convergenceThreshold: opts.mcConvergenceThreshold,
  });
  cache.set(idx, scenarioHash, result.equity);
  return result.equity;
};

/**
 * Compute hero's EV when responding to a single 3-bet.
 *
 * @param {Object} ctx
 * @param {number} ctx.idx - hero hand class index
 * @param {number[]} ctx.heroCards
 * @param {Float64Array} ctx.threeBetRange
 * @param {string[]} ctx.deadFolders - blind positions whose money is dead
 * @param {boolean} ctx.isSqueeze - if true, caller's R is also dead (caller folds 3bet)
 * @param {Object} ctx.response - { fold, call, fourBet } distribution
 * @param {Object} ctx.opts
 * @param {Object} ctx.cache
 * @returns {Promise<number>} EV in BB
 */
const evResponseToThreeBet = async ({
  idx, heroCards, threeBetRange, deadFolders, isSqueeze, response, opts, cache,
}) => {
  const R = opts.openSize;
  const tbCtx = computeThreeBetCtx({ R, S: 10, deadFolders });

  // Branch 1: hero folds → -R
  const evIfFold = -R;

  // Branch 2: hero calls 3-bet
  let evIfCall = 0;
  if (response.call > 0) {
    const eq = await huEquityCached(idx, heroCards, threeBetRange, opts, cache);
    let pot = tbCtx.potIfCall; // 2S + dead
    if (isSqueeze) pot += R;   // caller's R becomes dead post-fold
    // EV = eq × pot - hero_total_invested (hero invested S = 10 BB)
    evIfCall = eq * pot - tbCtx.threeBetSize;
  }

  // Branch 3: hero 4-bets
  let evIfFourBet = 0;
  if (response.fourBet > 0) {
    const fbCtx = computeFourBetCtx({ R, S: 10, F: 23, deadFolders });
    const villainResp = VILLAIN_RESPONSE_TO_FOURBET;

    // Villain folds 4bet → hero wins 3-bet pot (villain's S + dead) without contesting
    const evVillainFolds = fbCtx.potIfVillainFolds;

    // Villain calls 4bet → hero plays HU vs villain's 4bet-call range (top of 3bet range)
    // v1 simplification: use threeBetRange (slight value-bias). Refinement: top-30% slice.
    const eqVsCall4Bet = await huEquityCached(idx, heroCards, threeBetRange, opts, cache);
    const evVillainCalls = eqVsCall4Bet * fbCtx.potIfVillainCalls4Bet - fbCtx.heroFourBetCost;

    // Villain 5-bet jams → heroResponseToFiveBetJam decides
    const fiveBetResp = heroResponseToFiveBetJam(idx);
    let evVillainJams;
    if (fiveBetResp.call > 0) {
      const eqVsJam = await huEquityCached(idx, heroCards, threeBetRange, opts, cache);
      const evCallJam = eqVsJam * fbCtx.potIfCallJam - fbCtx.fiveBetJamSize;
      const evFoldJam = -fbCtx.heroFourBetCost;
      evVillainJams = fiveBetResp.call * evCallJam + fiveBetResp.fold * evFoldJam;
    } else {
      evVillainJams = -fbCtx.heroFourBetCost;
    }

    if (isSqueeze) {
      // When hero 4-bets a squeeze, caller usually folds (caller's R adds to dead).
      // Approximation: add R to all "villain folds 4bet" pots (hero wins it too).
      // Skipped in v1 for simplicity — ~0.5 BB underestimate on squeeze 4-bet branches.
    }

    evIfFourBet = villainResp.fold * evVillainFolds
                + villainResp.call * evVillainCalls
                + villainResp.jam  * evVillainJams;
  }

  return response.fold * evIfFold + response.call * evIfCall + response.fourBet * evIfFourBet;
};

/**
 * Compute hero's EV in a single (sb_action, bb_action) scenario.
 */
export const evaluateBtnScenario = async (idx, sbAction, bbAction, ranges, opts, cache) => {
  const heroCards = handClassIdxToCards(idx);
  const R = opts.openSize;

  // (fold, fold) — hero wins blinds
  if (sbAction === 'fold' && bbAction === 'fold') {
    return 1.5;
  }

  // (fold, call) — HU vs BB cold-call range; SB dead 0.5
  if (sbAction === 'fold' && bbAction === 'call') {
    const eq = await huEquityCached(idx, heroCards, ranges.bbCall, opts, cache);
    const { potAtFlop } = computeFlatScenarioPot({ callers: ['BB'], folders: ['SB'] }, R);
    return eq * potAtFlop - R;
  }

  // (call, fold) — HU vs SB cold-call range; BB dead 1.0
  if (sbAction === 'call' && bbAction === 'fold') {
    const eq = await huEquityCached(idx, heroCards, ranges.sbCall, opts, cache);
    const { potAtFlop } = computeFlatScenarioPot({ callers: ['SB'], folders: ['BB'] }, R);
    return eq * potAtFlop - R;
  }

  // (call, call) — 3-way; no dead money
  if (sbAction === 'call' && bbAction === 'call') {
    const eq = await mwEquityCached(idx, heroCards, [ranges.sbCall, ranges.bbCall], opts, cache);
    const { potAtFlop } = computeFlatScenarioPot({ callers: ['SB', 'BB'], folders: [] }, R);
    return eq * potAtFlop - R;
  }

  // (fold, threeBet) — single 3bet from BB; SB dead 0.5
  if (sbAction === 'fold' && bbAction === 'threeBet') {
    return evResponseToThreeBet({
      idx, heroCards,
      threeBetRange: ranges.bbThreeBet,
      deadFolders: ['SB'],
      isSqueeze: false,
      response: heroResponseToThreeBet(idx),
      opts, cache,
    });
  }

  // (threeBet, fold) — single 3bet from SB; BB dead 1.0
  if (sbAction === 'threeBet' && bbAction === 'fold') {
    return evResponseToThreeBet({
      idx, heroCards,
      threeBetRange: ranges.sbThreeBet,
      deadFolders: ['BB'],
      isSqueeze: false,
      response: heroResponseToThreeBet(idx),
      opts, cache,
    });
  }

  // (call, threeBet) — squeeze; caller (SB) folds the 3bet (simplification)
  if (sbAction === 'call' && bbAction === 'threeBet') {
    return evResponseToThreeBet({
      idx, heroCards,
      threeBetRange: ranges.bbThreeBet,
      deadFolders: [], // SB called (R is in pot), BB 3-bet (S in pot); no folded blinds yet
      isSqueeze: true, // adds R to call/4bet pots after caller folds 3-bet
      response: heroResponseToSqueeze(idx),
      opts, cache,
    });
  }

  // (threeBet, call) and (threeBet, threeBet) — rare; treat as (threeBet, fold) approximation
  if (sbAction === 'threeBet' && (bbAction === 'call' || bbAction === 'threeBet')) {
    return evResponseToThreeBet({
      idx, heroCards,
      threeBetRange: ranges.sbThreeBet,
      deadFolders: ['BB'],
      isSqueeze: false,
      response: heroResponseToThreeBet(idx),
      opts, cache,
    });
  }

  throw new Error(`evaluateBtnScenario: unhandled scenario (${sbAction}, ${bbAction})`);
};

/**
 * Build BTN derived range — Float64Array of EV(open) per hand class.
 *
 * @param {Object} opts
 * @param {number} opts.openSize - default 2.5
 * @param {number} opts.effStack - default 100 (for documentation only — recursion uses 100 BB jam)
 * @param {number} opts.mcTrials - default 5000
 * @param {number} opts.mcConvergenceThreshold - default 0.02
 * @param {Function} [opts.onProgress] - (idx, total) => void
 * @param {Object} cache - createCache() instance
 * @returns {Promise<Float64Array>} 169 cells of EV(open)
 */
export const buildBtnDerivedRange = async (opts, cache) => {
  const ranges = buildBtnVillainRanges();
  const derivedEV = new Float64Array(169);
  const actions = ['fold', 'call', 'threeBet'];

  for (let idx = 0; idx < 169; idx++) {
    let totalEV = 0;
    for (const sb of actions) {
      for (const bb of actions) {
        const p = JOINT_PROBABILITIES_BTN[sb][bb];
        if (p < 1e-6) continue;
        const ev = await evaluateBtnScenario(idx, sb, bb, ranges, opts, cache);
        totalEV += p * ev;
      }
    }
    derivedEV[idx] = totalEV;
    if (opts.onProgress && idx % 10 === 0) opts.onProgress(idx + 1, 169);
  }
  if (opts.onProgress) opts.onProgress(169, 169);
  return derivedEV;
};
