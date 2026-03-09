import { describe, test, expect } from 'vitest';
import {
  createRange, rangeIndex, decodeIndex,
  PREFLOP_CHARTS, rangeWidth,
  enumerateCombos,
} from '../rangeMatrix';

describe('rangeMatrix', () => {
  test('createRange returns 169-element array of zeros', () => {
    const range = createRange();
    expect(range.length).toBe(169);
    expect(range.every(v => v === 0)).toBe(true);
  });

  test('rangeIndex/decodeIndex roundtrip for pairs', () => {
    for (let r = 0; r < 13; r++) {
      const idx = rangeIndex(r, r, false);
      const decoded = decodeIndex(idx);
      expect(decoded.isPair).toBe(true);
      expect(decoded.rank1).toBe(r);
    }
  });

  test('suited and offsuit have different indices', () => {
    const suitedIdx = rangeIndex(12, 11, true); // AKs
    const offsuitIdx = rangeIndex(12, 11, false); // AKo
    expect(suitedIdx).not.toBe(offsuitIdx);
  });

  describe('PREFLOP_CHARTS', () => {
    test('UTG range is narrower than BTN', () => {
      const utgWidth = rangeWidth(PREFLOP_CHARTS.UTG);
      const btnWidth = rangeWidth(PREFLOP_CHARTS.BTN);
      expect(utgWidth).toBeLessThan(btnWidth);
    });

    test('UTG range is approximately 15%', () => {
      const width = rangeWidth(PREFLOP_CHARTS.UTG);
      expect(width).toBeGreaterThan(8);
      expect(width).toBeLessThan(22);
    });

    test('BTN range is approximately 45%', () => {
      const width = rangeWidth(PREFLOP_CHARTS.BTN);
      expect(width).toBeGreaterThan(30);
      expect(width).toBeLessThan(55);
    });

    test('all positions have charts', () => {
      const positions = ['UTG', 'UTG+1', 'MP1', 'MP2', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
      for (const pos of positions) {
        expect(PREFLOP_CHARTS[pos]).toBeDefined();
        expect(rangeWidth(PREFLOP_CHARTS[pos])).toBeGreaterThan(0);
      }
    });
  });

  describe('enumerateCombos', () => {
    test('pair produces 6 combos', () => {
      const range = createRange();
      range[rangeIndex(12, 12, false)] = 1.0; // AA
      const combos = enumerateCombos(range);
      expect(combos.length).toBe(6);
    });

    test('suited hand produces 4 combos', () => {
      const range = createRange();
      range[rangeIndex(12, 11, true)] = 1.0; // AKs
      const combos = enumerateCombos(range);
      expect(combos.length).toBe(4);
    });

    test('offsuit hand produces 12 combos', () => {
      const range = createRange();
      range[rangeIndex(12, 11, false)] = 1.0; // AKo
      const combos = enumerateCombos(range);
      expect(combos.length).toBe(12);
    });

    test('dead cards reduce combos', () => {
      const range = createRange();
      range[rangeIndex(12, 12, false)] = 1.0; // AA
      const deadCards = [48]; // One ace is dead (encodeCard(12, 0) = 48)
      const combos = enumerateCombos(range, deadCards);
      expect(combos.length).toBe(3); // 6 - 3 combos involving that card
    });
  });
});
