/**
 * @file Tests for learningStateDescriber.js — descriptor rollup logic +
 * forbidden-rank-label lint. Per WS-148 / SPR-033.
 */

import { describe, it, expect } from 'vitest';
import {
  describeLearningState,
  FORBIDDEN_RANK_LABELS,
} from '../learningStateDescriber.js';
import { DEFAULT_WEIGHTS, DEFAULT_TOGGLES } from '../composite.js';

const baseMastery = (conceptId, overrides = {}) => ({
  conceptId,
  leakSignal: { hasFiredLeak: false, severity: 0, sampleSize: 0 },
  drillSignal: { mastery: 0, attemptCount: 0, lastAttemptAt: null },
  testSignal: { mastery: 0, attemptCount: 0, lastAttemptAt: null },
  recencyPenalty: 0,
  meta: { kind: 'general-skill', tier: 1 },
  ...overrides,
});

describe('learningStateDescriber — empty / no-focus cases', () => {
  it('handles empty input', () => {
    const result = describeLearningState([]);
    expect(result.summary).toBe('no active focus');
    expect(result.focusConcepts).toEqual([]);
    expect(result.composition.conceptContributions).toEqual([]);
  });

  it('handles input where all composites are zero', () => {
    const masteries = [
      baseMastery('a', {
        drillSignal: { mastery: 1.0, attemptCount: 100, lastAttemptAt: null },
        testSignal:  { mastery: 1.0, attemptCount: 100, lastAttemptAt: null },
      }),
    ];
    const result = describeLearningState(masteries);
    expect(result.summary).toBe('no active focus');
    expect(result.focusConcepts).toEqual([]);
  });
});

describe('learningStateDescriber — general granularity', () => {
  it('walks up to umbrella for sub-concept top focus', () => {
    const masteries = [
      baseMastery('ip-cbet-defense-dry-LATE', {
        leakSignal: { hasFiredLeak: true, severity: 0.8, sampleSize: 30 },
        meta: { kind: 'rule-anchored-specific', tier: 3, parent: 'cbet-defense-cluster' },
      }),
    ];
    const result = describeLearningState(masteries, { granularity: 'general' });
    expect(result.summary).toMatch(/cbet defense/);
    expect(result.summary).not.toMatch(/dry|LATE/i);
    expect(result.focusConcepts).toEqual(['ip-cbet-defense-dry-LATE']);
  });

  it('uses concept itself when it has no parent (general-skill)', () => {
    const masteries = [
      baseMastery('pot-odds', {
        leakSignal: { hasFiredLeak: true, severity: 0.6, sampleSize: 30 },
        meta: { kind: 'general-skill', tier: 1 },
      }),
    ];
    const result = describeLearningState(masteries, { granularity: 'general' });
    expect(result.summary).toMatch(/pot odds/);
  });

  it('returns only the top focus in conceptContributions for general', () => {
    const masteries = [
      baseMastery('a', { leakSignal: { hasFiredLeak: true, severity: 0.9, sampleSize: 30 } }),
      baseMastery('b', { leakSignal: { hasFiredLeak: true, severity: 0.5, sampleSize: 30 } }),
      baseMastery('c', { leakSignal: { hasFiredLeak: true, severity: 0.3, sampleSize: 30 } }),
    ];
    const result = describeLearningState(masteries, { granularity: 'general' });
    expect(result.composition.conceptContributions).toHaveLength(1);
    expect(result.composition.conceptContributions[0].conceptId).toBe('a');
  });
});

describe('learningStateDescriber — specific granularity', () => {
  it('lists multiple focus concepts', () => {
    const masteries = [
      baseMastery('a', { leakSignal: { hasFiredLeak: true, severity: 0.9, sampleSize: 30 } }),
      baseMastery('b', { leakSignal: { hasFiredLeak: true, severity: 0.7, sampleSize: 30 } }),
      baseMastery('c', { leakSignal: { hasFiredLeak: true, severity: 0.5, sampleSize: 30 } }),
    ];
    const result = describeLearningState(masteries, { granularity: 'specific' });
    expect(result.summary).toMatch(/attention on/);
    expect(result.focusConcepts).toEqual(['a', 'b', 'c']);
  });

  it('caps at top 5 concepts', () => {
    const masteries = Array.from({ length: 10 }).map((_, i) =>
      baseMastery(`c${i}`, {
        leakSignal: { hasFiredLeak: true, severity: 0.9 - i * 0.05, sampleSize: 30 },
      }),
    );
    const result = describeLearningState(masteries, { granularity: 'specific' });
    expect(result.focusConcepts).toHaveLength(5);
    expect(result.focusConcepts[0]).toBe('c0');
  });

  it('formats summary correctly for 1, 2, and 3+ concepts', () => {
    const single = describeLearningState(
      [baseMastery('a', { leakSignal: { hasFiredLeak: true, severity: 0.9, sampleSize: 30 } })],
      { granularity: 'specific' },
    );
    expect(single.summary).toBe('attention on a');

    const double = describeLearningState(
      [
        baseMastery('a', { leakSignal: { hasFiredLeak: true, severity: 0.9, sampleSize: 30 } }),
        baseMastery('b', { leakSignal: { hasFiredLeak: true, severity: 0.7, sampleSize: 30 } }),
      ],
      { granularity: 'specific' },
    );
    expect(double.summary).toBe('attention on a and b');

    const triple = describeLearningState(
      [
        baseMastery('a', { leakSignal: { hasFiredLeak: true, severity: 0.9, sampleSize: 30 } }),
        baseMastery('b', { leakSignal: { hasFiredLeak: true, severity: 0.7, sampleSize: 30 } }),
        baseMastery('c', { leakSignal: { hasFiredLeak: true, severity: 0.5, sampleSize: 30 } }),
      ],
      { granularity: 'specific' },
    );
    expect(triple.summary).toBe('attention on a, b, and c');
  });
});

describe('learningStateDescriber — composition transparency (CD-5)', () => {
  it('exposes the weights and toggles used', () => {
    const masteries = [baseMastery('a', { leakSignal: { hasFiredLeak: true, severity: 0.5, sampleSize: 30 } })];
    const result = describeLearningState(masteries);
    expect(result.composition.weightsUsed).toEqual(DEFAULT_WEIGHTS);
    expect(result.composition.togglesUsed).toEqual(DEFAULT_TOGGLES);
  });

  it('exposes per-concept signal breakdown', () => {
    const masteries = [baseMastery('a', { leakSignal: { hasFiredLeak: true, severity: 0.6, sampleSize: 30 } })];
    const result = describeLearningState(masteries);
    expect(result.composition.conceptContributions[0].signalBreakdown).toMatchObject({
      leak: expect.any(Number),
      drill: expect.any(Number),
      test: expect.any(Number),
      recent: expect.any(Number),
    });
  });

  it('honors weight + toggle overrides in composition', () => {
    const masteries = [baseMastery('a', { leakSignal: { hasFiredLeak: true, severity: 0.6, sampleSize: 30 } })];
    const result = describeLearningState(masteries, {
      weights: { W_leak: 1.0 },
      toggles: { enableDrill: false },
    });
    expect(result.composition.weightsUsed.W_leak).toBe(1.0);
    expect(result.composition.togglesUsed.enableDrill).toBe(false);
  });
});

describe('learningStateDescriber — autonomy red line #5 (no rank labels)', () => {
  it('summary text never contains forbidden rank labels', () => {
    // Compose a stress-test input with concepts spanning all tiers.
    const masteries = [
      baseMastery('pot-odds', {
        leakSignal: { hasFiredLeak: true, severity: 0.9, sampleSize: 30 },
        meta: { kind: 'general-skill', tier: 1 },
      }),
      baseMastery('cbet-defense-cluster', {
        leakSignal: { hasFiredLeak: true, severity: 0.7, sampleSize: 30 },
        meta: { kind: 'rule-anchored-umbrella', tier: 3 },
      }),
      baseMastery('blocker-effects-preflop', {
        leakSignal: { hasFiredLeak: true, severity: 0.5, sampleSize: 30 },
        meta: { kind: 'general-skill', tier: 4 },
      }),
      baseMastery('capped-vs-uncapped-ranges', {
        leakSignal: { hasFiredLeak: true, severity: 0.3, sampleSize: 30 },
        meta: { kind: 'general-skill', tier: 5 },
      }),
    ];
    const general = describeLearningState(masteries, { granularity: 'general' });
    const specific = describeLearningState(masteries, { granularity: 'specific' });

    for (const label of FORBIDDEN_RANK_LABELS) {
      expect(general.summary.toLowerCase()).not.toContain(label);
      expect(specific.summary.toLowerCase()).not.toContain(label);
    }
  });

  it('FORBIDDEN_RANK_LABELS is frozen', () => {
    expect(Object.isFrozen(FORBIDDEN_RANK_LABELS)).toBe(true);
  });
});
