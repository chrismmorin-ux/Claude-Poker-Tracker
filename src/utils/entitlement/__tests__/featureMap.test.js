/**
 * featureMap.test.js
 *
 * Unit tests for entitlement feature → tier mapping + access helpers.
 * MPMF G5-B1 (2026-04-25).
 */

import { describe, it, expect } from 'vitest';
import {
  FEATURE_TIER,
  TIER_ORDER,
  isAtLeast,
  hasAccessTo,
  resolveEffectiveTier,
} from '../featureMap';
import { TIERS, initialEntitlementState } from '../../../constants/entitlementConstants';

describe('FEATURE_TIER', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(FEATURE_TIER)).toBe(true);
  });

  it('has free-tier features assigned to free', () => {
    expect(FEATURE_TIER.HAND_ENTRY).toBe(TIERS.FREE);
    expect(FEATURE_TIER.LIVE_EXPLOIT_ENGINE).toBe(TIERS.FREE);
    expect(FEATURE_TIER.END_OF_SESSION_RECAP).toBe(TIERS.FREE);
    expect(FEATURE_TIER.SAMPLE_DATA_MODE).toBe(TIERS.FREE);
  });

  it('has plus features assigned to plus', () => {
    expect(FEATURE_TIER.CROSS_SESSION_HISTORY).toBe(TIERS.PLUS);
    expect(FEATURE_TIER.VILLAIN_MODELS_PERSISTED).toBe(TIERS.PLUS);
    expect(FEATURE_TIER.BASIC_DRILLS).toBe(TIERS.PLUS);
  });

  it('has pro features assigned to pro', () => {
    expect(FEATURE_TIER.GAME_TREE_DEEP_ANALYSIS).toBe(TIERS.PRO);
    expect(FEATURE_TIER.EXPLOIT_ANCHOR_LIBRARY).toBe(TIERS.PRO);
    expect(FEATURE_TIER.CALIBRATION_DASHBOARD).toBe(TIERS.PRO);
    expect(FEATURE_TIER.ADVANCED_DRILLS).toBe(TIERS.PRO);
    expect(FEATURE_TIER.PRINTABLE_REFRESHER).toBe(TIERS.PRO);
  });

  it('reserves IGNITION_SIDEBAR for the ignition lane', () => {
    expect(FEATURE_TIER.IGNITION_SIDEBAR).toBe(TIERS.IGNITION);
  });
});

describe('TIER_ORDER', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(TIER_ORDER)).toBe(true);
  });

  it('orders the linear ladder free < plus < pro', () => {
    expect(TIER_ORDER[TIERS.FREE]).toBeLessThan(TIER_ORDER[TIERS.PLUS]);
    expect(TIER_ORDER[TIERS.PLUS]).toBeLessThan(TIER_ORDER[TIERS.PRO]);
  });

  it('ranks founding-lifetime equal to pro (feature-equivalent)', () => {
    expect(TIER_ORDER[TIERS.FOUNDING_LIFETIME]).toBe(TIER_ORDER[TIERS.PRO]);
  });

  it('places ignition in a separate lane (rank 99)', () => {
    expect(TIER_ORDER[TIERS.IGNITION]).toBeGreaterThan(TIER_ORDER[TIERS.PRO]);
    expect(TIER_ORDER[TIERS.IGNITION]).toBe(99);
  });
});

describe('isAtLeast', () => {
  it('returns true when tiers are equal', () => {
    expect(isAtLeast(TIERS.FREE, TIERS.FREE)).toBe(true);
    expect(isAtLeast(TIERS.PLUS, TIERS.PLUS)).toBe(true);
    expect(isAtLeast(TIERS.PRO, TIERS.PRO)).toBe(true);
  });

  it('returns true when current tier ranks higher', () => {
    expect(isAtLeast(TIERS.PLUS, TIERS.FREE)).toBe(true);
    expect(isAtLeast(TIERS.PRO, TIERS.PLUS)).toBe(true);
    expect(isAtLeast(TIERS.PRO, TIERS.FREE)).toBe(true);
  });

  it('returns false when current tier ranks lower', () => {
    expect(isAtLeast(TIERS.FREE, TIERS.PLUS)).toBe(false);
    expect(isAtLeast(TIERS.PLUS, TIERS.PRO)).toBe(false);
    expect(isAtLeast(TIERS.FREE, TIERS.PRO)).toBe(false);
  });

  it('treats founding-lifetime as pro for feature access', () => {
    expect(isAtLeast(TIERS.FOUNDING_LIFETIME, TIERS.FREE)).toBe(true);
    expect(isAtLeast(TIERS.FOUNDING_LIFETIME, TIERS.PLUS)).toBe(true);
    expect(isAtLeast(TIERS.FOUNDING_LIFETIME, TIERS.PRO)).toBe(true);
  });

  it('places ignition above pro (separate lane)', () => {
    expect(isAtLeast(TIERS.IGNITION, TIERS.PRO)).toBe(true);
    expect(isAtLeast(TIERS.IGNITION, TIERS.PLUS)).toBe(true);
    expect(isAtLeast(TIERS.IGNITION, TIERS.FREE)).toBe(true);
  });

  it('treats pro as below ignition (separate lane gating)', () => {
    expect(isAtLeast(TIERS.PRO, TIERS.IGNITION)).toBe(false);
    expect(isAtLeast(TIERS.FOUNDING_LIFETIME, TIERS.IGNITION)).toBe(false);
  });

  it('throws on unknown currentTier', () => {
    expect(() => isAtLeast('mystery-tier', TIERS.FREE)).toThrow(/unknown currentTier/);
  });

  it('throws on unknown requiredTier', () => {
    expect(() => isAtLeast(TIERS.FREE, 'mystery-tier')).toThrow(/unknown requiredTier/);
  });
});

describe('hasAccessTo', () => {
  it('grants access when tier matches the required tier', () => {
    expect(hasAccessTo(TIERS.FREE, FEATURE_TIER.HAND_ENTRY)).toBe(true);
    expect(hasAccessTo(TIERS.PLUS, FEATURE_TIER.CROSS_SESSION_HISTORY)).toBe(true);
    expect(hasAccessTo(TIERS.PRO, FEATURE_TIER.GAME_TREE_DEEP_ANALYSIS)).toBe(true);
  });

  it('grants access when tier ranks above the required tier', () => {
    expect(hasAccessTo(TIERS.PLUS, FEATURE_TIER.HAND_ENTRY)).toBe(true);
    expect(hasAccessTo(TIERS.PRO, FEATURE_TIER.CROSS_SESSION_HISTORY)).toBe(true);
    expect(hasAccessTo(TIERS.PRO, FEATURE_TIER.HAND_ENTRY)).toBe(true);
  });

  it('denies access when tier ranks below the required tier', () => {
    expect(hasAccessTo(TIERS.FREE, FEATURE_TIER.CROSS_SESSION_HISTORY)).toBe(false);
    expect(hasAccessTo(TIERS.FREE, FEATURE_TIER.GAME_TREE_DEEP_ANALYSIS)).toBe(false);
    expect(hasAccessTo(TIERS.PLUS, FEATURE_TIER.GAME_TREE_DEEP_ANALYSIS)).toBe(false);
  });

  it('grants founding-lifetime access to all pro features', () => {
    expect(hasAccessTo(TIERS.FOUNDING_LIFETIME, FEATURE_TIER.HAND_ENTRY)).toBe(true);
    expect(hasAccessTo(TIERS.FOUNDING_LIFETIME, FEATURE_TIER.CROSS_SESSION_HISTORY)).toBe(true);
    expect(hasAccessTo(TIERS.FOUNDING_LIFETIME, FEATURE_TIER.GAME_TREE_DEEP_ANALYSIS)).toBe(true);
    expect(hasAccessTo(TIERS.FOUNDING_LIFETIME, FEATURE_TIER.EXPLOIT_ANCHOR_LIBRARY)).toBe(true);
    expect(hasAccessTo(TIERS.FOUNDING_LIFETIME, FEATURE_TIER.PRINTABLE_REFRESHER)).toBe(true);
  });

  it('denies free-tier access to ignition features', () => {
    expect(hasAccessTo(TIERS.FREE, FEATURE_TIER.IGNITION_SIDEBAR)).toBe(false);
    expect(hasAccessTo(TIERS.PLUS, FEATURE_TIER.IGNITION_SIDEBAR)).toBe(false);
    expect(hasAccessTo(TIERS.PRO, FEATURE_TIER.IGNITION_SIDEBAR)).toBe(false);
    expect(hasAccessTo(TIERS.FOUNDING_LIFETIME, FEATURE_TIER.IGNITION_SIDEBAR)).toBe(false);
  });

  it('throws on a feature value not in FEATURE_TIER', () => {
    expect(() => hasAccessTo(TIERS.FREE, 'totally-made-up-feature')).toThrow(/not a value in FEATURE_TIER/);
  });
});

describe('resolveEffectiveTier', () => {
  it('returns the tier from state when no override', () => {
    const state = { ...initialEntitlementState, tier: TIERS.PRO };
    expect(resolveEffectiveTier(state)).toBe(TIERS.PRO);
  });

  it('respects dev override when present', () => {
    const state = {
      ...initialEntitlementState,
      tier: TIERS.FREE,
      overrides: { devForceTier: TIERS.PRO },
    };
    expect(resolveEffectiveTier(state)).toBe(TIERS.PRO);
  });

  it('ignores invalid override values', () => {
    const state = {
      ...initialEntitlementState,
      tier: TIERS.FREE,
      overrides: { devForceTier: 'mystery-tier' },
    };
    expect(resolveEffectiveTier(state)).toBe(TIERS.FREE);
  });

  it('falls back to free when state is null/undefined', () => {
    expect(resolveEffectiveTier(null)).toBe(TIERS.FREE);
    expect(resolveEffectiveTier(undefined)).toBe(TIERS.FREE);
    expect(resolveEffectiveTier({})).toBe(TIERS.FREE);
  });

  it('falls back to free when overrides is missing', () => {
    const state = { tier: TIERS.PLUS };
    expect(resolveEffectiveTier(state)).toBe(TIERS.PLUS);
  });
});
