#!/usr/bin/env node
/**
 * build-equity-matrix.mjs — CLI wrapper around the equity operator.
 *
 * Emits the full 169x169 all-in preflop equity matrix M, where
 *   M[i][j] = P(class i beats class j) + 0.5 * P(tie)
 * averaged over random 5-card boards, with exact card-removal exclusion (a pair of combos
 * sharing a card is never counted). Rows and columns are `rangeMatrix.rangeIndex` indices, so
 * the CSV and every range grid in the app share one coordinate system.
 *
 * THE CONSTRUCTION ITSELF LIVES IN `src/utils/pokerCore/equityOperator.js` (WS-337). It used to
 * live here, which made the operator a property of a research script rather than of the repo —
 * and a matrix whose only definition is inside a script cannot be asserted about by a test.
 *
 * ENGINE-INDEPENDENCE: this touches only the hand evaluator and a seeded board sampler. No
 * villain model, no fold curve, no realization, no EV. The matrix is a property of the deck, not
 * of this repo's engine.
 *
 * Usage:
 *   node --import ./scripts/utils/register-src-resolver.mjs \
 *        <this file> [--boards N] [--seed S] [--out PATH]
 *
 * Writes PATH and PATH.meta.json (boards, seed, antisymmetry residual).
 */

import { writeFileSync } from 'node:fs';

import {
  OPERATOR_SIZE,
  buildEquityOperator,
  antisymmetryResidual,
  classLabels,
} from '../../src/utils/pokerCore/equityOperator.js';

const argOf = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? dflt : process.argv[i + 1];
};
const BOARDS = parseInt(argOf('--boards', '500'), 10);
const SEED = parseInt(argOf('--seed', '20260803'), 10);
const OUT = argOf('--out', 'equity-matrix.csv');

const N = OPERATOR_SIZE;
const t0 = Date.now();

const { matrix, emptyCells } = buildEquityOperator({ boards: BOARDS, seed: SEED });

// Self-check: M[i][j] + M[j][i] must equal 1. This is the premise of the whole skew
// decomposition, so it is checked here rather than assumed downstream.
const maxAsym = antisymmetryResidual(matrix);

// Full precision, not toFixed(6). `String(x)` emits the shortest decimal that round-trips
// exactly, so the CSV is both byte-reproducible AND lossless. At 6dp the stored matrix would be
// antisymmetric only to ~1e-6, putting the max|S + S^T| < 1e-12 assertion below the file's own
// resolution — the test would then be measuring the writer rather than the operator.
const lines = [classLabels().join(',')];
for (let i = 0; i < N; i++) {
  const row = [];
  for (let j = 0; j < N; j++) row.push(String(matrix[i * N + j]));
  lines.push(row.join(','));
}
writeFileSync(OUT, lines.join('\n'));

// Sidecar metadata. The seed and the board count are what make the CSV replicable, and a
// default that is never recorded is reproducible-by-luck — spectrum.py reads this rather than
// being told the seed again on its own command line, where the two could disagree.
writeFileSync(`${OUT}.meta.json`, `${JSON.stringify({
  generatedBy: 'scripts/research/build-equity-matrix.mjs',
  boards: BOARDS,
  seed: SEED,
  prng: 'mulberry32',
  antisymmetryResidual: maxAsym,
  emptyCells,
}, null, 2)}\n`);

process.stderr.write(`\nboards=${BOARDS} seed=${SEED}\n`);
process.stderr.write(`max |M[i][j]+M[j][i]-1| = ${maxAsym.toExponential(3)}  (must be ~0)\n`);
process.stderr.write(`empty cells: ${emptyCells}\n`);
process.stderr.write(`elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
process.stderr.write(`wrote ${OUT} and ${OUT}.meta.json\n`);
