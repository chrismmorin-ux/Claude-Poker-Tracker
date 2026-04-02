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
import { logger, AppError, ERROR_CODES } from '../utils/errorHandler';
import { getAllHands, getHandCount, getRangeProfile, saveRangeProfile, GUEST_USER_ID } from '../utils/persistence/index';
import { PROFILE_VERSION } from '../utils/rangeEngine';
import { mergeBriefings } from '../utils/exploitEngine/briefingMerge';
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
        try {
          // Try to use cached range profile
          let cachedRangeProfile = null;
          try {
            const cached = await getRangeProfile(player.playerId, userId);
            if (cached && cached.handsProcessed === hands.length && cached.profileVersion === PROFILE_VERSION) {
              cachedRangeProfile = cached;
            }
          } catch (e) {
            logger.warn('PlayerTendencies', 'range profile cache read failed', { playerId: player.playerId, error: e.message });
          }

          const result = runAnalysisPipeline(player.playerId, hands, userId, cachedRangeProfile);

          // Cache range profile if it was freshly built
          if (result.rangeProfile && !cachedRangeProfile) {
            try {
              await saveRangeProfile(result.rangeProfile, userId);
            } catch (e) {
              logger.warn('PlayerTendencies', 'range profile save failed', { playerId: player.playerId, error: e.message });
            }
          }

          // Merge briefings with existing persisted briefings
          let briefings = result.briefings;
          try {
            const dbPlayer = dbPlayerMap.get(player.playerId);
            const existingBriefings = dbPlayer?.exploitBriefings || [];
            const dismissedIds = new Set(dbPlayer?.dismissedBriefingIds || []);

            briefings = mergeBriefings(existingBriefings, result.briefings, dismissedIds, result.exploits, {
              handsProcessed: hands.length,
              traits: result.rangeProfile?.traits || null,
            });

            // Persist updated briefings
            await updatePlayer(player.playerId, { exploitBriefings: briefings }, userId);
          } catch (e) {
            logger.warn('PlayerTendencies', 'briefing persistence failed', { playerId: player.playerId, handsProcessed: hands.length, error: e.message });
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
            villainModel: result.villainModel,
            villainProfile: result.villainProfile,
            weaknesses: result.weaknesses,
            observations: result.observations,
            thoughtAnalysis: result.thoughtAnalysis,
          }];
        } catch (e) {
          logger.error('PlayerTendencies', new AppError(
            ERROR_CODES.HOOK_FAILED,
            `Tendency calculation failed for player ${player.playerId}`,
            { playerId: player.playerId, handsAvailable: hands.length, error: e.message }
          ));
          return null;
        }
      }));

      setTendencyMap(Object.fromEntries(entries.filter(Boolean)));
    } catch (error) {
      logger.error('PlayerTendencies', new AppError(
        ERROR_CODES.HOOK_FAILED,
        'Tendency batch calculation failed',
        { playerCount: allPlayers.length, error: error.message }
      ));
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
