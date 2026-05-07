/**
 * @file Tests for leakRules/heroFlopVsDonkMisresponse.js — fourth SCF leak
 * rule (SHIPPED v1, SPR-040 / WS-146 second claim).
 *
 * Architecturally significant: this rule's matchesBucket relies on the
 * 8th `preflopAggressor` axis (added in SPR-040) to distinguish hero
 * facing a donk-lead (hero pfa) from hero facing a cbet (hero pfc).
 * Without the axis the bucket would collapse with hero-ip-cbet-overfold.
 */

import { describe, it, expect } from 'vitest';
import { rule } from '../leakRules/heroFlopVsDonkMisresponse.js';

const LATE_DONK_KEY = 'flop:medium:LATE:def:ip:bet:vsBet:pfa';
const baselineMediumLate = { baseline: 0.48, source: 'hardcoded', confidence: 0.75, lastValidatedAt: '2026-05-06' };

const buildBucket = (overrides = {}) => ({
  situationKey: LATE_DONK_KEY,
  foldCount: 0,
  callCount: 0,
  raiseCount: 0,
  sampleSize: 0,
  foldRate: 0,
  foldRateCI: { lower: 0, upper: 0, mean: 0 },
  ...overrides,
});

// ─── Rule signature compliance ───────────────────────────────────────────

describe('hero-flop-vs-donk-misresponse rule signature', () => {
  it('exports a rule object with required fields', () => {
    expect(rule.id).toBe('hero-flop-vs-donk-misresponse');
    expect(rule.label).toMatch(/donk lead/);
    expect(rule.relatedConceptId).toBe('flop-vs-donk-defense-cluster');
    expect(rule.threshold.minSampleSize).toBe(30);
    expect(rule.threshold.minSeverity).toBeGreaterThan(0);
    expect(typeof rule.matchesBucket).toBe('function');
    expect(typeof rule.detect).toBe('function');
    expect(typeof rule.solverBaselineKey).toBe('function');
  });
});

// ─── matchesBucket ───────────────────────────────────────────────────────

describe('matchesBucket', () => {
  it('matches LATE position IP defending vs flop bet (pfa — hero raised preflop)', () => {
    expect(rule.matchesBucket('flop:medium:LATE:def:ip:bet:vsBet:pfa')).toBe(true);
  });

  it('matches BUTTON position IP defending vs flop bet (pfa)', () => {
    expect(rule.matchesBucket('flop:dry:BUTTON:def:ip:bet:vsBet:pfa')).toBe(true);
  });

  it('matches across all texture variants', () => {
    expect(rule.matchesBucket('flop:dry:LATE:def:ip:bet:vsBet:pfa')).toBe(true);
    expect(rule.matchesBucket('flop:medium:LATE:def:ip:bet:vsBet:pfa')).toBe(true);
    expect(rule.matchesBucket('flop:wet:LATE:def:ip:bet:vsBet:pfa')).toBe(true);
    expect(rule.matchesBucket('flop:dry:BUTTON:def:ip:bet:vsBet:pfa')).toBe(true);
    expect(rule.matchesBucket('flop:medium:BUTTON:def:ip:bet:vsBet:pfa')).toBe(true);
    expect(rule.matchesBucket('flop:wet:BUTTON:def:ip:bet:vsBet:pfa')).toBe(true);
  });

  it('does NOT match cbet-defense (pfc) — that goes to hero-ip-cbet-overfold', () => {
    expect(rule.matchesBucket('flop:medium:LATE:def:ip:bet:vsBet:pfc')).toBe(false);
    expect(rule.matchesBucket('flop:dry:BUTTON:def:ip:bet:vsBet:pfc')).toBe(false);
  });

  it('does NOT match preflop', () => {
    expect(rule.matchesBucket('preflop:none:LATE:def:ip:bet:vsBet:na')).toBe(false);
  });

  it('does NOT match turn or river (v1 covers flop only)', () => {
    expect(rule.matchesBucket('turn:medium:LATE:def:ip:bet:vsBet:pfa')).toBe(false);
    expect(rule.matchesBucket('river:medium:LATE:def:ip:bet:vsBet:pfa')).toBe(false);
  });

  it('does NOT match OOP positions (SMALL_BLIND/BIG_BLIND/EARLY/MIDDLE)', () => {
    expect(rule.matchesBucket('flop:medium:SMALL_BLIND:def:ip:bet:vsBet:pfa')).toBe(false);
    expect(rule.matchesBucket('flop:medium:BIG_BLIND:def:ip:bet:vsBet:pfa')).toBe(false);
    expect(rule.matchesBucket('flop:medium:EARLY:def:ip:bet:vsBet:pfa')).toBe(false);
  });

  it('does NOT match OOP situations (isIP=oop)', () => {
    expect(rule.matchesBucket('flop:medium:LATE:def:oop:bet:vsBet:pfa')).toBe(false);
  });

  it('does NOT match aggressor situations', () => {
    expect(rule.matchesBucket('flop:medium:LATE:agg:ip:none:cbet:pfa')).toBe(false);
  });

  it('returns false for malformed keys', () => {
    expect(rule.matchesBucket(null)).toBe(false);
    expect(rule.matchesBucket('')).toBe(false);
    expect(rule.matchesBucket('flop:medium:LATE')).toBe(false); // too few segments
    expect(rule.matchesBucket('flop:medium:LATE:def:ip:bet:vsBet')).toBe(false); // 7 axes (pre-SPR-040)
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
      foldCount: 22,
      sampleSize: 29,
      foldRate: 22 / 29,
      foldRateCI: { lower: 0.60, upper: 0.92, mean: 22 / 29 },
    });
    expect(rule.detect(bucket, baselineMediumLate)).toBeNull();
  });

  it('returns null when delta < 5pp threshold', () => {
    // foldRate = 50%, baseline 48% → delta 2pp, below 5pp threshold
    const bucket = buildBucket({
      foldCount: 15,
      sampleSize: 30,
      foldRate: 0.50,
      foldRateCI: { lower: 0.32, upper: 0.68, mean: 0.50 },
    });
    expect(rule.detect(bucket, baselineMediumLate)).toBeNull();
  });

  it('returns null when CI lower bound does NOT exceed baseline', () => {
    // foldRate = 60%, baseline 48%, but CI lower = 45% < baseline → don't fire
    const bucket = buildBucket({
      foldCount: 18,
      sampleSize: 30,
      foldRate: 0.60,
      foldRateCI: { lower: 0.45, upper: 0.75, mean: 0.60 },
    });
    expect(rule.detect(bucket, baselineMediumLate)).toBeNull();
  });
});

// ─── detect — fires correctly ────────────────────────────────────────────

describe('detect — fires when overfold-vs-donk is real + significant', () => {
  it('fires when hero folds 75% to flop donk on medium-LATE with tight CI', () => {
    // baseline 48%, observed 76%, n=40, CI [60%, 87%] — well above baseline
    const bucket = buildBucket({
      foldCount: 30,
      sampleSize: 40,
      foldRate: 0.75,
      foldRateCI: { lower: 0.60, upper: 0.87, mean: 0.75 },
    });
    const leak = rule.detect(bucket, baselineMediumLate);
    expect(leak).not.toBeNull();
    expect(leak.leakRuleId).toBe('hero-flop-vs-donk-misresponse');
    expect(leak.observedRate).toBeCloseTo(0.75, 2);
    expect(leak.solverBaseline).toBe(0.48);
    expect(leak.sampleSize).toBe(40);
    expect(leak.severity).toBeGreaterThan(0);
    expect(leak.evidence.delta).toBeCloseTo(0.27, 2);
    expect(leak.evidence.metric).toBe('foldRate');
  });

  it('CD-5 4 mandatory fields present in fired leak', () => {
    const bucket = buildBucket({
      foldCount: 30,
      sampleSize: 40,
      foldRate: 0.75,
      foldRateCI: { lower: 0.60, upper: 0.87, mean: 0.75 },
    });
    const leak = rule.detect(bucket, baselineMediumLate);
    expect(leak.label).toBeTruthy();
    expect(leak.situationKey).toBeTruthy();
    expect(leak.sampleSize).toBeGreaterThan(0);
    expect(leak.observedRate).toBeTypeOf('number');
    expect(leak.ciLower).toBeTypeOf('number');
    expect(leak.ciUpper).toBeTypeOf('number');
    expect(leak.solverBaseline).toBeTypeOf('number');
    expect(rule.threshold.minSampleSize).toBe(30);
  });

  it('confidence defaults to 0.75 when baseline omits it (donk hedge)', () => {
    const bareBaseline = { baseline: 0.48 };
    const bucket = buildBucket({
      foldCount: 30,
      sampleSize: 40,
      foldRate: 0.75,
      foldRateCI: { lower: 0.60, upper: 0.87, mean: 0.75 },
    });
    const leak = rule.detect(bucket, bareBaseline);
    expect(leak.confidence).toBe(0.75);
  });
});
