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
import { rangeWidth } from '../utils/pokerCore/rangeMatrix';
import { getRangePositionCategory } from '../utils/positionUtils';
import { getVillainActionKey, getVillainRange } from '../utils/rangeEngine/rangeAccessors';
import { handVsRange as handVsRangeDirect } from '../utils/exploitEngine/monteCarloEquity';
import { narrowByBoard } from '../utils/exploitEngine/postflopNarrower';
import { analyzeBoardTexture } from '../utils/pokerCore/boardTexture';
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
const computeVillainEquities = async (heroCards, villainRangeEntries, board, baseTrials, equityFn = handVsRangeDirect) => {
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
const narrowWithLog = (range, action, board, deadCards, options, seat, street) => {
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
const buildPreflopAdvice = async ({
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
const buildPostflopAdvice = async ({
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

// =========================================================================
// MAIN HOOK
// =========================================================================

/**
 * @param {Object|null} liveHandState - From useSyncBridge
 * @param {Object} tendencyMap - From useOnlineAnalysis
 * @returns {{ advice: Object|null, isComputing: boolean }}
 */
export const useLiveActionAdvisor = (liveHandState, tendencyMap, { equityFn } = {}) => {
  const [advice, setAdvice] = useState(null);
  const [isComputing, setIsComputing] = useState(false);
  const lastComputeKey = useRef(null);
  const { register, isCurrent, abort } = useAbortControl();
  // Per-hand range persistence: { handNumber, ranges: { [seat]: Float64Array }, log: [] }
  const streetRangesRef = useRef({ handNumber: null, ranges: {}, log: [] });

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

    // --- Multi-villain range tracking ---
    // Reset range cache on new hand
    const handNum = liveHandState.handNumber || null;
    if (streetRangesRef.current.handNumber !== handNum) {
      streetRangesRef.current = { handNumber: handNum, ranges: {}, log: [] };
    }

    // Compute all active villain ranges (preflop base)
    const allVillainRanges = computeAllVillainRanges(liveHandState, tendencyMap, dealerSeat);
    // Cache preflop widths before any postflop narrowing mutates ranges
    const preflopWidthMap = {};
    for (const vr of allVillainRanges) preflopWidthMap[vr.seat] = rangeWidth(vr.range);

    try {
      let result;

      if (currentStreet === 'preflop') {
        result = await buildPreflopAdvice({
          liveHandState, heroSeat, targetSeat, dealerSeat,
          villainRange, encodedHero, adjustedPot,
          detectedSituation, playerStats, villainData, villainModel, rakeConfig,
          equityFn,
        });

        // Store preflop ranges for persistence
        for (const vr of allVillainRanges) {
          streetRangesRef.current.ranges[vr.seat] = vr.range;
        }
      } else {
        result = await buildPostflopAdvice({
          liveHandState, heroSeat, targetSeat, dealerSeat, currentStreet,
          villainRange, encodedHero, adjustedPot,
          detectedSituation, playerStats, villainData, villainModel,
          tendencyMap, dataQuality, sampleSize, rakeConfig, equityFn,
        });
        if (!result) return;

        // Narrow each villain's range and log adjustments
        const visibleBoard = (communityCards || []).filter(c => c && c !== '');
        const encodedBoard = visibleBoard.map(c => parseAndEncode(c)).filter(c => c >= 0);
        const bt = encodedBoard.length >= 3 ? analyzeBoardTexture(encodedBoard) : null;

        for (const vr of allVillainRanges) {
          // Use cached narrowed range from previous street if available
          const baseRange = streetRangesRef.current.ranges[vr.seat] || vr.range;
          // Determine this villain's last action on the current street
          const villainActions = (actionSequence || []).filter(
            a => a.seat === vr.seat && a.street === currentStreet
          );
          const lastAction = villainActions.length > 0
            ? villainActions[villainActions.length - 1].action
            : null;

          if (lastAction && lastAction !== 'fold') {
            const { narrowed, logEntry } = narrowWithLog(
              baseRange, lastAction, encodedBoard, encodedHero,
              { boardTexture: bt, playerStats: buildPlayerStats(vr.villainData, vr.position) },
              vr.seat, currentStreet,
            );
            streetRangesRef.current.ranges[vr.seat] = narrowed;
            // Only add log entry if this is a new narrowing (avoid dupes)
            const existingEntry = streetRangesRef.current.log.find(
              e => e.seat === vr.seat && e.street === currentStreet && e.action === lastAction
            );
            if (!existingEntry) {
              streetRangesRef.current.log.push(logEntry);
            }
            vr.range = narrowed;
          } else {
            // Preserve cached range
            vr.range = baseRange;
            streetRangesRef.current.ranges[vr.seat] = baseRange;
          }
        }
      }

      if (!isCurrent(callId)) return;

      // Compute per-villain equity in parallel
      const baseTrials = computeTrialCount({
        street: currentStreet,
        activeOpponents: allVillainRanges.length,
        sampleSize,
      });
      const visibleBoard = (communityCards || []).filter(c => c && c !== '');
      const encodedBoard = visibleBoard.map(c => parseAndEncode(c)).filter(c => c >= 0);
      const { perVillain, multiway } = await computeVillainEquities(
        encodedHero, allVillainRanges, encodedBoard, baseTrials, equityFn
      );

      if (!isCurrent(callId)) return;

      // Assemble villainRanges wire data (preflopWidthMap cached before narrowing)
      const villainRangesData = allVillainRanges.map((vr, i) => ({
        seat: vr.seat,
        position: vr.position,
        actionKey: vr.actionKey,
        range: vr.range,
        rangeWidth: rangeWidth(vr.range),
        equity: perVillain[i]?.equity ?? null,
        equityCI: perVillain[i]?.equityCI ?? null,
        narrowedFrom: preflopWidthMap[vr.seat] ?? rangeWidth(vr.range),
        active: true,
      }));

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
        // Multi-villain range data
        villainRanges: villainRangesData,
        multiwayEquity: multiway,
        narrowingLog: [...streetRangesRef.current.log],
        timestamp: Date.now(),
      });
      logger.debug('LiveActionAdvisor', 'Advice computed:', {
        street: currentStreet, situation, villain: targetSeat,
        heroEq: Math.round(result.heroEquity * 100) + '%',
        recs: result.recommendations.map(r => `${r.action}:${r.ev.toFixed(2)}`),
        villainRangeCount: villainRangesData.length,
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

