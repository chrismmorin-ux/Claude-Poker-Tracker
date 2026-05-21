/**
 * equityDistributionCurve.test.js — Pure-math correctness for the EDC
 * descriptor: sort order, percentile alignment, weight respect, empty
 * handling, hero→villain equity flip, 8-bucket histogram.
 *
 * SLS Stream B2 — WS-042 / SPR-084.
 */

import { describe, it, expect } from 'vitest';
import {
  computeEquityDistributionCurve,
  EQUITY_BUCKET_EDGES,
} from '../equityDistributionCurve';

const mk = (weight, heroEquity) => ({ weight, heroEquity });

describe('computeEquityDistributionCurve — empty / sparse inputs', () => {
  it('returns empty for null input', () => {
    const r = computeEquityDistributionCurve(null);
    expect(r.status).toBe('empty');
    expect(r.sortedEquities).toEqual([]);
    expect(r.totalWeight).toBe(0);
    expect(r.weightedMean).toBe(0);
    expect(r.combosTotal).toBe(0);
  });

  it('returns empty for non-array input', () => {
    const r = computeEquityDistributionCurve({});
    expect(r.status).toBe('empty');
  });

  it('returns empty for empty array', () => {
    const r = computeEquityDistributionCurve([]);
    expect(r.status).toBe('empty');
    expect(r.bucketHistogram).toEqual(new Array(8).fill(0));
  });

  it('returns empty when all weights below 0.001 threshold', () => {
    const r = computeEquityDistributionCurve([mk(0.0001, 0.5), mk(0.0005, 0.7)]);
    expect(r.status).toBe('empty');
  });

  it('skips combos with non-finite fields, processes rest', () => {
    const r = computeEquityDistributionCurve([
      mk(0.5, NaN),
      mk(Infinity, 0.5),
      mk(0.5, 0.6),
    ]);
    expect(r.status).toBe('ok');
    expect(r.combosTotal).toBe(1);
  });

  it('returns empty when filtered total weight falls below MIN_CLASSIFIABLE_WEIGHT (0.01)', () => {
    const r = computeEquityDistributionCurve([mk(0.005, 0.5), mk(0.004, 0.7)]);
    expect(r.status).toBe('empty');
  });
});

describe('computeEquityDistributionCurve — sort + percentile shape', () => {
  it('sortedEquities is ascending', () => {
    const r = computeEquityDistributionCurve([
      mk(0.5, 0.2), // villain eq 0.8
      mk(0.5, 0.8), // villain eq 0.2
      mk(0.5, 0.5), // villain eq 0.5
    ]);
    expect(r.status).toBe('ok');
    expect(r.sortedEquities[0]).toBeLessThanOrEqual(r.sortedEquities[1]);
    expect(r.sortedEquities[1]).toBeLessThanOrEqual(r.sortedEquities[2]);
  });

  it('converts heroEquity to villainEquity (complement)', () => {
    const r = computeEquityDistributionCurve([mk(1, 0.3)]);
    expect(r.sortedEquities[0]).toBeCloseTo(0.7, 5);
  });

  it('percentiles are non-decreasing and end at 1.0', () => {
    const r = computeEquityDistributionCurve([
      mk(0.2, 0.5),
      mk(0.3, 0.6),
      mk(0.5, 0.7),
    ]);
    for (let i = 1; i < r.percentiles.length; i++) {
      expect(r.percentiles[i]).toBeGreaterThanOrEqual(r.percentiles[i - 1]);
    }
    expect(r.percentiles[r.percentiles.length - 1]).toBeCloseTo(1, 6);
  });

  it('combosTotal equals length of filtered perCombo array', () => {
    const r = computeEquityDistributionCurve([
      mk(0.5, 0.4),
      mk(0.3, 0.5),
      mk(0.2, 0.6),
    ]);
    expect(r.combosTotal).toBe(3);
  });

  it('totalWeight is the sum of weights', () => {
    const r = computeEquityDistributionCurve([mk(0.1, 0.5), mk(0.2, 0.5), mk(0.3, 0.5)]);
    expect(r.totalWeight).toBeCloseTo(0.6, 6);
  });

  it('weightedMean reflects villain equity weighted by combo weight', () => {
    // Two combos, both weight 1, hero eq 0.0 + hero eq 1.0
    // → villain eq 1.0 + villain eq 0.0 → mean 0.5
    const r = computeEquityDistributionCurve([mk(1, 0), mk(1, 1)]);
    expect(r.weightedMean).toBeCloseTo(0.5, 5);
  });

  it('weightedMean respects weight asymmetry', () => {
    // weight-3 combo at villain eq 0.9, weight-1 combo at villain eq 0.1
    // → weighted mean = (3*0.9 + 1*0.1) / 4 = 2.8 / 4 = 0.7
    const r = computeEquityDistributionCurve([mk(3, 0.1), mk(1, 0.9)]);
    expect(r.weightedMean).toBeCloseTo(0.7, 5);
  });
});

describe('computeEquityDistributionCurve — bucket histogram', () => {
  it('exposes 8 buckets matching EQUITY_BUCKET_EDGES', () => {
    const r = computeEquityDistributionCurve([mk(1, 0.5)]);
    expect(r.bucketHistogram).toHaveLength(8);
    expect(r.bucketEdges).toEqual(EQUITY_BUCKET_EDGES.slice());
    expect(r.bucketEdges).toHaveLength(9);
  });

  it('histogram fractions sum to 1.0 on non-empty input', () => {
    const r = computeEquityDistributionCurve([
      mk(0.3, 0.1),
      mk(0.4, 0.5),
      mk(0.3, 0.9),
    ]);
    const sum = r.bucketHistogram.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it('routes equity values to correct bucket', () => {
    // heroEquity 0.0 → villain eq 1.0 → top bucket (index 7)
    const r = computeEquityDistributionCurve([mk(1, 0)]);
    expect(r.bucketHistogram[7]).toBeCloseTo(1, 5);
    for (let i = 0; i < 7; i++) expect(r.bucketHistogram[i]).toBeCloseTo(0, 5);
  });

  it('puts villain equity 0 in bucket 0', () => {
    const r = computeEquityDistributionCurve([mk(1, 1)]); // villain eq 0
    expect(r.bucketHistogram[0]).toBeCloseTo(1, 5);
  });

  it('puts villain equity 0.5 in middle bucket (index 4)', () => {
    const r = computeEquityDistributionCurve([mk(1, 0.5)]); // villain eq 0.5
    expect(r.bucketHistogram[4]).toBeCloseTo(1, 5);
  });

  it('weighted bucketing — heavy weight dominates its bucket', () => {
    const r = computeEquityDistributionCurve([
      mk(0.9, 0.5), // villain eq 0.5 → bucket 4
      mk(0.1, 0.5), // villain eq 0.5 → bucket 4
    ]);
    expect(r.bucketHistogram[4]).toBeCloseTo(1, 5);
  });

  it('classifies hockey-stick (most mass low, some high spike)', () => {
    const r = computeEquityDistributionCurve([
      mk(0.1, 0.05), // villain eq 0.95 → bucket 7 (the "spire")
      mk(0.1, 0.10), // villain eq 0.90 → bucket 7
      mk(0.6, 0.65), // villain eq 0.35 → bucket 2 (bulk of medium-weak)
      mk(0.6, 0.70), // villain eq 0.30 → bucket 2
      mk(0.6, 0.75), // villain eq 0.25 → bucket 2
    ]);
    // Most weight should be in bucket 2; bucket 7 should be non-zero (spire)
    expect(r.bucketHistogram[2]).toBeGreaterThan(0.5);
    expect(r.bucketHistogram[7]).toBeGreaterThan(0.05);
  });
});

describe('computeEquityDistributionCurve — discriminated-union contract', () => {
  it('always returns the same field set (status: ok)', () => {
    const r = computeEquityDistributionCurve([mk(1, 0.5)]);
    expect(r).toHaveProperty('status');
    expect(r).toHaveProperty('sortedEquities');
    expect(r).toHaveProperty('percentiles');
    expect(r).toHaveProperty('bucketHistogram');
    expect(r).toHaveProperty('bucketEdges');
    expect(r).toHaveProperty('totalWeight');
    expect(r).toHaveProperty('weightedMean');
    expect(r).toHaveProperty('combosTotal');
  });

  it('always returns the same field set (status: empty)', () => {
    const r = computeEquityDistributionCurve([]);
    expect(r).toHaveProperty('status');
    expect(r).toHaveProperty('sortedEquities');
    expect(r).toHaveProperty('percentiles');
    expect(r).toHaveProperty('bucketHistogram');
    expect(r).toHaveProperty('bucketEdges');
    expect(r).toHaveProperty('totalWeight');
    expect(r).toHaveProperty('weightedMean');
    expect(r).toHaveProperty('combosTotal');
  });

  it('is deterministic — same input produces same output', () => {
    const input = [mk(0.3, 0.4), mk(0.5, 0.6), mk(0.2, 0.8)];
    const a = computeEquityDistributionCurve(input);
    const b = computeEquityDistributionCurve(input);
    expect(a).toEqual(b);
  });

  it('does not mutate the input array', () => {
    const input = [mk(0.3, 0.4), mk(0.5, 0.6), mk(0.2, 0.8)];
    const snapshot = JSON.parse(JSON.stringify(input));
    computeEquityDistributionCurve(input);
    expect(input).toEqual(snapshot);
  });
});
