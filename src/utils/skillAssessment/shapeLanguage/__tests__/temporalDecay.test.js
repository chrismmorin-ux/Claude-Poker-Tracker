/**
 * temporalDecay.test.js — recognition-latency decay model invariants.
 *
 * SLS Stream D — SPR-081 / WS-040.
 *
 * Tests I-SM-2 read-time-only (the function is pure and emits no side
 * effects) + monotonicity + mean preservation + floor enforcement.
 */

import { describe, it, expect } from 'vitest';
import {
  applyTemporalDecay,
  DEFAULT_DECAY_PROFILE,
} from '../temporalDecay';
import { POSTERIOR_FLOOR } from '../betaPosterior';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

describe('applyTemporalDecay — null lastValidatedAt (never validated)', () => {
  it('returns posterior unchanged + daysSinceValidated=null', () => {
    const result = applyTemporalDecay({ alpha: 8, beta: 2 }, null, 1000000);
    expect(result.decayedAlpha).toBe(8);
    expect(result.decayedBeta).toBe(2);
    expect(result.daysSinceValidated).toBeNull();
    expect(result.retainedEvidenceFraction).toBe(1);
  });
});

describe('applyTemporalDecay — half-life at default 90 days', () => {
  it('retained fraction at 0 days = 1 (no decay yet)', () => {
    const now = 1000000;
    const result = applyTemporalDecay({ alpha: 8, beta: 2 }, now, now);
    expect(result.daysSinceValidated).toBe(0);
    expect(result.retainedEvidenceFraction).toBeCloseTo(1, 5);
    expect(result.decayedAlpha).toBeCloseTo(8, 5);
    expect(result.decayedBeta).toBeCloseTo(2, 5);
  });

  it('retained fraction at exactly halfLifeDays = 0.5', () => {
    const now = 0;
    const ago = -DEFAULT_DECAY_PROFILE.halfLifeDays * MS_PER_DAY;
    const result = applyTemporalDecay({ alpha: 11, beta: 1 }, ago, now);
    expect(result.daysSinceValidated).toBeCloseTo(DEFAULT_DECAY_PROFILE.halfLifeDays, 3);
    expect(result.retainedEvidenceFraction).toBeCloseTo(0.5, 5);
    // pseudoEvidence = (11-1) + (1-1) = 10 → decayed to 5 → α=1+5*(10/10)=6, β=1
    expect(result.decayedAlpha).toBeCloseTo(6, 5);
    expect(result.decayedBeta).toBeCloseTo(1, 5);
  });

  it('point estimate regresses toward prior (0.5) as evidence decays', () => {
    const now = 0;
    // 0 half-lives = full posterior (mean 0.8)
    // 2 half-lives = quarter-evidence (mean partway toward 0.5)
    // ∞ half-lives → mean exactly 0.5
    const fresh = applyTemporalDecay({ alpha: 8, beta: 2 }, now, now);
    const twoHalfLives = applyTemporalDecay({ alpha: 8, beta: 2 }, -180 * MS_PER_DAY, now);
    const tenHalfLives = applyTemporalDecay({ alpha: 8, beta: 2 }, -900 * MS_PER_DAY, now);

    const meanOf = (r) => r.decayedAlpha / (r.decayedAlpha + r.decayedBeta);
    const freshMean = meanOf(fresh);
    const midMean = meanOf(twoHalfLives);
    const oldMean = meanOf(tenHalfLives);

    // Fresh: matches original
    expect(freshMean).toBeCloseTo(0.8, 5);
    // Mid-decay: between 0.5 and 0.8
    expect(midMean).toBeLessThan(0.8);
    expect(midMean).toBeGreaterThan(0.5);
    // Heavily decayed: closer to prior than fresh
    expect(Math.abs(oldMean - 0.5)).toBeLessThan(Math.abs(midMean - 0.5));
  });
});

describe('applyTemporalDecay — monotonicity (per CLAUDE.md core principle 3)', () => {
  it('longer gap → smaller retainedEvidenceFraction', () => {
    const now = 0;
    const profile = DEFAULT_DECAY_PROFILE;
    const recent = applyTemporalDecay({ alpha: 10, beta: 5 }, -30 * MS_PER_DAY, now, profile);
    const stale = applyTemporalDecay({ alpha: 10, beta: 5 }, -300 * MS_PER_DAY, now, profile);
    expect(stale.retainedEvidenceFraction).toBeLessThan(recent.retainedEvidenceFraction);
  });

  it('longer gap → wider implied uncertainty (α+β shrinks toward 2)', () => {
    const now = 0;
    const recent = applyTemporalDecay({ alpha: 50, beta: 50 }, -30 * MS_PER_DAY, now);
    const stale = applyTemporalDecay({ alpha: 50, beta: 50 }, -900 * MS_PER_DAY, now);
    const recentMass = recent.decayedAlpha + recent.decayedBeta;
    const staleMass = stale.decayedAlpha + stale.decayedBeta;
    expect(staleMass).toBeLessThan(recentMass);
    expect(staleMass).toBeGreaterThanOrEqual(2 * POSTERIOR_FLOOR);
  });
});

describe('applyTemporalDecay — floor enforcement (I-SM-7)', () => {
  it('decayed α≥1 and β≥1 even at extreme gaps', () => {
    const now = 0;
    const result = applyTemporalDecay({ alpha: 50, beta: 50 }, -10000 * MS_PER_DAY, now);
    expect(result.decayedAlpha).toBeGreaterThanOrEqual(POSTERIOR_FLOOR);
    expect(result.decayedBeta).toBeGreaterThanOrEqual(POSTERIOR_FLOOR);
  });

  it('handles uniform Beta(1,1) — no observed evidence to decay', () => {
    const now = 0;
    const result = applyTemporalDecay({ alpha: 1, beta: 1 }, -100 * MS_PER_DAY, now);
    expect(result.decayedAlpha).toBe(POSTERIOR_FLOOR);
    expect(result.decayedBeta).toBe(POSTERIOR_FLOOR);
  });
});

describe('applyTemporalDecay — clock-skew safety', () => {
  it('lastValidatedAt in the future returns daysSinceValidated=0', () => {
    const now = 1000;
    const result = applyTemporalDecay({ alpha: 8, beta: 2 }, 9999, now);
    expect(result.daysSinceValidated).toBe(0);
    expect(result.retainedEvidenceFraction).toBeCloseTo(1, 5);
  });
});

describe('applyTemporalDecay — custom profile', () => {
  it('shorter half-life decays faster', () => {
    const now = 0;
    const lastValidated = -45 * MS_PER_DAY;
    const slow = applyTemporalDecay({ alpha: 11, beta: 1 }, lastValidated, now, { halfLifeDays: 90 });
    const fast = applyTemporalDecay({ alpha: 11, beta: 1 }, lastValidated, now, { halfLifeDays: 30 });
    expect(fast.retainedEvidenceFraction).toBeLessThan(slow.retainedEvidenceFraction);
  });
});

describe('applyTemporalDecay — input tolerance', () => {
  it('null posterior returns floor', () => {
    const result = applyTemporalDecay(null, 0, 0);
    expect(result.decayedAlpha).toBe(POSTERIOR_FLOOR);
    expect(result.decayedBeta).toBe(POSTERIOR_FLOOR);
  });

  it('posterior missing alpha/beta uses floor', () => {
    const result = applyTemporalDecay({}, 0, 0);
    expect(result.decayedAlpha).toBe(POSTERIOR_FLOOR);
    expect(result.decayedBeta).toBe(POSTERIOR_FLOOR);
  });
});
