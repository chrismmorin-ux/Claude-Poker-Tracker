/**
 * percentGroup.test.js — unit tests for the sum-preserving partition formatter.
 *
 * WS-185 / SPR-083.
 */

import { describe, it, expect } from 'vitest';
import { formatPercentGroup, percentGroupNumbers } from '../percentGroup';

const sumStringPcts = (arr) => arr.reduce((s, v) => s + parseFloat(v), 0);
const sumNumPcts = (arr) => arr.reduce((s, v) => s + v, 0);

describe('formatPercentGroup — basic shape', () => {
  it('returns the same length as input', () => {
    expect(formatPercentGroup([1, 2, 3])).toHaveLength(3);
    expect(formatPercentGroup([1, 2, 3, 4, 5])).toHaveLength(5);
  });

  it('returns empty array for empty input', () => {
    expect(formatPercentGroup([])).toEqual([]);
  });

  it('returns "100" for a single positive value (decimals=0)', () => {
    expect(formatPercentGroup([42])).toEqual(['100']);
  });

  it('returns "100.0" for a single positive value (decimals=1)', () => {
    expect(formatPercentGroup([42], 1)).toEqual(['100.0']);
  });

  it('returns numeric form via percentGroupNumbers', () => {
    expect(percentGroupNumbers([1, 1])).toEqual([50, 50]);
  });
});

describe('formatPercentGroup — sum-to-100 invariant', () => {
  it('always sums to exactly 100 (decimals=0)', () => {
    const cases = [
      [1, 1, 1], // 33.33 each → 34 / 33 / 33
      [1, 2, 3],
      [0.001, 0.002, 0.003],
      [50, 25, 25],
      [10, 20, 30, 40],
      [1, 1, 1, 1, 1, 1, 1], // 7 equal — 14.28 each
      [100, 0, 0],
      [0, 100, 0],
    ];
    for (const values of cases) {
      const result = formatPercentGroup(values);
      expect(sumStringPcts(result)).toBe(100);
    }
  });

  it('always sums to exactly 100 (decimals=1)', () => {
    const cases = [
      [1, 1, 1], // 33.3% × 3 = 99.9 raw; largest-remainder bumps one to 33.4
      [1, 2, 3],
      [333, 334, 333], // close to 33.3/33.4/33.3 already
      [0.1, 0.2, 0.7],
      [3, 5, 7, 9, 11, 13, 17, 19, 23, 29], // 10 elements
    ];
    for (const values of cases) {
      const result = formatPercentGroup(values, 1);
      expect(sumStringPcts(result)).toBeCloseTo(100, 9);
    }
  });

  it('always sums to exactly 100 (decimals=2)', () => {
    const cases = [
      [1, 1, 1, 1, 1, 1, 1], // 14.2857 × 7 = 99.9999
      [1, 2, 3, 4, 5],
      [0.1, 0.2, 0.7, 1.1, 2.3, 5.8],
    ];
    for (const values of cases) {
      const result = formatPercentGroup(values, 2);
      expect(sumStringPcts(result)).toBeCloseTo(100, 9);
    }
  });

  it('worked example from the WS-185 bug report: 1/3 × 3 sums to 100% (not 100.1)', () => {
    // The classic display bug: 33.4 + 33.4 + 33.3 = 100.1 with naive rounding.
    // Largest-remainder gives 33.4 + 33.3 + 33.3 = 100.0 (or any rotation).
    //
    // Use toBeCloseTo for parseFloat-roundtrip sums — '33.4' + '33.3' + '33.3'
    // sums to 99.99999999999999 in JS float math, but the displayed strings
    // are clean. percentGroupNumbers() returns clean integer-scaled values
    // (asserted separately).
    const result = formatPercentGroup([1, 1, 1], 1);
    expect(sumStringPcts(result)).toBeCloseTo(100, 9);
    expect(result).toEqual(['33.4', '33.3', '33.3']);
    // Numeric form has no float roundtrip — strict equality holds.
    expect(sumNumPcts(percentGroupNumbers([1, 1, 1], 1))).toBeCloseTo(100, 9);
  });

  it('5-way uniform partition sums to 100% (decimals=1)', () => {
    // Each = 20.0, no rounding needed; sums clean.
    const result = formatPercentGroup([1, 1, 1, 1, 1], 1);
    expect(result).toEqual(['20.0', '20.0', '20.0', '20.0', '20.0']);
  });

  it('zero-mass inputs in a mixed array do not break the sum', () => {
    const result = formatPercentGroup([1, 0, 2, 0, 3], 1);
    expect(sumStringPcts(result)).toBe(100);
    expect(result[1]).toBe('0.0');
    expect(result[3]).toBe('0.0');
  });
});

describe('formatPercentGroup — all-zero input', () => {
  it('returns array of "0" strings (decimals=0)', () => {
    expect(formatPercentGroup([0, 0, 0])).toEqual(['0', '0', '0']);
  });

  it('returns array of "0.0" strings (decimals=1)', () => {
    expect(formatPercentGroup([0, 0, 0], 1)).toEqual(['0.0', '0.0', '0.0']);
  });

  it('returns array of zero numbers via percentGroupNumbers', () => {
    expect(percentGroupNumbers([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe('formatPercentGroup — tie-breaking', () => {
  it('breaks ties deterministically by lower index first', () => {
    // 3 equal values → 33.33 each → all have the same remainder.
    // Largest-remainder protocol: ties go to lower-index first.
    const result = formatPercentGroup([1, 1, 1], 1);
    // 33.3 + 33.3 + 33.3 = 99.9, missing 0.1. Lowest index gets the bump.
    expect(result[0]).toBe('33.4');
    expect(result[1]).toBe('33.3');
    expect(result[2]).toBe('33.3');
  });

  it('is stable across re-runs (deterministic)', () => {
    const a = formatPercentGroup([7, 11, 13], 1);
    const b = formatPercentGroup([7, 11, 13], 1);
    expect(a).toEqual(b);
  });
});

describe('formatPercentGroup — random fuzz', () => {
  it('100 random partitions all sum to 100 at decimals=1', () => {
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let trial = 0; trial < 100; trial++) {
      const n = 2 + Math.floor(rand() * 7); // 2..8 elements
      const values = Array.from({ length: n }, () => rand());
      const result = formatPercentGroup(values, 1);
      expect(sumStringPcts(result)).toBeCloseTo(100, 9);
    }
  });

  it('100 random partitions all sum to 100 via percentGroupNumbers (decimals=0)', () => {
    let seed = 54321;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let trial = 0; trial < 100; trial++) {
      const n = 2 + Math.floor(rand() * 7);
      const values = Array.from({ length: n }, () => rand());
      const result = percentGroupNumbers(values);
      expect(sumNumPcts(result)).toBe(100);
    }
  });
});

describe('formatPercentGroup — input validation', () => {
  it('throws on non-array input', () => {
    expect(() => formatPercentGroup(null)).toThrow(TypeError);
    expect(() => formatPercentGroup(undefined)).toThrow(TypeError);
    expect(() => formatPercentGroup('1,2,3')).toThrow(TypeError);
    expect(() => formatPercentGroup({})).toThrow(TypeError);
  });

  it('throws on NaN values', () => {
    expect(() => formatPercentGroup([1, NaN, 2])).toThrow(TypeError);
  });

  it('throws on Infinity values', () => {
    expect(() => formatPercentGroup([1, Infinity, 2])).toThrow(TypeError);
  });

  it('throws on negative values', () => {
    expect(() => formatPercentGroup([1, -2, 3])).toThrow(TypeError);
  });

  it('throws on non-number values', () => {
    expect(() => formatPercentGroup([1, '2', 3])).toThrow(TypeError);
    expect(() => formatPercentGroup([1, null, 3])).toThrow(TypeError);
  });

  it('throws on negative decimals', () => {
    expect(() => formatPercentGroup([1, 2], -1)).toThrow(RangeError);
  });

  it('throws on non-integer decimals', () => {
    expect(() => formatPercentGroup([1, 2], 1.5)).toThrow(RangeError);
  });
});

describe('formatPercentGroup — first-principles guardrail', () => {
  it('returned values are non-decreasing-monotone-in-input — larger input → ≥ output', () => {
    // If input[i] > input[j], then result[i] >= result[j]. The formatter
    // must not invert the order of values (a load-bearing property for
    // partition-display correctness).
    const values = [10, 30, 50, 5, 20];
    const result = percentGroupNumbers(values, 1);
    // Sort original by value desc, check result follows the same order.
    const sorted = values
      .map((v, i) => ({ v, i }))
      .sort((a, b) => b.v - a.v);
    for (let k = 1; k < sorted.length; k++) {
      expect(result[sorted[k - 1].i]).toBeGreaterThanOrEqual(result[sorted[k].i]);
    }
  });
});
