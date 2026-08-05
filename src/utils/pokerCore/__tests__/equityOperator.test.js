/**
 * equityOperator.test.js — WS-337.
 *
 * The load-bearing assertion is the first one: `max |S + S^T| < 1e-12`. Everything downstream —
 * the rotation planes, the transitive/intransitive split, the intransitivity map — is a theorem
 * ABOUT skew-symmetric operators, and is vacuous if the operator is not one. So the premise is
 * tested against a freshly built matrix at more than one seed and board count, not read off a
 * stored number.
 *
 * The synthetic fixtures matter as much as the real ones. A purely transitive operator must
 * split 100/0 and produce an identically zero intransitivity map; a pure 3-cycle must split
 * ~0/100. Without those two, "74% transitive" is a number nothing calibrates.
 */

import { describe, it, expect } from 'vitest';

import {
  OPERATOR_SIZE,
  buildEquityOperator,
  antisymmetryResidual,
  skewPart,
  hodgeSplit,
  intransitivityMap,
  comboWeights,
  uniformWeights,
  classLabels,
  classLabel,
  comboMultiplicity,
  buildCompressionClaim,
  compressionClaimProblems,
  describeCompressionClaim,
} from '../equityOperator.js';
import {
  SKEW_DECOMPOSITION,
  skewDecompositionProblems,
  intransitivityGrid,
  intransitivityFor,
  projectOntoPlanes,
  shippedCompressionClaim,
} from '../equitySkew.js';
import { rangeIndex } from '../rangeMatrix.js';

const N = OPERATOR_SIZE;

/** A purely transitive operator: S_ij = f_i - f_j for an arbitrary potential f. */
const transitiveOperator = (f) => {
  const M = new Float64Array(N * N);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) M[i * N + j] = 0.5 + (f[i] - f[j]);
  }
  return M;
};

describe('the premise — the equity operator is antisymmetric', () => {
  // 60 boards is enough: antisymmetry is a property of the CONSTRUCTION (win + tie + loss
  // exhausts the outcomes, and the total is symmetric), not of the sample size. If it only held
  // at large samples it would not be exact, and none of the theorems would apply.
  const operators = [
    buildEquityOperator({ boards: 60, seed: 20260803 }),
    buildEquityOperator({ boards: 137, seed: 4242 }),
  ];

  it.each(operators.map((o) => [o.seed, o.boards, o]))(
    'seed %i over %i boards: max |M[i][j] + M[j][i] - 1| < 1e-12',
    (_seed, _boards, op) => {
      expect(antisymmetryResidual(op.matrix)).toBeLessThan(1e-12);
    },
  );

  it('S = M - 1/2 is exactly skew: max |S + S^T| < 1e-12', () => {
    const S = skewPart(operators[0].matrix);
    let worst = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        worst = Math.max(worst, Math.abs(S[i * N + j] + S[j * N + i]));
      }
    }
    expect(worst).toBeLessThan(1e-12);
  });

  it('every class is sampled and the diagonal is exactly a coin flip', () => {
    const { matrix, emptyCells } = operators[0];
    expect(emptyCells).toBe(0);
    for (let i = 0; i < N; i++) expect(matrix[i * N + i]).toBe(0.5);
  });

  it('is byte-reproducible: the same seed rebuilds the same matrix', () => {
    const a = buildEquityOperator({ boards: 25, seed: 777 }).matrix;
    const b = buildEquityOperator({ boards: 25, seed: 777 }).matrix;
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('records equities that are recognisably poker (AA beats 72o, AKs beats AKo)', () => {
    const { matrix } = buildEquityOperator({ boards: 400, seed: 99 });
    const at = (a, b) => matrix[a * N + b];
    const AA = rangeIndex(12, 12, false);
    const KK = rangeIndex(11, 11, false);
    const AKs = rangeIndex(12, 11, true);
    const AKo = rangeIndex(12, 11, false);
    const o72 = rangeIndex(5, 0, false);
    expect(at(AA, o72)).toBeGreaterThan(0.85);
    expect(at(AA, KK)).toBeGreaterThan(0.79);
    expect(at(AKs, AKo)).toBeGreaterThan(0.5);
  });
});

describe('grid coordinates', () => {
  it('labels are in rangeIndex order, so the operator and a range grid share coordinates', () => {
    const labels = classLabels();
    expect(labels).toHaveLength(N);
    expect(labels[rangeIndex(12, 12, false)]).toBe('AA');
    expect(labels[rangeIndex(12, 11, true)]).toBe('AKs');
    expect(labels[rangeIndex(12, 11, false)]).toBe('AKo');
    expect(classLabel(rangeIndex(0, 0, false))).toBe('22');
  });

  it('combo weights are the 1326-combo frequencies, summing to 1', () => {
    const w = comboWeights();
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(comboMultiplicity(rangeIndex(12, 12, false))).toBe(6);
    expect(comboMultiplicity(rangeIndex(12, 11, true))).toBe(4);
    expect(comboMultiplicity(rangeIndex(12, 11, false))).toBe(12);
    expect(w[rangeIndex(12, 11, false)]).toBeCloseTo(12 / 1326, 12);
  });
});

describe('the transitive / intransitive split is a projection, not a fit', () => {
  const w = comboWeights();

  it('a purely transitive operator splits 100 / 0 with a zero residual', () => {
    const f = Float64Array.from({ length: N }, (_, i) => (i - 84) / 400);
    const split = hodgeSplit(skewPart(transitiveOperator(f)), w);
    expect(split.transitiveShare).toBeCloseTo(1, 10);
    expect(split.intransitiveShare).toBeLessThan(1e-20);
    expect(Math.max(...intransitivityMap(split.residual, w))).toBeLessThan(1e-9);
  });

  it('a pure rock-paper-scissors cycle splits ~0 / 100', () => {
    // Three classes in a cycle, everything else neutral. No potential can express it.
    const S = new Float64Array(N * N);
    const [a, b, c] = [rangeIndex(12, 12, false), rangeIndex(12, 11, false), rangeIndex(9, 8, true)];
    const set = (i, j, v) => { S[i * N + j] = v; S[j * N + i] = -v; };
    set(a, b, 0.05); set(b, c, 0.05); set(c, a, 0.05);
    const split = hodgeSplit(S, uniformWeights());
    expect(split.transitiveShare).toBeLessThan(1e-12);
    expect(split.intransitiveShare).toBeCloseTo(1, 10);
  });

  it('obeys Pythagoras on the real operator — the proof it is orthogonal', () => {
    const S = skewPart(buildEquityOperator({ boards: 120, seed: 31337 }).matrix);
    for (const weights of [comboWeights(), uniformWeights()]) {
      const split = hodgeSplit(S, weights);
      expect(split.pythagorasResidual).toBeLessThan(1e-12);
      expect(split.transitiveShare + split.intransitiveShare).toBeCloseTo(1, 12);
    }
  });

  it('the residual is orthogonal to EVERY transitive matrix, not just the fitted one', () => {
    const S = skewPart(buildEquityOperator({ boards: 120, seed: 31337 }).matrix);
    const { residual } = hodgeSplit(S, w);
    // An arbitrary potential g; <R, G(g)>_w must vanish.
    const g = Float64Array.from({ length: N }, (_, i) => Math.sin(i * 1.7));
    let inner = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) inner += w[i] * w[j] * residual[i * N + j] * (g[i] - g[j]);
    }
    expect(Math.abs(inner)).toBeLessThan(1e-12);
  });

  it('the real operator is mostly a ladder, but not only a ladder', () => {
    const S = skewPart(buildEquityOperator({ boards: 400, seed: 20260803 }).matrix);
    const split = hodgeSplit(S, w);
    // Measured at 2 x 20,000 boards: 73.96% / 26.04% (combo-frequency weighted). A 400-board
    // sample sits near it; the band is wide enough that this is testing the shape, not the
    // sampling noise.
    expect(split.transitiveShare).toBeGreaterThan(0.6);
    expect(split.transitiveShare).toBeLessThan(0.85);
    expect(split.intransitiveShare).toBeGreaterThan(0.1);
  });
});

describe('a compression claim must carry all three numbers', () => {
  const complete = {
    planes: 13,
    energyShare: 0.99,
    reconstructionError: { planes: 13, meanAbsPP: 1.075, p90PP: 2.432, maxPP: 16.178 },
    transitiveIntransitiveSplit: { transitiveShare: 0.7396, intransitiveShare: 0.2604 },
    basis: 'combo-frequency-weighted rotation planes, artifact v1',
    boards: 20000,
    seeds: [20260803, 987654321],
    planeThreshold: { sigma: 0.001353, method: 'two-seed noise replica' },
  };

  it('refuses a claim that reports only energy share', () => {
    expect(() => buildCompressionClaim({ planes: 13, energyShare: 0.99 })).toThrow(
      /reconstructionError is the honest half/,
    );
  });

  it('refuses a claim missing the transitive / intransitive split', () => {
    const { transitiveIntransitiveSplit, ...rest } = complete;
    expect(() => buildCompressionClaim(rest)).toThrow(/ALREADY\s+rank 2/);
  });

  it('refuses a split whose shares do not sum to 1 — that is a fit, not a projection', () => {
    const problems = compressionClaimProblems({
      ...complete,
      transitiveIntransitiveSplit: { transitiveShare: 0.752, intransitiveShare: 0.20 },
    });
    expect(problems.join('\n')).toMatch(/must sum to 1/);
  });

  it('refuses a plane count with no stated threshold', () => {
    const { planeThreshold, ...rest } = complete;
    expect(() => buildCompressionClaim(rest)).toThrow(/planeThreshold/);
  });

  it('refuses a claim that cannot name its seeds', () => {
    expect(() => buildCompressionClaim({ ...complete, seeds: [] })).toThrow(/seeds/);
  });

  it('accepts a complete claim and describes it with all three numbers present', () => {
    const claim = buildCompressionClaim(complete);
    const prose = describeCompressionClaim(claim);
    expect(prose).toMatch(/99\.00% of the skew energy/);
    expect(prose).toMatch(/1\.07pp mean/);
    expect(prose).toMatch(/transitive strength ladder/);
    expect(prose).toMatch(/intransitive residual is 26\.0%/);
    expect(prose).toMatch(/seeds \[20260803, 987654321\]/);
  });
});

describe('the shipped decomposition artifact', () => {
  it('validates', () => {
    expect(skewDecompositionProblems(SKEW_DECOMPOSITION)).toEqual([]);
  });

  it('was built from an operator that is antisymmetric to better than 1e-12', () => {
    expect(SKEW_DECOMPOSITION.antisymmetryResidual).toBeLessThan(1e-12);
  });

  it('carries exactly 84 rotation planes — 169 is odd, so one dimension has no partner', () => {
    expect(SKEW_DECOMPOSITION.planeSigma).toHaveLength(84);
    expect(SKEW_DECOMPOSITION.pairingResidual).toBeLessThan(1e-9);
    expect(SKEW_DECOMPOSITION.rotationBlockResidual).toBeLessThan(1e-9);
  });

  it('names a measured noise floor and a plane count derived from it', () => {
    expect(SKEW_DECOMPOSITION.noiseFloorSigma).toBeGreaterThan(0);
    expect(SKEW_DECOMPOSITION.significantPlanes).toBeGreaterThan(0);
    expect(SKEW_DECOMPOSITION.significantPlanes).toBeLessThanOrEqual(84);
    expect(SKEW_DECOMPOSITION.seeds.length).toBe(2);
    expect(SKEW_DECOMPOSITION.seeds[0]).not.toBe(SKEW_DECOMPOSITION.seeds[1]);
  });

  it('rejects an artifact whose labels drifted out of rangeIndex order', () => {
    const broken = { ...SKEW_DECOMPOSITION, labels: [...SKEW_DECOMPOSITION.labels] };
    broken.labels[3] = 'ZZ';
    expect(skewDecompositionProblems(broken).join('\n')).toMatch(/not in rangeIndex order/);
  });

  it('rejects an artifact built from a non-antisymmetric operator', () => {
    const broken = { ...SKEW_DECOMPOSITION, antisymmetryResidual: 1e-3 };
    expect(skewDecompositionProblems(broken).join('\n')).toMatch(/decomposes nothing/);
  });

  it('its split is an orthogonal one — the shares sum to 1', () => {
    for (const key of ['comboFrequencyWeighted', 'unweighted']) {
      const s = SKEW_DECOMPOSITION.split[key];
      expect(s.transitiveShare + s.intransitiveShare).toBeCloseTo(1, 8);
    }
  });
});

describe('the intransitivity map', () => {
  it('is a 169-cell grid indexable exactly like a range grid', () => {
    const grid = intransitivityGrid();
    expect(grid).toHaveLength(N);
    expect(intransitivityFor('AKo')).toBe(grid[rangeIndex(12, 11, false)]);
    expect(intransitivityFor(rangeIndex(12, 11, false))).toBe(intransitivityFor('AKo'));
    expect(intransitivityFor('not-a-hand')).toBeNull();
  });

  it('puts big aces and broadways above suited trash', () => {
    // The MEASURED ordering, not a guess. Note the SPREAD is modest — see POKER_THEORY §16:
    // the least cyclic class still carries about 62% of the most cyclic one's cyclic magnitude,
    // so "the trash is a pure strength ladder" would be an overstatement.
    expect(intransitivityFor('AKo')).toBeGreaterThan(intransitivityFor('T2s'));
    expect(intransitivityFor('AA')).toBeGreaterThan(intransitivityFor('92s'));
    const grid = intransitivityGrid();
    expect(Math.min(...grid)).toBeGreaterThan(0);
  });

  it('agrees with a freshly built operator on which classes are most cyclic', () => {
    // End-to-end: the committed artifact must describe the same object the code builds today.
    const S = skewPart(buildEquityOperator({ boards: 400, seed: 5150 }).matrix);
    const w = comboWeights();
    const fresh = intransitivityMap(hodgeSplit(S, w).residual, w);
    const order = [...SKEW_DECOMPOSITION.intransitivityMap.keys()]
      .sort((a, b) => SKEW_DECOMPOSITION.intransitivityMap[b] - SKEW_DECOMPOSITION.intransitivityMap[a]);
    const mean = (idxs) => idxs.reduce((acc, i) => acc + fresh[i], 0) / idxs.length;
    expect(mean(order.slice(0, 16))).toBeGreaterThan(mean(order.slice(-16)));
  });
});

describe('the low-dimensional lens never arrives without its residual', () => {
  it('returns 2k coordinates AND the measured reconstruction error', () => {
    const grid = new Float64Array(N);
    grid[rangeIndex(12, 12, false)] = 1;
    grid[rangeIndex(12, 11, true)] = 1;
    const out = projectOntoPlanes(grid, 6);
    expect(out.coordinates).toHaveLength(12);
    expect(out.residual).not.toBeNull();
    expect(out.residual.meanAbsPP).toBeGreaterThan(0);
    expect(out.authoritative).toMatch(/169-cell grid/);
  });

  it('the shipped compression claim is complete by construction', () => {
    const claim = shippedCompressionClaim(13);
    expect(compressionClaimProblems(claim)).toEqual([]);
    expect(describeCompressionClaim(claim)).toMatch(/rotation planes/);
  });
});
