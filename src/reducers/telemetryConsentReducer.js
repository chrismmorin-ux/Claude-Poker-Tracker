/**
 * telemetryConsentReducer.js — Telemetry consent state management
 *
 * Manages first-launch consent acknowledgement + 4 per-category opt-in state.
 * The consentGate reads this state on every emit() to decide forward vs drop.
 *
 * Mirrors the entitlementReducer pattern (frozen ACTIONS + createValidatedReducer
 * wrapper + spread immutability + STATE_SCHEMA + INITIAL_STATE export).
 *
 * MPMF G5-B2 (2026-04-26).
 *
 * Anti-pattern enforcement (MPMF-AP-13):
 *   - firstLaunchSeenAt is set ONCE on FIRST_LAUNCH_DISMISSED. RESET_TO_DEFAULTS
 *     does NOT clear it. The first-launch panel never re-fires after dismissal.
 *   - NEW_CATEGORY_REGISTERED adds a new category in OFF state. New categories
 *     do not inherit prior ON state from existing categories.
 */

import {
  TELEMETRY_CONSENT_ACTIONS,
  TELEMETRY_CONSENT_STATE_SCHEMA,
  initialTelemetryConsentState,
} from '../constants/telemetryConsentConstants';
import { createValidatedReducer } from '../utils/reducerUtils';

// =============================================================================
// RAW REDUCER
// =============================================================================

const rawTelemetryConsentReducer = (state, action) => {
  switch (action.type) {
    // -------------------------------------------------------------------------
    // TELEMETRY_CONSENT_HYDRATED
    // Replace state with the record loaded from settings.telemetry sub-state
    // at boot. Caller (useTelemetryConsentPersistence) reads the settings
    // store and dispatches with the full hydrated payload.
    // -------------------------------------------------------------------------
    case TELEMETRY_CONSENT_ACTIONS.TELEMETRY_CONSENT_HYDRATED: {
      const hydrated = action.payload?.telemetryConsent;
      if (!hydrated || typeof hydrated !== 'object') {
        return state;
      }
      return {
        ...initialTelemetryConsentState,
        ...hydrated,
        // Merge categories so a stale hydrated record (missing a newer
        // category) inherits the default-ON state for known categories
        // that are missing from the persisted record. Brand-new categories
        // added in the future use NEW_CATEGORY_REGISTERED to default OFF;
        // existing-from-day-one categories default ON when absent.
        categories: {
          ...initialTelemetryConsentState.categories,
          ...(hydrated.categories || {}),
        },
      };
    }

    // -------------------------------------------------------------------------
    // FIRST_LAUNCH_DISMISSED
    // User clicked Continue on the consent panel. Stamps the timestamp.
    // The consentGate uses this to gate ALL event emission — pre-stamp,
    // every event is dropped silently.
    // Idempotent: re-firing this action does not overwrite the timestamp.
    // -------------------------------------------------------------------------
    case TELEMETRY_CONSENT_ACTIONS.FIRST_LAUNCH_DISMISSED: {
      if (state.firstLaunchSeenAt) {
        return state; // idempotent — never overwrite a prior dismissal
      }
      const dismissedAt = action.payload?.dismissedAt ?? new Date().toISOString();
      return {
        ...state,
        firstLaunchSeenAt: dismissedAt,
      };
    }

    // -------------------------------------------------------------------------
    // CATEGORY_TOGGLED
    // User toggled a category in either the first-launch panel or the
    // Settings → Telemetry section. Unknown categories are ignored
    // (defensive — the UI should only ever toggle known categories).
    // -------------------------------------------------------------------------
    case TELEMETRY_CONSENT_ACTIONS.CATEGORY_TOGGLED: {
      const { category, enabled } = action.payload || {};
      if (typeof category !== 'string' || typeof enabled !== 'boolean') {
        return state;
      }
      // Don't add unknown categories via this action — that's what
      // NEW_CATEGORY_REGISTERED is for.
      if (!(category in state.categories)) {
        return state;
      }
      return {
        ...state,
        categories: {
          ...state.categories,
          [category]: enabled,
        },
      };
    }

    // -------------------------------------------------------------------------
    // RESET_TO_DEFAULTS
    // Restore all categories to ON. Does NOT clear firstLaunchSeenAt
    // (MPMF-AP-13: the first-launch panel must never re-fire).
    // -------------------------------------------------------------------------
    case TELEMETRY_CONSENT_ACTIONS.RESET_TO_DEFAULTS: {
      return {
        ...state,
        categories: { ...initialTelemetryConsentState.categories },
      };
    }

    // -------------------------------------------------------------------------
    // NEW_CATEGORY_REGISTERED
    // A new telemetry category has been added to the registry. It defaults
    // OFF (MPMF-AP-13: new categories do NOT inherit prior ON state).
    // Existing categories retain their prior preference.
    // No-op if the category is already known.
    // -------------------------------------------------------------------------
    case TELEMETRY_CONSENT_ACTIONS.NEW_CATEGORY_REGISTERED: {
      const { category } = action.payload || {};
      if (typeof category !== 'string') return state;
      if (category in state.categories) return state;
      return {
        ...state,
        categories: {
          ...state.categories,
          [category]: false,
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

export const telemetryConsentReducer = createValidatedReducer(
  rawTelemetryConsentReducer,
  TELEMETRY_CONSENT_STATE_SCHEMA,
  'telemetryConsentReducer'
);

export { initialTelemetryConsentState };
