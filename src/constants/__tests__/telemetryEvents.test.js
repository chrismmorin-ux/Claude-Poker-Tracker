/**
 * telemetryEvents.test.js — Registry shape + integrity tests
 *
 * MPMF G5-B2 (2026-04-26).
 */

import { describe, it, expect } from 'vitest';
import {
  TELEMETRY_EVENTS,
  TELEMETRY_CATEGORIES,
  EVENT_TO_CATEGORY,
  VALID_CATEGORIES,
  getCategoryForEvent,
} from '../telemetryEvents';

describe('TELEMETRY_CATEGORIES', () => {
  it('exposes exactly the 4 consent categories', () => {
    expect(VALID_CATEGORIES).toHaveLength(4);
    expect(VALID_CATEGORIES).toEqual(
      expect.arrayContaining(['usage', 'session_replay', 'error_tracking', 'feature_flags'])
    );
  });

  it('is frozen', () => {
    expect(Object.isFrozen(TELEMETRY_CATEGORIES)).toBe(true);
    expect(Object.isFrozen(VALID_CATEGORIES)).toBe(true);
  });
});

describe('TELEMETRY_EVENTS', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(TELEMETRY_EVENTS)).toBe(true);
  });

  it('declares the consent self-instrumentation events (so they can be emitted from the panel)', () => {
    expect(TELEMETRY_EVENTS.CONSENT_PANEL_SHOWN).toBe('consent_panel_shown');
    expect(TELEMETRY_EVENTS.CONSENT_PANEL_DISMISSED).toBe('consent_panel_dismissed');
    expect(TELEMETRY_EVENTS.CONSENT_CATEGORY_TOGGLED).toBe('consent_category_toggled');
  });

  it('declares the error_captured event for error tracking', () => {
    expect(TELEMETRY_EVENTS.ERROR_CAPTURED).toBe('error_captured');
  });

  it('uses snake_case for every event value', () => {
    Object.values(TELEMETRY_EVENTS).forEach((eventName) => {
      expect(eventName).toMatch(/^[a-z][a-z0-9_]*$/);
    });
  });

  it('has unique values (no duplicate event names)', () => {
    const values = Object.values(TELEMETRY_EVENTS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('EVENT_TO_CATEGORY', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(EVENT_TO_CATEGORY)).toBe(true);
  });

  it('maps every event in TELEMETRY_EVENTS to a category (no missing entries)', () => {
    Object.values(TELEMETRY_EVENTS).forEach((eventName) => {
      expect(EVENT_TO_CATEGORY[eventName]).toBeDefined();
    });
  });

  it('maps every event to a value in VALID_CATEGORIES', () => {
    Object.values(EVENT_TO_CATEGORY).forEach((category) => {
      expect(VALID_CATEGORIES).toContain(category);
    });
  });

  it('routes error_captured to error_tracking category', () => {
    expect(EVENT_TO_CATEGORY[TELEMETRY_EVENTS.ERROR_CAPTURED]).toBe(TELEMETRY_CATEGORIES.ERROR_TRACKING);
  });

  it('routes feature_flag_evaluated to feature_flags category', () => {
    expect(EVENT_TO_CATEGORY[TELEMETRY_EVENTS.FEATURE_FLAG_EVALUATED]).toBe(TELEMETRY_CATEGORIES.FEATURE_FLAGS);
  });

  it('routes session_replay_started to session_replay category', () => {
    expect(EVENT_TO_CATEGORY[TELEMETRY_EVENTS.SESSION_REPLAY_STARTED]).toBe(TELEMETRY_CATEGORIES.SESSION_REPLAY);
  });

  it('routes consent_panel_shown to usage category', () => {
    expect(EVENT_TO_CATEGORY[TELEMETRY_EVENTS.CONSENT_PANEL_SHOWN]).toBe(TELEMETRY_CATEGORIES.USAGE);
  });
});

describe('getCategoryForEvent', () => {
  it('returns the mapped category for known events', () => {
    expect(getCategoryForEvent(TELEMETRY_EVENTS.SESSION_STARTED)).toBe(TELEMETRY_CATEGORIES.USAGE);
    expect(getCategoryForEvent(TELEMETRY_EVENTS.ERROR_CAPTURED)).toBe(TELEMETRY_CATEGORIES.ERROR_TRACKING);
  });

  it('returns null for unknown events (fail-closed at the gate)', () => {
    expect(getCategoryForEvent('not_a_real_event')).toBeNull();
    expect(getCategoryForEvent('')).toBeNull();
  });

  it('returns null for non-string inputs', () => {
    expect(getCategoryForEvent(null)).toBeNull();
    expect(getCategoryForEvent(undefined)).toBeNull();
    expect(getCategoryForEvent(42)).toBeNull();
    expect(getCategoryForEvent({})).toBeNull();
  });
});
