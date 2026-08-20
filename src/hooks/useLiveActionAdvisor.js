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
 *
 * SPR-080 (2026-05-14): 6 pure helpers extracted to
 * `src/utils/liveAdvisor/computeHelpers.js`. This hook now owns state +
 * orchestration only. PMC Phase 5b integration point: optional
 * `onHandComplete` callback in options fires when a per-hand prediction is
 * produced (see compute() body before `setAdvice`). The callback receives
 * `{ handNumber, street, heroCards, villainSeat, prediction, modelVersion }`.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../utils/errorHandler';
import { parseAndEncode } from '../utils/pokerCore/cardParser';
import { rangeWidth } from '../utils/pokerCore/rangeMatrix';
import { getRangePositionCategory } from '../utils/positionUtils';
import { getVillainActionKey, getVillainRange } from '../utils/rangeEngine/rangeAccessors';
import { analyzeBoardTexture } from '../utils/pokerCore/boardTexture';
import {
  buildBaselineRange,
  detectSituation,
  SITUATION_LABELS,
} from '../utils/exploitEngine/preflopAdvisor';
import { useAbortControl } from './useAbortControl';
import { getQualityTier } from '../constants/designTokens';
import {
  estimatePot, buildPlayerStats,
} from '../utils/exploitEngine/liveGameContext';
import {
  computeTrialCount,
  computeAllVillainRanges,
  computeVillainEquities,
  narrowWithLog,
  buildPreflopAdvice,
  buildPostflopAdvice,
} from '../utils/liveAdvisor/computeHelpers';

// Re-export computeTrialCount for back-compat with any external importers.
// Canonical location is now `src/utils/liveAdvisor/computeHelpers.js`.
export { computeTrialCount };

// =========================================================================
// MAIN HOOK
// =========================================================================

/**
 * @param {Object|null} liveHandState - From useSyncBridge
 * @param {Object} tendencyMap - From useOnlineAnalysis
 * @param {Object} [options]
 * @param {Function} [options.equityFn] - Override equity computation (used for equity worker).
 * @param {Object|null} [options.rakeConfig] - Resolved by `rakeResolver` from the session's
 *   game type and captured blinds. Before this existed the hook read
 *   `liveHandState.rakeConfig`, which NOTHING in the app ever wrote — so `estimateRake`
 *   returned 0 on every live decision and every EV figure omitted the drop. The
 *   `liveHandState` fallback is kept for the extension/test payloads that set it directly.
 * @param {Function} [options.onHandComplete] - Optional callback fired when a per-hand
 *   prediction is produced. Receives `{ handNumber, street, heroCards, villainSeat,
 *   prediction, modelVersion }`. Reserved for PMC Phase 5b hand-end audit capture.
 *   Failures in this callback are logged and swallowed; the advisor flow continues.
 * @returns {{ advice: Object|null, isComputing: boolean }}
 */
export const useLiveActionAdvisor = (liveHandState, tendencyMap, options = {}) => {
  const { equityFn, onHandComplete, rakeConfig: rakeConfigOption = null } = options;
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

    // Rake: the resolved session config wins, with the hand-state field as a fallback for
    // payloads that carry one directly. A null here now means "no schedule for this game",
    // which `rakeResolver` reports with a reason rather than leaving as a silent zero.
    const rakeConfig = rakeConfigOption || liveHandState.rakeConfig || null;

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

      // WS-574 ── two-phase delivery ────────────────────────────────────────────────────
      // `evaluateGameTree` has handed back a depth-1 answer before refinement since WS-334,
      // and no production caller ever took it. That inert fast path is the reason
      // `refinementBudgetMs` sat at a table-latency floor of 2000, and at 2000 depth-2 never
      // once finished: mean runout coverage 0.380, with `depth3Barrel` (barrel planning) and
      // `checkRaiseDepth2` budget-gated on EVERY board measured. Taking the fast answer is
      // what buys refinement the clock it needs.
      //
      // Gating is shared by both phases so the provisional and refined recommendations are
      // filtered identically — a rec suppressed for thin data must not reappear on refine.
      const gateRecs = (res) => {
        const recs = res.recommendations || [];
        if (sampleSize === 0) {
          // No player data: tag all recs as population-based
          return recs.map(r => ({ ...r, reasoning: r.reasoning + ' [population estimate]' }));
        }
        if (sampleSize < 10) {
          // Suppress pure bluff recommendations (fold-equity-only raises with marginal EV)
          return recs.filter(r => !(r.action === 'raise' && r.sizing?.foldPct > 0.6 && r.ev < 2));
        }
        return recs;
      };

      // Captured at fast time so the refined delivery can say the recommendation CHANGED
      // rather than swapping silently. WS-496 measured depth-2 flipping the top action on
      // 35.3% of flops, so this is the common case, not an edge case. `assembleResult` sorts
      // both phases with the same comparator, so [0] is comparable across them.
      let fastTopAction = null;

      const onFastResult = (fast) => {
        // Same staleness guard the refined path uses. A fast result from a superseded
        // compute must never overwrite a newer one.
        if (!isCurrent(callId)) return;
        const fastRecs = gateRecs(fast);
        fastTopAction = fastRecs[0]?.action ?? null;
        setAdvice({
          handNumber: liveHandState?.handNumber ?? null,
          villainSeat: targetSeat,
          villainStyle: villainData.style || null,
          villainSampleSize: sampleSize,
          villainProfile: villainData.villainProfile || null,
          confidence,
          dataQuality,
          heroAlreadyActed,
          situation,
          situationLabel: SITUATION_LABELS[situation] || situation,
          heroEquity: fast.heroEquity,
          boardTexture: fast.boardTexture ? {
            texture: fast.boardTexture.texture,
            wetScore: fast.boardTexture.wetScore,
            isPaired: fast.boardTexture.isPaired,
            flushDraw: fast.boardTexture.flushDraw,
            monotone: fast.boardTexture.monotone,
          } : null,
          segmentation: fast.segmentation ? {
            buckets: fast.segmentation.buckets,
            handTypes: fast.segmentation.handTypes,
            isCapped: fast.segmentation.isCapped,
            totalCombos: fast.segmentation.totalCombos,
            totalWeight: fast.segmentation.totalWeight,
          } : null,
          foldPct: fast.foldPct,
          flopBreakdown: fast.flopBreakdown || null,
          foldMeta: fast.foldMeta || null,
          recommendations: fastRecs,
          currentStreet,
          potSize: adjustedPot,
          villainBet: villainBet || 0,
          playerStats,
          bucketEquities: fast.bucketEquities || null,
          modelQuality: fast.modelQuality || null,
          treeMetadata: fast.treeMetadata || null,
          // `villainRanges`, `multiwayEquity` and `narrowingLog` are DELIBERATELY ABSENT, not
          // null. They are computed after the game tree returns, so at fast time they do not
          // exist yet — and `validateActionAdvice` in the extension's wire schema checks with
          // `!== undefined`, so an explicit null FAILS validation while an absent key passes.
          // A hard-rejecting Ignition validator silently dropping HUD updates is a failure
          // this repo has already lived through once.
          timestamp: Date.now(),
          isProvisional: true,
          changedOnRefine: null,
        });
      };

      if (currentStreet === 'preflop') {
        result = await buildPreflopAdvice({
          liveHandState, heroSeat, targetSeat, dealerSeat,
          villainRange, encodedHero, adjustedPot,
          detectedSituation, playerStats, villainData, villainModel, rakeConfig,
          tendencyMap, equityFn,
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
          onFastResult,
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

      const gatedRecs = gateRecs(result);

      const assembledAdvice = {
        // WS-470 (FIND-131): the hand this advice was computed FOR, snapshotted from the
        // compute-time closure — never re-read at delivery. A compute that resolves after
        // the table advanced carries the OLD hand's number, so consumers (LiveAdviceBar
        // hand-mismatch gate, the extension's RT-45 stamp which prefers a payload-carried
        // handNumber over its receipt-time fallback) can refuse to render it as current.
        handNumber: liveHandState?.handNumber ?? null,
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
        // WS-574: this is the REFINED delivery. The provisional one above it (fired from
        // `onFastResult`) carries isProvisional: true and omits the three fields above.
        isProvisional: false,
        changedOnRefine: (fastTopAction
          && (gatedRecs[0]?.action ?? null)
          && fastTopAction !== (gatedRecs[0]?.action ?? null))
          ? fastTopAction
          : null,
      };

      // PMC Phase 5b hand-end integration point (SPR-080):
      // Optional callback fires when a per-hand prediction is produced.
      // Callback failures must NOT break advisor flow — wrap in try/catch.
      if (onHandComplete) {
        try {
          onHandComplete({
            handNumber: liveHandState?.handNumber ?? null,
            street: currentStreet,
            heroCards: encodedHero,
            villainSeat: targetSeat,
            prediction: assembledAdvice,
            modelVersion: result.modelVersion ?? null,
          });
        } catch (err) {
          logger.warn('LiveActionAdvisor', 'onHandComplete callback threw:', err?.message);
        }
      }

      setAdvice(assembledAdvice);
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
    // `rakeConfigOption` is in the deps because changing the rake changes every EV figure —
    // leaving it out would show stale advice after a session's stakes are healed from the
    // wire, which is exactly when the rake becomes known.
  }, [liveHandState, tendencyMap, rakeConfigOption]);

  useEffect(() => {
    compute();
    return () => { abort(); };
  }, [compute]);

  return { advice, isComputing };
};
