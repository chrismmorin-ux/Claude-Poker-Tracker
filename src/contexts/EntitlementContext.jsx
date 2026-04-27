/**
 * EntitlementContext.jsx — Monetization & PMF entitlement state context
 *
 * Provides current tier + cancellation/pending/card-decline state + semantic
 * access helpers (isAtLeast / hasAccessTo / etc.) to any consumer via
 * useEntitlement(). Mirrors PlayerContext shape per Gate 5 plan.
 *
 * MPMF G5-B1 (2026-04-25): authored as part of entitlement foundation batch.
 * Architecture: `docs/projects/monetization-and-pmf/entitlement-architecture.md`
 *
 * Mounting:
 *   - useReducer composed in `src/hooks/useAppState.js`
 *   - Provider mounted in `src/AppProviders.jsx`
 *
 * Persistence:
 *   - `useEntitlementPersistence(entitlementState, dispatchEntitlement)` is
 *     called from within this Provider (mirrors PlayerProvider pattern). The
 *     hook reads from IDB on mount and dispatches ENTITLEMENT_HYDRATED.
 */

import { createContext, useContext, useMemo, useCallback } from 'react';
import {
  isAtLeast as isAtLeastHelper,
  hasAccessTo as hasAccessToHelper,
  resolveEffectiveTier,
} from '../utils/entitlement/featureMap';
import { useEntitlementPersistence } from '../hooks/useEntitlementPersistence';

// =============================================================================
// CONTEXT
// =============================================================================

const EntitlementContext = createContext(null);

// =============================================================================
// PROVIDER
// =============================================================================

/**
 * EntitlementProvider — wraps children with entitlement state + helpers.
 *
 * Receives state + dispatch as props from useAppState. Internally composes
 * the persistence hook to hydrate IDB state on mount.
 *
 * @param {Object} props
 * @param {Object} props.entitlementState - State from entitlementReducer
 * @param {Function} props.dispatchEntitlement - Dispatcher for entitlement actions
 * @param {React.ReactNode} props.children
 */
export const EntitlementProvider = ({ entitlementState, dispatchEntitlement, children }) => {
  // Persistence: hydrates from IDB on mount; auto-saves on state change.
  // Returns { isReady } so consumers can defer tier-gated UI until hydration
  // completes (avoids flash-of-free-tier for paying users).
  const { isReady } = useEntitlementPersistence(entitlementState, dispatchEntitlement);

  // Effective tier respects dev override; canonical state.tier is the
  // unwrapped Stripe-backed value. Most consumers want effective.
  const effectiveTier = useMemo(
    () => resolveEffectiveTier(entitlementState),
    [entitlementState]
  );

  // ==========================================================================
  // SEMANTIC HELPERS
  // ==========================================================================

  /**
   * True if the user's effective tier ranks at or above the required tier.
   * Convenience wrapper that pre-binds the current effective tier.
   */
  const isAtLeast = useCallback(
    (requiredTier) => isAtLeastHelper(effectiveTier, requiredTier),
    [effectiveTier]
  );

  /**
   * True if the user has access to the given feature (FEATURE_TIER value).
   * Pre-binds the current effective tier.
   */
  const hasAccessTo = useCallback(
    (feature) => hasAccessToHelper(effectiveTier, feature),
    [effectiveTier]
  );

  /**
   * True if the user has cancelled but is still within the access-through grace period.
   * BillingSettings + TrialStateIndicator use this to show "· Cancelling" status.
   */
  const isCancellationGrace = useCallback(
    () => entitlementState?.cancellation?.isCancelled === true,
    [entitlementState]
  );

  /**
   * True if a plan change is scheduled but not yet effective.
   * BillingSettings PendingPlanChangeIndicator gates on this.
   */
  const isPendingPlanChange = useCallback(
    () => entitlementState?.pendingPlanChange?.isActive === true,
    [entitlementState]
  );

  /**
   * True if the user's card was declined and the grace period is still active.
   * TrialStateIndicator uses this to render the ⚠️ icon variant.
   */
  const isCardDeclineGrace = useCallback(
    () => entitlementState?.cardDecline?.isActive === true,
    [entitlementState]
  );

  // ==========================================================================
  // VALUE
  // ==========================================================================

  // Memoize to prevent unnecessary re-renders. Full deps array per
  // PlayerContext convention.
  const value = useMemo(
    () => ({
      // Raw state
      ...entitlementState,
      // Effective tier (respects dev override)
      effectiveTier,
      // Persistence
      isReady,
      // Semantic helpers
      isAtLeast,
      hasAccessTo,
      isCancellationGrace,
      isPendingPlanChange,
      isCardDeclineGrace,
      // Dispatch (raw — writers go through W-SUB-* entry points only;
      // see WRITERS.md §I-WR-1)
      dispatchEntitlement,
    }),
    [
      entitlementState,
      effectiveTier,
      isReady,
      isAtLeast,
      hasAccessTo,
      isCancellationGrace,
      isPendingPlanChange,
      isCardDeclineGrace,
      dispatchEntitlement,
    ]
  );

  return (
    <EntitlementContext.Provider value={value}>
      {children}
    </EntitlementContext.Provider>
  );
};

// =============================================================================
// CONSUMER HOOK
// =============================================================================

/**
 * useEntitlement — access entitlement state + helpers from any descendant.
 *
 * @returns {Object} See EntitlementProvider §VALUE
 * @throws {Error} If called outside an EntitlementProvider
 */
export const useEntitlement = () => {
  const context = useContext(EntitlementContext);
  if (!context) {
    throw new Error('useEntitlement must be used within an EntitlementProvider');
  }
  return context;
};

export default EntitlementContext;
