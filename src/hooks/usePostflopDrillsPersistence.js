/**
 * usePostflopDrillsPersistence.js — React hook wrapping postflopDrillsStorage.
 *
 * Mirrors usePreflopDrillsPersistence: loads drill attempts on mount, exposes
 * a save function, and derives per-framework accuracy for the scheduler's
 * weak-framework weighting.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  savePostflopDrill,
  loadPostflopDrills,
  clearPostflopDrills,
  aggregatePostflopFrameworkAccuracy,
  GUEST_USER_ID,
  createPersistenceLogger,
} from '../utils/persistence/index';

const { log, logError } = createPersistenceLogger('usePostflopDrillsPersistence');

export const usePostflopDrillsPersistence = (userId = GUEST_USER_ID) => {
  const [isReady, setIsReady] = useState(false);
  const [drills, setDrills] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const all = await loadPostflopDrills(userId);
        if (!cancelled) {
          setDrills(all);
          setIsReady(true);
          log(`Loaded ${all.length} postflop drill attempts`);
        }
      } catch (err) {
        logError('Init failed:', err);
        if (!cancelled) setIsReady(true);
      }
    };
    init();
    return () => { cancelled = true; };
  }, [userId]);

  const recordAttempt = useCallback(async (attempt) => {
    try {
      const id = await savePostflopDrill(attempt, userId);
      const full = { ...attempt, drillId: id, userId, timestamp: Date.now() };
      setDrills((prev) => [full, ...prev]);
      return id;
    } catch (err) {
      logError('recordAttempt failed:', err);
      throw err;
    }
  }, [userId]);

  const resetHistory = useCallback(async () => {
    try {
      await clearPostflopDrills(userId);
      setDrills([]);
    } catch (err) {
      logError('resetHistory failed:', err);
      throw err;
    }
  }, [userId]);

  const frameworkAccuracy = aggregatePostflopFrameworkAccuracy(drills);

  return {
    isReady,
    drills,
    recordAttempt,
    resetHistory,
    frameworkAccuracy,
  };
};
