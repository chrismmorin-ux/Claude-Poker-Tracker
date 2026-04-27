/**
 * postHogAdapter.test.js
 *
 * Verifies silent-mode vs live-mode behavior of the PostHog adapter.
 * Mocks `posthog-js` so no network calls fire.
 *
 * MPMF G5-B2 (2026-04-26).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// posthog-js is mocked so we can assert which methods get called.
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock('../../errorHandler', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  DEBUG: false,
}));

import posthog from 'posthog-js';
import { logger } from '../../errorHandler';
import {
  init,
  capture,
  identify,
  reset,
  isInitialized,
  isLiveMode,
  __resetForTests,
} from '../postHogAdapter';

beforeEach(() => {
  __resetForTests();
  vi.clearAllMocks();
  // Default: no env key → silent mode
  vi.stubEnv('VITE_POSTHOG_KEY', '');
  vi.stubEnv('VITE_POSTHOG_HOST', '');
});

describe('init()', () => {
  it('enters silent mode when VITE_POSTHOG_KEY is empty', () => {
    init();
    expect(isInitialized()).toBe(true);
    expect(isLiveMode()).toBe(false);
    expect(posthog.init).not.toHaveBeenCalled();
  });

  it('enters silent mode when VITE_POSTHOG_KEY is whitespace-only', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '   ');
    init();
    expect(isLiveMode()).toBe(false);
    expect(posthog.init).not.toHaveBeenCalled();
  });

  it('enters live mode when VITE_POSTHOG_KEY is set, calling posthog.init with conservative defaults', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key_123');
    init();
    expect(isLiveMode()).toBe(true);
    expect(posthog.init).toHaveBeenCalledTimes(1);
    const [key, opts] = posthog.init.mock.calls[0];
    expect(key).toBe('phc_test_key_123');
    expect(opts.api_host).toBe('https://us.i.posthog.com');
    expect(opts.autocapture).toBe(false);
    expect(opts.capture_pageview).toBe(false);
    expect(opts.disable_session_recording).toBe(true);
  });

  it('uses VITE_POSTHOG_HOST when provided', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_eu_key');
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://eu.i.posthog.com');
    init();
    const [, opts] = posthog.init.mock.calls[0];
    expect(opts.api_host).toBe('https://eu.i.posthog.com');
  });

  it('is idempotent — calling init twice does not re-call posthog.init', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    init();
    init();
    expect(posthog.init).toHaveBeenCalledTimes(1);
  });
});

describe('capture()', () => {
  it('forwards to posthog.capture in live mode', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    init();
    capture('session_started', { userId: 'guest' });
    expect(posthog.capture).toHaveBeenCalledWith('session_started', { userId: 'guest' });
  });

  it('logs to logger.debug in silent mode (no posthog call)', () => {
    init();
    capture('session_started', { userId: 'guest' });
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith('TelemetryAdapter', '[SILENT]', 'session_started', { userId: 'guest' });
  });

  it('logs a warning if called before init() (caller should call init at boot)', () => {
    capture('something', { foo: 1 });
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });

  it('handles undefined properties gracefully in silent mode', () => {
    init();
    capture('event_no_props');
    expect(logger.debug).toHaveBeenCalledWith('TelemetryAdapter', '[SILENT]', 'event_no_props', {});
  });
});

describe('identify()', () => {
  it('forwards to posthog.identify in live mode', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    init();
    identify('user-123', { tier: 'plus' });
    expect(posthog.identify).toHaveBeenCalledWith('user-123', { tier: 'plus' });
  });

  it('logs in silent mode (no posthog call)', () => {
    init();
    identify('user-123', { tier: 'plus' });
    expect(posthog.identify).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith('TelemetryAdapter', '[SILENT identify]', 'user-123', { tier: 'plus' });
  });

  it('is a no-op when not initialized', () => {
    identify('user-123');
    expect(posthog.identify).not.toHaveBeenCalled();
  });
});

describe('reset()', () => {
  it('forwards to posthog.reset in live mode', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    init();
    reset();
    expect(posthog.reset).toHaveBeenCalled();
  });

  it('logs in silent mode (no posthog call)', () => {
    init();
    reset();
    expect(posthog.reset).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith('TelemetryAdapter', '[SILENT reset]');
  });

  it('is a no-op when not initialized', () => {
    reset();
    expect(posthog.reset).not.toHaveBeenCalled();
  });
});

describe('isInitialized() / isLiveMode()', () => {
  it('both return false before init()', () => {
    expect(isInitialized()).toBe(false);
    expect(isLiveMode()).toBe(false);
  });

  it('initialized=true / liveMode=false after silent init', () => {
    init();
    expect(isInitialized()).toBe(true);
    expect(isLiveMode()).toBe(false);
  });

  it('initialized=true / liveMode=true after live init', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_x');
    init();
    expect(isInitialized()).toBe(true);
    expect(isLiveMode()).toBe(true);
  });
});
