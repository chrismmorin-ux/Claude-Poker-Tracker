/**
 * anchorCalibrationSelectors.test.js — calibration rollup invariants for the
 * Calibration Dashboard study surface (WS-169 / SPR-066).
 *
 * Pins:
 *   - AP-08 origin-separation invariant (matcher-system + owner-captured arrays
 *     are always returned separately; aggregates never blended)
 *   - Sample-size thresholds (MIN_SPARKLINE_SAMPLE_SIZE, MIN_TREND_SAMPLE_SIZE)
 *   - Trend status math (collecting-data / stable / improving / drifting)
 *   - Sparkline cumulative-rate math
 *   - predictionInCi well-calibrated flag
 *   - Primitive-validity invalidation flagging
 */

import { describe, it, expect } from 'vitest';
import {
  selectAnchorCalibration,
  selectAllAnchorCalibrations,
  selectPrimitiveValidity,
  selectAllPrimitiveValidities,
  MIN_SPARKLINE_SAMPLE_SIZE,
  MIN_TREND_SAMPLE_SIZE,
  TREND_RECENT_WINDOW,
  TREND_STABILITY_BAND,
  PRIMITIVE_LOAD_BEARING_THRESHOLD,
} from '../anchorCalibrationSelectors';
import { OBSERVATION_ORIGINS } from '../../../constants/anchorLibraryConstants';

// ───────────────────────────────────────────────────────────────────────────
// Builders
// ───────────────────────────────────────────────────────────────────────────

const buildAnchor = (overrides = {}) => ({
  id: 'eal:test-anchor-1',
  archetypeName: 'Test Anchor',
  status: 'active',
  evidence: {
    sampleSize: 34,
    pointEstimate: 0.74,
    credibleInterval: { lower: 0.62, upper: 0.84, level: 0.95 },
  },
  gtoBaseline: {
    method: 'MDF',
    referenceRate: 0.68,
  },
  ...overrides,
});

const buildMatcherObs = (anchorId, idx, supportsClaim = true) => ({
  id: `obs:${anchorId}:matcher:${idx}`,
  anchorId,
  origin: OBSERVATION_ORIGINS.MATCHER_SYSTEM,
  supportsClaim,
  createdAt: new Date(Date.parse('2026-05-01T00:00:00Z') + idx * 60_000).toISOString(),
});

const buildOwnerObs = (anchorId, idx) => ({
  id: `obs:${anchorId}:owner:${idx}`,
  anchorId,
  origin: OBSERVATION_ORIGINS.OWNER_CAPTURED,
  ownerTags: [{ kind: 'fixed', value: 'mistake' }],
  createdAt: new Date(Date.parse('2026-05-01T00:00:00Z') + idx * 60_000).toISOString(),
});

const buildPrimitive = (overrides = {}) => ({
  id: 'PP-01',
  name: 'Test Primitive',
  validityScore: {
    pointEstimate: 0.78,
    sampleSize: 30,
    credibleInterval: { lower: 0.62, upper: 0.91, level: 0.95 },
    dependentAnchorCount: 3,
  },
  ...overrides,
});

// ───────────────────────────────────────────────────────────────────────────
// selectAnchorCalibration — input validation + basic shape
// ───────────────────────────────────────────────────────────────────────────

describe('selectAnchorCalibration — invalid input', () => {
  it('returns null for null', () => {
    expect(selectAnchorCalibration(null)).toBeNull();
  });
  it('returns null for non-object', () => {
    expect(selectAnchorCalibration('string')).toBeNull();
    expect(selectAnchorCalibration(42)).toBeNull();
  });
  it('returns null when anchor missing id', () => {
    expect(selectAnchorCalibration({ archetypeName: 'No-id' })).toBeNull();
  });
  it('tolerates missing evidence and gtoBaseline', () => {
    const result = selectAnchorCalibration({ id: 'a:1', archetypeName: 'A1' });
    expect(result).not.toBeNull();
    expect(result.predictedRate).toBeNull();
    expect(result.observedRate).toBeNull();
    expect(result.credibleInterval).toBeNull();
    expect(result.delta).toBeNull();
    expect(result.predictionInCi).toBe(false);
  });
  it('tolerates non-array observations', () => {
    const result = selectAnchorCalibration(buildAnchor(), null);
    expect(result.matcherFired).toEqual([]);
    expect(result.ownerCaptured).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// AP-08 INVARIANT — load-bearing tests
// ───────────────────────────────────────────────────────────────────────────

describe('AP-08 origin-separation invariant', () => {
  it('returns matcher-system + owner-captured in separate arrays', () => {
    const anchor = buildAnchor();
    const observations = [
      buildMatcherObs('eal:test-anchor-1', 0, true),
      buildOwnerObs('eal:test-anchor-1', 1),
      buildMatcherObs('eal:test-anchor-1', 2, false),
      buildOwnerObs('eal:test-anchor-1', 3),
    ];
    const result = selectAnchorCalibration(anchor, observations);

    expect(result.matcherFired).toHaveLength(2);
    expect(result.ownerCaptured).toHaveLength(2);
    expect(result.matcherFired.every((o) => o.origin === OBSERVATION_ORIGINS.MATCHER_SYSTEM)).toBe(true);
    expect(result.ownerCaptured.every((o) => o.origin === OBSERVATION_ORIGINS.OWNER_CAPTURED)).toBe(true);
  });

  it('returns separate count aggregates that never sum into a unified count', () => {
    const anchor = buildAnchor();
    const observations = [
      buildMatcherObs('eal:test-anchor-1', 0),
      buildMatcherObs('eal:test-anchor-1', 1),
      buildOwnerObs('eal:test-anchor-1', 2),
    ];
    const result = selectAnchorCalibration(anchor, observations);

    // Per-origin counts are exposed; selector NEVER returns a blended count.
    expect(result.sampleSizeMatcher).toBe(2);
    expect(result.sampleSizeOwner).toBe(1);

    // Critical AP-08 pin: result has NO field that sums or blends the two origins.
    // If a future schema-change adds a "totalEvidenceCount" or similar, this test
    // catches it and forces the change to be reviewed (the right answer is to keep
    // the split; per-origin matters for AP-08 transparency).
    const blendedFieldNames = [
      'totalObservationCount',
      'totalEvidenceCount',
      'totalSampleSize',
      'observationCount',
      'evidenceCount',
      'sampleSizeBlended',
      'sampleSizeTotal',
    ];
    for (const name of blendedFieldNames) {
      expect(result).not.toHaveProperty(name);
    }
  });

  it('drops observations with unknown origin (forward-compat)', () => {
    const anchor = buildAnchor();
    const observations = [
      buildMatcherObs('eal:test-anchor-1', 0),
      { id: 'obs:weird', anchorId: 'eal:test-anchor-1', origin: 'unknown-future-origin', createdAt: new Date().toISOString() },
    ];
    const result = selectAnchorCalibration(anchor, observations);

    expect(result.sampleSizeMatcher).toBe(1);
    expect(result.sampleSizeOwner).toBe(0);
  });

  it('does not pull observations belonging to other anchors', () => {
    const anchor = buildAnchor({ id: 'eal:anchor-A' });
    const observations = [
      buildMatcherObs('eal:anchor-A', 0),
      buildMatcherObs('eal:anchor-B', 1), // different anchor
      buildOwnerObs('eal:anchor-A', 2),
    ];
    const result = selectAnchorCalibration(anchor, observations);

    expect(result.sampleSizeMatcher).toBe(1);
    expect(result.sampleSizeOwner).toBe(1);
    expect(result.matcherFired.every((o) => o.anchorId === 'eal:anchor-A')).toBe(true);
    expect(result.ownerCaptured.every((o) => o.anchorId === 'eal:anchor-A')).toBe(true);
  });

  it('AP-08 forbidden-property pin enforces no blending field surface', () => {
    // This is the load-bearing AP-08 contract test: the selector's return shape
    // is reviewed at every change. If anyone proposes adding a "evidenceTotal"
    // or "blendedCount" field, this test will fail and force a Gate-level review.
    const result = selectAnchorCalibration(buildAnchor(), [buildMatcherObs('eal:test-anchor-1', 0)]);
    const keys = Object.keys(result);
    for (const k of keys) {
      expect(/^(total|blended|combined|fused|all)/i.test(k)).toBe(false);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Predicted rate / observed rate / delta / predictionInCi
// ───────────────────────────────────────────────────────────────────────────

describe('rate fields + predictionInCi', () => {
  it('extracts predictedRate from gtoBaseline.referenceRate', () => {
    const anchor = buildAnchor({ gtoBaseline: { method: 'MDF', referenceRate: 0.55 } });
    expect(selectAnchorCalibration(anchor).predictedRate).toBe(0.55);
  });

  it('extracts observedRate from evidence.pointEstimate', () => {
    const anchor = buildAnchor({ evidence: { ...buildAnchor().evidence, pointEstimate: 0.61 } });
    expect(selectAnchorCalibration(anchor).observedRate).toBe(0.61);
  });

  it('computes delta = observedRate − predictedRate', () => {
    const anchor = buildAnchor({
      gtoBaseline: { method: 'MDF', referenceRate: 0.50 },
      evidence: { ...buildAnchor().evidence, pointEstimate: 0.62 },
    });
    const result = selectAnchorCalibration(anchor);
    expect(result.delta).toBeCloseTo(0.12, 5);
  });

  it('predictionInCi=true when predicted rate falls inside credible interval', () => {
    const anchor = buildAnchor({
      gtoBaseline: { method: 'MDF', referenceRate: 0.70 },
      evidence: {
        sampleSize: 34,
        pointEstimate: 0.74,
        credibleInterval: { lower: 0.62, upper: 0.84, level: 0.95 },
      },
    });
    expect(selectAnchorCalibration(anchor).predictionInCi).toBe(true);
  });

  it('predictionInCi=false when predicted rate is outside credible interval', () => {
    const anchor = buildAnchor({
      gtoBaseline: { method: 'MDF', referenceRate: 0.45 },
      evidence: {
        sampleSize: 34,
        pointEstimate: 0.74,
        credibleInterval: { lower: 0.62, upper: 0.84, level: 0.95 },
      },
    });
    expect(selectAnchorCalibration(anchor).predictionInCi).toBe(false);
  });

  it('predictionInCi=true at exact CI boundaries (inclusive)', () => {
    const anchor = buildAnchor({
      gtoBaseline: { method: 'MDF', referenceRate: 0.62 },
      evidence: { sampleSize: 34, pointEstimate: 0.74, credibleInterval: { lower: 0.62, upper: 0.84, level: 0.95 } },
    });
    expect(selectAnchorCalibration(anchor).predictionInCi).toBe(true);
  });

  it('falls back to evidence.observationCount when sampleSize missing', () => {
    const anchor = buildAnchor({
      evidence: { observationCount: 21, pointEstimate: 0.74, credibleInterval: { lower: 0.6, upper: 0.85, level: 0.95 } },
    });
    expect(selectAnchorCalibration(anchor).sampleSize).toBe(21);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Trend computation
// ───────────────────────────────────────────────────────────────────────────

describe('trend computation', () => {
  it('returns "collecting-data" when sampleSize < MIN_TREND_SAMPLE_SIZE', () => {
    const anchor = buildAnchor({ evidence: { sampleSize: MIN_TREND_SAMPLE_SIZE - 1, pointEstimate: 0.7, credibleInterval: { lower: 0.5, upper: 0.85, level: 0.95 } } });
    expect(selectAnchorCalibration(anchor).trend.status).toBe('collecting-data');
  });

  it('returns "collecting-data" when observedRate is null', () => {
    const anchor = buildAnchor({ evidence: { sampleSize: 50 } });
    expect(selectAnchorCalibration(anchor).trend.status).toBe('collecting-data');
  });

  it('returns "stable" when fewer than recent-window matcher firings stored', () => {
    // sampleSize=30 (≥ 10 threshold), but only 5 matcher firings stored
    // (e.g., seed-villain prior carries the rate; matcher hasn't accumulated).
    const anchor = buildAnchor();
    const observations = Array.from({ length: 5 }, (_, i) => buildMatcherObs('eal:test-anchor-1', i, true));
    const result = selectAnchorCalibration(anchor, observations);
    expect(result.trend.status).toBe('stable');
  });

  it('returns "stable" when recent-window rate is within ±band of overall', () => {
    // overall pointEstimate = 0.70; build 10 firings with 7 supporting → recent rate = 0.70 (exact match)
    const anchor = buildAnchor({
      evidence: { sampleSize: 30, pointEstimate: 0.70, credibleInterval: { lower: 0.55, upper: 0.85, level: 0.95 } },
    });
    const observations = Array.from({ length: TREND_RECENT_WINDOW }, (_, i) => buildMatcherObs('eal:test-anchor-1', i, i < 7));
    const result = selectAnchorCalibration(anchor, observations);
    expect(result.trend.status).toBe('stable');
    expect(result.trend.recentRate).toBeCloseTo(0.7, 5);
  });

  it('returns "improving" when recent rate exceeds overall by more than the band', () => {
    // overall 0.50, recent window 0.90 → drift +0.40, way beyond ±0.05 band
    const anchor = buildAnchor({
      evidence: { sampleSize: 30, pointEstimate: 0.50, credibleInterval: { lower: 0.35, upper: 0.65, level: 0.95 } },
    });
    const observations = Array.from({ length: TREND_RECENT_WINDOW }, (_, i) => buildMatcherObs('eal:test-anchor-1', i, i < 9));
    const result = selectAnchorCalibration(anchor, observations);
    expect(result.trend.status).toBe('improving');
    expect(result.trend.recentRate).toBeCloseTo(0.9, 5);
  });

  it('returns "drifting" when recent rate falls below overall by more than the band', () => {
    // overall 0.80, recent window 0.30 → drift −0.50
    const anchor = buildAnchor({
      evidence: { sampleSize: 30, pointEstimate: 0.80, credibleInterval: { lower: 0.65, upper: 0.95, level: 0.95 } },
    });
    const observations = Array.from({ length: TREND_RECENT_WINDOW }, (_, i) => buildMatcherObs('eal:test-anchor-1', i, i < 3));
    const result = selectAnchorCalibration(anchor, observations);
    expect(result.trend.status).toBe('drifting');
    expect(result.trend.recentRate).toBeCloseTo(0.3, 5);
  });

  it('only considers the most recent TREND_RECENT_WINDOW firings', () => {
    // 30 firings: first 20 not supporting (rate 0), last 10 supporting (rate 1)
    // overall pointEstimate 0.5 (matches the seed). Recent window rate = 1.0.
    const anchor = buildAnchor({
      evidence: { sampleSize: 30, pointEstimate: 0.50, credibleInterval: { lower: 0.35, upper: 0.65, level: 0.95 } },
    });
    const observations = Array.from({ length: 30 }, (_, i) => buildMatcherObs('eal:test-anchor-1', i, i >= 20));
    const result = selectAnchorCalibration(anchor, observations);
    // Recent rate should be 10/10 = 1.0 (only last 10 considered)
    expect(result.trend.recentRate).toBeCloseTo(1.0, 5);
    expect(result.trend.status).toBe('improving');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Sparkline computation
// ───────────────────────────────────────────────────────────────────────────

describe('sparkline computation', () => {
  it('returns "insufficient-data" when matcherFired.length < MIN_SPARKLINE_SAMPLE_SIZE', () => {
    const anchor = buildAnchor();
    const observations = Array.from({ length: MIN_SPARKLINE_SAMPLE_SIZE - 1 }, (_, i) =>
      buildMatcherObs('eal:test-anchor-1', i, true));
    const result = selectAnchorCalibration(anchor, observations);
    expect(result.sparkline.status).toBe('insufficient-data');
    expect(result.sparkline.points).toEqual([]);
  });

  it('returns "available" with cumulative-rate points when ≥ MIN', () => {
    const anchor = buildAnchor();
    const observations = [
      buildMatcherObs('eal:test-anchor-1', 0, true),  // 1/1 = 1.0
      buildMatcherObs('eal:test-anchor-1', 1, true),  // 2/2 = 1.0
      buildMatcherObs('eal:test-anchor-1', 2, false), // 2/3 ≈ 0.667
      buildMatcherObs('eal:test-anchor-1', 3, true),  // 3/4 = 0.75
      buildMatcherObs('eal:test-anchor-1', 4, false), // 3/5 = 0.6
    ];
    const result = selectAnchorCalibration(anchor, observations);
    expect(result.sparkline.status).toBe('available');
    expect(result.sparkline.points).toHaveLength(5);
    expect(result.sparkline.points[0]).toBeCloseTo(1.0, 5);
    expect(result.sparkline.points[1]).toBeCloseTo(1.0, 5);
    expect(result.sparkline.points[2]).toBeCloseTo(2 / 3, 5);
    expect(result.sparkline.points[3]).toBeCloseTo(0.75, 5);
    expect(result.sparkline.points[4]).toBeCloseTo(0.6, 5);
  });

  it('treats missing supportsClaim as non-supporting (conservative)', () => {
    const anchor = buildAnchor();
    const observations = [
      buildMatcherObs('eal:test-anchor-1', 0, true),
      { id: 'obs:no-support-flag', anchorId: 'eal:test-anchor-1', origin: OBSERVATION_ORIGINS.MATCHER_SYSTEM, createdAt: '2026-05-01T00:01:00Z' }, // no supportsClaim
      buildMatcherObs('eal:test-anchor-1', 2, true),
      buildMatcherObs('eal:test-anchor-1', 3, true),
      buildMatcherObs('eal:test-anchor-1', 4, true),
    ];
    const result = selectAnchorCalibration(anchor, observations);
    // 1/1, 1/2, 2/3, 3/4, 4/5
    expect(result.sparkline.points[0]).toBeCloseTo(1.0, 5);
    expect(result.sparkline.points[1]).toBeCloseTo(0.5, 5);
    expect(result.sparkline.points[2]).toBeCloseTo(2 / 3, 5);
    expect(result.sparkline.points[3]).toBeCloseTo(0.75, 5);
    expect(result.sparkline.points[4]).toBeCloseTo(0.8, 5);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Sorting
// ───────────────────────────────────────────────────────────────────────────

describe('chronological sort by createdAt', () => {
  it('sorts matcher firings ascending by createdAt regardless of input order', () => {
    const anchor = buildAnchor();
    const observations = [
      { id: 'a:3', anchorId: 'eal:test-anchor-1', origin: OBSERVATION_ORIGINS.MATCHER_SYSTEM, createdAt: '2026-05-03T00:00:00Z', supportsClaim: true },
      { id: 'a:1', anchorId: 'eal:test-anchor-1', origin: OBSERVATION_ORIGINS.MATCHER_SYSTEM, createdAt: '2026-05-01T00:00:00Z', supportsClaim: true },
      { id: 'a:2', anchorId: 'eal:test-anchor-1', origin: OBSERVATION_ORIGINS.MATCHER_SYSTEM, createdAt: '2026-05-02T00:00:00Z', supportsClaim: true },
    ];
    const result = selectAnchorCalibration(anchor, observations);
    expect(result.matcherFired.map((o) => o.id)).toEqual(['a:1', 'a:2', 'a:3']);
  });

  it('sorts owner-captured ascending by createdAt independently from matcher', () => {
    const anchor = buildAnchor();
    const observations = [
      { id: 'b:3', anchorId: 'eal:test-anchor-1', origin: OBSERVATION_ORIGINS.OWNER_CAPTURED, createdAt: '2026-05-03T00:00:00Z' },
      { id: 'b:1', anchorId: 'eal:test-anchor-1', origin: OBSERVATION_ORIGINS.OWNER_CAPTURED, createdAt: '2026-05-01T00:00:00Z' },
    ];
    const result = selectAnchorCalibration(anchor, observations);
    expect(result.ownerCaptured.map((o) => o.id)).toEqual(['b:1', 'b:3']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// selectAllAnchorCalibrations
// ───────────────────────────────────────────────────────────────────────────

describe('selectAllAnchorCalibrations', () => {
  it('returns empty array for non-array input', () => {
    expect(selectAllAnchorCalibrations(null)).toEqual([]);
    expect(selectAllAnchorCalibrations(undefined)).toEqual([]);
    expect(selectAllAnchorCalibrations('not-an-array')).toEqual([]);
  });

  it('maps each anchor to a calibration row', () => {
    const anchors = [
      buildAnchor({ id: 'a:1', archetypeName: 'A1' }),
      buildAnchor({ id: 'a:2', archetypeName: 'A2' }),
    ];
    const result = selectAllAnchorCalibrations(anchors, []);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.anchorId)).toEqual(['a:1', 'a:2']);
  });

  it('drops invalid anchors', () => {
    const anchors = [
      buildAnchor({ id: 'a:1' }),
      null,
      { archetypeName: 'no-id' },
      buildAnchor({ id: 'a:2' }),
    ];
    const result = selectAllAnchorCalibrations(anchors);
    expect(result).toHaveLength(2);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Primitive validity
// ───────────────────────────────────────────────────────────────────────────

describe('selectPrimitiveValidity', () => {
  it('returns null for invalid primitive', () => {
    expect(selectPrimitiveValidity(null)).toBeNull();
    expect(selectPrimitiveValidity({ name: 'no-id' })).toBeNull();
  });

  it('extracts posterior + CI + dependentAnchorCount', () => {
    const result = selectPrimitiveValidity(buildPrimitive());
    expect(result.primitiveId).toBe('PP-01');
    expect(result.posterior).toBe(0.78);
    expect(result.credibleInterval).toEqual({ lower: 0.62, upper: 0.91, level: 0.95 });
    expect(result.dependentAnchorCount).toBe(3);
  });

  it('flags status="load-bearing" when CI lower ≥ threshold', () => {
    const p = buildPrimitive({ validityScore: { pointEstimate: 0.70, credibleInterval: { lower: 0.55, upper: 0.85, level: 0.95 }, dependentAnchorCount: 2 } });
    const result = selectPrimitiveValidity(p);
    expect(result.status).toBe('load-bearing');
    expect(result.isInvalidated).toBe(false);
  });

  it('flags status="at-risk" when CI spans threshold', () => {
    const p = buildPrimitive({ validityScore: { pointEstimate: 0.50, credibleInterval: { lower: 0.30, upper: 0.70, level: 0.95 }, dependentAnchorCount: 2 } });
    const result = selectPrimitiveValidity(p);
    expect(result.status).toBe('at-risk');
    expect(result.isInvalidated).toBe(false);
  });

  it('flags status="invalidated" when CI upper < threshold', () => {
    const p = buildPrimitive({ validityScore: { pointEstimate: 0.20, credibleInterval: { lower: 0.10, upper: 0.40, level: 0.95 }, dependentAnchorCount: 2 } });
    const result = selectPrimitiveValidity(p);
    expect(result.status).toBe('invalidated');
    expect(result.isInvalidated).toBe(true);
  });

  it('threshold is exposed via PRIMITIVE_LOAD_BEARING_THRESHOLD', () => {
    expect(PRIMITIVE_LOAD_BEARING_THRESHOLD).toBe(0.5);
  });

  it('defaults dependentAnchorCount to 0 when missing', () => {
    const p = buildPrimitive({ validityScore: { pointEstimate: 0.7, credibleInterval: { lower: 0.55, upper: 0.85, level: 0.95 } } });
    expect(selectPrimitiveValidity(p).dependentAnchorCount).toBe(0);
  });
});

describe('selectAllPrimitiveValidities', () => {
  it('returns empty array for non-array input', () => {
    expect(selectAllPrimitiveValidities(null)).toEqual([]);
  });

  it('maps each primitive to a row, drops invalid', () => {
    const primitives = [
      buildPrimitive({ id: 'PP-01' }),
      null,
      buildPrimitive({ id: 'PP-02' }),
    ];
    const result = selectAllPrimitiveValidities(primitives);
    expect(result.map((r) => r.primitiveId)).toEqual(['PP-01', 'PP-02']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Constants / re-exports
// ───────────────────────────────────────────────────────────────────────────

describe('exposed thresholds', () => {
  it('MIN_SPARKLINE_SAMPLE_SIZE = 5 per Gate 4 spec line 317', () => {
    expect(MIN_SPARKLINE_SAMPLE_SIZE).toBe(5);
  });
  it('MIN_TREND_SAMPLE_SIZE = 10 per Gate 4 spec line 318', () => {
    expect(MIN_TREND_SAMPLE_SIZE).toBe(10);
  });
  it('TREND_RECENT_WINDOW = 10', () => {
    expect(TREND_RECENT_WINDOW).toBe(10);
  });
  it('TREND_STABILITY_BAND = 0.05', () => {
    expect(TREND_STABILITY_BAND).toBe(0.05);
  });
});
