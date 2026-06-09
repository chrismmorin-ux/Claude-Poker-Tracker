/**
 * @file Tests for leakRules/heroPfOpenOverfold.js — FIRST under-frequency
 * decision-bucket leak rule. SPR-109 / WS-146 sixth claim (resolves the
 * SPR-046 deferral). Polarity is inverted vs the barrel/multiway rules: a LOW
 * open frequency is the leak.
 */

import { describe, it, expect } from 'vitest';
import { rule } from '../leakRules/heroPfOpenOverfold.js';

const LATE_KEY = 'preflop:rfi-decision:LATE';

// LATE RFI baseline ~26%.
const baselineLate = { baseline: 0.26, source: 'hardcoded', confidence: 0.75, lastValidatedAt: '2026-06-06' };

const buildBucket = (overrides = {}) => ({
  situationKey: LATE_KEY,
  aggressCount: 0,
  passCount: 0,
  sampleSize: 0,
  aggressFrequency: 0,
  aggressFrequencyCI: { lower: 0, upper: 0, mean: 0 },
  ...overrides,
});

// ─── Rule signature compliance ───────────────────────────────────────────

describe('hero-pf-open-overfold rule signature', () => {
  it('exports a rule object with required fields', () => {
    expect(rule.id).toBe('hero-pf-open-overfold');
    expect(rule.label).toMatch(/[Oo]pen/);
    expect(rule.relatedConceptId).toBe('rfi-discipline-cluster');
    expect(rule.threshold.minSampleSize).toBe(30);
    expect(rule.threshold.minSeverity).toBeGreaterThan(0);
    expect(typeof rule.matchesBucket).toBe('function');
    expect(typeof rule.detect).toBe('function');
    expect(typeof rule.solverBaselineKey).toBe('function');
  });

  it('declares bucketType "decision"', () => {
    expect(rule.bucketType).toBe('decision');
  });
});

// ─── matchesBucket ───────────────────────────────────────────────────────

describe('matchesBucket', () => {
  it('matches every RFI decision bucket (one per open position)', () => {
    expect(rule.matchesBucket('preflop:rfi-decision:EARLY')).toBe(true);
    expect(rule.matchesBucket('preflop:rfi-decision:MIDDLE')).toBe(true);
    expect(rule.matchesBucket('preflop:rfi-decision:LATE')).toBe(true);
    expect(rule.matchesBucket('preflop:rfi-decision:BUTTON')).toBe(true);
  });

  it('does NOT match cbet/barrel decision buckets', () => {
    expect(rule.matchesBucket('flop:cbet-decision:mw')).toBe(false);
    expect(rule.matchesBucket('turn:barrel-decision:hu')).toBe(false);
  });

  it('does NOT match any 8-axis action key', () => {
    expect(rule.matchesBucket('preflop:none:BUTTON:agg:ip:none:open:na')).toBe(false);
  });

  it('returns false for malformed keys', () => {
    expect(rule.matchesBucket(null)).toBe(false);
    expect(rule.matchesBucket('')).toBe(false);
  });

  it('solverBaselineKey is identity (per-position baseline lookup)', () => {
    expect(rule.solverBaselineKey('preflop:rfi-decision:BUTTON')).toBe('preflop:rfi-decision:BUTTON');
  });
});

// ─── detect — gating logic ───────────────────────────────────────────────

describe('detect — gating logic', () => {
  it('returns null when baseline is missing', () => {
    const bucket = buildBucket({ aggressCount: 5, passCount: 75, sampleSize: 80, aggressFrequency: 0.0625 });
    expect(rule.detect(bucket, null)).toBeNull();
  });

  it('returns null when sampleSize < 30 (AP-SCF-04 floor)', () => {
    const bucket = buildBucket({
      aggressCount: 2,
      passCount: 27,
      sampleSize: 29,
      aggressFrequency: 2 / 29,
      aggressFrequencyCI: { lower: 0.01, upper: 0.22, mean: 2 / 29 },
    });
    expect(rule.detect(bucket, baselineLate)).toBeNull();
  });

  it('returns null when under-open delta < 5pp threshold (within noise)', () => {
    // open freq 23%, baseline 26% → delta 3pp under, below threshold
    const bucket = buildBucket({
      aggressCount: 18,
      passCount: 62,
      sampleSize: 80,
      aggressFrequency: 0.23,
      aggressFrequencyCI: { lower: 0.15, upper: 0.33, mean: 0.23 },
    });
    expect(rule.detect(bucket, baselineLate)).toBeNull();
  });

  it('returns null when CI upper bound does NOT fall below baseline (noisy data)', () => {
    // open freq 18% (delta 8pp under) but CI upper 0.30 >= baseline 0.26
    const bucket = buildBucket({
      aggressCount: 14,
      passCount: 66,
      sampleSize: 80,
      aggressFrequency: 0.18,
      aggressFrequencyCI: { lower: 0.10, upper: 0.30, mean: 0.18 },
    });
    expect(rule.detect(bucket, baselineLate)).toBeNull();
  });

  it('does NOT fire when hero opens AT or ABOVE baseline (wrong direction)', () => {
    // open freq 32% > baseline 26% — this is over-opening, a different rule
    const bucket = buildBucket({
      aggressCount: 32,
      passCount: 68,
      sampleSize: 100,
      aggressFrequency: 0.32,
      aggressFrequencyCI: { lower: 0.24, upper: 0.41, mean: 0.32 },
    });
    expect(rule.detect(bucket, baselineLate)).toBeNull();
  });
});

// ─── detect — fires correctly (UNDER-frequency polarity) ─────────────────

describe('detect — fires when under-opening is real + significant', () => {
  const underBucket = () => buildBucket({
    // open freq 8% — far below the 26% LATE reference; CI [3%, 15%] all under
    aggressCount: 8,
    passCount: 92,
    sampleSize: 100,
    aggressFrequency: 0.08,
    aggressFrequencyCI: { lower: 0.03, upper: 0.15, mean: 0.08 },
  });

  it('fires when open frequency falls below baseline + delta AND CI agrees', () => {
    const leak = rule.detect(underBucket(), baselineLate);
    expect(leak).not.toBeNull();
    expect(leak.leakRuleId).toBe('hero-pf-open-overfold');
    expect(leak.observedRate).toBe(0.08);
    expect(leak.solverBaseline).toBe(0.26);
    expect(leak.sampleSize).toBe(100);
    expect(leak.severity).toBeGreaterThan(0);
    // delta is measured as baseline − observed (positive when under-opening)
    expect(leak.evidence.delta).toBeCloseTo(0.18, 2);
    expect(leak.evidence.metric).toBe('openFrequency');
  });

  it('includes CD-5 4 mandatory fields in fired leak', () => {
    const leak = rule.detect(underBucket(), baselineLate);
    expect(leak.label).toBeTruthy();
    expect(leak.situationKey).toBe('preflop:rfi-decision:LATE');
    expect(leak.sampleSize).toBeGreaterThan(0);
    expect(leak.observedRate).toBeTypeOf('number');
    expect(leak.ciLower).toBeTypeOf('number');
    expect(leak.ciUpper).toBeTypeOf('number');
    expect(leak.solverBaseline).toBeTypeOf('number');
    expect(rule.threshold.minSampleSize).toBe(30);
  });

  it('binds to the rfi-discipline umbrella concept', () => {
    const leak = rule.detect(underBucket(), baselineLate);
    expect(leak.relatedConceptId).toBe('rfi-discipline-cluster');
  });

  it('per-position: fires against the BUTTON baseline when given the BUTTON bucket', () => {
    // BUTTON reference ~42%; hero opens only 20% → clear under-open
    const baselineBtn = { baseline: 0.42, source: 'hardcoded', confidence: 0.75, lastValidatedAt: '2026-06-06' };
    const bucket = buildBucket({
      situationKey: 'preflop:rfi-decision:BUTTON',
      aggressCount: 20,
      passCount: 80,
      sampleSize: 100,
      aggressFrequency: 0.20,
      aggressFrequencyCI: { lower: 0.13, upper: 0.29, mean: 0.20 },
    });
    const leak = rule.detect(bucket, baselineBtn);
    expect(leak).not.toBeNull();
    expect(leak.situationKey).toBe('preflop:rfi-decision:BUTTON');
    expect(leak.solverBaseline).toBe(0.42);
  });
});
