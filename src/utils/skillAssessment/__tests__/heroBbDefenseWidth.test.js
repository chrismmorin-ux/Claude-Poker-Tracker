/**
 * @file Tests for leakRules/heroBbDefenseWidth.js — second SCF leak rule.
 */

import { describe, it, expect } from 'vitest';
import { rule } from '../leakRules/heroBbDefenseWidth.js';

const BB_DEFENSE_KEY = 'preflop:none:BIG_BLIND:def:oop:raise:vsopen';
const baseline45 = { baseline: 0.45, source: 'hardcoded', confidence: 0.80, lastValidatedAt: '2026-05-03' };

const buildBucket = (overrides = {}) => ({
  situationKey: BB_DEFENSE_KEY,
  foldCount: 0,
  callCount: 0,
  raiseCount: 0,
  sampleSize: 0,
  foldRate: 0,
  foldRateCI: { lower: 0, upper: 0, mean: 0 },
  ...overrides,
});

describe('hero-bb-defense-width rule signature', () => {
  it('exports a rule object with required fields', () => {
    expect(rule.id).toBe('hero-bb-defense-width');
    expect(rule.label).toMatch(/BB defense/);
    expect(rule.relatedConceptId).toBe('bb-defense-cluster');
    expect(rule.threshold.minSampleSize).toBe(30);
    expect(typeof rule.matchesBucket).toBe('function');
    expect(typeof rule.detect).toBe('function');
  });
});

describe('matchesBucket', () => {
  it('matches BB defending vs preflop open', () => {
    expect(rule.matchesBucket('preflop:none:BIG_BLIND:def:oop:raise:vsopen')).toBe(true);
  });

  it('does NOT match SB or other positions', () => {
    expect(rule.matchesBucket('preflop:none:SMALL_BLIND:def:oop:raise:vsopen')).toBe(false);
    expect(rule.matchesBucket('preflop:none:LATE:def:oop:raise:vsopen')).toBe(false);
  });

  it('does NOT match postflop streets', () => {
    expect(rule.matchesBucket('flop:medium:BIG_BLIND:def:oop:bet:vsBet')).toBe(false);
  });

  it('does NOT match aggressor situations', () => {
    expect(rule.matchesBucket('preflop:none:BIG_BLIND:agg:oop:none:open')).toBe(false);
  });

  it('does NOT match VS_3BET / VS_SQUEEZE contexts', () => {
    expect(rule.matchesBucket('preflop:none:BIG_BLIND:def:oop:raise:vs3bet')).toBe(false);
  });

  it('returns false for malformed keys', () => {
    expect(rule.matchesBucket(null)).toBe(false);
    expect(rule.matchesBucket('preflop:none')).toBe(false);
  });
});

describe('detect — gating', () => {
  it('returns null below n=30 floor', () => {
    const bucket = buildBucket({
      foldCount: 18,
      sampleSize: 25,
      foldRate: 0.72,
      foldRateCI: { lower: 0.55, upper: 0.85, mean: 0.72 },
    });
    expect(rule.detect(bucket, baseline45)).toBeNull();
  });

  it('returns null when delta < 5pp threshold', () => {
    const bucket = buildBucket({
      foldCount: 14,
      sampleSize: 30,
      foldRate: 0.467,
      foldRateCI: { lower: 0.30, upper: 0.63, mean: 0.467 },
    });
    expect(rule.detect(bucket, baseline45)).toBeNull();
  });

  it('returns null when CI lower bound does NOT exceed baseline', () => {
    // 60% point estimate but wide CI [40%, 80%] — lower bound 40% < 45% baseline
    const bucket = buildBucket({
      foldCount: 18,
      sampleSize: 30,
      foldRate: 0.60,
      foldRateCI: { lower: 0.40, upper: 0.80, mean: 0.60 },
    });
    expect(rule.detect(bucket, baseline45)).toBeNull();
  });

  it('returns null when baseline is missing', () => {
    const bucket = buildBucket({
      foldCount: 25,
      sampleSize: 30,
      foldRate: 0.83,
      foldRateCI: { lower: 0.65, upper: 0.95, mean: 0.83 },
    });
    expect(rule.detect(bucket, null)).toBeNull();
  });
});

describe('detect — fires when overfold is real + significant', () => {
  it('fires when BB folds 75% with tight CI [60%, 85%]', () => {
    const bucket = buildBucket({
      foldCount: 38,
      sampleSize: 50,
      foldRate: 0.76,
      foldRateCI: { lower: 0.62, upper: 0.86, mean: 0.76 },
    });
    const leak = rule.detect(bucket, baseline45);
    expect(leak).not.toBeNull();
    expect(leak.leakRuleId).toBe('hero-bb-defense-width');
    expect(leak.observedRate).toBeCloseTo(0.76, 2);
    expect(leak.solverBaseline).toBe(0.45);
    expect(leak.evidence.delta).toBeCloseTo(0.31, 2);
    expect(leak.severity).toBeGreaterThan(0);
  });

  it('CD-5 4 mandatory fields present in fired leak', () => {
    const bucket = buildBucket({
      foldCount: 38,
      sampleSize: 50,
      foldRate: 0.76,
      foldRateCI: { lower: 0.62, upper: 0.86, mean: 0.76 },
    });
    const leak = rule.detect(bucket, baseline45);
    expect(leak.label).toBeTruthy();      // 1: situation
    expect(leak.sampleSize).toBe(50);     // 2: sample
    expect(leak.observedRate).toBeTypeOf('number');
    expect(leak.ciLower).toBeTypeOf('number');
    expect(leak.ciUpper).toBeTypeOf('number');
    expect(leak.solverBaseline).toBeTypeOf('number'); // 3: baseline
    expect(rule.threshold.minSampleSize).toBe(30);    // 4: threshold (implicit)
  });
});
