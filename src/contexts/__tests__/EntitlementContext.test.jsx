/**
 * EntitlementContext.test.jsx
 *
 * Tests for EntitlementProvider + useEntitlement consumer hook.
 * Verifies: provider renders + state passthrough, semantic helpers behave
 * correctly across tiers, useMemo stability, hook throws outside provider.
 *
 * MPMF G5-B1 (2026-04-25).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { EntitlementProvider, useEntitlement } from '../EntitlementContext';
import {
  initialEntitlementState,
  ENTITLEMENT_ACTIONS,
  TIERS,
  BILLING_CYCLES,
} from '../../constants/entitlementConstants';
import { FEATURE_TIER } from '../../utils/entitlement/featureMap';

// Mock the persistence hook so context tests don't hit IDB; we test
// persistence separately in useEntitlementPersistence.test.js
vi.mock('../../hooks/useEntitlementPersistence', () => ({
  useEntitlementPersistence: () => ({ isReady: true }),
}));

// Test consumer that exposes context value for assertions
const TestConsumer = ({ onValue }) => {
  const value = useEntitlement();
  React.useEffect(() => {
    onValue(value);
  });
  return <div data-testid="ok">consumer-mounted</div>;
};

const renderWithProvider = (state = initialEntitlementState, dispatch = vi.fn()) => {
  let captured;
  const result = render(
    <EntitlementProvider entitlementState={state} dispatchEntitlement={dispatch}>
      <TestConsumer onValue={(v) => { captured = v; }} />
    </EntitlementProvider>
  );
  return { ...result, getValue: () => captured };
};

describe('EntitlementProvider', () => {
  it('renders children', () => {
    renderWithProvider();
    expect(screen.getByTestId('ok')).toBeInTheDocument();
  });

  it('exposes raw state fields', () => {
    const { getValue } = renderWithProvider();
    const value = getValue();
    expect(value.tier).toBe(TIERS.FREE);
    expect(value.cohort).toBe('standard');
  });

  it('exposes dispatchEntitlement', () => {
    const dispatch = vi.fn();
    const { getValue } = renderWithProvider(initialEntitlementState, dispatch);
    expect(getValue().dispatchEntitlement).toBe(dispatch);
  });

  it('marks isReady true (mocked persistence)', () => {
    const { getValue } = renderWithProvider();
    expect(getValue().isReady).toBe(true);
  });

  it('exposes effectiveTier matching state.tier when no override', () => {
    const state = { ...initialEntitlementState, tier: TIERS.PRO };
    const { getValue } = renderWithProvider(state);
    expect(getValue().effectiveTier).toBe(TIERS.PRO);
  });

  it('respects dev override in effectiveTier', () => {
    const state = {
      ...initialEntitlementState,
      tier: TIERS.FREE,
      overrides: { devForceTier: TIERS.PRO },
    };
    const { getValue } = renderWithProvider(state);
    expect(getValue().effectiveTier).toBe(TIERS.PRO);
  });
});

describe('useEntitlement helpers', () => {
  it('isAtLeast respects effective tier', () => {
    const state = { ...initialEntitlementState, tier: TIERS.PLUS };
    const { getValue } = renderWithProvider(state);
    const value = getValue();
    expect(value.isAtLeast(TIERS.FREE)).toBe(true);
    expect(value.isAtLeast(TIERS.PLUS)).toBe(true);
    expect(value.isAtLeast(TIERS.PRO)).toBe(false);
  });

  it('hasAccessTo grants free-tier features to free users', () => {
    const { getValue } = renderWithProvider();
    const value = getValue();
    expect(value.hasAccessTo(FEATURE_TIER.HAND_ENTRY)).toBe(true);
    expect(value.hasAccessTo(FEATURE_TIER.LIVE_EXPLOIT_ENGINE)).toBe(true);
  });

  it('hasAccessTo denies pro features to free users', () => {
    const { getValue } = renderWithProvider();
    const value = getValue();
    expect(value.hasAccessTo(FEATURE_TIER.GAME_TREE_DEEP_ANALYSIS)).toBe(false);
    expect(value.hasAccessTo(FEATURE_TIER.EXPLOIT_ANCHOR_LIBRARY)).toBe(false);
  });

  it('hasAccessTo grants pro features to founding-lifetime users', () => {
    const state = { ...initialEntitlementState, tier: TIERS.FOUNDING_LIFETIME };
    const { getValue } = renderWithProvider(state);
    const value = getValue();
    expect(value.hasAccessTo(FEATURE_TIER.GAME_TREE_DEEP_ANALYSIS)).toBe(true);
    expect(value.hasAccessTo(FEATURE_TIER.PRINTABLE_REFRESHER)).toBe(true);
  });

  it('isCancellationGrace returns true when cancelled', () => {
    const state = {
      ...initialEntitlementState,
      tier: TIERS.PRO,
      cancellation: {
        isCancelled: true,
        canceledAt: '2026-04-25T00:00:00.000Z',
        accessThrough: '2026-05-25T00:00:00.000Z',
      },
    };
    const { getValue } = renderWithProvider(state);
    expect(getValue().isCancellationGrace()).toBe(true);
  });

  it('isCancellationGrace returns false by default', () => {
    const { getValue } = renderWithProvider();
    expect(getValue().isCancellationGrace()).toBe(false);
  });

  it('isPendingPlanChange reports correctly', () => {
    const state = {
      ...initialEntitlementState,
      tier: TIERS.PRO,
      pendingPlanChange: {
        isActive: true,
        targetTier: TIERS.PLUS,
        effectiveDate: '2026-05-25T00:00:00.000Z',
      },
    };
    const { getValue } = renderWithProvider(state);
    expect(getValue().isPendingPlanChange()).toBe(true);
  });

  it('isCardDeclineGrace reports correctly', () => {
    const state = {
      ...initialEntitlementState,
      tier: TIERS.PRO,
      cardDecline: {
        isActive: true,
        declinedAt: '2026-04-25T00:00:00.000Z',
        graceUntil: '2026-05-02T00:00:00.000Z',
      },
    };
    const { getValue } = renderWithProvider(state);
    expect(getValue().isCardDeclineGrace()).toBe(true);
  });
});

describe('useMemo stability', () => {
  it('returns the same value object across re-renders with unchanged state', () => {
    const dispatch = vi.fn();
    let capturedFirst, capturedSecond;
    const Capture = ({ slot }) => {
      const v = useEntitlement();
      if (slot === 1) capturedFirst = v;
      else capturedSecond = v;
      return null;
    };

    const Component = ({ children }) => (
      <EntitlementProvider entitlementState={initialEntitlementState} dispatchEntitlement={dispatch}>
        {children}
      </EntitlementProvider>
    );

    const { rerender } = render(<Component><Capture slot={1} /></Component>);
    rerender(<Component><Capture slot={2} /></Component>);
    expect(capturedFirst).toBe(capturedSecond);
  });

  it('returns a new value object when state changes', () => {
    let captured;
    const Capture = () => {
      captured = useEntitlement();
      return null;
    };

    const { rerender } = render(
      <EntitlementProvider entitlementState={initialEntitlementState} dispatchEntitlement={vi.fn()}>
        <Capture />
      </EntitlementProvider>
    );
    const firstValue = captured;

    rerender(
      <EntitlementProvider entitlementState={{ ...initialEntitlementState, tier: TIERS.PRO }} dispatchEntitlement={vi.fn()}>
        <Capture />
      </EntitlementProvider>
    );
    expect(captured).not.toBe(firstValue);
    expect(captured.tier).toBe(TIERS.PRO);
  });
});

describe('useEntitlement consumer hook', () => {
  it('throws when used outside provider', () => {
    const Bad = () => {
      useEntitlement();
      return null;
    };
    // Suppress React's expected error log for this assertion
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(/useEntitlement must be used within an EntitlementProvider/);
    spy.mockRestore();
  });

  it('returns the same hook value as the provider value', () => {
    const dispatch = vi.fn();
    const state = { ...initialEntitlementState, tier: TIERS.PLUS };
    const { getValue } = renderWithProvider(state, dispatch);
    const value = getValue();
    expect(value.tier).toBe(TIERS.PLUS);
    expect(value.dispatchEntitlement).toBe(dispatch);
    expect(typeof value.isAtLeast).toBe('function');
    expect(typeof value.hasAccessTo).toBe('function');
  });
});
