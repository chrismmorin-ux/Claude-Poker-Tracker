import { describe, it, expect } from 'vitest';
import {
  cellPreflopStrength,
  rangePositionBottomShare,
  sprDynamicFear,
  sessionStuckFear,
  computeFearIndex,
  BOTTOM_THRESHOLD,
  FEAR_FACTOR_WEIGHTS,
} from '../fearIndex';
import { rangeIndex } from '../../pokerCore/rangeMatrix';

const makeRange = () => new Float64Array(169);

const setCell = (range, rank1, rank2, suited, weight) => {
  range[rangeIndex(rank1, rank2, suited)] = weight;
  return range;
};

describe('cellPreflopStrength', () => {
  it('ranks AA as top (12,12)', () => {
    const strength = cellPreflopStrength(rangeIndex(12, 12, false));
    expect(strength).toBeGreaterThan(0.95);
  });

  it('ranks 22 as stronger than 72o but weaker than AA', () => {
    const aa = cellPreflopStrength(rangeIndex(12, 12, false));
    const deuces = cellPreflopStrength(rangeIndex(0, 0, false));
    const seventyTwoOff = cellPreflopStrength(rangeIndex(5, 0, false));
    expect(aa).toBeGreaterThan(deuces);
    expect(deuces).toBeGreaterThan(seventyTwoOff);
  });

  it('ranks AKs above AKo', () => {
    const aks = cellPreflopStrength(rangeIndex(12, 11, true));
    const ako = cellPreflopStrength(rangeIndex(12, 11, false));
    expect(aks).toBeGreaterThan(ako);
  });

  it('returns values in [0, 1]', () => {
    for (let i = 0; i < 169; i++) {
      const s = cellPreflopStrength(i);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

describe('rangePositionBottomShare', () => {
  it('returns 0 for empty range', () => {
    expect(rangePositionBottomShare(makeRange())).toBe(0);
  });

  it('returns 0 for a top-heavy range (AA only)', () => {
    const r = setCell(makeRange(), 12, 12, false, 1.0);
    expect(rangePositionBottomShare(r)).toBe(0);
  });

  it('returns ~1 for a bottom-heavy range (72o, 83o, 94o)', () => {
    const r = makeRange();
    setCell(r, 5, 0, false, 1.0); // 72o
    setCell(r, 6, 1, false, 1.0); // 83o
    setCell(r, 7, 2, false, 1.0); // 94o
    const share = rangePositionBottomShare(r);
    expect(share).toBeGreaterThan(0.8);
  });

  it('returns moderate value for a mixed range', () => {
    const r = makeRange();
    setCell(r, 12, 12, false, 1.0); // AA — top
    setCell(r, 5, 0, false, 1.0); // 72o — bottom
    const share = rangePositionBottomShare(r);
    expect(share).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.7);
  });

  it('handles null/undefined gracefully', () => {
    expect(rangePositionBottomShare(null)).toBe(0);
    expect(rangePositionBottomShare(undefined)).toBe(0);
    expect(rangePositionBottomShare([])).toBe(0);
  });
});

describe('sprDynamicFear', () => {
  it('returns 0 for low SPR (≤ 2)', () => {
    expect(sprDynamicFear(0, 0.5)).toBe(0);
    expect(sprDynamicFear(1, 0.9)).toBe(0);
    expect(sprDynamicFear(2, 0.9)).toBe(0);
  });

  it('returns 0 when bottomShare ≤ 0.4', () => {
    expect(sprDynamicFear(10, 0.3)).toBe(0);
    expect(sprDynamicFear(10, 0.4)).toBe(0);
  });

  it('returns elevated value at high SPR + high bottomShare', () => {
    const fear = sprDynamicFear(12, 0.8);
    expect(fear).toBeGreaterThan(0.5);
  });

  it('monotonic in SPR given fixed high bottomShare', () => {
    const low = sprDynamicFear(4, 0.8);
    const mid = sprDynamicFear(8, 0.8);
    const high = sprDynamicFear(12, 0.8);
    expect(mid).toBeGreaterThanOrEqual(low);
    expect(high).toBeGreaterThanOrEqual(mid);
  });

  it('handles non-finite SPR', () => {
    expect(sprDynamicFear(NaN, 0.8)).toBe(0);
    expect(sprDynamicFear(-1, 0.8)).toBe(0);
  });
});

describe('sessionStuckFear', () => {
  it('returns 0 when not stuck', () => {
    expect(sessionStuckFear(0)).toBe(0);
    expect(sessionStuckFear(100)).toBe(0);
    expect(sessionStuckFear(-100)).toBe(0);
    expect(sessionStuckFear(-200)).toBe(0);
  });

  it('returns elevated value when stuck past threshold', () => {
    const fear1 = sessionStuckFear(-300);
    const fear2 = sessionStuckFear(-500);
    const fear5 = sessionStuckFear(-1000);
    expect(fear1).toBeGreaterThan(0);
    expect(fear2).toBeGreaterThan(fear1);
    expect(fear5).toBeGreaterThanOrEqual(fear2);
  });

  it('caps at 1.0', () => {
    expect(sessionStuckFear(-5000)).toBeLessThanOrEqual(1.0);
  });

  it('handles non-finite input', () => {
    expect(sessionStuckFear(NaN)).toBe(0);
    expect(sessionStuckFear(undefined)).toBe(0);
  });
});

describe('computeFearIndex', () => {
  it('returns zero index for empty range + neutral state', () => {
    const result = computeFearIndex(makeRange(), {}, {});
    expect(result.index).toBe(0);
    expect(result.sources).toHaveLength(3);
  });

  it('returns low index for top-heavy range + neutral', () => {
    const r = setCell(makeRange(), 12, 12, false, 1.0); // AA only
    const result = computeFearIndex(r, { spr: 4 }, { villainBBDelta: 0 });
    expect(result.index).toBe(0); // 0 bottom share → 0 × 0.6 + 0 + 0 = 0
  });

  it('returns elevated index for bottom-heavy range + deep SPR + stuck session', () => {
    const r = makeRange();
    // Fill with only bottom-30% hands
    setCell(r, 5, 0, false, 1.0);
    setCell(r, 6, 1, false, 1.0);
    setCell(r, 7, 2, false, 1.0);
    const result = computeFearIndex(r, { spr: 12 }, { villainBBDelta: -500 });
    expect(result.index).toBeGreaterThan(0.7);
  });

  it('each source includes factor, weight, value, citation', () => {
    const r = setCell(makeRange(), 12, 12, false, 1.0);
    const result = computeFearIndex(r, { spr: 4 }, { villainBBDelta: 0 });
    for (const src of result.sources) {
      expect(src).toHaveProperty('factor');
      expect(src).toHaveProperty('weight');
      expect(src).toHaveProperty('value');
      expect(src).toHaveProperty('citation');
    }
  });

  it('weights sum to expected v1 active-factor total', () => {
    const sumWeights =
      FEAR_FACTOR_WEIGHTS.rangePositionBottomShare +
      FEAR_FACTOR_WEIGHTS.sprDynamicFear +
      FEAR_FACTOR_WEIGHTS.sessionStuckFear;
    expect(sumWeights).toBeCloseTo(1.0, 6);
  });

  it('returned index is always in [0, 1]', () => {
    const cases = [
      [makeRange(), {}, {}],
      [setCell(makeRange(), 12, 12, false, 1.0), { spr: 12 }, { villainBBDelta: -1000 }],
      [setCell(makeRange(), 5, 0, false, 1.0), { spr: 12 }, { villainBBDelta: -1000 }],
    ];
    for (const [r, gs, sc] of cases) {
      const result = computeFearIndex(r, gs, sc);
      expect(result.index).toBeGreaterThanOrEqual(0);
      expect(result.index).toBeLessThanOrEqual(1);
    }
  });
});
