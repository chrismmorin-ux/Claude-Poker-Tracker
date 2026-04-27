/**
 * useEntitlementPersistence.js — IDB persistence for entitlement state
 *
 * Hydrates the entitlement reducer from the v18 `subscription` IDB store on
 * mount; debounce-writes state changes back to IDB. Mirrors usePlayerPersistence
 * pattern exactly — receives `entitlementState` + `dispatchEntitlement` as
 * params (composed from inside EntitlementProvider).
 *
 * MPMF G5-B1 (2026-04-25): authored as part of entitlement foundation batch.
 * Architecture: `docs/projects/monetization-and-pmf/entitlement-architecture.md`
 * WRITERS: `docs/projects/monetization-and-pmf/WRITERS.md` §subscription store
 *
 * Writer roles served:
 *   - W-SUB-1 migration-seed (read-after-create on first launch post-v18)
 *   - state-change debounced writes (mirroring W-SUB-* dispatched actions)
 */

import { useEffect, useRef, useState } from 'react';
import {
  GUEST_USER_ID,
  createPersistenceLogger,
} from '../utils/persistence/index';
import {
  getSubscription,
  putSubscription,
} from '../utils/persistence/subscriptionStore';
import {
  ENTITLEMENT_ACTIONS,
  initialEntitlementState,
} from '../constants/entitlementConstants';

const { log, logError } = createPersistenceLogger('useEntitlementPersistence');

const WRITE_DEBOUNCE_MS = 400;

/**
 * useEntitlementPersistence
 *
 * @param {Object} entitlementState - State from entitlementReducer
 * @param {Function} dispatchEntitlement - Dispatcher for entitlement actions
 * @param {string} userId - User ID for keyed storage (defaults to GUEST_USER_ID)
 * @returns {{ isReady: boolean }}
 */
export const useEntitlementPersistence = (entitlementState, dispatchEntitlement, userId = GUEST_USER_ID) => {
  const [isReady, setIsReady] = useState(false);
  const writeTimerRef = useRef(null);
  const hasHydratedRef = useRef(false);

  // ==========================================================================
  // HYDRATION (on mount)
  // ==========================================================================

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        log(`Hydrating entitlement for user ${userId}...`);
        const record = await getSubscription(userId);
        if (cancelled) return;

        if (record) {
          log('Entitlement record loaded from IDB');
          dispatchEntitlement({
            type: ENTITLEMENT_ACTIONS.ENTITLEMENT_HYDRATED,
            payload: { entitlement: record },
          });
        } else {
          // No record — first launch post-migration. Seed should have been
          // created by migrateV18 already; but defensively write the initial
          // state so subsequent reads succeed.
          log('No entitlement record found; seeding initial state');
          await putSubscription({ ...initialEntitlementState, userId });
        }

        hasHydratedRef.current = true;
        setIsReady(true);
      } catch (error) {
        logError('Hydration failed:', error);
        // Continue with default free-tier state. App remains usable.
        hasHydratedRef.current = true;
        setIsReady(true);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [dispatchEntitlement, userId]);

  // ==========================================================================
  // DEBOUNCED WRITE on state change
  // ==========================================================================

  useEffect(() => {
    // Skip writes until hydration completes (avoids overwriting IDB with
    // initialEntitlementState defaults before the actual record loads).
    if (!hasHydratedRef.current) return;

    if (writeTimerRef.current) {
      clearTimeout(writeTimerRef.current);
    }

    writeTimerRef.current = setTimeout(async () => {
      try {
        await putSubscription({ ...entitlementState, userId });
      } catch (error) {
        logError('Persistence write failed:', error);
      }
    }, WRITE_DEBOUNCE_MS);

    return () => {
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current);
      }
    };
  }, [entitlementState, userId]);

  return { isReady };
};
