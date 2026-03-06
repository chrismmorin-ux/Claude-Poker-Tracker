/**
 * usePlayerTendencies.js - Calculate player tendency stats from hand history
 *
 * Lazy-loads hand history and computes stats per player.
 * Returns a map of playerId -> derived percentages.
 * Cached: only recalculates when hand count changes.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAllHands, getRangeProfile, saveRangeProfile, GUEST_USER_ID } from '../utils/persistence/index';
import { buildPlayerStats, derivePercentages } from '../utils/tendencyCalculations';
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

      const map = {};
      for (const player of allPlayers) {
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

        map[player.playerId] = {
          ...pct,
          rawStats,
          positionStats,
          limpData,
          style: classifyStyle(pct),
          exploits,
          rangeProfile,
          rangeSummary,
          subActionSummary,
        };
      }

      setTendencyMap(map);
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

// =============================================================================
// STYLE CLASSIFICATION
// =============================================================================

const MIN_STYLE_SAMPLE = 20;

/**
 * Classify player style from derived percentages.
 * @param {{ vpip: number|null, pfr: number|null, af: number|null, sampleSize: number }} pct
 * @returns {string|null} Style label or null if insufficient data
 */
export const classifyStyle = (pct) => {
  if (!pct || pct.sampleSize < MIN_STYLE_SAMPLE) return null;

  const { vpip, pfr, af } = pct;
  if (vpip === null || pfr === null) return null;

  // Order matters: most specific first
  if (vpip > 40) return 'Fish';
  if (vpip > 30 && pfr > 20) return 'LAG';
  if (vpip > 30 && pfr < 10) return 'LP';
  if (vpip < 15 && pfr < 10) return 'Nit';
  if (vpip >= 20 && vpip <= 30 && pfr >= 15 && pfr <= 25 && af !== null && af > 1.5) return 'Reg';
  if (vpip >= 15 && vpip <= 30 && pfr >= 10 && pfr <= 25) return 'TAG';

  return 'Unknown';
};
