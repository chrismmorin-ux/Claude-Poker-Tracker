/**
 * @file Tests for leakRules/heroMultiwayBluffFrequency.js — first
 * decision-bucket (aggression-frequency) leak rule. SPR-108 / WS-146 fifth claim.
 */

import { describe, it, expect } from 'vitest';
import { rule } from '../leakRules/heroMultiwayBluffFrequency.js';

const MW_KEY = 'flop:cbet-decision:mw';

const baseline25 = { baseline: 0.25, source: 'hardcoded', confidence: 0.70, lastValidatedAt: '2026-06-06' };

const buildBucket = (overrides = {}) => ({
  situationKey: MW_KEY,
  aggressCount: 0,
  passCount: 0,
  sampleSize: 0,
  aggressFrequency: 0,
  aggressFrequencyCI: { lower: 0, upper: 0, mean: 0 },
  ...overrides,
});

// ─── Rule signature compliance ───────────────────────────────────────────

describe('hero-multiway-bluff-frequency rule signature', () => {
  it('exports a rule object with required fields', () => {
    expect(rule.id).toBe('hero-multiway-bluff-frequency');
    expect(rule.label).toMatch(/[Mm]ultiway/);
    expect(rule.relatedConceptId).toBe('multiway-cbet-discipline-cluster');
    expect(rule.threshold.minSampleSize).toBe(30);
    expect(rule.threshold.minSeverity).toBeGreaterThan(0);
    expect(typeof rule.matchesBucket).toBe('function');
    expect(typeof rule.detect).toBe('function');
    expect(typeof rule.solverBaselineKey).toBe('function');
  });

  it('declares bucketType "decision" (reads the aggression-frequency bucket, not fold-rate)', () => {
    expect(rule.bucketType).toBe('decision');
  });
});

// ─── matchesBucket ───────────────────────────────────────────────────────

describe('matchesBucket', () => {
  it('matches the multiway flop cbet decision bucket', () => {
    expect(rule.matchesBucket('flop:cbet-decision:mw')).toBe(true);
  });

  it('does NOT match the heads-up decision bucket (separate future rule)', () => {
    expect(rule.matchesBucket('flop:cbet-decision:hu')).toBe(false);
  });

  it('does NOT match any 8-axis action key', () => {
    expect(rule.matchesBucket('flop:medium:LATE:def:ip:bet:vsBet:pfc')).toBe(false);
    expect(rule.matchesBucket('flop:dry:BUTTON:agg:ip:none:cbet:pfa')).toBe(false);
  });

  it('does NOT match turn/river decision keys (v1 flop only)', () => {
    expect(rule.matchesBucket('turn:cbet-decision:mw')).toBe(false);
    expect(rule.matchesBucket('river:cbet-decision:mw')).toBe(false);
  });

  it('returns false for malformed keys', () => {
    expect(rule.matchesBucket(null)).toBe(false);
    expect(rule.matchesBucket('')).toBe(false);
    expect(rule.matchesBucket('flop:cbet-decision')).toBe(false);
  });
});

// ─── detect — gating logic ───────────────────────────────────────────────

describe('detect — gating logic', () => {
  it('returns null when baseline is missing', () => {
    const bucket = buildBucket({ aggressCount: 30, passCount: 20, sampleSize: 50, aggressFrequency: 0.6 });
    expect(rule.detect(bucket, null)).toBeNull();
  });

  it('returns null when sampleSize < 30 (AP-SCF-04 floor)', () => {
    const bucket = buildBucket({
      aggressCount: 20,
      passCount: 9,
      sampleSize: 29,
      aggressFrequency: 20 / 29,
      aggressFrequencyCI: { lower: 0.5, upper: 0.85, mean: 20 / 29 },
    });
    expect(rule.detect(bucket, baseline25)).toBeNull();
  });

  it('returns null when delta < 5pp threshold (within noise of baseline)', () => {
    // aggressFrequency 28%, baseline 25% → delta 3pp, below threshold
    const bucket = buildBucket({
      aggressCount: 14,
      passCount: 36,
      sampleSize: 50,
      aggressFrequency: 0.28,
      aggressFrequencyCI: { lower: 0.17, upper: 0.42, mean: 0.28 },
    });
    expect(rule.detect(bucket, baseline25)).toBeNull();
  });

  it('returns null when CI lower bound does NOT exceed baseline (noisy data)', () => {
    // aggressFrequency 40% but CI lower 0.22 < baseline 0.25
    const bucket = buildBucket({
      aggressCount: 20,
      passCount: 30,
      sampleSize: 50,
      aggressFrequency: 0.40,
      aggressFrequencyCI: { lower: 0.22, upper: 0.58, mean: 0.40 },
    });
    expect(rule.detect(bucket, baseline25)).toBeNull();
  });
});

// ─── detect — fires correctly (OVER-frequency polarity) ──────────────────

describe('detect — fires when multiway over-continuation is real + significant', () => {
  it('fires when cbet frequency exceeds baseline + delta AND CI agrees', () => {
    // aggressFrequency 60%, baseline 25%, n=50, CI [46%, 74%] — clearly over
    const bucket = buildBucket({
      aggressCount: 30,
      passCount: 20,
      sampleSize: 50,
      aggressFrequency: 0.60,
      aggressFrequencyCI: { lower: 0.46, upper: 0.74, mean: 0.60 },
    });
    const leak = rule.detect(bucket, baseline25);
    expect(leak).not.toBeNull();
    expect(leak.leakRuleId).toBe('hero-multiway-bluff-frequency');
    expect(leak.observedRate).toBe(0.60);
    expect(leak.solverBaseline).toBe(0.25);
    expect(leak.sampleSize).toBe(50);
    expect(leak.severity).toBeGreaterThan(0);
    expect(leak.evidence.delta).toBeCloseTo(0.35, 2);
    expect(leak.evidence.metric).toBe('cbetFrequency');
  });

  it('includes CD-5 4 mandatory fields in fired leak', () => {
    const bucket = buildBucket({
      aggressCount: 30,
      passCount: 20,
      sampleSize: 50,
      aggressFrequency: 0.60,
      aggressFrequencyCI: { lower: 0.46, upper: 0.74, mean: 0.60 },
    });
    const leak = rule.detect(bucket, baseline25);
    // Field 1: situation key + label
    expect(leak.label).toBeTruthy();
    expect(leak.situationKey).toBe('flop:cbet-decision:mw');
    // Field 2: sample size + observed rate + CI
    expect(leak.sampleSize).toBeGreaterThan(0);
    expect(leak.observedRate).toBeTypeOf('number');
    expect(leak.ciLower).toBeTypeOf('number');
    expect(leak.ciUpper).toBeTypeOf('number');
    // Field 3: solver baseline
    expect(leak.solverBaseline).toBeTypeOf('number');
    // Field 4: threshold floor (implicit — minSampleSize)
    expect(rule.threshold.minSampleSize).toBe(30);
  });

  it('binds to the multiway-cbet-discipline umbrella concept', () => {
    const bucket = buildBucket({
      aggressCount: 30,
      passCount: 20,
      sampleSize: 50,
      aggressFrequency: 0.60,
      aggressFrequencyCI: { lower: 0.46, upper: 0.74, mean: 0.60 },
    });
    const leak = rule.detect(bucket, baseline25);
    expect(leak.relatedConceptId).toBe('multiway-cbet-discipline-cluster');
  });
});
