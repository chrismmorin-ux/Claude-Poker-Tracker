/**
 * separability.test.js — WS-320.
 *
 * These tests exist because the instrument's failure mode is not a crash — it is a plausible
 * number. An overdispersion statistic that is silently off by a factor of m/(m-1), or a
 * between-player SD with the wrong denominator, or a shrinkage prior that includes the player
 * it shrinks, all produce output that looks exactly like output. So each test pins a
 * DISTINCTION whose collapse would make the verdict wrong while the report still rendered.
 *
 * The load-bearing ones: a homogeneous population must return χ²/df ≈ 1 (or the "separates"
 * verdict is free), a genuinely heterogeneous one must return χ²/df ≫ 1 (or "does not
 * separate" is free), and an underpowered null must be labelled underpowered rather than
 * negative — which is the exact error §11.8 flagged in its own headline.
 */

import { describe, it, expect } from 'vitest';

import {
  DEFAULT_PRIOR_WEIGHT,
  OBS_FOR_MOVEABLE_ESTIMATE,
  acquiredFlags,
  coOccurrence,
  crossAxisCorrelation,
  ladderNesting,
  median,
  overdispersion,
  pearson,
  separabilityVerdict,
  shrinkRates,
  spearman,
  splitHalfReliability,
} from '../backtest/separability.mjs';

// Deterministic RNG. A test whose fixture moves between runs cannot pin a numeric threshold,
// and a flaky statistical test gets disabled, which is worse than not having it.
const mulberry32 = (seed) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const drawBinomial = (n, p, rnd) => {
  let k = 0;
  for (let i = 0; i < n; i++) if (rnd() < p) k++;
  return k;
};

/** m players who genuinely all share one rate. The null, materialised. */
const homogeneous = (m, n, p, seed) => {
  const rnd = mulberry32(seed);
  return Array.from({ length: m }, (_, i) => ({
    playerKey: `h${i}`, n, k: drawBinomial(n, p, rnd),
  }));
};

/** m players whose true rates are spread by `sd`. Real heterogeneity, materialised. */
const heterogeneous = (m, n, p, sd, seed) => {
  const rnd = mulberry32(seed);
  return Array.from({ length: m }, (_, i) => {
    // Deterministic spread rather than a normal draw: the point is a KNOWN between-player SD.
    const offset = ((i % 2 === 0) ? 1 : -1) * sd;
    const pi = Math.min(0.95, Math.max(0.05, p + offset));
    return { playerKey: `x${i}`, n, k: drawBinomial(n, pi, rnd) };
  });
};

describe('overdispersion — the statistic must be able to say NO', () => {
  it('returns chi2/df near 1.0 when every player really does share one rate', () => {
    const rows = homogeneous(400, 60, 0.4, 11);
    const p = rows.reduce((s, r) => s + r.k, 0) / rows.reduce((s, r) => s + r.n, 0);
    const stats = overdispersion({ rows, commonRate: p, rateEstimatedInSample: true });

    expect(stats.chi2PerDf).toBeGreaterThan(0.85);
    expect(stats.chi2PerDf).toBeLessThan(1.15);
    expect(Math.abs(stats.z)).toBeLessThan(3);
  });

  it('returns a large chi2/df and a large z when players genuinely differ', () => {
    const rows = heterogeneous(400, 60, 0.4, 0.12, 12);
    const p = rows.reduce((s, r) => s + r.k, 0) / rows.reduce((s, r) => s + r.n, 0);
    const stats = overdispersion({ rows, commonRate: p, rateEstimatedInSample: true });

    expect(stats.chi2PerDf).toBeGreaterThan(1.5);
    expect(stats.z).toBeGreaterThan(10);
  });

  it('recovers the planted between-player SD to within a couple of points', () => {
    // The SD estimator is the number a reader actually acts on ("9pp vs 2pp"), so a wrong
    // denominator here would be quoted for years. Planted SD is 12pp.
    const rows = heterogeneous(600, 80, 0.4, 0.12, 13);
    const p = rows.reduce((s, r) => s + r.k, 0) / rows.reduce((s, r) => s + r.n, 0);
    const stats = overdispersion({ rows, commonRate: p, rateEstimatedInSample: true });

    expect(stats.betweenPlayerSd).toBeGreaterThan(0.09);
    expect(stats.betweenPlayerSd).toBeLessThan(0.15);
  });

  it('spends a degree of freedom only when the common rate was fitted in-sample', () => {
    const rows = homogeneous(50, 40, 0.3, 14);
    const inSample = overdispersion({ rows, commonRate: 0.3, rateEstimatedInSample: true });
    const external = overdispersion({ rows, commonRate: 0.3, rateEstimatedInSample: false });

    expect(inSample.df).toBe(49);
    expect(external.df).toBe(50);
    // Same chi2, different df — so the ratio must differ. If these were equal the df logic
    // would be dead code and every leakage-free reading would be silently mis-scaled.
    expect(inSample.chi2).toBeCloseTo(external.chi2, 10);
    expect(inSample.chi2PerDf).not.toBeCloseTo(external.chi2PerDf, 6);
  });

  it('refuses rather than divides by zero on a degenerate rate', () => {
    const stats = overdispersion({ rows: [{ n: 10, k: 0 }], commonRate: 0 });
    expect(stats.chi2PerDf).toBeNull();
    expect(stats.note).toMatch(/degenerate/);
  });
});

describe('shrinkage — the prior must not contain the player it shrinks', () => {
  it('leaves the shrunk player out of their own prior', () => {
    // One extreme player among many. If the prior included him it would be dragged toward
    // him, and his shrunk rate would sit closer to his raw rate than it should.
    const rows = [
      { playerKey: 'a', k: 100, n: 100 },
      ...Array.from({ length: 20 }, (_, i) => ({ playerKey: `b${i}`, k: 0, n: 100 })),
    ];
    const [extreme] = shrinkRates(rows, { priorWeight: DEFAULT_PRIOR_WEIGHT });
    // Everyone else is at 0.0, so a correct leave-one-out prior for `a` is exactly 0.
    expect(extreme.prior).toBe(0);
    expect(extreme.shrunkRate).toBeCloseTo(100 / 110, 10);
  });

  it('uses an external prior verbatim when one is supplied', () => {
    const rows = [{ playerKey: 'a', k: 5, n: 10 }];
    const [row] = shrinkRates(rows, { priorWeight: 10, externalPrior: 0.25 });
    expect(row.prior).toBe(0.25);
    expect(row.shrunkRate).toBeCloseTo((5 + 10 * 0.25) / 20, 10);
  });

  it('pulls a thin player almost entirely to the prior and a thick one barely at all', () => {
    const rows = [
      { playerKey: 'thin', k: 2, n: 2 },
      { playerKey: 'thick', k: 200, n: 200 },
      ...Array.from({ length: 50 }, (_, i) => ({ playerKey: `p${i}`, k: 20, n: 100 })),
    ];
    const out = shrinkRates(rows, { priorWeight: 10 });
    const thin = out.find((r) => r.playerKey === 'thin');
    const thick = out.find((r) => r.playerKey === 'thick');
    expect(thin.shrunkRate).toBeLessThan(0.5);      // dragged far off its raw 1.0
    expect(thick.shrunkRate).toBeGreaterThan(0.95); // barely moved
  });
});

describe('correlation and attenuation', () => {
  it('pearson and spearman agree on a monotone relationship and spearman survives a nonlinear one', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8];
    const cubed = xs.map((x) => x ** 3);
    expect(pearson(xs, xs)).toBeCloseTo(1, 10);
    expect(spearman(xs, cubed)).toBeCloseTo(1, 10);
    expect(pearson(xs, cubed)).toBeLessThan(1);
  });

  it('handles ties with average ranks rather than an arbitrary order', () => {
    expect(spearman([1, 1, 2, 2, 3, 3], [1, 1, 2, 2, 3, 3])).toBeCloseTo(1, 10);
  });

  it('returns null rather than a number when there is no variance to correlate', () => {
    expect(pearson([1, 1, 1, 1], [1, 2, 3, 4])).toBeNull();
    expect(pearson([1, 2], [1, 2])).toBeNull();
  });

  it('split-half reliability is high for a stable trait and low for pure noise', () => {
    const rnd = mulberry32(21);
    const stable = Array.from({ length: 300 }, (_, i) => {
      const p = 0.1 + 0.8 * ((i % 10) / 10);
      return { playerKey: `s${i}`, bits: Array.from({ length: 80 }, () => rnd() < p) };
    });
    const noise = Array.from({ length: 300 }, (_, i) => ({
      playerKey: `n${i}`, bits: Array.from({ length: 80 }, () => rnd() < 0.4),
    }));

    const stableR = splitHalfReliability(stable, { minHalfN: 10 });
    const noiseR = splitHalfReliability(noise, { minHalfN: 10 });

    expect(stableR.reliability).toBeGreaterThan(0.7);
    expect(noiseR.reliability).toBeLessThan(0.3);
  });

  it('refuses to disattenuate when a reliability is missing, rather than inventing a denominator', () => {
    const a = new Map([['p1', 0.2], ['p2', 0.4], ['p3', 0.6], ['p4', 0.8]]);
    const b = new Map([['p1', 0.3], ['p2', 0.5], ['p3', 0.4], ['p4', 0.9]]);
    const out = crossAxisCorrelation({ a, b, reliabilityA: null, reliabilityB: 0.8 });
    expect(out.pearson).not.toBeNull();
    expect(out.disattenuated).toBeNull();
    expect(out.disattenuationBlocked).toMatch(/attenuation cannot be corrected/);
  });

  it('disattenuates upward, and clamps to 1 rather than reporting a correlation above unity', () => {
    const a = new Map([['p1', 0.1], ['p2', 0.2], ['p3', 0.35], ['p4', 0.5], ['p5', 0.62]]);
    const b = new Map([['p1', 0.12], ['p2', 0.25], ['p3', 0.3], ['p4', 0.55], ['p5', 0.6]]);
    const out = crossAxisCorrelation({ a, b, reliabilityA: 0.3, reliabilityB: 0.3 });
    expect(out.disattenuatedUncapped).toBeGreaterThan(out.pearson);
    expect(out.disattenuated).toBeLessThanOrEqual(1);
  });
});

describe('ordering — a ladder must be distinguishable from independent habits', () => {
  const mapOf = (entries) => new Map(entries);

  it('splits at the median and honours the studied direction', () => {
    const rates = mapOf([['a', 0.1], ['b', 0.2], ['c', 0.3], ['d', 0.4]]);
    const lower = acquiredFlags(rates, 'lower');
    const higher = acquiredFlags(rates, 'higher');
    expect(lower.threshold).toBeCloseTo(0.25, 10);
    // "lower is studied" — the small-rate players are the ones who acquired the rung.
    expect(lower.flags.get('a')).toBe(true);
    expect(lower.flags.get('d')).toBe(false);
    expect(higher.flags.get('a')).toBe(false);
    expect(higher.flags.get('d')).toBe(true);
  });

  it('reports both conditionals, because they support opposite reads', () => {
    const flagsA = mapOf([['1', true], ['2', true], ['3', true], ['4', false]]);
    const flagsB = mapOf([['1', true], ['2', false], ['3', false], ['4', false]]);
    const c = coOccurrence({ flagsA, flagsB, labelA: 'A', labelB: 'B' });
    // 1 of 1 B-players also have A; 1 of 3 A-players also have B. Same cell, opposite stories.
    expect(c.pAgivenB).toBeCloseTo(1, 10);
    expect(c.pBgivenA).toBeCloseTo(1 / 3, 10);
  });

  it('counts a perfectly nested ladder as zero violations and independence as roughly chance', () => {
    const nestedKeys = ['p0', 'p1', 'p2', 'p3'];
    const patterns = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1]];
    const maps = [0, 1, 2].map((r) => new Map(nestedKeys.map((k, i) => [k, Boolean(patterns[i][r])])));
    const nested = ladderNesting({ orderedFlagMaps: maps, labels: ['r1', 'r2', 'r3'] });
    expect(nested.violations).toBe(0);
    // Marginals here are 0.75 / 0.5 / 0.25, so the equal-marginal shortcut (0.5) is WRONG and
    // the honest baseline is higher. This is the exact artifact the live run nearly reported.
    expect(nested.marginals).toEqual([0.75, 0.5, 0.25]);
    expect(nested.equalMarginalBaseline).toBeCloseTo(0.5, 10);
    expect(nested.expectedNestedRateUnderIndependence).toBeCloseTo(
      (0.25 * 0.5 * 0.75) + (0.75 * 0.5 * 0.75) + (0.75 * 0.5 * 0.75) + (0.75 * 0.5 * 0.25), 10,
    );
    expect(nested.expectedNestedRateUnderIndependence).toBeGreaterThan(0.5);
  });

  it('computes the independence baseline from OBSERVED marginals, not an assumed 50/50', () => {
    // A selected subset where almost everyone has rung 1. Independent habits ALONE then
    // produce mostly-nested patterns, and scoring against 0.5 would read that as a ladder.
    const keys = Array.from({ length: 100 }, (_, i) => `p${i}`);
    const maps = [
      new Map(keys.map((k, i) => [k, i < 95])),   // marginal 0.95
      new Map(keys.map((k, i) => [k, i < 50])),   // marginal 0.50
      new Map(keys.map((k, i) => [k, i < 50])),   // marginal 0.50
    ];
    const nested = ladderNesting({ orderedFlagMaps: maps, labels: ['r1', 'r2', 'r3'] });
    expect(nested.marginals).toEqual([0.95, 0.5, 0.5]);
    expect(nested.expectedNestedRateUnderIndependence).toBeGreaterThan(0.5);
    // Excess is measured against the honest baseline, so a selection effect cannot masquerade
    // as evidence for the ladder.
    expect(nested.excessOverIndependence).toBeCloseTo(
      nested.nestedRate - nested.expectedNestedRateUnderIndependence, 10,
    );

    // A player with rung 3 but not rung 1 is exactly what a ladder forbids.
    const broken = [
      new Map([['q', false]]),
      new Map([['q', false]]),
      new Map([['q', true]]),
    ];
    expect(ladderNesting({ orderedFlagMaps: broken, labels: ['r1', 'r2', 'r3'] }).violations).toBe(1);
  });
});

describe('verdict — an underpowered null must never be reported as a negative', () => {
  const control = { chi2PerDf: 1.86, z: 15.5, betweenPlayerSd: 0.09 };

  it('calls a thin-sample null UNDERPOWERED, not does-not-separate', () => {
    const stats = {
      chi2PerDf: 1.005, z: 0.06, obsPerPlayerMedian: 2, betweenPlayerSd: 0.02, note: null,
    };
    const v = separabilityVerdict({ stats, controlStats: control });
    expect(v.verdict).toBe('underpowered');
    expect(v.reason).toMatch(/NOT proof of absence/);
  });

  it('calls a well-sampled null does-not-separate, and says the instrument was working', () => {
    const stats = {
      chi2PerDf: 1.01, z: 0.4, obsPerPlayerMedian: OBS_FOR_MOVEABLE_ESTIMATE * 3,
      betweenPlayerSd: 0.01, note: null,
    };
    const v = separabilityVerdict({ stats, controlStats: control });
    expect(v.verdict).toBe('does-not-separate');
    expect(v.reason).toMatch(/instrument was working/);
    // The founder's standing rule, stated in the artifact rather than only in a memory file.
    expect(v.reason).toMatch(/do not delete anything/i);
  });

  it('calls a large excess SEPARATES and quotes the control from the same run', () => {
    const stats = {
      chi2PerDf: 2.4, z: 22, obsPerPlayerMedian: 40, betweenPlayerSd: 0.11, note: null,
    };
    const v = separabilityVerdict({ stats, controlStats: control });
    expect(v.verdict).toBe('separates');
    expect(v.reason).toContain('1.860');
  });
});

describe('median', () => {
  it('averages the middle pair on an even count', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([])).toBeNull();
  });
});
