/**
 * run-merge-suit-pass.mjs — WS-323. Reassemble a chunked suit pass.
 *
 * Usage:
 *   node scripts/backtest/run-merge-suit-pass.mjs [--parts PREFIX] [--out PATH]
 *
 * The same completeness discipline as `mergeEntryMap.mjs`, for the same reason: a pass with a
 * gap in it reads as a complete pass whose absent cells had nothing to report, and those are
 * different facts. The headline is RECOMPUTED from the merged cells rather than summed from the
 * chunks' own headlines — `suitPassHeadline` is a pure function of the cells, so recomputing it
 * cannot drift from what the cells actually say, whereas adding up per-chunk counts can.
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, basename, join } from 'node:path';

import { suitPassHeadline } from './suitPass.mjs';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };

const PREFIX = flag('parts', '.artifacts/entry-map-suit-pass.part-');
const OUT = flag('out', '.artifacts/entry-map-suit-pass.json');

const dir = dirname(PREFIX);
const stem = basename(PREFIX);
const names = (await readdir(dir)).filter((n) => n.startsWith(stem) && n.endsWith('.json')).sort();
if (names.length === 0) {
  console.error(`no chunks found matching ${PREFIX}*.json`);
  process.exit(2);
}

const chunks = (await Promise.all(names.map(async (n) => JSON.parse(await readFile(join(dir, n), 'utf8')))))
  .sort((a, b) => a.slice.from - b.slice.from);

const head = chunks[0];
const ofStraddling = head.slice.ofStraddling;

let cursor = 0;
for (const c of chunks) {
  if (c.basedOn.mapEngineCommit !== head.basedOn.mapEngineCommit || c.reporting.tauBB !== head.reporting.tauBB) {
    throw new Error('chunks were computed against different maps or different τ; they are not one pass');
  }
  if (c.slice.ofStraddling !== ofStraddling) {
    throw new Error(`chunks disagree on how many cells straddle zero (${c.slice.ofStraddling} vs ${ofStraddling})`);
  }
  if (c.slice.from !== cursor) {
    throw new Error(
      `cells [${cursor}, ${c.slice.from}) of the straddling list are ${c.slice.from > cursor ? 'missing from' : 'duplicated in'} the merge`,
    );
  }
  cursor = c.slice.to;
}
if (cursor !== ofStraddling) {
  throw new Error(`the merge covers ${cursor} of ${ofStraddling} straddling cells; a pass that stopped early must not present as complete`);
}

const cells = chunks.flatMap((c) => c.cells);
const merged = {
  ...head,
  generatedBy: 'scripts/backtest/run-merge-suit-pass.mjs',
  engineDirty: chunks.some((c) => c.engineDirty),
  slice: undefined,
  mergedFrom: chunks.map((c) => ({ from: c.slice.from, to: c.slice.to })),
  headline: suitPassHeadline(cells, head.reporting.tauBB),
  cells,
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(merged, null, 2));

const h = merged.headline;
console.log(`merged ${chunks.length} chunks → ${cells.length} cells, ${h.combosEvaluated} combos`);
console.log(`classes that should NOT be one cell: ${h.classesThatShouldNotBeOneCell}`);
console.log(`point-estimate sign split only:      ${h.pointSignSplitOnly}  (noise, not a finding)`);
console.log(`within-class spread > τ:             ${h.spreadExceedsTau}`);

const split = cells.filter((c) => c.summary.signSplit);
for (const c of split) {
  console.log(`  ${c.cellId.padEnd(24)} spread ${c.summary.spread.toFixed(3)}bb ` +
    `[${c.summary.minMargin.toFixed(3)}, ${c.summary.maxMargin.toFixed(3)}]`);
}
console.log(`\nwrote ${OUT}`);
