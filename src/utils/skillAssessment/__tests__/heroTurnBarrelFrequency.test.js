/**
 * @file Tests for leakRules/heroTurnBarrelFrequency.js — second
 * decision-bucket (aggression-frequency) leak rule. SPR-109 / WS-146 sixth claim.
 * Over-frequency polarity (mirrors heroMultiwayBluffFrequency).
 */

import { describe, it, expect } from 'vitest';
import { rule } from '../leakRules/heroTurnBarrelFrequency.js';

const HU_KEY = 'turn:barrel-decision:hu';

const baseline50 = { baseline: 0.50, source: 'hardcoded', confidence: 0.70, lastValidatedAt: '2026-06-06' };

const buildBucket = (overrides = {}) => ({
  situationKey: HU_KEY,
  aggressCount: 0,
  passCount: 0,
  sampleSize: 0,
  aggressFrequency: 0,
  aggressFrequencyCI: { lower: 0, upper: 0, mean: 0 },
  ...overrides,
});

// ─── Rule signature compliance ───────────────────────────────────────────

describe('hero-turn-barrel-frequency rule signature', () => {
  it('exports a rule object with required fields', () => {
    expect(rule.id).toBe('hero-turn-barrel-frequency');
    expect(rule.label).toMatch(/[Tt]urn/);
    expect(rule.relatedConceptId).toBe('turn-barrel-discipline-cluster');
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
  it('matches the heads-up turn barrel decision bucket', () => {
    expect(rule.matchesBucket('turn:barrel-decision:hu')).toBe(true);
  });

  it('does NOT match the multiway decision bucket (separate future rule)', () => {
    expect(rule.matchesBucket('turn:barrel-decision:mw')).toBe(false);
  });

  it('does NOT match the flop cbet decision bucket', () => {
    expect(rule.matchesBucket('flop:cbet-decision:hu')).toBe(false);
    expect(rule.matchesBucket('flop:cbet-decision:mw')).toBe(false);
  });

  it('does NOT match any 8-axis action key', () => {
    expect(rule.matchesBucket('turn:medium:LATE:agg:ip:none:cbet:pfa')).toBe(false);
    expect(rule.matchesBucket('flop:dry:BUTTON:agg:ip:none:cbet:pfa')).toBe(false);
  });

  it('returns false for malformed keys', () => {
    expect(rule.matchesBucket(null)).toBe(false);
    expect(rule.matchesBucket('')).toBe(false);
    expect(rule.matchesBucket('turn:barrel-decision')).toBe(false);
  });
});

// ─── detect — gating logic ───────────────────────────────────────────────

describe('detect — gating logic', () => {
  it('returns null when baseline is missing', () => {
    const bucket = buildBucket({ aggressCount: 40, passCount: 10, sampleSize: 50, aggressFrequency: 0.8 });
    expect(rule.detect(bucket, null)).toBeNull();
  });

  it('returns null when sampleSize < 30 (AP-SCF-04 floor)', () => {
    const bucket = buildBucket({
      aggressCount: 22,
      passCount: 7,
      sampleSize: 29,
      aggressFrequency: 22 / 29,
      aggressFrequencyCI: { lower: 0.58, upper: 0.88, mean: 22 / 29 },
    });
    expect(rule.detect(bucket, baseline50)).toBeNull();
  });

  it('returns null when delta < 5pp threshold (within noise of baseline)', () => {
    // aggressFrequency 53%, baseline 50% → delta 3pp, below threshold
    const bucket = buildBucket({
      aggressCount: 27,
      passCount: 23,
      sampleSize: 50,
      aggressFrequency: 0.53,
      aggressFrequencyCI: { lower: 0.39, upper: 0.67, mean: 0.53 },
    });
    expect(rule.detect(bucket, baseline50)).toBeNull();
  });

  it('returns null when CI lower bound does NOT exceed baseline (noisy data)', () => {
    // aggressFrequency 62% but CI lower 0.48 < baseline 0.50
    const bucket = buildBucket({
      aggressCount: 31,
      passCount: 19,
      sampleSize: 50,
      aggressFrequency: 0.62,
      aggressFrequencyCI: { lower: 0.48, upper: 0.74, mean: 0.62 },
    });
    expect(rule.detect(bucket, baseline50)).toBeNull();
  });
});

// ─── detect — fires correctly (OVER-frequency polarity) ──────────────────

describe('detect — fires when turn over-barreling is real + significant', () => {
  const overBucket = () => buildBucket({
    aggressCount: 60,
    passCount: 20,
    sampleSize: 80,
    aggressFrequency: 0.75,
    aggressFrequencyCI: { lower: 0.65, upper: 0.85, mean: 0.75 },
  });

  it('fires when barrel frequency exceeds baseline + delta AND CI agrees', () => {
    const leak = rule.detect(overBucket(), baseline50);
    expect(leak).not.toBeNull();
    expect(leak.leakRuleId).toBe('hero-turn-barrel-frequency');
    expect(leak.observedRate).toBe(0.75);
    expect(leak.solverBaseline).toBe(0.50);
    expect(leak.sampleSize).toBe(80);
    expect(leak.severity).toBeGreaterThan(0);
    expect(leak.evidence.delta).toBeCloseTo(0.25, 2);
    expect(leak.evidence.metric).toBe('barrelFrequency');
  });

  it('includes CD-5 4 mandatory fields in fired leak', () => {
    const leak = rule.detect(overBucket(), baseline50);
    expect(leak.label).toBeTruthy();
    expect(leak.situationKey).toBe('turn:barrel-decision:hu');
    expect(leak.sampleSize).toBeGreaterThan(0);
    expect(leak.observedRate).toBeTypeOf('number');
    expect(leak.ciLower).toBeTypeOf('number');
    expect(leak.ciUpper).toBeTypeOf('number');
    expect(leak.solverBaseline).toBeTypeOf('number');
    expect(rule.threshold.minSampleSize).toBe(30);
  });

  it('binds to the turn-barrel-discipline umbrella concept', () => {
    const leak = rule.detect(overBucket(), baseline50);
    expect(leak.relatedConceptId).toBe('turn-barrel-discipline-cluster');
  });
});
