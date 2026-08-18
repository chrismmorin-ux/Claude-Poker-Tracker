/**
 * villainRuleset — state ONE villain's rules in the first person, then test the range claim.
 *
 * THE TWO INSTRUMENTS, and why both are needed.
 *
 * 1. FREQUENCY fixes the SIZE of a range. "I enter 20% first-in" is measured on every
 *    first-in decision, so it has real n. A rule proposing an 8% opening range is refuted
 *    by that number alone, with no card ever shown.
 *
 * 2. REVEALED HANDS fix the SHAPE. Frequency cannot distinguish the top 20% of hands from
 *    any other 20%. Each showdown is a hard constraint: a hand shown in an entry spot that
 *    sits outside the top-20% chart falsifies "I open the top 20%" outright, however well
 *    the frequency matched.
 *
 * The second instrument is the one that says whether a villain is playing a CHART or a
 * HABIT, and they are different players to exploit. It is also heavily biased and the bias
 * runs one way: a seat reaches showdown by continuing, so revealed hands over-represent
 * hands that connected. That inflates how good the entry range looks. Every count below is
 * therefore reported as "of hands shown", never "of hands played".
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { discoverCorpusFiles, selectCorpusFiles, resolveCorpusRoot } from '../backtest/corpusFiles.mjs';
import { iterAppHands } from '../backtest/phhAdapter.mjs';
import { labelDecisions, renderDecision } from './decisionLabeler.mjs';
import { CONTEXTS, fitContexts, fitPriceThreshold, pct } from './ruleFitter.mjs';
import { PREFLOP_CHARTS, rangeWidth, rangeIndex } from '../../src/utils/pokerCore/rangeMatrix.js';

const MAX_FILES = Number(process.env.MAX_FILES || 120);
const TARGET = process.env.VILLAIN || null;

const RANKS = '23456789TJQKA';
const rankOf = (c) => RANKS.indexOf(String(c)[0].toUpperCase()) + 2;
const suitOf = (c) => String(c).slice(1);

/** The chart whose WIDTH is closest to an observed entry frequency. */
const chartOfWidth = (targetPct) => {
  let best = null;
  for (const [name, grid] of Object.entries(PREFLOP_CHARTS)) {
    const w = rangeWidth(grid);
    const d = Math.abs(w - targetPct);
    if (!best || d < best.d) best = { name, grid, width: w, d };
  }
  return best;
};

/**
 * Is this two-card hand inside a chart grid?
 *
 * `rangeIndex` takes ranks as 0-12 GRID indices, not 2-14 card values. Passing card values
 * shifts every index by two, which reads KK as outside a 13% opening range — an impossible
 * answer, and the reason this has its own conversion rather than reusing `rankOf`.
 */
const gridRank = (card) => RANKS.indexOf(String(card)[0].toUpperCase());
const inChart = (grid, hole) => {
  if (!hole || hole.length < 2) return null;
  const r1 = gridRank(hole[0]);
  const r2 = gridRank(hole[1]);
  if (r1 < 0 || r2 < 0) return null;
  const suited = suitOf(hole[0]) === suitOf(hole[1]);
  return (grid[rangeIndex(r1, r2, suited)] ?? 0) > 0;
};

const handLabel = (hole) => {
  const r1 = rankOf(hole[0]);
  const r2 = rankOf(hole[1]);
  const hi = RANKS[Math.max(r1, r2) - 2];
  const lo = RANKS[Math.min(r1, r2) - 2];
  if (r1 === r2) return hi + lo;
  return hi + lo + (suitOf(hole[0]) === suitOf(hole[1]) ? 's' : 'o');
};

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

const obs = fitContexts(decisions);
const price = fitPriceThreshold(decisions);
const pricePF = fitPriceThreshold(decisions, { street: 'preflop' });

console.log('='.repeat(96));
console.log(`VILLAIN ${pid}`);
console.log(`${counts.get(pid)} hands · ${decisions.length} decisions · ${decisions.filter(d => d.handKnown).length} with cards shown`);
console.log('='.repeat(96));

console.log('\nTHE RULES I APPEAR TO BE FOLLOWING\n');
for (const c of CONTEXTS) {
  const o = obs[c.id];
  if (!o || o.n < 12) continue;
  console.log(`  ${c.firstPerson(o.k / o.n)}`);
  console.log(`      ${' '.repeat(0)}(${o.k} of ${o.n} times)`);
}

console.log('\nWHERE I STOP CALLING — the threshold a single fold-rate cannot express\n');
for (const b of price.bands) {
  if (b.n < 8) continue;
  console.log(`  Facing ${b.label.padEnd(30)} I continue ${pct(b.k / b.n).padStart(4)}  (${b.k}/${b.n})`);
}
console.log(`  -> crossing band: ${price.crossingBand || 'never drops below half in a measured band'}`);

// ── the range claim ─────────────────────────────────────────────────────────
const entry = obs['enter-first-in'];
const entryPct = entry.n ? (entry.k / entry.n) * 100 : null;
console.log('\nMY ENTRY RANGE — size from frequency, shape from what I showed\n');
if (entryPct != null) {
  const chart = chartOfWidth(entryPct);
  console.log(`  SIZE:  I enter ${entryPct.toFixed(1)}% first-in (${entry.k}/${entry.n}).`);
  console.log(`         That is the width of a standard ${chart.name} opening range (${chart.width.toFixed(1)}%).`);
  console.log(`         Any proposed range materially wider or narrower than this is refuted by frequency alone.`);

  // Shape: revealed hands in a first-in entry spot.
  const entryShown = decisions.filter(d => d.street === 'preflop' && d.firstIn
    && d.facing === 'no bet' && (d.action === 'raise' || d.action === 'call') && d.handKnown);
  const limpShown = decisions.filter(d => d.street === 'preflop' && d.limpersAhead > 0
    && d.facing === 'no bet' && d.action === 'call' && d.handKnown);
  const pool = [...entryShown, ...limpShown];
  if (pool.length) {
    const outside = pool.filter(d => inChart(chart.grid, d.holeCards) === false);
    console.log(`\n  SHAPE: ${pool.length} entry hands were shown. ${outside.length} sit OUTSIDE that chart:`);
    const tally = new Map();
    for (const d of outside) tally.set(handLabel(d.holeCards), (tally.get(handLabel(d.holeCards)) || 0) + 1);
    console.log('         ' + ([...tally.entries()].sort((a, b) => b[1] - a[1])
      .map(([h, n]) => n > 1 ? `${h}x${n}` : h).join(' ') || '(none)'));
    if (outside.length) {
      console.log(`\n         VERDICT: "I open the top ${entryPct.toFixed(0)}%" is REFUTED as a top-down chart.`);
      console.log(`         The frequency matches ${chart.name} but the composition does not — this player is`);
      console.log(`         following a HABIT of a certain width, not a chart. Caveat: showdown hands`);
      console.log(`         over-represent hands that connected, so this is a floor on how wide the`);
      console.log(`         off-chart tail is, never a ceiling.`);
    } else {
      console.log(`\n         VERDICT: consistent with a top-down ${chart.name} chart on the hands shown.`);
    }
  }
}

const revealed = decisions.filter(d => d.handKnown);
const byHand = new Map();
for (const d of revealed) if (!byHand.has(d.handId)) byHand.set(d.handId, d);
console.log(`\nEVERY HAND I SHOWED (${byHand.size}) — the hard constraints\n`);
const labels = [...byHand.values()].map(d => handLabel(d.holeCards));
const freq = new Map();
for (const l of labels) freq.set(l, (freq.get(l) || 0) + 1);
console.log('  ' + [...freq.entries()].sort((a, b) => b[1] - a[1])
  .map(([h, n]) => n > 1 ? `${h}x${n}` : h).join(' '));

mkdirSync('.tmp-arch', { recursive: true });
writeFileSync('.tmp-arch/villain-ruleset.json', JSON.stringify({ pid, hands: counts.get(pid), obs, price, pricePF }, null, 1));
console.log('\nwrote .tmp-arch/villain-ruleset.json');
