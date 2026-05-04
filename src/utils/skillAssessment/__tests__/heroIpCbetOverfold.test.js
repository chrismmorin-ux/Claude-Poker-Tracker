/**
 * @file Tests for leakRules/heroIpCbetOverfold.js — first SCF leak rule.
 */

import { describe, it, expect } from 'vitest';
import { rule } from '../leakRules/heroIpCbetOverfold.js';

const LATE_CBET_KEY = 'flop:medium:LATE:def:ip:bet:vsBet';
const NO_MATCH_KEY = 'turn:wet:EARLY:agg:oop:none:cbet';

const baseline38 = { baseline: 0.38, source: 'hardcoded', confidence: 0.85, lastValidatedAt: '2026-05-03' };

const buildBucket = (overrides = {}) => ({
  situationKey: LATE_CBET_KEY,
  foldCount: 0,
  callCount: 0,
  raiseCount: 0,
  sampleSize: 0,
  foldRate: 0,
  foldRateCI: { lower: 0, upper: 0, mean: 0 },
  ...overrides,
});

// ─── Rule signature compliance ───────────────────────────────────────────

describe('hero-ip-cbet-overfold rule signature', () => {
  it('exports a rule object with required fields', () => {
    expect(rule.id).toBe('hero-ip-cbet-overfold');
    expect(rule.label).toMatch(/IP cbet defense/);
    expect(rule.relatedConceptId).toBe('cbet-defense-cluster');
    expect(rule.threshold.minSampleSize).toBe(30);
    expect(rule.threshold.minSeverity).toBeGreaterThan(0);
    expect(typeof rule.matchesBucket).toBe('function');
    expect(typeof rule.detect).toBe('function');
    expect(typeof rule.solverBaselineKey).toBe('function');
  });
});

// ─── matchesBucket ───────────────────────────────────────────────────────

describe('matchesBucket', () => {
  it('matches LATE position IP defending vs flop bet', () => {
    expect(rule.matchesBucket('flop:medium:LATE:def:ip:bet:vsBet')).toBe(true);
  });

  it('matches BUTTON position IP defending vs flop bet', () => {
    expect(rule.matchesBucket('flop:dry:BUTTON:def:ip:bet:vsBet')).toBe(true);
  });

  it('matches across all texture variants', () => {
    expect(rule.matchesBucket('flop:dry:LATE:def:ip:bet:vsBet')).toBe(true);
    expect(rule.matchesBucket('flop:medium:LATE:def:ip:bet:vsBet')).toBe(true);
    expect(rule.matchesBucket('flop:wet:LATE:def:ip:bet:vsBet')).toBe(true);
  });

  it('does NOT match preflop', () => {
    expect(rule.matchesBucket('preflop:none:LATE:def:ip:bet:vsBet')).toBe(false);
  });

  it('does NOT match turn or river', () => {
    expect(rule.matchesBucket('turn:medium:LATE:def:ip:bet:vsBet')).toBe(false);
    expect(rule.matchesBucket('river:medium:LATE:def:ip:bet:vsBet')).toBe(false);
  });

  it('does NOT match OOP positions (SB/BB/EARLY/MIDDLE)', () => {
    expect(rule.matchesBucket('flop:medium:SB:def:ip:bet:vsBet')).toBe(false);
    expect(rule.matchesBucket('flop:medium:BB:def:ip:bet:vsBet')).toBe(false);
    expect(rule.matchesBucket('flop:medium:EARLY:def:ip:bet:vsBet')).toBe(false);
  });

  it('does NOT match OOP situations (isIP=oop)', () => {
    expect(rule.matchesBucket('flop:medium:LATE:def:oop:bet:vsBet')).toBe(false);
  });

  it('does NOT match aggressor situations', () => {
    expect(rule.matchesBucket('flop:medium:LATE:agg:ip:none:cbet')).toBe(false);
  });

  it('returns false for malformed keys', () => {
    expect(rule.matchesBucket(null)).toBe(false);
    expect(rule.matchesBucket('')).toBe(false);
    expect(rule.matchesBucket('flop:medium:LATE')).toBe(false); // too few segments
  });
});

// ─── detect — gating logic ───────────────────────────────────────────────

describe('detect — gating logic', () => {
  it('returns null when baseline is missing', () => {
    const bucket = buildBucket({ foldCount: 20, sampleSize: 30, foldRate: 20 / 30 });
    expect(rule.detect(bucket, null)).toBeNull();
  });

  it('returns null when sampleSize < 30 (AP-SCF-04 floor)', () => {
    const bucket = buildBucket({
      foldCount: 25,
      sampleSize: 29,
      foldRate: 25 / 29,
      foldRateCI: { lower: 0.65, upper: 0.95, mean: 25 / 29 },
    });
    expect(rule.detect(bucket, baseline38)).toBeNull();
  });

  it('returns null when delta < 5pp threshold', () => {
    // foldRate = 40%, baseline 38% → delta 2pp, below 5pp threshold
    const bucket = buildBucket({
      foldCount: 12,
      sampleSize: 30,
      foldRate: 0.40,
      foldRateCI: { lower: 0.25, upper: 0.55, mean: 0.40 },
    });
    expect(rule.detect(bucket, baseline38)).toBeNull();
  });

  it('returns null when CI lower bound does NOT exceed baseline (noisy data)', () => {
    // foldRate = 50%, baseline 38% → delta 12pp BUT CI lower 35% < baseline
    const bucket = buildBucket({
      foldCount: 15,
      sampleSize: 30,
      foldRate: 0.50,
      foldRateCI: { lower: 0.35, upper: 0.65, mean: 0.50 },
    });
    expect(rule.detect(bucket, baseline38)).toBeNull();
  });
});

// ─── detect — fires correctly ────────────────────────────────────────────

describe('detect — fires when overfold is real + significant', () => {
  it('fires when foldRate exceeds baseline + delta AND CI agrees', () => {
    // foldRate = 70%, baseline 38%, n=50, CI [56%, 84%] — clearly above baseline
    const bucket = buildBucket({
      foldCount: 35,
      sampleSize: 50,
      foldRate: 0.70,
      foldRateCI: { lower: 0.56, upper: 0.84, mean: 0.70 },
    });
    const leak = rule.detect(bucket, baseline38);
    expect(leak).not.toBeNull();
    expect(leak.leakRuleId).toBe('hero-ip-cbet-overfold');
    expect(leak.observedRate).toBe(0.70);
    expect(leak.solverBaseline).toBe(0.38);
    expect(leak.sampleSize).toBe(50);
    expect(leak.severity).toBeGreaterThan(0);
    expect(leak.evidence.delta).toBeCloseTo(0.32, 2);
    expect(leak.evidence.metric).toBe('foldRate');
  });

  it('included CD-5 4 mandatory fields in fired leak', () => {
    const bucket = buildBucket({
      foldCount: 35,
      sampleSize: 50,
      foldRate: 0.70,
      foldRateCI: { lower: 0.56, upper: 0.84, mean: 0.70 },
    });
    const leak = rule.detect(bucket, baseline38);
    // Field 1: situation key (label maps to it)
    expect(leak.label).toBeTruthy();
    expect(leak.situationKey).toBeTruthy();
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
});
