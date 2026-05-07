/**
 * @file Tests for leakRules/heroOop3betUnderfold.js — sixth SCF leak rule
 * + first UNDER-fold direction in the catalog (SPR-046 / WS-146 third claim).
 */

import { describe, it, expect } from 'vitest';
import { rule } from '../leakRules/heroOop3betUnderfold.js';

const baseline = (rate, conf = 0.75) => ({
  baseline: rate,
  source: 'hardcoded',
  confidence: conf,
  lastValidatedAt: '2026-05-07',
});

const buildBucket = (overrides = {}) => ({
  situationKey: 'preflop:none:BIG_BLIND:def:oop:raise:vs3bet:na',
  foldCount: 0,
  callCount: 0,
  raiseCount: 0,
  sampleSize: 0,
  foldRate: 0,
  foldRateCI: { lower: 0, upper: 0, mean: 0 },
  ...overrides,
});

describe('hero-oop-3bet-underfold rule signature', () => {
  it('exports a rule object with required fields', () => {
    expect(rule.id).toBe('hero-oop-3bet-underfold');
    expect(rule.label).toMatch(/3bet/i);
    expect(rule.relatedConceptId).toBe('oop-3bet-defense-cluster');
    expect(rule.threshold.minSampleSize).toBe(30);
    expect(typeof rule.matchesBucket).toBe('function');
    expect(typeof rule.detect).toBe('function');
    expect(typeof rule.solverBaselineKey).toBe('function');
  });
});

describe('matchesBucket', () => {
  it('matches SB and BB defending OOP vs 3bet (post-flat)', () => {
    expect(rule.matchesBucket('preflop:none:SMALL_BLIND:def:oop:raise:vs3bet:na')).toBe(true);
    expect(rule.matchesBucket('preflop:none:BIG_BLIND:def:oop:raise:vs3bet:na')).toBe(true);
  });

  it('does NOT match non-blind positions (CO/MIDDLE/LATE deferred to v2)', () => {
    expect(rule.matchesBucket('preflop:none:LATE:def:oop:raise:vs3bet:na')).toBe(false);
    expect(rule.matchesBucket('preflop:none:MIDDLE:def:oop:raise:vs3bet:na')).toBe(false);
    expect(rule.matchesBucket('preflop:none:BUTTON:def:oop:raise:vs3bet:na')).toBe(false);
  });

  it('does NOT match aggressor situations (the over-fold rule covers those)', () => {
    expect(rule.matchesBucket('preflop:none:SMALL_BLIND:agg:oop:raise:vs3bet:na')).toBe(false);
    expect(rule.matchesBucket('preflop:none:BIG_BLIND:agg:ip:raise:vs3bet:na')).toBe(false);
  });

  it('does NOT match isIP=ip (this rule is OOP-only)', () => {
    expect(rule.matchesBucket('preflop:none:BIG_BLIND:def:ip:raise:vs3bet:na')).toBe(false);
  });

  it('does NOT match other contextActions (vsopen / 4bet / open)', () => {
    expect(rule.matchesBucket('preflop:none:BIG_BLIND:def:oop:raise:vsopen:na')).toBe(false);
    expect(rule.matchesBucket('preflop:none:BIG_BLIND:def:oop:raise:4bet:na')).toBe(false);
  });

  it('does NOT match postflop streets', () => {
    expect(rule.matchesBucket('flop:medium:BIG_BLIND:def:oop:bet:vsBet:pfc')).toBe(false);
  });

  it('disjoint from hero-pf-3bet-overfold (no overlap on agg axis)', () => {
    // The over-fold rule matches isAgg='agg'; this rule matches isAgg='def'.
    // Nothing matches both.
    expect(rule.matchesBucket('preflop:none:LATE:agg:ip:raise:vs3bet:na')).toBe(false);
    expect(rule.matchesBucket('preflop:none:BUTTON:agg:oop:raise:vs3bet:na')).toBe(false);
  });

  it('returns false for malformed keys', () => {
    expect(rule.matchesBucket(null)).toBe(false);
    expect(rule.matchesBucket('preflop:none')).toBe(false);
    expect(rule.matchesBucket('preflop:none:BIG_BLIND:def:oop:raise:vs3bet')).toBe(false); // 7 axes
  });
});

describe('detect — gating', () => {
  it('returns null below n=30 floor', () => {
    const bucket = buildBucket({
      foldCount: 14,
      sampleSize: 25,
      foldRate: 0.56,
      foldRateCI: { lower: 0.40, upper: 0.72, mean: 0.56 },
    });
    expect(rule.detect(bucket, baseline(0.75))).toBeNull();
  });

  it('returns null when delta < 5pp threshold (rate close to baseline)', () => {
    // baseline 0.75; observed 0.71; delta = 0.04 (< 5pp)
    const bucket = buildBucket({
      foldCount: 21,
      sampleSize: 30,
      foldRate: 0.71,
      foldRateCI: { lower: 0.55, upper: 0.85, mean: 0.71 },
    });
    expect(rule.detect(bucket, baseline(0.75))).toBeNull();
  });

  it('returns null when CI upper bound does NOT fall below baseline', () => {
    // baseline 0.75; observed 0.55; delta = 0.20 (above threshold)
    // BUT ci.upper = 0.78 → still spans baseline → not meaningful underfold
    const bucket = buildBucket({
      foldCount: 22,
      sampleSize: 40,
      foldRate: 0.55,
      foldRateCI: { lower: 0.30, upper: 0.78, mean: 0.55 },
    });
    expect(rule.detect(bucket, baseline(0.75))).toBeNull();
  });

  it('returns null when baseline is missing', () => {
    const bucket = buildBucket({
      foldCount: 12,
      sampleSize: 50,
      foldRate: 0.24,
      foldRateCI: { lower: 0.13, upper: 0.39, mean: 0.24 },
    });
    expect(rule.detect(bucket, null)).toBeNull();
  });

  it('returns null when over-fold detected (wrong direction — that\'s another rule)', () => {
    // foldRate 0.90 > baseline 0.75 — observed is HIGHER than baseline.
    // delta = baseline - observed = -0.15 (negative → not underfold direction)
    const bucket = buildBucket({
      foldCount: 45,
      sampleSize: 50,
      foldRate: 0.90,
      foldRateCI: { lower: 0.78, upper: 0.96, mean: 0.90 },
    });
    expect(rule.detect(bucket, baseline(0.75))).toBeNull();
  });
});

describe('detect — fires when underfold is real + significant', () => {
  it('fires when BB folds 40% with tight CI [27%, 53%] vs 75% baseline', () => {
    const bucket = buildBucket({
      foldCount: 24,
      sampleSize: 60,
      foldRate: 0.40,
      foldRateCI: { lower: 0.28, upper: 0.53, mean: 0.40 },
    });
    const leak = rule.detect(bucket, baseline(0.75));
    expect(leak).not.toBeNull();
    expect(leak.leakRuleId).toBe('hero-oop-3bet-underfold');
    expect(leak.observedRate).toBeCloseTo(0.40, 2);
    expect(leak.solverBaseline).toBe(0.75);
    // delta in evidence is positive = underfold magnitude (baseline - observed)
    expect(leak.evidence.delta).toBeCloseTo(0.35, 2);
    expect(leak.severity).toBeGreaterThan(0);
  });

  it('CD-5 4 mandatory fields present in fired leak', () => {
    const bucket = buildBucket({
      foldCount: 24,
      sampleSize: 60,
      foldRate: 0.40,
      foldRateCI: { lower: 0.28, upper: 0.53, mean: 0.40 },
    });
    const leak = rule.detect(bucket, baseline(0.75));
    expect(leak.label).toBeTruthy();      // 1: situation
    expect(leak.sampleSize).toBe(60);     // 2: sample
    expect(leak.observedRate).toBeTypeOf('number');
    expect(leak.ciLower).toBeTypeOf('number');
    expect(leak.ciUpper).toBeTypeOf('number');
    expect(leak.solverBaseline).toBeTypeOf('number'); // 3: baseline
    expect(rule.threshold.minSampleSize).toBe(30);    // 4: threshold
  });

  it('fires for both SB and BB when underfold is significant', () => {
    const bucket = (key) => buildBucket({
      situationKey: key,
      foldCount: 24,
      sampleSize: 60,
      foldRate: 0.40,
      foldRateCI: { lower: 0.28, upper: 0.53, mean: 0.40 },
    });
    expect(rule.detect(bucket('preflop:none:SMALL_BLIND:def:oop:raise:vs3bet:na'), baseline(0.72))).not.toBeNull();
    expect(rule.detect(bucket('preflop:none:BIG_BLIND:def:oop:raise:vs3bet:na'), baseline(0.75))).not.toBeNull();
  });

  it('uses baseline.confidence (0.75 default for this rule\'s baselines)', () => {
    const bucket = buildBucket({
      foldCount: 24,
      sampleSize: 60,
      foldRate: 0.40,
      foldRateCI: { lower: 0.28, upper: 0.53, mean: 0.40 },
    });
    const leak = rule.detect(bucket, baseline(0.75, 0.75));
    expect(leak.confidence).toBe(0.75);
  });
});
