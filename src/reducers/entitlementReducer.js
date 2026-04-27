/**
 * entitlementReducer.js — Monetization & PMF entitlement state management
 *
 * Manages subscription tier state including cancellation, plan-change scheduling,
 * card-decline grace periods, and dev-mode overrides.
 *
 * Mirrors the playerReducer pattern (frozen ACTIONS + createValidatedReducer
 * wrapper + spread immutability + STATE_SCHEMA + INITIAL_STATE export).
 *
 * MPMF G5-B1 (2026-04-25): authored as part of entitlement foundation batch.
 * Architecture: `docs/projects/monetization-and-pmf/entitlement-architecture.md`
 * WRITERS: `docs/projects/monetization-and-pmf/WRITERS.md` §subscription store
 *
 * 10 actions covering the full subscription lifecycle. Writes always come
 * through one of 5 W-SUB-* writer entry points (per WRITERS.md I-WR-1).
 * Components dispatch via the EntitlementContext provider, never directly.
 */

import {
  ENTITLEMENT_ACTIONS,
  ENTITLEMENT_STATE_SCHEMA,
  initialEntitlementState,
} from '../constants/entitlementConstants';
import { createValidatedReducer } from '../utils/reducerUtils';

// =============================================================================
// RAW REDUCER
// =============================================================================

const rawEntitlementReducer = (state, action) => {
  switch (action.type) {
    // -------------------------------------------------------------------------
    // ENTITLEMENT_HYDRATED
    // Replace state with the record loaded from IDB at boot.
    // Caller (useEntitlementPersistence) reads the subscription store and
    // dispatches with the full hydrated payload.
    // -------------------------------------------------------------------------
    case ENTITLEMENT_ACTIONS.ENTITLEMENT_HYDRATED: {
      const hydrated = action.payload?.entitlement;
      if (!hydrated || typeof hydrated !== 'object') {
        // Defensive: bad hydration payload — keep current state rather than
        // corrupt it. createValidatedReducer logs the action regardless.
        return state;
      }
      return {
        ...initialEntitlementState,
        ...hydrated,
        cancellation: { ...initialEntitlementState.cancellation, ...(hydrated.cancellation || {}) },
        pendingPlanChange: { ...initialEntitlementState.pendingPlanChange, ...(hydrated.pendingPlanChange || {}) },
        cardDecline: { ...initialEntitlementState.cardDecline, ...(hydrated.cardDecline || {}) },
        overrides: { ...initialEntitlementState.overrides, ...(hydrated.overrides || {}) },
      };
    }

    // -------------------------------------------------------------------------
    // TIER_UPGRADED
    // User completed Stripe Checkout → W-SUB-2 webhook → dispatch.
    // Sets tier + cohort + billing fields. Clears cancellation/grace state since
    // a fresh subscription supersedes any prior cancelled-grace position.
    // -------------------------------------------------------------------------
    case ENTITLEMENT_ACTIONS.TIER_UPGRADED: {
      const {
        tier,
        cohort,
        billingCycle,
        nextBillAt,
        nextBillAmount,
        paymentMethod,
        stripeCustomerId,
        stripeSubscriptionId,
        acquiredAt,
      } = action.payload || {};
      return {
        ...state,
        tier: tier ?? state.tier,
        cohort: cohort ?? state.cohort,
        billingCycle: billingCycle ?? state.billingCycle,
        nextBillAt: nextBillAt ?? state.nextBillAt,
        nextBillAmount: nextBillAmount ?? state.nextBillAmount,
        paymentMethod: paymentMethod ?? state.paymentMethod,
        stripeCustomerId: stripeCustomerId ?? state.stripeCustomerId,
        stripeSubscriptionId: stripeSubscriptionId ?? state.stripeSubscriptionId,
        acquiredAt: acquiredAt ?? state.acquiredAt ?? new Date().toISOString(),
        // Fresh subscription clears prior cancellation grace
        cancellation: {
          isCancelled: false,
          canceledAt: null,
          accessThrough: null,
        },
        // Fresh subscription clears any pending plan change
        pendingPlanChange: {
          isActive: false,
          targetTier: null,
          effectiveDate: null,
        },
        // Fresh subscription resolves prior card-decline grace
        cardDecline: {
          isActive: false,
          declinedAt: null,
          graceUntil: null,
        },
      };
    }

    // -------------------------------------------------------------------------
    // PLAN_CHANGE_RECORDED
    // Immediate plan upgrade (or rare lateral). W-SUB-4.
    // Clears any pending plan change since the change just happened.
    // -------------------------------------------------------------------------
    case ENTITLEMENT_ACTIONS.PLAN_CHANGE_RECORDED: {
      const { tier, billingCycle, nextBillAt, nextBillAmount } = action.payload || {};
      return {
        ...state,
        tier: tier ?? state.tier,
        billingCycle: billingCycle ?? state.billingCycle,
        nextBillAt: nextBillAt ?? state.nextBillAt,
        nextBillAmount: nextBillAmount ?? state.nextBillAmount,
        pendingPlanChange: {
          isActive: false,
          targetTier: null,
          effectiveDate: null,
        },
      };
    }

    // -------------------------------------------------------------------------
    // CANCELLATION_RECORDED
    // User cancelled subscription via journey J3. W-SUB-3.
    // Cancellation supersedes any pending plan change (per Gate 4 known-behavior
    // note). Tier remains current until accessThrough; degradation happens
    // separately via a scheduled action or on-app-launch check.
    // -------------------------------------------------------------------------
    case ENTITLEMENT_ACTIONS.CANCELLATION_RECORDED: {
      const { canceledAt, accessThrough } = action.payload || {};
      return {
        ...state,
        cancellation: {
          isCancelled: true,
          canceledAt: canceledAt ?? new Date().toISOString(),
          accessThrough: accessThrough ?? state.cancellation.accessThrough,
        },
        // Cancellation supersedes pending plan change
        pendingPlanChange: {
          isActive: false,
          targetTier: null,
          effectiveDate: null,
        },
      };
    }

    // -------------------------------------------------------------------------
    // CANCELLATION_REVERSED
    // User tapped Reactivate before accessThrough date. Clears cancellation
    // grace state; subscription resumes auto-renew at next billing date.
    // -------------------------------------------------------------------------
    case ENTITLEMENT_ACTIONS.CANCELLATION_REVERSED: {
      return {
        ...state,
        cancellation: {
          isCancelled: false,
          canceledAt: null,
          accessThrough: null,
        },
      };
    }

    // -------------------------------------------------------------------------
    // PENDING_PLAN_CHANGE_SET
    // User scheduled a downgrade at next billing period. W-SUB-4 with
    // scheduled-effective Stripe option. Tier remains current; pendingPlanChange
    // tracks the upcoming transition.
    // -------------------------------------------------------------------------
    case ENTITLEMENT_ACTIONS.PENDING_PLAN_CHANGE_SET: {
      const { targetTier, effectiveDate } = action.payload || {};
      return {
        ...state,
        pendingPlanChange: {
          isActive: true,
          targetTier: targetTier ?? null,
          effectiveDate: effectiveDate ?? null,
        },
      };
    }

    // -------------------------------------------------------------------------
    // PENDING_PLAN_CHANGE_CLEARED
    // User reversed pending plan change before effective date. Single-tap reverse;
    // no confirmation needed (reversal is itself a reverse action).
    // -------------------------------------------------------------------------
    case ENTITLEMENT_ACTIONS.PENDING_PLAN_CHANGE_CLEARED: {
      return {
        ...state,
        pendingPlanChange: {
          isActive: false,
          targetTier: null,
          effectiveDate: null,
        },
      };
    }

    // -------------------------------------------------------------------------
    // CARD_DECLINE_DETECTED
    // Stripe webhook reported a failed payment. Starts grace period; tier
    // remains until graceUntil expires.
    // -------------------------------------------------------------------------
    case ENTITLEMENT_ACTIONS.CARD_DECLINE_DETECTED: {
      const { declinedAt, graceUntil } = action.payload || {};
      return {
        ...state,
        cardDecline: {
          isActive: true,
          declinedAt: declinedAt ?? new Date().toISOString(),
          graceUntil: graceUntil ?? null,
        },
      };
    }

    // -------------------------------------------------------------------------
    // CARD_DECLINE_RESOLVED
    // User updated payment method or Stripe successfully re-charged. Clears
    // grace state.
    // -------------------------------------------------------------------------
    case ENTITLEMENT_ACTIONS.CARD_DECLINE_RESOLVED: {
      return {
        ...state,
        cardDecline: {
          isActive: false,
          declinedAt: null,
          graceUntil: null,
        },
      };
    }

    // -------------------------------------------------------------------------
    // DEV_OVERRIDE_TIER
    // Dev-only escape hatch (W-SUB-5). Sets overrides.devForceTier without
    // touching the canonical tier. Hooks/components that read effective tier
    // via resolveEffectiveTier() see the override; Stripe state is unchanged.
    // -------------------------------------------------------------------------
    case ENTITLEMENT_ACTIONS.DEV_OVERRIDE_TIER: {
      const { devForceTier } = action.payload || {};
      return {
        ...state,
        overrides: {
          ...state.overrides,
          devForceTier: devForceTier ?? null,
        },
      };
    }

    default:
      return state;
  }
};

// =============================================================================
// VALIDATED REDUCER (export this)
// =============================================================================

export const entitlementReducer = createValidatedReducer(
  rawEntitlementReducer,
  ENTITLEMENT_STATE_SCHEMA,
  'entitlementReducer'
);

// Re-export initialEntitlementState for AppRoot useReducer call to mirror
// the playerReducer pattern (`import { playerReducer, initialPlayerState } from ...`).
export { initialEntitlementState };
