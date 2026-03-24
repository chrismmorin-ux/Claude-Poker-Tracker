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
import { getPopulationPrior, FACED_RAISE_FREQUENCIES } from '../utils/rangeEngine/populationPriors';
import { createRange } from '../utils/pokerCore/rangeMatrix';
import { parseAndEncode } from '../utils/pokerCore/cardParser';
import { getRangePositionCategory } from '../utils/positionUtils';

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
 * Estimate preflop fold% from player stats.
 *
 * Priority: (1) observed foldTo3Bet, (2) population prior by position + style adjustment.
 * NEVER derives fold% from VPIP — VPIP measures how often a player enters pots,
 * not how they respond to aggression. A 40-VPIP fish calls almost everything.
 *
 * @param {object} stats - Player stats (vpip, pfr, style, foldTo3Bet, position)
 * @param {string} villainAction - 'raise' | 'bet' | etc.
 * @returns {{ foldPct: number, dataSource: 'observed' | 'population' | 'baseline' }}
 */
const estimatePreflopFoldPct = (stats, villainAction) => {
  // (1) Best case: observed fold-to-3bet from this player's actual data
  // Require minimum 5 observations before trusting — with 1-2 observations,
  // the observed rate is noise and shouldn't override the population prior.
  const MIN_OBSERVED_SAMPLE = 5;
  if (stats?.foldTo3Bet != null && stats.foldTo3Bet >= 0
      && (stats.facedRaisePreflop || 0) >= MIN_OBSERVED_SAMPLE) {
    let foldPct = stats.foldTo3Bet / 100;
    // Villain already raised → slightly less likely to fold their own open
    if (villainAction === 'raise') foldPct *= 0.85;
    return {
      foldPct: Math.min(0.90, Math.max(0.05, foldPct)),
      dataSource: 'observed',
    };
  }

  // (2) Population prior: typical fold-to-raise rate by position
  const position = stats?.position || 'LATE';
  const posFreqs = FACED_RAISE_FREQUENCIES[position] || FACED_RAISE_FREQUENCIES.LATE;
  let foldPct = posFreqs.fold; // e.g. EARLY=0.82, BB=0.48

  // Style adjustments: fish/stations fold LESS than population, nits fold MORE
  const style = stats?.style;
  if (style === 'Fish' || style === 'LP') foldPct *= 0.6;
  else if (style === 'LAG') foldPct *= 0.8;
  else if (style === 'Nit') foldPct *= 1.15;
  else if (style === 'TAG') foldPct *= 1.05;
  // Unknown: use population prior unmodified

  // Villain already raised → they fold less to a 3-bet (they have a hand)
  if (villainAction === 'raise') foldPct *= 0.75;

  return {
    foldPct: Math.min(0.90, Math.max(0.05, foldPct)),
    dataSource: 'population',
  };
};

/**
 * Compute preflop action recommendations.
 * Uses handVsRange with empty board (deals 5 random runouts) for equity.
 */
const computePreflopAdvice = async (villainRange, encodedHero, potSize, villainAction, villainBet, playerStats) => {
  const eqResult = await handVsRange(encodedHero, villainRange, [], { trials: 1000 });
  const heroEquity = eqResult.equity;
  const { foldPct, dataSource } = estimatePreflopFoldPct(playerStats, villainAction);
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
    const foldNote = dataSource === 'observed'
      ? `observed ${Math.round(raiseFoldPct * 100)}% fold`
      : `estimated ${Math.round(raiseFoldPct * 100)}% fold (population)`;
    recommendations.push({
      action: 'raise', ev: raiseEV,
      sizing: { betSize: raiseSize, betFraction: raiseSize / (potSize || 1), foldPct: raiseFoldPct },
      reasoning: `3-bet for value + fold equity (${foldNote})`,
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

/**
 * Detect the decision situation hero faces (or faced) on the current street.
 * If hero already acted, we still identify the villain action hero responded to
 * so we can show what the optimal play was (real-time learning).
 */
const detectSituation = (actionSequence, heroSeat, currentStreet, pfAggressor) => {
  if (!actionSequence || actionSequence.length === 0) {
    return { situation: 'waiting', villainSeat: null, villainAction: null, villainBet: 0, heroAlreadyActed: false };
  }

  const streetActions = actionSequence.filter(a => a.street === currentStreet);
  const heroActed = streetActions.some(a => a.seat === heroSeat);

  // Find the last villain action BEFORE hero's first action on this street
  // (or the last villain action overall if hero hasn't acted)
  let lastVillainAction = null;
  for (const a of streetActions) {
    if (a.seat === heroSeat) break; // stop at hero's action
    if (a.seat !== heroSeat) lastVillainAction = a;
  }

  // If no villain acted before hero on this street, check if hero was first to act
  if (!lastVillainAction && !heroActed) {
    return { situation: 'first_to_act', villainSeat: null, villainAction: null, villainBet: 0, heroAlreadyActed: false };
  }
  if (!lastVillainAction && heroActed) {
    // Hero was first to act and already acted — find the first non-hero action to analyze
    const firstVillain = streetActions.find(a => a.seat !== heroSeat);
    if (!firstVillain) {
      return { situation: 'first_to_act', villainSeat: null, villainAction: null, villainBet: 0, heroAlreadyActed: true };
    }
    lastVillainAction = firstVillain;
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

  return { situation, villainSeat, villainAction, villainBet, heroAlreadyActed: heroActed };
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
      console.log('[LiveActionAdvisor] Skip: no handState or tendencyMap', { hasHS: !!liveHandState, hasTM: !!tendencyMap, tmKeys: tendencyMap ? Object.keys(tendencyMap) : [] });
      setAdvice(null);
      return;
    }

    const {
      currentStreet, communityCards, holeCards, heroSeat,
      pot, actionSequence, pfAggressor, state, dealerSeat,
    } = liveHandState;

    // Skip if not in a live hand
    if (!state || state === 'IDLE' || state === 'COMPLETE') {
      console.log('[LiveActionAdvisor] Skip: not live hand, state=', state);
      setAdvice(null);
      return;
    }

    // Skip if no hero cards
    if (!holeCards || !holeCards[0] || !holeCards[1]) {
      console.log('[LiveActionAdvisor] Skip: no hero cards', holeCards);
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
      console.log('[LiveActionAdvisor] No villain from action, fallback target=', targetSeat, 'active=', activeSeatNumbers, 'folded=', liveHandState.foldedSeats);
    }
    if (!targetSeat) {
      console.log('[LiveActionAdvisor] Skip: no target seat');
      return;
    }

    // Debounce
    const computeKey = `${liveHandState.handNumber}:${currentStreet}:${actionSequence?.length}:${targetSeat}`;
    if (computeKey === lastComputeKey.current) return;
    lastComputeKey.current = computeKey;

    // Look up villain data (Fix 3: allow zero-sample — baseline range handles it)
    const villainData = tendencyMap[String(targetSeat)] || {};
    const sampleSize = villainData.sampleSize || 0;
    console.log('[LiveActionAdvisor] Computing:', { street: currentStreet, situation, villain: targetSeat, vpip: villainData.vpip, sample: sampleSize, pot });

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
      console.log('[LiveActionAdvisor] Advice computed:', {
        street: currentStreet, situation, villain: targetSeat,
        heroEq: Math.round(result.heroEquity * 100) + '%',
        recs: result.recommendations.map(r => `${r.action}:${r.ev.toFixed(2)}`),
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
