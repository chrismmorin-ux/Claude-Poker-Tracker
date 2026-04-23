import { describe, it, expect } from 'vitest';
import {
  fearFoldShift,
  greedRaiseShift,
  applyEmotionalTilt,
  EMOTIONAL_TRANSFORM_VERSION,
  EMOTIONAL_TRANSFORM_CONFIG,
  FEAR_FOLD_CAP,
  GREED_RAISE_CAP,
  STYLE_MULTIPLIERS,
} from '../tiltTransform';

describe('fearFoldShift', () => {
  it('returns 0 for zero fear', () => {
    expect(fearFoldShift(0, 'Unknown')).toBe(0);
    expect(fearFoldShift(0, 'Fish')).toBe(0);
  });

  it('returns 0 for negative or non-finite fear', () => {
    expect(fearFoldShift(-0.5, 'Unknown')).toBe(0);
    expect(fearFoldShift(NaN, 'Unknown')).toBe(0);
  });

  it('shifts ~2% at fear=0.1 Unknown style (per schema §3.3 example)', () => {
    const shift = fearFoldShift(0.1, 'Unknown');
    expect(shift).toBeCloseTo(0.02, 3);
  });

  it('caps at FEAR_FOLD_CAP for extreme fear', () => {
    // Fish at full fear would be 1.0 × 8 × 0.025 × 1.4 = 0.28; cap to 0.25
    expect(fearFoldShift(1.0, 'Fish')).toBe(FEAR_FOLD_CAP);
    expect(fearFoldShift(1.0, 'Unknown')).toBeLessThanOrEqual(FEAR_FOLD_CAP);
  });

  it('respects per-style multipliers: Fish > Unknown > Nit', () => {
    const fish = fearFoldShift(0.5, 'Fish');
    const unknown = fearFoldShift(0.5, 'Unknown');
    const nit = fearFoldShift(0.5, 'Nit');
    expect(fish).toBeGreaterThan(unknown);
    expect(unknown).toBeGreaterThan(nit);
  });

  it('scale option lowers shift proportionally', () => {
    const full = fearFoldShift(0.5, 'Unknown', 1.0);
    const half = fearFoldShift(0.5, 'Unknown', 0.5);
    expect(half).toBeCloseTo(full * 0.5, 4);
  });
});

describe('greedRaiseShift', () => {
  it('returns 0 for zero greed', () => {
    expect(greedRaiseShift(0, 'Unknown')).toBe(0);
  });

  it('shifts ~1.5% at greed=0.1 Unknown', () => {
    // 0.1 × 6 × 0.025 × 1.0 = 0.015
    expect(greedRaiseShift(0.1, 'Unknown')).toBeCloseTo(0.015, 3);
  });

  it('caps at GREED_RAISE_CAP for extreme greed', () => {
    // Fish at full greed: 1.0 × 6 × 0.025 × 1.4 = 0.21; cap to 0.20
    expect(greedRaiseShift(1.0, 'Fish')).toBe(GREED_RAISE_CAP);
  });

  it('style multipliers correctly ordered', () => {
    const fish = greedRaiseShift(0.5, 'Fish');
    const tag = greedRaiseShift(0.5, 'TAG');
    const nit = greedRaiseShift(0.5, 'Nit');
    expect(fish).toBeGreaterThan(tag);
    expect(tag).toBeGreaterThan(nit);
  });
});

describe('applyEmotionalTilt — identity and integrity', () => {
  const baseline = { fold: 0.3, call: 0.5, raise: 0.2 };

  it('zero fear + zero greed is identity (modulo normalization)', () => {
    const state = { fearIndex: 0, greedIndex: 0 };
    const result = applyEmotionalTilt(baseline, state, 'Unknown');
    expect(result.fold).toBeCloseTo(0.3, 4);
    expect(result.call).toBeCloseTo(0.5, 4);
    expect(result.raise).toBeCloseTo(0.2, 4);
  });

  it('missing state returns baseline (normalized)', () => {
    const result = applyEmotionalTilt(baseline, null, 'Unknown');
    expect(result.fold + result.call + result.raise).toBeCloseTo(1.0, 4);
  });

  it('distribution sums to 1.0 after tilt', () => {
    const state = { fearIndex: 0.8, greedIndex: 0.4 };
    const result = applyEmotionalTilt(baseline, state, 'Fish');
    expect(result.fold + result.call + result.raise).toBeCloseTo(1.0, 4);
  });

  it('fear increases fold, pulls from call', () => {
    const state = { fearIndex: 0.8, greedIndex: 0 };
    const result = applyEmotionalTilt(baseline, state, 'Unknown');
    expect(result.fold).toBeGreaterThan(baseline.fold);
    expect(result.call).toBeLessThan(baseline.call);
    expect(result.raise).toBeCloseTo(baseline.raise, 4); // raise untouched
  });

  it('greed increases raise, pulls from call', () => {
    const state = { fearIndex: 0, greedIndex: 0.8 };
    const result = applyEmotionalTilt(baseline, state, 'Unknown');
    expect(result.raise).toBeGreaterThan(baseline.raise);
    expect(result.call).toBeLessThan(baseline.call);
    expect(result.fold).toBeCloseTo(baseline.fold, 4);
  });

  it('both fear and greed pull from call; total call mass decreases', () => {
    const state = { fearIndex: 0.6, greedIndex: 0.6 };
    const result = applyEmotionalTilt(baseline, state, 'Unknown');
    expect(result.fold).toBeGreaterThan(baseline.fold);
    expect(result.raise).toBeGreaterThan(baseline.raise);
    expect(result.call).toBeLessThan(baseline.call);
  });

  it('handles extreme state + low call mass without producing negatives', () => {
    const lowCall = { fold: 0.48, call: 0.02, raise: 0.5 };
    const state = { fearIndex: 1.0, greedIndex: 1.0 };
    const result = applyEmotionalTilt(lowCall, state, 'Fish');
    expect(result.fold).toBeGreaterThanOrEqual(0);
    expect(result.call).toBeGreaterThanOrEqual(0);
    expect(result.raise).toBeGreaterThanOrEqual(0);
    expect(result.fold + result.call + result.raise).toBeCloseTo(1.0, 4);
  });

  it('monotonic in fearIndex: higher fear produces higher fold%', () => {
    const lowFear = applyEmotionalTilt(baseline, { fearIndex: 0.2, greedIndex: 0 }, 'Unknown');
    const midFear = applyEmotionalTilt(baseline, { fearIndex: 0.5, greedIndex: 0 }, 'Unknown');
    const highFear = applyEmotionalTilt(baseline, { fearIndex: 0.9, greedIndex: 0 }, 'Unknown');
    expect(midFear.fold).toBeGreaterThan(lowFear.fold);
    expect(highFear.fold).toBeGreaterThan(midFear.fold);
  });

  it('monotonic in greedIndex: higher greed produces higher raise%', () => {
    const lowGreed = applyEmotionalTilt(baseline, { fearIndex: 0, greedIndex: 0.2 }, 'Unknown');
    const midGreed = applyEmotionalTilt(baseline, { fearIndex: 0, greedIndex: 0.5 }, 'Unknown');
    const highGreed = applyEmotionalTilt(baseline, { fearIndex: 0, greedIndex: 0.9 }, 'Unknown');
    expect(midGreed.raise).toBeGreaterThan(lowGreed.raise);
    expect(highGreed.raise).toBeGreaterThan(midGreed.raise);
  });
});

describe('applyEmotionalTilt — style parity', () => {
  const baseline = { fold: 0.3, call: 0.5, raise: 0.2 };
  const state = { fearIndex: 0.5, greedIndex: 0.5 };

  it('Fish tilts more than Nit', () => {
    const fish = applyEmotionalTilt(baseline, state, 'Fish');
    const nit = applyEmotionalTilt(baseline, state, 'Nit');
    // Fish foldshift > Nit foldshift; so fish.fold > nit.fold
    expect(fish.fold).toBeGreaterThan(nit.fold);
    expect(fish.raise).toBeGreaterThan(nit.raise);
  });

  it('Unknown style ≈ TAG (both multiplier 1.0)', () => {
    const unknown = applyEmotionalTilt(baseline, state, 'Unknown');
    const tag = applyEmotionalTilt(baseline, state, 'TAG');
    expect(unknown.fold).toBeCloseTo(tag.fold, 6);
    expect(unknown.raise).toBeCloseTo(tag.raise, 6);
  });
});

describe('transform config metadata', () => {
  it('EMOTIONAL_TRANSFORM_VERSION is v1.0', () => {
    expect(EMOTIONAL_TRANSFORM_VERSION).toBe('1.0');
    expect(EMOTIONAL_TRANSFORM_CONFIG.version).toBe('1.0');
  });

  it('EMOTIONAL_TRANSFORM_CONFIG carries schema §3.3 fields', () => {
    expect(EMOTIONAL_TRANSFORM_CONFIG.fearCoefficient).toBe(8);
    expect(EMOTIONAL_TRANSFORM_CONFIG.greedCoefficient).toBe(6);
    expect(EMOTIONAL_TRANSFORM_CONFIG.fearFoldCap).toBe(0.25);
    expect(EMOTIONAL_TRANSFORM_CONFIG.greedRaiseCap).toBe(0.20);
    expect(EMOTIONAL_TRANSFORM_CONFIG.styleMultipliers).toBeDefined();
  });

  it('STYLE_MULTIPLIERS follow Exploit Theorist ordering', () => {
    expect(STYLE_MULTIPLIERS.Fish).toBeGreaterThan(STYLE_MULTIPLIERS.Unknown);
    expect(STYLE_MULTIPLIERS.Unknown).toBeGreaterThan(STYLE_MULTIPLIERS.Nit);
    expect(STYLE_MULTIPLIERS.LAG).toBeGreaterThan(STYLE_MULTIPLIERS.TAG);
    expect(STYLE_MULTIPLIERS.TAG).toBe(1.0);
  });
});
