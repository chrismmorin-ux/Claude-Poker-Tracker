/**
 * telemetryConsentConstants.js — Telemetry consent state constants
 *
 * Source of truth for telemetry consent action types, initial state, and
 * validation schema. Mirrors `entitlementConstants.js` shape.
 *
 * MPMF G5-B2 (2026-04-26).
 *
 * Anti-patterns enforced here:
 *   - MPMF-AP-13 (telemetry-consent nag): once `firstLaunchSeenAt` is set
 *     it MUST never be reset back to null. The first-launch panel never
 *     re-fires after dismissal. The reducer enforces this by refusing to
 *     clear the timestamp on RESET_TO_DEFAULTS.
 *   - MPMF-AP-13 (also): when a NEW category is added in the future, it
 *     defaults to OFF — it does NOT inherit prior ON state. Action
 *     NEW_CATEGORY_REGISTERED handles that semantic.
 */

import { TELEMETRY_CATEGORIES } from './telemetryEvents';

// =============================================================================
// ACTION TYPES
// =============================================================================

/**
 * All telemetry consent reducer actions. Frozen to prevent runtime mutation.
 *
 * 5 actions:
 *   - TELEMETRY_CONSENT_HYDRATED — boot from settings.telemetry sub-state
 *   - FIRST_LAUNCH_DISMISSED     — user clicked Continue on consent panel
 *   - CATEGORY_TOGGLED           — Settings → Telemetry section toggle
 *   - RESET_TO_DEFAULTS          — restore all-ON; does NOT clear firstLaunchSeenAt
 *   - NEW_CATEGORY_REGISTERED    — new telemetry category added later (defaults OFF)
 */
export const TELEMETRY_CONSENT_ACTIONS = Object.freeze({
  TELEMETRY_CONSENT_HYDRATED: 'TELEMETRY_CONSENT_HYDRATED',
  FIRST_LAUNCH_DISMISSED: 'FIRST_LAUNCH_DISMISSED',
  CATEGORY_TOGGLED: 'CATEGORY_TOGGLED',
  RESET_TO_DEFAULTS: 'RESET_TO_DEFAULTS',
  NEW_CATEGORY_REGISTERED: 'NEW_CATEGORY_REGISTERED',
});

// =============================================================================
// INITIAL STATE
// =============================================================================

/**
 * Default telemetry consent state. Used as the starting point before
 * IDB hydration. All four current categories default ON per Q8=B (opt-out
 * telemetry); `firstLaunchSeenAt` is null which causes the first-launch
 * panel to render exactly once and gates all event emission.
 */
export const initialTelemetryConsentState = Object.freeze({
  firstLaunchSeenAt: null,
  categories: Object.freeze({
    [TELEMETRY_CATEGORIES.USAGE]: true,
    [TELEMETRY_CATEGORIES.SESSION_REPLAY]: true,
    [TELEMETRY_CATEGORIES.ERROR_TRACKING]: true,
    [TELEMETRY_CATEGORIES.FEATURE_FLAGS]: true,
  }),
  schemaVersion: '1.0.0',
});

// =============================================================================
// STATE SCHEMA (for createValidatedReducer)
// =============================================================================

/**
 * Validation schema for telemetry consent state. Top-level keys only,
 * matching the entitlement reducer pattern (createValidatedReducer
 * doesn't support nested object validation).
 */
export const TELEMETRY_CONSENT_STATE_SCHEMA = Object.freeze({
  // firstLaunchSeenAt intentionally omitted — it's nullable string and the
  // validator's `type` rule doesn't model nullables. The reducer guards the
  // null→ISO transition itself.
  categories: { type: 'object' },
  schemaVersion: { type: 'string' },
});
