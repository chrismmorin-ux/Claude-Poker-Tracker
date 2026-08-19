/**
 * WS-496 follow-up — the curse is frequency x severity, and the aggregate hides them.
 *
 * The founder objected that a better simulation must never score worse than a naive one. Testing
 * that on depth-2 produced an aggregate curse that ROSE when depth-2 was finally allowed to run
 * to completion (18.40 -> 25.90 chips), which read as a regression. It was not: the flip rate
 * FELL 0.400 -> 0.210 while the gap on a flip ROSE 46.0 -> 123.3. Two effects, opposite signs,
 * one number.
 *
 * The decomposition is exact rather than approximate, which is what these pin.
 */
import { describe, it, expect } from 'vitest';
import { heldOutOptimism } from '../backtest/optimismBias.mjs';

describe('heldOutOptimism decomposition', () => {
  it('gives an agreeing node EXACTLY zero weight', () => {
    // Both directions of an agreeing node are `A[a*] - B[a*]` and `B[a*] - A[a*]`. They cancel
    // identically, not to within tolerance — which is why the whole curse sits on the flips.
    const agreeing = [
      { a: { x: 10, y: 5 }, b: { x: 14, y: 6 } },
      { a: { x: 20, y: 1 }, b: { x: 12, y: 2 } },
      { a: { x: -3, y: -9 }, b: { x: 40, y: 1 } },
    ];
    const r = heldOutOptimism(agreeing);
    expect(r.curse).toBe(0);
    expect(r.flips).toBe(0);
    expect(r.argmaxFlipRate).toBe(0);
    expect(r.meanGapOnFlip).toBeNull();
  });

  it('satisfies curse === flipRate x meanGapOnFlip', () => {
    const mixed = [
      { a: { x: 10, y: 5 }, b: { x: 14, y: 6 } },   // agrees on x
      { a: { x: 1, y: 9 }, b: { x: 9, y: 1 } },     // flips
      { a: { x: 2, y: 30 }, b: { x: 25, y: 3 } },   // flips
      { a: { x: 7, y: 1 }, b: { x: 8, y: 2 } },     // agrees on x
    ];
    const r = heldOutOptimism(mixed);
    expect(r.flips).toBe(2);
    expect(r.argmaxFlipRate).toBe(0.5);
    expect(r.argmaxFlipRate * r.meanGapOnFlip).toBeCloseTo(r.curse, 12);
  });

  it('separates a run that got MORE stable from one that got worse', () => {
    // The exact shape the budget sweep produced: fewer flips, each far more expensive. An
    // aggregate-only report calls this a regression; the decomposition shows one axis improved.
    const noisy = [
      { a: { x: 1, y: 3 }, b: { x: 3, y: 1 } },
      { a: { x: 1, y: 3 }, b: { x: 3, y: 1 } },
      { a: { x: 5, y: 1 }, b: { x: 6, y: 2 } },
      { a: { x: 5, y: 1 }, b: { x: 6, y: 2 } },
    ];
    const stableButExtreme = [
      { a: { x: 1, y: 40 }, b: { x: 40, y: 1 } },
      { a: { x: 5, y: 1 }, b: { x: 6, y: 2 } },
      { a: { x: 5, y: 1 }, b: { x: 6, y: 2 } },
      { a: { x: 5, y: 1 }, b: { x: 6, y: 2 } },
    ];
    const n = heldOutOptimism(noisy);
    const s = heldOutOptimism(stableButExtreme);

    expect(s.argmaxFlipRate).toBeLessThan(n.argmaxFlipRate);   // decisions got MORE stable
    expect(s.meanGapOnFlip).toBeGreaterThan(n.meanGapOnFlip);  // but each disagreement costs more
    // And the aggregate alone cannot tell you which of those happened.
    expect(s.curse).toBeGreaterThan(0);
  });
});
