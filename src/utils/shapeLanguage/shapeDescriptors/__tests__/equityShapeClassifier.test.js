/**
 * equityShapeClassifier.test.js — Spire + Polarization classifier
 * correctness on canonical curves + edge cases + threshold checks.
 *
 * SLS Stream B2 — WS-042 / SPR-084.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyEquityShape,
  getPolarizationDisplayName,
  POLARIZATION_LABELS,
} from '../equityShapeClassifier';
import {
  SPIRE_TOP_BUCKET_FRACTION,
  DUMBBELL_EXTREMES_MIN,
  DUMBBELL_MIDDLE_MAX,
  SIDE_HEAVY_HALF_FRACTION,
} from '../equityShapePrototypes';
import { computeEquityDistributionCurve } from '../equityDistributionCurve';

const mk = (weight, heroEquity) => ({ weight, heroEquity });

// Convenience: build a curve object directly from an 8-bucket
// histogram (skipping the EDC compute path for fixture-style tests).
const fixtureCurve = (bucketHistogram, totalWeight = 1) => ({
  status: 'ok',
  sortedEquities: [0.1, 0.5, 0.9], // shape only, not used by classifier
  percentiles: [0.33, 0.66, 1.0],
  bucketHistogram,
  bucketEdges: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0],
  totalWeight,
  weightedMean: 0.5,
  combosTotal: 3,
});

describe('classifyEquityShape — empty handling', () => {
  it('returns empty for null input', () => {
    const r = classifyEquityShape(null);
    expect(r.status).toBe('empty');
    expect(r.hasSpire).toBe(false);
    expect(r.spireWidth).toBe(0);
    expect(r.polarization).toBe('flat');
  });

  it('returns empty for curve with status: empty', () => {
    const r = classifyEquityShape({ status: 'empty' });
    expect(r.status).toBe('empty');
  });

  it('returns empty when bucketHistogram is missing', () => {
    const r = classifyEquityShape({ status: 'ok', totalWeight: 1 });
    expect(r.status).toBe('empty');
  });

  it('returns empty when bucketHistogram length is wrong', () => {
    const r = classifyEquityShape({ status: 'ok', totalWeight: 1, bucketHistogram: [1, 0, 0] });
    expect(r.status).toBe('empty');
  });

  it('returns empty when totalWeight below MIN_CLASSIFIABLE_WEIGHT', () => {
    const r = classifyEquityShape(fixtureCurve([1, 0, 0, 0, 0, 0, 0, 0], 0.005));
    expect(r.status).toBe('empty');
  });
});

describe('classifyEquityShape — Spire detection', () => {
  it('fires Spire when top bucket fraction exceeds threshold', () => {
    const h = [0.0, 0.0, 0.5, 0.4, 0.0, 0.0, 0.0, 0.1]; // top bucket = 0.10
    const r = classifyEquityShape(fixtureCurve(h));
    expect(r.hasSpire).toBe(true);
    expect(r.topBucketFraction).toBeCloseTo(0.1, 5);
  });

  it('does not fire Spire when top bucket fraction is below threshold', () => {
    const h = [0.2, 0.2, 0.2, 0.2, 0.1, 0.05, 0.025, 0.025]; // top bucket = 0.025
    const r = classifyEquityShape(fixtureCurve(h));
    expect(r.hasSpire).toBe(false);
    expect(r.spireWidth).toBe(0);
  });

  it('fires Spire exactly at the SPIRE_TOP_BUCKET_FRACTION threshold (>=)', () => {
    const exact = SPIRE_TOP_BUCKET_FRACTION;
    const h = [1 - exact, 0, 0, 0, 0, 0, 0, exact];
    const r = classifyEquityShape(fixtureCurve(h));
    expect(r.hasSpire).toBe(true);
  });

  it('reports spireWidth=1 for a thin spike with empty adjacent buckets', () => {
    const h = [0.0, 0.0, 0.5, 0.4, 0.0, 0.0, 0.0, 0.1];
    const r = classifyEquityShape(fixtureCurve(h));
    expect(r.spireWidth).toBe(1);
  });

  it('reports wider spireWidth when adjacent top buckets carry mass', () => {
    // bucket 7 = 0.15, bucket 6 = 0.10 (≥ 0.4 * 0.15 = 0.06 → counts)
    const h = [0.4, 0.0, 0.25, 0.10, 0.0, 0.0, 0.10, 0.15];
    const r = classifyEquityShape(fixtureCurve(h));
    expect(r.hasSpire).toBe(true);
    expect(r.spireWidth).toBeGreaterThanOrEqual(2);
  });
});

describe('classifyEquityShape — Polarization labels', () => {
  it('labels dumbbell when both extremes are heavy and middle is light', () => {
    const h = [0.35, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.35];
    const r = classifyEquityShape(fixtureCurve(h));
    expect(r.polarization).toBe('dumbbell');
  });

  it('does NOT label dumbbell when middle is heavy even if extremes are heavy', () => {
    const h = [0.25, 0.05, 0.05, 0.10, 0.20, 0.05, 0.05, 0.25];
    const r = classifyEquityShape(fixtureCurve(h));
    expect(r.polarization).not.toBe('dumbbell');
  });

  it('labels left-heavy when lower half ≥ SIDE_HEAVY_HALF_FRACTION', () => {
    const h = [0.30, 0.20, 0.15, 0.10, 0.10, 0.05, 0.05, 0.05]; // lower = 0.75
    const r = classifyEquityShape(fixtureCurve(h));
    expect(r.polarization).toBe('left-heavy');
  });

  it('labels right-heavy when upper half ≥ SIDE_HEAVY_HALF_FRACTION', () => {
    const h = [0.05, 0.05, 0.05, 0.05, 0.20, 0.20, 0.20, 0.20]; // upper = 0.80
    const r = classifyEquityShape(fixtureCurve(h));
    expect(r.polarization).toBe('right-heavy');
  });

  it('labels flat when no specific shape test fires', () => {
    const h = [0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125];
    const r = classifyEquityShape(fixtureCurve(h));
    expect(r.polarization).toBe('flat');
  });

  it('returns one of the 4 canonical labels always', () => {
    const cases = [
      [1, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 1],
      [0.5, 0, 0, 0, 0, 0, 0, 0.5],
      [0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125],
    ];
    for (const h of cases) {
      const r = classifyEquityShape(fixtureCurve(h));
      expect(POLARIZATION_LABELS).toContain(r.polarization);
    }
  });

  it('dumbbell test prefers dumbbell over side-heavy when both could match', () => {
    // dumbbell-AND-left-heavy: lower 65%, extremes 50%+, middle 0
    // (h[0]=0.5, h[1]=0.05, h[2]=0.05, h[3]=0.05, h[4]=0.05, ..., h[7]=0.05)
    const h = [0.50, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.20];
    const r = classifyEquityShape(fixtureCurve(h));
    // Extremes = 0.70 ≥ 0.4; middle = 0.10 ≤ 0.15 → dumbbell wins
    expect(r.polarization).toBe('dumbbell');
  });
});

describe('classifyEquityShape — output shape', () => {
  it('returns the same field set for ok and empty', () => {
    const ok = classifyEquityShape(fixtureCurve([0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125]));
    const empty = classifyEquityShape(null);
    expect(Object.keys(ok).sort()).toEqual(Object.keys(empty).sort());
  });

  it('is deterministic — same input yields same output', () => {
    const c = fixtureCurve([0.2, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]);
    const a = classifyEquityShape(c);
    const b = classifyEquityShape(c);
    expect(a).toEqual(b);
  });

  it('does not mutate the input bucketHistogram', () => {
    const h = [0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125];
    const snapshot = h.slice();
    classifyEquityShape(fixtureCurve(h));
    expect(h).toEqual(snapshot);
  });

  it('returns bucketHistogram as a copy, not the same reference', () => {
    const h = [0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125];
    const c = fixtureCurve(h);
    const r = classifyEquityShape(c);
    expect(r.bucketHistogram).toEqual(h);
    expect(r.bucketHistogram).not.toBe(h);
  });
});

describe('classifyEquityShape — composes with computeEquityDistributionCurve', () => {
  it('chains EDC → classifier and produces sensible labels for hockey-stick perCombo', () => {
    // Hockey stick: most mass at heroEq 0.7 (villain 0.3 → bucket 2),
    // small spire at heroEq 0.05 (villain 0.95 → bucket 7).
    const perCombo = [
      mk(1, 0.7), mk(1, 0.7), mk(1, 0.7), mk(1, 0.7), mk(1, 0.7), mk(1, 0.7),
      mk(1, 0.05), mk(1, 0.05),
    ];
    const curve = computeEquityDistributionCurve(perCombo);
    const r = classifyEquityShape(curve);
    expect(r.status).toBe('ok');
    expect(r.hasSpire).toBe(true);
    // Lower half (buckets 0-3) has 6/8 = 0.75 of weight → left-heavy
    expect(r.polarization).toBe('left-heavy');
  });

  it('chains EDC → classifier and labels dumbbell for bimodal perCombo', () => {
    // Equal mass at villain eq 0 (heroEq=1, bucket 0) and villain eq 1
    // (heroEq=0, bucket 7), nothing in the middle.
    const perCombo = [];
    for (let i = 0; i < 4; i++) perCombo.push(mk(1, 1));
    for (let i = 0; i < 4; i++) perCombo.push(mk(1, 0));
    const curve = computeEquityDistributionCurve(perCombo);
    const r = classifyEquityShape(curve);
    expect(r.polarization).toBe('dumbbell');
  });

  it('chains EDC → classifier and labels flat for uniform-equity perCombo', () => {
    const perCombo = [];
    for (let i = 0; i < 8; i++) {
      // Each combo has a different equity, sweeping across buckets
      perCombo.push(mk(1, i / 7));
    }
    const curve = computeEquityDistributionCurve(perCombo);
    const r = classifyEquityShape(curve);
    expect(r.polarization).toBe('flat');
  });
});

describe('getPolarizationDisplayName', () => {
  it('maps each canonical label to a display name', () => {
    expect(getPolarizationDisplayName('flat')).toBe('Flat');
    expect(getPolarizationDisplayName('left-heavy')).toBe('Left-heavy');
    expect(getPolarizationDisplayName('right-heavy')).toBe('Right-heavy');
    expect(getPolarizationDisplayName('dumbbell')).toBe('Dumbbell');
  });

  it('falls through to the raw label for unknown input', () => {
    expect(getPolarizationDisplayName('unknown-label')).toBe('unknown-label');
  });
});
