/**
 * consentGate.test.js
 *
 * Table-driven tests for shouldEmit() across every category × state combo,
 * plus the defensive re_engage_* guard. emit() is tested via the postHog
 * adapter mock to confirm forward/drop dispatch.
 *
 * MPMF G5-B2 (2026-04-26).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../postHogAdapter', () => ({
  capture: vi.fn(),
}));

vi.mock('../../errorHandler', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  DEBUG: false,
}));

import { shouldEmit, emit } from '../consentGate';
import * as postHogAdapter from '../postHogAdapter';
import { TELEMETRY_EVENTS } from '../../../constants/telemetryEvents';

const consentAllOn = {
  firstLaunchSeenAt: '2026-04-26T12:00:00.000Z',
  categories: {
    usage: true,
    session_replay: true,
    error_tracking: true,
    feature_flags: true,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('shouldEmit() — fail-closed defaults', () => {
  it('drops unknown event names', () => {
    expect(shouldEmit('not_a_real_event', consentAllOn)).toBe(false);
  });

  it('drops when telemetryConsent is null', () => {
    expect(shouldEmit(TELEMETRY_EVENTS.SESSION_STARTED, null)).toBe(false);
  });

  it('drops when telemetryConsent is undefined', () => {
    expect(shouldEmit(TELEMETRY_EVENTS.SESSION_STARTED, undefined)).toBe(false);
  });

  it('drops when consent is not an object', () => {
    expect(shouldEmit(TELEMETRY_EVENTS.SESSION_STARTED, 'not an object')).toBe(false);
  });

  it('drops when categories key is missing', () => {
    expect(shouldEmit(TELEMETRY_EVENTS.SESSION_STARTED, { firstLaunchSeenAt: '2026-04-26' })).toBe(false);
  });
});

describe('shouldEmit() — pre-consent gate', () => {
  it('drops every event when firstLaunchSeenAt is null (panel not yet dismissed)', () => {
    const preConsent = { ...consentAllOn, firstLaunchSeenAt: null };
    expect(shouldEmit(TELEMETRY_EVENTS.SESSION_STARTED, preConsent)).toBe(false);
    expect(shouldEmit(TELEMETRY_EVENTS.ERROR_CAPTURED, preConsent)).toBe(false);
    expect(shouldEmit(TELEMETRY_EVENTS.CONSENT_PANEL_DISMISSED, preConsent)).toBe(false);
  });

  it('drops every event when firstLaunchSeenAt is undefined', () => {
    const preConsent = { ...consentAllOn, firstLaunchSeenAt: undefined };
    expect(shouldEmit(TELEMETRY_EVENTS.SESSION_STARTED, preConsent)).toBe(false);
  });
});

describe('shouldEmit() — category opt-out', () => {
  it('drops usage events when usage category is off', () => {
    const consent = { ...consentAllOn, categories: { ...consentAllOn.categories, usage: false } };
    expect(shouldEmit(TELEMETRY_EVENTS.SESSION_STARTED, consent)).toBe(false);
  });

  it('drops error_captured when error_tracking is off', () => {
    const consent = { ...consentAllOn, categories: { ...consentAllOn.categories, error_tracking: false } };
    expect(shouldEmit(TELEMETRY_EVENTS.ERROR_CAPTURED, consent)).toBe(false);
  });

  it('drops feature_flag_evaluated when feature_flags is off', () => {
    const consent = { ...consentAllOn, categories: { ...consentAllOn.categories, feature_flags: false } };
    expect(shouldEmit(TELEMETRY_EVENTS.FEATURE_FLAG_EVALUATED, consent)).toBe(false);
  });

  it('drops session_replay_started when session_replay is off', () => {
    const consent = { ...consentAllOn, categories: { ...consentAllOn.categories, session_replay: false } };
    expect(shouldEmit(TELEMETRY_EVENTS.SESSION_REPLAY_STARTED, consent)).toBe(false);
  });

  it('forwards usage event when usage category is on but session_replay is off', () => {
    const consent = { ...consentAllOn, categories: { ...consentAllOn.categories, session_replay: false } };
    expect(shouldEmit(TELEMETRY_EVENTS.SESSION_STARTED, consent)).toBe(true);
  });
});

describe('shouldEmit() — happy path', () => {
  it('forwards usage events when consent is fully on', () => {
    expect(shouldEmit(TELEMETRY_EVENTS.SESSION_STARTED, consentAllOn)).toBe(true);
    expect(shouldEmit(TELEMETRY_EVENTS.PAYMENT_SUCCESS, consentAllOn)).toBe(true);
    expect(shouldEmit(TELEMETRY_EVENTS.UPGRADE_ACTION_TAKEN, consentAllOn)).toBe(true);
  });

  it('forwards error_tracking events independently', () => {
    expect(shouldEmit(TELEMETRY_EVENTS.ERROR_CAPTURED, consentAllOn)).toBe(true);
  });

  it('forwards feature_flag events independently', () => {
    expect(shouldEmit(TELEMETRY_EVENTS.FEATURE_FLAG_EVALUATED, consentAllOn)).toBe(true);
  });
});

describe('shouldEmit() — defensive re_engage_* guard (MPMF-AP-04)', () => {
  it('drops re_engage_* events even when consent is fully on', () => {
    expect(shouldEmit('re_engage_email_sent', consentAllOn)).toBe(false);
    expect(shouldEmit('re_engage_push_clicked', consentAllOn)).toBe(false);
  });

  it('handles non-string event names without crashing (drops)', () => {
    expect(shouldEmit(null, consentAllOn)).toBe(false);
    expect(shouldEmit(undefined, consentAllOn)).toBe(false);
    expect(shouldEmit(42, consentAllOn)).toBe(false);
    expect(shouldEmit({}, consentAllOn)).toBe(false);
  });
});

describe('emit() — dispatch behavior', () => {
  it('calls postHogAdapter.capture when shouldEmit returns true', () => {
    emit(TELEMETRY_EVENTS.SESSION_STARTED, { userId: 'guest' }, consentAllOn);
    expect(postHogAdapter.capture).toHaveBeenCalledWith('session_started', { userId: 'guest' });
  });

  it('does NOT call postHogAdapter.capture when shouldEmit returns false (silent drop)', () => {
    const consentOff = { ...consentAllOn, categories: { ...consentAllOn.categories, usage: false } };
    emit(TELEMETRY_EVENTS.SESSION_STARTED, { userId: 'guest' }, consentOff);
    expect(postHogAdapter.capture).not.toHaveBeenCalled();
  });

  it('does NOT call postHogAdapter.capture pre-consent', () => {
    const preConsent = { ...consentAllOn, firstLaunchSeenAt: null };
    emit(TELEMETRY_EVENTS.SESSION_STARTED, {}, preConsent);
    expect(postHogAdapter.capture).not.toHaveBeenCalled();
  });

  it('does NOT call postHogAdapter.capture for re_engage_* events', () => {
    emit('re_engage_promo', {}, consentAllOn);
    expect(postHogAdapter.capture).not.toHaveBeenCalled();
  });
});
