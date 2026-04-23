import { describe, it, expect } from 'vitest';
import {
  createCalibrationAccumulator,
  classifyGap,
  computeTransformScale,
} from '../__backtest__/calibrationAccumulator';

// ───────────────────────────────────────────────────────────────────────────
// classifyGap — calibration ladder thresholds
// ───────────────────────────────────────────────────────────────────────────

describe('classifyGap', () => {
  it('returns no-data for null', () => {
    expect(classifyGap(null)).toBe('no-data');
    expect(classifyGap(undefined)).toBe('no-data');
    expect(classifyGap(NaN)).toBe('no-data');
  });

  it('≤ 0.20 is well-calibrated', () => {
    expect(classifyGap(0)).toBe('well-calibrated');
    expect(classifyGap(0.10)).toBe('well-calibrated');
    expect(classifyGap(0.20)).toBe('well-calibrated');
  });

  it('0.20–0.25 is target-zone', () => {
    expect(classifyGap(0.22)).toBe('target-zone');
    expect(classifyGap(0.25)).toBe('target-zone');
  });

  it('0.25–0.35 is conservative-ceiling', () => {
    expect(classifyGap(0.26)).toBe('conservative-ceiling');
    expect(classifyGap(0.30)).toBe('conservative-ceiling');
    expect(classifyGap(0.35)).toBe('conservative-ceiling');
  });

  it('> 0.35 is expiring', () => {
    expect(classifyGap(0.36)).toBe('expiring');
    expect(classifyGap(0.50)).toBe('expiring');
  });
});

describe('computeTransformScale', () => {
  it('returns 1.0 when gap ≤ conservative-ceiling trigger (0.25)', () => {
    expect(computeTransformScale(null)).toBe(1.0);
    expect(computeTransformScale(0.10)).toBe(1.0);
    expect(computeTransformScale(0.25)).toBe(1.0);
  });

  it('returns 0.6 at retirement trigger (0.35)', () => {
    expect(computeTransformScale(0.35)).toBeCloseTo(0.6, 4);
  });

  it('linearly interpolates between 0.25 and 0.35', () => {
    expect(computeTransformScale(0.30)).toBeCloseTo(0.80, 4);
  });

  it('caps at 0.6 for gap > 0.35', () => {
    expect(computeTransformScale(0.50)).toBe(0.6);
    expect(computeTransformScale(1.0)).toBe(0.6);
  });

  it('monotonic decreasing past trigger', () => {
    expect(computeTransformScale(0.26)).toBeGreaterThan(computeTransformScale(0.30));
    expect(computeTransformScale(0.30)).toBeGreaterThan(computeTransformScale(0.35));
  });
});

// ───────────────────────────────────────────────────────────────────────────
// createCalibrationAccumulator — recording + querying
// ───────────────────────────────────────────────────────────────────────────

describe('createCalibrationAccumulator — basic', () => {
  it('returns empty snapshot for fresh accumulator', () => {
    const acc = createCalibrationAccumulator();
    expect(acc.snapshot()).toEqual([]);
  });

  it('records a single firing and reports in snapshot', () => {
    const acc = createCalibrationAccumulator();
    acc.recordCitedDecision({
      predicateKey: 'foldToRiverBet',
      style: 'Fish',
      street: 'river',
      predictedDividend: 0.50,
      realizedDividend: 0.45,
    });
    const snap = acc.snapshot();
    // Per-slice + pooled-by-style + pooled-by-street + fully-pooled = 4 metrics
    expect(snap.length).toBe(4);
    const sliceMetric = snap.find((m) => m.style === 'Fish' && m.street === 'river');
    expect(sliceMetric.firings).toBe(1);
    expect(sliceMetric.predictedDividendSum).toBeCloseTo(0.50, 4);
    expect(sliceMetric.realizedDividendSum).toBeCloseTo(0.45, 4);
  });

  it('computeCalibrationGap returns no-data before any firings', () => {
    const acc = createCalibrationAccumulator();
    const r = acc.computeCalibrationGap('foldToRiverBet', 'Fish', 'river');
    expect(r.gap).toBeNull();
    expect(r.classification).toBe('no-data');
    expect(r.sufficient).toBe(false);
  });

  it('marks sample as insufficient with < 20 firings', () => {
    const acc = createCalibrationAccumulator();
    for (let i = 0; i < 15; i++) {
      acc.recordCitedDecision({
        predicateKey: 'foldToRiverBet',
        style: 'Fish',
        street: 'river',
        predictedDividend: 0.50,
        realizedDividend: 0.48,
      });
    }
    const r = acc.computeCalibrationGap('foldToRiverBet', 'Fish', 'river');
    expect(r.firings).toBe(15);
    expect(r.sufficient).toBe(false);
    expect(r.gap).not.toBeNull(); // still computable; just not sufficient
  });

  it('marks sample as sufficient at ≥ 20 firings', () => {
    const acc = createCalibrationAccumulator();
    for (let i = 0; i < 25; i++) {
      acc.recordCitedDecision({
        predicateKey: 'foldToRiverBet',
        style: 'Fish',
        street: 'river',
        predictedDividend: 0.50,
        realizedDividend: 0.48,
      });
    }
    const r = acc.computeCalibrationGap('foldToRiverBet', 'Fish', 'river');
    expect(r.sufficient).toBe(true);
    expect(r.gap).toBeCloseTo(0.04, 2); // |0.50 - 0.48| / 0.50 = 0.04
    expect(r.classification).toBe('well-calibrated');
  });

  it('computes gap in target-zone when realized diverges moderately', () => {
    const acc = createCalibrationAccumulator();
    for (let i = 0; i < 25; i++) {
      acc.recordCitedDecision({
        predicateKey: 'foldToRiverBet',
        style: 'Fish',
        street: 'river',
        predictedDividend: 1.00,
        realizedDividend: 0.78, // gap = 0.22 → target-zone
      });
    }
    const r = acc.computeCalibrationGap('foldToRiverBet', 'Fish', 'river');
    expect(r.gap).toBeCloseTo(0.22, 2);
    expect(r.classification).toBe('target-zone');
  });

  it('tracks overrides separately from firings', () => {
    const acc = createCalibrationAccumulator();
    acc.recordCitedDecision({
      predicateKey: 'foldToRiverBet', style: 'Fish', street: 'river',
      predictedDividend: 0.5, realizedDividend: 0.5, wasOverride: true,
    });
    acc.recordCitedDecision({
      predicateKey: 'foldToRiverBet', style: 'Fish', street: 'river',
      predictedDividend: 0.5, realizedDividend: 0.5, wasOverride: false,
    });
    const m = acc.snapshot().find((x) => x.style === 'Fish' && x.street === 'river');
    expect(m.firings).toBe(2);
    expect(m.overrides).toBe(1);
  });
});

describe('createCalibrationAccumulator — pooling (calibration.md §5.3)', () => {
  it('pooled-by-style metric accrues across streets', () => {
    const acc = createCalibrationAccumulator();
    acc.recordCitedDecision({
      predicateKey: 'foldToRiverBet', style: 'Fish', street: 'river',
      predictedDividend: 0.5, realizedDividend: 0.5,
    });
    acc.recordCitedDecision({
      predicateKey: 'foldToRiverBet', style: 'Fish', street: 'turn',
      predictedDividend: 0.4, realizedDividend: 0.4,
    });
    const pooledByStyle = acc.snapshot().find((m) => m.style === 'Fish' && m.street === 'ALL');
    expect(pooledByStyle.firings).toBe(2);
    expect(pooledByStyle.predictedDividendSum).toBeCloseTo(0.9, 4);
  });

  it('pooled-by-street metric accrues across styles', () => {
    const acc = createCalibrationAccumulator();
    acc.recordCitedDecision({
      predicateKey: 'foldToRiverBet', style: 'Fish', street: 'river',
      predictedDividend: 0.5, realizedDividend: 0.5,
    });
    acc.recordCitedDecision({
      predicateKey: 'foldToRiverBet', style: 'Nit', street: 'river',
      predictedDividend: 0.3, realizedDividend: 0.3,
    });
    const pooledByStreet = acc.snapshot().find((m) => m.style === 'ALL' && m.street === 'river');
    expect(pooledByStreet.firings).toBe(2);
  });

  it('fully-pooled metric sums across all axes', () => {
    const acc = createCalibrationAccumulator();
    acc.recordCitedDecision({
      predicateKey: 'foldToRiverBet', style: 'Fish', street: 'river',
      predictedDividend: 0.5, realizedDividend: 0.5,
    });
    acc.recordCitedDecision({
      predicateKey: 'foldToRiverBet', style: 'Nit', street: 'turn',
      predictedDividend: 0.3, realizedDividend: 0.3,
    });
    const fullyPooled = acc.snapshot().find((m) => m.style === 'ALL' && m.street === 'ALL');
    expect(fullyPooled.firings).toBe(2);
  });
});

describe('createCalibrationAccumulator — retirement ladder', () => {
  it('does not retire without consecutive sessions over trigger', () => {
    const acc = createCalibrationAccumulator();
    // Record 20 firings with gap = 0.40 → classification 'expiring'
    for (let i = 0; i < 25; i++) {
      acc.recordCitedDecision({
        predicateKey: 'foldToRiverBet', style: 'Fish', street: 'river',
        predictedDividend: 1.0, realizedDividend: 0.60, // gap 0.40
      });
    }
    acc.recordSessionClose('foldToRiverBet', 'Fish', 'river');
    expect(acc.checkRetirementLadder('foldToRiverBet', 'Fish', 'river')).toBe('expiring');
  });

  it('retires after 10 consecutive sessions over retirement trigger', () => {
    const acc = createCalibrationAccumulator();
    for (let i = 0; i < 25; i++) {
      acc.recordCitedDecision({
        predicateKey: 'foldToRiverBet', style: 'Fish', street: 'river',
        predictedDividend: 1.0, realizedDividend: 0.60,
      });
    }
    for (let session = 0; session < 10; session++) {
      acc.recordSessionClose('foldToRiverBet', 'Fish', 'river');
    }
    expect(acc.checkRetirementLadder('foldToRiverBet', 'Fish', 'river')).toBe('retire');
  });

  it('resets consecutive counter when gap comes back into range', () => {
    const acc = createCalibrationAccumulator();
    for (let i = 0; i < 25; i++) {
      acc.recordCitedDecision({
        predicateKey: 'foldToRiverBet', style: 'Fish', street: 'river',
        predictedDividend: 1.0, realizedDividend: 0.60, // gap 0.40
      });
    }
    // 5 bad sessions
    for (let s = 0; s < 5; s++) acc.recordSessionClose('foldToRiverBet', 'Fish', 'river');
    // Add calibrating firings
    for (let i = 0; i < 20; i++) {
      acc.recordCitedDecision({
        predicateKey: 'foldToRiverBet', style: 'Fish', street: 'river',
        predictedDividend: 1.0, realizedDividend: 0.95, // well-calibrated
      });
    }
    acc.recordSessionClose('foldToRiverBet', 'Fish', 'river');
    // counter should have reset; checkRetirementLadder not 'retire'
    expect(acc.checkRetirementLadder('foldToRiverBet', 'Fish', 'river')).not.toBe('retire');
  });
});

describe('createCalibrationAccumulator — robustness', () => {
  it('ignores malformed firing', () => {
    const acc = createCalibrationAccumulator();
    acc.recordCitedDecision(null);
    acc.recordCitedDecision({ predicateKey: 'foldToRiverBet' }); // missing dividend
    acc.recordCitedDecision({ predictedDividend: NaN, realizedDividend: 0 });
    expect(acc.snapshot()).toEqual([]);
  });

  it('reset clears a specific slice', () => {
    const acc = createCalibrationAccumulator();
    acc.recordCitedDecision({
      predicateKey: 'x', style: 'Fish', street: 'river',
      predictedDividend: 1, realizedDividend: 1,
    });
    acc.reset('x', 'Fish', 'river');
    // Per-slice gone; pooled slices remain
    expect(acc.snapshot().find((m) => m.style === 'Fish' && m.street === 'river')).toBeUndefined();
  });

  it('reset with no args clears everything', () => {
    const acc = createCalibrationAccumulator();
    acc.recordCitedDecision({
      predicateKey: 'x', style: 'Fish', street: 'river',
      predictedDividend: 1, realizedDividend: 1,
    });
    acc.reset();
    expect(acc.snapshot()).toEqual([]);
  });
});
