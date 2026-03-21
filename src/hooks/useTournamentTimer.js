/**
 * useTournamentTimer.js - Tournament blind level timer
 *
 * Uses Date.now() deltas (not accumulated ticks) to avoid mobile drift.
 * Auto-dispatches ADVANCE_BLIND_LEVEL when level expires.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * @param {Object} params
 * @param {number} params.levelStartTime - Timestamp when current level started
 * @param {number} params.levelDurationMs - Duration of current level in ms
 * @param {boolean} params.isPaused - Whether timer is paused
 * @param {number} params.totalPausedMs - Total ms paused during this level
 * @param {number} params.pauseStartTime - When current pause started (null if not paused)
 * @param {Function} params.onLevelExpire - Callback when level time runs out
 * @returns {{ levelTimeRemaining: number, levelElapsed: number, totalElapsed: number, isRunning: boolean }}
 */
export const useTournamentTimer = ({
  levelStartTime,
  levelDurationMs,
  isPaused,
  totalPausedMs,
  pauseStartTime,
  onLevelExpire,
}) => {
  const [now, setNow] = useState(Date.now());
  const hasExpiredRef = useRef(false);

  // Reset expiry flag when level changes
  useEffect(() => {
    hasExpiredRef.current = false;
  }, [levelStartTime]);

  // Tick every second when running
  useEffect(() => {
    if (!levelStartTime || isPaused) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [levelStartTime, isPaused]);

  // Compute times using Date.now() deltas
  const currentPausedMs = isPaused && pauseStartTime
    ? (now - pauseStartTime)
    : 0;
  const effectivePausedMs = totalPausedMs + currentPausedMs;

  const levelElapsed = levelStartTime
    ? Math.max(0, now - levelStartTime - effectivePausedMs)
    : 0;

  const levelTimeRemaining = levelDurationMs
    ? Math.max(0, levelDurationMs - levelElapsed)
    : 0;

  const totalElapsed = levelStartTime
    ? Math.max(0, now - levelStartTime)
    : 0;

  // Auto-advance when level expires
  useEffect(() => {
    if (levelTimeRemaining <= 0 && levelStartTime && !isPaused && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      onLevelExpire?.();
    }
  }, [levelTimeRemaining, levelStartTime, isPaused, onLevelExpire]);

  return {
    levelTimeRemaining,
    levelElapsed,
    totalElapsed,
    isRunning: !!levelStartTime && !isPaused,
  };
};
