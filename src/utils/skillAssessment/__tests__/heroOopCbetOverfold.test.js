/**
 * @file Tests for leakRules/heroOopCbetOverfold.js — third SCF leak rule
 * (SHIPPED v1, SPR-040 / WS-146 second claim). Mirrors heroIpCbetOverfold
 * test structure with OOP-specific axis values.
 */

import { describe, it, expect } from 'vitest';
import { rule } from '../leakRules/heroOopCbetOverfold.js';

const SB_DRY_KEY = 'flop:dry:SMALL_BLIND:def:oop:bet:vsBet:pfc';
const BB_WET_KEY = 'flop:wet:BIG_BLIND:def:oop:bet:vsBet:pfc';

const baselineSbDry = { baseline: 0.50, source: 'hardcoded', confidence: 0.80, lastValidatedAt: '2026-05-06' };

const buildBucket = (overrides = {}) => ({
  situationKey: SB_DRY_KEY,
  foldCount: 0,
  callCount: 0,
  raiseCount: 0,
  sampleSize: 0,
  foldRate: 0,
  foldRateCI: { lower: 0, upper: 0, mean: 0 },
  ...overrides,
});

// ─── Rule signature compliance ───────────────────────────────────────────

describe('hero-oop-cbet-overfold rule signature', () => {
  it('exports a rule object with required fields', () => {
    expect(rule.id).toBe('hero-oop-cbet-overfold');
    expect(rule.label).toMatch(/OOP cbet defense/);
    expect(rule.relatedConceptId).toBe('oop-cbet-defense-cluster');
    expect(rule.threshold.minSampleSize).toBe(30);
    expect(rule.threshold.minSeverity).toBeGreaterThan(0);
    expect(typeof rule.matchesBucket).toBe('function');
    expect(typeof rule.detect).toBe('function');
    expect(typeof rule.solverBaselineKey).toBe('function');
  });
});

// ─── matchesBucket ───────────────────────────────────────────────────────

describe('matchesBucket', () => {
  it('matches SMALL_BLIND defending OOP vs flop bet (pfc)', () => {
    expect(rule.matchesBucket('flop:dry:SMALL_BLIND:def:oop:bet:vsBet:pfc')).toBe(true);
  });

  it('matches BIG_BLIND defending OOP vs flop bet (pfc)', () => {
    expect(rule.matchesBucket('flop:wet:BIG_BLIND:def:oop:bet:vsBet:pfc')).toBe(true);
  });

  it('matches across all texture variants for both blind positions', () => {
    expect(rule.matchesBucket('flop:dry:SMALL_BLIND:def:oop:bet:vsBet:pfc')).toBe(true);
    expect(rule.matchesBucket('flop:medium:SMALL_BLIND:def:oop:bet:vsBet:pfc')).toBe(true);
    expect(rule.matchesBucket('flop:wet:SMALL_BLIND:def:oop:bet:vsBet:pfc')).toBe(true);
    expect(rule.matchesBucket('flop:dry:BIG_BLIND:def:oop:bet:vsBet:pfc')).toBe(true);
    expect(rule.matchesBucket('flop:medium:BIG_BLIND:def:oop:bet:vsBet:pfc')).toBe(true);
    expect(rule.matchesBucket('flop:wet:BIG_BLIND:def:oop:bet:vsBet:pfc')).toBe(true);
  });

  it('does NOT match preflop', () => {
    expect(rule.matchesBucket('preflop:none:BIG_BLIND:def:oop:raise:vsopen:na')).toBe(false);
  });

  it('does NOT match turn or river', () => {
    expect(rule.matchesBucket('turn:medium:BIG_BLIND:def:oop:bet:vsBet:pfc')).toBe(false);
    expect(rule.matchesBucket('river:medium:BIG_BLIND:def:oop:bet:vsBet:pfc')).toBe(false);
  });

  it('does NOT match IP positions (LATE/BUTTON/EARLY/MIDDLE)', () => {
    expect(rule.matchesBucket('flop:medium:LATE:def:oop:bet:vsBet:pfc')).toBe(false);
    expect(rule.matchesBucket('flop:medium:BUTTON:def:oop:bet:vsBet:pfc')).toBe(false);
    expect(rule.matchesBucket('flop:medium:EARLY:def:oop:bet:vsBet:pfc')).toBe(false);
    expect(rule.matchesBucket('flop:medium:MIDDLE:def:oop:bet:vsBet:pfc')).toBe(false);
  });

  it('does NOT match IP situations (isIP=ip)', () => {
    expect(rule.matchesBucket('flop:medium:BIG_BLIND:def:ip:bet:vsBet:pfc')).toBe(false);
  });

  it('does NOT match aggressor situations', () => {
    expect(rule.matchesBucket('flop:medium:BIG_BLIND:agg:oop:none:cbet:pfa')).toBe(false);
  });

  it('does NOT match preflop-aggressor (pfa) situations — this rule is OOP cbet defense not donk-defense', () => {
    expect(rule.matchesBucket('flop:medium:BIG_BLIND:def:oop:bet:vsBet:pfa')).toBe(false);
    expect(rule.matchesBucket('flop:dry:SMALL_BLIND:def:oop:bet:vsBet:pfa')).toBe(false);
  });

  it('returns false for malformed keys', () => {
    expect(rule.matchesBucket(null)).toBe(false);
    expect(rule.matchesBucket('')).toBe(false);
    expect(rule.matchesBucket('flop:medium:BIG_BLIND')).toBe(false); // too few segments
    expect(rule.matchesBucket('flop:medium:BIG_BLIND:def:oop:bet:vsBet')).toBe(false); // 7 axes (pre-SPR-040)
  });
});

// ─── detect — gating logic ───────────────────────────────────────────────

describe('detect — gating logic', () => {
  it('returns null when baseline is missing', () => {
    const bucket = buildBucket({ foldCount: 25, sampleSize: 30, foldRate: 25 / 30 });
    expect(rule.detect(bucket, null)).toBeNull();
  });

  it('returns null when sampleSize < 30 (AP-SCF-04 floor)', () => {
    const bucket = buildBucket({
      foldCount: 25,
      sampleSize: 29,
      foldRate: 25 / 29,
      foldRateCI: { lower: 0.65, upper: 0.95, mean: 25 / 29 },
    });
    expect(rule.detect(bucket, baselineSbDry)).toBeNull();
  });

  it('returns null when delta < 5pp threshold', () => {
    // foldRate = 52%, baseline 50% → delta 2pp, below 5pp threshold
    const bucket = buildBucket({
      foldCount: 16,
      sampleSize: 30,
      foldRate: 0.52,
      foldRateCI: { lower: 0.35, upper: 0.69, mean: 0.52 },
    });
    expect(rule.detect(bucket, baselineSbDry)).toBeNull();
  });

  it('returns null when CI lower bound does NOT exceed baseline', () => {
    // foldRate = 60%, baseline 50%, but CI lower = 45% < baseline → rule should not fire
    const bucket = buildBucket({
      foldCount: 18,
      sampleSize: 30,
      foldRate: 0.60,
      foldRateCI: { lower: 0.45, upper: 0.75, mean: 0.60 },
    });
    expect(rule.detect(bucket, baselineSbDry)).toBeNull();
  });
});

// ─── detect — fires correctly ────────────────────────────────────────────

describe('detect — fires when overfold is real + significant', () => {
  it('fires when SB folds 75% on dry texture with tight CI', () => {
    // baseline 50%, observed 75%, n=50, CI [62%, 86%] — clearly above baseline
    const bucket = buildBucket({
      foldCount: 38,
      sampleSize: 50,
      foldRate: 0.76,
      foldRateCI: { lower: 0.62, upper: 0.86, mean: 0.76 },
    });
    const leak = rule.detect(bucket, baselineSbDry);
    expect(leak).not.toBeNull();
    expect(leak.leakRuleId).toBe('hero-oop-cbet-overfold');
    expect(leak.observedRate).toBeCloseTo(0.76, 2);
    expect(leak.solverBaseline).toBe(0.50);
    expect(leak.sampleSize).toBe(50);
    expect(leak.severity).toBeGreaterThan(0);
    expect(leak.evidence.delta).toBeCloseTo(0.26, 2);
    expect(leak.evidence.metric).toBe('foldRate');
  });

  it('CD-5 4 mandatory fields present in fired leak', () => {
    const bucket = buildBucket({
      foldCount: 38,
      sampleSize: 50,
      foldRate: 0.76,
      foldRateCI: { lower: 0.62, upper: 0.86, mean: 0.76 },
    });
    const leak = rule.detect(bucket, baselineSbDry);
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

  it('confidence defaults to 0.80 when baseline omits it', () => {
    const bareBaseline = { baseline: 0.50 };
    const bucket = buildBucket({
      foldCount: 38,
      sampleSize: 50,
      foldRate: 0.76,
      foldRateCI: { lower: 0.62, upper: 0.86, mean: 0.76 },
    });
    const leak = rule.detect(bucket, bareBaseline);
    expect(leak.confidence).toBe(0.80);
  });
});
