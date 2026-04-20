import { describe, test, expect } from 'vitest';
import {
  computeFrameworkPredictions,
  buildFrameworkInsight,
  buildCalibration,
  extractTrend,
} from '../estimateInsights';
import { classifyMatchup } from '../frameworks';
import { parseHandClass } from '../../pokerCore/preflopEquity';

const matchesFor = (a, b) => classifyMatchup(parseHandClass(a), parseHandClass(b));

describe('computeFrameworkPredictions', () => {
  test('pair over pair returns a single banded prediction (~82% for hero-favored)', () => {
    const matches = matchesFor('AA', 'KK');
    const preds = computeFrameworkPredictions(matches);
    const pop = preds.find((p) => p.frameworkId === 'pair_over_pair');
    expect(pop).toBeDefined();
    // Band [0.80, 0.84] midpoint = 0.82. Hero (A) is favored.
    expect(pop.predictedEquity).toBeCloseTo(0.82, 2);
  });

  test('kicker-dominated reflects hero-favored (AK vs AQ ~73%)', () => {
    const matches = matchesFor('AKo', 'AQo');
    const preds = computeFrameworkPredictions(matches);
    const dom = preds.find((p) => p.frameworkId === 'domination');
    expect(dom.subcaseId).toBe('kicker_dominated');
    // Band [0.70, 0.76] midpoint = 0.73, hero favored.
    expect(dom.predictedEquity).toBeCloseTo(0.73, 2);
  });

  test('hand B favored flips hero equity (AQ vs AK → hero ~27%)', () => {
    const matches = matchesFor('AQo', 'AKo');
    const preds = computeFrameworkPredictions(matches);
    const dom = preds.find((p) => p.frameworkId === 'domination');
    // Hero (AQo) is DOMINATED — hero equity ≈ 1 − 0.73 = 0.27.
    expect(dom.predictedEquity).toBeCloseTo(0.27, 2);
  });

  test('unbanded modifiers are skipped (broadway vs connector has no band)', () => {
    const matches = matchesFor('AKo', 'JTs');
    const preds = computeFrameworkPredictions(matches);
    // Broadway vs Connector, Decomposition, Straight Coverage, Flush
    // Contention all lack bands → zero banded predictions.
    expect(preds).toEqual([]);
  });
});

describe('buildFrameworkInsight', () => {
  test('no_banded when no framework with a band applies', () => {
    const matches = matchesFor('AKo', 'JTs');
    const insight = buildFrameworkInsight(matches, 0.60, 0.595);
    expect(insight.kind).toBe('no_banded');
  });

  test('aligned when user + truth both closest to same banded framework', () => {
    const matches = matchesFor('AA', 'KK');
    // User guesses 80, truth is 82 — both nearest to pair_over_pair's 82.
    const insight = buildFrameworkInsight(matches, 0.80, 0.82);
    expect(insight.kind).toBe('aligned');
    expect(insight.userFramework.frameworkId).toBe('pair_over_pair');
  });

  test('mis_applied when user\'s estimate snaps to a different banded prediction than truth', () => {
    // Synthetic scenario: hero has two banded predictions available, user's
    // guess sits closer to the non-dominant one. Use 77 vs A7o:
    //   — DOMINATION.pair_vs_shared_over band [0.64, 0.72] → hero 77 is
    //     "pair with shared rank, opponent has higher card" → hero favored ~68%
    //   Only one framework applies here — so craft a different case...
    // Use AA vs AKo (pair_dominates_kicker only). Can't demo mis_applied
    // without multiple applying banded frameworks.
    //
    // But we CAN test the mis_applied path by mocking frameworkMatches with
    // two entries whose predictions differ. Build them by hand.
    const matches = [
      { framework: { id: 'pair_over_pair', name: 'Pair over Pair' }, subcase: 'pair_over_pair', favored: 'A' },
      { framework: { id: 'domination',     name: 'Domination' },     subcase: 'kicker_dominated', favored: 'A' },
    ];
    // pair_over_pair midpoint = 0.82; kicker_dominated midpoint = 0.73.
    // User = 0.80 (closer to 0.82 → pair_over_pair). Truth = 0.72 (closer
    // to 0.73 → domination).
    const insight = buildFrameworkInsight(matches, 0.80, 0.72);
    expect(insight.kind).toBe('mis_applied');
    expect(insight.userFramework.frameworkId).toBe('pair_over_pair');
    expect(insight.truthFramework.frameworkId).toBe('domination');
  });
});

describe('buildCalibration', () => {
  test('returns empty when no drills', () => {
    expect(buildCalibration([])).toEqual([]);
    expect(buildCalibration(null)).toEqual([]);
  });

  test('computes per-framework signed delta, filters below MIN_SAMPLES', () => {
    const drills = [
      // 3 race drills where user overshoots by +0.05 avg.
      mkDrill({ estimate: 0.60, truth: 0.55, frameworks: ['race'] }),
      mkDrill({ estimate: 0.62, truth: 0.56, frameworks: ['race'] }),
      mkDrill({ estimate: 0.58, truth: 0.54, frameworks: ['race'] }),
      // 2 domination drills — below threshold, should be filtered.
      mkDrill({ estimate: 0.70, truth: 0.75, frameworks: ['domination'] }),
      mkDrill({ estimate: 0.72, truth: 0.73, frameworks: ['domination'] }),
    ];
    const cal = buildCalibration(drills);
    expect(cal).toHaveLength(1);
    expect(cal[0].frameworkId).toBe('race');
    expect(cal[0].n).toBe(3);
    // Mean signed delta: ((60-55)+(62-56)+(58-54))/3 = (5+6+4)/3 = 5.0pp = 0.05
    expect(cal[0].signedAvgDelta).toBeCloseTo(0.05, 2);
    expect(cal[0].absAvgDelta).toBeCloseTo(0.05, 2);
  });

  test('sorts by |signedAvgDelta| descending', () => {
    const drills = [
      // Race: 3 attempts, avg signed +0.02 (small)
      mkDrill({ estimate: 0.57, truth: 0.55, frameworks: ['race'] }),
      mkDrill({ estimate: 0.58, truth: 0.56, frameworks: ['race'] }),
      mkDrill({ estimate: 0.56, truth: 0.54, frameworks: ['race'] }),
      // Pair over pair: 3 attempts, avg signed -0.08 (larger)
      mkDrill({ estimate: 0.74, truth: 0.82, frameworks: ['pair_over_pair'] }),
      mkDrill({ estimate: 0.73, truth: 0.82, frameworks: ['pair_over_pair'] }),
      mkDrill({ estimate: 0.75, truth: 0.82, frameworks: ['pair_over_pair'] }),
    ];
    const cal = buildCalibration(drills);
    expect(cal[0].frameworkId).toBe('pair_over_pair'); // larger absolute miscalibration first
    expect(cal[1].frameworkId).toBe('race');
  });

  test('ignores non-estimate drill types', () => {
    const drills = [
      mkDrill({ estimate: 0.80, truth: 0.82, frameworks: ['pair_over_pair'] }),
      mkDrill({ estimate: 0.80, truth: 0.82, frameworks: ['pair_over_pair'], drillType: 'framework' }),
      mkDrill({ estimate: 0.80, truth: 0.82, frameworks: ['pair_over_pair'] }),
      mkDrill({ estimate: 0.80, truth: 0.82, frameworks: ['pair_over_pair'] }),
    ];
    const cal = buildCalibration(drills);
    expect(cal[0].n).toBe(3); // only the 3 estimate drills
  });
});

describe('extractTrend', () => {
  test('returns last N signed deltas in chronological order', () => {
    // Drills are stored newest-first; trend should return oldest-first up to N.
    const drills = [
      mkDrill({ estimate: 0.70, truth: 0.65, timestamp: 5 }), // newest
      mkDrill({ estimate: 0.60, truth: 0.55, timestamp: 4 }),
      mkDrill({ estimate: 0.50, truth: 0.48, timestamp: 3 }),
      mkDrill({ estimate: 0.55, truth: 0.58, timestamp: 2 }),
      mkDrill({ estimate: 0.40, truth: 0.45, timestamp: 1 }), // oldest
    ];
    const trend = extractTrend(drills, 5);
    expect(trend).toHaveLength(5);
    // Oldest first (timestamp=1) → newest last (timestamp=5).
    expect(trend[0].signedDelta).toBeCloseTo(-0.05, 2);
    expect(trend[4].signedDelta).toBeCloseTo(0.05, 2);
  });

  test('caps at limit when more than N drills present', () => {
    const drills = Array.from({ length: 30 }, (_, i) =>
      mkDrill({ estimate: 0.5, truth: 0.5, timestamp: i }),
    );
    const trend = extractTrend(drills, 20);
    expect(trend).toHaveLength(20);
  });

  test('skips records missing estimate or truth', () => {
    const drills = [
      mkDrill({ estimate: 0.50, truth: 0.55 }),
      { drillType: 'estimate', userAnswer: {}, truth: { equity: 0.50 } }, // no estimate
      { drillType: 'estimate', userAnswer: { estimate: 0.50 }, truth: {} }, // no truth
      mkDrill({ estimate: 0.60, truth: 0.55 }),
    ];
    const trend = extractTrend(drills);
    expect(trend).toHaveLength(2);
  });
});

// ---------- helper ---------- //

const mkDrill = ({ estimate, truth, frameworks = [], drillType = 'estimate', timestamp = 0 }) => ({
  drillType,
  userAnswer: { estimate },
  truth: { equity: truth, frameworks },
  timestamp,
});
