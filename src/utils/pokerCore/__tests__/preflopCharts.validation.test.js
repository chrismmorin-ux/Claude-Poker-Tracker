import { describe, test, expect } from 'vitest';
import { PREFLOP_CHARTS, rangeWidth } from '../rangeMatrix';

describe('PREFLOP_CHARTS width validation', () => {
  // GTO-approximate reference widths from solver data, 9-max 100bb.
  const GTO_WIDTHS = {
    UTG: 10,
    'UTG+1': 14,
    MP1: 15,
    MP2: 18,
    HJ: 20,
    CO: 23,
    BTN: 51,
    SB: 27,
    BB: 37,
  };

  for (const [pos, expected] of Object.entries(GTO_WIDTHS)) {
    test(`${pos} range width ~${expected}% (±5%)`, () => {
      const width = rangeWidth(PREFLOP_CHARTS[pos]);
      expect(width).toBeGreaterThanOrEqual(expected - 5);
      expect(width).toBeLessThanOrEqual(expected + 5);
    });
  }

  test('all 9 positions have charts', () => {
    for (const pos of Object.keys(GTO_WIDTHS)) {
      expect(PREFLOP_CHARTS[pos]).toBeDefined();
      expect(PREFLOP_CHARTS[pos]).toBeInstanceOf(Float64Array);
    }
  });

  test('positions sorted by width: UTG < MP < CO < BTN', () => {
    expect(rangeWidth(PREFLOP_CHARTS.UTG)).toBeLessThan(rangeWidth(PREFLOP_CHARTS.CO));
    expect(rangeWidth(PREFLOP_CHARTS.CO)).toBeLessThan(rangeWidth(PREFLOP_CHARTS.BTN));
  });
});
