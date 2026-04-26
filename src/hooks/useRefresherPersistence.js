/**
 * useRefresherPersistence.js — IDB hydration for the Printable Refresher.
 *
 * Hydrate-only. Writers (`src/utils/printableRefresher/writers.js`) own IDB
 * writes — this hook does NOT write. Differs from EAL's
 * `useAnchorLibraryPersistence` which does per-slice diff-write because EAL
 * doesn't have a writer-validation layer. PRF's writers.js validates field-
 * ownership + Phase-1 constraints before each write; bypassing that with a
 * raw persistence-hook write would defeat the validation.
 *
 * Hydration strategy:
 *   - `Promise.all` over `getRefresherConfig` + `getAllPrintBatches` (parallel
 *     reads across 2 stores; safe because they're independent).
 *   - Single `REFRESHER_HYDRATED` dispatch with full payload.
 *   - Hydration failure path still sets `isReady: true` with default state —
 *     app remains usable (mirrors EAL/MPMF precedent).
 *
 * PRF Phase 5 — Session 14 (PRF-G5-HK).
 */

import { useEffect, useState } from 'react';
import {
  getRefresherConfig,
  getAllPrintBatches,
} from '../utils/persistence/refresherStore';
import { REFRESHER_ACTIONS } from '../constants/refresherConstants';

/**
 * useRefresherPersistence — hydrates state on mount.
 *
 * @param {Function} dispatch - Dispatcher for refresher actions
 * @returns {{ isReady: boolean }}
 */
export const useRefresherPersistence = (dispatch) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const [config, printBatches] = await Promise.all([
          getRefresherConfig(),
          getAllPrintBatches(),
        ]);

        if (cancelled) return;

        dispatch({
          type: REFRESHER_ACTIONS.REFRESHER_HYDRATED,
          payload: { config, printBatches },
        });
        setIsReady(true);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[useRefresherPersistence] hydration failed:', error);
        // App remains usable. Reducer keeps default config + empty batches.
        if (!cancelled) {
          dispatch({
            type: REFRESHER_ACTIONS.REFRESHER_HYDRATED,
            payload: {},
          });
          setIsReady(true);
        }
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return { isReady };
};
