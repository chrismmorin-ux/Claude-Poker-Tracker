/**
 * entitlementConstants.js — Monetization & PMF entitlement state constants
 *
 * Source of truth for action types, initial state, and validation schema for
 * the entitlement reducer. Mirrors `playerConstants.js` shape per Gate 5 plan.
 *
 * MPMF G5-B1 (2026-04-25): authored as part of entitlement foundation batch.
 * Architecture: `docs/projects/monetization-and-pmf/entitlement-architecture.md`
 * WRITERS: `docs/projects/monetization-and-pmf/WRITERS.md` §subscription store
 *
 * Tier ladder (Phase 1):
 *   free → plus → pro
 *   founding-lifetime is feature-equivalent to pro (per TIER_ORDER in featureMap)
 *   ignition is a separate commercial lane (Phase 2+; MPMF-G4-IM deferred)
 */

// =============================================================================
// ACTION TYPES
// =============================================================================

/**
 * All entitlement reducer actions. Frozen to prevent runtime mutation.
 *
 * 10 actions covering the full subscription lifecycle:
 *   - Hydration:       ENTITLEMENT_HYDRATED (boot from IDB)
 *   - Tier changes:    TIER_UPGRADED, PLAN_CHANGE_RECORDED
 *   - Cancellation:    CANCELLATION_RECORDED, CANCELLATION_REVERSED
 *   - Pending changes: PENDING_PLAN_CHANGE_SET, PENDING_PLAN_CHANGE_CLEARED
 *   - Card decline:    CARD_DECLINE_DETECTED, CARD_DECLINE_RESOLVED
 *   - Dev:             DEV_OVERRIDE_TIER (gated behind DEV_MODE)
 */
export const ENTITLEMENT_ACTIONS = Object.freeze({
  // Hydration
  ENTITLEMENT_HYDRATED: 'ENTITLEMENT_HYDRATED',

  // Tier changes (W-SUB-2 + W-SUB-4)
  TIER_UPGRADED: 'TIER_UPGRADED',
  PLAN_CHANGE_RECORDED: 'PLAN_CHANGE_RECORDED',

  // Cancellation lifecycle (W-SUB-3 + Reactivate)
  CANCELLATION_RECORDED: 'CANCELLATION_RECORDED',
  CANCELLATION_REVERSED: 'CANCELLATION_REVERSED',

  // Pending plan-change (downgrade scheduled at period-end)
  PENDING_PLAN_CHANGE_SET: 'PENDING_PLAN_CHANGE_SET',
  PENDING_PLAN_CHANGE_CLEARED: 'PENDING_PLAN_CHANGE_CLEARED',

  // Card decline grace period
  CARD_DECLINE_DETECTED: 'CARD_DECLINE_DETECTED',
  CARD_DECLINE_RESOLVED: 'CARD_DECLINE_RESOLVED',

  // Dev-only override (W-SUB-5)
  DEV_OVERRIDE_TIER: 'DEV_OVERRIDE_TIER',
});

// =============================================================================
// TIER + COHORT ENUMS
// =============================================================================

/** Tier identifiers used throughout the entitlement system. */
export const TIERS = Object.freeze({
  FREE: 'free',
  PLUS: 'plus',
  PRO: 'pro',
  FOUNDING_LIFETIME: 'founding-lifetime',
  IGNITION: 'ignition', // Phase 2+ — separate commercial lane
});

/** Valid tier values for schema validation. */
export const VALID_TIERS = Object.freeze([
  TIERS.FREE,
  TIERS.PLUS,
  TIERS.PRO,
  TIERS.FOUNDING_LIFETIME,
  TIERS.IGNITION,
]);

/** Cohort identifies acquisition channel (founding-50 vs standard). */
export const COHORTS = Object.freeze({
  STANDARD: 'standard',
  FOUNDING_50: 'founding-50',
});

/** Valid cohort values. */
export const VALID_COHORTS = Object.freeze([
  COHORTS.STANDARD,
  COHORTS.FOUNDING_50,
]);

/** Billing cadence options. */
export const BILLING_CYCLES = Object.freeze({
  MONTHLY: 'monthly',
  ANNUAL: 'annual',
  LIFETIME: 'lifetime',
});

/** Valid billing cycle values. */
export const VALID_BILLING_CYCLES = Object.freeze([
  BILLING_CYCLES.MONTHLY,
  BILLING_CYCLES.ANNUAL,
  BILLING_CYCLES.LIFETIME,
]);

// =============================================================================
// INITIAL STATE
// =============================================================================

/**
 * Default entitlement state for fresh installs and as the starting point
 * before IDB hydration completes. Renders the user as `free` tier so the
 * UI is usable immediately; ENTITLEMENT_HYDRATED replaces this on boot
 * once the persistence hook reads from IDB.
 *
 * Schema version `1.0.0` per WRITERS.md §I-WR-5 (compound semver).
 */
export const initialEntitlementState = Object.freeze({
  tier: TIERS.FREE,
  cohort: COHORTS.STANDARD,
  acquiredAt: null,            // ISO8601 — set when first subscription starts
  billingCycle: null,          // null while free
  nextBillAt: null,            // ISO8601 | null
  nextBillAmount: null,        // cents | null
  paymentMethod: null,         // { brand, last4, expiryMonth, expiryYear } | null
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  cancellation: Object.freeze({
    isCancelled: false,
    canceledAt: null,
    accessThrough: null,
  }),
  pendingPlanChange: Object.freeze({
    isActive: false,
    targetTier: null,
    effectiveDate: null,
  }),
  cardDecline: Object.freeze({
    isActive: false,
    declinedAt: null,
    graceUntil: null,
  }),
  overrides: Object.freeze({
    devForceTier: null,
  }),
  schemaVersion: '1.0.0',
});

// =============================================================================
// STATE SCHEMA (for createValidatedReducer)
// =============================================================================

/**
 * Validation schema for entitlement state. Used by createValidatedReducer
 * to catch state corruption in DEBUG mode.
 *
 * Mirrors PLAYER_STATE_SCHEMA shape; only top-level keys validated since
 * SCHEMA_RULES doesn't support nested object validation.
 */
export const ENTITLEMENT_STATE_SCHEMA = Object.freeze({
  tier: { type: 'string', enum: VALID_TIERS },
  cohort: { type: 'string', enum: VALID_COHORTS },
  cancellation: { type: 'object' },
  pendingPlanChange: { type: 'object' },
  cardDecline: { type: 'object' },
  overrides: { type: 'object' },
  schemaVersion: { type: 'string' },
});

// =============================================================================
// IDB STORE METADATA
// =============================================================================

/** IDB object store name for the subscription record. */
export const SUBSCRIPTION_STORE_NAME = 'subscription';

/**
 * Founding-Lifetime cap per Q4=A verdict. Hard cap; server-side enforced
 * via I-WR-4 in WRITERS.md. UI displays best-effort cap-remaining count.
 */
export const FOUNDING_MEMBER_CAP = 50;
