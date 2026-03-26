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
import { DEBUG } from '../utils/errorHandler';
import { getActionAdvice } from '../utils/exploitEngine/actionAdvisor';
import { parseAndEncode } from '../utils/pokerCore/cardParser';
import { getRangePositionCategory } from '../utils/positionUtils';
import {
  buildBaselineRange,
  computePreflopAdvice,
  detectSituation,
  SITUATION_LABELS,
} from '../utils/exploitEngine/preflopAdvisor';
import { useAbortControl } from './useAbortControl';

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
      if (DEBUG) console.log('[LiveActionAdvisor] Skip: no handState or tendencyMap', { hasHS: !!liveHandState, hasTM: !!tendencyMap, tmKeys: tendencyMap ? Object.keys(tendencyMap) : [] });
      setAdvice(null);
      return;
    }

    const {
      currentStreet, communityCards, holeCards, heroSeat,
      pot, actionSequence, pfAggressor, state, dealerSeat,
    } = liveHandState;

    // Skip if not in a live hand
    if (!state || state === 'IDLE' || state === 'COMPLETE') {
      if (DEBUG) console.log('[LiveActionAdvisor] Skip: not live hand, state=', state);
      setAdvice(null);
      return;
    }

    // Skip if no hero cards
    if (!holeCards || !holeCards[0] || !holeCards[1]) {
      if (DEBUG) console.log('[LiveActionAdvisor] Skip: no hero cards', holeCards);
      return;
    }

    // Detect situation (still computes even if hero already acted — shows optimal play)
    const { situation, villainSeat, villainAction, villainBet, heroAlreadyActed } = detectSituation(
      actionSequence, heroSeat, currentStreet, pfAggressor
    );

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
      if (DEBUG) console.log('[LiveActionAdvisor] No villain from action, fallback target=', targetSeat, 'active=', activeSeatNumbers, 'folded=', liveHandState.foldedSeats);
    }
    if (!targetSeat) {
      if (DEBUG) console.log('[LiveActionAdvisor] Skip: no target seat');
      return;
    }

    // Debounce
    const computeKey = `${liveHandState.handNumber}:${currentStreet}:${actionSequence?.length}:${targetSeat}`;
    if (computeKey === lastComputeKey.current) return;
    lastComputeKey.current = computeKey;

    // Look up villain data (Fix 3: allow zero-sample — baseline range handles it)
    const villainData = tendencyMap[String(targetSeat)] || {};
    const sampleSize = villainData.sampleSize || 0;
    if (DEBUG) console.log('[LiveActionAdvisor] Computing:', { street: currentStreet, situation, villain: targetSeat, vpip: villainData.vpip, sample: sampleSize, pot });

    // Data quality metadata — richer than old 'high'/'medium'/'low'
    const dataQuality = {
      sampleSize,
      tier: sampleSize === 0 ? 'none'
        : sampleSize < 10 ? 'speculative'
        : sampleSize < 30 ? 'developing'
        : 'established',
      confidenceNote: sampleSize === 0 ? 'Population defaults only — no player data'
        : sampleSize < 10 ? 'Early estimate — need more hands'
        : sampleSize < 30 ? `Based on ${sampleSize} hands`
        : `Solid read (${sampleSize} hands)`,
    };
    const confidence = dataQuality.tier;

    // Build villain range (Fix 4: position-aware baseline)
    let villainRange = null;
    if (villainData.rangeProfile?.grids) {
      const grids = villainData.rangeProfile.grids;
      villainRange = grids.noRaise?.open || grids.facedRaise?.coldCall || null;
    }
    if (!villainRange) {
      const position = getRangePositionCategory(targetSeat, dealerSeat || 1);
      villainRange = buildBaselineRange(villainData.vpip, villainData.pfr, position);
    }

    // Encode hero cards (extension now sends Unicode format matching cardParser)
    const encodedHero = holeCards.map(c => parseAndEncode(c)).filter(c => c >= 0);
    if (encodedHero.length !== 2) return;

    // HSM pot is already in dollars and includes current bets — subtract villain's bet
    const rawPotSize = pot || 0;
    if (rawPotSize <= 0) return;
    const adjustedPot = Math.max(0, rawPotSize - (villainBet || 0));

    const villainPosition = getRangePositionCategory(targetSeat, dealerSeat || 1);
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

    try {
      let result;

      if (currentStreet === 'preflop') {
        // Dedicated preflop branch with positional dynamics
        const heroPosition = getRangePositionCategory(heroSeat, dealerSeat || 1);
        result = await computePreflopAdvice(
          villainRange, encodedHero, adjustedPot,
          villainAction, villainBet || 0, playerStats,
          { heroPosition, villainPosition }
        );
      } else {
        // Postflop: use full action advisor pipeline
        const visibleBoard = (communityCards || []).filter(c => c && c !== '');
        const encodedBoard = visibleBoard.map(c => parseAndEncode(c)).filter(c => c >= 0);
        if (encodedBoard.length < 3) return;

        const villainModel = villainData.villainModel || null;
        // Pass observations + sizing tells for contextual reasoning
        const relevantObs = (villainData.observations || []).filter(o =>
          o.street === currentStreet || o.street === 'cross' || o.heroContext === 'META'
        );
        result = await getActionAdvice({
          villainRange,
          board: encodedBoard,
          heroCards: encodedHero,
          potSize: adjustedPot,
          villainAction: (villainAction === 'check' || !villainAction) ? undefined : villainAction,
          villainBet: villainBet || 0,
          trials: 1000,
          playerStats,
          personalizedMultipliers: villainModel?.personalizedMultipliers,
          villainModel,
          contextHints: {
            observations: relevantObs,
            sizingTells: villainData.decisionSummary?.sizingTells,
          },
        });
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
          isCapped: result.segmentation.isCapped,
          totalCombos: result.segmentation.totalCombos,
        } : null,
        foldPct: result.foldPct,
        recommendations: gatedRecs,
        currentStreet,
        potSize: adjustedPot,
        villainBet: villainBet || 0,
        playerStats,
        timestamp: Date.now(),
      });
      if (DEBUG) console.log('[LiveActionAdvisor] Advice computed:', {
        street: currentStreet, situation, villain: targetSeat,
        heroEq: Math.round(result.heroEquity * 100) + '%',
        recs: result.recommendations.map(r => `${r.action}:${r.ev.toFixed(2)}`),
      });
    } catch (e) {
      console.warn('[LiveActionAdvisor] Error:', e.message);
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

