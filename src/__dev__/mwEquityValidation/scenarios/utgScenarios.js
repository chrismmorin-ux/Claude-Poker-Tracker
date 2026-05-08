/**
 * scenarios/utgScenarios.js — UTG open-decision EV decomposition.
 *
 * UTG has 8 opponents behind. Full 3^8 = 6561-cell joint enumeration is
 * intractable. Per WS-168 plan agent §C2, use 5-scenario truncation:
 *
 *   S1 all_fold              — all 8 fold (most common in live 1/2)
 *   S2 one_caller_only       — exactly one cold-caller, rest fold
 *   S3 one_3bettor_only      — exactly one 3-bettor, rest fold
 *   S4 multiway_flat         — 2+ cold-callers, no 3-bet (3+ to flop)
 *   S5 squeeze               — 1 caller + 1 3-bettor
 *
 * Hand-authored UTG_SCENARIO_PROBS calibrated from live 1/2 baselines
 * (sums to 1.000). BB is the modal caller (defends ~30% vs UTG opens
 * per `getPopulationPrior('BB','coldCall')`); late-position is the modal
 * 3-bettor.
 *
 * Range attribution per scenario:
 *   - Caller range: BB cold-call prior (modal) — represents the most-likely caller
 *   - 3-bettor range: LATE 3-bet prior — represents the modal 3-bettor profile
 *   - Squeezer range: LATE 3-bet prior (same)
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
 * 5-scenario probability mass given UTG opens.
 * Calibrated from live 1/2 baselines. Sums to 1.000.
 */
export const UTG_SCENARIO_PROBS = {
  allFold:        0.65, // 8 opponents fold
  oneCaller:      0.18, // exactly one cold-caller (modal: BB)
  oneThreeBettor: 0.10, // exactly one 3-bettor (modal: late position)
  multiwayFlat:   0.04, // 2+ cold-callers, no 3-bet
  squeeze:        0.03, // 1 caller + 1 3-bettor
};

const sumProbs = (table) =>
  Object.values(table).reduce((a, b) => a + b, 0);

if (Math.abs(sumProbs(UTG_SCENARIO_PROBS) - 1.0) > 0.01) {
  // eslint-disable-next-line no-console
  console.warn(`[mwEquityValidation] UTG_SCENARIO_PROBS sums to ${sumProbs(UTG_SCENARIO_PROBS)} (expected ~1.0)`);
}

const handClassIdxToCards = (idx) => {
  const { rank1, rank2, isPair, suited } = decodeIndex(idx);
  if (isPair) return [encodeCard(rank1, 0), encodeCard(rank1, 1)];
  if (suited) return [encodeCard(rank1, 0), encodeCard(rank2, 0)];
  return [encodeCard(rank1, 0), encodeCard(rank2, 1)];
};

/**
 * Villain ranges for UTG scenarios — modal-caller + modal-3bettor profile.
 */
export const buildUtgVillainRanges = () => ({
  // Modal caller is BB (the position that defends most vs early opens)
  callerRange: getPopulationPrior('BB', 'coldCall'),
  // Modal 3-bettor is from LATE positions (CO/BTN); use LATE bucket prior
  threeBettorRange: getPopulationPrior('LATE', 'threeBet'),
});

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
 * Hero's EV when responding to a single 3-bet (UTG version — same as BTN
 * but no positional dead-money asymmetry; both blinds are dead).
 */
const evResponseToThreeBet = async ({
  idx, heroCards, threeBetRange, isSqueeze, response, opts, cache,
}) => {
  const R = opts.openSize;
  // For UTG, both SB+BB are dead in S3/S5 (caller assumed non-blind)
  const tbCtx = computeThreeBetCtx({ R, S: 10, deadFolders: ['SB', 'BB'] });

  const evIfFold = -R;

  let evIfCall = 0;
  if (response.call > 0) {
    const eq = await huEquityCached(idx, heroCards, threeBetRange, opts, cache);
    let pot = tbCtx.potIfCall;
    if (isSqueeze) pot += R; // caller's R becomes dead post-fold
    evIfCall = eq * pot - tbCtx.threeBetSize;
  }

  let evIfFourBet = 0;
  if (response.fourBet > 0) {
    const fbCtx = computeFourBetCtx({ R, S: 10, F: 23, deadFolders: ['SB', 'BB'] });
    const villainResp = VILLAIN_RESPONSE_TO_FOURBET;

    const evVillainFolds = fbCtx.potIfVillainFolds;

    const eqVsCall4Bet = await huEquityCached(idx, heroCards, threeBetRange, opts, cache);
    const evVillainCalls = eqVsCall4Bet * fbCtx.potIfVillainCalls4Bet - fbCtx.heroFourBetCost;

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

    evIfFourBet = villainResp.fold * evVillainFolds
                + villainResp.call * evVillainCalls
                + villainResp.jam  * evVillainJams;
  }

  return response.fold * evIfFold + response.call * evIfCall + response.fourBet * evIfFourBet;
};

/**
 * Compute hero's EV for each of the 5 UTG scenarios (per hand class).
 */
export const evaluateUtgScenarios = async (idx, ranges, opts, cache) => {
  const heroCards = handClassIdxToCards(idx);
  const R = opts.openSize;

  // S1: all_fold — hero wins blinds
  const evAllFold = 1.5;

  // S2: oneCaller — HU vs BB cold-call range; both blinds dead (SB folded; BB called → no dead BB; but other 6 positions folded)
  // For UTG, SB+BB dead means *both* posted but one continues. Refine:
  //   modal caller = BB. So SB dead 0.5; BB calls so BB tops up to R (not dead).
  //   Other 6 positions (UTG+1..BTN) fold — no dead from them.
  const evOneCaller = await (async () => {
    const eq = await huEquityCached(idx, heroCards, ranges.callerRange, opts, cache);
    const { potAtFlop } = computeFlatScenarioPot({ callers: ['BB'], folders: ['SB'] }, R);
    return eq * potAtFlop - R;
  })();

  // S3: oneThreeBettor — single 3bet, both blinds dead (modal 3bettor = late position)
  const evOneThreeBettor = await evResponseToThreeBet({
    idx, heroCards,
    threeBetRange: ranges.threeBettorRange,
    isSqueeze: false,
    response: heroResponseToThreeBet(idx),
    opts, cache,
  });

  // S4: multiwayFlat — 2+ callers; flatten to 3-way using aggregated caller range
  // (using same callerRange twice as approximation — modal 3-way scenario)
  const evMultiwayFlat = await (async () => {
    const eq = await mwEquityCached(idx, heroCards, [ranges.callerRange, ranges.callerRange], opts, cache);
    // Pot = R(hero) + R(caller1) + R(caller2) + 1.5 (both blinds dead since callers are non-blind)
    const { potAtFlop } = computeFlatScenarioPot({ callers: ['UTG+1', 'BTN'], folders: ['SB', 'BB'] }, R);
    return eq * potAtFlop - R;
  })();

  // S5: squeeze — 1 caller + 1 3-bettor; caller folds the 3-bet (simplification)
  const evSqueeze = await evResponseToThreeBet({
    idx, heroCards,
    threeBetRange: ranges.threeBettorRange,
    isSqueeze: true,
    response: heroResponseToSqueeze(idx),
    opts, cache,
  });

  return {
    allFold:        evAllFold,
    oneCaller:      evOneCaller,
    oneThreeBettor: evOneThreeBettor,
    multiwayFlat:   evMultiwayFlat,
    squeeze:        evSqueeze,
  };
};

/**
 * Build UTG derived range — Float64Array of EV(open) per hand class.
 */
export const buildUtgDerivedRange = async (opts, cache) => {
  const ranges = buildUtgVillainRanges();
  const derivedEV = new Float64Array(169);

  for (let idx = 0; idx < 169; idx++) {
    const evs = await evaluateUtgScenarios(idx, ranges, opts, cache);
    let totalEV = 0;
    for (const key of Object.keys(UTG_SCENARIO_PROBS)) {
      totalEV += UTG_SCENARIO_PROBS[key] * evs[key];
    }
    derivedEV[idx] = totalEV;
    if (opts.onProgress && idx % 10 === 0) opts.onProgress(idx + 1, 169);
  }
  if (opts.onProgress) opts.onProgress(169, 169);
  return derivedEV;
};
