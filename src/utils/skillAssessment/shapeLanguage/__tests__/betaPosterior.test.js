/**
 * betaPosterior.test.js — Beta math invariants.
 *
 * SLS Stream D — SPR-081 / WS-040. Tests I-SM-7 posterior bounds across
 * 1000 random sequences + boundary conditions.
 */

import { describe, it, expect } from 'vitest';
import {
  POSTERIOR_FLOOR,
  updateBetaPosterior,
  betaCredibleInterval,
  betaMean,
} from '../betaPosterior';

describe('updateBetaPosterior', () => {
  it('starts from uniform Beta(1,1) when called on charter defaults', () => {
    const next = updateBetaPosterior({ alpha: 1, beta: 1 }, { successes: 5, failures: 3 });
    expect(next).toEqual({ alpha: 6, beta: 4 });
  });

  it('treats missing observation fields as zero', () => {
    const next = updateBetaPosterior({ alpha: 5, beta: 5 }, {});
    expect(next).toEqual({ alpha: 5, beta: 5 });
  });

  it('handles missing observation argument entirely', () => {
    const next = updateBetaPosterior({ alpha: 3, beta: 7 });
    expect(next).toEqual({ alpha: 3, beta: 7 });
  });

  it('returns floor for null/undefined posterior', () => {
    expect(updateBetaPosterior(null, { successes: 5 })).toEqual({
      alpha: POSTERIOR_FLOOR,
      beta: POSTERIOR_FLOOR,
    });
    expect(updateBetaPosterior(undefined, { successes: 5 })).toEqual({
      alpha: POSTERIOR_FLOOR,
      beta: POSTERIOR_FLOOR,
    });
  });

  it('clamps below the I-SM-7 floor — α never <1', () => {
    const next = updateBetaPosterior({ alpha: 1, beta: 1 }, {
      successes: -100,
      failures: -100,
    });
    expect(next.alpha).toBeGreaterThanOrEqual(POSTERIOR_FLOOR);
    expect(next.beta).toBeGreaterThanOrEqual(POSTERIOR_FLOOR);
  });

  it('I-SM-7: across 1000 random valid observation sequences, α≥1 and β≥1 hold', () => {
    for (let i = 0; i < 1000; i++) {
      const successes = Math.floor(Math.random() * 100);
      const failures = Math.floor(Math.random() * 100);
      const next = updateBetaPosterior({ alpha: 1, beta: 1 }, { successes, failures });
      expect(next.alpha).toBeGreaterThanOrEqual(POSTERIOR_FLOOR);
      expect(next.beta).toBeGreaterThanOrEqual(POSTERIOR_FLOOR);
    }
  });
});

describe('betaCredibleInterval', () => {
  it('returns {lower, upper, mean, level} shape', () => {
    const ci = betaCredibleInterval(8, 2);
    expect(ci).toHaveProperty('lower');
    expect(ci).toHaveProperty('upper');
    expect(ci).toHaveProperty('mean');
    expect(ci).toHaveProperty('level');
    expect(ci.level).toBe(0.95);
  });

  it('default level is 0.95 — interval contains the mean', () => {
    const ci = betaCredibleInterval(8, 2);
    expect(ci.lower).toBeLessThanOrEqual(ci.mean);
    expect(ci.mean).toBeLessThanOrEqual(ci.upper);
  });

  it('uniform Beta(1,1) has wide CI [~0.025, ~0.975]', () => {
    const ci = betaCredibleInterval(1, 1);
    expect(ci.lower).toBeLessThan(0.1);
    expect(ci.upper).toBeGreaterThan(0.9);
    expect(ci.mean).toBeCloseTo(0.5, 5);
  });

  it('higher α/β → narrower CI', () => {
    const wideCI = betaCredibleInterval(2, 2);
    const narrowCI = betaCredibleInterval(50, 50);
    const wideWidth = wideCI.upper - wideCI.lower;
    const narrowWidth = narrowCI.upper - narrowCI.lower;
    expect(narrowWidth).toBeLessThan(wideWidth);
  });

  it('clamps inputs below floor', () => {
    const ci = betaCredibleInterval(0, 0);
    expect(ci.mean).toBeCloseTo(0.5, 5);
  });

  it('accepts a custom level', () => {
    const ci80 = betaCredibleInterval(10, 10, 0.8);
    expect(ci80.level).toBe(0.8);
    const ci95 = betaCredibleInterval(10, 10, 0.95);
    expect(ci80.upper - ci80.lower).toBeLessThan(ci95.upper - ci95.lower);
  });
});

describe('betaMean', () => {
  it('returns α / (α+β)', () => {
    expect(betaMean(8, 2)).toBeCloseTo(0.8, 5);
    expect(betaMean(1, 1)).toBeCloseTo(0.5, 5);
    expect(betaMean(3, 7)).toBeCloseTo(0.3, 5);
  });

  it('clamps below floor', () => {
    expect(betaMean(0, 0)).toBeCloseTo(0.5, 5);
    expect(betaMean(-1, -1)).toBeCloseTo(0.5, 5);
  });
});
