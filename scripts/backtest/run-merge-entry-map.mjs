/**
 * run-merge-entry-map.mjs — WS-323. Reassemble a chunked entry map.
 *
 * Usage:
 *   node scripts/backtest/run-merge-entry-map.mjs --parts "<glob-ish prefix>" --out PATH
 *
 *   --parts PREFIX   Merge every file matching `<PREFIX>*.json` (default .artifacts/entry-map.part-)
 *   --out PATH       Merged output (default .artifacts/entry-map.json)
 *
 * Refuses a merge with a gap, an overlap, or chunks whose stamps disagree — see
 * `mergeEntryMap.mjs` for why each of those is a refusal rather than a warning.
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, basename, join } from 'node:path';

import { mergeEntryMaps } from './mergeEntryMap.mjs';
import { loadEntryMap } from './entryMap.mjs';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };

const PREFIX = flag('parts', '.artifacts/entry-map.part-');
const OUT = flag('out', '.artifacts/entry-map.json');

const dir = dirname(PREFIX);
const stem = basename(PREFIX);
const names = (await readdir(dir)).filter((n) => n.startsWith(stem) && n.endsWith('.json')).sort();

if (names.length === 0) {
  console.error(`no chunks found matching ${PREFIX}*.json`);
  process.exit(2);
}

const chunks = await Promise.all(names.map(async (n) => JSON.parse(await readFile(join(dir, n), 'utf8'))));
const merged = mergeEntryMaps(chunks);

// Prove the merged file loads before writing it. A merger that emitted something the loader
// refuses would put the failure a long way from its cause.
const loaded = loadEntryMap(merged);

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(merged, null, 2));

console.log(`merged ${names.length} chunks → ${merged.cells.length} cells`);
for (const { from, to } of merged.mergedFrom) console.log(`  [${from}, ${to})`);
console.log('bands:', loaded.counts.byBand);
for (const w of loaded.warnings) console.log(`! ${w}`);
console.log(`\nwrote ${OUT}`);
