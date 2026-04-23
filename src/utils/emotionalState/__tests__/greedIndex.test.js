import { describe, it, expect } from 'vitest';
import {
  rangePositionTopShare,
  sprDynamicGreed,
  sessionHeaterGreed,
  computeGreedIndex,
  TOP_THRESHOLD,
  GREED_FACTOR_WEIGHTS,
} from '../greedIndex';
import { rangeIndex } from '../../pokerCore/rangeMatrix';

const makeRange = () => new Float64Array(169);

const setCell = (range, rank1, rank2, suited, weight) => {
  range[rangeIndex(rank1, rank2, suited)] = weight;
  return range;
};

describe('rangePositionTopShare', () => {
  it('returns 0 for empty range', () => {
    expect(rangePositionTopShare(makeRange())).toBe(0);
  });

  it('returns ~1 for a top-only range (AA + KK)', () => {
    const r = makeRange();
    setCell(r, 12, 12, false, 1.0); // AA
    setCell(r, 11, 11, false, 1.0); // KK
    const share = rangePositionTopShare(r);
    expect(share).toBe(1.0);
  });

  it('returns 0 for a bottom-only range', () => {
    const r = makeRange();
    setCell(r, 5, 0, false, 1.0); // 72o
    setCell(r, 6, 1, false, 1.0); // 83o
    expect(rangePositionTopShare(r)).toBe(0);
  });

  it('respects TOP_THRESHOLD semantics', () => {
    // Cells above TOP_THRESHOLD should count
    // AA = 0.976 (top)
    const topOnly = setCell(makeRange(), 12, 12, false, 1.0);
    expect(rangePositionTopShare(topOnly)).toBe(1.0);
    // Middle-strength hand like JTs (row 9 col 8 suited) should be below threshold
    const midOnly = setCell(makeRange(), 9, 8, true, 1.0);
    expect(rangePositionTopShare(midOnly)).toBe(0);
  });

  it('handles null gracefully', () => {
    expect(rangePositionTopShare(null)).toBe(0);
    expect(rangePositionTopShare([])).toBe(0);
  });
});

describe('sprDynamicGreed', () => {
  it('returns 0 for high SPR (≥ 8)', () => {
    expect(sprDynamicGreed(8, 0.5)).toBe(0);
    expect(sprDynamicGreed(20, 0.9)).toBe(0);
  });

  it('returns 0 when topShare ≤ 0.1', () => {
    expect(sprDynamicGreed(2, 0.05)).toBe(0);
    expect(sprDynamicGreed(2, 0.1)).toBe(0);
  });

  it('returns elevated value at low SPR + high topShare', () => {
    const greed = sprDynamicGreed(1, 0.8);
    expect(greed).toBeGreaterThan(0.3);
  });

  it('monotonic (approx) as topShare increases at fixed SPR', () => {
    const low = sprDynamicGreed(2, 0.2);
    const mid = sprDynamicGreed(2, 0.5);
    const high = sprDynamicGreed(2, 0.9);
    expect(mid).toBeGreaterThanOrEqual(low);
    expect(high).toBeGreaterThanOrEqual(mid);
  });

  it('handles non-finite SPR', () => {
    expect(sprDynamicGreed(NaN, 0.8)).toBe(0);
    expect(sprDynamicGreed(-1, 0.8)).toBe(0);
  });
});

describe('sessionHeaterGreed', () => {
  it('returns 0 when not on heater', () => {
    expect(sessionHeaterGreed(0)).toBe(0);
    expect(sessionHeaterGreed(100)).toBe(0);
    expect(sessionHeaterGreed(200)).toBe(0);
    expect(sessionHeaterGreed(-500)).toBe(0);
  });

  it('returns elevated value when up past threshold', () => {
    const g1 = sessionHeaterGreed(300);
    const g2 = sessionHeaterGreed(500);
    const g5 = sessionHeaterGreed(1000);
    expect(g1).toBeGreaterThan(0);
    expect(g2).toBeGreaterThan(g1);
    expect(g5).toBeGreaterThanOrEqual(g2);
  });

  it('caps at 1.0', () => {
    expect(sessionHeaterGreed(5000)).toBeLessThanOrEqual(1.0);
  });

  it('handles non-finite input', () => {
    expect(sessionHeaterGreed(NaN)).toBe(0);
    expect(sessionHeaterGreed(undefined)).toBe(0);
  });
});

describe('computeGreedIndex', () => {
  it('returns zero index for empty range + neutral', () => {
    const result = computeGreedIndex(makeRange(), {}, {});
    expect(result.index).toBe(0);
    expect(result.sources).toHaveLength(3);
  });

  it('returns elevated index for top-heavy range + low SPR + heater', () => {
    const r = makeRange();
    setCell(r, 12, 12, false, 1.0); // AA
    setCell(r, 11, 11, false, 1.0); // KK
    const result = computeGreedIndex(r, { spr: 1 }, { villainBBDelta: 500 });
    expect(result.index).toBeGreaterThan(0.7);
  });

  it('source citations are populated', () => {
    const r = setCell(makeRange(), 12, 12, false, 1.0);
    const result = computeGreedIndex(r, { spr: 1 }, { villainBBDelta: 500 });
    for (const src of result.sources) {
      expect(src.citation).toBeDefined();
      expect(typeof src.citation).toBe('string');
    }
  });

  it('weights sum to v1 active-factor total', () => {
    const sumWeights =
      GREED_FACTOR_WEIGHTS.rangePositionTopShare +
      GREED_FACTOR_WEIGHTS.sprDynamicGreed +
      GREED_FACTOR_WEIGHTS.sessionHeaterGreed;
    expect(sumWeights).toBeCloseTo(1.0, 6);
  });

  it('returned index is always in [0, 1]', () => {
    const cases = [
      [makeRange(), {}, {}],
      [setCell(makeRange(), 12, 12, false, 1.0), { spr: 1 }, { villainBBDelta: 2000 }],
      [setCell(makeRange(), 5, 0, false, 1.0), { spr: 12 }, { villainBBDelta: -500 }],
    ];
    for (const [r, gs, sc] of cases) {
      const result = computeGreedIndex(r, gs, sc);
      expect(result.index).toBeGreaterThanOrEqual(0);
      expect(result.index).toBeLessThanOrEqual(1);
    }
  });
});
