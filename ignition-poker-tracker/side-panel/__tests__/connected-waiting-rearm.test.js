/**
 * connected-waiting-rearm.test.js — WS-517.
 *
 * The 30s escalation was gated on `handCount === 0`, so it could only ever arm
 * before a session's first hand and never re-armed afterwards. A capture that
 * died after 40 hands had no escalation path at all.
 *
 * The boot-race distinction it also encodes — `null` handCount (not yet
 * computed) must NOT arm, only a confirmed-empty count — is correct and is
 * pinned here so the fix cannot quietly drop it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RenderCoordinator } from '../render-coordinator.js';

const STALE = 300_000;

function makeCoordinator() {
  return new RenderCoordinator({
    renderFn: () => {},
    getTimestamp: () => Date.now(),
    requestFrame: (cb) => setTimeout(cb, 0),
    setTimeout: (cb, ms) => setTimeout(cb, ms),
    clearTimeout: (id) => clearTimeout(id),
  });
}

describe('WS-517 — connected-waiting escalation re-arms on stale hand flow', () => {
  let coord;
  beforeEach(() => { vi.useFakeTimers(); coord = makeCoordinator(); });
  afterEach(() => { vi.useRealTimers(); });

  it('arms when hands have been flowing but stopped — the regression', () => {
    coord.evaluateConnectedWaitingTimer({
      connected: true, tableCount: 1, handCount: 40,
      handAgeMs: STALE + 1, handStaleMs: STALE,
    });
    expect(coord.get('connectedWaitingTimerActive')).toBe(true);

    vi.advanceTimersByTime(30_000);
    expect(coord.get('connectedWaitingExpired')).toBe(true);
  });

  it('does NOT arm while hands are recent', () => {
    coord.evaluateConnectedWaitingTimer({
      connected: true, tableCount: 1, handCount: 40,
      handAgeMs: 5_000, handStaleMs: STALE,
    });
    expect(coord.get('connectedWaitingTimerActive')).toBe(false);
  });

  it('still arms before the first hand of a session', () => {
    coord.evaluateConnectedWaitingTimer({
      connected: true, tableCount: 1, handCount: 0, handAgeMs: null, handStaleMs: STALE,
    });
    expect(coord.get('connectedWaitingTimerActive')).toBe(true);
  });

  it('preserves the boot-race rule: null handCount does not arm', () => {
    coord.evaluateConnectedWaitingTimer({
      connected: true, tableCount: 1, handCount: null, handAgeMs: null, handStaleMs: STALE,
    });
    expect(coord.get('connectedWaitingTimerActive')).toBe(false);
  });

  it('unknown hand age does not arm — unknown is not evidence of a problem', () => {
    coord.evaluateConnectedWaitingTimer({
      connected: true, tableCount: 1, handCount: 40, handAgeMs: null, handStaleMs: STALE,
    });
    expect(coord.get('connectedWaitingTimerActive')).toBe(false);
  });

  it('clears once hands resume', () => {
    coord.evaluateConnectedWaitingTimer({
      connected: true, tableCount: 1, handCount: 40, handAgeMs: STALE + 1, handStaleMs: STALE,
    });
    vi.advanceTimersByTime(30_000);
    expect(coord.get('connectedWaitingExpired')).toBe(true);

    coord.evaluateConnectedWaitingTimer({
      connected: true, tableCount: 1, handCount: 41, handAgeMs: 1_000, handStaleMs: STALE,
    });
    expect(coord.get('connectedWaitingExpired')).toBe(false);
    expect(coord.get('connectedWaitingTimerActive')).toBe(false);
  });

  it('does not arm when disconnected or with no table', () => {
    coord.evaluateConnectedWaitingTimer({
      connected: false, tableCount: 1, handCount: 40, handAgeMs: STALE + 1, handStaleMs: STALE,
    });
    expect(coord.get('connectedWaitingTimerActive')).toBe(false);

    coord.evaluateConnectedWaitingTimer({
      connected: true, tableCount: 0, handCount: 40, handAgeMs: STALE + 1, handStaleMs: STALE,
    });
    expect(coord.get('connectedWaitingTimerActive')).toBe(false);
  });

  it('omitting the new params preserves the original behaviour exactly', () => {
    coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: 0 });
    expect(coord.get('connectedWaitingTimerActive')).toBe(true);

    const other = makeCoordinator();
    other.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: 40 });
    expect(other.get('connectedWaitingTimerActive')).toBe(false);
  });
});
