import { describe, it, expect } from 'vitest';
import { safeDiv, clamp, sigmoid, scaledLogistic, stableSoftmax } from '../mathUtils';

describe('safeDiv', () => {
  it('divides normally when denominator is non-zero', () => {
    expect(safeDiv(10, 2)).toBe(5);
    expect(safeDiv(1, 3)).toBeCloseTo(0.333, 2);
  });

  it('returns fallback when denominator is zero', () => {
    expect(safeDiv(10, 0)).toBe(0);
    expect(safeDiv(10, 0, 0.5)).toBe(0.5);
  });

  it('returns fallback when denominator is NaN', () => {
    expect(safeDiv(10, NaN)).toBe(0);
    expect(safeDiv(10, NaN, -1)).toBe(-1);
  });

  it('returns fallback when denominator is Infinity', () => {
    expect(safeDiv(10, Infinity)).toBe(0);
    expect(safeDiv(10, -Infinity, 0.5)).toBe(0.5);
  });

  it('returns fallback when result is NaN (0/0 case caught by denom check)', () => {
    expect(safeDiv(0, 0)).toBe(0);
  });

  it('handles NaN numerator (returns NaN — caller responsibility)', () => {
    // When numerator is NaN but denominator is valid, result is NaN → fallback
    expect(safeDiv(NaN, 1)).toBe(0);
  });

  it('handles negative values correctly', () => {
    expect(safeDiv(-10, 2)).toBe(-5);
    expect(safeDiv(10, -2)).toBe(-5);
  });

  it('uses default fallback of 0', () => {
    expect(safeDiv(5, 0)).toBe(0);
  });
});

describe('clamp', () => {
  it('clamps within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('sigmoid', () => {
  it('returns 0.5 at x=0', () => {
    expect(sigmoid(0)).toBe(0.5);
  });

  it('approaches 1 for large positive x', () => {
    expect(sigmoid(10)).toBeGreaterThan(0.99);
  });

  it('approaches 0 for large negative x', () => {
    expect(sigmoid(-10)).toBeLessThan(0.01);
  });
});

describe('scaledLogistic', () => {
  it('returns value in [floor, floor+scale] range', () => {
    const result = scaledLogistic(1.0, 5);
    expect(result).toBeGreaterThanOrEqual(0.10);
    expect(result).toBeLessThanOrEqual(0.80);
  });
});

describe('stableSoftmax', () => {
  it('produces weights that sum to ~1.0', () => {
    const weights = stableSoftmax([10, 8, 6], 2);
    expect(weights).not.toBeNull();
    const sum = weights.reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1.0, 1);
    weights.forEach(w => expect(w).toBeGreaterThan(0));
  });

  it('produces uniform weights for equal values', () => {
    const weights = stableSoftmax([5, 5, 5], 1);
    expect(weights).not.toBeNull();
    weights.forEach(w => expect(w).toBeCloseTo(0.33, 1));
  });

  it('handles large values without overflow (log-sum-exp trick)', () => {
    const weights = stableSoftmax([1000, 999], 0.1);
    expect(weights).not.toBeNull();
    weights.forEach(w => {
      expect(Number.isFinite(w)).toBe(true);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
    });
    expect(weights.reduce((s, w) => s + w, 0)).toBeCloseTo(1.0, 1);
  });

  it('handles large negative spread without underflow', () => {
    const weights = stableSoftmax([-1000, 0], 0.1);
    expect(weights).not.toBeNull();
    weights.forEach(w => expect(Number.isFinite(w)).toBe(true));
  });

  it('returns [1.0] for single element', () => {
    const weights = stableSoftmax([5], 1);
    expect(weights).toEqual([1]);
  });

  it('returns null for empty array', () => {
    expect(stableSoftmax([], 1)).toBeNull();
  });

  it('returns null for null input', () => {
    expect(stableSoftmax(null, 1)).toBeNull();
  });

  it('returns null for zero temperature', () => {
    expect(stableSoftmax([1, 2], 0)).toBeNull();
  });

  it('returns null when values contain non-finite numbers', () => {
    expect(stableSoftmax([Infinity, 1], 1)).toBeNull();
    expect(stableSoftmax([NaN, 1], 1)).toBeNull();
  });

  it('highest value gets highest weight', () => {
    const weights = stableSoftmax([10, 5, 1], 2);
    expect(weights[0]).toBeGreaterThan(weights[1]);
    expect(weights[1]).toBeGreaterThan(weights[2]);
  });
});
