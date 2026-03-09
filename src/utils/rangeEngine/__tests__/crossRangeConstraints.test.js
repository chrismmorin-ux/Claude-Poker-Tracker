import { describe, it, expect } from 'vitest';
import { normalizeAcrossActions, normalizeAllPositions } from '../crossRangeConstraints';
import { createEmptyProfile, RANGE_ACTIONS, RANGE_POSITIONS } from '../rangeProfile';

const GRID_SIZE = 169;

const makeRanges = () => {
  const ranges = {};
  for (const action of RANGE_ACTIONS) {
    ranges[action] = new Float64Array(GRID_SIZE);
  }
  return ranges;
};

describe('crossRangeConstraints', () => {
  describe('normalizeAcrossActions', () => {
    it('no-raise non-fold actions sum to <= 1.0 per cell after normalization', () => {
      const ranges = makeRanges();
      // Set conflicting high weights
      ranges.limp[0] = 0.8;
      ranges.open[0] = 0.6;

      normalizeAcrossActions(ranges);

      const sum = ranges.limp[0] + ranges.open[0];
      expect(sum).toBeLessThanOrEqual(1.0 + 1e-10);
    });

    it('faced-raise non-fold actions sum to <= 1.0 per cell after normalization', () => {
      const ranges = makeRanges();
      ranges.coldCall[5] = 1.0;
      ranges.threeBet[5] = 1.0;

      normalizeAcrossActions(ranges);

      const sum = ranges.coldCall[5] + ranges.threeBet[5];
      expect(sum).toBeLessThanOrEqual(1.0 + 1e-10);
      // Both should be scaled to 0.5
      expect(ranges.coldCall[5]).toBeCloseTo(0.5, 5);
      expect(ranges.threeBet[5]).toBeCloseTo(0.5, 5);
    });

    it('fold weights are unchanged by normalization', () => {
      const ranges = makeRanges();
      ranges.fold[0] = 0.9;
      ranges.limp[0] = 0.8;
      ranges.open[0] = 0.6;

      normalizeAcrossActions(ranges);

      expect(ranges.fold[0]).toBe(0.9);
    });

    it('non-fold weights clamped to [0, 1]', () => {
      const ranges = makeRanges();
      // Set non-fold actions to > 1.0
      ranges.limp[10] = 1.5;
      ranges.open[10] = 1.5;
      ranges.coldCall[10] = 1.5;
      ranges.threeBet[10] = 1.5;

      normalizeAcrossActions(ranges);

      for (const action of ['limp', 'open', 'coldCall', 'threeBet']) {
        expect(ranges[action][10]).toBeGreaterThanOrEqual(0);
        expect(ranges[action][10]).toBeLessThanOrEqual(1.0);
      }
    });

    it('empty ranges (all zeros) do not cause division by zero', () => {
      const ranges = makeRanges();
      // All zeros — should not throw
      expect(() => normalizeAcrossActions(ranges)).not.toThrow();

      for (const action of RANGE_ACTIONS) {
        for (let i = 0; i < GRID_SIZE; i++) {
          expect(ranges[action][i]).toBe(0);
        }
      }
    });

    it('no-raise and faced-raise scenarios are independent', () => {
      const ranges = makeRanges();
      // Set open high (no-raise scenario)
      ranges.open[0] = 0.9;
      // Set threeBet high (faced-raise scenario)
      ranges.threeBet[0] = 0.9;

      normalizeAcrossActions(ranges);

      // Both should remain unchanged (no conflict within their scenarios)
      expect(ranges.open[0]).toBeCloseTo(0.9, 5);
      expect(ranges.threeBet[0]).toBeCloseTo(0.9, 5);
    });

    it('preserves ratios when scaling down', () => {
      const ranges = makeRanges();
      ranges.limp[3] = 0.4;
      ranges.open[3] = 0.8;
      // Total = 1.2, should scale to 1.0

      normalizeAcrossActions(ranges);

      const ratio = ranges.open[3] / ranges.limp[3];
      expect(ratio).toBeCloseTo(2.0, 3);
    });

    it('does not scale when sum is already <= 1.0', () => {
      const ranges = makeRanges();
      ranges.limp[0] = 0.3;
      ranges.open[0] = 0.5;

      normalizeAcrossActions(ranges);

      expect(ranges.limp[0]).toBe(0.3);
      expect(ranges.open[0]).toBe(0.5);
    });
  });

  describe('normalizeAllPositions', () => {
    it('normalizes all 5 positions', () => {
      const profile = createEmptyProfile('p1', 'u1');
      // Set conflicting weights in multiple positions
      for (const pos of RANGE_POSITIONS) {
        profile.ranges[pos].limp[0] = 0.8;
        profile.ranges[pos].open[0] = 0.8;
      }

      normalizeAllPositions(profile.ranges);

      for (const pos of RANGE_POSITIONS) {
        const sum = profile.ranges[pos].limp[0] + profile.ranges[pos].open[0];
        expect(sum).toBeLessThanOrEqual(1.0 + 1e-10);
      }
    });
  });
});
