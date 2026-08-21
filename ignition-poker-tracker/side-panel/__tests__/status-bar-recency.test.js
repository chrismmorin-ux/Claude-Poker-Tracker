/**
 * status-bar-recency.test.js — WS-517.
 *
 * `buildStatusBar` keyed LIVE on `handCount > 0`, a CUMULATIVE count with no
 * recency term. Once a single hand had been captured the bar read
 * "Tracking · N hands" forever — an hour after capture died, it looked exactly
 * like a healthy session. A dead capture was visually identical to a live one on
 * the surface the founder glances at most.
 *
 * The ticket is explicit that both LIVE branches must be fixed: the
 * `tableCount > 0 && handCount > 0` branch AND the `handCount > 0` branch.
 * Fixing one leaves a live path to a false LIVE.
 */

import { describe, it, expect } from 'vitest';
import {
  buildStatusBar,
  classifyHandRecency,
  formatAge,
  HAND_STALE_MS,
  HAND_DEAD_MS,
} from '../render-orchestrator.js';
import { STATUS_TIERS } from '../../shared/render-status.js';

const NOW = 2_000_000_000;
const withTable = { tableCount: 1, tables: { 1: {} }, appConnected: true };
const noTable = { tableCount: 0, tables: {}, appConnected: true };

describe('WS-517 — the status bar cannot claim LIVE over a dead capture', () => {
  describe('branch: tableCount > 0 && handCount > 0', () => {
    it('is LIVE while hands are recent', () => {
      const r = buildStatusBar(withTable, 40, false, {
        lastHandCompletedAt: NOW - 30_000, now: NOW,
      });
      expect(r.tier).toBe(STATUS_TIERS.LIVE);
      expect(r.text).toMatch(/40 hands/);
      expect(r.text).not.toMatch(/STOPPED/);
    });

    it('is NOT LIVE when the last hand is long past — the regression', () => {
      const r = buildStatusBar(withTable, 40, false, {
        lastHandCompletedAt: NOW - 20 * 60_000, now: NOW,
      });
      expect(r.tier).not.toBe(STATUS_TIERS.LIVE);
      expect(r.text).toMatch(/STOPPED/);
      expect(r.text).toMatch(/20 min/);
    });
  });

  describe('branch: handCount > 0, no table', () => {
    it('is LIVE while hands are recent', () => {
      const r = buildStatusBar(noTable, 40, false, {
        lastHandCompletedAt: NOW - 30_000, now: NOW,
      });
      expect(r.tier).toBe(STATUS_TIERS.LIVE);
    });

    it('is NOT LIVE when the last hand is long past', () => {
      // Fixing only the other branch would leave this path reporting a false LIVE.
      const r = buildStatusBar(noTable, 40, false, {
        lastHandCompletedAt: NOW - 20 * 60_000, now: NOW,
      });
      expect(r.tier).not.toBe(STATUS_TIERS.LIVE);
      expect(r.text).toMatch(/STOPPED/);
    });
  });

  it('states the age instead of silently downgrading', () => {
    const r = buildStatusBar(withTable, 40, false, {
      lastHandCompletedAt: NOW - 12 * 60_000, now: NOW,
    });
    expect(r.text).toMatch(/no hand for 12 min/);
    // The hand count is still carried — the founder should see both.
    expect(r.text).toMatch(/40 hands/);
  });

  it('escalates from degraded to disconnected as the silence lengthens', () => {
    const stale = buildStatusBar(withTable, 40, false, {
      lastHandCompletedAt: NOW - HAND_STALE_MS, now: NOW,
    });
    const dead = buildStatusBar(withTable, 40, false, {
      lastHandCompletedAt: NOW - HAND_DEAD_MS, now: NOW,
    });
    expect(stale.tier).toBe(STATUS_TIERS.DEGRADED);
    expect(dead.tier).toBe(STATUS_TIERS.DISCONNECTED);
  });

  it('does not invent a dead state when recency is unknown', () => {
    // No lastHandCompletedAt means we do not KNOW capture is dead. Claiming it
    // would be its own false statement, in the opposite direction.
    const r = buildStatusBar(withTable, 40, false, { lastHandCompletedAt: null, now: NOW });
    expect(r.tier).toBe(STATUS_TIERS.LIVE);
    expect(r.text).not.toMatch(/STOPPED/);
  });

  it('preserves the pre-existing behaviour when no recency is passed at all', () => {
    // Back-compat for callers that have not been updated (the harness, tests).
    const r = buildStatusBar(withTable, 40);
    expect(r.tier).toBe(STATUS_TIERS.LIVE);
  });

  it('leaves the zero-hand states untouched', () => {
    expect(buildStatusBar(withTable, 0, false, { now: NOW }).text).toMatch(/waiting for hands/);
    expect(buildStatusBar(withTable, 0, true, { now: NOW }).text).toMatch(/no hands in 30s/);
    expect(buildStatusBar(null, 0).text).toMatch(/Service worker not responding/);
  });
});

describe('classifyHandRecency', () => {
  it('returns no staleness tier for a fresh hand', () => {
    expect(classifyHandRecency({ lastHandCompletedAt: NOW - 1000, now: NOW }, 5).tier).toBeNull();
  });

  it('returns no staleness tier when no hands have been captured', () => {
    expect(classifyHandRecency({ lastHandCompletedAt: NOW - 10 ** 7, now: NOW }, 0).tier).toBeNull();
  });

  it('treats a missing or zero timestamp as unknown, not as dead', () => {
    expect(classifyHandRecency({ lastHandCompletedAt: null, now: NOW }, 5).tier).toBeNull();
    expect(classifyHandRecency({ lastHandCompletedAt: 0, now: NOW }, 5).tier).toBeNull();
  });
});

describe('formatAge', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatAge(45_000)).toBe('45s');
    expect(formatAge(12 * 60_000)).toBe('12 min');
    expect(formatAge(65 * 60_000)).toBe('1h 5m');
  });

  it('does not render garbage for bad input', () => {
    expect(formatAge(NaN)).toBe('?');
    expect(formatAge(-1)).toBe('?');
  });
});
