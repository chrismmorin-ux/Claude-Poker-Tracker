/**
 * sessionAnalytics.test.js — Phase 2 Sessions View Improvement (2026-06-06).
 */

import { describe, it, expect } from 'vitest';
import {
  isCompletedSession,
  computeSessionPnl,
  computeSessionDurationMs,
  computeSummary,
  groupByStake,
  groupByVenue,
  buildBankrollSeries,
} from '../sessionAnalytics';

const HOUR = 3600000;

// Build a completed session with sensible defaults.
const session = (overrides = {}) => ({
  sessionId: 'sx',
  startTime: 1000,
  endTime: 1000 + 2 * HOUR,
  venue: 'Casino A',
  gameType: '1/2',
  buyIn: 200,
  rebuyTransactions: [],
  cashOut: 350,
  tipAmount: 0,
  handCount: 50,
  isActive: false,
  ...overrides,
});

describe('isCompletedSession', () => {
  it('true for endTime + non-null cashOut', () => {
    expect(isCompletedSession(session())).toBe(true);
  });
  it('false when no endTime', () => {
    expect(isCompletedSession(session({ endTime: null }))).toBe(false);
  });
  it('false when cashOut is null/undefined', () => {
    expect(isCompletedSession(session({ cashOut: null }))).toBe(false);
    expect(isCompletedSession(session({ cashOut: undefined }))).toBe(false);
  });
  it('true for cashOut of 0 (a real result)', () => {
    expect(isCompletedSession(session({ cashOut: 0 }))).toBe(true);
  });
});

describe('computeSessionPnl', () => {
  it('cashOut − buyIn − rebuys − tip', () => {
    expect(computeSessionPnl(session())).toBe(150); // 350 - 200
  });
  it('subtracts rebuys', () => {
    const s = session({ rebuyTransactions: [{ amount: 100 }, { amount: 50 }], cashOut: 500 });
    expect(computeSessionPnl(s)).toBe(150); // 500 - 200 - 150
  });
  it('subtracts tip', () => {
    expect(computeSessionPnl(session({ cashOut: 350, tipAmount: 20 }))).toBe(130);
  });
  it('handles legacy session without tipAmount', () => {
    const s = session();
    delete s.tipAmount;
    expect(computeSessionPnl(s)).toBe(150);
  });
  it('returns null for an in-progress session', () => {
    expect(computeSessionPnl(session({ cashOut: null }))).toBeNull();
  });
});

describe('computeSessionDurationMs', () => {
  it('endTime − startTime', () => {
    expect(computeSessionDurationMs(session())).toBe(2 * HOUR);
  });
  it('0 when missing times', () => {
    expect(computeSessionDurationMs(session({ endTime: null }))).toBe(0);
  });
  it('0 for negative (clock skew)', () => {
    expect(computeSessionDurationMs(session({ startTime: 5000, endTime: 1000 }))).toBe(0);
  });
});

describe('computeSummary', () => {
  it('aggregates pnl, hands, duration, and rate', () => {
    const sessions = [
      session({ sessionId: 'a', cashOut: 350, handCount: 50, endTime: 1000 + 2 * HOUR }), // +150, 2h
      session({ sessionId: 'b', cashOut: 100, handCount: 30, endTime: 1000 + 1 * HOUR }), // -100, 1h
    ];
    const s = computeSummary(sessions);
    expect(s.totalPnl).toBe(50);
    expect(s.totalHands).toBe(80);
    expect(s.totalDurationMs).toBe(3 * HOUR);
    expect(s.hourlyRate).toBeCloseTo(50 / 3, 5);
    expect(s.completedCount).toBe(2);
    expect(s.winningCount).toBe(1);
    expect(s.losingCount).toBe(1);
    expect(s.winRate).toBe(0.5);
    expect(s.perSessionAvg).toBe(25);
  });

  it('excludes in-progress sessions from money math but counts totalSessions', () => {
    const sessions = [
      session({ sessionId: 'a', cashOut: 350 }),
      session({ sessionId: 'b', cashOut: null }), // in progress
    ];
    const s = computeSummary(sessions);
    expect(s.totalSessions).toBe(2);
    expect(s.completedCount).toBe(1);
    expect(s.totalPnl).toBe(150);
  });

  it('identifies best and worst sessions', () => {
    const sessions = [
      session({ sessionId: 'win', cashOut: 600 }), // +400
      session({ sessionId: 'lose', cashOut: 50 }), // -150
      session({ sessionId: 'mid', cashOut: 300 }), // +100
    ];
    const s = computeSummary(sessions);
    expect(s.best.session.sessionId).toBe('win');
    expect(s.best.pnl).toBe(400);
    expect(s.worst.session.sessionId).toBe('lose');
    expect(s.worst.pnl).toBe(-150);
  });

  it('returns null rate when there is no duration', () => {
    const s = computeSummary([session({ startTime: 1000, endTime: 1000 })]);
    expect(s.hourlyRate).toBeNull();
  });

  it('handles empty input', () => {
    const s = computeSummary([]);
    expect(s.totalPnl).toBe(0);
    expect(s.completedCount).toBe(0);
    expect(s.winRate).toBeNull();
    expect(s.best).toBeNull();
    expect(s.worst).toBeNull();
  });

  it('tolerates non-array input', () => {
    expect(computeSummary(undefined).totalPnl).toBe(0);
  });
});

describe('groupByStake', () => {
  it('groups by gameType and sorts by pnl desc', () => {
    const sessions = [
      session({ gameType: '1/2', cashOut: 300 }), // +100
      session({ gameType: '2/5', cashOut: 700, buyIn: 500 }), // +200
      session({ gameType: '1/2', cashOut: 250 }), // +50
    ];
    const groups = groupByStake(sessions);
    expect(groups[0].key).toBe('2/5');
    expect(groups[0].pnl).toBe(200);
    const oneTwo = groups.find((g) => g.key === '1/2');
    expect(oneTwo.count).toBe(2);
    expect(oneTwo.pnl).toBe(150);
  });

  it('buckets missing gameType under Unspecified', () => {
    const groups = groupByStake([session({ gameType: undefined })]);
    expect(groups[0].key).toBe('Unspecified');
  });
});

describe('groupByVenue', () => {
  it('groups by venue with per-group hourly rate', () => {
    const sessions = [
      session({ venue: 'Casino A', cashOut: 350, endTime: 1000 + 2 * HOUR }), // +150, 2h
      session({ venue: 'Casino A', cashOut: 250, endTime: 1000 + 2 * HOUR }), // +50, 2h
    ];
    const groups = groupByVenue(sessions);
    expect(groups[0].key).toBe('Casino A');
    expect(groups[0].count).toBe(2);
    expect(groups[0].pnl).toBe(200);
    expect(groups[0].hourlyRate).toBeCloseTo(200 / 4, 5);
  });

  it('buckets missing venue under No venue', () => {
    const groups = groupByVenue([session({ venue: '' })]);
    expect(groups[0].key).toBe('No venue');
  });
});

describe('buildBankrollSeries', () => {
  it('returns cumulative series ordered by endTime', () => {
    const sessions = [
      session({ sessionId: 'b', cashOut: 100, endTime: 5000 }), // -100, later
      session({ sessionId: 'a', cashOut: 350, endTime: 2000 }), // +150, earlier
    ];
    const series = buildBankrollSeries(sessions);
    expect(series.map((p) => p.sessionId)).toEqual(['a', 'b']);
    expect(series.map((p) => p.cumulative)).toEqual([150, 50]);
  });

  it('excludes in-progress sessions', () => {
    const series = buildBankrollSeries([
      session({ sessionId: 'a', cashOut: 350, endTime: 2000 }),
      session({ sessionId: 'open', cashOut: null }),
    ]);
    expect(series).toHaveLength(1);
  });

  it('handles empty input', () => {
    expect(buildBankrollSeries([])).toEqual([]);
  });
});
