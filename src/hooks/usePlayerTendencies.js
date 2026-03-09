/**
 * usePlayerTendencies.js - Calculate player tendency stats from hand history
 *
 * Lazy-loads hand history and computes stats per player.
 * Returns a map of playerId -> derived percentages.
 * Cached: only recalculates when hand count changes.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAllHands, getRangeProfile, saveRangeProfile, GUEST_USER_ID } from '../utils/persistence/index';
import { buildPlayerStats, derivePercentages, classifyStyle } from '../utils/tendencyCalculations';
import { buildPositionStats } from '../utils/exploitEngine/positionStats';
import { countLimps } from '../utils/sessionStats';
import { buildRangeProfile, getRangeWidthSummary, getSubActionSummary, PROFILE_VERSION } from '../utils/rangeEngine';
import { generateExploits } from '../utils/exploitEngine/generateExploits';
import { buildBriefings } from '../utils/exploitEngine/briefingBuilder';
import { evaluateStaleness } from '../utils/exploitEngine/reEvaluationEngine';
import { accumulateDecisions } from '../utils/exploitEngine/decisionAccumulator';
import { detectWeaknesses } from '../utils/exploitEngine/weaknessDetector';
import { getAllPlayers as getAllPlayersFromDB, updatePlayer } from '../utils/persistence/playersStorage';

/**
 * @param {Array} allPlayers - Player list from playerState
 * @param {string} userId - User ID for hand history isolation
 * @returns {{ tendencyMap: Object, isLoading: boolean, refresh: Function }}
 *   tendencyMap: { [playerId]: { vpip, pfr, af, threeBet, cbet, sampleSize, style } }
 */
export const usePlayerTendencies = (allPlayers, userId = GUEST_USER_ID) => {
  const [tendencyMap, setTendencyMap] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const lastHandCountRef = useRef(-1);

  const calculate = useCallback(async () => {
    if (!allPlayers || allPlayers.length === 0) {
      setTendencyMap({});
      return;
    }

    setIsLoading(true);
    try {
      const hands = await getAllHands(userId);

      // Skip recalculation if hand count hasn't changed
      if (hands.length === lastHandCountRef.current) {
        setIsLoading(false);
        return;
      }
      lastHandCountRef.current = hands.length;

      // Batch-load all player records from DB (single transaction for briefing data)
      const dbPlayers = await getAllPlayersFromDB(userId);
      const dbPlayerMap = new Map(dbPlayers.map(p => [p.playerId, p]));

      const entries = await Promise.all(allPlayers.map(async (player) => {
        const rawStats = buildPlayerStats(player.playerId, hands);
        const pct = derivePercentages(rawStats);
        const positionStats = buildPositionStats(player.playerId, hands);
        const limpData = countLimps(player.playerId, hands);

        // Build/cache range profile
        let rangeProfile = null;
        let rangeSummary = null;
        let subActionSummary = null;
        try {
          const cached = await getRangeProfile(player.playerId, userId);
          if (cached && cached.handsProcessed === hands.length && cached.profileVersion === PROFILE_VERSION) {
            rangeProfile = cached;
          } else {
            rangeProfile = buildRangeProfile(player.playerId, hands, userId);
            await saveRangeProfile(rangeProfile, userId);
          }
          rangeSummary = getRangeWidthSummary(rangeProfile);
          subActionSummary = getSubActionSummary(rangeProfile);
        } catch (e) {
          // Range profile is non-critical
        }

        // Accumulate situational decisions and detect weaknesses FIRST
        // (weaknesses feed into exploit generation as an 8th rule source)
        let decisionSummary = null;
        let weaknesses = [];
        try {
          if (rangeProfile) {
            decisionSummary = accumulateDecisions(player.playerId, hands, rangeProfile, userId);
          }
          weaknesses = detectWeaknesses({
            decisionSummary,
            percentages: pct,
            rangeProfile,
            rangeSummary,
            subActionSummary,
            traits: rangeProfile?.traits || null,
            pips: rangeProfile?.pips || null,
            positionStats,
          });
        } catch (e) {
          // Weakness detection is non-critical
        }

        // Generate scored exploits (NOT dismiss-filtered — that's a UI concern)
        const exploits = generateExploits({
          rawStats, percentages: pct, positionStats, limpData,
          rangeProfile, rangeSummary, subActionSummary,
          traits: rangeProfile?.traits || null,
          pips: rangeProfile?.pips || null,
          weaknesses,
        });

        // Build exploit briefings
        let briefings = [];
        try {
          const briefingContext = {
            rawStats, percentages: pct, rangeSummary, rangeProfile,
            traits: rangeProfile?.traits || null,
            handsProcessed: hands.length,
            weaknesses,
          };
          const newBriefings = buildBriefings(exploits, briefingContext);

          // Load existing briefings from batch-loaded player record
          const dbPlayer = dbPlayerMap.get(player.playerId);
          const existingBriefings = dbPlayer?.exploitBriefings || [];
          const dismissedIds = new Set(dbPlayer?.dismissedBriefingIds || []);

          // Evaluate staleness of existing accepted/deferred briefings
          const { staleIds } = evaluateStaleness(existingBriefings, exploits, {
            handsProcessed: hands.length,
            traits: rangeProfile?.traits || null,
          });

          // Mark stale briefings (staleIds is plain object { briefingId: reason })
          const updatedExisting = existingBriefings.map(b => {
            if (staleIds[b.briefingId]) {
              return { ...b, reviewStatus: 'stale', staleReason: staleIds[b.briefingId] };
            }
            return b;
          });

          // Merge: keep accepted/deferred/stale, add new pending for rules not already covered
          const existingRuleIds = new Set(
            updatedExisting
              .filter(b => b.reviewStatus !== 'dismissed')
              .map(b => b.ruleId)
          );
          const freshPending = newBriefings.filter(b =>
            !existingRuleIds.has(b.ruleId) && !dismissedIds.has(b.ruleId)
          );
          briefings = [...updatedExisting.filter(b => b.reviewStatus !== 'dismissed'), ...freshPending];

          // Persist updated briefings
          await updatePlayer(player.playerId, { exploitBriefings: briefings }, userId);
        } catch (e) {
          // Briefing generation is non-critical
        }

        return [player.playerId, {
          ...pct,
          rawStats,
          positionStats,
          limpData,
          style: classifyStyle(pct),
          exploits,
          briefings,
          rangeProfile,
          rangeSummary,
          subActionSummary,
          decisionSummary,
          weaknesses,
        }];
      }));

      setTendencyMap(Object.fromEntries(entries));
    } catch (error) {
      // Fail silently — stats are non-critical
      console.error('usePlayerTendencies: calculation failed', error);
    } finally {
      setIsLoading(false);
    }
  }, [allPlayers, userId]);

  // Calculate on mount and when players change
  useEffect(() => {
    calculate();
  }, [calculate]);

  return { tendencyMap, setTendencyMap, isLoading, refresh: calculate };
};
