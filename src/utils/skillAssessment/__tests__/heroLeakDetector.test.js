/**
 * @file Tests for heroLeakDetector.js — registry-pattern detector.
 */

import { describe, it, expect } from 'vitest';
import { detectHeroLeaks, listRegisteredRules, getRuleById } from '../heroLeakDetector.js';

describe('listRegisteredRules', () => {
  it('returns at least the v1 rule (hero-ip-cbet-overfold)', () => {
    const rules = listRegisteredRules();
    expect(rules).toContain('hero-ip-cbet-overfold');
  });

  it('does NOT register _template.js', () => {
    const rules = listRegisteredRules();
    expect(rules).not.toContain('TEMPLATE-RULE-ID');
  });

  it('returns sorted list (deterministic)', () => {
    const rules = listRegisteredRules();
    const sorted = [...rules].sort();
    expect(rules).toEqual(sorted);
  });
});

describe('getRuleById', () => {
  it('returns the rule for a known id', () => {
    const r = getRuleById('hero-ip-cbet-overfold');
    expect(r).not.toBeNull();
    expect(r.id).toBe('hero-ip-cbet-overfold');
  });

  it('returns null for unknown id', () => {
    expect(getRuleById('nonexistent-rule')).toBeNull();
  });
});

describe('detectHeroLeaks', () => {
  it('returns empty array for null/empty input', () => {
    expect(detectHeroLeaks(null)).toEqual([]);
    expect(detectHeroLeaks({})).toEqual([]);
    expect(detectHeroLeaks({ buckets: {} })).toEqual([]);
  });

  it('does NOT fire for buckets where no rule matches', () => {
    const accumulator = {
      buckets: {
        'preflop:none:EARLY:agg:none:none:open:na': {
          situationKey: 'preflop:none:EARLY:agg:none:none:open:na',
          sampleSize: 100,
          foldCount: 0,
          foldRate: 0,
          foldRateCI: { lower: 0, upper: 0, mean: 0 },
        },
      },
    };
    expect(detectHeroLeaks(accumulator)).toEqual([]);
  });

  it('does NOT fire below sample size floor (n<30)', () => {
    const accumulator = {
      buckets: {
        'flop:medium:LATE:def:ip:bet:vsBet:pfc': {
          situationKey: 'flop:medium:LATE:def:ip:bet:vsBet:pfc',
          sampleSize: 20,
          foldCount: 18,
          foldRate: 0.9,
          foldRateCI: { lower: 0.7, upper: 0.99, mean: 0.9 },
        },
      },
    };
    expect(detectHeroLeaks(accumulator)).toEqual([]);
  });

  it('fires the IP cbet overfold rule when bucket meets criteria', () => {
    const accumulator = {
      buckets: {
        'flop:medium:LATE:def:ip:bet:vsBet:pfc': {
          situationKey: 'flop:medium:LATE:def:ip:bet:vsBet:pfc',
          sampleSize: 50,
          foldCount: 35,
          foldRate: 0.70,
          foldRateCI: { lower: 0.56, upper: 0.84, mean: 0.70 },
        },
      },
    };
    const fired = detectHeroLeaks(accumulator);
    expect(fired.length).toBe(1);
    expect(fired[0].leakRuleId).toBe('hero-ip-cbet-overfold');
  });

  it('honors injected baselineLookup override (test injection)', () => {
    const accumulator = {
      buckets: {
        'flop:medium:LATE:def:ip:bet:vsBet:pfc': {
          situationKey: 'flop:medium:LATE:def:ip:bet:vsBet:pfc',
          sampleSize: 50,
          foldCount: 35,
          foldRate: 0.70,
          foldRateCI: { lower: 0.56, upper: 0.84, mean: 0.70 },
        },
      },
    };
    // Inject a baseline of 0.75 — observed (0.70) is BELOW it, so rule should NOT fire.
    const fired = detectHeroLeaks(accumulator, {
      baselineLookup: () => ({ baseline: 0.75, source: 'injected', confidence: 0.9 }),
    });
    expect(fired).toEqual([]);
  });

  it('skips buckets where baseline lookup returns null', () => {
    const accumulator = {
      buckets: {
        'flop:medium:LATE:def:ip:bet:vsBet:pfc': {
          situationKey: 'flop:medium:LATE:def:ip:bet:vsBet:pfc',
          sampleSize: 50,
          foldCount: 35,
          foldRate: 0.70,
          foldRateCI: { lower: 0.56, upper: 0.84, mean: 0.70 },
        },
      },
    };
    // Override returns null for everything
    const fired = detectHeroLeaks(accumulator, { baselineLookup: () => null });
    expect(fired).toEqual([]);
  });

  it('iterates multiple buckets independently', () => {
    const accumulator = {
      buckets: {
        // This one fires
        'flop:medium:LATE:def:ip:bet:vsBet:pfc': {
          situationKey: 'flop:medium:LATE:def:ip:bet:vsBet:pfc',
          sampleSize: 50,
          foldCount: 35,
          foldRate: 0.70,
          foldRateCI: { lower: 0.56, upper: 0.84, mean: 0.70 },
        },
        // This one doesn't (below threshold)
        'flop:dry:BUTTON:def:ip:bet:vsBet:pfc': {
          situationKey: 'flop:dry:BUTTON:def:ip:bet:vsBet:pfc',
          sampleSize: 50,
          foldCount: 18,
          foldRate: 0.36,
          foldRateCI: { lower: 0.23, upper: 0.51, mean: 0.36 },
        },
      },
    };
    const fired = detectHeroLeaks(accumulator);
    expect(fired.length).toBe(1);
    expect(fired[0].situationKey).toBe('flop:medium:LATE:def:ip:bet:vsBet:pfc');
  });
});
