/**
 * run-entry-map.mjs — WS-323. Compute the Entry Map and write it out.
 *
 * Enumerates every cell in the declared domain, evaluates it through the PRODUCTION preflop
 * advisor, and emits each cell's margin with a decomposed interval. See `entryMap.mjs` for why
 * this enumerates rather than observes, and why zero is the interesting number; see
 * `entryEvaluator.mjs` for how a single cell is priced.
 *
 * Usage:
 *   node scripts/backtest/run-entry-map.mjs [options]
 *
 *   --mc N            Monte Carlo replicates per cell at the central Field  (default 4)
 *   --flops N         Flop samples per archetype inside the advisor         (default 6)
 *   --tau BB          Reporting half-width separating marginal from unmeasured (default 0.25)
 *   --stake BB        Which pool segment to read the Field from             (default 0.5)
 *   --seats 6max|full Seat bucket for the Field                             (default 6max)
 *   --hands N         Limit to the first N cells — smoke runs only
 *   --out PATH        Output file (default .artifacts/entry-map.json)
 *
 * WHY THE HERO'S CARDS ARE PICKED CANONICALLY. A 169-class cell is a rank-pair class, and the
 * engine wants two actual cards. `combosOf` returns every combo of the class; the headline map
 * takes the FIRST, which is a canonical suit assignment. That is an approximation and it is
 * named rather than hidden: within a class the combos differ by blocker and suitedness effects,
 * which is exactly what `run-entry-suit-pass.mjs` measures on the cells where it could change
 * the answer. Cells far from zero are not sensitive to it.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  CONTINUATION_POLICY,
  DEFAULT_TAU_BB,
  ENTRY_MAP_SCHEMA_VERSION,
  FIELD_QUANTILES,
  bandOf,
  enumerateCells,
} from './entryMap.mjs';
import { openEntryEvaluator, seedFor } from './entryEvaluator.mjs';
import { gitStamp } from './replicationStamp.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};

const MC_REPLICATES = Number(flag('mc', 4));
const FLOP_SAMPLES = Number(flag('flops', 6));
const TAU_BB = Number(flag('tau', DEFAULT_TAU_BB));
const STAKE_BB = Number(flag('stake', 0.5));
const SEAT_BUCKET = flag('seats', '6max');
const CELL_LIMIT = flag('hands', null) ? Number(flag('hands', null)) : null;
const OUT_PATH = flag('out', '.artifacts/entry-map.json');

const main = async () => {
  const t0 = Date.now();
  const ev = await openEntryEvaluator({
    stakeBB: STAKE_BB,
    seatBucket: SEAT_BUCKET,
    flopSamples: FLOP_SAMPLES,
    mcReplicates: MC_REPLICATES,
  });

  const cells = enumerateCells(ev.handClasses);
  const work = CELL_LIMIT ? cells.slice(0, CELL_LIMIT) : cells;

  console.log(`entry map: ${work.length} cells (${ev.handClasses.length} classes) · ` +
    `mc=${MC_REPLICATES} · flops/archetype=${FLOP_SAMPLES} · field=${FIELD_QUANTILES.length} quantiles · ` +
    `${MC_REPLICATES + FIELD_QUANTILES.length - 1} engine evaluations per cell`);

  const results = [];
  let done = 0;
  let degenerate = 0;
  let unreachable = 0;

  for (let i = 0; i < work.length; i++) {
    const cell = work[i];

    // Structurally unreachable spots get no number, ever. Recorded, never fabricated.
    if (!cell.reachable) {
      unreachable++;
      results.push({ ...cell, degenerate: false, margin: null, band: null });
      continue;
    }

    // The canonical combo. Seeds come from the cell's index in the STABLE enumeration, not
    // from a counter of evaluated cells — a counter shifts the moment a cell is skipped, so
    // adding one unreachable spot would re-seed every cell after it and manufacture migration.
    const heroCards = ev.combosOf(cell.handClass)[0];
    const out = await ev.evaluateCell(cell, { heroCards, seedBase: seedFor(i) });

    if (out.degenerate) {
      degenerate++;
      results.push({ ...cell, degenerate: true, margin: null, band: null });
      continue;
    }

    results.push({ ...cell, ...out, band: bandOf(out, TAU_BB) });

    if (++done % 100 === 0) {
      console.log(`  ${done}/${work.length} cells · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }

  const git = gitStamp();
  const artifact = {
    schemaVersion: ENTRY_MAP_SCHEMA_VERSION,
    generatedBy: 'scripts/backtest/run-entry-map.mjs',
    continuationPolicy: CONTINUATION_POLICY,
    engineCommit: git.engineCommit,
    engineDirty: git.engineDirty,
    reporting: {
      tauBB: TAU_BB, fieldQuantiles: FIELD_QUANTILES, mcReplicates: MC_REPLICATES,
      flopSamplesPerArchetype: FLOP_SAMPLES,
    },
    field: ev.fieldStamp,
    domain: { gameType: 'cash', seats: [6, 9], stackDepthBB: [80, 200] },
    counts: {
      cells: results.length,
      unreachable,
      degenerate,
      evaluated: results.length - unreachable - degenerate,
      byBand: results.reduce((acc, c) => {
        const k = c.band ?? (c.reachable === false ? 'unreachable' : 'degenerate');
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {}),
    },
    cells: results,
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(artifact, null, 2));
  await ev.close();

  console.log(`\nwrote ${OUT_PATH} · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log('bands:', artifact.counts.byBand);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
