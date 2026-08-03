/**
 * run-fringe-migration.mjs — WS-323. Join two entry maps and report what moved.
 *
 * Usage:
 *   node scripts/backtest/run-fringe-migration.mjs --before <map.json> --after <map.json>
 *
 *   --tau BB     Common τ both maps are re-banded at    (default 0.25)
 *   --show N     How many movers to print               (default 25; the artifact keeps all)
 *   --out PATH   Output file (default .artifacts/fringe-migration.json)
 *
 * See `fringeMigration.mjs` for the three ways a migration report lies and what is done about
 * each. The short version: the join is on cell identity and refuses a mismatch, both maps are
 * re-banded at ONE τ, and every delta carries its own interval so noise is not read as
 * progress.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { COMPARISON_KINDS, compareEntryMaps, moversOf } from './fringeMigration.mjs';
import { DEFAULT_TAU_BB } from './entryMap.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};

const BEFORE = flag('before', null);
const AFTER = flag('after', null);
const TAU_BB = Number(flag('tau', DEFAULT_TAU_BB));
const SHOW = Number(flag('show', 25));
const OUT = flag('out', '.artifacts/fringe-migration.json');

if (!BEFORE || !AFTER) {
  console.error('usage: run-fringe-migration.mjs --before <map.json> --after <map.json>');
  process.exit(2);
}

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const [before, after] = await Promise.all([readJson(BEFORE), readJson(AFTER)]);
const report = compareEntryMaps(before, after, { tauBB: TAU_BB });

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(report, null, 2));

const { comparison: cmp, headline: h } = report;
console.log(`comparison: ${cmp.kind.toUpperCase()} · τ=${cmp.tauBB}bb`);
console.log(`  earlier: ${cmp.before.policyId} @ ${cmp.before.engineCommit.slice(0, 8)}${cmp.before.engineDirty ? ' (dirty)' : ''}`);
console.log(`  later:   ${cmp.after.policyId} @ ${cmp.after.engineCommit.slice(0, 8)}${cmp.after.engineDirty ? ' (dirty)' : ''}`);

if (cmp.kind === COMPARISON_KINDS.REPLICATE) {
  console.log('\nREPLICATE: same policy, same commit. Measurable migration here would be an');
  console.log('instrument bug, not a result — the expected reading is essentially none.');
}

console.log('\nbands:');
for (const band of Object.keys({ ...report.bandCounts.before, ...report.bandCounts.after })) {
  const b = report.bandCounts.before[band] ?? 0;
  const a = report.bandCounts.after[band] ?? 0;
  const d = a - b;
  console.log(`  ${band.padEnd(14)} ${String(b).padStart(5)} → ${String(a).padStart(5)}  ${d > 0 ? '+' : ''}${d}`);
}

console.log('\nheadline:');
console.log(`  cells compared:        ${h.cellsCompared}`);
console.log(`  changed band:          ${h.movedBand}`);
console.log(`  into clear+:           ${h.intoClearPlus}`);
console.log(`  out of clear-:         ${h.outOfClearMinus}`);
console.log(`  became measurable:     ${h.becameMeasurable}`);
console.log(`  became unmeasured:     ${h.becameUnmeasured}`);
console.log(`  deltas beyond their own interval:   ${h.measurableDeltas}`);
console.log(`  deltas inside their own interval:   ${h.unmeasurableDeltas}  (movement not established)`);

const movers = moversOf(report);
if (movers.length) {
  // The count is printed BEFORE the truncation so a short list cannot read as the whole story.
  console.log(`\nmovers: ${movers.length} total, showing ${Math.min(SHOW, movers.length)}:`);
  for (const m of movers.slice(0, SHOW)) {
    const delta = m.delta === null ? '   —   ' : `${m.delta >= 0 ? '+' : ''}${m.delta.toFixed(3)}`;
    const mark = m.measurable === true ? '' : ' (within interval)';
    console.log(`  ${m.cellId.padEnd(24)} ${m.fromBand.padEnd(13)} → ${m.toBand.padEnd(13)} Δ${delta}bb${mark}`);
  }
}

for (const w of report.warnings) console.log(`\n! ${w}`);

console.log(`\nwrote ${OUT}`);
