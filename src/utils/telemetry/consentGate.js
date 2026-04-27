/**
 * consentGate.js — Filter telemetry events by user consent
 *
 * The single chokepoint between application code and `postHogAdapter.capture`.
 * Every event the app wants to emit MUST go through `emit()` here. If the
 * gate refuses, the event is silently dropped — no network call, no log
 * leak, no observability gap (we still log_capture the drop in DEBUG mode
 * for diagnostics, but the event itself never leaves the device).
 *
 * Drop rules (fail-closed):
 *   1. If the event name is unknown to `EVENT_TO_CATEGORY`, drop.
 *   2. If `firstLaunchSeenAt === null` (consent panel not yet acknowledged),
 *      drop. Pre-consent events would be a red-line violation.
 *   3. If the event's category is opted-out, drop.
 *   4. Defensive: any event name matching `/^re_engage_/` is dropped no
 *      matter the state. Engagement-pressure pattern is refused at the
 *      bone (MPMF-AP-04). If a future caller forgets the rule, the gate
 *      catches it.
 *
 * The gate is a pure function of (eventName, telemetryConsent). It does
 * NOT call postHog directly — `emit()` does that. Tests for this module
 * mock postHogAdapter.
 *
 * MPMF G5-B2 (2026-04-26).
 */

import { getCategoryForEvent } from '../../constants/telemetryEvents';
import * as postHogAdapter from './postHogAdapter';
import { logger } from '../errorHandler';

const MODULE_NAME = 'ConsentGate';
const RE_ENGAGE_PATTERN = /^re_engage/;

/**
 * Pure decision: should this event be forwarded to postHog or silently
 * dropped? Returns boolean. No side effects.
 *
 * @param {string} eventName
 * @param {{ firstLaunchSeenAt: string | null, categories: Record<string, boolean> }} telemetryConsent
 * @returns {boolean}
 */
export const shouldEmit = (eventName, telemetryConsent) => {
  // Defensive guard: re_engage_* is never permitted (MPMF-AP-04).
  if (typeof eventName === 'string' && RE_ENGAGE_PATTERN.test(eventName)) {
    return false;
  }

  // Unknown event names → drop (fail-closed).
  const category = getCategoryForEvent(eventName);
  if (category === null) return false;

  // Telemetry consent state must be a well-formed object.
  if (!telemetryConsent || typeof telemetryConsent !== 'object') return false;

  // Pre-consent (first-launch panel not yet acknowledged) → drop.
  if (telemetryConsent.firstLaunchSeenAt == null) return false;

  // Category opted-out → drop.
  const categories = telemetryConsent.categories;
  if (!categories || typeof categories !== 'object') return false;
  if (categories[category] !== true) return false;

  return true;
};

/**
 * Forward an event to the postHog adapter if the gate permits it.
 * Drops silently when `shouldEmit` returns false. In DEBUG mode emits
 * a tracer log line so devs can see drops in console.
 *
 * @param {string} eventName
 * @param {object} properties
 * @param {{ firstLaunchSeenAt: string | null, categories: Record<string, boolean> }} telemetryConsent
 */
export const emit = (eventName, properties, telemetryConsent) => {
  if (!shouldEmit(eventName, telemetryConsent)) {
    logger.debug(MODULE_NAME, 'drop', { eventName });
    return;
  }
  postHogAdapter.capture(eventName, properties);
};
