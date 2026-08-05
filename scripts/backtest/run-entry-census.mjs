/**
 * run-entry-census.mjs — WS-323. Emit the Entry Map's Coverage Census.
 *
 * Usage: node scripts/backtest/run-entry-census.mjs [--files N] [--out PATH]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { openLoader } from './loader.mjs';
import { buildEntryCensus } from './entryCensus.mjs';
import { censusCoverage } from '../../src/utils/standardOfRecord/coverageCensus.js';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const MAX_FILES = flag('files', null) ? Number(flag('files', null)) : null;
const OUT = flag('out', '.artifacts/entry-census.json');

const loader = await openLoader();
const table = await loader.load('/src/utils/pokerCore/preflopEquityTable.js');
const census = await buildEntryCensus([...table.HAND_LABELS], { maxFiles: MAX_FILES });
await loader.close();

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(census, null, 2));

const a = census.corpusAttribution;
console.log(`files scanned: ${a.filesScanned}/${a.filesAvailable}`);
console.log(`preflop first decisions: ${a.decisions.toLocaleString()}`);
console.log(`  folds:   ${a.folds.toLocaleString()}  attributable to a cell: ${a.foldsAttributable.toLocaleString()} (${a.foldsAttributablePct}%)`);
console.log(`  entries: ${a.entries.toLocaleString()}  attributable to a cell: ${a.entriesAttributable.toLocaleString()} (${a.entriesAttributablePct}%)`);
console.log(`contexts: ${census.totalContexts} total · ${census.reachableContexts} reachable · ${census.unreachableContexts} structurally unreachable`);

// NOT a single coverage percentage. "hit contexts: 0" on its own read as "we looked at every
// reachable cell and none occurred", which this run never did — see the census's examination
// declaration. Each figure below carries the conditional it is conditional ON.
const cov = censusCoverage(census);
console.log(`examination: ${cov.examinationMode} · ${census.examination.examinedContexts} contexts examined`);
console.log(`  ${cov.neverLookedGivenReachable.k}/${cov.neverLookedGivenReachable.n} — ${cov.neverLookedGivenReachable.conditional}`);
console.log(`  ${cov.observedZeroGivenExamined.k}/${cov.observedZeroGivenExamined.n} — ${cov.observedZeroGivenExamined.conditional}`);
console.log(`  ${cov.hitGivenExamined.k}/${cov.hitGivenExamined.n} — ${cov.hitGivenExamined.conditional}`);
console.log(`  reason everything is unexamined: ${census.examination.unexaminedReason}`);
console.log(`\nwrote ${OUT}`);
