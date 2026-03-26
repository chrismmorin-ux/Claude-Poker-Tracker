/**
 * useOnlineAnalysis.js — Per-table exploit pipeline for online play
 *
 * Loads hands for a specific online session, builds pseudo-players from
 * seat numbers, and runs the full analysis pipeline.
 *
 * Key differences from usePlayerTendencies:
 * - Players are ephemeral (seat numbers, not persistent player records)
 * - Range profiles are NOT cached to IndexedDB
 * - Briefings are NOT persisted (no player records to save to)
 * - Scoped to a single session, not all hands
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getHandsBySessionId, GUEST_USER_ID } from '../utils/persistence/index';
import { runAnalysisPipeline } from '../utils/analysisPipeline';

/**
 * @param {number|null} sessionId - Online session ID
 * @param {string} userId - User ID
 * @returns {{ tendencyMap, handCount, isLoading, refresh }}
 */
export const useOnlineAnalysis = (sessionId, userId = GUEST_USER_ID) => {
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
          const result = runAnalysisPipeline(playerId, hands, userId);

          map[seatStr] = {
            playerId,
            name: `Seat ${seatStr}`,
            ...result.pct,
            style: result.style,
            rawStats: result.rawStats,
            positionStats: result.positionStats,
            limpData: result.limpData,
            exploits: result.exploits,
            briefings: result.briefings,
            weaknesses: result.weaknesses,
            rangeProfile: result.rangeProfile,
            rangeSummary: result.rangeSummary,
            subActionSummary: result.subActionSummary,
            decisionSummary: result.decisionSummary,
            villainModel: result.villainModel,
            villainProfile: result.villainProfile,
            observations: result.observations,
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

