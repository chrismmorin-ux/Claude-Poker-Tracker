/**
 * run-entry-card.mjs — WS-323. Emit the Entry Map as a WS-322 Strategy Card, and prove it loads.
 *
 * Usage:
 *   node scripts/backtest/run-entry-card.mjs [--map PATH] [--tau BB] [--out PATH]
 *
 * The card is VALIDATED HERE, through the real `loadStrategyCard`, before it is written. A
 * generator that emitted an invalid card and left validation to whoever read it next would put
 * the failure a long way from its cause — and the loader is the thing that enforces enclosure,
 * which is the property the card exists to have.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { DEFAULT_TAU_BB, loadEntryMap } from './entryMap.mjs';
import { buildEntryCardArtifact } from './entryCard.mjs';
import { loadStrategyCard, evaluateCard } from '../../src/utils/standardOfRecord/strategyCard.js';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };

const MAP_PATH = flag('map', '.artifacts/entry-map.json');
const TAU_BB = Number(flag('tau', DEFAULT_TAU_BB));
const OUT = flag('out', '.artifacts/entry-map.card.json');

const map = loadEntryMap(JSON.parse(await readFile(MAP_PATH, 'utf8')), { tauBB: TAU_BB });
for (const w of map.warnings) console.log(`! map: ${w}`);

const artifact = buildEntryCardArtifact(map);

// Load it for real. Throws on anything malformed — no residual, an illegal axis, a missing
// warrant, a duplicate rule id.
const loaded = await loadStrategyCard(artifact.card);

// Enclosure, demonstrated rather than asserted: every cell of the declared domain is put
// through the card and must come back with an action. A cell that abstained would mean the
// domain and the rules disagree about what this card covers.
let abstained = 0;
let residual = 0;
const byRuleGroup = {};
for (const cell of map.cells) {
  const out = evaluateCard(loaded, {
    street: 'preflop',
    gameType: map.domain?.gameType ?? 'cash',
    seats: 9,
    stackDepthBB: 100,
    handClass: cell.handClass,
    posCategory: cell.posCategory,
    facingAction: cell.facingAction,
  });
  if (out.abstained) abstained++;
  else if (out.residual) residual++;
  else {
    const group = out.ruleId.split('/')[0];
    byRuleGroup[group] = (byRuleGroup[group] || 0) + 1;
  }
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(artifact, null, 2));

console.log(`card:        ${loaded.cardId}`);
console.log(`contentHash: ${loaded.contentHash}`);
console.log(`rules:       ${loaded.rules.length}`);
for (const [group, n] of Object.entries(byRuleGroup)) console.log(`  ${group.padEnd(12)} ${n}`);
console.log(`residual:    ${residual}`);
console.log(`abstained:   ${abstained}`);
console.log(`warnings:    ${loaded.warnings.length}`);
for (const w of loaded.warnings) console.log(`  ! ${w}`);

if (abstained > 0) {
  console.error(
    `\n${abstained} cells of the declared domain ABSTAINED. The card's domain and its rules ` +
    'disagree about what it covers, which breaks the enclosure guarantee.',
  );
  process.exit(1);
}

console.log(`\nwrote ${OUT}`);
