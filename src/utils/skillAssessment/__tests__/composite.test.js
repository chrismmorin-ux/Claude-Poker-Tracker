/**
 * @file Tests for composite.js — composite-signal formula + next-teachable
 * concept selection. Per WS-148 / SPR-033.
 */

import { describe, it, expect, vi } from 'vitest';

const mockMasteries = vi.hoisted(() => ({ records: [] }));

vi.mock('../conceptMastery.js', () => ({
  listAllConceptMastery: async () => mockMasteries.records,
}));

const {
  DEFAULT_WEIGHTS,
  DEFAULT_TOGGLES,
  computeComposites,
  pickNextTeachableConcept,
} = await import('../composite.js');

const baseMastery = (conceptId, overrides = {}) => ({
  conceptId,
  leakSignal: { hasFiredLeak: false, severity: 0, sampleSize: 0 },
  drillSignal: { mastery: 0, attemptCount: 0, lastAttemptAt: null },
  testSignal: { mastery: 0, attemptCount: 0, lastAttemptAt: null },
  recencyPenalty: 0,
  meta: { kind: 'general-skill', tier: 1 },
  ...overrides,
});

describe('composite — defaults', () => {
  it('DEFAULT_WEIGHTS matches SCF Gate 4 v1 spec', () => {
    expect(DEFAULT_WEIGHTS).toEqual({ W_leak: 0.5, W_drill: 0.3, W_test: 0.15, W_recent: 0.05 });
  });

  it('DEFAULT_TOGGLES are all on', () => {
    expect(DEFAULT_TOGGLES).toEqual({
      enableLeak: true,
      enableDrill: true,
      enableTest: true,
      enableRecent: true,
    });
  });

  it('default weights are frozen', () => {
    expect(Object.isFrozen(DEFAULT_WEIGHTS)).toBe(true);
    expect(Object.isFrozen(DEFAULT_TOGGLES)).toBe(true);
  });
});

describe('composite — computeComposites formula', () => {
  it('returns a record per input mastery', () => {
    const inputs = [baseMastery('a'), baseMastery('b'), baseMastery('c')];
    const out = computeComposites(inputs);
    expect(out).toHaveLength(3);
    expect(out.map((r) => r.conceptId)).toEqual(['a', 'b', 'c']);
  });

  it('all-zero input yields cold-start score (max drill + test gap)', () => {
    // Per SCF G4 §SCF-G4-SPINE: an unattempted concept has 0 mastery,
    // so (1 - mastery) = 1.0 contributes W_drill + W_test = 0.3 + 0.15.
    // Cold-start concepts naturally rise — that's the curriculum-spine intent.
    const out = computeComposites([baseMastery('a')]);
    expect(out[0].compositeScore).toBeCloseTo(0.45);
    expect(out[0].breakdown).toEqual({ leak: 0, drill: 0.3, test: 0.15, recent: 0 });
  });

  it('fired leak with severity contributes W_leak * severity', () => {
    const m = baseMastery('a', { leakSignal: { hasFiredLeak: true, severity: 0.6, sampleSize: 30 } });
    const out = computeComposites([m]);
    expect(out[0].breakdown.leak).toBeCloseTo(0.5 * 0.6); // 0.3
  });

  it('drill gap contributes W_drill * (1 - mastery)', () => {
    const m = baseMastery('a', { drillSignal: { mastery: 0.4, attemptCount: 10, lastAttemptAt: null } });
    const out = computeComposites([m]);
    expect(out[0].breakdown.drill).toBeCloseTo(0.3 * 0.6); // 0.18
  });

  it('recency penalty subtracts from score', () => {
    const m = baseMastery('a', {
      leakSignal: { hasFiredLeak: true, severity: 1.0, sampleSize: 30 },
      recencyPenalty: 1.0,
    });
    const out = computeComposites([m]);
    expect(out[0].breakdown.leak).toBeCloseTo(0.5);
    expect(out[0].breakdown.recent).toBeCloseTo(0.05);
    // Total: leak 0.5 + drill 0.3 (1-0 mastery) + test 0.15 (1-0 mastery) - recent 0.05 = 0.9
    expect(out[0].compositeScore).toBeCloseTo(0.9);
  });

  it('disabling a toggle zeroes that signal contribution', () => {
    const m = baseMastery('a', { leakSignal: { hasFiredLeak: true, severity: 0.6, sampleSize: 30 } });
    const out = computeComposites([m], { toggles: { enableLeak: false } });
    expect(out[0].breakdown.leak).toBe(0);
    // drill + test still contribute cold-start gap (0.3 + 0.15 = 0.45).
    expect(out[0].compositeScore).toBeCloseTo(0.45);
  });

  it('weight overrides apply', () => {
    const m = baseMastery('a', { leakSignal: { hasFiredLeak: true, severity: 0.8, sampleSize: 30 } });
    const out = computeComposites([m], { weights: { W_leak: 1.0 } });
    expect(out[0].breakdown.leak).toBeCloseTo(0.8);
  });

  it('conceptKindFilter narrows the input set', () => {
    const inputs = [
      baseMastery('a', { meta: { kind: 'general-skill', tier: 1 } }),
      baseMastery('b', { meta: { kind: 'rule-anchored-umbrella', tier: 3 } }),
      baseMastery('c', { meta: { kind: 'rule-anchored-specific', tier: 3, parent: 'b' } }),
    ];
    const out = computeComposites(inputs, {
      conceptKindFilter: (m) => m.meta.kind === 'rule-anchored-umbrella',
    });
    expect(out).toHaveLength(1);
    expect(out[0].conceptId).toBe('b');
  });
});

describe('composite — pickNextTeachableConcept', () => {
  it('returns null when no concepts', async () => {
    mockMasteries.records = [];
    const result = await pickNextTeachableConcept('user1');
    expect(result).toBeNull();
  });

  it('picks the highest-composite-score concept', async () => {
    mockMasteries.records = [
      baseMastery('low', { drillSignal: { mastery: 0.9, attemptCount: 50, lastAttemptAt: null } }),
      baseMastery('high', { leakSignal: { hasFiredLeak: true, severity: 0.8, sampleSize: 30 } }),
      baseMastery('medium', { drillSignal: { mastery: 0.5, attemptCount: 20, lastAttemptAt: null } }),
    ];
    const result = await pickNextTeachableConcept('user1');
    expect(result.conceptId).toBe('high');
  });

  it('tie-breaks alphabetically by conceptId for determinism', async () => {
    mockMasteries.records = [
      baseMastery('zebra', { leakSignal: { hasFiredLeak: true, severity: 0.5, sampleSize: 30 } }),
      baseMastery('alpha', { leakSignal: { hasFiredLeak: true, severity: 0.5, sampleSize: 30 } }),
    ];
    const result = await pickNextTeachableConcept('user1');
    expect(result.conceptId).toBe('alpha');
  });

  it('respects toggles + weights', async () => {
    mockMasteries.records = [
      // leak-driven: leak fires high, drill is fully mastered (low gap).
      baseMastery('leak-driven', {
        leakSignal: { hasFiredLeak: true, severity: 0.9, sampleSize: 30 },
        drillSignal: { mastery: 1.0, attemptCount: 100, lastAttemptAt: null },
        testSignal:  { mastery: 1.0, attemptCount: 100, lastAttemptAt: null },
      }),
      // drill-driven: no leak, drill is poor.
      baseMastery('drill-driven', {
        drillSignal: { mastery: 0.1, attemptCount: 50, lastAttemptAt: null },
        testSignal:  { mastery: 1.0, attemptCount: 100, lastAttemptAt: null },
      }),
    ];
    // With leak enabled, leak-driven wins (W_leak * 0.9 = 0.45 vs 0.27).
    const withLeak = await pickNextTeachableConcept('user1');
    expect(withLeak.conceptId).toBe('leak-driven');

    // With leak disabled, drill-driven wins (0.27 vs 0).
    const withoutLeak = await pickNextTeachableConcept('user1', { toggles: { enableLeak: false } });
    expect(withoutLeak.conceptId).toBe('drill-driven');
  });
});
