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
import { analyzeBoardTexture } from '../utils/pokerCore/boardTexture';
import { getRangePositionCategory, isInPosition, getPreflopOrder } from '../utils/positionUtils';
import { getVillainActionKey, getVillainRange } from '../utils/rangeEngine/rangeAccessors';
import {
  buildBaselineRange,
  computePreflopAdvice,
  detectSituation,
  SITUATION_LABELS,
} from '../utils/exploitEngine/preflopAdvisor';
import { useAbortControl } from './useAbortControl';
import { getQualityTier } from '../constants/designTokens';
import { calculateStartingPot } from '../utils/potCalculator';
import { getSPRZone, SPR_ZONES } from '../utils/exploitEngine/gameTreeHelpers';

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

    // HSM pot is already in dollars and includes current bets — subtract villain's bet.
    // CO_CHIPTABLE_INFO may not arrive until after betting, so estimate from blinds on preflop.
    // Lobby WS may delay blind/pot messages — fall back to gameType defaults.
    let rawPotSize = pot || 0;
    if (rawPotSize <= 0 && liveHandState.blinds) {
      const { sb, bb } = liveHandState.blinds;
      rawPotSize = calculateStartingPot(
        { sb: sb || 0, bb: bb || 0 },
        { amount: liveHandState.ante || 0, format: liveHandState.anteFormat || 'per-player', seatCount: liveHandState.activeSeatNumbers?.length || 2 }
      );
    }
    // Last resort: estimate from game type or use standard 1/2 blinds
    if (rawPotSize <= 0) {
      const gt = liveHandState.gameType;
      if (gt?.sb && gt?.bb) {
        rawPotSize = calculateStartingPot(
          { sb: gt.sb, bb: gt.bb },
          { amount: gt.ante || 0, format: gt.anteFormat || 'per-player', seatCount: liveHandState.activeSeatNumbers?.length || 2 }
        );
      } else {
        // Standard 1/2 NL assumption — better than bailing entirely
        rawPotSize = 3;
      }
      logger.debug('LiveActionAdvisor', 'Pot fallback:', rawPotSize, 'from', gt?.sb ? 'gameType' : 'default');
    }
    const adjustedPot = Math.max(0, rawPotSize - (villainBet || 0));

    // Resolve rake config from live hand state or session game type
    const rakeConfig = liveHandState.rakeConfig || null;

    const playerStats = {
      vpip: villainData.vpip ?? null,
      pfr: villainData.pfr ?? null,
      af: villainData.af ?? null,
      cbet: villainData.rawStats?.pfAggressorFlops > 0
        ? Math.round((villainData.rawStats.cbetCount / villainData.rawStats.pfAggressorFlops) * 100)
        : undefined,
      foldToCbet: villainData.rawStats?.facedCbet > 0
        ? Math.round((villainData.rawStats.foldedToCbet / villainData.rawStats.facedCbet) * 100)
        : undefined,
      foldToCbetSampleSize: villainData.rawStats?.facedCbet || 0,
      foldTo3Bet: villainData.foldTo3Bet ?? null,
      facedRaisePreflop: villainData.rawStats?.facedRaisePreflop || 0,
      style: villainData.style,
      position: villainPosition,
    };

    const callId = register();
    setIsComputing(true);
    const villainModel = villainData.villainModel || null;

    try {
      let result;

      if (currentStreet === 'preflop') {
        // Dedicated preflop branch with positional dynamics
        const heroPosition = getRangePositionCategory(heroSeat, dealerSeat || 1);

        // Compute players yet to act behind hero (for cumulative fold models)
        let playersToAct = 0;
        if (dealerSeat) {
          const preflopOrder = getPreflopOrder(dealerSeat);
          const activeSeatNumbers = liveHandState.activeSeatNumbers || [];
          const foldedSet = new Set(liveHandState.foldedSeats || []);
          const activeSet = new Set(activeSeatNumbers.filter(s => !foldedSet.has(s)));
          const streetActions = (actionSequence || []).filter(a => a.street === 'preflop');
          const actedSet = new Set(streetActions.map(a => a.seat));
          const heroIdx = preflopOrder.indexOf(heroSeat);
          if (heroIdx >= 0) {
            playersToAct = preflopOrder.slice(heroIdx + 1)
              .filter(s => activeSet.has(s) && !actedSet.has(s) && s !== heroSeat).length;
          }
        }

        // Pass enriched posContext including situation, limp/squeeze metadata
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
        result = await computePreflopAdvice(
          villainRange, encodedHero, adjustedPot,
          villainAction, villainBet || 0, playerStats,
          posCtx, villainModel, rakeConfig
        );
      } else {
        // Postflop: use full action advisor pipeline
        const visibleBoard = (communityCards || []).filter(c => c && c !== '');
        const encodedBoard = visibleBoard.map(c => parseAndEncode(c)).filter(c => c >= 0);
        if (encodedBoard.length < 3) return;

        // Surface villain model quality in dataQuality
        dataQuality.villainModelNote = villainModel?._buckets
          ? 'Calibrated to villain behavior'
          : villainModel
            ? 'Partial villain model — some generic assumptions'
            : 'Generic advice — no villain model';
        // Pass observations + sizing tells for contextual reasoning
        const relevantObs = (villainData.observations || []).filter(o =>
          o.street === currentStreet || o.street === 'cross' || o.heroContext === 'META'
        );
        const bt = analyzeBoardTexture(encodedBoard);
        const heroIsIP = isInPosition(heroSeat, targetSeat, dealerSeat || 1);

        // Stack depth: compute effective stack from liveHandState stacks
        const stacks = liveHandState.stacks || {};
        const heroStack = stacks[heroSeat] ?? null;
        const villainStack = stacks[targetSeat] ?? null;
        const effStack = (heroStack != null && villainStack != null)
          ? Math.min(heroStack, villainStack)
          : heroStack ?? villainStack ?? null;

        // Multi-way: count active opponents and load per-seat models
        const activeSeatNumbers = liveHandState.activeSeatNumbers || [];
        const foldedSet = new Set(liveHandState.foldedSeats || []);
        const activeOpponents = activeSeatNumbers.filter(s => s !== heroSeat && !foldedSet.has(s)).length;

        // Build opponent models for all non-primary active opponents
        const opponentModels = activeSeatNumbers
          .filter(s => s !== heroSeat && !foldedSet.has(s) && s !== targetSeat)
          .map(s => {
            const d = tendencyMap[String(s)] || {};
            return {
              seat: s,
              villainModel: d.villainModel || null,
              playerStats: d.style ? { style: d.style, af: d.af, vpip: d.vpip } : null,
            };
          });

        const postflopResult = await evaluateGameTree({
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
          personalizedMultipliers: villainModel?.personalizedMultipliers,
          villainModel,
          effectiveStack: effStack,
          numOpponents: Math.max(1, activeOpponents),
          opponentModels,
          contextHints: {
            observations: relevantObs,
            sizingTells: villainData.decisionSummary?.sizingTells,
            texture: bt?.texture || '*',
            posCategory: villainPosition,
            isIP: heroIsIP,
            isPreflopAggressor: heroSeat === pfAggressor,
          },
          rakeConfig,
        });
        result = postflopResult;
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

