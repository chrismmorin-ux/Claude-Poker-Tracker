/**
 * postHogAdapter.js — Thin SDK wrapper around posthog-js
 *
 * Single point of contact between the app and PostHog. Every call into
 * PostHog goes through here. Replacing PostHog with another vendor (or
 * removing telemetry entirely) is a one-file change.
 *
 * Two modes:
 *   - LIVE   — `VITE_POSTHOG_KEY` is set; calls forward to posthog-js.
 *   - SILENT — no key configured; calls log to logger.debug instead. The
 *              app boots and runs identically; events are observable in
 *              dev console but never leave the device.
 *
 * Silent mode lets G5-B2 ship before the owner finishes the
 * PostHog-for-Startups credit application. When the key arrives, flipping
 * `.env` to set `VITE_POSTHOG_KEY` is the only change needed.
 *
 * MPMF G5-B2 (2026-04-26).
 */

import posthog from 'posthog-js';
import { logger } from '../errorHandler';

const MODULE_NAME = 'TelemetryAdapter';

let initialized = false;
let liveMode = false;

/**
 * Read the PostHog config from Vite env. Returns `{ key, host }` or `null`
 * if no key is set. The host falls back to the US PostHog cluster.
 */
const readConfig = () => {
  // Vite replaces `import.meta.env.*` at build time. Guard with optional
  // chaining so unit tests that don't define `import.meta.env` don't crash.
  const key = import.meta.env?.VITE_POSTHOG_KEY ?? '';
  const rawHost = import.meta.env?.VITE_POSTHOG_HOST;
  const host = (typeof rawHost === 'string' && rawHost.trim() !== '')
    ? rawHost.trim()
    : 'https://us.i.posthog.com';
  if (!key || typeof key !== 'string' || key.trim() === '') return null;
  return { key: key.trim(), host };
};

/**
 * Initialize the adapter. Idempotent — calling twice is a no-op.
 *
 * If `VITE_POSTHOG_KEY` is empty/missing, the adapter enters silent mode
 * and logs a one-time notice. All subsequent capture/identify/reset calls
 * go to logger.debug.
 *
 * `opts.autocapture` and `opts.session_recording` default to false so we
 * NEVER capture anything on first init that the user hasn't consented to
 * (the consentGate is the source of truth for what gets sent — but the
 * SDK itself should also default-conservative).
 */
export const init = () => {
  if (initialized) return;
  initialized = true;

  const config = readConfig();
  if (!config) {
    liveMode = false;
    logger.debug(MODULE_NAME, 'Silent mode (no VITE_POSTHOG_KEY set)');
    return;
  }

  liveMode = true;
  posthog.init(config.key, {
    api_host: config.host,
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
    persistence: 'localStorage',
    loaded: () => {
      logger.debug(MODULE_NAME, 'PostHog initialized (live mode)');
    },
  });
};

/**
 * Forward an event to PostHog (live mode) or log it (silent mode).
 * The consentGate is responsible for filtering — this method assumes the
 * event has already passed the gate.
 */
export const capture = (eventName, properties) => {
  if (!initialized) {
    logger.debug(MODULE_NAME, 'capture before init — call init() at app boot', { eventName });
    return;
  }
  if (liveMode) {
    posthog.capture(eventName, properties);
  } else {
    logger.debug(MODULE_NAME, '[SILENT]', eventName, properties ?? {});
  }
};

/**
 * Associate the current PostHog distinct ID with a stable user id.
 * Used by G5-B5 evaluator onboarding once auth identity exists; until
 * then the app stays anonymous and this is a no-op for the 'guest' user.
 */
export const identify = (distinctId, properties) => {
  if (!initialized) return;
  if (liveMode) {
    posthog.identify(distinctId, properties);
  } else {
    logger.debug(MODULE_NAME, '[SILENT identify]', distinctId, properties ?? {});
  }
};

/**
 * Disassociate the current session from any user. Called on sign-out so a
 * subsequent user on the same device gets a fresh distinct ID. In silent
 * mode this is just a debug log.
 */
export const reset = () => {
  if (!initialized) return;
  if (liveMode) {
    posthog.reset();
  } else {
    logger.debug(MODULE_NAME, '[SILENT reset]');
  }
};

/**
 * Returns true if init() has been called. Used by tests + the consentGate
 * to short-circuit when the adapter isn't wired up.
 */
export const isInitialized = () => initialized;

/**
 * Returns true if the adapter is forwarding to a real PostHog instance.
 * False in silent mode. Mostly for tests + diagnostic UI.
 */
export const isLiveMode = () => liveMode;

/**
 * Test-only helper: reset the module-level state so tests can re-init
 * with different env values. Not exported in production builds (tree-
 * shaken because nothing imports it from app code).
 */
export const __resetForTests = () => {
  initialized = false;
  liveMode = false;
};
