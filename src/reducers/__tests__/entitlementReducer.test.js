/**
 * entitlementReducer.test.js
 *
 * Unit tests for the entitlement reducer covering all 10 actions plus
 * edge cases (cancellation supersedes pending plan-change, hydration of
 * partial payloads, fresh-upgrade clears stale grace state, etc.).
 *
 * MPMF G5-B1 (2026-04-25).
 */

import { describe, it, expect } from 'vitest';
import { entitlementReducer, initialEntitlementState } from '../entitlementReducer';
import {
  ENTITLEMENT_ACTIONS,
  TIERS,
  COHORTS,
  BILLING_CYCLES,
} from '../../constants/entitlementConstants';

describe('initialEntitlementState', () => {
  it('starts as free tier', () => {
    expect(initialEntitlementState.tier).toBe(TIERS.FREE);
  });

  it('starts in standard cohort', () => {
    expect(initialEntitlementState.cohort).toBe(COHORTS.STANDARD);
  });

  it('has no payment method by default', () => {
    expect(initialEntitlementState.paymentMethod).toBeNull();
  });

  it('has no active cancellation', () => {
    expect(initialEntitlementState.cancellation.isCancelled).toBe(false);
    expect(initialEntitlementState.cancellation.canceledAt).toBeNull();
    expect(initialEntitlementState.cancellation.accessThrough).toBeNull();
  });

  it('has no pending plan change', () => {
    expect(initialEntitlementState.pendingPlanChange.isActive).toBe(false);
  });

  it('has no card decline', () => {
    expect(initialEntitlementState.cardDecline.isActive).toBe(false);
  });

  it('has no dev override', () => {
    expect(initialEntitlementState.overrides.devForceTier).toBeNull();
  });

  it('has schema version 1.0.0', () => {
    expect(initialEntitlementState.schemaVersion).toBe('1.0.0');
  });
});

describe('ENTITLEMENT_HYDRATED', () => {
  it('replaces state with hydrated payload', () => {
    const hydrated = {
      tier: TIERS.PRO,
      cohort: COHORTS.STANDARD,
      billingCycle: BILLING_CYCLES.MONTHLY,
      nextBillAt: '2026-05-25T00:00:00.000Z',
      nextBillAmount: 2900,
      acquiredAt: '2026-01-01T00:00:00.000Z',
    };
    const next = entitlementReducer(initialEntitlementState, {
      type: ENTITLEMENT_ACTIONS.ENTITLEMENT_HYDRATED,
      payload: { entitlement: hydrated },
    });
    expect(next.tier).toBe(TIERS.PRO);
    expect(next.billingCycle).toBe(BILLING_CYCLES.MONTHLY);
    expect(next.nextBillAt).toBe('2026-05-25T00:00:00.000Z');
    expect(next.nextBillAmount).toBe(2900);
  });

  it('fills missing nested objects with defaults', () => {
    const hydrated = { tier: TIERS.PLUS };
    const next = entitlementReducer(initialEntitlementState, {
      type: ENTITLEMENT_ACTIONS.ENTITLEMENT_HYDRATED,
      payload: { entitlement: hydrated },
    });
    expect(next.cancellation).toEqual(initialEntitlementState.cancellation);
    expect(next.pendingPlanChange).toEqual(initialEntitlementState.pendingPlanChange);
    expect(next.cardDecline).toEqual(initialEntitlementState.cardDecline);
    expect(next.overrides).toEqual(initialEntitlementState.overrides);
  });

  it('hydrates partial cancellation state', () => {
    const hydrated = {
      tier: TIERS.PRO,
      cancellation: { isCancelled: true, canceledAt: '2026-04-01T00:00:00.000Z', accessThrough: '2026-05-01T00:00:00.000Z' },
    };
    const next = entitlementReducer(initialEntitlementState, {
      type: ENTITLEMENT_ACTIONS.ENTITLEMENT_HYDRATED,
      payload: { entitlement: hydrated },
    });
    expect(next.cancellation.isCancelled).toBe(true);
    expect(next.cancellation.canceledAt).toBe('2026-04-01T00:00:00.000Z');
    expect(next.cancellation.accessThrough).toBe('2026-05-01T00:00:00.000Z');
  });

  it('returns prior state on missing payload', () => {
    const next = entitlementReducer(initialEntitlementState, {
      type: ENTITLEMENT_ACTIONS.ENTITLEMENT_HYDRATED,
      payload: {},
    });
    expect(next).toBe(initialEntitlementState);
  });

  it('returns prior state on null payload entitlement', () => {
    const next = entitlementReducer(initialEntitlementState, {
      type: ENTITLEMENT_ACTIONS.ENTITLEMENT_HYDRATED,
      payload: { entitlement: null },
    });
    expect(next).toBe(initialEntitlementState);
  });
});

describe('TIER_UPGRADED', () => {
  it('upgrades from free to pro with full payload', () => {
    const next = entitlementReducer(initialEntitlementState, {
      type: ENTITLEMENT_ACTIONS.TIER_UPGRADED,
      payload: {
        tier: TIERS.PRO,
        cohort: COHORTS.STANDARD,
        billingCycle: BILLING_CYCLES.MONTHLY,
        nextBillAt: '2026-05-25T00:00:00.000Z',
        nextBillAmount: 2900,
        paymentMethod: { brand: 'visa', last4: '4242', expiryMonth: 12, expiryYear: 2027 },
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_456',
      },
    });
    expect(next.tier).toBe(TIERS.PRO);
    expect(next.billingCycle).toBe(BILLING_CYCLES.MONTHLY);
    expect(next.paymentMethod.last4).toBe('4242');
    expect(next.stripeCustomerId).toBe('cus_123');
    expect(next.stripeSubscriptionId).toBe('sub_456');
  });

  it('sets acquiredAt to now() when not provided', () => {
    const before = Date.now();
    const next = entitlementReducer(initialEntitlementState, {
      type: ENTITLEMENT_ACTIONS.TIER_UPGRADED,
      payload: { tier: TIERS.PLUS },
    });
    const acquired = new Date(next.acquiredAt).getTime();
    expect(acquired).toBeGreaterThanOrEqual(before);
    expect(acquired).toBeLessThanOrEqual(Date.now());
  });

  it('upgrades to founding-lifetime cohort', () => {
    const next = entitlementReducer(initialEntitlementState, {
      type: ENTITLEMENT_ACTIONS.TIER_UPGRADED,
      payload: {
        tier: TIERS.FOUNDING_LIFETIME,
        cohort: COHORTS.FOUNDING_50,
        billingCycle: BILLING_CYCLES.LIFETIME,
      },
    });
    expect(next.tier).toBe(TIERS.FOUNDING_LIFETIME);
    expect(next.cohort).toBe(COHORTS.FOUNDING_50);
    expect(next.billingCycle).toBe(BILLING_CYCLES.LIFETIME);
  });

  it('clears prior cancellation grace state on fresh upgrade', () => {
    const cancelled = entitlementReducer(initialEntitlementState, {
      type: ENTITLEMENT_ACTIONS.CANCELLATION_RECORDED,
      payload: { canceledAt: '2026-04-01T00:00:00.000Z', accessThrough: '2026-05-01T00:00:00.000Z' },
    });
    expect(cancelled.cancellation.isCancelled).toBe(true);

    const upgraded = entitlementReducer(cancelled, {
      type: ENTITLEMENT_ACTIONS.TIER_UPGRADED,
      payload: { tier: TIERS.PRO, billingCycle: BILLING_CYCLES.MONTHLY },
    });
    expect(upgraded.cancellation.isCancelled).toBe(false);
    expect(upgraded.cancellation.canceledAt).toBeNull();
    expect(upgraded.cancellation.accessThrough).toBeNull();
  });

  it('clears pending plan change on fresh upgrade', () => {
    const withPending = entitlementReducer(initialEntitlementState, {
      type: ENTITLEMENT_ACTIONS.PENDING_PLAN_CHANGE_SET,
      payload: { targetTier: TIERS.PLUS, effectiveDate: '2026-05-25T00:00:00.000Z' },
    });
    expect(withPending.pendingPlanChange.isActive).toBe(true);

    const upgraded = entitlementReducer(withPending, {
      type: ENTITLEMENT_ACTIONS.TIER_UPGRADED,
      payload: { tier: TIERS.PRO },
    });
    expect(upgraded.pendingPlanChange.isActive).toBe(false);
  });

  it('clears card decline grace on fresh upgrade', () => {
    const declined = entitlementReducer(initialEntitlementState, {
      type: ENTITLEMENT_ACTIONS.CARD_DECLINE_DETECTED,
      payload: { declinedAt: '2026-04-01T00:00:00.000Z', graceUntil: '2026-04-08T00:00:00.000Z' },
    });
    expect(declined.cardDecline.isActive).toBe(true);

    const upgraded = entitlementReducer(declined, {
      type: ENTITLEMENT_ACTIONS.TIER_UPGRADED,
      payload: { tier: TIERS.PRO },
    });
    expect(upgraded.cardDecline.isActive).toBe(false);
  });
});

describe('PLAN_CHANGE_RECORDED', () => {
  it('updates tier + billing fields on immediate upgrade', () => {
    const onPlus = { ...initialEntitlementState, tier: TIERS.PLUS, billingCycle: BILLING_CYCLES.MONTHLY };
    const next = entitlementReducer(onPlus, {
      type: ENTITLEMENT_ACTIONS.PLAN_CHANGE_RECORDED,
      payload: { tier: TIERS.PRO, billingCycle: BILLING_CYCLES.MONTHLY, nextBillAt: '2026-05-25T00:00:00.000Z', nextBillAmount: 2900 },
    });
    expect(next.tier).toBe(TIERS.PRO);
    expect(next.nextBillAmount).toBe(2900);
  });

  it('clears pending plan change after the change is recorded', () => {
    const withPending = entitlementReducer(initialEntitlementState, {
      type: ENTITLEMENT_ACTIONS.PENDING_PLAN_CHANGE_SET,
      payload: { targetTier: TIERS.PLUS, effectiveDate: '2026-05-25T00:00:00.000Z' },
    });
    const recorded = entitlementReducer(withPending, {
      type: ENTITLEMENT_ACTIONS.PLAN_CHANGE_RECORDED,
      payload: { tier: TIERS.PLUS, billingCycle: BILLING_CYCLES.MONTHLY },
    });
    expect(recorded.pendingPlanChange.isActive).toBe(false);
    expect(recorded.tier).toBe(TIERS.PLUS);
  });
});

describe('CANCELLATION_RECORDED', () => {
  it('marks subscription as cancelled with grace through date', () => {
    const onPro = { ...initialEntitlementState, tier: TIERS.PRO };
    const next = entitlementReducer(onPro, {
      type: ENTITLEMENT_ACTIONS.CANCELLATION_RECORDED,
      payload: { canceledAt: '2026-04-25T12:00:00.000Z', accessThrough: '2026-05-25T00:00:00.000Z' },
    });
    expect(next.cancellation.isCancelled).toBe(true);
    expect(next.cancellation.canceledAt).toBe('2026-04-25T12:00:00.000Z');
    expect(next.cancellation.accessThrough).toBe('2026-05-25T00:00:00.000Z');
  });

  it('keeps tier the same during grace period', () => {
    const onPro = { ...initialEntitlementState, tier: TIERS.PRO };
    const next = entitlementReducer(onPro, {
      type: ENTITLEMENT_ACTIONS.CANCELLATION_RECORDED,
      payload: { canceledAt: '2026-04-25T12:00:00.000Z', accessThrough: '2026-05-25T00:00:00.000Z' },
    });
    expect(next.tier).toBe(TIERS.PRO);
  });

  it('cancellation supersedes pending plan change', () => {
    const withPending = entitlementReducer(
      { ...initialEntitlementState, tier: TIERS.PRO },
      {
        type: ENTITLEMENT_ACTIONS.PENDING_PLAN_CHANGE_SET,
        payload: { targetTier: TIERS.PLUS, effectiveDate: '2026-05-25T00:00:00.000Z' },
      }
    );
    expect(withPending.pendingPlanChange.isActive).toBe(true);

    const cancelled = entitlementReducer(withPending, {
      type: ENTITLEMENT_ACTIONS.CANCELLATION_RECORDED,
      payload: { canceledAt: '2026-04-25T12:00:00.000Z', accessThrough: '2026-05-25T00:00:00.000Z' },
    });
    expect(cancelled.cancellation.isCancelled).toBe(true);
    expect(cancelled.pendingPlanChange.isActive).toBe(false);
  });

  it('uses now() for canceledAt when not provided', () => {
    const before = Date.now();
    const next = entitlementReducer(initialEntitlementState, {
      type: ENTITLEMENT_ACTIONS.CANCELLATION_RECORDED,
      payload: { accessThrough: '2026-05-25T00:00:00.000Z' },
    });
    const canceled = new Date(next.cancellation.canceledAt).getTime();
    expect(canceled).toBeGreaterThanOrEqual(before);
  });
});

describe('CANCELLATION_REVERSED', () => {
  it('clears cancellation grace state', () => {
    const cancelled = entitlementReducer(
      { ...initialEntitlementState, tier: TIERS.PRO },
      {
        type: ENTITLEMENT_ACTIONS.CANCELLATION_RECORDED,
        payload: { canceledAt: '2026-04-25T12:00:00.000Z', accessThrough: '2026-05-25T00:00:00.000Z' },
      }
    );
    const reversed = entitlementReducer(cancelled, {
      type: ENTITLEMENT_ACTIONS.CANCELLATION_REVERSED,
    });
    expect(reversed.cancellation.isCancelled).toBe(false);
    expect(reversed.cancellation.canceledAt).toBeNull();
    expect(reversed.cancellation.accessThrough).toBeNull();
  });

  it('preserves tier and billing fields', () => {
    const cancelled = {
      ...initialEntitlementState,
      tier: TIERS.PRO,
      billingCycle: BILLING_CYCLES.MONTHLY,
      cancellation: { isCancelled: true, canceledAt: '2026-04-25T12:00:00.000Z', accessThrough: '2026-05-25T00:00:00.000Z' },
    };
    const reversed = entitlementReducer(cancelled, {
      type: ENTITLEMENT_ACTIONS.CANCELLATION_REVERSED,
    });
    expect(reversed.tier).toBe(TIERS.PRO);
    expect(reversed.billingCycle).toBe(BILLING_CYCLES.MONTHLY);
  });
});

describe('PENDING_PLAN_CHANGE_SET', () => {
  it('sets pending downgrade target + effective date', () => {
    const onPro = { ...initialEntitlementState, tier: TIERS.PRO };
    const next = entitlementReducer(onPro, {
      type: ENTITLEMENT_ACTIONS.PENDING_PLAN_CHANGE_SET,
      payload: { targetTier: TIERS.PLUS, effectiveDate: '2026-05-25T00:00:00.000Z' },
    });
    expect(next.pendingPlanChange.isActive).toBe(true);
    expect(next.pendingPlanChange.targetTier).toBe(TIERS.PLUS);
    expect(next.pendingPlanChange.effectiveDate).toBe('2026-05-25T00:00:00.000Z');
  });

  it('keeps current tier intact during pending state', () => {
    const onPro = { ...initialEntitlementState, tier: TIERS.PRO };
    const next = entitlementReducer(onPro, {
      type: ENTITLEMENT_ACTIONS.PENDING_PLAN_CHANGE_SET,
      payload: { targetTier: TIERS.PLUS, effectiveDate: '2026-05-25T00:00:00.000Z' },
    });
    expect(next.tier).toBe(TIERS.PRO);
  });
});

describe('PENDING_PLAN_CHANGE_CLEARED', () => {
  it('clears pending plan change without changing tier', () => {
    const withPending = entitlementReducer(
      { ...initialEntitlementState, tier: TIERS.PRO },
      {
        type: ENTITLEMENT_ACTIONS.PENDING_PLAN_CHANGE_SET,
        payload: { targetTier: TIERS.PLUS, effectiveDate: '2026-05-25T00:00:00.000Z' },
      }
    );
    const cleared = entitlementReducer(withPending, {
      type: ENTITLEMENT_ACTIONS.PENDING_PLAN_CHANGE_CLEARED,
    });
    expect(cleared.pendingPlanChange.isActive).toBe(false);
    expect(cleared.pendingPlanChange.targetTier).toBeNull();
    expect(cleared.tier).toBe(TIERS.PRO);
  });
});

describe('CARD_DECLINE_DETECTED', () => {
  it('starts grace period with declinedAt + graceUntil', () => {
    const next = entitlementReducer(
      { ...initialEntitlementState, tier: TIERS.PRO },
      {
        type: ENTITLEMENT_ACTIONS.CARD_DECLINE_DETECTED,
        payload: { declinedAt: '2026-04-25T12:00:00.000Z', graceUntil: '2026-05-02T12:00:00.000Z' },
      }
    );
    expect(next.cardDecline.isActive).toBe(true);
    expect(next.cardDecline.declinedAt).toBe('2026-04-25T12:00:00.000Z');
    expect(next.cardDecline.graceUntil).toBe('2026-05-02T12:00:00.000Z');
  });

  it('keeps tier during grace period', () => {
    const next = entitlementReducer(
      { ...initialEntitlementState, tier: TIERS.PRO },
      {
        type: ENTITLEMENT_ACTIONS.CARD_DECLINE_DETECTED,
        payload: { declinedAt: '2026-04-25T12:00:00.000Z', graceUntil: '2026-05-02T12:00:00.000Z' },
      }
    );
    expect(next.tier).toBe(TIERS.PRO);
  });
});

describe('CARD_DECLINE_RESOLVED', () => {
  it('clears card decline grace state', () => {
    const declined = entitlementReducer(
      { ...initialEntitlementState, tier: TIERS.PRO },
      {
        type: ENTITLEMENT_ACTIONS.CARD_DECLINE_DETECTED,
        payload: { declinedAt: '2026-04-25T12:00:00.000Z', graceUntil: '2026-05-02T12:00:00.000Z' },
      }
    );
    const resolved = entitlementReducer(declined, {
      type: ENTITLEMENT_ACTIONS.CARD_DECLINE_RESOLVED,
    });
    expect(resolved.cardDecline.isActive).toBe(false);
    expect(resolved.cardDecline.declinedAt).toBeNull();
    expect(resolved.cardDecline.graceUntil).toBeNull();
  });
});

describe('DEV_OVERRIDE_TIER', () => {
  it('sets dev override without changing canonical tier', () => {
    const next = entitlementReducer(initialEntitlementState, {
      type: ENTITLEMENT_ACTIONS.DEV_OVERRIDE_TIER,
      payload: { devForceTier: TIERS.PRO },
    });
    expect(next.tier).toBe(TIERS.FREE); // canonical unchanged
    expect(next.overrides.devForceTier).toBe(TIERS.PRO);
  });

  it('clears override when devForceTier is null', () => {
    const overridden = entitlementReducer(initialEntitlementState, {
      type: ENTITLEMENT_ACTIONS.DEV_OVERRIDE_TIER,
      payload: { devForceTier: TIERS.PRO },
    });
    expect(overridden.overrides.devForceTier).toBe(TIERS.PRO);

    const cleared = entitlementReducer(overridden, {
      type: ENTITLEMENT_ACTIONS.DEV_OVERRIDE_TIER,
      payload: { devForceTier: null },
    });
    expect(cleared.overrides.devForceTier).toBeNull();
  });
});

describe('unknown actions', () => {
  it('returns prior state on unknown action type', () => {
    const next = entitlementReducer(initialEntitlementState, { type: 'SOME_UNKNOWN_TYPE' });
    expect(next).toBe(initialEntitlementState);
  });

  it('returns prior state on missing action type', () => {
    const next = entitlementReducer(initialEntitlementState, {});
    expect(next).toBe(initialEntitlementState);
  });
});

describe('immutability', () => {
  it('does not mutate the input state on TIER_UPGRADED', () => {
    const before = JSON.parse(JSON.stringify(initialEntitlementState));
    entitlementReducer(initialEntitlementState, {
      type: ENTITLEMENT_ACTIONS.TIER_UPGRADED,
      payload: { tier: TIERS.PRO, billingCycle: BILLING_CYCLES.MONTHLY },
    });
    expect(initialEntitlementState).toEqual(before);
  });

  it('returns a new state object on TIER_UPGRADED', () => {
    const next = entitlementReducer(initialEntitlementState, {
      type: ENTITLEMENT_ACTIONS.TIER_UPGRADED,
      payload: { tier: TIERS.PLUS },
    });
    expect(next).not.toBe(initialEntitlementState);
  });

  it('returns the same state object on no-op (unknown action)', () => {
    const next = entitlementReducer(initialEntitlementState, { type: 'NOOP' });
    expect(next).toBe(initialEntitlementState);
  });
});
