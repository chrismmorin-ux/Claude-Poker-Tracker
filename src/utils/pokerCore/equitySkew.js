/**
 * equitySkew.js — the SHIPPED skew decomposition of the equity operator, as a first-class object.
 *
 * `equityOperator.js` defines the operator and the arithmetic that is exact. This file is the
 * reader for the one measured decomposition the repo stands behind: the committed artifact in
 * `./data/equitySkewDecomposition.js`, produced by `scripts/research/spectrum.py` from two
 * independently seeded 20,000-board matrices.
 *
 * WHY THE DEPENDENCY POINTS THIS WAY. The artifact is generated FROM a matrix that
 * `equityOperator.js` builds. If that module imported the artifact, regenerating it would
 * require it to already exist. Nothing in `equityOperator.js` depends on anything here.
 *
 * THE 169-GRID REMAINS AUTHORITATIVE. `projectOntoPlanes` is an ADDITIONAL lens and always
 * returns the measured residual alongside its coordinates. Nothing in the estimation path may
 * treat the low-dimensional coordinates as a replacement representation until that basis has
 * been scored against the shipped 169-cell grid on corpus data under the two-level split
 * (WS-337 accept criterion 4 — NOT YET RUN, so the answer is currently unknown, not favourable).
 */

import {
  OPERATOR_SIZE,
  classLabels,
  buildCompressionClaim,
} from './equityOperator.js';
import { EQUITY_SKEW_DECOMPOSITION } from './data/equitySkewDecomposition.js';

/** The shipped skew decomposition (see `./data/equitySkewDecomposition.js`). */
export const SKEW_DECOMPOSITION = EQUITY_SKEW_DECOMPOSITION;

/** Fields whose absence would make the artifact unusable or unreplicable. */
const ARTIFACT_REQUIRED = Object.freeze([
  'artifactVersion', 'engineCommit', 'dealBookHashes', 'seeds', 'boardsPerSeed',
  'labels', 'comboWeights', 'antisymmetryResidual', 'pairingResidual',
  'rotationBlockResidual', 'split', 'planeSigma', 'planeCumulativeEnergy',
  'noiseFloorSigma', 'significantPlanes', 'reconstruction', 'residualReconstruction',
  'intransitivityMap', 'planeBasisA', 'planeBasisB', 'planeRadius',
]);

/**
 * Problems with a decomposition artifact, as strings. Empty means usable.
 *
 * Exported separately from any consumer for the same reason `manifestProblems` is: a check that
 * can disagree with its constructor is worse than no check.
 */
export const skewDecompositionProblems = (d) => {
  const problems = [];
  if (!d || typeof d !== 'object') return ['decomposition artifact is missing'];
  for (const key of ARTIFACT_REQUIRED) {
    if (d[key] === undefined || d[key] === null) problems.push(`artifact.${key} is missing`);
  }
  if (problems.length) return problems;

  if (d.labels.length !== OPERATOR_SIZE) {
    problems.push(`artifact.labels has ${d.labels.length} entries, expected ${OPERATOR_SIZE}`);
  } else {
    // The artifact is indexed by rangeIndex, the same coordinates every range grid uses. If that
    // ever drifted, the intransitivity map would silently describe the wrong hands.
    const expected = classLabels();
    for (let i = 0; i < OPERATOR_SIZE; i++) {
      if (d.labels[i] !== expected[i]) {
        problems.push(
          `artifact.labels[${i}] is "${d.labels[i]}", expected "${expected[i]}" — the artifact is `
          + 'not in rangeIndex order and cannot be read against a range grid',
        );
        break;
      }
    }
  }
  if (d.intransitivityMap.length !== OPERATOR_SIZE) {
    problems.push(`artifact.intransitivityMap must carry ${OPERATOR_SIZE} values`);
  }
  if (!(d.antisymmetryResidual < 1e-12)) {
    problems.push(
      `artifact.antisymmetryResidual is ${d.antisymmetryResidual} — the operator it was built `
      + 'from is not antisymmetric, so its plane decomposition decomposes nothing',
    );
  }
  if (!(d.pairingResidual < 1e-9) || !(d.rotationBlockResidual < 1e-9)) {
    problems.push(
      'artifact pairing / rotation-block residuals exceed 1e-9 — the singular values did not pair '
      + 'into rotation blocks, so the plane grouping is not trustworthy and no plane count from '
      + 'this artifact may be quoted',
    );
  }
  // 169 is odd, so a skew operator on it has at least one zero eigenvalue: 84 planes at most.
  const maxPlanes = Math.floor(OPERATOR_SIZE / 2);
  if (d.planeSigma.length !== maxPlanes) {
    problems.push(`artifact.planeSigma must carry ${maxPlanes} magnitudes (169 is odd)`);
  }
  if (!(d.significantPlanes >= 1) || d.significantPlanes > maxPlanes) {
    problems.push('artifact.significantPlanes is outside 1..84');
  }
  return problems;
};

/** The intransitivity map as a 169-cell grid, indexed exactly like every range grid. */
export const intransitivityGrid = (d = SKEW_DECOMPOSITION) =>
  Float64Array.from(d.intransitivityMap);

/** Intransitivity for one class, in percentage points. Accepts a label or a grid index. */
export const intransitivityFor = (hand, d = SKEW_DECOMPOSITION) => {
  const idx = typeof hand === 'number' ? hand : d.labels.indexOf(hand);
  if (idx < 0 || idx >= OPERATOR_SIZE) return null;
  return d.intransitivityMap[idx];
};

/**
 * Project a 169-cell vector onto the top-k rotation planes — the ADDITIONAL lens.
 *
 * Returns 2k coordinates AND the artifact's measured reconstruction error at k, together,
 * deliberately: a coordinate vector handed over without its residual is the shape in which a
 * lens becomes a replacement. The 169-grid stays authoritative.
 *
 * @param {ArrayLike<number>} vector - 169 values in rangeIndex order (e.g. a range grid)
 * @param {number} k - planes to keep; capped at the artifact's stored basis depth
 */
export const projectOntoPlanes = (vector, k = 13, d = SKEW_DECOMPOSITION) => {
  const depth = Math.min(k, d.planeBasisA.length);
  const coordinates = [];
  for (let p = 0; p < depth; p++) {
    let a = 0;
    let b = 0;
    for (let i = 0; i < OPERATOR_SIZE; i++) {
      a += d.planeBasisA[p][i] * vector[i];
      b += d.planeBasisB[p][i] * vector[i];
    }
    coordinates.push(a, b);
  }
  const row = d.reconstruction.find((r) => r.planes === depth) ?? null;
  return {
    planes: depth,
    coordinates,
    residual: row,
    authoritative: 'the 169-cell grid — these coordinates are a lens, never a replacement',
  };
};


/**
 * The compression claim the shipped artifact supports, at k planes.
 *
 * WHY THIS IS NOT A RESULT CARD, stated rather than left as an apparent omission. ADR-009 binds
 * comparative claims about strategy, model quality or EV, and a Result Card's Match is
 * `Surface x Deal Book x Field`. This claim has no Surface, no Field and no opponent population:
 * it is a property of the deck, measured from the hand evaluator and a seeded board sampler
 * alone. Minting a Card would require inventing a `fieldId` for a measurement that has no field,
 * which is the kind of shape-fitting the standard exists to stop. What ADR-009's discipline DOES
 * demand here — n, basis, every seed, and the numerical tolerance behind the plane cut — is
 * carried by the claim itself and enforced by `compressionClaimProblems`.
 *
 * The moment this basis is scored AGAINST something — the 169-cell ladder, on corpus data — that
 * IS a comparative claim about model quality, and it resolves to a Result Card like everything
 * else. Nothing here licenses skipping that.
 */
export const shippedCompressionClaim = (k = 13, d = SKEW_DECOMPOSITION) => {
  const row = d.reconstruction.find((r) => r.planes === k);
  if (!row) throw new Error(`the artifact carries no reconstruction row for ${k} planes`);
  return buildCompressionClaim({
    note:
      'Engine-free: a property of the deck, not of a strategy. No Field, so no Result Card — see '
      + 'the note on shippedCompressionClaim. Scoring this basis against the 169-cell grid on '
      + 'corpus data WOULD need one.',
    planes: k,
    energyShare: d.planeCumulativeEnergy[k - 1],
    reconstructionError: row,
    transitiveIntransitiveSplit: d.split.comboFrequencyWeighted,
    basis: `combo-frequency-weighted rotation planes, artifact v${d.artifactVersion}`,
    boards: d.boardsPerSeed,
    seeds: d.seeds,
    planeThreshold: {
      sigma: d.noiseFloorSigma,
      method: 'largest singular value of the two-seed noise replica (S_A - S_B)/2',
    },
  });
};
