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

        // Generate scored exploits (NOT dismiss-filtered — that's a UI concern)
        const exploits = generateExploits({
          rawStats, percentages: pct, positionStats, limpData,
          rangeProfile, rangeSummary, subActionSummary,
          traits: rangeProfile?.traits || null,
          pips: rangeProfile?.pips || null,
        });

        return [player.playerId, {
          ...pct,
          rawStats,
          positionStats,
          limpData,
          style: classifyStyle(pct),
          exploits,
          rangeProfile,
          rangeSummary,
          subActionSummary,
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

  return { tendencyMap, isLoading, refresh: calculate };
};
