/**
 * telemetryEvents.js — Frozen registry of telemetry event names + categories
 *
 * Single source of truth for every telemetry event the app may emit.
 * Every event MUST belong to exactly one category. The category determines
 * whether the event is dropped at the consent gate or forwarded to the
 * postHogAdapter.
 *
 * MPMF G5-B2 (2026-04-26): authored as part of telemetry foundation batch.
 * Source events: `docs/projects/monetization-and-pmf/assumption-ledger.md`
 *               `docs/design/surfaces/telemetry-consent-panel.md`
 *
 * Anti-patterns enforced here:
 *   - MPMF-AP-13: new event categories default OFF in the consent reducer
 *     (NEW_CATEGORY_REGISTERED action handles that — see telemetryConsentReducer)
 *   - MPMF-AP-04: any event named with a `re_engage_` prefix is refused at the
 *     gate regardless of opt-in state (see consentGate.js)
 */

// =============================================================================
// CATEGORIES
// =============================================================================

/**
 * The four categories surfaced in the consent UI. Each event maps to exactly
 * one. Toggling a category off in Settings drops every event mapped to it.
 */
export const TELEMETRY_CATEGORIES = Object.freeze({
  USAGE: 'usage',
  SESSION_REPLAY: 'session_replay',
  ERROR_TRACKING: 'error_tracking',
  FEATURE_FLAGS: 'feature_flags',
});

/** Frozen list of valid category identifiers (for schema/validation). */
export const VALID_CATEGORIES = Object.freeze([
  TELEMETRY_CATEGORIES.USAGE,
  TELEMETRY_CATEGORIES.SESSION_REPLAY,
  TELEMETRY_CATEGORIES.ERROR_TRACKING,
  TELEMETRY_CATEGORIES.FEATURE_FLAGS,
]);

// =============================================================================
// EVENT REGISTRY
// =============================================================================

/**
 * Frozen registry of every event name the app may emit. Use these constants
 * at every call site so the registry is the only place to grep when adding,
 * renaming, or removing an event.
 *
 * Naming: snake_case verbs/objects (PostHog convention). No PII in names.
 */
export const TELEMETRY_EVENTS = Object.freeze({
  // ---- Persona / Engagement (M1, M5, M13, M14) ----
  FIRST_SESSION_START: 'first_session_start',
  FIRST_SESSION_END: 'first_session_end',
  SESSION_STARTED: 'session_started',
  SESSION_ENDED: 'session_ended',
  DRILL_STARTED: 'drill_started',
  REPLAY_OPENED: 'replay_opened',
  RETURN_AFTER_DRIFT: 'return_after_drift',
  SESSION_2_WITHIN_7D: 'session_2_within_7d',

  // ---- Funnel / Pricing (M3, M4, M6, M8) ----
  LANDING_PAGE_VISIT: 'landing_page_visit',
  SIGNUP_ACTION: 'signup_action',
  PAYMENT_SUCCESS: 'payment_success',
  UPGRADE_ACTION_TAKEN: 'upgrade_action_taken',
  FOUNDING_MEMBER_SIGNUP: 'founding_member_signup',

  // ---- Billing settings (G5-B4 — declared now, fired later) ----
  BILLING_SETTINGS_VIEWED: 'billing_settings_viewed',
  BILLING_ACTION_TAPPED: 'billing_action_tapped',
  CARD_DECLINE_GRACE_INDICATOR_SHOWN: 'card_decline_grace_indicator_shown',

  // ---- Paywall (G5-B3 — declared now, fired later) ----
  PAYWALL_SHOWN: 'paywall_shown',
  PAYWALL_DISMISSED: 'paywall_dismissed',

  // ---- Self-instrumentation (consent panel itself) ----
  CONSENT_PANEL_SHOWN: 'consent_panel_shown',
  CONSENT_PANEL_DISMISSED: 'consent_panel_dismissed',
  CONSENT_CATEGORY_TOGGLED: 'consent_category_toggled',

  // ---- Error tracking ----
  ERROR_CAPTURED: 'error_captured',

  // ---- Feature flags ----
  FEATURE_FLAG_EVALUATED: 'feature_flag_evaluated',

  // ---- Session replay ----
  SESSION_REPLAY_STARTED: 'session_replay_started',
});

// =============================================================================
// EVENT → CATEGORY MAPPING
// =============================================================================

/**
 * Every event in TELEMETRY_EVENTS MUST appear here. The consentGate looks up
 * an event's category here and silently drops the event if the user has
 * opted out of that category. A missing entry is a defect — the gate
 * defaults to dropping unknown events (fail-closed).
 */
export const EVENT_TO_CATEGORY = Object.freeze({
  // Persona / Engagement
  [TELEMETRY_EVENTS.FIRST_SESSION_START]: TELEMETRY_CATEGORIES.USAGE,
  [TELEMETRY_EVENTS.FIRST_SESSION_END]: TELEMETRY_CATEGORIES.USAGE,
  [TELEMETRY_EVENTS.SESSION_STARTED]: TELEMETRY_CATEGORIES.USAGE,
  [TELEMETRY_EVENTS.SESSION_ENDED]: TELEMETRY_CATEGORIES.USAGE,
  [TELEMETRY_EVENTS.DRILL_STARTED]: TELEMETRY_CATEGORIES.USAGE,
  [TELEMETRY_EVENTS.REPLAY_OPENED]: TELEMETRY_CATEGORIES.USAGE,
  [TELEMETRY_EVENTS.RETURN_AFTER_DRIFT]: TELEMETRY_CATEGORIES.USAGE,
  [TELEMETRY_EVENTS.SESSION_2_WITHIN_7D]: TELEMETRY_CATEGORIES.USAGE,

  // Funnel / Pricing
  [TELEMETRY_EVENTS.LANDING_PAGE_VISIT]: TELEMETRY_CATEGORIES.USAGE,
  [TELEMETRY_EVENTS.SIGNUP_ACTION]: TELEMETRY_CATEGORIES.USAGE,
  [TELEMETRY_EVENTS.PAYMENT_SUCCESS]: TELEMETRY_CATEGORIES.USAGE,
  [TELEMETRY_EVENTS.UPGRADE_ACTION_TAKEN]: TELEMETRY_CATEGORIES.USAGE,
  [TELEMETRY_EVENTS.FOUNDING_MEMBER_SIGNUP]: TELEMETRY_CATEGORIES.USAGE,

  // Billing settings
  [TELEMETRY_EVENTS.BILLING_SETTINGS_VIEWED]: TELEMETRY_CATEGORIES.USAGE,
  [TELEMETRY_EVENTS.BILLING_ACTION_TAPPED]: TELEMETRY_CATEGORIES.USAGE,
  [TELEMETRY_EVENTS.CARD_DECLINE_GRACE_INDICATOR_SHOWN]: TELEMETRY_CATEGORIES.USAGE,

  // Paywall
  [TELEMETRY_EVENTS.PAYWALL_SHOWN]: TELEMETRY_CATEGORIES.USAGE,
  [TELEMETRY_EVENTS.PAYWALL_DISMISSED]: TELEMETRY_CATEGORIES.USAGE,

  // Consent self-instrumentation
  [TELEMETRY_EVENTS.CONSENT_PANEL_SHOWN]: TELEMETRY_CATEGORIES.USAGE,
  [TELEMETRY_EVENTS.CONSENT_PANEL_DISMISSED]: TELEMETRY_CATEGORIES.USAGE,
  [TELEMETRY_EVENTS.CONSENT_CATEGORY_TOGGLED]: TELEMETRY_CATEGORIES.USAGE,

  // Error tracking
  [TELEMETRY_EVENTS.ERROR_CAPTURED]: TELEMETRY_CATEGORIES.ERROR_TRACKING,

  // Feature flags
  [TELEMETRY_EVENTS.FEATURE_FLAG_EVALUATED]: TELEMETRY_CATEGORIES.FEATURE_FLAGS,

  // Session replay
  [TELEMETRY_EVENTS.SESSION_REPLAY_STARTED]: TELEMETRY_CATEGORIES.SESSION_REPLAY,
});

/**
 * Returns the category for an event name, or `null` if the event is unknown.
 * Unknown events are dropped by the consent gate (fail-closed). Use this
 * helper rather than indexing EVENT_TO_CATEGORY directly so the contract
 * with the gate stays consistent.
 */
export const getCategoryForEvent = (eventName) => {
  if (typeof eventName !== 'string') return null;
  return EVENT_TO_CATEGORY[eventName] ?? null;
};
