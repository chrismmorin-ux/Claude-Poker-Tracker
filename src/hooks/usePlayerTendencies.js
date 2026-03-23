/**
 * usePlayerTendencies.js - Calculate player tendency stats from hand history
 *
 * Lazy-loads hand history and computes stats per player.
 * Returns a map of playerId -> derived percentages.
 * Cached: only recalculates when hand count changes.
 *
 * Uses the shared analysis pipeline with added caching (range profiles in
 * IndexedDB) and persistence (briefings saved to player records).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAllHands, getHandCount, getRangeProfile, saveRangeProfile, GUEST_USER_ID } from '../utils/persistence/index';
import { PROFILE_VERSION } from '../utils/rangeEngine';
import { evaluateStaleness } from '../utils/exploitEngine/reEvaluationEngine';
import { getAllPlayers as getAllPlayersFromDB, updatePlayer } from '../utils/persistence/playersStorage';
import { runAnalysisPipeline } from '../utils/analysisPipeline';

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
      // O(1) count check — skip expensive getAllHands if nothing changed
      const count = await getHandCount(userId);
      if (count === lastHandCountRef.current) {
        setIsLoading(false);
        return;
      }

      const hands = await getAllHands(userId);
      lastHandCountRef.current = hands.length;

      // Batch-load all player records from DB (single transaction for briefing data)
      const dbPlayers = await getAllPlayersFromDB(userId);
      const dbPlayerMap = new Map(dbPlayers.map(p => [p.playerId, p]));

      const entries = await Promise.all(allPlayers.map(async (player) => {
        // Try to use cached range profile
        let cachedRangeProfile = null;
        try {
          const cached = await getRangeProfile(player.playerId, userId);
          if (cached && cached.handsProcessed === hands.length && cached.profileVersion === PROFILE_VERSION) {
            cachedRangeProfile = cached;
          }
        } catch (_) {
          // Cache miss is fine
        }

        const result = runAnalysisPipeline(player.playerId, hands, userId, cachedRangeProfile);

        // Cache range profile if it was freshly built
        if (result.rangeProfile && !cachedRangeProfile) {
          try {
            await saveRangeProfile(result.rangeProfile, userId);
          } catch (_) {
            // Non-critical
          }
        }

        // Merge briefings with existing persisted briefings
        let briefings = result.briefings;
        try {
          const dbPlayer = dbPlayerMap.get(player.playerId);
          const existingBriefings = dbPlayer?.exploitBriefings || [];
          const dismissedIds = new Set(dbPlayer?.dismissedBriefingIds || []);

          // Evaluate staleness of existing accepted/deferred briefings
          const { staleIds } = evaluateStaleness(existingBriefings, result.exploits, {
            handsProcessed: hands.length,
            traits: result.rangeProfile?.traits || null,
          });

          // Mark stale briefings
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
          const freshPending = result.briefings.filter(b =>
            !existingRuleIds.has(b.ruleId) && !dismissedIds.has(b.ruleId)
          );
          briefings = [...updatedExisting.filter(b => b.reviewStatus !== 'dismissed'), ...freshPending];

          // Persist updated briefings
          await updatePlayer(player.playerId, { exploitBriefings: briefings }, userId);
        } catch (_) {
          // Briefing persistence is non-critical
        }

        return [player.playerId, {
          ...result.pct,
          rawStats: result.rawStats,
          positionStats: result.positionStats,
          limpData: result.limpData,
          style: result.style,
          exploits: result.exploits,
          briefings,
          rangeProfile: result.rangeProfile,
          rangeSummary: result.rangeSummary,
          subActionSummary: result.subActionSummary,
          decisionSummary: result.decisionSummary,
          weaknesses: result.weaknesses,
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
