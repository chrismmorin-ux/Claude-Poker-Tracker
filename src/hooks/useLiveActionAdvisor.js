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
import { getActionAdvice } from '../utils/exploitEngine/actionAdvisor';
import { handVsRange } from '../utils/exploitEngine/equityCalculator';
import { getPopulationPrior } from '../utils/rangeEngine/populationPriors';
import { createRange } from '../utils/pokerCore/rangeMatrix';
import { parseAndEncode } from '../utils/pokerCore/cardParser';

// =========================================================================
// POSITION MAPPING
// =========================================================================

/**
 * Map villain seat to approximate position category using dealer seat.
 * Seats after dealer: SB(+1), BB(+2), UTG(+3), ..., BTN(+0)
 */
const getVillainPosition = (villainSeat, dealerSeat) => {
  const dist = ((villainSeat - dealerSeat - 1 + 9) % 9); // 0=SB, 1=BB, 2=UTG...
  if (dist === 0) return 'SB';
  if (dist === 1) return 'BB';
  if (dist <= 3) return 'EARLY';
  if (dist <= 5) return 'MIDDLE';
  return 'LATE';
};

// =========================================================================
// BASELINE RANGE BUILDER
// =========================================================================

/**
 * Build a baseline villain range from VPIP/PFR when no Bayesian profile exists.
 * Uses position-appropriate population prior scaled by the player's observed VPIP.
 */
const buildBaselineRange = (vpip, pfr, position = 'LATE') => {
  const prior = getPopulationPrior(position, 'open');
  const range = createRange();
  const scale = Math.max(0.3, Math.min(3, (vpip || 25) / 25));
  for (let i = 0; i < 169; i++) {
    range[i] = Math.min(1, prior[i] * scale);
  }
  return range;
};

// =========================================================================
// PREFLOP ADVISOR (Fix 1: P0 — avoids broken segmentRange on empty board)
// =========================================================================

/**
 * Estimate preflop fold% from player stats (no range segmentation).
 */
const estimatePreflopFoldPct = (stats, villainAction) => {
  const vpip = stats?.vpip ?? 25;
  // Base: high VPIP = low fold rate
  let foldPct = Math.max(0.1, Math.min(0.8, 1 - vpip / 100));
  // Villain already raised → they fold less to a 3-bet
  if (villainAction === 'raise') foldPct *= 0.7;
  // Style adjustments
  if (stats?.style === 'Fish') foldPct *= 0.6;
  if (stats?.style === 'Nit') foldPct *= 1.3;
  return Math.min(0.85, Math.max(0.05, foldPct));
};

/**
 * Compute preflop action recommendations.
 * Uses handVsRange with empty board (deals 5 random runouts) for equity.
 */
const computePreflopAdvice = async (villainRange, encodedHero, potSize, villainAction, villainBet, playerStats) => {
  const eqResult = await handVsRange(encodedHero, villainRange, [], { trials: 1000 });
  const heroEquity = eqResult.equity;
  const foldPct = estimatePreflopFoldPct(playerStats, villainAction);
  const recommendations = [];

  const facingBet = villainAction === 'raise' || villainAction === 'bet';

  if (facingBet) {
    const effectiveBet = villainBet || potSize * 0.5;

    // Fold: EV = 0
    recommendations.push({
      action: 'fold', ev: 0,
      reasoning: 'Surrender — lose nothing more',
    });

    // Call: EV = equity * (pot + bet to call) - cost to call
    // pot already adjusted (excludes villain bet), so total pot on call = pot + 2*bet
    const callEV = heroEquity * (potSize + effectiveBet * 2) - effectiveBet;
    recommendations.push({
      action: 'call', ev: callEV,
      reasoning: `${Math.round(heroEquity * 100)}% equity — ${callEV > 0 ? '+EV call' : 'marginal call'}`,
    });

    // Raise/3-bet: 3x the open
    const raiseSize = effectiveBet * 3;
    const raiseFoldPct = Math.min(0.85, foldPct + 0.15);
    const raiseEV = raiseFoldPct * potSize
      + (1 - raiseFoldPct) * (heroEquity * (potSize + effectiveBet + raiseSize * 2) - raiseSize);
    recommendations.push({
      action: 'raise', ev: raiseEV,
      sizing: { betSize: raiseSize, betFraction: raiseSize / (potSize || 1), foldPct: raiseFoldPct },
      reasoning: `3-bet for value + fold equity (${Math.round(raiseFoldPct * 100)}% fold)`,
    });
  } else {
    // First to act preflop — open raise or limp
    const openSize = potSize * 2.5;
    const openEV = foldPct * potSize
      + (1 - foldPct) * (heroEquity * (potSize + openSize * 2) - openSize);
    recommendations.push({
      action: 'bet', ev: openEV,
      sizing: { betSize: openSize, betFraction: 2.5, foldPct },
      reasoning: `Open raise — ${Math.round(heroEquity * 100)}% equity, ${Math.round(foldPct * 100)}% fold`,
    });

    // Check/limp — discounted equity realization
    const checkEV = heroEquity * potSize * 0.7;
    recommendations.push({
      action: 'check', ev: checkEV,
      reasoning: 'Check/limp — realize partial equity',
    });
  }

  recommendations.sort((a, b) => b.ev - a.ev);

  return {
    heroEquity,
    recommendations,
    foldPct: { bet: foldPct, raise: Math.min(0.85, foldPct + 0.15) },
    segmentation: null,
    boardTexture: null,
  };
};

// =========================================================================
// SITUATION DETECTION
// =========================================================================

const detectSituation = (actionSequence, heroSeat, currentStreet, pfAggressor) => {
  if (!actionSequence || actionSequence.length === 0) {
    return { situation: 'waiting', villainSeat: null, villainAction: null, villainBet: 0 };
  }

  const streetActions = actionSequence.filter(a => a.street === currentStreet);
  const heroActed = streetActions.some(a => a.seat === heroSeat);
  if (heroActed) {
    return { situation: 'hero_acted', villainSeat: null, villainAction: null, villainBet: 0 };
  }

  let lastVillainAction = null;
  for (let i = streetActions.length - 1; i >= 0; i--) {
    if (streetActions[i].seat !== heroSeat) {
      lastVillainAction = streetActions[i];
      break;
    }
  }

  if (!lastVillainAction) {
    return { situation: 'first_to_act', villainSeat: null, villainAction: null, villainBet: 0 };
  }

  const villainSeat = lastVillainAction.seat;
  const villainAction = lastVillainAction.action;
  const villainBet = lastVillainAction.amount || 0;

  let situation;
  if (villainAction === 'bet') {
    situation = currentStreet !== 'preflop' && villainSeat === pfAggressor
      ? 'facing_cbet' : 'facing_bet';
  } else if (villainAction === 'raise') {
    situation = currentStreet === 'preflop' ? 'preflop_facing_raise' : 'facing_raise';
  } else if (villainAction === 'check' || villainAction === 'call') {
    situation = 'checked_to';
  } else {
    situation = 'waiting';
  }

  return { situation, villainSeat, villainAction, villainBet };
};

const SITUATION_LABELS = {
  facing_bet: 'Facing bet',
  facing_cbet: 'Facing c-bet',
  facing_raise: 'Facing raise',
  preflop_facing_raise: 'Facing open',
  checked_to: 'Checked to hero',
  first_to_act: 'First to act',
};

// =========================================================================
// MAIN HOOK
// =========================================================================

/**
 * @param {Object|null} liveHandState - From useSyncBridge
 * @param {Object} tendencyMap - From useOnlineAnalysis
 * @returns {{ advice: Object|null, isComputing: boolean }}
 */
const useLiveActionAdvisor = (liveHandState, tendencyMap) => {
  const [advice, setAdvice] = useState(null);
  const [isComputing, setIsComputing] = useState(false);
  const lastComputeKey = useRef(null);
  const abortRef = useRef(0);

  const compute = useCallback(async () => {
    if (!liveHandState || !tendencyMap) {
      setAdvice(null);
      return;
    }

    const {
      currentStreet, communityCards, holeCards, heroSeat,
      pot, actionSequence, pfAggressor, state, dealerSeat,
    } = liveHandState;

    // Skip if not in a live hand
    if (!state || state === 'IDLE' || state === 'COMPLETE') {
      setAdvice(null);
      return;
    }

    // Skip if no hero cards
    if (!holeCards || !holeCards[0] || !holeCards[1]) return;

    // Detect situation
    const { situation, villainSeat, villainAction, villainBet } = detectSituation(
      actionSequence, heroSeat, currentStreet, pfAggressor
    );

    if (situation === 'waiting' || situation === 'hero_acted') return;

    // Find target villain
    let targetSeat = villainSeat;
    if (!targetSeat) {
      const activeSeatNumbers = liveHandState.activeSeatNumbers || [];
      const foldedSet = new Set(liveHandState.foldedSeats || []);
      targetSeat = activeSeatNumbers.find(s => s !== heroSeat && !foldedSet.has(s));
    }
    if (!targetSeat) return;

    // Debounce
    const computeKey = `${liveHandState.handNumber}:${currentStreet}:${actionSequence?.length}:${targetSeat}`;
    if (computeKey === lastComputeKey.current) return;
    lastComputeKey.current = computeKey;

    // Look up villain data (Fix 3: allow zero-sample — baseline range handles it)
    const villainData = tendencyMap[String(targetSeat)] || {};
    const confidence = (villainData.sampleSize || 0) >= 50 ? 'high'
      : (villainData.sampleSize || 0) >= 20 ? 'medium' : 'low';

    // Build villain range (Fix 4: position-aware baseline)
    let villainRange = null;
    if (villainData.rangeProfile?.grids) {
      const grids = villainData.rangeProfile.grids;
      villainRange = grids.noRaise?.open || grids.facedRaise?.coldCall || null;
    }
    if (!villainRange) {
      const position = getVillainPosition(targetSeat, dealerSeat || 1);
      villainRange = buildBaselineRange(villainData.vpip, villainData.pfr, position);
    }

    // Encode cards
    const encodedHero = holeCards.map(c => parseAndEncode(c)).filter(c => c >= 0);
    if (encodedHero.length !== 2) return;

    // Fix 2: HSM pot includes current bets — subtract villain's bet
    const rawPotSize = (pot || 0) / 100;
    if (rawPotSize <= 0) return;
    const adjustedPot = Math.max(0, rawPotSize - (villainBet || 0));

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
      style: villainData.style,
    };

    const callId = ++abortRef.current;
    setIsComputing(true);

    try {
      let result;

      if (currentStreet === 'preflop') {
        // Fix 1: Dedicated preflop branch — avoids broken segmentRange on empty board
        result = await computePreflopAdvice(
          villainRange, encodedHero, adjustedPot,
          villainAction, villainBet || 0, playerStats
        );
      } else {
        // Postflop: use full action advisor pipeline
        const visibleBoard = (communityCards || []).filter(c => c && c !== '');
        const encodedBoard = visibleBoard.map(c => parseAndEncode(c)).filter(c => c >= 0);
        if (encodedBoard.length < 3) return;

        result = await getActionAdvice({
          villainRange,
          board: encodedBoard,
          heroCards: encodedHero,
          potSize: adjustedPot,
          villainAction: (villainAction === 'check' || !villainAction) ? undefined : villainAction,
          villainBet: villainBet || 0,
          trials: 1000,
          playerStats,
        });
      }

      if (callId !== abortRef.current) return;

      setAdvice({
        villainSeat: targetSeat,
        villainStyle: villainData.style || null,
        villainSampleSize: villainData.sampleSize || 0,
        confidence,
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
        recommendations: result.recommendations,
        currentStreet,
        potSize: adjustedPot,
        villainBet: villainBet || 0,
        playerStats,
        timestamp: Date.now(),
      });
    } catch (e) {
      console.warn('[LiveActionAdvisor] Error:', e.message);
    } finally {
      if (callId === abortRef.current) setIsComputing(false);
    }
  }, [liveHandState, tendencyMap]);

  useEffect(() => {
    compute();
    return () => { abortRef.current++; };
  }, [compute]);

  return { advice, isComputing };
};

export default useLiveActionAdvisor;
