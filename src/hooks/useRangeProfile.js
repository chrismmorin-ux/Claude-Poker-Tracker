/**
 * useRangeProfile.js - React hook for Bayesian range profiles
 *
 * Lazy-loads hand history, builds/caches range profiles per player.
 * Follows usePlayerTendencies.js pattern.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAllHands, getRangeProfile, saveRangeProfile, GUEST_USER_ID } from '../utils/persistence';
import { buildRangeProfile, getRangeWidthSummary } from '../utils/rangeEngine';

/**
 * @param {number|string|null} playerId - Player ID to analyze (null = no player)
 * @param {string} userId - User ID for data isolation
 * @returns {{ rangeProfile: Object|null, rangeSummary: Object|null, isLoading: boolean, refresh: Function }}
 */
export const useRangeProfile = (playerId, userId = GUEST_USER_ID) => {
  const [rangeProfile, setRangeProfile] = useState(null);
  const [rangeSummary, setRangeSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const lastHandCountRef = useRef(-1);
  const lastPlayerIdRef = useRef(null);

  const calculate = useCallback(async () => {
    if (!playerId) {
      setRangeProfile(null);
      setRangeSummary(null);
      lastHandCountRef.current = -1;
      lastPlayerIdRef.current = null;
      return;
    }

    setIsLoading(true);
    try {
      const hands = await getAllHands(userId) || [];

      // Reset cache if player changed
      if (lastPlayerIdRef.current !== playerId) {
        lastHandCountRef.current = -1;
        lastPlayerIdRef.current = playerId;
      }

      // Skip if hand count hasn't changed
      if (hands.length === lastHandCountRef.current) {
        setIsLoading(false);
        return;
      }

      // Check for cached profile
      const cached = await getRangeProfile(playerId, userId);
      if (cached && cached.handsProcessed === hands.length) {
        setRangeProfile(cached);
        setRangeSummary(getRangeWidthSummary(cached));
        lastHandCountRef.current = hands.length;
        setIsLoading(false);
        return;
      }

      // Build fresh profile
      const profile = buildRangeProfile(playerId, hands, userId);
      await saveRangeProfile(profile, userId);

      setRangeProfile(profile);
      setRangeSummary(getRangeWidthSummary(profile));
      lastHandCountRef.current = hands.length;
    } catch (error) {
      console.error('useRangeProfile: calculation failed', error);
    } finally {
      setIsLoading(false);
    }
  }, [playerId, userId]);

  useEffect(() => {
    calculate();
  }, [calculate]);

  return { rangeProfile, rangeSummary, isLoading, refresh: calculate };
};
