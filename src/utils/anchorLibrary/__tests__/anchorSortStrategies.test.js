/**
 * anchorSortStrategies.test.js — sort strategy + AP-01 refusal coverage.
 *
 * EAL Phase 6 — Session 19 (S19).
 */

import { describe, it, expect } from 'vitest';
import {
  SORT_STRATEGIES,
  VALID_SORT_STRATEGIES,
  DEFAULT_SORT_STRATEGY,
  SORT_STRATEGY_LABELS,
  applySortStrategy,
} from '../anchorSortStrategies';

const a = (overrides = {}) => ({ archetypeName: 'X', ...overrides });

describe('SORT_STRATEGIES enum (AP-01 refusal)', () => {
  it('exposes exactly 3 strategies', () => {
    expect(VALID_SORT_STRATEGIES.length).toBe(3);
  });

  it('does NOT expose a "biggest-edge" or "highest-confidence" strategy (AP-01)', () => {
    // The leaderboard-by-edge default is the canonical anti-pattern at AP-01.
    expect(VALID_SORT_STRATEGIES).not.toContain('biggest-edge');
    expect(VALID_SORT_STRATEGIES).not.toContain('highest-confidence');
    expect(VALID_SORT_STRATEGIES).not.toContain('biggest-dividend');
    expect(VALID_SORT_STRATEGIES).not.toContain('highest-edge');
    // The strategy keys collection does not include any value matching /edge/i.
    expect(VALID_SORT_STRATEGIES.some((k) => /edge/i.test(k))).toBe(false);
    expect(VALID_SORT_STRATEGIES.some((k) => /confidence/i.test(k))).toBe(false);
  });

  it('default is alphabetical (not edge-descending)', () => {
    expect(DEFAULT_SORT_STRATEGY).toBe(SORT_STRATEGIES.ALPHABETICAL);
    expect(DEFAULT_SORT_STRATEGY).toBe('alphabetical');
  });

  it('every label exists for every strategy', () => {
    for (const strategy of VALID_SORT_STRATEGIES) {
      expect(typeof SORT_STRATEGY_LABELS[strategy]).toBe('string');
      expect(SORT_STRATEGY_LABELS[strategy].length).toBeGreaterThan(0);
    }
  });

  it('label for default explicitly says "(default)"', () => {
    // Owner discoverability — visible default marker.
    expect(SORT_STRATEGY_LABELS[DEFAULT_SORT_STRATEGY]).toMatch(/default/i);
  });
});

describe('applySortStrategy — alphabetical (default)', () => {
  it('sorts by archetypeName ascending, case-insensitive', () => {
    const out = applySortStrategy(
      [a({ archetypeName: 'Charlie' }), a({ archetypeName: 'alpha' }), a({ archetypeName: 'Bravo' })],
      'alphabetical',
    );
    expect(out.map((x) => x.archetypeName)).toEqual(['alpha', 'Bravo', 'Charlie']);
  });

  it('sinks empty/missing names to the end (does NOT promote them)', () => {
    const out = applySortStrategy(
      [a({ archetypeName: '' }), a({ archetypeName: 'Bravo' }), a({ archetypeName: 'Alpha' })],
      'alphabetical',
    );
    expect(out.map((x) => x.archetypeName)).toEqual(['Alpha', 'Bravo', '']);
  });

  it('returns a new array (does not mutate input)', () => {
    const input = [a({ archetypeName: 'B' }), a({ archetypeName: 'A' })];
    const out = applySortStrategy(input, 'alphabetical');
    expect(input.map((x) => x.archetypeName)).toEqual(['B', 'A']);
    expect(out.map((x) => x.archetypeName)).toEqual(['A', 'B']);
  });
});

describe('applySortStrategy — last-fired', () => {
  it('sorts by validation.lastFiredAt descending (newer first)', () => {
    const out = applySortStrategy(
      [
        a({ archetypeName: 'A', validation: { lastFiredAt: '2026-04-01T00:00:00Z' } }),
        a({ archetypeName: 'B', validation: { lastFiredAt: '2026-04-25T00:00:00Z' } }),
        a({ archetypeName: 'C', validation: { lastFiredAt: '2026-04-15T00:00:00Z' } }),
      ],
      'last-fired',
    );
    expect(out.map((x) => x.archetypeName)).toEqual(['B', 'C', 'A']);
  });

  it('falls back to validation.lastFiringAt when lastFiredAt missing', () => {
    const out = applySortStrategy(
      [
        a({ archetypeName: 'A', validation: { lastFiringAt: '2026-04-25T00:00:00Z' } }),
        a({ archetypeName: 'B', validation: { lastFiringAt: '2026-04-01T00:00:00Z' } }),
      ],
      'last-fired',
    );
    expect(out.map((x) => x.archetypeName)).toEqual(['A', 'B']);
  });

  it('sinks anchors with no lastFiredAt to the end', () => {
    const out = applySortStrategy(
      [
        a({ archetypeName: 'A' }),
        a({ archetypeName: 'B', validation: { lastFiredAt: '2026-04-25T00:00:00Z' } }),
      ],
      'last-fired',
    );
    expect(out.map((x) => x.archetypeName)).toEqual(['B', 'A']);
  });

  it('alphabetical tiebreak when timestamps are equal', () => {
    const ts = '2026-04-25T00:00:00Z';
    const out = applySortStrategy(
      [
        a({ archetypeName: 'Charlie', validation: { lastFiredAt: ts } }),
        a({ archetypeName: 'Alpha', validation: { lastFiredAt: ts } }),
        a({ archetypeName: 'Bravo', validation: { lastFiredAt: ts } }),
      ],
      'last-fired',
    );
    expect(out.map((x) => x.archetypeName)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('treats malformed ISO strings as never-fired (sinks)', () => {
    const out = applySortStrategy(
      [
        a({ archetypeName: 'A', validation: { lastFiredAt: 'not-a-date' } }),
        a({ archetypeName: 'B', validation: { lastFiredAt: '2026-04-25T00:00:00Z' } }),
      ],
      'last-fired',
    );
    expect(out.map((x) => x.archetypeName)).toEqual(['B', 'A']);
  });
});

describe('applySortStrategy — sample-size', () => {
  it('sorts by evidence.sampleSize descending (largest first)', () => {
    const out = applySortStrategy(
      [
        a({ archetypeName: 'A', evidence: { sampleSize: 5 } }),
        a({ archetypeName: 'B', evidence: { sampleSize: 100 } }),
        a({ archetypeName: 'C', evidence: { sampleSize: 30 } }),
      ],
      'sample-size',
    );
    expect(out.map((x) => x.archetypeName)).toEqual(['B', 'C', 'A']);
  });

  it('falls back to evidence.observationCount when sampleSize missing', () => {
    const out = applySortStrategy(
      [
        a({ archetypeName: 'A', evidence: { observationCount: 50 } }),
        a({ archetypeName: 'B', evidence: { observationCount: 10 } }),
      ],
      'sample-size',
    );
    expect(out.map((x) => x.archetypeName)).toEqual(['A', 'B']);
  });

  it('sinks anchors with no sample/observation count', () => {
    const out = applySortStrategy(
      [
        a({ archetypeName: 'A' }),
        a({ archetypeName: 'B', evidence: { sampleSize: 7 } }),
      ],
      'sample-size',
    );
    expect(out.map((x) => x.archetypeName)).toEqual(['B', 'A']);
  });

  it('alphabetical tiebreak when sampleSize equal', () => {
    const out = applySortStrategy(
      [
        a({ archetypeName: 'Charlie', evidence: { sampleSize: 10 } }),
        a({ archetypeName: 'Alpha', evidence: { sampleSize: 10 } }),
      ],
      'sample-size',
    );
    expect(out.map((x) => x.archetypeName)).toEqual(['Alpha', 'Charlie']);
  });
});

describe('applySortStrategy — defensive', () => {
  it('returns [] for non-array input', () => {
    expect(applySortStrategy(null, 'alphabetical')).toEqual([]);
    expect(applySortStrategy(undefined, 'alphabetical')).toEqual([]);
    expect(applySortStrategy('oops', 'alphabetical')).toEqual([]);
  });

  it('falls back to alphabetical for unknown strategy', () => {
    const out = applySortStrategy(
      [a({ archetypeName: 'C' }), a({ archetypeName: 'A' }), a({ archetypeName: 'B' })],
      'mystery-strategy',
    );
    expect(out.map((x) => x.archetypeName)).toEqual(['A', 'B', 'C']);
  });
});
