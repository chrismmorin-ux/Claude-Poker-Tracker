/**
 * computeHelpers.js — pure compute primitives for the live-advisor pipeline.
 *
 * Extracted from `src/hooks/useLiveActionAdvisor.js` in SPR-080 / 2026-05-14
 * (Refactor Sprint Item 5). The hook is the only consumer today; PMC Phase 5b
 * may add hand-end-capture utilities as siblings in this module.
 *
 * **Pure module — no React, no IO, no side effects.** Every helper is a
 * stateless function. The hook owns state (`advice`, `isComputing`, refs)
 * and orchestration; this file owns computation.
 *
 * Members:
 *   - `computeTrialCount` — Monte Carlo trial budget per game context.
 *   - `computeAllVillainRanges` — Bayesian range derivation per active villain.
 *   - `computeVillainEquities` — Parallel hero-vs-villain equity calculation.
 *   - `narrowWithLog` — Postflop range narrowing + log entry production.
 *   - `buildPreflopAdvice` — Preflop branch delegation to preflopAdvisor.
 *   - `buildPostflopAdvice` — Postflop branch delegation to gameTreeEvaluator.
 */

import { evaluateGameTree } from '../exploitEngine/gameTreeEvaluator';
import { parseAndEncode } from '../pokerCore/cardParser';
import { rangeWidth } from '../pokerCore/rangeMatrix';
import { getRangePositionCategory } from '../positionUtils';
import { getVillainActionKey, getVillainRange } from '../rangeEngine/rangeAccessors';
import { handVsRange as handVsRangeDirect } from '../pokerCore/monteCarloEquity';
import { narrowByBoard } from '../exploitEngine/postflopNarrower';
import { buildBaselineRange, computePreflopAdvice } from '../exploitEngine/preflopAdvisor';
import { getSPRZone, SPR_ZONES } from '../exploitEngine/gameTreeConstants';
import {
  buildOpponentModels,
  buildPostflopContextHints,
  computeEffectiveStack,
  countPlayersToAct,
} from '../exploitEngine/liveGameContext';

/**
 * Compute trial count based on game context.
 * Fewer trials when the decision is simpler or data is thin.
 */
export const computeTrialCount = ({ spr, street, activeOpponents, sampleSize } = {}) => {
  if (street === 'river') return 500;
  const zone = getSPRZone(spr);
  if (zone === SPR_ZONES.MICRO || zone === SPR_ZONES.LOW) return 500;
  if (zone === SPR_ZONES.MEDIUM) return 800;
  if (sampleSize != null && sampleSize < 10) return 500;
  if (activeOpponents != null && activeOpponents >= 3) return 1500;
  return 1000;
};

/**
 * Compute Bayesian range data for ALL active (non-folded) villains.
 * Returns array of { seat, position, actionKey, range, villainData }.
 */
export const computeAllVillainRanges = (liveHandState, tendencyMap, dealerSeat) => {
  const heroSeat = liveHandState.heroSeat;
  const foldedSet = new Set(liveHandState.foldedSeats || []);
  const activeSeats = (liveHandState.activeSeatNumbers || [])
    .filter(s => s !== heroSeat && !foldedSet.has(s));

  return activeSeats.map(seat => {
    const villainData = tendencyMap[String(seat)] || {};
    const position = getRangePositionCategory(seat, dealerSeat || 1);
    const actionKey = getVillainActionKey(liveHandState.actionSequence, seat);
    let range = getVillainRange(villainData.rangeProfile, position, actionKey);
    if (!range) {
      range = buildBaselineRange(villainData.vpip, villainData.pfr, position);
    }
    return { seat, position, actionKey, range, villainData };
  });
};

/**
 * Compute hero equity vs each villain's range in parallel.
 * Divides trial budget across villains (min 200 per villain).
 */
export const computeVillainEquities = async (heroCards, villainRangeEntries, board, baseTrials, equityFn = handVsRangeDirect) => {
  if (!villainRangeEntries.length) return { perVillain: [], multiway: null };

  const trialsPerVillain = Math.max(200, Math.floor(baseTrials / villainRangeEntries.length));

  const equityResults = await Promise.all(
    villainRangeEntries.map(({ range }) =>
      equityFn(heroCards, range, board, { trials: trialsPerVillain, minTrials: 100 })
        .catch(() => null)
    )
  );

  const perVillain = equityResults.map((result, i) => ({
    seat: villainRangeEntries[i].seat,
    equity: result?.equity ?? null,
    equityCI: result ? [result.ciLow, result.ciHigh] : null,
  }));

  // Multiway equity: pairwise product approximation
  const validEquities = perVillain.filter(pv => pv.equity != null);
  let multiway = null;
  if (validEquities.length >= 2) {
    const product = validEquities.reduce((acc, pv) => acc * pv.equity, 1.0);
    // Slight upward adjustment — pairwise product underestimates
    const adjusted = Math.min(1.0, product * (1 + 0.05 * (validEquities.length - 1)));
    multiway = {
      equity: adjusted,
      ci: null, // CI for multiway is complex — omit for now
      method: 'pairwise',
    };
  }

  return { perVillain, multiway };
};

/**
 * Narrow a villain's range for a postflop street and record the narrowing.
 * Returns { narrowed, logEntry }.
 */
export const narrowWithLog = (range, action, board, deadCards, options, seat, street) => {
  const beforeWidth = rangeWidth(range);
  const narrowed = narrowByBoard(range, action, board, deadCards, options);
  const afterWidth = rangeWidth(narrowed);

  const delta = beforeWidth - afterWidth;
  let description;
  if (action === 'bet' || action === 'raise') {
    description = `${action === 'raise' ? 'Raise' : 'Bet'} → top ${afterWidth}% by equity`;
  } else if (action === 'call') {
    description = delta > 5
      ? `Call removed ${delta}% air, kept medium+ hands`
      : `Calling range mostly preserved (${afterWidth}%)`;
  } else if (action === 'check') {
    description = `Check → weak/trapping range (${afterWidth}%)`;
  } else {
    description = `Range adjusted ${beforeWidth}% → ${afterWidth}%`;
  }

  return {
    narrowed,
    logEntry: { street, seat, action, fromWidth: beforeWidth, toWidth: afterWidth, description },
  };
};

/**
 * Build preflop advice from live hand state context.
 * Handles positional dynamics, squeeze/limp detection, and playersToAct counting.
 */
export const buildPreflopAdvice = async ({
  liveHandState, heroSeat, targetSeat, dealerSeat,
  villainRange, encodedHero, adjustedPot,
  detectedSituation, playerStats, villainData, villainModel, rakeConfig,
  equityFn,
}) => {
  const { situation, villainAction, villainBet } = detectedSituation;
  const heroPosition = getRangePositionCategory(heroSeat, dealerSeat || 1);
  const villainPosition = getRangePositionCategory(targetSeat, dealerSeat || 1);
  const playersToAct = countPlayersToAct(liveHandState, heroSeat, dealerSeat);

  const posCtx = {
    heroPosition, villainPosition,
    situation,
    limperCount: detectedSituation.limperCount || 0,
    callerCount: detectedSituation.callerCount || 0,
    deadMoney: detectedSituation.deadMoney || 0,
    trapWarning: villainData.traits?.trapsPreflop || false,
    playersToAct,
    heroSeat,
    villainSeat: targetSeat,
    dealerSeat: dealerSeat || 1,
  };

  return computePreflopAdvice(
    villainRange, encodedHero, adjustedPot,
    villainAction, villainBet || 0, playerStats,
    posCtx, villainModel, rakeConfig, equityFn
  );
};

/**
 * Build postflop advice from live hand state context.
 * Handles board encoding, multi-way opponents, stack depth, and game tree evaluation.
 */
export const buildPostflopAdvice = async ({
  liveHandState, heroSeat, targetSeat, dealerSeat, currentStreet,
  villainRange, encodedHero, adjustedPot,
  detectedSituation, playerStats, villainData, villainModel,
  tendencyMap, dataQuality, sampleSize, rakeConfig, equityFn,
}) => {
  const { villainAction, villainBet } = detectedSituation;
  const communityCards = liveHandState.communityCards || [];
  const visibleBoard = communityCards.filter(c => c && c !== '');
  const encodedBoard = visibleBoard.map(c => parseAndEncode(c)).filter(c => c >= 0);
  if (encodedBoard.length < 3) return null;

  // Surface villain model quality in dataQuality
  dataQuality.villainModelNote = villainModel?._buckets
    ? 'Calibrated to villain behavior'
    : villainModel
      ? 'Partial villain model — some generic assumptions'
      : 'Generic advice — no villain model';

  const effStack = computeEffectiveStack(liveHandState, heroSeat, targetSeat);
  const { models: opponentModels, activeOpponents } = buildOpponentModels(liveHandState, heroSeat, targetSeat, tendencyMap);
  const { contextHints } = buildPostflopContextHints({
    liveHandState, heroSeat, targetSeat, dealerSeat,
    villainData, encodedBoard,
  });

  return evaluateGameTree({
    villainRange,
    board: encodedBoard,
    heroCards: encodedHero,
    potSize: adjustedPot,
    villainAction: (villainAction === 'check' || !villainAction) ? undefined : villainAction,
    villainBet: villainBet || 0,
    trials: computeTrialCount({
      spr: effStack != null && adjustedPot > 0 ? effStack / adjustedPot : null,
      street: currentStreet,
      activeOpponents,
      sampleSize,
    }),
    playerStats,
    villainModel,
    effectiveStack: effStack,
    numOpponents: Math.max(1, activeOpponents),
    opponentModels,
    contextHints,
    rakeConfig,
    equityFn,
  });
};
