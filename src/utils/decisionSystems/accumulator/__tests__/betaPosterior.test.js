import { describe, it, expect } from 'vitest';
import {
  Z_95,
  applyEvent,
  mean,
  variance,
  standardDeviation,
  credibleInterval,
} from '../betaPosterior';

describe('betaPosterior', () => {
  describe('Z_95', () => {
    it('is the IEEE-754 nearest representable of Φ⁻¹(0.975)', () => {
      expect(Z_95).toBe(1.959963984540054);
    });

    it('is NOT 1.96 (drift-detection canary)', () => {
      expect(Z_95).not.toBe(1.96);
    });
  });

  describe('applyEvent', () => {
    it('increments alpha on success (boolean true)', () => {
      const next = applyEvent({ prior: { alpha: 1, beta: 1 }, outcome: true });
      expect(next).toEqual({ alpha: 2, beta: 1 });
    });

    it('increments alpha on success (string)', () => {
      const next = applyEvent({ prior: { alpha: 1, beta: 1 }, outcome: 'success' });
      expect(next).toEqual({ alpha: 2, beta: 1 });
    });

    it('increments beta on failure (boolean false)', () => {
      const next = applyEvent({ prior: { alpha: 1, beta: 1 }, outcome: false });
      expect(next).toEqual({ alpha: 1, beta: 2 });
    });

    it('increments beta on failure (string)', () => {
      const next = applyEvent({ prior: { alpha: 1, beta: 1 }, outcome: 'failure' });
      expect(next).toEqual({ alpha: 1, beta: 2 });
    });

    it('respects custom weight', () => {
      const next = applyEvent({ prior: { alpha: 1, beta: 1 }, outcome: true, weight: 0.5 });
      expect(next).toEqual({ alpha: 1.5, beta: 1 });
    });

    it('clamps weight > 1 down to 1', () => {
      const next = applyEvent({ prior: { alpha: 1, beta: 1 }, outcome: true, weight: 5 });
      expect(next).toEqual({ alpha: 2, beta: 1 });
    });

    it('clamps weight < 0 up to 0', () => {
      const next = applyEvent({ prior: { alpha: 1, beta: 1 }, outcome: true, weight: -1 });
      expect(next).toEqual({ alpha: 1, beta: 1 });
    });

    it('treats non-finite weight as 1', () => {
      const next = applyEvent({ prior: { alpha: 1, beta: 1 }, outcome: true, weight: NaN });
      expect(next).toEqual({ alpha: 2, beta: 1 });
    });

    it('throws on missing prior', () => {
      expect(() => applyEvent({ outcome: true })).toThrow(TypeError);
    });

    it('throws on malformed prior', () => {
      expect(() => applyEvent({ prior: { alpha: 'x' }, outcome: true })).toThrow(TypeError);
    });
  });

  describe('mean / variance / standardDeviation', () => {
    it('mean = alpha / (alpha + beta)', () => {
      expect(mean({ alpha: 3, beta: 7 })).toBeCloseTo(0.3);
    });

    it('mean of empty Beta is 0', () => {
      expect(mean({ alpha: 0, beta: 0 })).toBe(0);
    });

    it('variance matches Beta closed form', () => {
      // Beta(2, 8): var = 2*8 / (10^2 * 11) = 16/1100 ≈ 0.01454545...
      expect(variance({ alpha: 2, beta: 8 })).toBeCloseTo(16 / 1100);
    });

    it('variance of empty Beta is 0', () => {
      expect(variance({ alpha: 0, beta: 0 })).toBe(0);
    });

    it('standardDeviation = sqrt(variance)', () => {
      const sd = standardDeviation({ alpha: 2, beta: 8 });
      expect(sd).toBeCloseTo(Math.sqrt(16 / 1100));
    });
  });

  describe('credibleInterval', () => {
    it('returns {lower, upper, level} object shape', () => {
      const ci = credibleInterval({ alpha: 5, beta: 5 });
      expect(ci).toHaveProperty('lower');
      expect(ci).toHaveProperty('upper');
      expect(ci.level).toBe(0.95);
    });

    it('is symmetric around 0.5 for symmetric Beta', () => {
      const ci = credibleInterval({ alpha: 50, beta: 50 });
      expect(ci.lower + ci.upper).toBeCloseTo(1, 5);
    });

    it('uses Z_95 (not 1.96) for level=0.95', () => {
      // Variance of Beta(50, 50): 50*50 / (100^2 * 101) = 2500/1_010_000 ≈ 0.00247524
      // sd ≈ 0.04975; mean = 0.5; lower = 0.5 - Z_95 * 0.04975
      const shape = { alpha: 50, beta: 50 };
      const ci = credibleInterval(shape);
      const expectedLower = 0.5 - Z_95 * Math.sqrt(variance(shape));
      expect(ci.lower).toBeCloseTo(expectedLower, 10);
    });

    it('clamps lower to 0', () => {
      const ci = credibleInterval({ alpha: 1, beta: 100 });
      expect(ci.lower).toBeGreaterThanOrEqual(0);
    });

    it('clamps upper to 1', () => {
      const ci = credibleInterval({ alpha: 100, beta: 1 });
      expect(ci.upper).toBeLessThanOrEqual(1);
    });

    it('returns trivial interval for empty Beta', () => {
      const ci = credibleInterval({ alpha: 0, beta: 0 });
      expect(ci).toEqual({ lower: 0, upper: 1, level: 0.95 });
    });

    it('respects custom level (0.99)', () => {
      const shape = { alpha: 50, beta: 50 };
      const ci95 = credibleInterval(shape, 0.95);
      const ci99 = credibleInterval(shape, 0.99);
      // Higher level → wider interval
      expect(ci99.upper - ci99.lower).toBeGreaterThan(ci95.upper - ci95.lower);
      expect(ci99.level).toBe(0.99);
    });

    it('falls back to Z_95 for unknown level', () => {
      const shape = { alpha: 50, beta: 50 };
      const ciKnown = credibleInterval(shape, 0.95);
      const ciUnknown = credibleInterval(shape, 0.87); // not in lookup table
      // Width should match Z_95-derived width
      expect(ciUnknown.upper - ciUnknown.lower).toBeCloseTo(ciKnown.upper - ciKnown.lower, 10);
    });
  });
});
