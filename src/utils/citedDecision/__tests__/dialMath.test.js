import { describe, it, expect } from 'vitest';
import { computeBlend, isZeroBlend, computeDialFromQuality } from '../dialMath';

const makeAssumption = ({ quality = 0.8, recognizability = 0.7, resistance = 0.7, dial = 0.7 } = {}) => ({
  id: `a-${Math.random()}`,
  quality: { composite: quality, actionableInDrill: true, actionableLive: true },
  recognizability: { score: recognizability },
  counterExploit: { resistanceScore: resistance },
  operator: { currentDial: dial },
});

describe('computeBlend — baseline behavior', () => {
  it('returns ~0.5 for empty applied list with neutral context', () => {
    const blend = computeBlend([], { varianceBudget: 0, stakeContext: 'cash' });
    expect(blend).toBe(0.5);
  });

  it('returns ≤ 0.5 for empty list in tournament (stake penalty)', () => {
    const blend = computeBlend([], { stakeContext: 'tournament' });
    expect(blend).toBeLessThan(0.5);
  });

  it('returns ≤ 0.5 for empty list at high-stakes (stronger penalty)', () => {
    const blend = computeBlend([], { stakeContext: 'high-stakes' });
    expect(blend).toBeLessThan(0.5);
  });

  it('clamps to [0, 1]', () => {
    const blend = computeBlend([makeAssumption()], { varianceBudget: 100 });
    expect(blend).toBeGreaterThanOrEqual(0);
    expect(blend).toBeLessThanOrEqual(1);
  });
});

describe('computeBlend — with applied assumptions', () => {
  it('strong bundle + high variance budget pushes blend above baseline', () => {
    const strong = [
      makeAssumption({ quality: 0.9, recognizability: 0.9, resistance: 0.9 }),
      makeAssumption({ quality: 0.85, recognizability: 0.85, resistance: 0.85 }),
    ];
    const blend = computeBlend(strong, { varianceBudget: 0.5, stakeContext: 'cash' });
    expect(blend).toBeGreaterThan(0.5);
  });

  it('weak bundle pulls blend down', () => {
    const weak = [
      makeAssumption({ quality: 0.3, recognizability: 0.4, resistance: 0.3 }),
    ];
    const blend = computeBlend(weak, { varianceBudget: 0, stakeContext: 'cash' });
    expect(blend).toBeLessThan(0.5);
  });

  it('negative variance budget (drawdown) pulls blend down', () => {
    const assumptions = [makeAssumption()];
    const neutral = computeBlend(assumptions, { varianceBudget: 0 });
    const drawdown = computeBlend(assumptions, { varianceBudget: -1 });
    expect(drawdown).toBeLessThan(neutral);
  });

  it('tournament stake pulls blend down relative to cash', () => {
    const assumptions = [makeAssumption({ quality: 0.9, recognizability: 0.9, resistance: 0.9 })];
    const cash = computeBlend(assumptions, { stakeContext: 'cash' });
    const tournament = computeBlend(assumptions, { stakeContext: 'tournament' });
    expect(tournament).toBeLessThan(cash);
  });

  it('monotonic in bundle quality (approximate — more high-quality assumptions ↑ blend)', () => {
    const low = [makeAssumption({ quality: 0.4, recognizability: 0.4, resistance: 0.5 })];
    const high = [makeAssumption({ quality: 0.95, recognizability: 0.95, resistance: 0.95 })];
    expect(computeBlend(high)).toBeGreaterThan(computeBlend(low));
  });
});

describe('isZeroBlend — honesty check foundation', () => {
  it('returns true for empty array', () => {
    expect(isZeroBlend([], 0.5)).toBe(true);
  });

  it('returns true for explicit blend=0', () => {
    expect(isZeroBlend([makeAssumption()], 0)).toBe(true);
  });

  it('returns true when all dials are 0', () => {
    expect(isZeroBlend([makeAssumption({ dial: 0 }), makeAssumption({ dial: 0 })], 0.7)).toBe(true);
  });

  it('returns false when blend > 0 and any dial > 0', () => {
    expect(isZeroBlend([makeAssumption({ dial: 0.5 })], 0.7)).toBe(false);
  });

  it('returns true when blend is negligibly small', () => {
    expect(isZeroBlend([makeAssumption()], 0.0005)).toBe(true);
  });
});

describe('computeDialFromQuality (re-exported from operator)', () => {
  it('is available as a named export', () => {
    expect(typeof computeDialFromQuality).toBe('function');
  });

  it('returns a valid dial for canonical quality', () => {
    const dial = computeDialFromQuality(0.8);
    expect(dial).toBeGreaterThan(0.3);
    expect(dial).toBeLessThanOrEqual(0.9);
  });
});
