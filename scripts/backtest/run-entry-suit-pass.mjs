/**
 * run-entry-suit-pass.mjs — WS-323. Re-price the straddling cells at combo grain.
 *
 * Usage:
 *   node scripts/backtest/run-entry-suit-pass.mjs [--map PATH] [--tau BB] [--mc N] [--out PATH]
 *
 *   --map PATH   The headline map to read bands from  (default .artifacts/entry-map.json)
 *   --tau BB     τ the cells are banded at            (default: the map's own)
 *   --mc N       MC replicates per combo              (default 3)
 *   --flops N    Flop samples per archetype           (default 6)
 *   --limit N    Stop after N cells — smoke runs only
 *   --out PATH   Output (default .artifacts/entry-map-suit-pass.json)
 *
 * See `suitPass.mjs` for why only the straddling cells are re-priced, and for the difference
 * between a point-estimate sign split (noise) and an interval sign split (a class that should
 * not have been one cell).
 *
 * The evaluator, Field, opener range and pot geometry are the SAME ones the headline map used
 * — `entryEvaluator.mjs`, imported, not re-implemented. A second copy of that setup would make
 * this pass incomparable to the map it is supposed to be checking.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { bandOf, loadEntryMap } from './entryMap.mjs';
import { openEntryEvaluator, seedFor } from './entryEvaluator.mjs';
import { REFERENCE_FIELD_CORPUS } from './leakageGuard.mjs';
import {
  SUIT_PASS_SCHEMA_VERSION,
  formatCombo,
  straddlingCells,
  suitPassHeadline,
  summarizeCombos,
} from './suitPass.mjs';
import { gitStamp } from './replicationStamp.mjs';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };

const MAP_PATH = flag('map', '.artifacts/entry-map.json');
const TAU_ARG = flag('tau', null);
const MC_REPLICATES = Number(flag('mc', 3));
const FLOP_SAMPLES = Number(flag('flops', 6));
const LIMIT = flag('limit', null) ? Number(flag('limit', null)) : null;
const OUT = flag('out', '.artifacts/entry-map-suit-pass.json');

/**
 * A slice of the STRADDLING list, for running the pass in chunks.
 *
 * Indexes the straddling cells, not the full map — those are the only ones this pass touches.
 * Each cell's seeds still come from its index in the FULL enumeration (see `indexOf` below), so
 * a chunk boundary changes no input, exactly as in `run-entry-map.mjs`.
 */
const FROM = flag('from', null) === null ? 0 : Number(flag('from', null));
const TO = flag('to', null) === null ? null : Number(flag('to', null));

const main = async () => {
  const t0 = Date.now();
  const raw = JSON.parse(await readFile(MAP_PATH, 'utf8'));
  const map = loadEntryMap(raw, { tauBB: TAU_ARG === null ? null : Number(TAU_ARG) });
  for (const w of map.warnings) console.log(`! map: ${w}`);

  const tauBB = map.reporting.tauBB;
  const targets = straddlingCells(map);
  const sliceEnd = TO === null ? (LIMIT ? FROM + LIMIT : targets.length) : TO;
  const work = targets.slice(FROM, sliceEnd);

  // The cell's index in the FULL map, not in the filtered list — seeds must match the identity
  // of the cell, so that re-running the pass after the band membership changes does not re-seed
  // cells that did not move.
  const indexOf = new Map(map.cells.map((c, i) => [c.cellId, i]));

  const totalCombos = work.reduce((n, c) => n + (c.handClass.length === 2 ? 6 : c.handClass.endsWith('s') ? 4 : 12), 0);
  console.log(`suit pass: ${work.length} straddling cells of ${map.cells.length} · ` +
    `~${totalCombos} combos · mc=${MC_REPLICATES} · τ=${tauBB}bb`);

  const ev = await openEntryEvaluator({
    stakeBB: map.field?.stakeBB ?? 0.5,
    seatBucket: map.field?.seatBucket ?? '6max',
    flopSamples: FLOP_SAMPLES,
    mcReplicates: MC_REPLICATES,
    // WS-375. Declared, not assumed: this run reads the SHIPPED all-corpus
    // aggregates as its FIELD and scores no corpus hand. The guard refuses
    // every scoring assertion under this declaration.
    reference: REFERENCE_FIELD_CORPUS,
  });

  const cells = [];
  let done = 0;

  for (const cell of work) {
    const cellIndex = indexOf.get(cell.cellId);
    const combos = [];

    const allCombos = ev.combosOf(cell.handClass);
    for (let ci = 0; ci < allCombos.length; ci++) {
      const heroCards = allCombos[ci];
      const out = await ev.evaluateCell(cell, {
        heroCards,
        seedBase: seedFor(cellIndex, ci + 1),
      });
      combos.push({
        combo: formatCombo(heroCards),
        ...(out.degenerate
          ? { degenerate: true, margin: null, band: null }
          : { degenerate: false, ...out, band: bandOf(out, tauBB) }),
      });
    }

    cells.push({
      cellId: cell.cellId,
      handClass: cell.handClass,
      posCategory: cell.posCategory,
      facingAction: cell.facingAction,
      // The headline map's answer, kept alongside so the two grains can be compared directly
      // rather than by joining two files by hand.
      classMargin: cell.margin,
      classBand: cell.band,
      summary: summarizeCombos(combos, tauBB),
      combos,
    });

    if (++done % 20 === 0) {
      console.log(`  ${done}/${work.length} cells · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }

  const git = gitStamp();
  const artifact = {
    schemaVersion: SUIT_PASS_SCHEMA_VERSION,
    generatedBy: 'scripts/backtest/run-entry-suit-pass.mjs',
    basedOn: {
      map: MAP_PATH,
      policyId: map.continuationPolicy.id,
      mapEngineCommit: map.engineCommit,
      mapEngineDirty: Boolean(map.engineDirty),
      tauBB,
    },
    engineCommit: git.engineCommit,
    engineDirty: git.engineDirty,
    reporting: { mcReplicates: MC_REPLICATES, flopSamplesPerArchetype: FLOP_SAMPLES, tauBB },
    // Which slice of the straddling list this file holds — a partial pass that did not say so
    // would read as a complete one whose absent cells simply had nothing to report.
    slice: { from: FROM, to: FROM + work.length, ofStraddling: targets.length },
    headline: suitPassHeadline(cells, tauBB),
    cells,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(artifact, null, 2));
  await ev.close();

  const h = artifact.headline;
  console.log(`\ncells repriced:                    ${h.cellsRepriced}`);
  console.log(`combos evaluated:                  ${h.combosEvaluated}`);
  console.log(`classes that should NOT be one cell: ${h.classesThatShouldNotBeOneCell}  (intervals establish opposite signs)`);
  console.log(`point-estimate sign split only:    ${h.pointSignSplitOnly}  (noise, not a finding)`);
  console.log(`within-class spread > τ:           ${h.spreadExceedsTau}`);

  const split = cells.filter((c) => c.summary.signSplit);
  if (split.length) {
    console.log('\nclasses whose suits disagree:');
    for (const c of split) {
      console.log(`  ${c.cellId.padEnd(24)} spread ${c.summary.spread.toFixed(3)}bb ` +
        `[${c.summary.minMargin.toFixed(3)}, ${c.summary.maxMargin.toFixed(3)}]`);
    }
  }

  console.log(`\nwrote ${OUT} · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
