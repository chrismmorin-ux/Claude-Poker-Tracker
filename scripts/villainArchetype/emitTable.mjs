/**
 * emitTable — every decision as one identical row, for agents and for the inducer alike.
 *
 * This is the single dataset. The rule inducer reads it; the explainer agents read it; a
 * human reads it. Nothing downstream gets a different view, which is the point — the last
 * bug was position being present in one representation and absent from another.
 *
 * `--action=call` lines up every decision of one kind next to each other, which is the
 * founder's "line up every single calling decision next to each other with its description".
 * Sorted so like sits beside like: identical situations become adjacent rows, and the column
 * that differs is the rule.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { discoverCorpusFiles, selectCorpusFiles, resolveCorpusRoot } from '../backtest/corpusFiles.mjs';
import { iterAppHands } from '../backtest/phhAdapter.mjs';
import { labelDecisions } from './decisionLabeler.mjs';
import { toRow, renderTable, header, legend, SCHEMA_VERSION, FIELDS } from './decisionSchema.mjs';

const MAX_FILES = Number(process.env.MAX_FILES || 120);
const TARGET = process.env.VILLAIN || null;
const ONLY = process.env.ACTION || null;      // e.g. call
const STREET = process.env.STREET || null;
const SHOW = Number(process.env.SHOW || 40);

const root = resolveCorpusRoot();
const { files } = selectCorpusFiles(await discoverCorpusFiles({ root }), { maxFiles: MAX_FILES });

const counts = new Map();
for (const f of files) {
  for await (const h of iterAppHands(f.path)) {
    for (const pid of Object.values(h.seatPlayers || {})) counts.set(pid, (counts.get(pid) || 0) + 1);
  }
}
const pid = TARGET || [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

const decisions = [];
for (const f of files) {
  for await (const h of iterAppHands(f.path)) {
    const seat = Object.entries(h.seatPlayers || {}).find(([, p]) => p === pid)?.[0];
    if (seat) decisions.push(...labelDecisions(h, seat));
  }
}

let sel = decisions;
if (ONLY) sel = sel.filter(d => d.action === ONLY);
if (STREET) sel = sel.filter(d => d.street === STREET);

// Sort so identical situations are adjacent — that is what makes the differing column visible.
const rows = sel.map(toRow).sort((a, b) =>
  String(a.street).localeCompare(String(b.street))
  || String(a.facing).localeCompare(String(b.facing))
  || String(a.seat_pos).localeCompare(String(b.seat_pos))
  || (Number(a.price_pct) || 0) - (Number(b.price_pct) || 0));

console.log(`VILLAIN ${pid} — schema v${SCHEMA_VERSION}`);
console.log(`${counts.get(pid)} hands · ${decisions.length} decisions`
  + (ONLY ? ` · showing action="${ONLY}" (${sel.length})` : '')
  + (STREET ? ` · street=${STREET}` : '') + '\n');
console.log('COLUMNS');
console.log(legend());
console.log('\nA rule may use only the [situation] columns. [outcome] columns are the future '
  + 'and are shown for reading, never for conditioning.\n');
console.log(renderTable(rows, { max: SHOW }));
if (rows.length > SHOW) console.log(`\n… ${rows.length - SHOW} more rows`);

mkdirSync('.tmp-arch', { recursive: true });
const all = decisions.map(toRow);
writeFileSync('.tmp-arch/decisions.tsv',
  [header().join('\t'), ...all.map(r => header().map(c => r[c]).join('\t'))].join('\n'));
writeFileSync('.tmp-arch/decisions.json', JSON.stringify({ pid, schema: SCHEMA_VERSION, rows: all }));
console.log(`\nwrote .tmp-arch/decisions.tsv and .json (${all.length} rows, ${FIELDS.length} columns)`);
