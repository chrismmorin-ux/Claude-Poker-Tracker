/**
 * TelemetryConsentContext.test.jsx
 *
 * Tests for TelemetryConsentProvider + useTelemetryConsent consumer hook.
 * Verifies: provider renders + state passthrough, semantic helpers
 * (isCategoryEnabled / shouldShowFirstLaunchPanel / emit) behave per spec,
 * useMemo stability, hook throws outside provider.
 *
 * Mirrors EntitlementContext.test.jsx pattern (canonical sibling, MPMF G5-B1).
 * WS-125 (2026-05-01) — closes the schema-validation drift assertion at
 * src/test/schema-validation.test.js:220-234 (every src/contexts/*.jsx must
 * have a sibling __tests__/*.test.jsx).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import {
  TelemetryConsentProvider,
  useTelemetryConsent,
} from '../TelemetryConsentContext';
import {
  initialTelemetryConsentState,
} from '../../constants/telemetryConsentConstants';
import { TELEMETRY_CATEGORIES } from '../../constants/telemetryEvents';

// Mock the persistence hook so context tests don't hit IDB; persistence is
// tested separately in useTelemetryConsentPersistence.test.js. Mirrors
// EntitlementContext.test.jsx:25-27.
vi.mock('../../hooks/useTelemetryConsentPersistence', () => ({
  useTelemetryConsentPersistence: () => ({ isReady: true }),
}));

// Mock consentGate.emit so we can verify pass-through without firing real
// telemetry. The Provider currying convenience just forwards to gateEmit.
const mockGateEmit = vi.fn();
vi.mock('../../utils/telemetry/consentGate', () => ({
  emit: (...args) => mockGateEmit(...args),
}));

// Test consumer that exposes context value for assertions.
const TestConsumer = ({ onValue }) => {
  const value = useTelemetryConsent();
  React.useEffect(() => {
    onValue(value);
  });
  return <div data-testid="ok">consumer-mounted</div>;
};

const renderWithProvider = (state = initialTelemetryConsentState, dispatch = vi.fn()) => {
  let captured;
  const result = render(
    <TelemetryConsentProvider
      telemetryConsentState={state}
      dispatchTelemetryConsent={dispatch}
    >
      <TestConsumer onValue={(v) => { captured = v; }} />
    </TelemetryConsentProvider>
  );
  return { ...result, getValue: () => captured };
};

describe('TelemetryConsentProvider', () => {
  it('renders children', () => {
    renderWithProvider();
    expect(screen.getByTestId('ok')).toBeInTheDocument();
  });

  it('exposes raw state fields', () => {
    const { getValue } = renderWithProvider();
    const value = getValue();
    expect(value.firstLaunchSeenAt).toBeNull();
    expect(value.categories).toEqual(initialTelemetryConsentState.categories);
    expect(value.schemaVersion).toBe('1.0.0');
  });

  it('exposes dispatchTelemetryConsent', () => {
    const dispatch = vi.fn();
    const { getValue } = renderWithProvider(initialTelemetryConsentState, dispatch);
    expect(getValue().dispatchTelemetryConsent).toBe(dispatch);
  });

  it('marks isReady true (mocked persistence)', () => {
    const { getValue } = renderWithProvider();
    expect(getValue().isReady).toBe(true);
  });
});

describe('useTelemetryConsent — isCategoryEnabled', () => {
  it('returns true when category is enabled', () => {
    const { getValue } = renderWithProvider();
    expect(getValue().isCategoryEnabled(TELEMETRY_CATEGORIES.USAGE)).toBe(true);
  });

  it('returns false when category is disabled', () => {
    const state = {
      ...initialTelemetryConsentState,
      categories: {
        ...initialTelemetryConsentState.categories,
        [TELEMETRY_CATEGORIES.USAGE]: false,
      },
    };
    const { getValue } = renderWithProvider(state);
    expect(getValue().isCategoryEnabled(TELEMETRY_CATEGORIES.USAGE)).toBe(false);
  });

  it('returns false (fail-closed) for unknown category', () => {
    const { getValue } = renderWithProvider();
    expect(getValue().isCategoryEnabled('not_a_real_category')).toBe(false);
  });

  it('returns false for non-string input', () => {
    const { getValue } = renderWithProvider();
    expect(getValue().isCategoryEnabled(null)).toBe(false);
    expect(getValue().isCategoryEnabled(undefined)).toBe(false);
    expect(getValue().isCategoryEnabled(123)).toBe(false);
    expect(getValue().isCategoryEnabled({})).toBe(false);
  });
});

describe('useTelemetryConsent — shouldShowFirstLaunchPanel', () => {
  it('returns true when isReady && firstLaunchSeenAt is null', () => {
    const { getValue } = renderWithProvider();
    expect(getValue().shouldShowFirstLaunchPanel).toBe(true);
  });

  it('returns false when firstLaunchSeenAt is stamped (MPMF-AP-13)', () => {
    const state = {
      ...initialTelemetryConsentState,
      firstLaunchSeenAt: '2026-04-26T10:00:00.000Z',
    };
    const { getValue } = renderWithProvider(state);
    expect(getValue().shouldShowFirstLaunchPanel).toBe(false);
  });
});

describe('useTelemetryConsent — emit (consent-gate pass-through)', () => {
  it('forwards eventName + properties + state to consentGate.emit', () => {
    mockGateEmit.mockClear();
    const { getValue } = renderWithProvider();
    getValue().emit('test_event', { foo: 1 });
    expect(mockGateEmit).toHaveBeenCalledTimes(1);
    expect(mockGateEmit).toHaveBeenCalledWith(
      'test_event',
      { foo: 1 },
      initialTelemetryConsentState,
    );
  });
});

describe('useTelemetryConsent — outside-provider error', () => {
  it('throws "must be used within a TelemetryConsentProvider" when used outside provider', () => {
    // Suppress React's expected console.error for the throw inside render.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Bare = () => {
      useTelemetryConsent();
      return null;
    };
    expect(() => render(<Bare />)).toThrow(/must be used within a TelemetryConsentProvider/);
    consoleSpy.mockRestore();
  });
});
