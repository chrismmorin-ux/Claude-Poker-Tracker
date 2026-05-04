/**
 * @file Tests for computeStability.js — Bayesian-Beta posterior banding.
 * Per WS-160 / SPR-034 (PIO Gate 5 child A).
 */

import { describe, it, expect } from 'vitest';
import { computeStability } from '../computeStability.js';

const sighting = (capturedAt, attributes) => ({ capturedAt, attributes });

describe('computeStability — preconditions', () => {
  it('throws on non-array sightings', () => {
    expect(() => computeStability(null, 'ageDecade')).toThrow(/Array sightings/);
  });

  it('throws on non-string attribute', () => {
    expect(() => computeStability([], 123)).toThrow(/string attribute/);
  });
});

describe('computeStability — cold start (no sightings)', () => {
  it('empty sightings → uniform prior posterior + max MoE', () => {
    const result = computeStability([], 'ageDecade');
    expect(result.posterior).toBeCloseTo(0.5);
    expect(result.confidence).toBe('sometimes'); // 0.5 sits in [0.4, 0.85)
    expect(result.moe).toBe(1.0);
    expect(result.sampleSize).toBe(0);
  });

  it('sightings with no attribute observations → uniform prior posterior', () => {
    const result = computeStability(
      [sighting(1, {}), sighting(2, { wardrobe: ['hoodie'] })],
      'ageDecade',
    );
    expect(result.posterior).toBeCloseTo(0.5);
    expect(result.moe).toBe(1.0);
    expect(result.sampleSize).toBe(0);
  });
});

describe('computeStability — single sighting', () => {
  it('one sighting → posterior reflects 1 match (alpha=2, beta=1; mean=2/3)', () => {
    const result = computeStability(
      [sighting(1, { ageDecade: '30s' })],
      'ageDecade',
    );
    expect(result.posterior).toBeCloseTo(2 / 3);
    expect(result.confidence).toBe('sometimes'); // 0.667 in [0.4, 0.85)
    expect(result.sampleSize).toBe(1);
    expect(result.moe).toBeGreaterThan(0);
    expect(result.moe).toBeLessThan(1);
  });
});

describe('computeStability — all-same observations rise to "always"', () => {
  it('many same observations → posterior > 0.85, confidence = always', () => {
    const sightings = Array.from({ length: 20 }).map((_, i) =>
      sighting(i + 1, { ageDecade: '30s' }),
    );
    const result = computeStability(sightings, 'ageDecade');
    expect(result.posterior).toBeGreaterThan(0.85);
    expect(result.confidence).toBe('always');
    expect(result.sampleSize).toBe(20);
    expect(result.moe).toBeLessThan(0.2); // tight CI
  });
});

describe('computeStability — varying observations stay "sometimes"', () => {
  it('half-match, half-vary → posterior near 0.5', () => {
    // Sightings sorted by capturedAt DESC; reference = most-recent.
    const sightings = [
      sighting(4, { wardrobe: ['black-hoodie'] }), // reference
      sighting(3, { wardrobe: ['black-hoodie'] }), // match
      sighting(2, { wardrobe: ['blue-shirt'] }),   // no match
      sighting(1, { wardrobe: ['red-jacket'] }),   // no match
    ];
    const result = computeStability(sightings, 'wardrobe');
    // 2 matches, 2 non-matches. With prior alpha=1, beta=1:
    //   alpha = 1 + 2 = 3; beta = 1 + 2 = 3; posterior = 0.5 → 'sometimes'
    expect(result.posterior).toBeCloseTo(0.5);
    expect(result.confidence).toBe('sometimes');
    expect(result.sampleSize).toBe(4);
  });
});

describe('computeStability — minority match drops to "today-only"', () => {
  it('many varying observations → posterior < 0.4, confidence = today-only', () => {
    const sightings = [
      sighting(10, { wardrobe: ['black-hoodie'] }), // reference (most recent)
      sighting(9, { wardrobe: ['blue'] }),
      sighting(8, { wardrobe: ['red'] }),
      sighting(7, { wardrobe: ['green'] }),
      sighting(6, { wardrobe: ['yellow'] }),
      sighting(5, { wardrobe: ['purple'] }),
      sighting(4, { wardrobe: ['orange'] }),
      sighting(3, { wardrobe: ['white'] }),
      sighting(2, { wardrobe: ['gray'] }),
      sighting(1, { wardrobe: ['brown'] }),
    ];
    const result = computeStability(sightings, 'wardrobe');
    expect(result.posterior).toBeLessThan(0.4);
    expect(result.confidence).toBe('today-only');
  });
});

describe('computeStability — most-recent value defines the reference', () => {
  it('reference is the most-recent sighting attribute, not first-encountered', () => {
    const sightings = [
      sighting(1, { ageDecade: '20s' }),
      sighting(2, { ageDecade: '20s' }),
      sighting(3, { ageDecade: '30s' }), // most-recent → reference
    ];
    const result = computeStability(sightings, 'ageDecade');
    // Reference is '30s' (most recent). One match (the most-recent itself),
    // two non-matches (the two '20s'). With prior alpha=1, beta=1:
    //   alpha = 1 + 1 = 2
    //   beta  = 1 + 2 = 3
    //   posterior = 2/5 = 0.4
    expect(result.posterior).toBeCloseTo(0.4);
  });
});

describe('computeStability — array-valued attributes (wardrobe palette)', () => {
  it('matches arrays via JSON-stringified equality', () => {
    // Need enough matches to clear the 0.85 'always' threshold under uniform prior.
    // 10 matches → alpha = 1 + 10 = 11; beta = 1 + 0 = 1; posterior = 11/12 ≈ 0.917.
    const sightings = Array.from({ length: 10 }).map((_, i) =>
      sighting(i + 1, { wardrobe: ['hat', 'jacket'] }),
    );
    const result = computeStability(sightings, 'wardrobe');
    expect(result.confidence).toBe('always');
  });

  it('treats different array order/content as non-match', () => {
    const sightings = [
      sighting(1, { wardrobe: ['jacket', 'hat'] }), // reference (most recent)
      sighting(2, { wardrobe: ['hat', 'jacket'] }), // different order → no match
    ];
    const result = computeStability(sightings, 'wardrobe');
    // 1 match (reference itself), 1 non-match. alpha=2, beta=2 → posterior=0.5.
    expect(result.posterior).toBeCloseTo(0.5);
  });
});

describe('computeStability — MoE narrows as N grows', () => {
  it('MoE for n=1 > MoE for n=20', () => {
    const small = computeStability([sighting(1, { ageDecade: '30s' })], 'ageDecade');
    const large = computeStability(
      Array.from({ length: 20 }).map((_, i) => sighting(i, { ageDecade: '30s' })),
      'ageDecade',
    );
    expect(large.moe).toBeLessThan(small.moe);
  });
});
