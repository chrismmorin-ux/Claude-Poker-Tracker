/**
 * useSessionStats.js - Hook for session-scoped per-seat stats
 *
 * Loads hands for the current session and computes stats per seat.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getHandsBySessionId } from '../utils/persistence/index';
import { buildSessionStats } from '../utils/sessionStats';

/**
 * @param {string|number|null} sessionId - Current session ID
 * @param {Object} seatPlayers - { [seat]: playerId } map
 * @returns {{ seatStats: Object, isLoading: boolean }}
 *   seatStats: { [seat]: { vpip, pfr, af, threeBet, cbet, sampleSize, style, limpPct, handCount } }
 */
export const useSessionStats = (sessionId, seatPlayers) => {
  const [seatStats, setSeatStats] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const lastHandCountRef = useRef(-1);

  const calculate = useCallback(async () => {
    if (!sessionId) {
      setSeatStats({});
      return;
    }

    setIsLoading(true);
    try {
      const hands = await getHandsBySessionId(sessionId);

      if (hands.length === lastHandCountRef.current) {
        setIsLoading(false);
        return;
      }
      lastHandCountRef.current = hands.length;

      const stats = buildSessionStats(hands, seatPlayers);
      setSeatStats(stats);
    } catch (error) {
      console.error('useSessionStats: calculation failed', error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, seatPlayers]);

  useEffect(() => {
    calculate();
  }, [calculate]);

  return { seatStats, isLoading };
};
