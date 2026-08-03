#!/usr/bin/env node
/**
 * build-equity-matrix.mjs — EXPLORATORY. Not a product artifact.
 *
 * Emits the full 169x169 all-in preflop equity matrix M, where
 *   M[i][j] = P(class i beats class j) + 0.5 * P(tie)
 * averaged over random 5-card boards, with exact card-removal exclusion
 * (a pair of combos sharing a card is never counted).
 *
 * ENGINE-INDEPENDENCE: this touches only pokerCore's hand evaluator and a
 * board sampler. No villain model, no fold curve, no realization, no EV.
 * The matrix is a property of the deck, not of this repo's engine.
 *
 * Method (per board): evaluate every available combo once, sort, then sweep
 * in increasing hand-value order maintaining per-class cumulative counts.
 * That gives all 169x169 pairwise outcomes for the cost of one pass, instead
 * of 28,561 separate equity calls.
 *
 * Usage:
 *   node --import ./scripts/utils/register-src-resolver.mjs \
 *        <this file> [--boards N] [--seed S] [--out PATH]
 */

import { writeFileSync } from 'node:fs';

import { bestFiveFromSeven } from '../../src/utils/pokerCore/handEvaluator.js';
import { cardRank, cardSuit } from '../../src/utils/pokerCore/cardParser.js';
import { rangeIndex, decodeIndex } from '../../src/utils/pokerCore/rangeMatrix.js';

const N = 169;

const argOf = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? dflt : process.argv[i + 1];
};
const BOARDS = parseInt(argOf('--boards', '500'), 10);
const SEED = parseInt(argOf('--seed', '20260803'), 10);
const OUT = argOf('--out', 'equity-matrix.csv');

/** Deterministic PRNG (mulberry32) so this run is reproducible. */
const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rand = mulberry32(SEED);

const RANK_CHARS = '23456789TJQKA';
const classLabel = (idx) => {
  const { rank1, rank2, suited, isPair } = decodeIndex(idx);
  const hi = RANK_CHARS[rank1];
  const lo = RANK_CHARS[rank2];
  return isPair ? `${hi}${hi}` : `${hi}${lo}${suited ? 's' : 'o'}`;
};

// ---- accumulators (Float64 to avoid int32 overflow over many boards) ----
const win = new Float64Array(N * N);
const tie = new Float64Array(N * N);
const total = new Float64Array(N * N);

// scratch
const cumClass = new Float64Array(N);
const groupClass = new Float64Array(N);
const availClass = new Float64Array(N);

const deck = new Int32Array(52);
for (let c = 0; c < 52; c++) deck[c] = c;

const seven = new Array(7);

const t0 = Date.now();

for (let b = 0; b < BOARDS; b++) {
  // --- draw a 5-card board via partial Fisher-Yates ---
  for (let k = 0; k < 5; k++) {
    const j = k + Math.floor(rand() * (52 - k));
    const tmp = deck[k]; deck[k] = deck[j]; deck[j] = tmp;
  }
  const board = [deck[0], deck[1], deck[2], deck[3], deck[4]];
  const avail = [];
  for (let c = 0; c < 52; c++) {
    if (c !== board[0] && c !== board[1] && c !== board[2] && c !== board[3] && c !== board[4]) avail.push(c);
  }
  // avail.length === 47

  seven[2] = board[0]; seven[3] = board[1]; seven[4] = board[2];
  seven[5] = board[3]; seven[6] = board[4];

  // --- enumerate available combos: value + class ---
  const M = (47 * 46) / 2; // 1081
  const cA = new Int32Array(M);
  const cB = new Int32Array(M);
  const cls = new Int32Array(M);
  const val = new Int32Array(M);
  // per-card index of combos containing that card
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

  // --- total[i][j] base: n_i * availClass[j], then per-combo corrections ---
  for (let i = 0; i < N; i++) {
    const ni = availClass[i];
    if (ni === 0) continue;
    const row = i * N;
    for (let j = 0; j < N; j++) total[row + j] += ni * availClass[j];
    total[row + i] -= ni; // exclude self-pairing
  }

  // --- sort combo indices by hand value ascending ---
  const order = new Int32Array(M);
  for (let k = 0; k < M; k++) order[k] = k;
  const orderArr = Array.from(order).sort((p, q) => val[p] - val[q]);

  // --- sweep in value order, grouping ties ---
  cumClass.fill(0);
  let g = 0;
  while (g < M) {
    let h = g;
    const v = val[orderArr[g]];
    while (h < M && val[orderArr[h]] === v) h++;
    // group is orderArr[g..h)
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
      // beats everything strictly below
      for (let j = 0; j < N; j++) win[row + j] += cumClass[j];
      // ties with the rest of its own group (excluding itself)
      for (let gi = 0; gi < groupClasses.length; gi++) {
        const j = groupClasses[gi];
        tie[row + j] += groupClass[j];
      }
      tie[row + i] -= 1;

      // --- card-removal correction: drop pairs sharing a card ---
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

  if ((b + 1) % 25 === 0) {
    const el = (Date.now() - t0) / 1000;
    process.stderr.write(`  board ${b + 1}/${BOARDS}  ${el.toFixed(1)}s  (${(el / (b + 1)).toFixed(2)}s/board)\n`);
  }
}

// --- assemble M ---
const eq = new Float64Array(N * N);
let missing = 0;
for (let k = 0; k < N * N; k++) {
  const t = total[k];
  if (t === 0) { eq[k] = NaN; missing++; continue; }
  eq[k] = (win[k] + 0.5 * tie[k]) / t;
}

// --- self-check: antisymmetry M[i][j] + M[j][i] === 1 ---
let maxAsym = 0;
for (let i = 0; i < N; i++) {
  for (let j = 0; j < N; j++) {
    const s = eq[i * N + j] + eq[j * N + i];
    if (Number.isFinite(s)) maxAsym = Math.max(maxAsym, Math.abs(s - 1));
  }
}

const labels = [];
for (let i = 0; i < N; i++) labels.push(classLabel(i));

const lines = [labels.join(',')];
for (let i = 0; i < N; i++) {
  const row = [];
  for (let j = 0; j < N; j++) row.push(eq[i * N + j].toFixed(6));
  lines.push(row.join(','));
}
writeFileSync(OUT, lines.join('\n'));

process.stderr.write(`\nboards=${BOARDS} seed=${SEED}\n`);
process.stderr.write(`max |M[i][j]+M[j][i]-1| = ${maxAsym.toExponential(3)}  (must be ~0)\n`);
process.stderr.write(`empty cells: ${missing}\n`);
process.stderr.write(`elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
process.stderr.write(`wrote ${OUT}\n`);
