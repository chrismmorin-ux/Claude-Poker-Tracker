/**
 * useAssumptionPersistence.js - IDB sync for VillainAssumption state
 *
 * Responsibilities:
 *   1. On mount: hydrate reducer from IDB (load + bulk-dispatch ASSUMPTIONS_BULK_LOADED).
 *   2. On state.assumptions changes: debounced autosave to IDB.
 *   3. Migration: records loaded from IDB run through `migratePersistedAssumption`
 *      per I-AE-5 (schema version consistency).
 *
 * Mirrors the usePlayerPersistence + useSessionPersistence pattern. Lives inside
 * the AssumptionProvider so views don't wire IDB themselves.
 *
 * Test-friendly: accepts `{ enabled: false }` to skip IDB entirely.
 */

import { useEffect, useRef, useState } from 'react';
import {
  loadAllAssumptions,
  saveAssumptionBatch,
} from '../utils/persistence/assumptionStorage';
import { assumptionsBulkLoaded } from '../reducers/assumptionReducer';

const AUTOSAVE_DEBOUNCE_MS = 400;

/**
 * @param {Object} state - current reducer state
 * @param {Function} dispatch - reducer dispatch
 * @param {Object} [options]
 * @param {boolean} [options.enabled=true] - false skips all IDB interactions (for tests)
 * @returns {{ hydrated: boolean, persistenceError: Error|null, forceSave: Function }}
 */
export const useAssumptionPersistence = (state, dispatch, options = {}) => {
  const enabled = options.enabled !== false;
  const [hydrated, setHydrated] = useState(!enabled); // treat disabled as immediately "hydrated"
  const [persistenceError, setPersistenceError] = useState(null);
  const debounceTimerRef = useRef(null);
  const mountedRef = useRef(true);

  // On mount: hydrate from IDB.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      try {
        const records = await loadAllAssumptions();
        if (cancelled || !mountedRef.current) return;
        if (records.length > 0) {
          dispatch(assumptionsBulkLoaded(records));
        }
        setHydrated(true);
      } catch (err) {
        if (cancelled || !mountedRef.current) return;
        setPersistenceError(err);
        setHydrated(true); // don't block the UI on load failure
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, dispatch]);

  // On assumption change: debounced autosave.
  useEffect(() => {
    if (!enabled || !hydrated) return;
    if (!state.assumptions || Object.keys(state.assumptions).length === 0) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const records = Object.values(state.assumptions);
        await saveAssumptionBatch(records);
      } catch (err) {
        if (mountedRef.current) setPersistenceError(err);
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [state.assumptions, enabled, hydrated]);

  // Unmount guard
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const forceSave = async () => {
    if (!enabled) return;
    const records = Object.values(state.assumptions || {});
    if (records.length === 0) return;
    try {
      await saveAssumptionBatch(records);
    } catch (err) {
      if (mountedRef.current) setPersistenceError(err);
      throw err;
    }
  };

  return { hydrated, persistenceError, forceSave };
};
