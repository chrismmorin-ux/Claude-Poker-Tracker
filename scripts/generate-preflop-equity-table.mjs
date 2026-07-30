#!/usr/bin/env node
/**
 * generate-preflop-equity-table.mjs — WS-274 Phase 2 codegen.
 *
 * Emits `src/utils/pokerCore/preflopEquityTable.js`: for each hero opening position and
 * each of the 169 hand classes a seat behind hero could hold, that class's all-in
 * preflop equity against hero's population opening range.
 *
 * WHY THIS EXISTS
 * ---------------
 * `foldThroughPerCombo` prices each seat behind hero per combo, and a combo's fold
 * decision is a logistic of (its equity ÷ the price it is being offered) — POKER_THEORY
 * §7.1/§7.3. That needs per-combo equity at a live decision, for up to eight seats,
 * inside a sub-50ms budget. Monte Carlo cannot do that live; a lookup can.
 *
 * WHY 5 x 169 AND NOT 169 x 169
 * -----------------------------
 * The seat's side keeps full per-combo resolution — that is what §7.3 demands and what
 * makes the model better than a bucket lookup. Hero's side is collapsed to a position
 * chart because hero's side is ALREADY an approximation: the engine has no model of
 * hero's strategy, nor of what villain believes hero holds (WS-276). Spending 28,561
 * cells to resolve a quantity that is a placeholder would be false precision. When
 * WS-276 lands a real hero-range model, pass `--full` to emit the 169x169 form.
 *
 * DETERMINISM — AND ITS LIMIT
 * ---------------------------
 * Runtime behaviour IS deterministic: the committed table is a static lookup, so tests
 * and live advice read fixed numbers.
 *
 * Regeneration is NOT byte-reproducible. `monteCarloEquity` draws from `Math.random`
 * with no seed hook, and adding one would mean changing a hot production path purely
 * for codegen convenience. So a re-run reproduces each cell only to within Monte Carlo
 * error — about +/-35 basis points at the default 20,000 trials (se = sqrt(0.25/n)) —
 * and `git diff` after regenerating will show small movement in most cells. That is
 * expected, not a defect. Unlike `generate-handhq-reference.mjs`, which is a pure
 * transform of a fixed input and therefore genuinely byte-stable, this generator
 * samples. Treat the committed file as the source of truth and regenerate only
 * deliberately.
 *
 * Usage:
 *   node --import ./scripts/utils/register-src-resolver.mjs \
 *        scripts/generate-preflop-equity-table.mjs [--trials N] [--out PATH]
 *
 * Takes ~8 minutes at the default 20,000 trials/cell.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { handVsRange } from '../src/utils/pokerCore/monteCarloEquity.js';
import { decodeIndex } from '../src/utils/pokerCore/rangeMatrix.js';
import { encodeCard } from '../src/utils/pokerCore/cardParser.js';
import { getPopulationPrior } from '../src/utils/rangeEngine/populationPriors.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

/** Hero opening positions, in the 5-category model (`RANGE_POSITION_CATEGORIES`). */
const HERO_POSITIONS = ['EARLY', 'MIDDLE', 'LATE', 'SB', 'BB'];

const GRID_SIZE = 169;

const argv = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] != null ? argv[i + 1] : fallback;
};
const TRIALS = Number(argValue('--trials', 20000));
const OUT = path.resolve(REPO, argValue('--out', 'src/utils/pokerCore/preflopEquityTable.js'));

/**
 * A representative 2-card combo for a hand class.
 *
 * Preflop equity against a 169-grid range is suit-symmetric — the range assigns equal
 * weight to every suit permutation of a class — so one representative per class is
 * exact, not a sample. Suited classes need both cards in one suit; offsuit and pairs
 * need two distinct suits.
 */
const representativeCombo = (idx) => {
  const { rank1, rank2, suited, isPair } = decodeIndex(idx);
  if (isPair) return [encodeCard(rank1, 0), encodeCard(rank2, 1)];
  if (suited) return [encodeCard(rank1, 0), encodeCard(rank2, 0)];
  return [encodeCard(rank1, 0), encodeCard(rank2, 1)];
};

const HAND_LABELS = (() => {
  const RANKS = '23456789TJQKA';
  const labels = new Array(GRID_SIZE);
  for (let i = 0; i < GRID_SIZE; i++) {
    const { rank1, rank2, suited, isPair } = decodeIndex(i);
    const hi = RANKS[Math.max(rank1, rank2)];
    const lo = RANKS[Math.min(rank1, rank2)];
    labels[i] = isPair ? `${hi}${lo}` : `${hi}${lo}${suited ? 's' : 'o'}`;
  }
  return labels;
})();

const main = async () => {
  const table = {};

  for (const position of HERO_POSITIONS) {
    const heroRange = getPopulationPrior(position, 'open');
    const row = new Array(GRID_SIZE);

    for (let idx = 0; idx < GRID_SIZE; idx++) {
      const seatCards = representativeCombo(idx);
      const result = await handVsRange(seatCards, heroRange, [], {
        trials: TRIALS,
        minTrials: TRIALS,
        convergenceThreshold: 0, // no early exit — every cell gets the same budget
      });
      // Store as integer basis points: compact, and exact equality in tests.
      row[idx] = Math.round(result.equity * 10000);
    }

    table[position] = row;
    process.stderr.write(`  ${position} done\n`);
  }

  writeFileSync(OUT, render(table), 'utf8');
  process.stderr.write(`\nWrote ${path.relative(REPO, OUT)}\n`);
};

const render = (table) => {
  const rows = HERO_POSITIONS.map((pos) => {
    const values = table[pos];
    const lines = [];
    for (let i = 0; i < GRID_SIZE; i += 13) {
      lines.push(`    ${values.slice(i, i + 13).join(', ')},`);
    }
    return `  ${pos}: Object.freeze([\n${lines.join('\n')}\n  ]),`;
  }).join('\n');

  return `/**
 * preflopEquityTable.js — GENERATED. Do not hand-edit.
 *
 * Regenerate with:
 *   node --import ./scripts/utils/register-src-resolver.mjs \\
 *        scripts/generate-preflop-equity-table.mjs
 *
 * All-in preflop equity of each of the 169 hand classes AGAINST hero's population
 * opening range, keyed by hero's opening position. Values are integer basis points
 * (5000 = 50.00% equity).
 *
 * Consumed by \`exploitEngine/preflopFoldResolver.foldThroughPerCombo\` (WS-274), which
 * needs per-combo equity for every seat behind hero inside a live sub-50ms budget —
 * Monte Carlo cannot meet that, a lookup can.
 *
 * SCOPE / NAMED APPROXIMATION. Hero's side is a position chart, not a real hero range:
 * the engine has no model of hero's strategy nor of what villain believes hero holds
 * (WS-276). The seat's side keeps full per-class resolution, which is the side §7.3
 * actually constrains. Regenerate with \`--full\` once WS-276 lands a hero-range model.
 *
 * Generated at ${TRIALS} Monte Carlo trials per cell (sampling error ~+/-35 bp). The
 * generator samples rather than enumerates, so regenerating moves cells slightly; this
 * committed file is the source of truth that tests and live advice read.
 */

/** Equity in basis points: EQUITY_VS_OPEN[heroPosition][handClassIndex]. */
export const EQUITY_VS_OPEN = Object.freeze({
${rows}
});

/** Hand-class labels by grid index — for debugging and audit output only. */
export const HAND_LABELS = Object.freeze(${JSON.stringify(HAND_LABELS)});

/** Trials per cell used to generate this table. */
export const GENERATED_TRIALS = ${TRIALS};
`;
};

main().catch((err) => {
  process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
