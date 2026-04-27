/**
 * useTelemetryConsentPersistence.js — IDB persistence for telemetry consent
 *
 * Hydrates the telemetryConsentReducer from the v21 `telemetryConsent` IDB
 * store on mount; debounce-writes state changes back. Mirrors
 * useEntitlementPersistence pattern.
 *
 * MPMF G5-B2 (2026-04-26).
 *
 * The `isReady` flag is critical: TelemetryConsentContext gates
 * `shouldShowFirstLaunchPanel` on `isReady`, so the panel never flashes
 * before hydration completes.
 */

import { useEffect, useRef, useState } from 'react';
import {
  GUEST_USER_ID,
  createPersistenceLogger,
} from '../utils/persistence/index';
import {
  getTelemetryConsent,
  putTelemetryConsent,
} from '../utils/persistence/telemetryConsentStore';
import {
  TELEMETRY_CONSENT_ACTIONS,
  initialTelemetryConsentState,
} from '../constants/telemetryConsentConstants';

const { log, logError } = createPersistenceLogger('useTelemetryConsentPersistence');

const WRITE_DEBOUNCE_MS = 400;

/**
 * @param {Object} telemetryConsentState - State from telemetryConsentReducer
 * @param {Function} dispatchTelemetryConsent
 * @param {string} userId
 * @returns {{ isReady: boolean }}
 */
export const useTelemetryConsentPersistence = (
  telemetryConsentState,
  dispatchTelemetryConsent,
  userId = GUEST_USER_ID,
) => {
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
        log(`Hydrating telemetry consent for user ${userId}...`);
        const record = await getTelemetryConsent(userId);
        if (cancelled) return;

        if (record) {
          log('Telemetry consent record loaded from IDB');
          dispatchTelemetryConsent({
            type: TELEMETRY_CONSENT_ACTIONS.TELEMETRY_CONSENT_HYDRATED,
            payload: { telemetryConsent: record },
          });
        } else {
          // No record — defensive seed. migrateV21 should have created one,
          // but if hydration runs against a DB that skipped the migration
          // (e.g. dev hot-reload after delete), seed the initial state so
          // subsequent writes have a record to merge with.
          log('No telemetry consent record found; seeding defaults');
          await putTelemetryConsent({ ...initialTelemetryConsentState, userId });
        }

        hasHydratedRef.current = true;
        setIsReady(true);
      } catch (error) {
        logError('Hydration failed:', error);
        // Still mark ready so the app boots; the consentGate will drop
        // every event because firstLaunchSeenAt remains null in default
        // state (fail-closed by design).
        hasHydratedRef.current = true;
        setIsReady(true);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [dispatchTelemetryConsent, userId]);

  // ==========================================================================
  // DEBOUNCED WRITE on state change
  // ==========================================================================

  useEffect(() => {
    // Skip writes until hydration completes (avoids overwriting IDB with
    // initialTelemetryConsentState defaults before the actual record loads).
    if (!hasHydratedRef.current) return;

    if (writeTimerRef.current) {
      clearTimeout(writeTimerRef.current);
    }

    writeTimerRef.current = setTimeout(async () => {
      try {
        await putTelemetryConsent({ ...telemetryConsentState, userId });
      } catch (error) {
        logError('Persistence write failed:', error);
      }
    }, WRITE_DEBOUNCE_MS);

    return () => {
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current);
      }
    };
  }, [telemetryConsentState, userId]);

  return { isReady };
};
