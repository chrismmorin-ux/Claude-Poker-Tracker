/**
 * Measure the size-conditioned fold-to-open curve and persist it.
 *
 * Usage:
 *   node scripts/villainArchetype/runFoldToOpenCurve.mjs [--max-files N] [--out PATH]
 *        [--min-cell-n N] [--min-players N] [--subject PID] [--corpus-root PATH]
 *
 * `--max-files` exists to make a run cheap while developing. It is PROVENANCE, not a knob: the
 * cap and the realised per-directory composition are written into the artifact, and the loader
 * refuses a curve whose selection collapsed onto a subset of directories. A capped run is a
 * different measurement, and the file says so rather than the reader having to remember.
 */
import {
  discoverCorpusFiles, selectCorpusFiles, resolveCorpusRoot,
} from '../backtest/corpusFiles.mjs';
import { measureFoldToOpenCurve, writeFoldToOpenCurve } from './foldToOpenCurve.mjs';

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const num = (name, fallback) => {
  const v = arg(name);
  return v == null ? fallback : Number(v);
};

const root = resolveCorpusRoot(arg('corpus-root') ?? undefined);
const maxFiles = num('max-files', Infinity);
const outPath = arg('out', 'out/villainArchetype/fold-to-open-curve.json');
const minCellN = num('min-cell-n', 40);
const minPlayersPerCell = num('min-players', 40);
const subjectIds = process.argv.reduce((acc, a, i) => (a === '--subject' ? [...acc, process.argv[i + 1]] : acc), []);

const all = await discoverCorpusFiles({ root });
const { files, selection } = selectCorpusFiles(all, { maxFiles });

console.log(`corpus root      ${root}`);
console.log(`discovered       ${all.length} file(s) across ${Object.keys(selection.discovered.perDirectory).length} director(ies)`);
console.log(`realised         ${files.length} file(s)  capped=${selection.capped}  collapsed=${selection.collapsed}`);
for (const [dir, n] of Object.entries(selection.realised.perDirectory)) console.log(`                   ${dir}  ${n}`);
if (subjectIds.length) console.log(`subjects retained  ${subjectIds.join(', ')}`);
console.log(`thresholds       minCellN=${minCellN}  minPlayersPerCell=${minPlayersPerCell}\n`);

const t0 = process.hrtime.bigint();
const curve = await measureFoldToOpenCurve({
  files, selection, root, minCellN, minPlayersPerCell, subjectIds,
  onProgress: ({ files: i, total, hands }) => process.stdout.write(`\r  ${i}/${total} files, ${hands} hands`),
});
const secs = Number(process.hrtime.bigint() - t0) / 1e9;
process.stdout.write('\r'.padEnd(60) + '\r');

console.log(`read ${curve.corpus.hands} hands in ${secs.toFixed(1)}s — `
  + `${curve.corpus.countedDecisions} qualifying decisions, ${curve.corpus.distinctPlayers} players\n`);

console.log('rows examined and NOT counted, with the reason:');
for (const [reason, n] of Object.entries(curve.conditioning.excluded)) {
  if (n) console.log(`  ${reason.padEnd(24)} ${n}`);
}
if (Object.keys(curve.conditioning.labelErrors).length) {
  console.log('  errors:');
  for (const [msg, n] of Object.entries(curve.conditioning.labelErrors)) console.log(`    ${n}x  ${msg}`);
}

// The console table is the pooled rate per cell. It is what makes the gradient visible without
// opening the artifact — and the gradient is the whole finding.
for (const stake of curve.corpus.stakes) {
  console.log(`\nFOLD TO A SINGLE OPEN, BY THE SIZE OPENED TO — ${stake}`);
  const buckets = [...new Set(Object.values(curve.cells)
    .flatMap((s) => Object.values(s))
    .filter((c) => c.stake === stake && c.bucket)
    .map((c) => c.bucket))].sort((a, b) => (Number(a.replace('to', '')) || 0) - (Number(b.replace('to', '')) || 0));
  console.log('seat  ' + buckets.map((b) => b.padStart(16)).join(''));
  for (const seat of ['SB', 'BB', 'BTN', 'CO', 'HJ', 'UTG']) {
    const row = buckets.map((b) => {
      const c = curve.cells[seat]?.[`${b}|${stake}`];
      if (!c) return '-'.padStart(16);
      const mark = c.status === 'hit' ? '' : '*';
      return `${(100 * c.pooled.rate).toFixed(1)}%${mark} (${c.pooled.n})`.padStart(16);
    }).join('');
    if (row.trim().replace(/-/g, '')) console.log(`${seat.padEnd(5)} ${row}`);
  }
  console.log('  * cell has too few qualifying players to serve a rate — it REFUSES rather than');
  console.log('    falling back to the pooled number. The pooled value is shown for inspection only.');
}

const stamped = writeFoldToOpenCurve(curve, outPath);
console.log(`\nwrote ${outPath}`);
console.log(`  contentHash ${stamped.contentHash}`);
