/**
 * gridFeatures.test.js — Unit tests for pure feature extractors.
 *
 * SLS Stream B1 — WS-041 / SPR-082.
 */

import { describe, it, expect } from 'vitest';
import {
  totalMass,
  premiumMassFraction,
  topCornerConcentration,
  rankSumWeightedMean,
  rankSumVariance,
  rankSumBimodality,
  suitedAsymmetry,
  wedgeMonotonicity,
  diagonalDominance,
  entropy,
  spatialContiguity,
  computeGridFeatures,
  GRID_SIZE,
  TOTAL_COMBOS,
} from '../gridFeatures';
import { parseRangeString } from '../../pokerCore/rangeMatrix';

const emptyGrid = () => new Float64Array(GRID_SIZE);

const allOnesGrid = () => {
  const g = new Float64Array(GRID_SIZE);
  for (let i = 0; i < GRID_SIZE; i++) g[i] = 1;
  return g;
};

describe('gridFeatures — totalMass', () => {
  it('returns 0 for empty grid', () => {
    expect(totalMass(emptyGrid())).toBe(0);
  });

  it('returns TOTAL_COMBOS=1326 for all-ones grid (full deal)', () => {
    expect(totalMass(allOnesGrid())).toBeCloseTo(TOTAL_COMBOS, 6);
  });

  it('handles undefined / wrong-size input', () => {
    expect(totalMass(null)).toBe(0);
    expect(totalMass(new Float64Array(50))).toBe(0);
  });

  it('counts AA as 6 combos', () => {
    const g = parseRangeString('AA');
    expect(totalMass(g)).toBe(6);
  });

  it('counts AKs as 4 combos and AKo as 12', () => {
    expect(totalMass(parseRangeString('AKs'))).toBe(4);
    expect(totalMass(parseRangeString('AKo'))).toBe(12);
  });

  it('counts a UTG-style range correctly', () => {
    const g = parseRangeString('66+,A9s+,A5s,KTs+,QTs+,JTs,T9s,98s,AQo+');
    // 9 pairs (66-AA × 6) = 54, 5 suited (A9s,ATs,AJs,AQs,AKs × 4) = 20,
    // 1 suited (A5s × 4) = 4, 4 suited (KTs,KJs,KQs × 4) = 12 wait let me recount
    // 66+: 66,77,88,99,TT,JJ,QQ,KK,AA = 9 pairs × 6 = 54
    // A9s+: A9s,ATs,AJs,AQs,AKs = 5 suited × 4 = 20
    // A5s: 1 × 4 = 4
    // KTs+: KTs,KJs,KQs = 3 × 4 = 12
    // QTs+: QTs,QJs = 2 × 4 = 8
    // JTs: 1 × 4 = 4
    // T9s: 1 × 4 = 4
    // 98s: 1 × 4 = 4
    // AQo+: AQo,AKo = 2 × 12 = 24
    // Total = 54 + 20 + 4 + 12 + 8 + 4 + 4 + 4 + 24 = 134
    expect(totalMass(g)).toBe(134);
  });
});

describe('gridFeatures — premiumMassFraction', () => {
  it('is 0 for empty grid', () => {
    expect(premiumMassFraction(emptyGrid())).toBe(0);
  });

  it('is 1 for premium-only range (AA-QQ; all rs >= 20)', () => {
    const g = parseRangeString('AA,KK,QQ');
    expect(premiumMassFraction(g)).toBeCloseTo(1, 2);
  });

  it('is 0 for weak-only range (no rs >= 18 cells)', () => {
    const g = parseRangeString('22,33,44,55,76s,65s,54s');
    expect(premiumMassFraction(g)).toBe(0);
  });

  it('is lower for wide BTN-style range than for tight UTG range', () => {
    const utg = parseRangeString('66+,A9s+,KTs+,QTs+,AQo+');
    const btn = parseRangeString('22+,A2s+,K2s+,Q5s+,J7s+,T7s+,97s+,86s+,75s+,64s+,A2o+,K9o+,Q9o+,J9o+');
    expect(premiumMassFraction(utg)).toBeGreaterThan(premiumMassFraction(btn));
  });

  it('topCornerConcentration is the same as premiumMassFraction (back-compat alias)', () => {
    const g = parseRangeString('AA,KK,QQ');
    expect(topCornerConcentration(g)).toBe(premiumMassFraction(g));
  });
});

describe('gridFeatures — rankSumWeightedMean', () => {
  it('is 24 for AA only (rank-sum 12+12)', () => {
    expect(rankSumWeightedMean(parseRangeString('AA'))).toBe(24);
  });

  it('is 0 for 22 only (rank-sum 0+0)', () => {
    expect(rankSumWeightedMean(parseRangeString('22'))).toBe(0);
  });

  it('is higher for tight ranges than wide ranges', () => {
    const utg = parseRangeString('66+,A9s+,AQo+');
    const btn = parseRangeString('22+,A2s+,K2s+,Q5s+,J7s+');
    expect(rankSumWeightedMean(utg)).toBeGreaterThan(rankSumWeightedMean(btn));
  });
});

describe('gridFeatures — rankSumVariance', () => {
  it('is 0 for single hand', () => {
    expect(rankSumVariance(parseRangeString('AA'))).toBe(0);
  });

  it('is higher for wider ranges', () => {
    const tight = parseRangeString('AA,KK,QQ');
    const wide = parseRangeString('AA,KK,QQ,76s,65s,54s,43s,32s');
    expect(rankSumVariance(wide)).toBeGreaterThan(rankSumVariance(tight));
  });
});

describe('gridFeatures — rankSumBimodality', () => {
  it('is low for continuous tight range', () => {
    const g = parseRangeString('66+,A9s+,AQo+');
    expect(rankSumBimodality(g)).toBeLessThan(0.3);
  });

  it('is higher for polarized barbell than for tight Oval', () => {
    const barbell = parseRangeString('AA,KK,QQ,AKs,AKo,32s,43s,54s,65s,76s');
    const oval = parseRangeString('TT+,AKs,AQs,AKo');
    expect(rankSumBimodality(barbell)).toBeGreaterThan(rankSumBimodality(oval));
  });

  it('is near 0 for premium-only range (unimodal)', () => {
    expect(rankSumBimodality(parseRangeString('AA,KK,QQ'))).toBeLessThan(0.1);
  });
});

describe('gridFeatures — suitedAsymmetry', () => {
  it('is positive for suited-only range', () => {
    const g = parseRangeString('AKs,AQs,AJs,KQs,QJs,JTs');
    expect(suitedAsymmetry(g)).toBeCloseTo(1, 2);
  });

  it('is negative for offsuit-only range', () => {
    const g = parseRangeString('AKo,AQo,KQo');
    expect(suitedAsymmetry(g)).toBeCloseTo(-1, 2);
  });

  it('is ~0 for cell-count-balanced mix', () => {
    // Cell-count: 1 suited + 1 offsuit → 0. (Old combo-weighted metric
    // would have given -0.5 for these because offsuit cells have 12
    // combos vs suited's 4 — the new cell-count metric is visual/
    // geometric, not combo-mass-weighted.)
    const g = parseRangeString('AKs,AKo');
    expect(Math.abs(suitedAsymmetry(g))).toBeLessThan(0.05);
  });

  it('handles weighted balance — 1.0 suited vs 1.0 offsuit cells = 0', () => {
    const g = parseRangeString('AKs,KQs,AKo,KQo');
    expect(Math.abs(suitedAsymmetry(g))).toBeLessThan(0.05);
  });
});

describe('gridFeatures — wedgeMonotonicity', () => {
  it('is 1 for empty or single-hand', () => {
    expect(wedgeMonotonicity(emptyGrid())).toBe(1);
    expect(wedgeMonotonicity(parseRangeString('AA'))).toBe(1);
  });

  it('is high for premium-only range (mass concentrated at top)', () => {
    // All mass at very-high rs → top-half holds ~100% → wedgeMonotonicity ≈ 1.
    const g = parseRangeString('AA,KK,QQ,JJ,TT,AKs,AKo,AQs,AQo,KQs');
    expect(wedgeMonotonicity(g)).toBeGreaterThan(0.95);
  });

  it('is moderate-to-high for real wedge (top-heavy with some bottom inclusions)', () => {
    // BTN-style range — top-heavy but extends to bottom suited connectors.
    const g = parseRangeString('22+,A2s+,K9s+,QTs+,JTs,A2o+,K9o+');
    expect(wedgeMonotonicity(g)).toBeGreaterThan(0.5);
  });

  it('is near 0 for uniform diffuse distribution (no monotonicity)', () => {
    const g = new Float64Array(GRID_SIZE);
    for (let i = 0; i < GRID_SIZE; i++) g[i] = 0.5;
    expect(wedgeMonotonicity(g)).toBeLessThan(0.1);
  });
});

describe('gridFeatures — diagonalDominance', () => {
  it('is 0 for non-pair range', () => {
    expect(diagonalDominance(parseRangeString('AKs,AQs,AKo'))).toBe(0);
  });

  it('is 1 for pair-only range', () => {
    expect(diagonalDominance(parseRangeString('AA,KK,QQ,JJ,TT'))).toBe(1);
  });
});

describe('gridFeatures — entropy', () => {
  it('is 0 for empty grid', () => {
    expect(entropy(emptyGrid())).toBe(0);
  });

  it('is low for tight range', () => {
    expect(entropy(parseRangeString('AA,KK'))).toBeLessThan(0.3);
  });

  it('is high for wide diffuse range', () => {
    expect(entropy(allOnesGrid())).toBeGreaterThan(0.85);
  });
});

describe('gridFeatures — spatialContiguity', () => {
  it('is 1 for single cell', () => {
    expect(spatialContiguity(parseRangeString('AA'))).toBe(1);
  });

  it('is higher for clustered range than scattered', () => {
    const clustered = parseRangeString('AA,KK,QQ,JJ,TT,AKs,AQs,KQs');
    const scattered = parseRangeString('AA,76s,32s,A2o,KTo');
    expect(spatialContiguity(clustered)).toBeGreaterThan(spatialContiguity(scattered));
  });
});

describe('gridFeatures — computeGridFeatures (full vector)', () => {
  it('returns a frozen object', () => {
    const f = computeGridFeatures(parseRangeString('AA'));
    expect(Object.isFrozen(f)).toBe(true);
  });

  it('contains all expected feature keys', () => {
    const f = computeGridFeatures(parseRangeString('AA'));
    expect(Object.keys(f).sort()).toEqual([
      'bimodality',
      'contiguity',
      'diagonalDominance',
      'entropy',
      'premiumMassFraction',
      'rangeWidthPct',
      'rankSumMean',
      'rankSumVariance',
      'suitedAsymmetry',
      'totalMass',
      'wedgeMonotonicity',
    ]);
  });

  it('is deterministic — same input → same output', () => {
    const g = parseRangeString('66+,A9s+,A5s,KTs+,QTs+,JTs,T9s,98s,AQo+');
    const f1 = computeGridFeatures(g);
    const f2 = computeGridFeatures(g);
    expect(f1).toEqual(f2);
  });
});
