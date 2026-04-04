/**
 * useLiveActionAdvisor.js — Reactive action advisor for Ignition live play
 *
 * Takes live hand state from the extension + per-seat analysis from useOnlineAnalysis,
 * runs getActionAdvice() against the primary villain, and returns all possible hero
 * actions ranked by EV with reasoning and range segmentation.
 *
 * Preflop uses a dedicated branch (handVsRange + stat-based fold estimation)
 * since the postflop pipeline (segmentRange) doesn't work with an empty board.
 * Postflop delegates to getActionAdvice() which chains narrowing → segmentation → equity → EV.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../utils/errorHandler';
import { evaluateGameTree } from '../utils/exploitEngine/gameTreeEvaluator';
import { parseAndEncode } from '../utils/pokerCore/cardParser';
import { getRangePositionCategory } from '../utils/positionUtils';
import { getVillainActionKey, getVillainRange } from '../utils/rangeEngine/rangeAccessors';
import {
  buildBaselineRange,
  computePreflopAdvice,
  detectSituation,
  SITUATION_LABELS,
} from '../utils/exploitEngine/preflopAdvisor';
import { useAbortControl } from './useAbortControl';
import { getQualityTier } from '../constants/designTokens';
import { getSPRZone, SPR_ZONES } from '../utils/exploitEngine/gameTreeConstants';
import {
  estimatePot, buildPlayerStats, computeEffectiveStack,
  buildOpponentModels, buildPostflopContextHints, countPlayersToAct,
} from '../utils/exploitEngine/liveGameContext';

// =========================================================================
// HELPERS
// =========================================================================

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
 * Build preflop advice from live hand state context.
 * Handles positional dynamics, squeeze/limp detection, and playersToAct counting.
 */
const buildPreflopAdvice = async ({
  liveHandState, heroSeat, targetSeat, dealerSeat,
  villainRange, encodedHero, adjustedPot,
  detectedSituation, playerStats, villainData, villainModel, rakeConfig,
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
    posCtx, villainModel, rakeConfig
  );
};

/**
 * Build postflop advice from live hand state context.
 * Handles board encoding, multi-way opponents, stack depth, and game tree evaluation.
 */
const buildPostflopAdvice = async ({
  liveHandState, heroSeat, targetSeat, dealerSeat, currentStreet,
  villainRange, encodedHero, adjustedPot,
  detectedSituation, playerStats, villainData, villainModel,
  tendencyMap, dataQuality, sampleSize, rakeConfig,
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
  });
};

// =========================================================================
// MAIN HOOK
// =========================================================================

/**
 * @param {Object|null} liveHandState - From useSyncBridge
 * @param {Object} tendencyMap - From useOnlineAnalysis
 * @returns {{ advice: Object|null, isComputing: boolean }}
 */
export const useLiveActionAdvisor = (liveHandState, tendencyMap) => {
  const [advice, setAdvice] = useState(null);
  const [isComputing, setIsComputing] = useState(false);
  const lastComputeKey = useRef(null);
  const { register, isCurrent, abort } = useAbortControl();

  const compute = useCallback(async () => {
    if (!liveHandState || !tendencyMap) {
      logger.debug('LiveActionAdvisor', 'Skip: no handState or tendencyMap', { hasHS: !!liveHandState, hasTM: !!tendencyMap, tmKeys: tendencyMap ? Object.keys(tendencyMap) : [] });
      setAdvice(null);
      return;
    }

    const {
      currentStreet, communityCards, holeCards, heroSeat,
      pot, actionSequence, pfAggressor, state, dealerSeat,
    } = liveHandState;

    // Skip if not in a live hand
    if (!state || state === 'IDLE' || state === 'COMPLETE') {
      logger.debug('LiveActionAdvisor', 'Skip: not live hand, state=', state);
      setAdvice(null);
      return;
    }

    // Skip if no hero cards
    if (!holeCards || !holeCards[0] || !holeCards[1]) {
      logger.debug('LiveActionAdvisor', 'Skip: no hero cards', holeCards);
      return;
    }

    // Detect situation (still computes even if hero already acted — shows optimal play)
    const detectedSituation = detectSituation(
      actionSequence, heroSeat, currentStreet, pfAggressor
    );
    const { situation, villainSeat, villainAction, villainBet, heroAlreadyActed } = detectedSituation;

    if (situation === 'waiting') {
      // No actionable situation yet — clear stale advice
      setAdvice(null);
      return;
    }

    // Find target villain
    let targetSeat = villainSeat;
    if (!targetSeat) {
      const activeSeatNumbers = liveHandState.activeSeatNumbers || [];
      const foldedSet = new Set(liveHandState.foldedSeats || []);
      targetSeat = activeSeatNumbers.find(s => s !== heroSeat && !foldedSet.has(s));
      logger.debug('LiveActionAdvisor', 'No villain from action, fallback target=', targetSeat, 'active=', activeSeatNumbers, 'folded=', liveHandState.foldedSeats);
    }
    if (!targetSeat) {
      logger.debug('LiveActionAdvisor', 'Skip: no target seat');
      return;
    }

    // Debounce
    const computeKey = `${liveHandState.handNumber}:${currentStreet}:${actionSequence?.length}:${targetSeat}`;
    if (computeKey === lastComputeKey.current) return;
    lastComputeKey.current = computeKey;

    // Look up villain data (Fix 3: allow zero-sample — baseline range handles it)
    const villainData = tendencyMap[String(targetSeat)] || {};
    const sampleSize = villainData.sampleSize || 0;
    logger.debug('LiveActionAdvisor', 'Computing:', { street: currentStreet, situation, villain: targetSeat, vpip: villainData.vpip, sample: sampleSize, pot });

    // Data quality metadata — richer than old 'high'/'medium'/'low'
    const dataQuality = {
      sampleSize,
      tier: getQualityTier(sampleSize),
      confidenceNote: sampleSize === 0 ? 'Population defaults only — no player data'
        : sampleSize < 10 ? 'Early estimate — need more hands'
        : sampleSize < 30 ? `Based on ${sampleSize} hands`
        : `Solid read (${sampleSize} hands)`,
    };
    const confidence = dataQuality.tier;

    // Build villain range from Bayesian range profile, fallback to VPIP-scaled baseline
    const villainPosition = getRangePositionCategory(targetSeat, dealerSeat || 1);
    const rangeActionKey = getVillainActionKey(actionSequence, targetSeat);
    let villainRange = getVillainRange(villainData.rangeProfile, villainPosition, rangeActionKey);
    if (!villainRange) {
      villainRange = buildBaselineRange(villainData.vpip, villainData.pfr, villainPosition);
    }

    // Encode hero cards (extension now sends Unicode format matching cardParser)
    const encodedHero = holeCards.map(c => parseAndEncode(c)).filter(c => c >= 0);
    if (encodedHero.length !== 2) return;

    // Pot estimation with 4-level fallback (explicit → blinds → gameType → default)
    const rawPotSize = estimatePot(liveHandState);
    const adjustedPot = Math.max(0, rawPotSize - (villainBet || 0));

    // Resolve rake config from live hand state or session game type
    const rakeConfig = liveHandState.rakeConfig || null;

    const playerStats = buildPlayerStats(villainData, villainPosition);

    const callId = register();
    setIsComputing(true);
    const villainModel = villainData.villainModel || null;

    try {
      let result;

      if (currentStreet === 'preflop') {
        result = await buildPreflopAdvice({
          liveHandState, heroSeat, targetSeat, dealerSeat,
          villainRange, encodedHero, adjustedPot,
          detectedSituation, playerStats, villainData, villainModel, rakeConfig,
        });
      } else {
        result = await buildPostflopAdvice({
          liveHandState, heroSeat, targetSeat, dealerSeat, currentStreet,
          villainRange, encodedHero, adjustedPot,
          detectedSituation, playerStats, villainData, villainModel,
          tendencyMap, dataQuality, sampleSize, rakeConfig,
        });
        if (!result) return;
      }

      if (!isCurrent(callId)) return;

      // Gate recommendations based on data quality
      let gatedRecs = result.recommendations || [];
      if (sampleSize === 0) {
        // No player data: tag all recs as population-based
        gatedRecs = gatedRecs.map(r => ({
          ...r, reasoning: r.reasoning + ' [population estimate]',
        }));
      } else if (sampleSize < 10) {
        // Suppress pure bluff recommendations (fold-equity-only raises with marginal EV)
        gatedRecs = gatedRecs.filter(r =>
          !(r.action === 'raise' && r.sizing?.foldPct > 0.6 && r.ev < 2)
        );
      }

      setAdvice({
        villainSeat: targetSeat,
        villainStyle: villainData.style || null,
        villainSampleSize: sampleSize,
        villainProfile: villainData.villainProfile || null,
        confidence,
        dataQuality,
        heroAlreadyActed,
        situation,
        situationLabel: SITUATION_LABELS[situation] || situation,
        heroEquity: result.heroEquity,
        boardTexture: result.boardTexture ? {
          texture: result.boardTexture.texture,
          wetScore: result.boardTexture.wetScore,
          isPaired: result.boardTexture.isPaired,
          flushDraw: result.boardTexture.flushDraw,
          monotone: result.boardTexture.monotone,
        } : null,
        segmentation: result.segmentation ? {
          buckets: result.segmentation.buckets,
          handTypes: result.segmentation.handTypes,
          isCapped: result.segmentation.isCapped,
          totalCombos: result.segmentation.totalCombos,
          totalWeight: result.segmentation.totalWeight,
        } : null,
        foldPct: result.foldPct,
        flopBreakdown: result.flopBreakdown || null,
        foldMeta: result.foldMeta || null,
        recommendations: gatedRecs,
        currentStreet,
        potSize: adjustedPot,
        villainBet: villainBet || 0,
        playerStats,
        bucketEquities: result.bucketEquities || null,
        modelQuality: result.modelQuality || null,
        treeMetadata: result.treeMetadata || null,
        timestamp: Date.now(),
      });
      logger.debug('LiveActionAdvisor', 'Advice computed:', {
        street: currentStreet, situation, villain: targetSeat,
        heroEq: Math.round(result.heroEquity * 100) + '%',
        recs: result.recommendations.map(r => `${r.action}:${r.ev.toFixed(2)}`),
      });
    } catch (e) {
      logger.warn('LiveActionAdvisor', 'Error:', e.message);
    } finally {
      if (isCurrent(callId)) setIsComputing(false);
    }
  }, [liveHandState, tendencyMap]);

  useEffect(() => {
    compute();
    return () => { abort(); };
  }, [compute]);

  return { advice, isComputing };
};

