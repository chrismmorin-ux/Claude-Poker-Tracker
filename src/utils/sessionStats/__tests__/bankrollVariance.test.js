/**
 * bankrollVariance.test.js — bankroll and variance derivations.
 *
 * Closed-form cases are checked against hand-computed values so the estimators
 * are pinned to arithmetic rather than to their own output. The final block runs
 * the real imported sheet, because the numbers the founder will read come from
 * that data and nothing else proves they are right.
 */

import { describe, it, expect } from 'vitest';
import {
  sessionHours,
  isCashVarianceSession,
  partitionSessions,
  computeWinRate,
  computeWinRateInterval,
  computeRiskOfRuin,
  computeRequiredBankroll,
  computeKelly,
  computeDrawdown,
  computeVarianceReport,
  createRng,
  MIN_SESSIONS_FOR_INTERVAL,
} from '../bankrollVariance';
import { buildSessionRecords } from '../sheetImport';
import { STRATEGY_SHEET_SESSIONS } from '../../../data/strategySheetSessions';

const HOUR = 3600000;

/**
 * A fixed, non-zero epoch base for fixtures.
 *
 * `computeSessionDurationMs` (sessionAnalytics.js) treats a falsy `startTime` as
 * missing, so a fixture anchored at 0 reads as a zero-length session and drops
 * out of every rate calculation. Real records are never at epoch zero.
 */
const BASE = Date.UTC(2026, 0, 1);

/** A completed cash session of `hours` length returning `pnl` profit. */
const s = (pnl, hours, extra = {}) => ({
  sessionId: `s${Math.random()}`,
  startTime: BASE,
  endTime: BASE + hours * HOUR,
  isActive: false,
  buyIn: 500,
  rebuyTransactions: [],
  cashOut: 500 + pnl,
  tipAmount: 0,
  gameType: '1/3',
  venue: 'Test',
  ...extra,
});

describe('sessionHours', () => {
  it('prefers the importer-supplied duration', () => {
    expect(sessionHours(s(100, 2, { durationHours: 3.5 }))).toBe(3.5);
  });

  it('falls back to start/end timestamps', () => {
    expect(sessionHours(s(100, 2))).toBe(2);
  });

  it('reports unknown length as null, never as zero', () => {
    expect(sessionHours(s(100, 0, { durationHours: null, endTime: BASE }))).toBeNull();
    expect(sessionHours(null)).toBeNull();
  });
});

describe('partitionSessions', () => {
  const sessions = [
    s(100, 2),
    s(-50, 3),
    s(900, 4, { sessionKind: 'tournament' }),
    s(-200, 0, { durationHours: null, endTime: BASE }),
    { ...s(10, 1), cashOut: null }, // not completed
  ];

  it('keeps only completed cash sessions of known length in the sample', () => {
    const { sample, tournaments, noDuration } = partitionSessions(sessions);
    expect(sample).toHaveLength(2);
    expect(tournaments).toHaveLength(1);
    expect(noDuration).toHaveLength(1);
  });

  it('excludes a session whose length is unknown from the variance sample', () => {
    // Otherwise it would add profit against zero hours and distort the rate.
    expect(isCashVarianceSession(s(-200, 0, { durationHours: null, endTime: BASE }))).toBe(false);
  });
});

describe('computeWinRate', () => {
  it('weights by hours, not by session count', () => {
    // +100 over 1h and +100 over 9h is +200 over 10h = $20/hr,
    // NOT the average of $100/hr and $11.11/hr.
    const stats = computeWinRate([s(100, 1), s(100, 9)]);
    expect(stats.mu).toBeCloseTo(20, 10);
    expect(stats.hours).toBe(10);
    expect(stats.totalPnl).toBe(200);
  });

  it('computes the cluster-robust SE against a hand-worked fixture', () => {
    // Sessions: (+100, 1h), (-100, 1h), (+200, 2h). Σpnl=200, Σh=4, mu=50.
    // residuals: 100-50=50 ; -100-50=-150 ; 200-100=100
    // SS = 2500 + 22500 + 10000 = 35000
    // var/h = 35000/4 = 8750  → sigma = 93.541...
    // SE = sqrt(35000)/4 = 187.0829/4 = 46.7707
    const stats = computeWinRate([s(100, 1), s(-100, 1), s(200, 2)]);
    expect(stats.mu).toBe(50);
    expect(stats.sigmaPerHour).toBeCloseTo(Math.sqrt(8750), 8);
    expect(stats.se).toBeCloseTo(Math.sqrt(35000) / 4, 8);
    expect(stats.n).toBe(3);
  });

  it('names its cluster unit', () => {
    expect(computeWinRate([s(100, 1)]).clusterUnit).toBe('session');
  });

  it('returns nulls rather than NaN on an empty sample', () => {
    const stats = computeWinRate([]);
    expect(stats.mu).toBeNull();
    expect(stats.se).toBeNull();
    expect(stats.n).toBe(0);
  });
});

describe('computeWinRateInterval', () => {
  const many = (count, pnl, hours) => Array.from({ length: count }, () => s(pnl, hours));

  it('refuses to draw a band from too few sessions', () => {
    const stats = computeWinRate(many(MIN_SESSIONS_FOR_INTERVAL - 1, 100, 2));
    expect(computeWinRateInterval(stats, 95)).toBeNull();
  });

  it('brackets the observed rate symmetrically', () => {
    const sessions = [...many(15, 300, 3), ...many(15, -200, 3)];
    const stats = computeWinRate(sessions);
    const ci = computeWinRateInterval(stats, 95);
    expect(ci.low).toBeCloseTo(stats.mu - 1.96 * stats.se, 8);
    expect(ci.high).toBeCloseTo(stats.mu + 1.96 * stats.se, 8);
    expect(ci.level).toBe(95);
    expect(ci.clusterUnit).toBe('session');
  });

  it('is narrower at 70% than at 95%', () => {
    const stats = computeWinRate([...many(15, 300, 3), ...many(15, -200, 3)]);
    const ci70 = computeWinRateInterval(stats, 70);
    const ci95 = computeWinRateInterval(stats, 95);
    expect(ci70.high - ci70.low).toBeLessThan(ci95.high - ci95.low);
  });

  it('flags an interval that straddles zero', () => {
    // Wildly swingy results around a small positive mean.
    const sessions = [...many(15, 1200, 3), ...many(15, -1100, 3)];
    const ci = computeWinRateInterval(computeWinRate(sessions), 95);
    expect(ci.straddlesZero).toBe(true);
  });

  it('does not flag a clearly winning sample', () => {
    const sessions = many(40, 300, 3);
    const ci = computeWinRateInterval(computeWinRate(sessions), 95);
    expect(ci.straddlesZero).toBe(false);
  });
});

describe('computeRiskOfRuin', () => {
  const stats = { mu: 20, sigmaPerHour: 200 };

  it('matches the closed form', () => {
    // exp(-2 * 20 * 5000 / 40000) = exp(-5)
    expect(computeRiskOfRuin(stats, 5000).probability).toBeCloseTo(Math.exp(-5), 10);
  });

  it('falls as the bankroll grows', () => {
    const small = computeRiskOfRuin(stats, 2000).probability;
    const large = computeRiskOfRuin(stats, 20000).probability;
    expect(large).toBeLessThan(small);
  });

  it('reports CERTAIN ruin at a non-winning rate, not a small number', () => {
    // A break-even or losing player busts any finite bankroll with probability 1.
    for (const mu of [0, -5]) {
      const ruin = computeRiskOfRuin({ mu, sigmaPerHour: 200 }, 50000);
      expect(ruin.probability).toBe(1);
      expect(ruin.certain).toBe(true);
    }
  });

  it('is stamped modelled', () => {
    expect(computeRiskOfRuin(stats, 5000).modelled).toBe(true);
  });

  it('returns null for a missing or nonsensical bankroll', () => {
    expect(computeRiskOfRuin(stats, 0)).toBeNull();
    expect(computeRiskOfRuin(stats, -100)).toBeNull();
    expect(computeRiskOfRuin({ mu: null, sigmaPerHour: null }, 5000)).toBeNull();
  });
});

describe('computeRequiredBankroll', () => {
  const stats = { mu: 20, sigmaPerHour: 200 };

  it('inverts computeRiskOfRuin', () => {
    const required = computeRequiredBankroll(stats, 0.05).bankroll;
    expect(computeRiskOfRuin(stats, required).probability).toBeCloseTo(0.05, 10);
  });

  it('demands more bankroll for a tighter tolerance', () => {
    expect(computeRequiredBankroll(stats, 0.01).bankroll).toBeGreaterThan(
      computeRequiredBankroll(stats, 0.1).bankroll
    );
  });

  it('returns null at a non-winning rate — no bankroll makes it survivable', () => {
    expect(computeRequiredBankroll({ mu: 0, sigmaPerHour: 200 }, 0.05)).toBeNull();
    expect(computeRequiredBankroll({ mu: -10, sigmaPerHour: 200 }, 0.05)).toBeNull();
  });

  it('rejects tolerances outside (0,1)', () => {
    expect(computeRequiredBankroll(stats, 0)).toBeNull();
    expect(computeRequiredBankroll(stats, 1)).toBeNull();
  });
});

describe('computeKelly', () => {
  it('sets the full-Kelly bankroll at variance over edge', () => {
    // 200^2 / 20 = 2000
    expect(computeKelly({ mu: 20, sigmaPerHour: 200 }).full).toBeCloseTo(2000, 10);
  });

  it('requires proportionally more bankroll at fractional Kelly', () => {
    const k = computeKelly({ mu: 20, sigmaPerHour: 200 });
    expect(k.half).toBeCloseTo(k.full * 2, 10);
    expect(k.quarter).toBeCloseTo(k.full * 4, 10);
  });

  it('returns null at a non-winning rate', () => {
    expect(computeKelly({ mu: 0, sigmaPerHour: 200 })).toBeNull();
  });
});

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('produces different streams for different seeds', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });

  it('stays within [0,1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i += 1) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('computeDrawdown', () => {
  it('measures the observed peak-to-trough fall', () => {
    // Cumulative: 100, 300, 100, -100, 200 → peak 300, trough -100 → 400.
    const sessions = [s(100, 1), s(200, 1), s(-200, 1), s(-200, 1), s(300, 1)].map(
      (session, i) => ({ ...session, startTime: BASE + i * HOUR, endTime: BASE + (i + 1) * HOUR })
    );
    expect(computeDrawdown(sessions).observed).toBe(400);
  });

  it('reports zero drawdown for a monotonically rising bankroll', () => {
    const sessions = [s(100, 1), s(100, 1), s(100, 1)].map((session, i) => ({
      ...session, startTime: BASE + i * HOUR, endTime: BASE + (i + 1) * HOUR,
    }));
    expect(computeDrawdown(sessions).observed).toBe(0);
  });

  it('is deterministic across runs at the same seed', () => {
    const sessions = Array.from({ length: 30 }, (_, i) => ({
      ...s(i % 3 === 0 ? -400 : 250, 3),
      startTime: BASE + i * HOUR,
      endTime: BASE + (i + 1) * HOUR,
    }));
    const a = computeDrawdown(sessions, { seed: 99, iterations: 500 });
    const b = computeDrawdown(sessions, { seed: 99, iterations: 500 });
    expect(a.expected).toBe(b.expected);
    expect(a.p90).toBe(b.p90);
  });

  it('puts the 90th percentile above the mean expectation', () => {
    const sessions = Array.from({ length: 30 }, (_, i) => ({
      ...s(i % 3 === 0 ? -400 : 250, 3),
      startTime: BASE + i * HOUR,
      endTime: BASE + (i + 1) * HOUR,
    }));
    const dd = computeDrawdown(sessions, { seed: 5, iterations: 1000 });
    expect(dd.p90).toBeGreaterThanOrEqual(dd.expected);
    expect(dd.modelled).toBe(true);
    expect(dd.clusterUnit).toBe('session');
  });

  it('declines to model from a single session', () => {
    const dd = computeDrawdown([s(100, 1)]);
    expect(dd.expected).toBeNull();
    expect(dd.p90).toBeNull();
  });
});

describe('the real sheet — end-to-end', () => {
  const { records } = buildSessionRecords(STRATEGY_SHEET_SESSIONS);
  const stats = computeWinRate(records);

  it('builds the cash variance sample from the imported history', () => {
    // 78 rows → 11 tournaments and a handful of cash rows with no clock times.
    expect(stats.n).toBe(52);
    expect(stats.hours).toBeCloseTo(196.2, 1);
  });

  it('reports the observed win rate the sheet could never compute', () => {
    expect(stats.totalPnl).toBe(3193);
    expect(stats.mu).toBeCloseTo(16.27, 1);
    expect(stats.sigmaPerHour).toBeGreaterThan(0);
  });

  it('shows the interval still straddles zero — the sample cannot yet prove a win rate', () => {
    // This is the headline the whole feature exists to deliver honestly.
    const ci = computeWinRateInterval(stats, 95);
    expect(ci).not.toBeNull();
    expect(ci.low).toBeLessThan(0);
    expect(ci.high).toBeGreaterThan(0);
    expect(ci.straddlesZero).toBe(true);
  });

  it('produces a full report with the exclusions declared', () => {
    const report = computeVarianceReport(records, { bankroll: 5000, tolerance: 0.05 });
    expect(report.excluded.tournaments).toBe(11);
    expect(report.excluded.noDuration).toBeGreaterThan(0);
    expect(report.requiredBankroll.bankroll).toBeGreaterThan(0);
    expect(report.kelly.full).toBeGreaterThan(0);
    expect(report.drawdown.observed).toBeGreaterThan(0);
  });
});
