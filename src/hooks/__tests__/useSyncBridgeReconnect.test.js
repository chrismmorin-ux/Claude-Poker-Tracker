// @vitest-environment jsdom
/**
 * useSyncBridgeReconnect.test.js — WS-228 auto-reconnect controller.
 *
 * The Online pipeline degrades gracefully on a mid-session extension
 * disconnect (WS-082 audit), but before WS-228 it sat disconnected and the
 * 60s heartbeat only re-probed lazily — a transient drop took up to a minute
 * to heal. This pins the escalating-backoff reconnect behaviour:
 *
 *   - while disconnected, STATUS probes fire at escalating, capped intervals
 *     (no thrash);
 *   - a valid `connected:true` STATUS response flips isExtensionConnected and
 *     stops the backoff;
 *   - the reconnect path is textually independent of the import circuit
 *     breaker (AC3 "does not interfere").
 *
 * Mounts the real hook (useSyncBridgeImpl) with persistence + wire-schemas
 * mocked; uses fake timers and synchronous MessageEvent dispatch to drive the
 * connection lifecycle deterministically.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { renderHook, act } from '@testing-library/react';

// --- Mocks: keep the hook's collaborators inert; bridgeProtocol stays REAL so
// BRIDGE_MSG / PROTOCOL_VERSION match between the hook and the test messages.
vi.mock('../../utils/errorHandler', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../utils/persistence/handsStorage', () => ({
  saveOnlineHand: vi.fn().mockResolvedValue(1),
}));
vi.mock('../../utils/persistence/sessionsStorage', () => ({
  getOrCreateOnlineSession: vi.fn().mockResolvedValue('session-1'),
}));
vi.mock('../../utils/versionMismatchStorage', () => ({
  readReloadFlag: vi.fn(() => null),
  clearReloadFlag: vi.fn(),
  readDismissedFlag: vi.fn(() => false),
  writeDismissedFlag: vi.fn(),
  clearDismissedFlag: vi.fn(),
}));
vi.mock('@extension-shared/wire-schemas.js', () => ({
  buildExploitSeat: vi.fn((seat, data) => ({ seat, ...data })),
  buildActionAdvice: vi.fn((a) => a),
  buildTournament: vi.fn((t) => t),
  buildErrorReport: vi.fn((r) => r),
  validateHandForRelay: vi.fn(() => ({ valid: true, errors: [] })),
  validateLiveContext: vi.fn(() => ({ valid: true, errors: [] })),
  validateStatus: vi.fn(() => ({ valid: true, errors: [] })),
}));
vi.mock('@extension-shared/hand-format.js', () => ({
  validateHandRecord: vi.fn(() => ({ valid: true, errors: [] })),
}));

import { useSyncBridgeImpl } from '../useSyncBridge';
import { BRIDGE_MSG, PROTOCOL_VERSION } from '../../utils/bridgeProtocol';

// Count STATUS-request probes posted by the hook (mount probe, heartbeat,
// reconnect backoff all post the same shape).
const countStatusRequests = (spy) =>
  spy.mock.calls.filter(
    ([msg]) => msg?.type === BRIDGE_MSG.STATUS && msg?.request === true,
  ).length;

// A wire-realistic STATUS *response* (no `request` field) — drives the hook
// to mark connected. source:window so the hook's `event.source !== window`
// guard passes.
const dispatchStatusResponse = (connected) => {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: {
          type: BRIDGE_MSG.STATUS,
          connected,
          protocolVersion: PROTOCOL_VERSION,
          _v: PROTOCOL_VERSION,
        },
      }),
    );
  });
};

describe('WS-228 auto-reconnect controller', () => {
  let postSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    postSpy = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
  });

  afterEach(() => {
    postSpy.mockRestore();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('starts disconnected and probes once on mount', () => {
    const { result } = renderHook(() => useSyncBridgeImpl('user-1'));
    expect(result.current.isExtensionConnected).toBe(false);
    // Mount probe fired immediately; the first backoff probe is still pending.
    expect(countStatusRequests(postSpy)).toBe(1);
  });

  it('probes at escalating intervals while disconnected (2s, then 3s)', () => {
    renderHook(() => useSyncBridgeImpl('user-1'));
    postSpy.mockClear();

    // First backoff probe lands at exactly 2000ms (attempt 0 → 2000·1.5^0).
    act(() => vi.advanceTimersByTime(1999));
    expect(countStatusRequests(postSpy)).toBe(0);
    act(() => vi.advanceTimersByTime(1));
    expect(countStatusRequests(postSpy)).toBe(1);

    // Next probe is at +3000ms (attempt 1 → 2000·1.5^1) — interval GREW.
    postSpy.mockClear();
    act(() => vi.advanceTimersByTime(2999));
    expect(countStatusRequests(postSpy)).toBe(0);
    act(() => vi.advanceTimersByTime(1));
    expect(countStatusRequests(postSpy)).toBe(1);
  });

  it('does not thrash: probes stay rate-limited over a long disconnect', () => {
    renderHook(() => useSyncBridgeImpl('user-1'));
    postSpy.mockClear();

    // Over a full minute disconnected, probes are spaced by the escalating
    // backoff (floor 2000ms) — a thrashing tight loop would emit hundreds.
    // Escalating delays land 6 backoff probes plus the 60s heartbeat.
    act(() => vi.advanceTimersByTime(60_000));
    const n = countStatusRequests(postSpy);
    expect(n).toBeGreaterThanOrEqual(5);
    expect(n).toBeLessThanOrEqual(8);
  });

  it('caps the backoff so it keeps retrying far into a long disconnect', () => {
    renderHook(() => useSyncBridgeImpl('user-1'));
    // Push deep past saturation, where an uncapped exponential would have
    // backed off to effectively never retrying.
    act(() => vi.advanceTimersByTime(200_000));
    postSpy.mockClear();

    // A capped 30s interval guarantees at least one probe in any 31s window
    // (and no heartbeat boundary falls inside [200s, 231s]).
    act(() => vi.advanceTimersByTime(31_000));
    expect(countStatusRequests(postSpy)).toBeGreaterThanOrEqual(1);
  });

  it('flips connected and stops the backoff on a valid STATUS response', () => {
    const { result } = renderHook(() => useSyncBridgeImpl('user-1'));

    // Let the first backoff probe fire, then the extension answers.
    act(() => vi.advanceTimersByTime(2000));
    dispatchStatusResponse(true);
    expect(result.current.isExtensionConnected).toBe(true);

    // Backoff is now stood down: across a 33s window (< the 60s heartbeat) no
    // further STATUS probes are emitted.
    postSpy.mockClear();
    act(() => vi.advanceTimersByTime(33_000));
    expect(countStatusRequests(postSpy)).toBe(0);
  });

  it('resumes backoff after a subsequent disconnect', () => {
    const { result } = renderHook(() => useSyncBridgeImpl('user-1'));
    act(() => vi.advanceTimersByTime(2000));
    dispatchStatusResponse(true);
    expect(result.current.isExtensionConnected).toBe(true);

    // Extension drops again — backoff restarts from the initial delay.
    dispatchStatusResponse(false);
    expect(result.current.isExtensionConnected).toBe(false);
    postSpy.mockClear();
    act(() => vi.advanceTimersByTime(2000));
    expect(countStatusRequests(postSpy)).toBe(1);
  });
});

describe('WS-228 AC3 — reconnect path is independent of the import circuit breaker', () => {
  it('the reconnect controller never touches circuit-breaker state', () => {
    const src = fs.readFileSync(
      path.join(path.resolve(__dirname, '../..'), 'hooks/useSyncBridge.js'),
      'utf8',
    );
    // Isolate everything from the WS-228 reconnect marker to end-of-file and
    // assert the circuit-breaker identifiers (which live in importHands) are
    // absent — so the controller cannot interfere with the breaker.
    const markerIdx = src.indexOf('WS-228: auto-reconnect');
    expect(markerIdx).toBeGreaterThan(-1);
    const reconnectRegion = src.slice(markerIdx);
    expect(reconnectRegion).not.toMatch(/circuitBreakerTrippedAt/);
    expect(reconnectRegion).not.toMatch(/consecutiveFailures/);
  });
});
