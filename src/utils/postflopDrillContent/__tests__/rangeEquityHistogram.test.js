import { describe, test, expect, vi } from 'vitest';
import {
  filterCombosByGroups,
  computeEquityHistogram,
  UNIFORM_VILLAIN_RANGE,
  DEFAULT_BIN_COUNT,
} from '../rangeEquityHistogram';

// Minimal seg fixture: filterCombosByGroups only reads `combos[].handType`.
// handTypes chosen from HAND_TYPE_GROUPS: draws → {oesd, nutFlushDraw}, topPair → {overpair, topPairGood}, air → {air}.
const seg = {
  combos: [
    { card1: 0, card2: 1, weight: 1, handType: 'overpair' },
    { card1: 2, card2: 3, weight: 1, handType: 'topPairGood' },
    { card1: 4, card2: 5, weight: 0.5, handType: 'oesd' },
    { card1: 6, card2: 7, weight: 1, handType: 'nutFlushDraw' },
    { card1: 8, card2: 9, weight: 1, handType: 'air' },
  ],
};

describe('filterCombosByGroups — pure selection', () => {
  test('empty selection returns all combos (copy, not the same array)', () => {
    const out = filterCombosByGroups(seg, new Set());
    expect(out).toHaveLength(5);
    expect(out).not.toBe(seg.combos);
  });

  test('null selection returns all combos', () => {
    expect(filterCombosByGroups(seg, null)).toHaveLength(5);
  });

  test('single group filters to its hand types only', () => {
    const out = filterCombosByGroups(seg, new Set(['draws']));
    expect(out.map((c) => c.handType).sort()).toEqual(['nutFlushDraw', 'oesd']);
  });

  test('multi-group selection is the union', () => {
    const out = filterCombosByGroups(seg, new Set(['topPair', 'air']));
    expect(out.map((c) => c.handType).sort()).toEqual(['air', 'overpair', 'topPairGood']);
  });

  test('unknown group id is ignored', () => {
    const out = filterCombosByGroups(seg, new Set(['draws', 'not-a-group']));
    expect(out.map((c) => c.handType).sort()).toEqual(['nutFlushDraw', 'oesd']);
  });

  test('missing/empty seg degrades to []', () => {
    expect(filterCombosByGroups(null, new Set(['draws']))).toEqual([]);
    expect(filterCombosByGroups({}, new Set(['draws']))).toEqual([]);
  });
});

describe('UNIFORM_VILLAIN_RANGE', () => {
  test('is a full 169-cell all-ones grid', () => {
    expect(UNIFORM_VILLAIN_RANGE).toHaveLength(169);
    expect(Array.from(UNIFORM_VILLAIN_RANGE).every((w) => w === 1)).toBe(true);
  });
});

describe('computeEquityHistogram — binning + aggregation (injected equityFn)', () => {
  const combos = [
    { card1: 0, card2: 1, weight: 1 },   // eq 0.10 → bin 0 (0–20)
    { card1: 2, card2: 3, weight: 1 },   // eq 0.30 → bin 1 (20–40)
    { card1: 4, card2: 5, weight: 1 },   // eq 0.50 → bin 2 (40–60)
    { card1: 6, card2: 7, weight: 1 },   // eq 0.70 → bin 3 (60–80)
    { card1: 8, card2: 9, weight: 2 },   // eq 1.00 → bin 4 (80–100, clamp)
  ];
  const equities = [0.1, 0.3, 0.5, 0.7, 1.0];
  const equityFn = (c) => equities[combos.indexOf(c)];

  test('defaults to 5 quintile bins with monotonic non-overlapping ranges', async () => {
    const res = await computeEquityHistogram(combos, [], { equityFn });
    expect(res.bins).toHaveLength(DEFAULT_BIN_COUNT);
    res.bins.forEach((b, i) => {
      expect(b.lo).toBeCloseTo(i / 5, 9);
      expect(b.hi).toBeCloseTo((i + 1) / 5, 9);
    });
  });

  test('each combo lands in the right bin; equity 1.0 clamps into the top bin', async () => {
    const res = await computeEquityHistogram(combos, [], { equityFn });
    expect(res.bins.map((b) => b.count)).toEqual([1, 1, 1, 1, 1]);
    expect(res.bins[4].weight).toBe(2); // the weight-2 combo
  });

  test('bin weights sum to totalWeight and pct sums to ~1', async () => {
    const res = await computeEquityHistogram(combos, [], { equityFn });
    const wSum = res.bins.reduce((s, b) => s + b.weight, 0);
    const pSum = res.bins.reduce((s, b) => s + b.pct, 0);
    expect(wSum).toBe(res.totalWeight);
    expect(res.totalWeight).toBe(6);
    expect(pSum).toBeCloseTo(1, 9);
  });

  test('meanEquity is the weight-weighted mean', async () => {
    const res = await computeEquityHistogram(combos, [], { equityFn });
    // (0.1+0.3+0.5+0.7+1.0*2) / 6 = 3.6/6 = 0.6
    expect(res.meanEquity).toBeCloseTo(0.6, 9);
    expect(res.combosEvaluated).toBe(5);
  });

  test('NaN/null equities are excluded (illegal combos)', async () => {
    const res = await computeEquityHistogram(combos, [], {
      equityFn: (c) => (combos.indexOf(c) === 0 ? NaN : equities[combos.indexOf(c)]),
    });
    expect(res.combosEvaluated).toBe(4);
    expect(res.totalWeight).toBe(5); // dropped the weight-1 NaN combo
  });

  test('empty combo set degrades safely', async () => {
    const res = await computeEquityHistogram([], [], { equityFn });
    expect(res.totalWeight).toBe(0);
    expect(res.meanEquity).toBe(0);
    expect(res.combosEvaluated).toBe(0);
    expect(res.bins.every((b) => b.pct === 0)).toBe(true);
  });

  test('configurable bin count', async () => {
    const res = await computeEquityHistogram(combos, [], { equityFn, bins: 10 });
    expect(res.bins).toHaveLength(10);
  });

  test('onProgress fires once per combo with running total', async () => {
    const onProgress = vi.fn();
    await computeEquityHistogram(combos, [], { equityFn, onProgress });
    expect(onProgress).toHaveBeenCalledTimes(5);
    expect(onProgress).toHaveBeenLastCalledWith(5, 5);
  });
});
