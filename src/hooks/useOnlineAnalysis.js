/**
 * useOnlineAnalysis.js — Per-table exploit pipeline for online play
 *
 * Loads hands for a specific online session, builds pseudo-players from
 * seat numbers, and runs the full analysis pipeline:
 * stats → range profile → weaknesses → exploits → briefings
 *
 * Reuses all existing pure functions from the live play pipeline.
 * Key differences from usePlayerTendencies:
 * - Players are ephemeral (seat numbers, not persistent player records)
 * - Range profiles are NOT cached to IndexedDB
 * - Briefings are NOT persisted (no player records to save to)
 * - Scoped to a single session, not all hands
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getHandsBySessionId, GUEST_USER_ID } from '../utils/persistence/index';
import { buildPlayerStats, derivePercentages, classifyStyle } from '../utils/tendencyCalculations';
import { buildPositionStats } from '../utils/exploitEngine/positionStats';
import { countLimps } from '../utils/sessionStats';
import { buildRangeProfile, getRangeWidthSummary, getSubActionSummary } from '../utils/rangeEngine';
import { generateExploits } from '../utils/exploitEngine/generateExploits';
import { buildBriefings } from '../utils/exploitEngine/briefingBuilder';
import { accumulateDecisions } from '../utils/exploitEngine/decisionAccumulator';
import { detectWeaknesses } from '../utils/exploitEngine/weaknessDetector';

/**
 * @param {number|null} sessionId - Online session ID
 * @param {string} userId - User ID
 * @returns {{ tendencyMap, handCount, isLoading, refresh }}
 */
const useOnlineAnalysis = (sessionId, userId = GUEST_USER_ID) => {
  const [tendencyMap, setTendencyMap] = useState({});
  const [handCount, setHandCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const lastHandCountRef = useRef(-1);

  const calculate = useCallback(async () => {
    if (!sessionId) {
      setTendencyMap({});
      setHandCount(0);
      return;
    }

    try {
      const hands = await getHandsBySessionId(sessionId);
      if (!hands || hands.length === 0) {
        setTendencyMap({});
        setHandCount(0);
        lastHandCountRef.current = 0;
        return;
      }

      // Skip if hand count hasn't changed
      if (hands.length === lastHandCountRef.current) {
        return;
      }

      setIsLoading(true);
      lastHandCountRef.current = hands.length;
      setHandCount(hands.length);

      // Build pseudo-player list from all seatPlayers across hands
      const seatsSeen = new Set();
      for (const hand of hands) {
        if (hand.seatPlayers) {
          for (const seat of Object.keys(hand.seatPlayers)) {
            seatsSeen.add(seat);
          }
        }
      }

      const map = {};

      for (const seatStr of seatsSeen) {
        const playerId = `seat_${seatStr}`;

        try {
          const rawStats = buildPlayerStats(playerId, hands);
          const pct = derivePercentages(rawStats);
          const style = classifyStyle(pct);
          const positionStats = buildPositionStats(playerId, hands);
          const limpData = countLimps(playerId, hands);

          // Build range profile (ephemeral, not cached)
          let rangeProfile = null;
          let rangeSummary = null;
          let subActionSummary = null;
          try {
            rangeProfile = buildRangeProfile(playerId, hands, userId);
            rangeSummary = getRangeWidthSummary(rangeProfile);
            subActionSummary = getSubActionSummary(rangeProfile);
          } catch (_) {
            // Range profile is non-critical
          }

          // Weaknesses
          let decisionSummary = null;
          let weaknesses = [];
          try {
            if (rangeProfile) {
              decisionSummary = accumulateDecisions(playerId, hands, rangeProfile, userId);
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
          } catch (_) {
            // Weakness detection is non-critical
          }

          // Exploits
          const exploits = generateExploits({
            rawStats, percentages: pct, positionStats, limpData,
            rangeProfile, rangeSummary, subActionSummary,
            traits: rangeProfile?.traits || null,
            pips: rangeProfile?.pips || null,
            weaknesses,
          });

          // Briefings (ephemeral, not persisted)
          let briefings = [];
          try {
            const briefingContext = {
              rawStats, percentages: pct, rangeSummary, rangeProfile,
              traits: rangeProfile?.traits || null,
              handsProcessed: hands.length,
              weaknesses,
            };
            briefings = buildBriefings(exploits, briefingContext);
          } catch (_) {
            // Briefing generation is non-critical
          }

          map[seatStr] = {
            playerId,
            name: `Seat ${seatStr}`,
            ...pct,
            style,
            rawStats,
            positionStats,
            exploits,
            briefings,
            weaknesses,
            rangeProfile,
            rangeSummary,
          };
        } catch (e) {
          // Skip this seat on error, don't break the whole analysis
          map[seatStr] = {
            playerId,
            name: `Seat ${seatStr}`,
            vpip: null, pfr: null, af: null, sampleSize: 0,
            style: null, exploits: [], briefings: [], weaknesses: [],
          };
        }
      }

      setTendencyMap(map);
    } catch (e) {
      console.error('[OnlineAnalysis] Pipeline error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, userId]);

  // Recalculate on mount and when refresh is called
  useEffect(() => {
    calculate();
  }, [calculate]);

  // Auto-refresh every 5 seconds (hands may arrive from sync bridge)
  useEffect(() => {
    const interval = setInterval(calculate, 5000);
    return () => clearInterval(interval);
  }, [calculate]);

  return {
    tendencyMap,
    handCount,
    isLoading,
    refresh: calculate,
  };
};

export default useOnlineAnalysis;
