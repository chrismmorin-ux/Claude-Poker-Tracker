/**
 * TelemetryConsentContext.jsx — Telemetry consent state context
 *
 * Provides current consent state + semantic helpers (isCategoryEnabled /
 * shouldShowFirstLaunchPanel / emit) + raw dispatch to any descendant via
 * useTelemetryConsent(). Mirrors EntitlementContext shape.
 *
 * MPMF G5-B2 (2026-04-26).
 *
 * Mounting:
 *   - useReducer composed in `src/hooks/useAppState.js`
 *   - Provider mounted in `src/AppProviders.jsx` (after SettingsProvider)
 *
 * Persistence:
 *   - `useTelemetryConsentPersistence(state, dispatch)` is called inside the
 *     Provider. The hook reads settings.telemetry on mount and dispatches
 *     TELEMETRY_CONSENT_HYDRATED. Until isReady=true,
 *     `shouldShowFirstLaunchPanel` returns false to prevent a flicker of
 *     the panel before hydration.
 */

import { createContext, useContext, useMemo, useCallback } from 'react';
import { emit as gateEmit } from '../utils/telemetry/consentGate';
import { useTelemetryConsentPersistence } from '../hooks/useTelemetryConsentPersistence';

// =============================================================================
// CONTEXT
// =============================================================================

const TelemetryConsentContext = createContext(null);

// =============================================================================
// PROVIDER
// =============================================================================

/**
 * TelemetryConsentProvider — wraps children with consent state + helpers.
 *
 * @param {Object} props
 * @param {Object} props.telemetryConsentState - State from telemetryConsentReducer
 * @param {Function} props.dispatchTelemetryConsent - Dispatcher
 * @param {React.ReactNode} props.children
 */
export const TelemetryConsentProvider = ({
  telemetryConsentState,
  dispatchTelemetryConsent,
  children,
}) => {
  // Hydrate from settings.telemetry sub-state on mount; debounced writes
  // back on state change.
  const { isReady } = useTelemetryConsentPersistence(
    telemetryConsentState,
    dispatchTelemetryConsent,
  );

  // ==========================================================================
  // SEMANTIC HELPERS
  // ==========================================================================

  /**
   * Returns true iff the named category is currently enabled. Unknown
   * categories return false (fail-closed). Components like the consentGate
   * use this directly; the gate also reads via shouldEmit(), but UI like
   * the Settings TelemetrySection asks "is this row currently on?".
   */
  const isCategoryEnabled = useCallback(
    (category) => {
      if (typeof category !== 'string') return false;
      const cats = telemetryConsentState?.categories;
      if (!cats || typeof cats !== 'object') return false;
      return cats[category] === true;
    },
    [telemetryConsentState],
  );

  /**
   * True if the first-launch consent panel should be shown right now.
   * Returns false until hydration is complete (avoids panel flicker
   * during the brief async window between mount and IDB read).
   * Also false once `firstLaunchSeenAt` is stamped — MPMF-AP-13.
   */
  const shouldShowFirstLaunchPanel = useMemo(() => {
    if (!isReady) return false;
    return telemetryConsentState?.firstLaunchSeenAt == null;
  }, [isReady, telemetryConsentState]);

  /**
   * Emit a telemetry event. Currying convenience — most components just
   * want `emit('event_name', { foo: 1 })` without re-passing the consent
   * state. The underlying gate enforces all drop rules.
   */
  const emit = useCallback(
    (eventName, properties) => {
      gateEmit(eventName, properties, telemetryConsentState);
    },
    [telemetryConsentState],
  );

  // ==========================================================================
  // VALUE
  // ==========================================================================

  const value = useMemo(
    () => ({
      // Raw state
      ...telemetryConsentState,
      // Persistence flag
      isReady,
      // Semantic helpers
      isCategoryEnabled,
      shouldShowFirstLaunchPanel,
      emit,
      // Raw dispatch — used by FirstLaunchTelemetryPanel + TelemetrySection
      dispatchTelemetryConsent,
    }),
    [
      telemetryConsentState,
      isReady,
      isCategoryEnabled,
      shouldShowFirstLaunchPanel,
      emit,
      dispatchTelemetryConsent,
    ],
  );

  return (
    <TelemetryConsentContext.Provider value={value}>
      {children}
    </TelemetryConsentContext.Provider>
  );
};

// =============================================================================
// CONSUMER HOOK
// =============================================================================

/**
 * useTelemetryConsent — access consent state + helpers from any descendant.
 *
 * @returns {Object} See TelemetryConsentProvider §VALUE
 * @throws {Error} If called outside a TelemetryConsentProvider
 */
export const useTelemetryConsent = () => {
  const ctx = useContext(TelemetryConsentContext);
  if (!ctx) {
    throw new Error('useTelemetryConsent must be used within a TelemetryConsentProvider');
  }
  return ctx;
};

export default TelemetryConsentContext;
