import { describe, it, expect } from 'vitest';
import {
  rankFromChar, rangeIndex, decodeIndex, parseRangeString,
  PREFLOP_CHARTS, getPositionName, parseHoleCards, heroHandIndex,
  rangeWidth, getDefendingRange,
} from '../range-grid-data.js';

describe('range-grid-data', () => {
  describe('rankFromChar', () => {
    it('maps rank characters correctly', () => {
      expect(rankFromChar('2')).toBe(0);
      expect(rankFromChar('A')).toBe(12);
      expect(rankFromChar('T')).toBe(8);
      expect(rankFromChar('K')).toBe(11);
    });
  });

  describe('rangeIndex', () => {
    it('pairs on diagonal', () => {
      expect(rangeIndex(12, 12, false)).toBe(12 * 13 + 12); // AA
      expect(rangeIndex(0, 0, false)).toBe(0);               // 22
    });

    it('suited in upper triangle', () => {
      // AKs: high=12, low=11, suited → 12*13+11=167
      expect(rangeIndex(12, 11, true)).toBe(167);
    });

    it('offsuit in lower triangle', () => {
      // AKo: high=12, low=11, offsuit → 11*13+12=155
      expect(rangeIndex(12, 11, false)).toBe(155);
    });

    it('order-independent', () => {
      expect(rangeIndex(11, 12, true)).toBe(rangeIndex(12, 11, true));
      expect(rangeIndex(5, 8, false)).toBe(rangeIndex(8, 5, false));
    });
  });

  describe('decodeIndex', () => {
    it('decodes pairs', () => {
      const aa = decodeIndex(12 * 13 + 12);
      expect(aa.isPair).toBe(true);
      expect(aa.rank1).toBe(12);
    });

    it('decodes suited hands', () => {
      const aks = decodeIndex(167); // AKs
      expect(aks.suited).toBe(true);
      expect(aks.rank1).toBe(12);
      expect(aks.rank2).toBe(11);
    });

    it('decodes offsuit hands', () => {
      const ako = decodeIndex(155); // AKo
      expect(ako.suited).toBe(false);
      expect(ako.rank1).toBe(12);
      expect(ako.rank2).toBe(11);
    });

    it('roundtrips with rangeIndex', () => {
      for (let i = 0; i < 169; i++) {
        const { rank1, rank2, suited } = decodeIndex(i);
        expect(rangeIndex(rank1, rank2, suited)).toBe(i);
      }
    });
  });

  describe('PREFLOP_CHARTS', () => {
    it('has all 9 positions', () => {
      const keys = ['UTG', 'UTG+1', 'MP1', 'MP2', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
      for (const k of keys) {
        expect(PREFLOP_CHARTS[k]).toBeDefined();
        expect(PREFLOP_CHARTS[k].length).toBe(169);
      }
    });

    it('UTG is tighter than BTN', () => {
      expect(rangeWidth(PREFLOP_CHARTS.UTG)).toBeLessThan(rangeWidth(PREFLOP_CHARTS.BTN));
    });

    it('UTG range is ~10-15%', () => {
      const w = rangeWidth(PREFLOP_CHARTS.UTG);
      expect(w).toBeGreaterThanOrEqual(10);
      expect(w).toBeLessThan(20);
    });

    it('BTN range is ~40-50%', () => {
      const w = rangeWidth(PREFLOP_CHARTS.BTN);
      expect(w).toBeGreaterThan(35);
      expect(w).toBeLessThan(55);
    });

    it('AA is in every range', () => {
      const aaIdx = rangeIndex(12, 12, false);
      for (const [, range] of Object.entries(PREFLOP_CHARTS)) {
        expect(range[aaIdx]).toBe(1.0);
      }
    });
  });

  describe('getPositionName', () => {
    it('button seat is BTN', () => {
      expect(getPositionName(5, 5)).toBe('BTN');
    });

    it('seat after button is SB', () => {
      expect(getPositionName(6, 5)).toBe('SB');
    });

    it('two after button is BB', () => {
      expect(getPositionName(7, 5)).toBe('BB');
    });

    it('wraps around seat 9', () => {
      expect(getPositionName(9, 8)).toBe('SB');
      expect(getPositionName(1, 8)).toBe('BB');
      expect(getPositionName(2, 8)).toBe('UTG');
    });

    it('returns null for invalid input', () => {
      expect(getPositionName(null, 1)).toBe(null);
      expect(getPositionName(0, 1)).toBe(null);
      expect(getPositionName(10, 1)).toBe(null);
    });
  });

  describe('parseHoleCards', () => {
    it('parses AKo', () => {
      const result = parseHoleCards(['A\u2660', 'K\u2665']);
      expect(result).toEqual({ rank1: 12, rank2: 11, suited: false });
    });

    it('parses QJs suited', () => {
      const result = parseHoleCards(['Q\u2660', 'J\u2660']);
      expect(result).toEqual({ rank1: 10, rank2: 9, suited: true });
    });

    it('parses pocket pairs', () => {
      const result = parseHoleCards(['T\u2665', 'T\u2663']);
      expect(result).toEqual({ rank1: 8, rank2: 8, suited: false });
    });

    it('returns null for empty/invalid', () => {
      expect(parseHoleCards(null)).toBe(null);
      expect(parseHoleCards(['', ''])).toBe(null);
      expect(parseHoleCards(['A\u2660'])).toBe(null);
    });
  });

  describe('heroHandIndex', () => {
    it('returns correct index for AKo', () => {
      const idx = heroHandIndex(['A\u2660', 'K\u2665']);
      // AKo = rangeIndex(12, 11, false) = 11*13+12 = 155
      expect(idx).toBe(155);
    });

    it('returns correct index for AKs', () => {
      const idx = heroHandIndex(['A\u2660', 'K\u2660']);
      // AKs = rangeIndex(12, 11, true) = 12*13+11 = 167
      expect(idx).toBe(167);
    });

    it('returns correct index for pocket aces', () => {
      const idx = heroHandIndex(['A\u2660', 'A\u2665']);
      // AA = rangeIndex(12, 12, false) = 12*13+12 = 168
      expect(idx).toBe(168);
    });

    it('returns -1 for invalid cards', () => {
      expect(heroHandIndex(null)).toBe(-1);
      expect(heroHandIndex(['', ''])).toBe(-1);
    });
  });

  describe('getDefendingRange', () => {
    it('is narrower than base range', () => {
      for (const pos of ['UTG', 'CO', 'BTN']) {
        const baseW = rangeWidth(PREFLOP_CHARTS[pos]);
        const defW = rangeWidth(getDefendingRange(pos));
        expect(defW).toBeLessThan(baseW);
        expect(defW).toBeGreaterThan(0);
      }
    });

    it('keeps premium hands', () => {
      const defend = getDefendingRange('UTG');
      const aaIdx = rangeIndex(12, 12, false);
      const kkIdx = rangeIndex(11, 11, false);
      expect(defend[aaIdx]).toBe(1.0);
      expect(defend[kkIdx]).toBe(1.0);
    });

    it('returns empty range for invalid position', () => {
      const range = getDefendingRange('INVALID');
      expect(rangeWidth(range)).toBe(0);
    });
  });
});
