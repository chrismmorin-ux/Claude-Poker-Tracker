/**
 * useRangeProfile.js - React hook for Bayesian range profiles
 *
 * Lazy-loads hand history, builds/caches range profiles per player.
 * Follows usePlayerTendencies.js pattern.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAllHands, getRangeProfile, saveRangeProfile, GUEST_USER_ID } from '../utils/persistence/index';
import { buildRangeProfile, getRangeWidthSummary, PROFILE_VERSION } from '../utils/rangeEngine';

/**
 * @param {number|string|null} playerId - Player ID to analyze (null = no player)
 * @param {string} userId - User ID for data isolation
 * @returns {{ rangeProfile: Object|null, rangeSummary: Object|null, isLoading: boolean, refresh: Function }}
 */
export const useRangeProfile = (playerId, userId = GUEST_USER_ID) => {
  const [rangeProfile, setRangeProfile] = useState(null);
  const [rangeSummary, setRangeSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const lastPlayerIdRef = useRef(null);
  const lastHandCountRef = useRef(-1);

  const calculate = useCallback(async () => {
    if (!playerId) {
      setRangeProfile(null);
      setRangeSummary(null);
      lastPlayerIdRef.current = null;
      lastHandCountRef.current = -1;
      return;
    }

    // Reset cache tracking if player changed
    if (lastPlayerIdRef.current !== playerId) {
      lastHandCountRef.current = -1;
      lastPlayerIdRef.current = playerId;
    }

    setIsLoading(true);
    try {
      // Check DB cache first — avoids expensive getAllHands() when
      // usePlayerTendencies has already built and saved the profile
      const cached = await getRangeProfile(playerId, userId);
      if (cached && cached.profileVersion === PROFILE_VERSION) {
        // Cache is valid version; check if hand count changed
        if (cached.handsProcessed === lastHandCountRef.current) {
          // Same as what we already have — skip
          setIsLoading(false);
          return;
        }

        // Accept cache if we don't know the current hand count yet,
        // or if the cache was built by usePlayerTendencies this cycle
        const hands = await getAllHands(userId) || [];
        if (cached.handsProcessed === hands.length) {
          setRangeProfile(cached);
          setRangeSummary(getRangeWidthSummary(cached));
          lastHandCountRef.current = hands.length;
          setIsLoading(false);
          return;
        }

        // Cache is stale — rebuild with already-loaded hands
        const profile = buildRangeProfile(playerId, hands, userId);
        await saveRangeProfile(profile, userId);
        setRangeProfile(profile);
        setRangeSummary(getRangeWidthSummary(profile));
        lastHandCountRef.current = hands.length;
        return;
      }

      // No valid cache — load hands and build
      const hands = await getAllHands(userId) || [];

      if (hands.length === lastHandCountRef.current) {
        setIsLoading(false);
        return;
      }

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
