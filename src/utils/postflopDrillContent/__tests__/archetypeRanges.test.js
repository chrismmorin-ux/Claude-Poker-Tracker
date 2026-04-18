import { describe, test, expect } from 'vitest';
import {
  archetypeRangeFor,
  listArchetypeContexts,
  contextLabel,
} from '../archetypeRanges';
import { rangeWidth, PREFLOP_CHARTS } from '../../pokerCore/rangeMatrix';

describe('archetypeRanges — open', () => {
  test('BTN open returns PREFLOP_CHARTS.BTN content but a fresh copy', () => {
    const range = archetypeRangeFor({ position: 'BTN', action: 'open' });
    expect(range).toBeInstanceOf(Float64Array);
    expect(range.length).toBe(169);
    // Same values as canonical BTN chart.
    for (let i = 0; i < 169; i++) {
      expect(range[i]).toBe(PREFLOP_CHARTS.BTN[i]);
    }
    // Mutating the copy must not mutate the chart.
    range[0] = 0.5;
    expect(PREFLOP_CHARTS.BTN[0]).not.toBe(0.5);
  });

  test('UTG open is tighter than BTN open', () => {
    const utg = archetypeRangeFor({ position: 'UTG', action: 'open' });
    const btn = archetypeRangeFor({ position: 'BTN', action: 'open' });
    expect(rangeWidth(utg)).toBeLessThan(rangeWidth(btn));
  });

  test('throws on unknown position', () => {
    expect(() => archetypeRangeFor({ position: 'ZZZ', action: 'open' })).toThrow();
  });
});

describe('archetypeRanges — call / threeBet / fourBet', () => {
  test('BB call vs BTN is wider than BB call vs UTG', () => {
    const wide = archetypeRangeFor({ position: 'BB', action: 'call', vs: 'BTN' });
    const narrow = archetypeRangeFor({ position: 'BB', action: 'call', vs: 'UTG' });
    expect(rangeWidth(wide)).toBeGreaterThan(rangeWidth(narrow));
  });

  test('BB 3bet vs BTN is narrower than BB call vs BTN', () => {
    const call = archetypeRangeFor({ position: 'BB', action: 'call', vs: 'BTN' });
    const threeBet = archetypeRangeFor({ position: 'BB', action: 'threeBet', vs: 'BTN' });
    expect(rangeWidth(threeBet)).toBeLessThan(rangeWidth(call));
  });

  test('4bet is tighter than 3bet', () => {
    const threeBet = archetypeRangeFor({ position: 'BTN', action: 'threeBet', vs: 'CO' });
    const fourBet = archetypeRangeFor({ position: 'CO', action: 'fourBet', vs: 'BTN' });
    expect(rangeWidth(fourBet)).toBeLessThanOrEqual(rangeWidth(threeBet));
  });

  test('throws when vs is missing for call', () => {
    expect(() => archetypeRangeFor({ position: 'BB', action: 'call' })).toThrow();
  });
});

describe('archetypeRanges — listArchetypeContexts', () => {
  test('includes opens for every chart position', () => {
    const list = listArchetypeContexts();
    const openPositions = list.filter((c) => c.action === 'open').map((c) => c.position);
    expect(openPositions).toEqual(expect.arrayContaining(Object.keys(PREFLOP_CHARTS)));
  });

  test('every listed context resolves without throwing', () => {
    for (const ctx of listArchetypeContexts()) {
      expect(() => archetypeRangeFor(ctx)).not.toThrow();
    }
  });
});

describe('archetypeRanges — contextLabel', () => {
  test('formats open / call / 3bet contexts', () => {
    expect(contextLabel({ position: 'BTN', action: 'open' })).toBe('BTN open');
    expect(contextLabel({ position: 'BB', action: 'call', vs: 'BTN' })).toBe('BB call vs BTN');
    expect(contextLabel({ position: 'BTN', action: 'threeBet', vs: 'CO' })).toBe('BTN 3bet vs CO');
  });
});
