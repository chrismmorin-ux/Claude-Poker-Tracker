import { describe, test, expect } from 'vitest';
import {
  createRange, rangeIndex, decodeIndex,
  PREFLOP_CHARTS, rangeWidth,
  enumerateCombos,
  parseRangeString, rangeToString,
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

  describe('rangeToString', () => {
    test('empty range serializes to empty string', () => {
      expect(rangeToString(createRange())).toBe('');
    });

    test('single pair emits bare notation', () => {
      const range = createRange();
      range[rangeIndex(12, 12, false)] = 1.0;
      expect(rangeToString(range)).toBe('AA');
    });

    test('single suited hand emits Xs', () => {
      const range = createRange();
      range[rangeIndex(12, 11, true)] = 1.0;
      expect(rangeToString(range)).toBe('AKs');
    });

    test('single offsuit hand emits Xo', () => {
      const range = createRange();
      range[rangeIndex(12, 11, false)] = 1.0;
      expect(rangeToString(range)).toBe('AKo');
    });

    test('compact collapses pair chain anchored at AA into XX+', () => {
      const range = parseRangeString('66+');
      expect(rangeToString(range)).toBe('66+');
    });

    test('compact collapses suited chain anchored at top kicker into AXs+', () => {
      const range = parseRangeString('ATs+');
      expect(rangeToString(range)).toBe('ATs+');
    });

    test('compact collapses offsuit chain anchored at top kicker into AXo+', () => {
      const range = parseRangeString('A9o+');
      expect(rangeToString(range)).toBe('A9o+');
    });

    test('compact=false emits every cell individually', () => {
      const range = parseRangeString('66+');
      const out = rangeToString(range, { compact: false });
      expect(out).toBe('AA,KK,QQ,JJ,TT,99,88,77,66');
    });

    test('isolated non-chain pairs emit individually even in compact mode', () => {
      // Weight-1 at 99, but TT is 0 → no chain anchored at AA since AA is 0.
      const range = createRange();
      range[rangeIndex(7, 7, false)] = 1.0; // 99
      range[rangeIndex(4, 4, false)] = 1.0; // 66
      expect(rangeToString(range)).toBe('99,66');
    });

    test('single-kicker suited emits individually (no spurious chain)', () => {
      const range = createRange();
      range[rangeIndex(12, 6, true)] = 1.0; // A8s only
      expect(rangeToString(range)).toBe('A8s');
    });

    test('emits partial weight with :w suffix', () => {
      const range = createRange();
      range[rangeIndex(12, 12, false)] = 0.5;
      expect(rangeToString(range)).toBe('AA:0.5');
    });

    test('partial-weight pair cannot be part of chain even if neighbors are weight 1', () => {
      // AA=1, KK=0.5, QQ=1 — chain detection stops at KK; AA emitted as chain anchor = 'AA'.
      const range = createRange();
      range[rangeIndex(12, 12, false)] = 1.0;
      range[rangeIndex(11, 11, false)] = 0.5;
      range[rangeIndex(10, 10, false)] = 1.0;
      const out = rangeToString(range);
      expect(out).toContain('AA');
      expect(out).toContain('KK:0.5');
      expect(out).toContain('QQ');
      expect(out).not.toContain('QQ+');
    });

    test('precision option controls weight decimal places', () => {
      const range = createRange();
      range[rangeIndex(12, 12, false)] = 1 / 3; // 0.3333...
      expect(rangeToString(range, { precision: 2 })).toBe('AA:0.33');
      expect(rangeToString(range, { precision: 6 })).toBe('AA:0.333333');
    });

    test('output order is pairs → suited → offsuit, each high-to-low', () => {
      const range = parseRangeString('22,AA,AKo,AKs,KK');
      // Verbose mode avoids chain collapse so we can assert individual ordering.
      // Pairs first (high→low): AA, KK, 22. Then suited: AKs. Then offsuit: AKo.
      expect(rangeToString(range, { compact: false })).toBe('AA,KK,22,AKs,AKo');
    });
  });

  describe('rangeToString ↔ parseRangeString round-trip', () => {
    const canonical = [
      '',
      'AA',
      '22+',
      '66+',
      'ATs+',
      'A9o+',
      'A2s+',
      'AA,KK,QQ',
      'AA,AKs,AKo',
      'TT+,ATs+,KQs',
      '66+,A2s+,K9s+,Q9s+,J9s+,T9s,98s,87s,76s,65s,ATo+,KJo+', // MP2-like
      '22+,A2s+,K2s+,Q2s+,J6s+,T6s+,96s+,85s+,75s+,64s+,53s+,43s,32s,A2o+,K7o+,Q8o+,J8o+,T8o+,97o+,87o,76o', // BTN
      '22+,A2s+,K8s+,Q9s+,J9s+,T8s+,97s+,86s+,76s,65s,54s,A8o+,KTo+,QTo+,JTo,T9o', // SB
    ];

    test.each(canonical)('round-trip (compact): %s', (input) => {
      const range = parseRangeString(input);
      const serialized = rangeToString(range);
      const reparsed = parseRangeString(serialized);
      expect(Array.from(reparsed)).toEqual(Array.from(range));
    });

    test.each(canonical)('round-trip (verbose): %s', (input) => {
      const range = parseRangeString(input);
      const serialized = rangeToString(range, { compact: false });
      const reparsed = parseRangeString(serialized);
      expect(Array.from(reparsed)).toEqual(Array.from(range));
    });

    test('round-trip preserves partial weights', () => {
      const range = parseRangeString('AA:0.5,KK:0.25,AKs:0.75');
      const serialized = rangeToString(range);
      const reparsed = parseRangeString(serialized);
      for (let i = 0; i < 169; i++) {
        expect(reparsed[i]).toBeCloseTo(range[i], 6);
      }
    });

    test('all PREFLOP_CHARTS round-trip cleanly', () => {
      for (const [position, chart] of Object.entries(PREFLOP_CHARTS)) {
        const serialized = rangeToString(chart);
        const reparsed = parseRangeString(serialized);
        expect(Array.from(reparsed), `${position} round-trip failed`).toEqual(Array.from(chart));
      }
    });
  });

  describe('parseRangeString weight extension', () => {
    test('accepts :weight suffix on a pair', () => {
      const range = parseRangeString('AA:0.5');
      expect(range[rangeIndex(12, 12, false)]).toBe(0.5);
    });

    test('accepts :weight suffix on a suited hand', () => {
      const range = parseRangeString('AKs:0.75');
      expect(range[rangeIndex(12, 11, true)]).toBe(0.75);
    });

    test('accepts :weight suffix on a chain', () => {
      const range = parseRangeString('66+:0.5');
      for (let r = 4; r <= 12; r++) {
        expect(range[rangeIndex(r, r, false)]).toBe(0.5);
      }
    });

    test('unweighted tokens remain at weight 1', () => {
      const range = parseRangeString('AA,KK:0.5');
      expect(range[rangeIndex(12, 12, false)]).toBe(1.0);
      expect(range[rangeIndex(11, 11, false)]).toBe(0.5);
    });

    test('rejects invalid weight (NaN) silently', () => {
      const range = parseRangeString('AA:abc');
      expect(range[rangeIndex(12, 12, false)]).toBe(0);
    });

    test('rejects negative weight silently', () => {
      const range = parseRangeString('AA:-0.5');
      expect(range[rangeIndex(12, 12, false)]).toBe(0);
    });
  });

  describe('parseRangeString dash spans', () => {
    // Regression: dash tokens matched no branch and were SILENTLY DROPPED, so a
    // truncated range read as an intentionally narrow one. Every 3-bet range in
    // archetypeRanges.js lost its entire bluff slice ("A5s-A4s") this way, and
    // BB defending ranges lost their "22-JJ" / "A2s-AJs" core, with a green suite.
    const cellsSet = (range) => {
      const out = [];
      for (let i = 0; i < 169; i++) if (range[i] > 0) out.push(i);
      return out.sort((a, b) => a - b);
    };

    test('expands a pair span', () => {
      const range = parseRangeString('22-JJ');
      expect(cellsSet(range)).toEqual(cellsSet(parseRangeString('22,33,44,55,66,77,88,99,TT,JJ')));
    });

    test('pair span is order-independent', () => {
      expect(Array.from(parseRangeString('QQ-JJ'))).toEqual(Array.from(parseRangeString('JJ-QQ')));
      expect(cellsSet(parseRangeString('QQ-JJ'))).toEqual(cellsSet(parseRangeString('JJ,QQ')));
    });

    test('expands a suited kicker span (descending, as written in the codebase)', () => {
      const range = parseRangeString('A5s-A2s');
      expect(cellsSet(range)).toEqual(cellsSet(parseRangeString('A2s,A3s,A4s,A5s')));
    });

    test('expands a suited kicker span (ascending)', () => {
      const range = parseRangeString('ATs-AQs');
      expect(cellsSet(range)).toEqual(cellsSet(parseRangeString('ATs,AJs,AQs')));
    });

    test('expands an offsuit kicker span', () => {
      const range = parseRangeString('ATo-AQo');
      expect(cellsSet(range)).toEqual(cellsSet(parseRangeString('ATo,AJo,AQo')));
    });

    test('suited and offsuit spans stay disjoint', () => {
      const suited = parseRangeString('A5s-A2s');
      const offsuit = parseRangeString('A5o-A2o');
      for (let i = 0; i < 169; i++) expect(suited[i] * offsuit[i]).toBe(0);
    });

    test('dash span accepts a :weight suffix', () => {
      const range = parseRangeString('22-44:0.5');
      expect(range[rangeIndex(0, 0, false)]).toBe(0.5);
      expect(range[rangeIndex(2, 2, false)]).toBe(0.5);
    });

    test('the motivating case: BTN 3-bet range keeps its bluff slice', () => {
      // "TT+,AQs+,A5s-A4s,AQo+" — 70 combos. Before the fix the A5s-A4s token
      // vanished and the range parsed to 62 combos, i.e. zero bluffs.
      const range = parseRangeString('TT+,AQs+,A5s-A4s,AQo+');
      const combos = enumerateCombos(range).length;
      expect(combos).toBe(70);
      expect(range[rangeIndex(12, 3, true)]).toBe(1); // A5s present
      expect(range[rangeIndex(12, 2, true)]).toBe(1); // A4s present
    });

    test('rejects endpoints that do not share a high card', () => {
      expect(() => parseRangeString('KQs-QJs')).toThrow(/unsupported dash range/);
    });

    test('rejects endpoints that differ in suitedness', () => {
      expect(() => parseRangeString('A5s-A2o')).toThrow(/unsupported dash range/);
    });

    test('rejects a pair-to-nonpair span', () => {
      expect(() => parseRangeString('22-AKs')).toThrow(/unsupported dash range/);
    });
  });

  describe('parseRangeString strict token validation', () => {
    test('throws on an unrecognized token', () => {
      expect(() => parseRangeString('AA,ZZZ')).toThrow(/unrecognized token/);
    });

    test('throws on a bare two-card token instead of silently reading it as a pair', () => {
      // Previously "AK" hit the length-2 branch and set AA — a label saying one
      // thing while the value said another.
      expect(() => parseRangeString('AK')).toThrow(/unrecognized token/);
    });

    test('throws on a malformed "+" token', () => {
      expect(() => parseRangeString('XY+')).toThrow(/unrecognized "\+" token/);
    });

    test('throws on a non-string input', () => {
      expect(() => parseRangeString(null)).toThrow(/expected a string/);
    });

    test('still accepts every valid form', () => {
      expect(() => parseRangeString('22+,A2s+,ATo+,AKs,AKo,QQ,22-JJ,A5s-A2s,AA:0.5')).not.toThrow();
    });
  });
});
