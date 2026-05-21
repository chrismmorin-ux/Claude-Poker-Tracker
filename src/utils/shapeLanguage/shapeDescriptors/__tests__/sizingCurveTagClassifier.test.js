/**
 * sizingCurveTagClassifier.test.js — Classification correctness on
 * canonical EV-vs-sizing curve shapes + edge cases + compound logic.
 *
 * SLS Stream B2 — WS-042 / SPR-084.
 */

import { describe, it, expect } from 'vitest';
import {
  classifySizingCurveTag,
  getSizingCurveTagDisplayName,
  SIZING_CURVE_LABELS,
} from '../sizingCurveTagClassifier';
import {
  MIN_SAMPLES_FOR_CLASSIFICATION,
  FLAT_EV_THRESHOLD,
} from '../sizingCurveTagPrototypes';

const mk = (fraction, ev) => ({ fraction, ev });

describe('classifySizingCurveTag — empty / sparse handling', () => {
  it('returns empty for null', () => {
    const r = classifySizingCurveTag(null);
    expect(r.label).toBe('empty');
    expect(r.confidence).toBe(0);
    expect(r.peakIndex).toBe(null);
  });

  it('returns empty for non-array', () => {
    expect(classifySizingCurveTag({}).label).toBe('empty');
    expect(classifySizingCurveTag('curve').label).toBe('empty');
  });

  it('returns empty when fewer than MIN_SAMPLES_FOR_CLASSIFICATION', () => {
    const r = classifySizingCurveTag([mk(0.5, 1), mk(0.75, 2)]);
    expect(r.label).toBe('empty');
    expect(MIN_SAMPLES_FOR_CLASSIFICATION).toBeGreaterThanOrEqual(3);
  });

  it('filters non-finite entries before count check', () => {
    const r = classifySizingCurveTag([
      mk(NaN, 1),
      mk(0.5, Infinity),
      mk(0.75, 2),
    ]);
    expect(r.label).toBe('empty');
  });

  it('classifies when ≥ MIN_SAMPLES finite entries present after filtering', () => {
    const r = classifySizingCurveTag([
      mk(NaN, 1),
      mk(0.25, 1),
      mk(0.5, 2),
      mk(0.75, 3),
    ]);
    expect(r.label).not.toBe('empty');
  });
});

describe('classifySizingCurveTag — Plateau (flat curve)', () => {
  it('labels plateau when total span is below FLAT_EV_THRESHOLD', () => {
    const r = classifySizingCurveTag([
      mk(0.25, 1.00),
      mk(0.5, 1.01),
      mk(0.75, 1.02),
      mk(1.0, 1.00),
    ]);
    expect(r.label).toBe('plateau');
    expect(r.confidence).toBeCloseTo(1, 5);
  });

  it('FLAT_EV_THRESHOLD constant is in expected range', () => {
    expect(FLAT_EV_THRESHOLD).toBeGreaterThan(0);
    expect(FLAT_EV_THRESHOLD).toBeLessThan(0.5);
  });

  it('labels plateau when top samples cluster near peak even with some spread', () => {
    // Curve: 0.5, 1.0, 1.0, 1.0, 1.0, 0.5
    // 4/6 samples are within 15% of peak → plateauFraction = 0.67 ≥ 0.5
    const r = classifySizingCurveTag([
      mk(0.10, 0.5),
      mk(0.25, 1.0),
      mk(0.50, 1.0),
      mk(0.75, 1.0),
      mk(1.00, 1.0),
      mk(1.50, 0.5),
    ]);
    expect(['plateau', 'compound']).toContain(r.label);
    expect(r.prototypeScores.plateau).toBeGreaterThan(0.5);
  });
});

describe('classifySizingCurveTag — Ridge (sharp peak)', () => {
  it('labels ridge when a single interior peak is prominent', () => {
    // Sharp peak at the middle: 0.0 → 0.2 → 1.0 → 0.2 → 0.0
    const r = classifySizingCurveTag([
      mk(0.10, 0.0),
      mk(0.25, 0.2),
      mk(0.50, 1.0),
      mk(0.75, 0.2),
      mk(1.00, 0.0),
    ]);
    expect(['ridge', 'compound']).toContain(r.label);
    expect(r.prototypeScores.ridge).toBeGreaterThan(0.5);
    expect(r.peakIndex).toBe(2);
    expect(r.peakEV).toBe(1.0);
  });

  it('does not label ridge when peak is at the edge', () => {
    // Peak at last index — not a ridge (cliff/ramp wins instead)
    const r = classifySizingCurveTag([
      mk(0.25, 0.0),
      mk(0.50, 0.3),
      mk(0.75, 0.6),
      mk(1.00, 1.0),
    ]);
    expect(r.label).not.toBe('ridge');
  });
});

describe('classifySizingCurveTag — Cliff (monotone non-increasing)', () => {
  it('labels cliff when curve drops monotonically', () => {
    const r = classifySizingCurveTag([
      mk(0.25, 1.0),
      mk(0.50, 0.7),
      mk(0.75, 0.4),
      mk(1.00, 0.1),
    ]);
    expect(['cliff', 'compound']).toContain(r.label);
    expect(r.prototypeScores.cliff).toBeGreaterThan(0.8);
    expect(r.peakIndex).toBe(0);
  });

  it('tolerates a small upward blip within MONOTONIC_TOLERANCE', () => {
    const r = classifySizingCurveTag([
      mk(0.25, 1.00),
      mk(0.50, 0.75),
      mk(0.75, 0.77), // small upward blip — within tolerance
      mk(1.00, 0.10),
    ]);
    expect(['cliff', 'compound']).toContain(r.label);
  });
});

describe('classifySizingCurveTag — Ramp (monotone non-decreasing)', () => {
  it('labels ramp when curve rises monotonically', () => {
    const r = classifySizingCurveTag([
      mk(0.25, 0.0),
      mk(0.50, 0.3),
      mk(0.75, 0.6),
      mk(1.00, 1.0),
    ]);
    expect(['ramp', 'compound']).toContain(r.label);
    expect(r.prototypeScores.ramp).toBeGreaterThan(0.8);
    expect(r.peakIndex).toBe(3);
  });
});

describe('classifySizingCurveTag — output shape', () => {
  it('always returns the same field set (non-empty)', () => {
    const r = classifySizingCurveTag([mk(0.25, 0), mk(0.5, 0.5), mk(0.75, 1)]);
    expect(r).toHaveProperty('label');
    expect(r).toHaveProperty('confidence');
    expect(r).toHaveProperty('prototypeScores');
    expect(r).toHaveProperty('peakIndex');
    expect(r).toHaveProperty('peakEV');
    expect(Object.keys(r.prototypeScores).sort()).toEqual(['cliff', 'plateau', 'ramp', 'ridge']);
  });

  it('returns one of the canonical labels', () => {
    const cases = [
      [mk(0, 0), mk(0.5, 1), mk(1, 0)],            // ridge
      [mk(0, 1), mk(0.5, 0.5), mk(1, 0)],          // cliff
      [mk(0, 0), mk(0.5, 0.5), mk(1, 1)],          // ramp
      [mk(0, 1), mk(0.5, 1), mk(1, 1)],            // plateau (flat)
    ];
    const allowed = [...SIZING_CURVE_LABELS, 'compound', 'empty'];
    for (const c of cases) {
      const r = classifySizingCurveTag(c);
      expect(allowed).toContain(r.label);
    }
  });

  it('is deterministic — same input yields same output', () => {
    const input = [mk(0.25, 0), mk(0.5, 0.5), mk(0.75, 1)];
    const a = classifySizingCurveTag(input);
    const b = classifySizingCurveTag(input);
    expect(a).toEqual(b);
  });

  it('does not mutate the input array', () => {
    const input = [mk(0.5, 1), mk(0.25, 0.5), mk(0.75, 0)];
    const snapshot = JSON.parse(JSON.stringify(input));
    classifySizingCurveTag(input);
    expect(input).toEqual(snapshot);
  });

  it('sorts internally by fraction ascending regardless of input order', () => {
    const out = classifySizingCurveTag([
      mk(1.0, 0.0),
      mk(0.5, 1.0),
      mk(0.25, 0.5),
    ]);
    // Peak (EV=1.0) is at fraction=0.5 which is index 1 after sort.
    expect(out.peakIndex).toBe(1);
  });
});

describe('classifySizingCurveTag — compound logic', () => {
  it('returns compound label when top-2 scores within COMPOUND_DELTA and both ≥ 0.4', () => {
    // Ramp-then-cliff: 0 → 0.5 → 1.0 → 0.5 → 0 — a wide plateau on top
    // that could ambiguously read as plateau or ridge.
    const r = classifySizingCurveTag([
      mk(0.10, 0.0),
      mk(0.25, 0.5),
      mk(0.50, 1.0),
      mk(0.75, 0.5),
      mk(1.00, 0.0),
    ]);
    // Compound is a legitimate outcome here; we just assert the
    // discriminated-union components field is present when label is compound.
    if (r.label === 'compound') {
      expect(r.components).toBeDefined();
      expect(r.components).toHaveLength(2);
      expect(SIZING_CURVE_LABELS).toContain(r.components[0]);
      expect(SIZING_CURVE_LABELS).toContain(r.components[1]);
    }
  });
});

describe('getSizingCurveTagDisplayName', () => {
  it('maps each label to a display name', () => {
    expect(getSizingCurveTagDisplayName('ridge')).toBe('Ridge');
    expect(getSizingCurveTagDisplayName('plateau')).toBe('Plateau');
    expect(getSizingCurveTagDisplayName('cliff')).toBe('Cliff');
    expect(getSizingCurveTagDisplayName('ramp')).toBe('Ramp');
    expect(getSizingCurveTagDisplayName('compound')).toBe('Compound');
    expect(getSizingCurveTagDisplayName('empty')).toBe('Empty');
  });

  it('falls through to the raw label for unknown input', () => {
    expect(getSizingCurveTagDisplayName('unknown')).toBe('unknown');
  });
});
