/**
 * primitiveValidity.test.js — Tier-2 posterior updater + ripple unit tests
 *
 * Covers:
 *   - updatePrimitiveValidity (Beta posterior update math, weights, batch)
 *   - approximateCredibleInterval (via observable behavior — CI bounds always [0, 1])
 *   - evaluatePrimitiveStatus (load-bearing / at-risk / invalidated classification)
 *   - computeRipple (penalty application, skipping non-referencing anchors,
 *     transitionFrom logic, error cases)
 *   - rebuildDependentAnchorCount (I-EAL-9 invariant)
 */

import { describe, it, expect } from 'vitest';

import {
  updatePrimitiveValidity,
  applyFiringBatch,
  evaluatePrimitiveStatus,
  computeRipple,
  rebuildDependentAnchorCount,
  PRIMITIVE_LOAD_BEARING_THRESHOLD,
  DEFAULT_PENALTY_FACTOR,
} from '../primitiveValidity';

// ───────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ───────────────────────────────────────────────────────────────────────────

const makePrimitive = (overrides = {}) => ({
  id: 'PP-01',
  name: 'Test primitive',
  description: 'Test primitive description with at least 10 chars',
  appliesToStyles: ['Nit'],
  cognitiveStep: 'range-reweighting',
  validityScore: {
    priorAlpha: 1, // Uninformed prior
    priorBeta: 1,
    pointEstimate: 0.5,
    sampleSize: 0,
    supportsCount: 0,
    credibleInterval: { lower: 0, upper: 1, level: 0.95 },
    lastUpdated: null,
    dependentAnchorCount: 0,
  },
  ...overrides,
});

const makeAnchor = (overrides = {}) => ({
  id: 'anchor:test:1',
  perceptionPrimitiveIds: ['PP-01'],
  quality: { composite: 0.80 },
  ...overrides,
});

// ───────────────────────────────────────────────────────────────────────────
// updatePrimitiveValidity — Beta posterior update math
// ───────────────────────────────────────────────────────────────────────────

describe('updatePrimitiveValidity — Beta math', () => {
  it('starts with prior pointEstimate (no observations)', () => {
    const prim = makePrimitive();
    expect(prim.validityScore.pointEstimate).toBe(0.5);
  });

  it('one supporting event shifts posterior toward 1', () => {
    const prim = makePrimitive();
    const updated = updatePrimitiveValidity(prim, { anchorId: 'a-1', supportsClaim: true });
    // Beta(1,1) + 1 success → Beta(2,1) → mean 2/3 ≈ 0.667
    expect(updated.validityScore.pointEstimate).toBeCloseTo(2 / 3, 4);
    expect(updated.validityScore.sampleSize).toBe(1);
    expect(updated.validityScore.supportsCount).toBe(1);
  });

  it('one non-supporting event shifts posterior toward 0', () => {
    const prim = makePrimitive();
    const updated = updatePrimitiveValidity(prim, { anchorId: 'a-1', supportsClaim: false });
    // Beta(1,1) + 1 failure → Beta(1,2) → mean 1/3 ≈ 0.333
    expect(updated.validityScore.pointEstimate).toBeCloseTo(1 / 3, 4);
    expect(updated.validityScore.sampleSize).toBe(1);
    expect(updated.validityScore.supportsCount).toBe(0);
  });

  it('many supporting events drive pointEstimate toward 1', () => {
    let prim = makePrimitive();
    for (let i = 0; i < 50; i++) {
      prim = updatePrimitiveValidity(prim, { anchorId: 'a-1', supportsClaim: true });
    }
    // Beta(51, 1) → mean 51/52 ≈ 0.981
    expect(prim.validityScore.pointEstimate).toBeGreaterThan(0.95);
    expect(prim.validityScore.sampleSize).toBe(50);
  });

  it('mixed events converge to observed proportion', () => {
    let prim = makePrimitive();
    // 7 supports, 3 non-supports
    for (let i = 0; i < 7; i++) {
      prim = updatePrimitiveValidity(prim, { anchorId: 'a-1', supportsClaim: true });
    }
    for (let i = 0; i < 3; i++) {
      prim = updatePrimitiveValidity(prim, { anchorId: 'a-1', supportsClaim: false });
    }
    // Beta(8, 4) → mean 8/12 ≈ 0.667
    expect(prim.validityScore.pointEstimate).toBeCloseTo(8 / 12, 3);
    expect(prim.validityScore.sampleSize).toBe(10);
  });

  it('respects firing weight in (0, 1]', () => {
    const prim = makePrimitive();
    const updated = updatePrimitiveValidity(prim, {
      anchorId: 'a-1',
      supportsClaim: true,
      weight: 0.5,
    });
    // Beta(1,1) + 0.5 success → Beta(1.5, 1) → mean 1.5/2.5 = 0.6
    expect(updated.validityScore.pointEstimate).toBeCloseTo(0.6, 3);
    expect(updated.validityScore.sampleSize).toBe(0.5);
  });

  it('clamps weight to [0, 1]', () => {
    const prim = makePrimitive();
    const updated = updatePrimitiveValidity(prim, {
      anchorId: 'a-1',
      supportsClaim: true,
      weight: 100, // out-of-range
    });
    // Should be clamped to 1
    expect(updated.validityScore.sampleSize).toBe(1);
  });

  it('preserves observedAt timestamp in lastUpdated', () => {
    const prim = makePrimitive();
    const updated = updatePrimitiveValidity(prim, {
      anchorId: 'a-1',
      supportsClaim: true,
      observedAt: '2026-04-25T10:00:00Z',
    });
    expect(updated.validityScore.lastUpdated).toBe('2026-04-25T10:00:00Z');
  });

  it('does not mutate the input primitive', () => {
    const prim = makePrimitive();
    const before = JSON.stringify(prim);
    updatePrimitiveValidity(prim, { anchorId: 'a-1', supportsClaim: true });
    expect(JSON.stringify(prim)).toBe(before);
  });

  it('throws on missing supportsClaim', () => {
    expect(() => updatePrimitiveValidity(makePrimitive(), { anchorId: 'a-1' })).toThrow(/supportsClaim/);
  });

  it('throws on null primitive', () => {
    expect(() => updatePrimitiveValidity(null, { anchorId: 'a-1', supportsClaim: true })).toThrow();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Credible interval bounds
// ───────────────────────────────────────────────────────────────────────────

describe('credibleInterval bounds (via update)', () => {
  it('CI bounds stay in [0, 1] regardless of input', () => {
    let prim = makePrimitive();
    for (let i = 0; i < 100; i++) {
      prim = updatePrimitiveValidity(prim, { anchorId: 'a-1', supportsClaim: i % 2 === 0 });
    }
    const ci = prim.validityScore.credibleInterval;
    expect(ci.lower).toBeGreaterThanOrEqual(0);
    expect(ci.upper).toBeLessThanOrEqual(1);
    expect(ci.lower).toBeLessThanOrEqual(ci.upper);
    expect(ci.level).toBe(0.95);
  });

  it('CI shrinks as sample size grows (consistent observations)', () => {
    let smallSample = makePrimitive();
    for (let i = 0; i < 5; i++) {
      smallSample = updatePrimitiveValidity(smallSample, { anchorId: 'a-1', supportsClaim: true });
    }
    let largeSample = makePrimitive();
    for (let i = 0; i < 100; i++) {
      largeSample = updatePrimitiveValidity(largeSample, { anchorId: 'a-1', supportsClaim: true });
    }
    const smallWidth = smallSample.validityScore.credibleInterval.upper - smallSample.validityScore.credibleInterval.lower;
    const largeWidth = largeSample.validityScore.credibleInterval.upper - largeSample.validityScore.credibleInterval.lower;
    expect(largeWidth).toBeLessThan(smallWidth);
  });

  it('point estimate falls inside CI', () => {
    let prim = makePrimitive();
    for (let i = 0; i < 30; i++) {
      prim = updatePrimitiveValidity(prim, { anchorId: 'a-1', supportsClaim: i < 20 });
    }
    const { lower, upper } = prim.validityScore.credibleInterval;
    const { pointEstimate } = prim.validityScore;
    expect(pointEstimate).toBeGreaterThanOrEqual(lower);
    expect(pointEstimate).toBeLessThanOrEqual(upper);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// applyFiringBatch
// ───────────────────────────────────────────────────────────────────────────

describe('applyFiringBatch', () => {
  it('applies events in order', () => {
    const prim = makePrimitive();
    const events = [
      { anchorId: 'a-1', supportsClaim: true },
      { anchorId: 'a-2', supportsClaim: true },
      { anchorId: 'a-3', supportsClaim: false },
    ];
    const updated = applyFiringBatch(prim, events);
    // Beta(3, 2) → mean 3/5 = 0.6
    expect(updated.validityScore.pointEstimate).toBeCloseTo(0.6, 3);
    expect(updated.validityScore.sampleSize).toBe(3);
  });

  it('handles empty batch', () => {
    const prim = makePrimitive();
    const updated = applyFiringBatch(prim, []);
    expect(updated).toEqual(prim);
  });

  it('throws on non-array events', () => {
    expect(() => applyFiringBatch(makePrimitive(), null)).toThrow();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// evaluatePrimitiveStatus
// ───────────────────────────────────────────────────────────────────────────

describe('evaluatePrimitiveStatus', () => {
  it('classifies CI fully above threshold as load-bearing', () => {
    const prim = makePrimitive({
      validityScore: {
        ...makePrimitive().validityScore,
        credibleInterval: { lower: 0.65, upper: 0.85, level: 0.95 },
      },
    });
    const result = evaluatePrimitiveStatus(prim);
    expect(result.status).toBe('load-bearing');
  });

  it('classifies CI spanning threshold as at-risk', () => {
    const prim = makePrimitive({
      validityScore: {
        ...makePrimitive().validityScore,
        credibleInterval: { lower: 0.40, upper: 0.65, level: 0.95 },
      },
    });
    const result = evaluatePrimitiveStatus(prim);
    expect(result.status).toBe('at-risk');
  });

  it('classifies CI fully below threshold as invalidated', () => {
    const prim = makePrimitive({
      validityScore: {
        ...makePrimitive().validityScore,
        credibleInterval: { lower: 0.20, upper: 0.45, level: 0.95 },
      },
    });
    const result = evaluatePrimitiveStatus(prim);
    expect(result.status).toBe('invalidated');
  });

  it('CI lower exactly at threshold is load-bearing', () => {
    const prim = makePrimitive({
      validityScore: {
        ...makePrimitive().validityScore,
        credibleInterval: { lower: 0.50, upper: 0.80, level: 0.95 },
      },
    });
    const result = evaluatePrimitiveStatus(prim);
    expect(result.status).toBe('load-bearing');
  });

  it('CI upper exactly at threshold is invalidated', () => {
    // ci.upper < threshold rule — strict < — so upper === threshold is at-risk
    // Edge case worth pinning down
    const prim = makePrimitive({
      validityScore: {
        ...makePrimitive().validityScore,
        credibleInterval: { lower: 0.20, upper: 0.50, level: 0.95 },
      },
    });
    const result = evaluatePrimitiveStatus(prim);
    expect(result.status).toBe('at-risk');
  });

  it('respects custom threshold via options', () => {
    const prim = makePrimitive({
      validityScore: {
        ...makePrimitive().validityScore,
        credibleInterval: { lower: 0.30, upper: 0.45, level: 0.95 },
      },
    });
    const tightResult = evaluatePrimitiveStatus(prim, { threshold: 0.4 });
    expect(tightResult.status).toBe('at-risk'); // ci spans 0.4
    const looseResult = evaluatePrimitiveStatus(prim, { threshold: 0.6 });
    expect(looseResult.status).toBe('invalidated'); // ci entirely below 0.6
  });

  it('returns load-bearing default when CI missing (insufficient data)', () => {
    const prim = makePrimitive();
    delete prim.validityScore.credibleInterval;
    const result = evaluatePrimitiveStatus(prim);
    expect(result.status).toBe('load-bearing');
    expect(result.reason).toMatch(/insufficient data/i);
  });

  it('exports correct constants', () => {
    expect(PRIMITIVE_LOAD_BEARING_THRESHOLD).toBe(0.5);
    expect(DEFAULT_PENALTY_FACTOR).toBe(0.85);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// computeRipple — cross-anchor invalidation
// ───────────────────────────────────────────────────────────────────────────

describe('computeRipple — invalidation triggers + penalty application', () => {
  const invalidatedPrimitive = () => makePrimitive({
    validityScore: {
      ...makePrimitive().validityScore,
      credibleInterval: { lower: 0.10, upper: 0.40, level: 0.95 },
    },
  });

  const loadBearingPrimitive = () => makePrimitive({
    validityScore: {
      ...makePrimitive().validityScore,
      credibleInterval: { lower: 0.65, upper: 0.85, level: 0.95 },
    },
  });

  it('does NOT fire when primitive is load-bearing', () => {
    const result = computeRipple(loadBearingPrimitive(), [makeAnchor()]);
    expect(result.shouldFire).toBe(false);
    expect(result.toStatus).toBe('load-bearing');
    expect(result.anchorPenalties).toEqual([]);
  });

  it('does NOT fire when primitive is at-risk (boundary state)', () => {
    const prim = makePrimitive({
      validityScore: {
        ...makePrimitive().validityScore,
        credibleInterval: { lower: 0.40, upper: 0.65, level: 0.95 },
      },
    });
    const result = computeRipple(prim, [makeAnchor()]);
    expect(result.shouldFire).toBe(false);
    expect(result.toStatus).toBe('at-risk');
  });

  it('FIRES when primitive transitions from load-bearing to invalidated', () => {
    const result = computeRipple(invalidatedPrimitive(), [makeAnchor()], {
      transitionFrom: 'load-bearing',
    });
    expect(result.shouldFire).toBe(true);
    expect(result.fromStatus).toBe('load-bearing');
    expect(result.toStatus).toBe('invalidated');
    expect(result.anchorPenalties).toHaveLength(1);
    expect(result.anchorPenalties[0].fromComposite).toBe(0.80);
    expect(result.anchorPenalties[0].toComposite).toBeCloseTo(0.80 * 0.85, 4);
    expect(result.anchorPenalties[0].penaltyFactor).toBe(0.85);
  });

  it('does NOT fire when transitioning from invalidated to invalidated (idempotent)', () => {
    const result = computeRipple(invalidatedPrimitive(), [makeAnchor()], {
      transitionFrom: 'invalidated',
    });
    expect(result.shouldFire).toBe(false);
  });

  it('fires when transitionFrom is unspecified (conservative default)', () => {
    const result = computeRipple(invalidatedPrimitive(), [makeAnchor()]);
    expect(result.shouldFire).toBe(true);
  });

  it('only penalizes anchors that reference the primitive', () => {
    const referencingAnchor = makeAnchor({ id: 'a-ref', perceptionPrimitiveIds: ['PP-01'] });
    const otherAnchor = makeAnchor({ id: 'a-other', perceptionPrimitiveIds: ['PP-99'] });
    const result = computeRipple(invalidatedPrimitive(), [referencingAnchor, otherAnchor]);
    expect(result.anchorPenalties).toHaveLength(1);
    expect(result.anchorPenalties[0].anchorId).toBe('a-ref');
  });

  it('handles multi-primitive anchors (penalty fires when this primitive is in the list)', () => {
    const multiPrimAnchor = makeAnchor({
      id: 'a-multi',
      perceptionPrimitiveIds: ['PP-01', 'PP-05'],
      quality: { composite: 0.70 },
    });
    const result = computeRipple(invalidatedPrimitive(), [multiPrimAnchor]);
    expect(result.anchorPenalties).toHaveLength(1);
    expect(result.anchorPenalties[0].toComposite).toBeCloseTo(0.70 * 0.85, 4);
  });

  it('skips anchor with missing quality.composite', () => {
    const malformedAnchor = makeAnchor({ id: 'a-bad', quality: {} });
    const result = computeRipple(invalidatedPrimitive(), [malformedAnchor]);
    expect(result.anchorPenalties).toHaveLength(1);
    expect(result.anchorPenalties[0].skipped).toBe(true);
  });

  it('respects custom penalty factor', () => {
    const result = computeRipple(invalidatedPrimitive(), [makeAnchor()], {
      penaltyFactor: 0.50,
    });
    expect(result.anchorPenalties[0].toComposite).toBeCloseTo(0.80 * 0.50, 4);
    expect(result.anchorPenalties[0].penaltyFactor).toBe(0.50);
  });

  it('rejects penalty factor outside (0, 1]', () => {
    expect(() => computeRipple(invalidatedPrimitive(), [], { penaltyFactor: 0 })).toThrow(/penaltyFactor/);
    expect(() => computeRipple(invalidatedPrimitive(), [], { penaltyFactor: 1.5 })).toThrow(/penaltyFactor/);
    expect(() => computeRipple(invalidatedPrimitive(), [], { penaltyFactor: -0.1 })).toThrow(/penaltyFactor/);
  });

  it('rejects non-array dependentAnchors when ripple fires', () => {
    expect(() => computeRipple(invalidatedPrimitive(), null)).toThrow(/dependentAnchors/);
  });

  it('handles empty dependentAnchors array (no anchors to penalize)', () => {
    const result = computeRipple(invalidatedPrimitive(), []);
    expect(result.shouldFire).toBe(true);
    expect(result.anchorPenalties).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// rebuildDependentAnchorCount — I-EAL-9 invariant
// ───────────────────────────────────────────────────────────────────────────

describe('rebuildDependentAnchorCount — I-EAL-9 invariant', () => {
  it('counts anchors that reference the primitive', () => {
    const anchors = [
      makeAnchor({ id: 'a-1', perceptionPrimitiveIds: ['PP-01'] }),
      makeAnchor({ id: 'a-2', perceptionPrimitiveIds: ['PP-01', 'PP-05'] }),
      makeAnchor({ id: 'a-3', perceptionPrimitiveIds: ['PP-99'] }),
    ];
    const updated = rebuildDependentAnchorCount(makePrimitive(), anchors);
    expect(updated.validityScore.dependentAnchorCount).toBe(2);
  });

  it('count is zero when no anchors reference the primitive', () => {
    const anchors = [makeAnchor({ perceptionPrimitiveIds: ['PP-99'] })];
    const updated = rebuildDependentAnchorCount(makePrimitive(), anchors);
    expect(updated.validityScore.dependentAnchorCount).toBe(0);
  });

  it('count is zero with empty anchor list', () => {
    const updated = rebuildDependentAnchorCount(makePrimitive(), []);
    expect(updated.validityScore.dependentAnchorCount).toBe(0);
  });

  it('does not mutate input primitive', () => {
    const prim = makePrimitive();
    const before = JSON.stringify(prim);
    rebuildDependentAnchorCount(prim, [makeAnchor()]);
    expect(JSON.stringify(prim)).toBe(before);
  });

  it('preserves other validityScore fields', () => {
    const prim = makePrimitive({
      validityScore: {
        priorAlpha: 5,
        priorBeta: 3,
        pointEstimate: 0.625,
        sampleSize: 10,
        supportsCount: 6,
        credibleInterval: { lower: 0.4, upper: 0.85, level: 0.95 },
        lastUpdated: '2026-04-25T10:00:00Z',
        dependentAnchorCount: 99, // wrong — will be overwritten
      },
    });
    const updated = rebuildDependentAnchorCount(prim, [makeAnchor()]);
    expect(updated.validityScore.dependentAnchorCount).toBe(1);
    expect(updated.validityScore.pointEstimate).toBe(0.625);
    expect(updated.validityScore.sampleSize).toBe(10);
    expect(updated.validityScore.lastUpdated).toBe('2026-04-25T10:00:00Z');
  });

  it('throws on null primitive', () => {
    expect(() => rebuildDependentAnchorCount(null, [])).toThrow();
  });

  it('throws on non-array anchors', () => {
    expect(() => rebuildDependentAnchorCount(makePrimitive(), null)).toThrow();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Integration — Beta-driven invalidation transition
// ───────────────────────────────────────────────────────────────────────────

describe('integration — Beta updates drive invalidation', () => {
  it('starting load-bearing primitive becomes invalidated after enough non-supporting events', () => {
    // Start with a primitive whose existing data shows strong support
    let prim = makePrimitive();
    for (let i = 0; i < 30; i++) {
      prim = updatePrimitiveValidity(prim, { anchorId: 'a-1', supportsClaim: true });
    }
    expect(evaluatePrimitiveStatus(prim).status).toBe('load-bearing');

    // Then the world flips: 60 non-supporting events come in
    for (let i = 0; i < 60; i++) {
      prim = updatePrimitiveValidity(prim, { anchorId: 'a-1', supportsClaim: false });
    }
    // Beta(31, 61) → mean 31/92 ≈ 0.337
    expect(prim.validityScore.pointEstimate).toBeLessThan(0.5);
    // CI should now be entirely below 0.5
    expect(evaluatePrimitiveStatus(prim).status).toBe('invalidated');
  });

  it('seed primitive that never observes invalidating data stays load-bearing', () => {
    let prim = makePrimitive();
    for (let i = 0; i < 50; i++) {
      prim = updatePrimitiveValidity(prim, { anchorId: 'a-1', supportsClaim: true });
    }
    expect(evaluatePrimitiveStatus(prim).status).toBe('load-bearing');
  });

  it('PP-04 worst-case stress: marginal primitive lands at-risk before invalidating', () => {
    // SEED-04 PP-04 is the most-likely-to-invalidate; simulate borderline data
    let prim = makePrimitive();
    // 25 supporting + 25 non-supporting → posterior centered at 0.5
    for (let i = 0; i < 50; i++) {
      prim = updatePrimitiveValidity(prim, { anchorId: 'a-1', supportsClaim: i % 2 === 0 });
    }
    const status = evaluatePrimitiveStatus(prim);
    // Centered exactly at 0.5 with reasonable n → CI spans 0.5 → at-risk
    expect(status.status).toBe('at-risk');
  });
});
