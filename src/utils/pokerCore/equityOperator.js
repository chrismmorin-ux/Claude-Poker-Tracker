/**
 * equityOperator.js — the all-in preflop equity operator, and its skew decomposition.
 *
 * WHAT THIS IS. `M[i][j]` is the all-in equity of 169-grid class `i` against class `j`
 * (win + half the ties), averaged over boards with exact card-removal exclusion. Indices are
 * `rangeMatrix.rangeIndex` indices, so this operator and every range grid in the app share
 * one coordinate system.
 *
 * WHY IT IS A FIRST-CLASS OBJECT AND NOT A SCRIPT OUTPUT. Heads-up equity satisfies
 *
 *      E(a, b) + E(b, a) = 1
 *
 * exactly, so `S = M - 1/2` is exactly skew-symmetric — a fact about the deck, not about this
 * repo's engine, and one that survives every engine change. A skew operator has NO real
 * eigen-axes; it decomposes canonically into two-dimensional ROTATION PLANES, and a rotation in
 * range space is a cycle. So the intransitivity of preflop poker — the part that makes it a game
 * rather than a ladder — is not a metaphor here. It is a measurable stack of rock-paper-scissors
 * planes with magnitudes, and it has a home.
 *
 * THREE RULES THIS MODULE EXISTS TO ENFORCE.
 *
 *  1. DO NOT SYMMETRISE. `(S + S^T)/2` is identically zero. Symmetrising this operator to make
 *     a familiar tool apply destroys 100% of its content. (Forming `S^T S = -S^2` is a
 *     different operation and is fine — that is the Gram operator, whose eigenspaces ARE S's
 *     invariant planes. The distinction is easy to lose and expensive to lose.)
 *  2. DO NOT REPORT AXES. Inside a rotation plane the basis is arbitrary: if (u, v) spans it,
 *     so does any rotation of them. The invariants are the plane's magnitude and each class's
 *     RADIUS in the plane. A table of "plane 3, axis A, top loadings" is a table of a basis
 *     choice.
 *  3. A COMPRESSION CLAIM CARRIES ALL THREE NUMBERS. Energy share flatters a low-rank claim;
 *     reconstruction error does not; and a pure strength ladder is ALREADY rank 2, so neither
 *     means anything without the transitive/intransitive split. `buildCompressionClaim`
 *     refuses to build a claim missing any of them, rather than leaving it to review.
 *
 * WHAT LIVES WHERE. The parts that are exact arithmetic — the antisymmetry residual, the
 * orthogonal transitive/intransitive projection, the intransitivity map — are computed here, so
 * a test can check them against a freshly built operator. The rotation-plane spectrum needs an
 * eigen-solver and is computed once by `scripts/research/spectrum.py` (numpy/scipy) and shipped
 * as a committed artifact, read through the sibling module `equitySkew.js`.
 *
 * THIS MODULE DELIBERATELY DOES NOT IMPORT THAT ARTIFACT. The artifact is generated from a
 * matrix that this module builds, so a dependency in that direction would make the generator
 * unrunnable whenever the artifact was absent — which is exactly the state a regeneration starts
 * from. `equitySkew.js` depends on this file; nothing here depends on it.
 */

import { bestFiveFromSeven } from './handEvaluator.js';
import { cardRank, cardSuit } from './cardParser.js';
import { rangeIndex, decodeIndex } from './rangeMatrix.js';

/** The operator is 169x169 — the same 13x13 grid every range in the app uses. */
export const OPERATOR_SIZE = 169;

/**
 * Combo multiplicity per class: 6 pocket-pair combos, 4 suited, 12 offsuit.
 *
 * These are WEIGHTS, not a prior. Normalising them to sum to 1 is legitimate here and is not
 * the thing DEC-025 forbids — a prior grid encodes propensities and must never be normalised;
 * this vector is the combinatorial frequency with which a class is dealt, which genuinely is a
 * distribution over the 1326 combos.
 */
export const comboMultiplicity = (idx) => {
  const { suited, isPair } = decodeIndex(idx);
  return isPair ? 6 : suited ? 4 : 12;
};

/** Combo frequencies over the 169 classes, summing to 1 (1326 combos). */
export const comboWeights = () => {
  const w = new Float64Array(OPERATOR_SIZE);
  let total = 0;
  for (let i = 0; i < OPERATOR_SIZE; i++) {
    w[i] = comboMultiplicity(i);
    total += w[i];
  }
  for (let i = 0; i < OPERATOR_SIZE; i++) w[i] /= total;
  return w;
};

/** Uniform weights — each of the 169 classes counted once, ignoring combinatorics. */
export const uniformWeights = () => {
  const w = new Float64Array(OPERATOR_SIZE);
  w.fill(1 / OPERATOR_SIZE);
  return w;
};

const RANK_CHARS = '23456789TJQKA';

/** Canonical label for a 169-grid index: "AA", "AKs", "AKo". */
export const classLabel = (idx) => {
  const { rank1, rank2, suited, isPair } = decodeIndex(idx);
  const hi = RANK_CHARS[rank1];
  const lo = RANK_CHARS[rank2];
  return isPair ? `${hi}${hi}` : `${hi}${lo}${suited ? 's' : 'o'}`;
};

/** Every class label, in 169-grid index order. */
export const classLabels = () =>
  Array.from({ length: OPERATOR_SIZE }, (_, i) => classLabel(i));

/**
 * Deterministic PRNG (mulberry32). Seeded so an operator build is byte-reproducible; a default
 * seed that is never recorded is reproducible-by-luck, so callers stamp the seed they used.
 */
export const mulberry32 = (a) => () => {
  a |= 0;
  a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * Build the equity operator by sampling complete boards.
 *
 * ENGINE-INDEPENDENT BY CONSTRUCTION: this reaches only the hand evaluator and a board sampler.
 * No villain model, no fold curve, no realization, no EV. A different engine — or a corrected
 * one — produces the same matrix, which is why the founder's standing caveat that the engine is
 * not accuracy-validated does not reach this number.
 *
 * Method, per board: evaluate every available combo once, sort by hand value, then sweep in
 * increasing order maintaining per-class cumulative counts. That yields all 169x169 pairwise
 * outcomes for the cost of one pass instead of 28,561 separate equity calls. Pairs of combos
 * sharing a card are subtracted out, so card removal is exact rather than approximated.
 *
 * @param {Object} [opts]
 * @param {number} [opts.boards=500] - complete 5-card boards to sample
 * @param {number} [opts.seed=20260803] - PRNG seed; recorded on the result
 * @param {Function} [opts.rng] - injected [0,1) generator; defaults to mulberry32(seed)
 * @returns {{matrix: Float64Array, boards: number, seed: number, emptyCells: number}}
 */
export const buildEquityOperator = ({ boards = 500, seed = 20260803, rng = null } = {}) => {
  const N = OPERATOR_SIZE;
  const rand = rng ?? mulberry32(seed);

  const win = new Float64Array(N * N);
  const tie = new Float64Array(N * N);
  const total = new Float64Array(N * N);
  const cumClass = new Float64Array(N);
  const groupClass = new Float64Array(N);
  const availClass = new Float64Array(N);

  const deck = new Int32Array(52);
  for (let c = 0; c < 52; c++) deck[c] = c;
  const seven = new Array(7);

  for (let b = 0; b < boards; b++) {
    for (let k = 0; k < 5; k++) {
      const j = k + Math.floor(rand() * (52 - k));
      const tmp = deck[k]; deck[k] = deck[j]; deck[j] = tmp;
    }
    const board = [deck[0], deck[1], deck[2], deck[3], deck[4]];
    const avail = [];
    for (let c = 0; c < 52; c++) {
      if (c !== board[0] && c !== board[1] && c !== board[2]
        && c !== board[3] && c !== board[4]) avail.push(c);
    }

    seven[2] = board[0]; seven[3] = board[1]; seven[4] = board[2];
    seven[5] = board[3]; seven[6] = board[4];

    const M = (47 * 46) / 2;
    const cA = new Int32Array(M);
    const cB = new Int32Array(M);
    const cls = new Int32Array(M);
    const val = new Int32Array(M);
    const byCard = Array.from({ length: 52 }, () => []);

    availClass.fill(0);
    let m = 0;
    for (let x = 0; x < 47; x++) {
      for (let y = x + 1; y < 47; y++) {
        const a = avail[x], d = avail[y];
        seven[0] = a; seven[1] = d;
        const v = bestFiveFromSeven(seven);
        const i = rangeIndex(cardRank(a), cardRank(d), cardSuit(a) === cardSuit(d));
        cA[m] = a; cB[m] = d; cls[m] = i; val[m] = v;
        byCard[a].push(m); byCard[d].push(m);
        availClass[i] += 1;
        m++;
      }
    }

    for (let i = 0; i < N; i++) {
      const ni = availClass[i];
      if (ni === 0) continue;
      const row = i * N;
      for (let j = 0; j < N; j++) total[row + j] += ni * availClass[j];
      total[row + i] -= ni; // a combo is never paired with itself
    }

    const order = new Int32Array(M);
    for (let k = 0; k < M; k++) order[k] = k;
    const orderArr = Array.from(order).sort((p, q) => val[p] - val[q]);

    cumClass.fill(0);
    let g = 0;
    while (g < M) {
      let h = g;
      const v = val[orderArr[g]];
      while (h < M && val[orderArr[h]] === v) h++;
      const groupClasses = [];
      for (let k = g; k < h; k++) {
        const i = cls[orderArr[k]];
        if (groupClass[i] === 0) groupClasses.push(i);
        groupClass[i] += 1;
      }

      for (let k = g; k < h; k++) {
        const c = orderArr[k];
        const i = cls[c];
        const row = i * N;
        for (let j = 0; j < N; j++) win[row + j] += cumClass[j];
        for (let gi = 0; gi < groupClasses.length; gi++) {
          const j = groupClasses[gi];
          tie[row + j] += groupClass[j];
        }
        tie[row + i] -= 1;

        const a = cA[c], d = cB[c];
        for (let s = 0; s < 2; s++) {
          const list = s === 0 ? byCard[a] : byCard[d];
          for (let q = 0; q < list.length; q++) {
            const e = list[q];
            if (e === c) continue;
            const je = cls[e];
            const ve = val[e];
            if (ve < v) win[row + je] -= 1;
            else if (ve === v) tie[row + je] -= 1;
            total[row + je] -= 1;
          }
        }
      }

      for (let gi = 0; gi < groupClasses.length; gi++) {
        const j = groupClasses[gi];
        cumClass[j] += groupClass[j];
        groupClass[j] = 0;
      }
      g = h;
    }
  }

  const matrix = new Float64Array(N * N);
  let emptyCells = 0;
  for (let k = 0; k < N * N; k++) {
    const t = total[k];
    if (t === 0) { matrix[k] = NaN; emptyCells++; continue; }
    matrix[k] = (win[k] + 0.5 * tie[k]) / t;
  }

  return { matrix, boards, seed, emptyCells };
};

/**
 * `max |M[i][j] + M[j][i] - 1|` — the premise of everything downstream.
 *
 * This is not a diagnostic. If it is not at machine precision then M is not an equity operator,
 * the skew decomposition is not a decomposition of anything, and every plane count below is
 * measuring a bug. Non-finite cells are skipped: an unsampled cell is a coverage problem, which
 * is a different fact from an asymmetry.
 */
export const antisymmetryResidual = (matrix, size = OPERATOR_SIZE) => {
  let worst = 0;
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const s = matrix[i * size + j] + matrix[j * size + i];
      if (Number.isFinite(s)) worst = Math.max(worst, Math.abs(s - 1));
    }
  }
  return worst;
};

/** `S = M - 1/2`, the exactly-skew part. The diagonal is exactly zero. */
export const skewPart = (matrix, size = OPERATOR_SIZE) => {
  const S = new Float64Array(size * size);
  for (let k = 0; k < S.length; k++) S[k] = matrix[k] - 0.5;
  for (let i = 0; i < size; i++) S[i * size + i] = 0;
  return S;
};

/** Frobenius norm in the w-weighted inner product `<A,B>_w = sum w_i w_j A_ij B_ij`. */
export const weightedNorm = (A, w, size = OPERATOR_SIZE) => {
  let acc = 0;
  for (let i = 0; i < size; i++) {
    const wi = w[i];
    for (let j = 0; j < size; j++) {
      const v = A[i * size + j];
      acc += wi * w[j] * v * v;
    }
  }
  return Math.sqrt(acc);
};

/**
 * Split S into its transitive (strength-ladder) part and its intransitive residual.
 *
 * A game is transitive exactly when `S_ij = f_i - f_j` for some potential f. Those matrices form
 * a LINEAR SUBSPACE, so the transitive part of S is the orthogonal PROJECTION onto it — there is
 * no free parameter to fit, and the split obeys Pythagoras:
 *
 *      ||S||^2 = ||T||^2 + ||R||^2      with R orthogonal to every transitive matrix.
 *
 * Minimising `||S - (f (x) 1 - 1 (x) f)||^2_w` gives, with no fitted scalar,
 *
 *      f = S w = (equity against a random hand) - 1/2.
 *
 * So the strength ladder is not a model someone chose; it is the projection, and its potential
 * happens to be exactly average equity. Fitting a scalar to a normalised strength vector — the
 * exploratory version of this measurement did that, in a different inner product than the one it
 * normalised in — produces a split that is close to this one and is not orthogonal, so its
 * shares are not a variance decomposition and are not entitled to be read as one.
 *
 * @param {Float64Array} S - the skew part
 * @param {Float64Array} w - weights summing to 1 (`comboWeights()` or `uniformWeights()`)
 * @returns {{potential: Float64Array, transitive: Float64Array, residual: Float64Array,
 *            skewNorm: number, transitiveNorm: number, residualNorm: number,
 *            transitiveShare: number, intransitiveShare: number, pythagorasResidual: number}}
 */
export const hodgeSplit = (S, w, size = OPERATOR_SIZE) => {
  const potential = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    let acc = 0;
    for (let j = 0; j < size; j++) acc += w[j] * S[i * size + j];
    potential[i] = acc;
  }
  const transitive = new Float64Array(size * size);
  const residual = new Float64Array(size * size);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const t = potential[i] - potential[j];
      transitive[i * size + j] = t;
      residual[i * size + j] = S[i * size + j] - t;
    }
  }
  const skewNorm = weightedNorm(S, w, size);
  const transitiveNorm = weightedNorm(transitive, w, size);
  const residualNorm = weightedNorm(residual, w, size);
  const s2 = skewNorm * skewNorm;
  return {
    potential,
    transitive,
    residual,
    skewNorm,
    transitiveNorm,
    residualNorm,
    transitiveShare: (transitiveNorm * transitiveNorm) / s2,
    intransitiveShare: (residualNorm * residualNorm) / s2,
    // The proof that the projection is orthogonal rather than merely close. If this is not at
    // machine precision the split is a fit, and its shares do not decompose anything.
    pythagorasResidual: Math.abs(
      (transitiveNorm * transitiveNorm + residualNorm * residualNorm - s2) / s2,
    ),
  };
};

/**
 * The intransitivity map: per hand class, the RMS cyclic edge it carries against a randomly
 * drawn opponent hand, in percentage points.
 *
 * This is the part of a class's equity that NO strength ladder can express — where strategic
 * subtlety is even possible. The opponent index is averaged under combo frequency, because the
 * opponent is drawn from the 1326 combos and not from the 169 labels.
 */
export const intransitivityMap = (residual, w, size = OPERATOR_SIZE) => {
  const map = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    let acc = 0;
    for (let j = 0; j < size; j++) {
      const v = residual[i * size + j];
      acc += w[j] * v * v;
    }
    map[i] = Math.sqrt(acc) * 100;
  }
  return map;
};

// ---------------------------------------------------------------------------
// Compression claims
// ---------------------------------------------------------------------------

/**
 * What a compression claim about this operator must carry. WS-337: "A claim reporting only
 * energy share fails review." Review is a person; this list is code.
 */
export const COMPRESSION_CLAIM_PARTS = Object.freeze([
  'planes',
  'energyShare',
  'reconstructionError',
  'transitiveIntransitiveSplit',
  'basis',
  'boards',
  'seeds',
  'planeThreshold',
]);

/** Problems with a compression claim, as strings. Empty means quotable. */
export const compressionClaimProblems = (claim) => {
  const problems = [];
  if (!claim || typeof claim !== 'object') return ['compression claim is missing'];

  for (const part of COMPRESSION_CLAIM_PARTS) {
    if (claim[part] === undefined || claim[part] === null) {
      problems.push(`claim.${part} is missing`);
    }
  }
  if (problems.length) {
    // The three that carry the argument get the reason spelled out; the rest are self-evident.
    if (claim?.reconstructionError == null) {
      problems.push(
        'reconstructionError is the honest half — energy share is a ratio of squared magnitudes '
        + 'and flatters a low-rank claim, while reconstruction error says how wrong the '
        + 'reconstructed equities actually are',
      );
    }
    if (claim?.transitiveIntransitiveSplit == null) {
      problems.push(
        'transitiveIntransitiveSplit is required because a purely transitive game is ALREADY '
        + 'rank 2 — "few planes explain most of S" is no news without it',
      );
    }
    return problems;
  }

  const { energyShare, reconstructionError: err, transitiveIntransitiveSplit: split } = claim;
  if (!(energyShare > 0) || energyShare > 1.0000001) {
    problems.push(`claim.energyShare must lie in (0, 1] — got ${energyShare}`);
  }
  for (const field of ['meanAbsPP', 'maxPP']) {
    if (typeof err[field] !== 'number' || !Number.isFinite(err[field])) {
      problems.push(`claim.reconstructionError.${field} must be a number of percentage points`);
    }
  }
  const shares = (split.transitiveShare ?? NaN) + (split.intransitiveShare ?? NaN);
  if (!(Math.abs(shares - 1) < 1e-6)) {
    problems.push(
      'claim.transitiveIntransitiveSplit shares must sum to 1 — they come from an ORTHOGONAL '
      + 'projection, and shares that do not sum to 1 mean a fitted split was substituted for it',
    );
  }
  if (!Array.isArray(claim.seeds) || claim.seeds.length === 0) {
    problems.push('claim.seeds must list every seed actually used');
  }
  if (claim.planeThreshold?.sigma === undefined || !claim.planeThreshold?.method) {
    problems.push(
      'claim.planeThreshold needs a sigma AND the method that produced it — a plane count is a '
      + 'decision about where the cut goes, not a fact about the operator',
    );
  }
  return problems;
};

/** Build a compression claim, refusing an incomplete one. */
export const buildCompressionClaim = (input) => {
  const claim = {};
  for (const part of COMPRESSION_CLAIM_PARTS) claim[part] = input?.[part] ?? null;
  claim.note = input?.note ?? null;
  const problems = compressionClaimProblems(claim);
  if (problems.length) {
    throw new Error(
      `compression claim about the equity operator is incomplete:\n  - ${problems.join('\n  - ')}`,
    );
  }
  return Object.freeze(claim);
};

/**
 * The sentence a compression claim may be quoted as.
 *
 * This exists so the three required numbers travel together in prose too. A stored field with no
 * reader rots (WS-328); a required field whose reader drops it rots faster.
 */
export const describeCompressionClaim = (claim) => {
  const problems = compressionClaimProblems(claim);
  if (problems.length) throw new Error(`cannot describe an incomplete claim: ${problems[0]}`);
  const { planes, energyShare, reconstructionError: e, transitiveIntransitiveSplit: s } = claim;
  return (
    `${planes} rotation planes (${planes * 2} coordinates per class) carry `
    + `${(energyShare * 100).toFixed(2)}% of the skew energy and reproduce class-vs-class equity `
    + `to ${e.meanAbsPP.toFixed(2)}pp mean / ${e.maxPP.toFixed(2)}pp max. `
    + `${(s.transitiveShare * 100).toFixed(1)}% of the operator is a transitive strength ladder, `
    + `which is already rank 2; the intransitive residual is ${(s.intransitiveShare * 100).toFixed(1)}%. `
    + `Basis: ${claim.basis}. Measured on ${claim.boards} boards per seed, seeds `
    + `[${claim.seeds.join(', ')}], planes cut at sigma > ${claim.planeThreshold.sigma} `
    + `(${claim.planeThreshold.method}).`
  );
};
