/**
 * run-strategy-profile.mjs — WS-323 follow-on. Characterise the declared strategy.
 *
 * Usage:
 *   node scripts/backtest/run-strategy-profile.mjs [--map PATH] [--stake BB] [--seats 6max|full]
 *
 * Reports what the Entry Map ADDS UP TO: how often it plays, how that compares to the pool it
 * would sit against, what fraction of real decisions its declared domain even contains, and
 * where its weaknesses concentrate.
 *
 * NOT A MEASUREMENT OF PERFORMANCE — see the header of `strategyProfile.mjs`. Every number is
 * the model's own arithmetic integrated over frequency, and a self-report cannot detect the
 * error it was itself computed under.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { openLoader } from './loader.mjs';
import { loadEntryMap } from './entryMap.mjs';
import { profileStrategy } from './strategyProfile.mjs';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };

const MAP_PATH = flag('map', '.artifacts/entry-map.json');
const STAKE_BB = Number(flag('stake', 0.5));
const SEAT_BUCKET = flag('seats', '6max');
const OUT = flag('out', '.artifacts/entry-map-profile.json');

const pct = (x) => `${(100 * x).toFixed(1)}%`;
const bb = (x) => `${x >= 0 ? '+' : ''}${x.toFixed(3)}`;

const loader = await openLoader();
const [pool, equityTable] = await Promise.all([
  loader.load('/src/utils/exploitEngine/handhqReferencePool.js'),
  loader.load('/src/utils/pokerCore/preflopEquityTable.js'),
]);
await loader.close();

const stake = pool.HANDHQ_REFERENCE_STAKES.find((s) => s.bb === STAKE_BB);
const stats = stake.buckets[SEAT_BUCKET].stats;
const poolRates = { vpip: stats.vpip.k / stats.vpip.n, pfr: stats.pfr.k / stats.pfr.n };

const map = loadEntryMap(JSON.parse(await readFile(MAP_PATH, 'utf8')));
for (const w of map.warnings) console.log(`! map: ${w}`);

const profile = profileStrategy(map, poolRates, equityTable.EQUITY_VS_OPEN, [...equityTable.HAND_LABELS]);

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(profile, null, 2));

const h = profile.headline;
console.log(`\n=== THE STRATEGY, INTEGRATED (${profile.basedOn.policyId}) ===`);
console.log(`plays a hand:            ${pct(h.entryRate)}   pool: ${pct(h.poolVpip)}`);
console.log(`enters aggressively:     ${pct(h.aggressiveRate)}   pool: ${pct(h.poolPfr)}`);
console.log(`declared domain covers:  ${pct(h.domainCoverage)} of real first decisions`);
console.log('');
console.log(`edge over always-folding: ${bb(h.forecastEdgeBB100).padStart(8)} bb/100   (positive BY CONSTRUCTION)`);
console.log(`blinds posted:            ${bb(h.blindCostBB100).padStart(8)} bb/100   (no fold recovers this)`);
console.log(`walks won in the BB:      ${bb(h.walkBB100).padStart(8)} bb/100`);
console.log(`                          --------`);
console.log(`IMPLIED WIN RATE:         ${bb(h.absoluteForecastBB100).padStart(8)} bb/100  <-- SELF-REPORT, NOT A MEASUREMENT`);

console.log('\n=== BY POSITION ===');
console.log('pos     seats  before  foldedTo  limped*  vsRaise  domain  plays  aggro   edge bb/100');
for (const [p, v] of Object.entries(profile.byPosition)) {
  console.log(
    `${p.padEnd(7)} ${String(v.seats).padEnd(6)} ${String(v.playersBefore).padEnd(7)} ` +
    `${pct(v.spots.foldedToHero).padStart(8)} ${pct(v.spots.limpedNoRaise).padStart(8)} ` +
    `${pct(v.spots.facingRaise).padStart(8)} ${pct(v.domainCoverage).padStart(7)} ` +
    `${pct(v.entryRate).padStart(6)} ${pct(v.aggressiveRate).padStart(6)} ` +
    `${bb(v.forecastEdgeBB * 100).padStart(9)}`,
  );
}
console.log('* limped = players entered without raising. THE MAP DOES NOT MODEL THIS SPOT AT ALL.');

console.log('\n=== MEAN ENTRY MARGIN BY HAND FAMILY (bb) ===');
for (const [f, v] of Object.entries(profile.familyMargins)) {
  console.log(`  ${f.padEnd(22)} n=${String(v.n).padStart(4)}  ${bb(v.meanBB)}`);
}

console.log('\n=== PAIRS vs UNPAIRED, WITHIN EACH SPOT (bb) ===');
for (const g of profile.pairGap) {
  console.log(`  ${g.spot.padEnd(16)} pairs ${bb(g.pairedMean).padStart(8)}  unpaired ${bb(g.unpairedMean).padStart(8)}  gap ${bb(g.gapBB).padStart(8)}`);
}

console.log('\n=== DOES IT RANK HANDS THE WAY EQUITY DOES? (Spearman) ===');
for (const r of profile.rankAgreement) {
  console.log(`  ${(r.posCategory + '/' + r.facingAction).padEnd(16)} n=${String(r.n).padStart(4)}  rho=${r.spearman === null ? 'n/a' : r.spearman.toFixed(3)}`);
  console.log(`      worst-treated vs equity: ${r.worstInversions.map((i) => `${i.handClass}(${(100 * i.equity).toFixed(0)}%→${bb(i.margin)})`).join(', ')}`);
}

console.log('\n=== IS AN UNKNOWN A COMPUTE PROBLEM OR AN EVIDENCE PROBLEM? ===');
console.log(`  sampling-noise dominant: ${profile.uncertainty.mcDominant}   field-uncertainty dominant: ${profile.uncertainty.modelDominant}`);
for (const [band, v] of Object.entries(profile.uncertainty.byBand)) {
  console.log(`  ${band.padEnd(14)} mc ${String(v.mcDominant).padStart(5)}   model ${String(v.modelDominant).padStart(5)}`);
}

console.log(`\nwrote ${OUT}`);
console.log(`\n${profile.caveat}`);
