/**
 * @file Tests for leakRules/heroPf3betOverfold.js — fifth SCF leak rule
 * (SPR-046 / WS-146 third claim).
 */

import { describe, it, expect } from 'vitest';
import { rule } from '../leakRules/heroPf3betOverfold.js';

const baseline = (rate) => ({
  baseline: rate,
  source: 'hardcoded',
  confidence: 0.80,
  lastValidatedAt: '2026-05-07',
});

const buildBucket = (overrides = {}) => ({
  situationKey: 'preflop:none:LATE:agg:ip:raise:vs3bet:na',
  foldCount: 0,
  callCount: 0,
  raiseCount: 0,
  sampleSize: 0,
  foldRate: 0,
  foldRateCI: { lower: 0, upper: 0, mean: 0 },
  ...overrides,
});

describe('hero-pf-3bet-overfold rule signature', () => {
  it('exports a rule object with required fields', () => {
    expect(rule.id).toBe('hero-pf-3bet-overfold');
    expect(rule.label).toMatch(/3bet/i);
    expect(rule.relatedConceptId).toBe('pf-3bet-defense-cluster');
    expect(rule.threshold.minSampleSize).toBe(30);
    expect(typeof rule.matchesBucket).toBe('function');
    expect(typeof rule.detect).toBe('function');
    expect(typeof rule.solverBaselineKey).toBe('function');
  });
});

describe('matchesBucket', () => {
  it('matches hero-as-opener facing 3bet for all 4 positions × both isIP variants', () => {
    expect(rule.matchesBucket('preflop:none:EARLY:agg:ip:raise:vs3bet:na')).toBe(true);
    expect(rule.matchesBucket('preflop:none:EARLY:agg:oop:raise:vs3bet:na')).toBe(true);
    expect(rule.matchesBucket('preflop:none:MIDDLE:agg:ip:raise:vs3bet:na')).toBe(true);
    expect(rule.matchesBucket('preflop:none:MIDDLE:agg:oop:raise:vs3bet:na')).toBe(true);
    expect(rule.matchesBucket('preflop:none:LATE:agg:ip:raise:vs3bet:na')).toBe(true);
    expect(rule.matchesBucket('preflop:none:LATE:agg:oop:raise:vs3bet:na')).toBe(true);
    expect(rule.matchesBucket('preflop:none:BUTTON:agg:ip:raise:vs3bet:na')).toBe(true);
    expect(rule.matchesBucket('preflop:none:BUTTON:agg:oop:raise:vs3bet:na')).toBe(true);
  });

  it('does NOT match blind positions (SB/BB never open RFI by definition in this rule)', () => {
    expect(rule.matchesBucket('preflop:none:SMALL_BLIND:agg:ip:raise:vs3bet:na')).toBe(false);
    expect(rule.matchesBucket('preflop:none:BIG_BLIND:agg:oop:raise:vs3bet:na')).toBe(false);
  });

  it('does NOT match defensive (def) configurations — hero must be the opener', () => {
    expect(rule.matchesBucket('preflop:none:LATE:def:oop:raise:vs3bet:na')).toBe(false);
  });

  it('does NOT match other contextActions (open / 4bet / vsopen / limp)', () => {
    expect(rule.matchesBucket('preflop:none:LATE:agg:ip:none:open:na')).toBe(false);
    expect(rule.matchesBucket('preflop:none:LATE:agg:ip:raise:4bet:na')).toBe(false);
    expect(rule.matchesBucket('preflop:none:LATE:agg:ip:raise:vsopen:na')).toBe(false);
    expect(rule.matchesBucket('preflop:none:LATE:def:ip:raise:vsopen:na')).toBe(false);
  });

  it('does NOT match postflop streets', () => {
    expect(rule.matchesBucket('flop:medium:LATE:agg:ip:bet:vsBet:pfa')).toBe(false);
  });

  it('returns false for malformed keys', () => {
    expect(rule.matchesBucket(null)).toBe(false);
    expect(rule.matchesBucket('preflop:none')).toBe(false);
    expect(rule.matchesBucket('preflop:none:LATE:agg:ip:raise:vs3bet')).toBe(false); // 7 axes
  });
});

describe('solverBaselineKey — normalizes isIP to ip', () => {
  it('preserves position; normalizes isIP=oop → isIP=ip', () => {
    expect(rule.solverBaselineKey('preflop:none:LATE:agg:oop:raise:vs3bet:na'))
      .toBe('preflop:none:LATE:agg:ip:raise:vs3bet:na');
    expect(rule.solverBaselineKey('preflop:none:BUTTON:agg:oop:raise:vs3bet:na'))
      .toBe('preflop:none:BUTTON:agg:ip:raise:vs3bet:na');
  });
  it('passes through isIP=ip unchanged', () => {
    expect(rule.solverBaselineKey('preflop:none:EARLY:agg:ip:raise:vs3bet:na'))
      .toBe('preflop:none:EARLY:agg:ip:raise:vs3bet:na');
  });
  it('passes through unchanged for malformed input', () => {
    expect(rule.solverBaselineKey(null)).toBe(null);
    expect(rule.solverBaselineKey('preflop:none')).toBe('preflop:none');
  });
});

describe('detect — gating', () => {
  it('returns null below n=30 floor', () => {
    const bucket = buildBucket({
      foldCount: 16,
      sampleSize: 25,
      foldRate: 0.64,
      foldRateCI: { lower: 0.45, upper: 0.80, mean: 0.64 },
    });
    expect(rule.detect(bucket, baseline(0.55))).toBeNull();
  });

  it('returns null when delta < 5pp threshold (rate close to baseline)', () => {
    const bucket = buildBucket({
      foldCount: 17,
      sampleSize: 30,
      foldRate: 0.567,
      foldRateCI: { lower: 0.40, upper: 0.72, mean: 0.567 },
    });
    expect(rule.detect(bucket, baseline(0.55))).toBeNull(); // delta = 0.017
  });

  it('returns null when CI lower bound does NOT exceed baseline', () => {
    // 65% point-estimate but wide CI [42%, 86%] — lower bound 42% < 55% baseline
    const bucket = buildBucket({
      foldCount: 20,
      sampleSize: 30,
      foldRate: 0.65,
      foldRateCI: { lower: 0.42, upper: 0.86, mean: 0.65 },
    });
    expect(rule.detect(bucket, baseline(0.55))).toBeNull();
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
  it('fires when LATE-IP folds 80% with tight CI [70%, 88%] vs 55% baseline', () => {
    const bucket = buildBucket({
      foldCount: 60,
      sampleSize: 75,
      foldRate: 0.80,
      foldRateCI: { lower: 0.70, upper: 0.88, mean: 0.80 },
    });
    const leak = rule.detect(bucket, baseline(0.55));
    expect(leak).not.toBeNull();
    expect(leak.leakRuleId).toBe('hero-pf-3bet-overfold');
    expect(leak.observedRate).toBeCloseTo(0.80, 2);
    expect(leak.solverBaseline).toBe(0.55);
    expect(leak.evidence.delta).toBeCloseTo(0.25, 2);
    expect(leak.severity).toBeGreaterThan(0);
  });

  it('CD-5 4 mandatory fields present in fired leak', () => {
    const bucket = buildBucket({
      foldCount: 60,
      sampleSize: 75,
      foldRate: 0.80,
      foldRateCI: { lower: 0.70, upper: 0.88, mean: 0.80 },
    });
    const leak = rule.detect(bucket, baseline(0.55));
    expect(leak.label).toBeTruthy();      // 1: situation
    expect(leak.sampleSize).toBe(75);     // 2: sample
    expect(leak.observedRate).toBeTypeOf('number');
    expect(leak.ciLower).toBeTypeOf('number');
    expect(leak.ciUpper).toBeTypeOf('number');
    expect(leak.solverBaseline).toBeTypeOf('number'); // 3: baseline
    expect(rule.threshold.minSampleSize).toBe(30);    // 4: threshold
  });

  it('fires across all 4 positions when overfold is significant', () => {
    const bucket = (key) => buildBucket({
      situationKey: key,
      foldCount: 56,
      sampleSize: 70,
      foldRate: 0.80,
      foldRateCI: { lower: 0.70, upper: 0.88, mean: 0.80 },
    });
    expect(rule.detect(bucket('preflop:none:EARLY:agg:ip:raise:vs3bet:na'), baseline(0.50))).not.toBeNull();
    expect(rule.detect(bucket('preflop:none:MIDDLE:agg:ip:raise:vs3bet:na'), baseline(0.52))).not.toBeNull();
    expect(rule.detect(bucket('preflop:none:LATE:agg:ip:raise:vs3bet:na'), baseline(0.55))).not.toBeNull();
    expect(rule.detect(bucket('preflop:none:BUTTON:agg:ip:raise:vs3bet:na'), baseline(0.55))).not.toBeNull();
  });
});
