/**
 * telemetryConsentReducer.test.js
 *
 * MPMF G5-B2 (2026-04-26).
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../utils/errorHandler', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), action: vi.fn() },
  AppError: class AppError extends Error {
    constructor(code, message, context) { super(message); this.code = code; this.context = context; }
  },
  ERROR_CODES: { STATE_CORRUPTION: 'E102', REDUCER_FAILED: 'E103' },
  DEBUG: false,
}));

import {
  telemetryConsentReducer,
  initialTelemetryConsentState,
} from '../telemetryConsentReducer';
import { TELEMETRY_CONSENT_ACTIONS } from '../../constants/telemetryConsentConstants';

describe('initialTelemetryConsentState', () => {
  it('starts with firstLaunchSeenAt null (panel not yet shown)', () => {
    expect(initialTelemetryConsentState.firstLaunchSeenAt).toBeNull();
  });

  it('starts with all 4 categories ON (Q8=B opt-out telemetry)', () => {
    expect(initialTelemetryConsentState.categories.usage).toBe(true);
    expect(initialTelemetryConsentState.categories.session_replay).toBe(true);
    expect(initialTelemetryConsentState.categories.error_tracking).toBe(true);
    expect(initialTelemetryConsentState.categories.feature_flags).toBe(true);
  });

  it('declares schemaVersion', () => {
    expect(initialTelemetryConsentState.schemaVersion).toBe('1.0.0');
  });
});

describe('TELEMETRY_CONSENT_HYDRATED', () => {
  it('replaces state with the hydrated payload', () => {
    const hydrated = {
      firstLaunchSeenAt: '2026-04-26T12:00:00.000Z',
      categories: { usage: true, session_replay: false, error_tracking: true, feature_flags: false },
      schemaVersion: '1.0.0',
    };
    const next = telemetryConsentReducer(initialTelemetryConsentState, {
      type: TELEMETRY_CONSENT_ACTIONS.TELEMETRY_CONSENT_HYDRATED,
      payload: { telemetryConsent: hydrated },
    });
    expect(next.firstLaunchSeenAt).toBe('2026-04-26T12:00:00.000Z');
    expect(next.categories.session_replay).toBe(false);
    expect(next.categories.feature_flags).toBe(false);
  });

  it('keeps state when payload is missing', () => {
    const next = telemetryConsentReducer(initialTelemetryConsentState, {
      type: TELEMETRY_CONSENT_ACTIONS.TELEMETRY_CONSENT_HYDRATED,
      payload: {},
    });
    expect(next).toBe(initialTelemetryConsentState);
  });

  it('keeps state when payload.telemetryConsent is not an object', () => {
    const next = telemetryConsentReducer(initialTelemetryConsentState, {
      type: TELEMETRY_CONSENT_ACTIONS.TELEMETRY_CONSENT_HYDRATED,
      payload: { telemetryConsent: 'broken' },
    });
    expect(next).toBe(initialTelemetryConsentState);
  });

  it('hydrates and merges categories so missing keys inherit defaults (ON)', () => {
    const partial = {
      firstLaunchSeenAt: '2026-04-26T12:00:00.000Z',
      categories: { usage: false }, // session_replay/error_tracking/feature_flags missing
    };
    const next = telemetryConsentReducer(initialTelemetryConsentState, {
      type: TELEMETRY_CONSENT_ACTIONS.TELEMETRY_CONSENT_HYDRATED,
      payload: { telemetryConsent: partial },
    });
    expect(next.categories.usage).toBe(false);
    expect(next.categories.session_replay).toBe(true);
    expect(next.categories.error_tracking).toBe(true);
    expect(next.categories.feature_flags).toBe(true);
  });
});

describe('FIRST_LAUNCH_DISMISSED', () => {
  it('stamps firstLaunchSeenAt with a fresh ISO timestamp', () => {
    const next = telemetryConsentReducer(initialTelemetryConsentState, {
      type: TELEMETRY_CONSENT_ACTIONS.FIRST_LAUNCH_DISMISSED,
    });
    expect(next.firstLaunchSeenAt).not.toBeNull();
    expect(typeof next.firstLaunchSeenAt).toBe('string');
    expect(new Date(next.firstLaunchSeenAt).toISOString()).toBe(next.firstLaunchSeenAt);
  });

  it('uses payload.dismissedAt when provided', () => {
    const fixedDate = '2026-04-26T08:00:00.000Z';
    const next = telemetryConsentReducer(initialTelemetryConsentState, {
      type: TELEMETRY_CONSENT_ACTIONS.FIRST_LAUNCH_DISMISSED,
      payload: { dismissedAt: fixedDate },
    });
    expect(next.firstLaunchSeenAt).toBe(fixedDate);
  });

  it('is idempotent — re-firing does not overwrite the timestamp (MPMF-AP-13)', () => {
    const first = telemetryConsentReducer(initialTelemetryConsentState, {
      type: TELEMETRY_CONSENT_ACTIONS.FIRST_LAUNCH_DISMISSED,
      payload: { dismissedAt: '2026-04-26T08:00:00.000Z' },
    });
    const second = telemetryConsentReducer(first, {
      type: TELEMETRY_CONSENT_ACTIONS.FIRST_LAUNCH_DISMISSED,
      payload: { dismissedAt: '2026-04-27T09:00:00.000Z' }, // attempt to overwrite
    });
    expect(second.firstLaunchSeenAt).toBe('2026-04-26T08:00:00.000Z');
    expect(second).toBe(first); // no state change at all
  });

  it('does not modify category state', () => {
    const next = telemetryConsentReducer(initialTelemetryConsentState, {
      type: TELEMETRY_CONSENT_ACTIONS.FIRST_LAUNCH_DISMISSED,
    });
    expect(next.categories).toEqual(initialTelemetryConsentState.categories);
  });
});

describe('CATEGORY_TOGGLED', () => {
  it('flips a known category to false', () => {
    const next = telemetryConsentReducer(initialTelemetryConsentState, {
      type: TELEMETRY_CONSENT_ACTIONS.CATEGORY_TOGGLED,
      payload: { category: 'usage', enabled: false },
    });
    expect(next.categories.usage).toBe(false);
    expect(next.categories.session_replay).toBe(true);
  });

  it('flips a known category back to true', () => {
    const turnedOff = telemetryConsentReducer(initialTelemetryConsentState, {
      type: TELEMETRY_CONSENT_ACTIONS.CATEGORY_TOGGLED,
      payload: { category: 'session_replay', enabled: false },
    });
    const turnedOn = telemetryConsentReducer(turnedOff, {
      type: TELEMETRY_CONSENT_ACTIONS.CATEGORY_TOGGLED,
      payload: { category: 'session_replay', enabled: true },
    });
    expect(turnedOn.categories.session_replay).toBe(true);
  });

  it('ignores unknown categories (defensive)', () => {
    const next = telemetryConsentReducer(initialTelemetryConsentState, {
      type: TELEMETRY_CONSENT_ACTIONS.CATEGORY_TOGGLED,
      payload: { category: 'made_up_category', enabled: true },
    });
    expect(next).toBe(initialTelemetryConsentState);
  });

  it('ignores non-string category', () => {
    const next = telemetryConsentReducer(initialTelemetryConsentState, {
      type: TELEMETRY_CONSENT_ACTIONS.CATEGORY_TOGGLED,
      payload: { category: 42, enabled: true },
    });
    expect(next).toBe(initialTelemetryConsentState);
  });

  it('ignores non-boolean enabled', () => {
    const next = telemetryConsentReducer(initialTelemetryConsentState, {
      type: TELEMETRY_CONSENT_ACTIONS.CATEGORY_TOGGLED,
      payload: { category: 'usage', enabled: 'yes' },
    });
    expect(next).toBe(initialTelemetryConsentState);
  });

  it('does not modify firstLaunchSeenAt', () => {
    const dismissed = { ...initialTelemetryConsentState, firstLaunchSeenAt: '2026-04-26T08:00:00.000Z' };
    const next = telemetryConsentReducer(dismissed, {
      type: TELEMETRY_CONSENT_ACTIONS.CATEGORY_TOGGLED,
      payload: { category: 'usage', enabled: false },
    });
    expect(next.firstLaunchSeenAt).toBe('2026-04-26T08:00:00.000Z');
  });
});

describe('RESET_TO_DEFAULTS', () => {
  it('restores all categories to ON', () => {
    const allOff = {
      ...initialTelemetryConsentState,
      categories: { usage: false, session_replay: false, error_tracking: false, feature_flags: false },
    };
    const next = telemetryConsentReducer(allOff, { type: TELEMETRY_CONSENT_ACTIONS.RESET_TO_DEFAULTS });
    expect(next.categories.usage).toBe(true);
    expect(next.categories.session_replay).toBe(true);
    expect(next.categories.error_tracking).toBe(true);
    expect(next.categories.feature_flags).toBe(true);
  });

  it('does NOT clear firstLaunchSeenAt (MPMF-AP-13: panel never re-fires)', () => {
    const dismissed = { ...initialTelemetryConsentState, firstLaunchSeenAt: '2026-04-26T08:00:00.000Z' };
    const next = telemetryConsentReducer(dismissed, { type: TELEMETRY_CONSENT_ACTIONS.RESET_TO_DEFAULTS });
    expect(next.firstLaunchSeenAt).toBe('2026-04-26T08:00:00.000Z');
  });
});

describe('NEW_CATEGORY_REGISTERED', () => {
  it('adds an unknown category in OFF state (MPMF-AP-13: no inheritance)', () => {
    const next = telemetryConsentReducer(initialTelemetryConsentState, {
      type: TELEMETRY_CONSENT_ACTIONS.NEW_CATEGORY_REGISTERED,
      payload: { category: 'experimental_metric' },
    });
    expect(next.categories.experimental_metric).toBe(false);
  });

  it('does NOT inherit ON state from existing categories', () => {
    expect(initialTelemetryConsentState.categories.usage).toBe(true);
    const next = telemetryConsentReducer(initialTelemetryConsentState, {
      type: TELEMETRY_CONSENT_ACTIONS.NEW_CATEGORY_REGISTERED,
      payload: { category: 'experimental_metric' },
    });
    expect(next.categories.experimental_metric).toBe(false); // not true
  });

  it('is a no-op for an already-known category', () => {
    const next = telemetryConsentReducer(initialTelemetryConsentState, {
      type: TELEMETRY_CONSENT_ACTIONS.NEW_CATEGORY_REGISTERED,
      payload: { category: 'usage' },
    });
    expect(next).toBe(initialTelemetryConsentState);
  });

  it('preserves prior category preferences for existing categories', () => {
    const usageOff = {
      ...initialTelemetryConsentState,
      categories: { ...initialTelemetryConsentState.categories, usage: false },
    };
    const next = telemetryConsentReducer(usageOff, {
      type: TELEMETRY_CONSENT_ACTIONS.NEW_CATEGORY_REGISTERED,
      payload: { category: 'experimental_metric' },
    });
    expect(next.categories.usage).toBe(false); // preserved
    expect(next.categories.experimental_metric).toBe(false); // new, off
  });
});

describe('unknown action types', () => {
  it('returns the same state reference', () => {
    const next = telemetryConsentReducer(initialTelemetryConsentState, { type: 'NOT_AN_ACTION' });
    expect(next).toBe(initialTelemetryConsentState);
  });
});
