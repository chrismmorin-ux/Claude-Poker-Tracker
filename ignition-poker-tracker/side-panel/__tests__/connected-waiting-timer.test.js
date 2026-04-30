/**
 * connected-waiting-timer.test.js — V-status §I INV-STATUS-4 (Gate 5 PR-9).
 *
 * Covers RenderCoordinator.evaluateConnectedWaitingTimer and the underlying
 * start/clear methods. The timer fires at 30s when the panel is connected
 * to a table that has produced zero hands, escalating the status text to
 * suggest a reload — closes FM-STATUS-3 (silently broken WebSocket showed
 * "waiting for hands" forever).
 *
 * Spec: docs/design/surfaces/sidebar-shell-spec.md §I.8.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RenderCoordinator } from '../render-coordinator.js';

function createCoordinator() {
  const renders = [];
  const coord = new RenderCoordinator({
    renderFn: (snap, reason) => renders.push({ reason, expired: snap.connectedWaitingExpired }),
    getTimestamp: () => Date.now(),
    requestFrame: (cb) => setTimeout(cb, 0),
    setTimeout: (cb, ms) => setTimeout(cb, ms),
    clearTimeout: (id) => clearTimeout(id),
  }, { coalesceMs: 80 });
  return { coord, renders };
}

describe('V-status §I INV-STATUS-4 — connected-waiting timer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe('arming conditions', () => {
    it('arms when connected, tableCount > 0, handCount === 0', () => {
      const { coord } = createCoordinator();
      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: 0 });
      expect(coord.get('connectedWaitingTimerActive')).toBe(true);
      expect(coord.hasTimer('connectedWaitingTimeout')).toBe(true);
    });

    it('does NOT arm when connected: false', () => {
      const { coord } = createCoordinator();
      coord.evaluateConnectedWaitingTimer({ connected: false, tableCount: 1, handCount: 0 });
      expect(coord.get('connectedWaitingTimerActive')).toBe(false);
      expect(coord.hasTimer('connectedWaitingTimeout')).toBe(false);
    });

    it('does NOT arm when tableCount === 0', () => {
      const { coord } = createCoordinator();
      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 0, handCount: 0 });
      expect(coord.get('connectedWaitingTimerActive')).toBe(false);
    });

    it('does NOT arm when handCount > 0', () => {
      const { coord } = createCoordinator();
      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: 5 });
      expect(coord.get('connectedWaitingTimerActive')).toBe(false);
    });

    it('does NOT arm when handCount === null (boot-race protection)', () => {
      // Spec §I.8: handCount === 0 is strict — null (not yet computed) does
      // not arm so the timer can't fire during the first-frame hydration gap.
      const { coord } = createCoordinator();
      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: null });
      expect(coord.get('connectedWaitingTimerActive')).toBe(false);
    });

    it('is idempotent — re-evaluating the same condition does not re-arm', () => {
      const { coord } = createCoordinator();
      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: 0 });
      const firstHandle = coord.hasTimer('connectedWaitingTimeout');
      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: 0 });
      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: 0 });
      expect(coord.get('connectedWaitingTimerActive')).toBe(true);
      expect(coord.hasTimer('connectedWaitingTimeout')).toBe(firstHandle);
    });
  });

  describe('expiry behavior', () => {
    it('sets connectedWaitingExpired=true after 30s', () => {
      const { coord } = createCoordinator();
      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: 0 });
      expect(coord.get('connectedWaitingExpired')).toBe(false);

      vi.advanceTimersByTime(29_999);
      expect(coord.get('connectedWaitingExpired')).toBe(false);

      vi.advanceTimersByTime(1);
      expect(coord.get('connectedWaitingExpired')).toBe(true);
      expect(coord.get('connectedWaitingTimerActive')).toBe(false);
    });

    it('schedules a render on expiry', () => {
      const { coord, renders } = createCoordinator();
      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: 0 });
      vi.advanceTimersByTime(30_000);
      // rAF + render flush
      vi.advanceTimersByTime(20);
      const expiredRender = renders.find(r => r.reason === 'connectedWaiting_expired');
      expect(expiredRender).toBeTruthy();
      expect(expiredRender.expired).toBe(true);
    });

    it('does not re-arm after expiry on subsequent evaluations with same condition', () => {
      const { coord } = createCoordinator();
      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: 0 });
      vi.advanceTimersByTime(30_000);
      // Expired; user has been told to reload. Re-evaluating with same
      // condition should keep the flag set, not re-arm.
      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: 0 });
      expect(coord.get('connectedWaitingExpired')).toBe(true);
      expect(coord.get('connectedWaitingTimerActive')).toBe(false);
      expect(coord.hasTimer('connectedWaitingTimeout')).toBe(false);
    });
  });

  describe('clearing paths', () => {
    it('clears when handCount transitions 0 → N (hand arrived before expiry)', () => {
      const { coord } = createCoordinator();
      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: 0 });
      expect(coord.get('connectedWaitingTimerActive')).toBe(true);

      vi.advanceTimersByTime(15_000);
      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: 1 });
      expect(coord.get('connectedWaitingTimerActive')).toBe(false);
      expect(coord.get('connectedWaitingExpired')).toBe(false);
      expect(coord.hasTimer('connectedWaitingTimeout')).toBe(false);
    });

    it('clears when not connected (port disconnect mid-wait)', () => {
      const { coord } = createCoordinator();
      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: 0 });
      expect(coord.get('connectedWaitingTimerActive')).toBe(true);

      coord.evaluateConnectedWaitingTimer({ connected: false, tableCount: 1, handCount: 0 });
      expect(coord.get('connectedWaitingTimerActive')).toBe(false);
      expect(coord.hasTimer('connectedWaitingTimeout')).toBe(false);
    });

    it('clears when table goes away (tableCount → 0)', () => {
      const { coord } = createCoordinator();
      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: 0 });
      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 0, handCount: 0 });
      expect(coord.get('connectedWaitingTimerActive')).toBe(false);
      expect(coord.hasTimer('connectedWaitingTimeout')).toBe(false);
    });

    it('clears the expired flag too when condition resolves after expiry', () => {
      const { coord } = createCoordinator();
      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: 0 });
      vi.advanceTimersByTime(30_000);
      expect(coord.get('connectedWaitingExpired')).toBe(true);

      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: 1 });
      expect(coord.get('connectedWaitingExpired')).toBe(false);
    });

    it('clearForTableSwitch cancels both the timer and the state flags', () => {
      const { coord } = createCoordinator();
      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: 0 });
      expect(coord.hasTimer('connectedWaitingTimeout')).toBe(true);

      coord.clearForTableSwitch();
      expect(coord.hasTimer('connectedWaitingTimeout')).toBe(false);
      expect(coord.get('connectedWaitingTimerActive')).toBe(false);
      expect(coord.get('connectedWaitingExpired')).toBe(false);
    });

    it('clearForTableSwitch resets the expired flag mid-flight', () => {
      const { coord } = createCoordinator();
      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: 0 });
      vi.advanceTimersByTime(30_000);
      expect(coord.get('connectedWaitingExpired')).toBe(true);

      coord.clearForTableSwitch();
      expect(coord.get('connectedWaitingExpired')).toBe(false);
    });
  });

  describe('snapshot exposure', () => {
    it('connectedWaitingExpired is surfaced in buildSnapshot', () => {
      const { coord } = createCoordinator();
      const snap1 = coord.buildSnapshot();
      expect(snap1.connectedWaitingExpired).toBe(false);

      coord.evaluateConnectedWaitingTimer({ connected: true, tableCount: 1, handCount: 0 });
      vi.advanceTimersByTime(30_000);

      const snap2 = coord.buildSnapshot();
      expect(snap2.connectedWaitingExpired).toBe(true);
    });
  });
});
