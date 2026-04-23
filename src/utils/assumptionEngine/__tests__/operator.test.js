import { describe, it, expect } from 'vitest';
import {
  applyOperator,
  composeOperators,
  computeDialFromQuality,
} from '../operator';

const baseline = () => ({ fold: 0.3, call: 0.5, raise: 0.2 });

const makeOperator = (delta, dial = 1.0) => ({
  target: 'villain',
  nodeSelector: {},
  transform: { actionDistributionDelta: delta },
  currentDial: dial,
  dialFloor: 0,
  dialCeiling: 1,
  suppresses: [],
});

describe('applyOperator — honesty check (I-AE-3)', () => {
  it('dial=0 returns baseline unchanged (modulo normalization)', () => {
    const op = makeOperator({ fold: 0.2, call: -0.1, raise: -0.1 }, 0);
    const result = applyOperator(op, baseline());
    expect(result.fold).toBeCloseTo(0.3, 6);
    expect(result.call).toBeCloseTo(0.5, 6);
    expect(result.raise).toBeCloseTo(0.2, 6);
  });

  it('explicit dial=0 override returns baseline unchanged', () => {
    const op = makeOperator({ fold: 0.5, call: -0.3, raise: -0.2 }, 1.0);
    const result = applyOperator(op, baseline(), 0);
    expect(result.fold).toBeCloseTo(0.3, 6);
    expect(result.call).toBeCloseTo(0.5, 6);
    expect(result.raise).toBeCloseTo(0.2, 6);
  });

  it('missing operator returns baseline', () => {
    const result = applyOperator(null, baseline());
    expect(result.fold + result.call + result.raise).toBeCloseTo(1.0, 4);
  });

  it('missing transform returns baseline', () => {
    const op = { target: 'villain', nodeSelector: {}, currentDial: 1.0, suppresses: [] };
    const result = applyOperator(op, baseline());
    expect(result.fold).toBeCloseTo(0.3, 4);
  });
});

describe('applyOperator — delta application', () => {
  it('fold-biased delta at dial=1 increases fold, decreases others proportionally per delta', () => {
    const op = makeOperator({ fold: 0.15, call: -0.10, raise: -0.05 });
    const result = applyOperator(op, baseline());
    expect(result.fold).toBeGreaterThan(0.3);
    expect(result.call).toBeLessThan(0.5);
    expect(result.raise).toBeLessThan(0.2);
    expect(result.fold + result.call + result.raise).toBeCloseTo(1.0, 4);
  });

  it('intermediate dial scales delta proportionally', () => {
    const op = makeOperator({ fold: 0.2, call: -0.15, raise: -0.05 });
    const d0 = applyOperator(op, baseline(), 0);
    const d05 = applyOperator(op, baseline(), 0.5);
    const d1 = applyOperator(op, baseline(), 1.0);
    // Monotonic in dial: d0.fold < d05.fold < d1.fold
    expect(d05.fold).toBeGreaterThan(d0.fold);
    expect(d1.fold).toBeGreaterThan(d05.fold);
  });

  it('clips action probabilities that would fall below 0', () => {
    const op = makeOperator({ fold: 0.9, call: -0.6, raise: -0.3 });
    const result = applyOperator(op, baseline());
    expect(result.fold).toBeLessThanOrEqual(1.0);
    expect(result.call).toBeGreaterThanOrEqual(0);
    expect(result.raise).toBeGreaterThanOrEqual(0);
    expect(result.fold + result.call + result.raise).toBeCloseTo(1.0, 4);
  });

  it('clips action probabilities that would exceed 1', () => {
    const op = makeOperator({ fold: 0.9, call: -0.5, raise: -0.4 });
    const extreme = { fold: 0.8, call: 0.15, raise: 0.05 };
    const result = applyOperator(op, extreme);
    expect(result.fold).toBeLessThanOrEqual(1.0);
    expect(result.fold + result.call + result.raise).toBeCloseTo(1.0, 4);
  });

  it('returns normalized baseline when all actions zero after clip', () => {
    const op = makeOperator({ fold: -1.0, call: 0.5, raise: 0.5 });
    // Baseline with fold=0.5 + delta=-1.0 (dial=1) → fold=-0.5 clipped to 0.
    const result = applyOperator(op, { fold: 0.5, call: 0.3, raise: 0.2 }, 1.0);
    expect(result.fold).toBeGreaterThanOrEqual(0);
    expect(result.fold + result.call + result.raise).toBeCloseTo(1.0, 4);
  });
});

describe('composeOperators', () => {
  it('empty array returns baseline', () => {
    const result = composeOperators([], baseline());
    expect(result.fold).toBeCloseTo(0.3, 4);
  });

  it('single operator matches applyOperator', () => {
    const op = makeOperator({ fold: 0.1, call: -0.1, raise: 0 });
    const composed = composeOperators([{ operator: op, dial: 1.0 }], baseline());
    const applied = applyOperator(op, baseline(), 1.0);
    expect(composed.fold).toBeCloseTo(applied.fold, 4);
    expect(composed.call).toBeCloseTo(applied.call, 4);
    expect(composed.raise).toBeCloseTo(applied.raise, 4);
  });

  it('two operators add deltas (not cascade)', () => {
    const op1 = makeOperator({ fold: 0.1, call: -0.1, raise: 0 });
    const op2 = makeOperator({ fold: 0, call: -0.1, raise: 0.1 });
    const result = composeOperators(
      [{ operator: op1, dial: 1.0 }, { operator: op2, dial: 1.0 }],
      baseline(),
    );
    expect(result.fold).toBeCloseTo(0.4, 4); // 0.3 + 0.1 + 0
    expect(result.call).toBeCloseTo(0.3, 4); // 0.5 - 0.1 - 0.1
    expect(result.raise).toBeCloseTo(0.3, 4); // 0.2 + 0 + 0.1
  });

  it('honesty check: all dials zero → identity', () => {
    const op1 = makeOperator({ fold: 0.5, call: -0.3, raise: -0.2 });
    const op2 = makeOperator({ fold: -0.2, call: 0.1, raise: 0.1 });
    const result = composeOperators(
      [{ operator: op1, dial: 0 }, { operator: op2, dial: 0 }],
      baseline(),
    );
    expect(result.fold).toBeCloseTo(0.3, 6);
    expect(result.call).toBeCloseTo(0.5, 6);
    expect(result.raise).toBeCloseTo(0.2, 6);
  });

  it('sums to 1.0', () => {
    const op1 = makeOperator({ fold: 0.15, call: -0.12, raise: -0.03 });
    const op2 = makeOperator({ fold: -0.08, call: 0.04, raise: 0.04 });
    const result = composeOperators(
      [{ operator: op1, dial: 0.7 }, { operator: op2, dial: 0.5 }],
      baseline(),
    );
    expect(result.fold + result.call + result.raise).toBeCloseTo(1.0, 4);
  });
});

describe('computeDialFromQuality — dial curve per schema §6.1', () => {
  it('approaches dialFloor for very low quality (sigmoid asymptotic, not exact)', () => {
    const dial = computeDialFromQuality(0, { dialFloor: 0.3, dialCeiling: 0.9, sigmoidSteepness: 8 });
    // Sigmoid at x=-4 ≈ 0.018; dial ≈ 0.3 + 0.6 × 0.018 = 0.311. Close to floor but not exact.
    expect(dial).toBeGreaterThanOrEqual(0.3);
    expect(dial).toBeLessThan(0.32);
  });

  it('returns ~midpoint at quality=0.5', () => {
    const dial = computeDialFromQuality(0.5, { dialFloor: 0.3, dialCeiling: 0.9, sigmoidSteepness: 8 });
    expect(dial).toBeCloseTo(0.6, 1); // 0.3 + (0.9-0.3) × 0.5 = 0.6
  });

  it('approaches dialCeiling for very high quality (sigmoid asymptotic)', () => {
    const dial = computeDialFromQuality(1.0, { dialFloor: 0.3, dialCeiling: 0.9, sigmoidSteepness: 8 });
    // Sigmoid at x=4 ≈ 0.982; dial ≈ 0.3 + 0.6 × 0.982 = 0.889.
    expect(dial).toBeGreaterThan(0.88);
    expect(dial).toBeLessThanOrEqual(0.9);
  });

  it('monotonic in quality', () => {
    const params = { dialFloor: 0.3, dialCeiling: 0.9, sigmoidSteepness: 8 };
    const q02 = computeDialFromQuality(0.2, params);
    const q05 = computeDialFromQuality(0.5, params);
    const q08 = computeDialFromQuality(0.8, params);
    expect(q05).toBeGreaterThan(q02);
    expect(q08).toBeGreaterThan(q05);
  });

  it('clamps quality outside [0, 1]', () => {
    const dial = computeDialFromQuality(1.5, { dialFloor: 0.3, dialCeiling: 0.9, sigmoidSteepness: 8 });
    expect(dial).toBeGreaterThanOrEqual(0.3);
    expect(dial).toBeLessThanOrEqual(0.9);
  });
});
