/**
 * usePreflopDrillsPersistence.js — React hook wrapping preflopDrillsStorage.
 *
 * Loads existing drill attempts on mount, exposes a save function that appends
 * a new attempt, and derives per-framework accuracy in memory for the
 * weak-framework scheduler.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  savePreflopDrill,
  loadPreflopDrills,
  clearPreflopDrills,
  aggregateFrameworkAccuracy,
  GUEST_USER_ID,
  createPersistenceLogger,
} from '../utils/persistence/index';

const { log, logError } = createPersistenceLogger('usePreflopDrillsPersistence');

export const usePreflopDrillsPersistence = (userId = GUEST_USER_ID) => {
  const [isReady, setIsReady] = useState(false);
  const [drills, setDrills] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const all = await loadPreflopDrills(userId);
        if (!cancelled) {
          setDrills(all);
          setIsReady(true);
          log(`Loaded ${all.length} preflop drill attempts`);
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
      const id = await savePreflopDrill(attempt, userId);
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
      await clearPreflopDrills(userId);
      setDrills([]);
    } catch (err) {
      logError('resetHistory failed:', err);
      throw err;
    }
  }, [userId]);

  const frameworkAccuracy = aggregateFrameworkAccuracy(drills);

  return {
    isReady,
    drills,
    recordAttempt,
    resetHistory,
    frameworkAccuracy,
  };
};
