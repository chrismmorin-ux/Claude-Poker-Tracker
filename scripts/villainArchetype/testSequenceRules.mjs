/**
 * testSequenceRules — take two rules straight out of the catalogue and answer them.
 *
 * Both are claims about a LINE rather than a node, which is precisely what a per-node
 * aggregation cannot see: `rangeEngine/CLAUDE.md` §4 aggregates each labelled node
 * independently, which is correct for estimating a range and structurally unable to express
 * "this player pays once but not twice".
 *
 *   dr-one-street-only    "I will pay once to see the next card, but I will not pay twice."
 *   tn-give-up-when-called "I bet the flop, and if you call I am usually done."
 *
 * Neither needs a single hole card. The falsifier for each was written before the run:
 *   - one-street-only dies if the turn continue rate AFTER a flop call equals the flop rate.
 *   - give-up-when-called dies if the turn barrel rate equals the flop c-bet rate.
 */
import { discoverCorpusFiles, selectCorpusFiles, resolveCorpusRoot } from '../backtest/corpusFiles.mjs';
import { iterAppHands } from '../backtest/phhAdapter.mjs';
import { labelDecisions } from './decisionLabeler.mjs';

const MAX_FILES = Number(process.env.MAX_FILES || 120);
const MIN_HANDS = Number(process.env.MIN_HANDS || 150);

const root = resolveCorpusRoot();
const { files, selection } = selectCorpusFiles(await discoverCorpusFiles({ root }), { maxFiles: MAX_FILES });
console.log('corpus:', JSON.stringify(selection.realised.perDirectory));

const acc = new Map();
const bump = (pid, key, fired) => {
  if (!acc.has(pid)) acc.set(pid, { hands: 0, c: {} });
  const a = acc.get(pid).c;
  a[key] = a[key] || { k: 0, n: 0 };
  a[key].n++; if (fired) a[key].k++;
};

let hands = 0;
for (const f of files) {
  for await (const h of iterAppHands(f.path)) {
    hands++;
    for (const [seat, pid] of Object.entries(h.seatPlayers || {})) {
      const ds = labelDecisions(h, seat);
      if (!ds.length) continue;
      if (!acc.has(pid)) acc.set(pid, { hands: 0, c: {} });
      acc.get(pid).hands++;

      const byStreet = {};
      for (const d of ds) (byStreet[d.street] = byStreet[d.street] || []).push(d);

      // --- baseline: continue facing a bet, per street, unconditioned ---
      for (const st of ['flop', 'turn', 'river']) {
        for (const d of (byStreet[st] || [])) {
          if (d.facing === 'a bet') bump(pid, `continue-${st}`, d.action !== 'fold');
        }
      }

      // --- dr-one-street-only: did a call on street S survive into street S+1? ---
      const pairs = [['flop', 'turn'], ['turn', 'river']];
      for (const [a, b] of pairs) {
        const calledA = (byStreet[a] || []).some(d => d.facing === 'a bet' && d.action === 'call');
        if (!calledA) continue;
        const facedB = (byStreet[b] || []).filter(d => d.facing === 'a bet');
        for (const d of facedB) bump(pid, `continue-${b}-after-${a}-call`, d.action !== 'fold');
      }

      // --- tn-give-up-when-called: c-bet flop, got called, then what? ---
      const cbet = (byStreet.flop || []).find(d => d.iAmLastPreflopAggressor && d.facing === 'no bet' && d.action === 'bet');
      if (cbet) {
        bump(pid, 'cbet-flop', true);
        const turnAsAgg = (byStreet.turn || []).find(d => d.facing === 'no bet');
        if (turnAsAgg) bump(pid, 'barrel-turn-after-cbet', turnAsAgg.action === 'bet');
      }
      const flopCheckAsAgg = (byStreet.flop || []).find(d => d.iAmLastPreflopAggressor && d.facing === 'no bet');
      if (flopCheckAsAgg) bump(pid, 'cbet-opportunity', flopCheckAsAgg.action === 'bet');
    }
  }
}

const villains = [...acc.entries()].filter(([, v]) => v.hands >= MIN_HANDS);
console.log(`${hands} hands | ${villains.length} villains with >= ${MIN_HANDS} hands\n`);

const pool = (key) => {
  let k = 0, n = 0;
  for (const [, v] of villains) { const c = v.c[key]; if (c) { k += c.k; n += c.n; } }
  return { k, n, p: n ? k / n : null };
};
const show = (label, key) => {
  const r = pool(key);
  console.log(`  ${label.padEnd(52)} ${r.n ? (r.p * 100).toFixed(1) + '%' : '  n/a'}  (${r.k}/${r.n})`);
  return r;
};

console.log('='.repeat(96));
console.log('RULE dr-one-street-only — "I will pay once to see the next card, but I will not pay twice."');
console.log('='.repeat(96));
const cf = show('continue facing a FLOP bet (any)', 'continue-flop');
const ct = show('continue facing a TURN bet (any)', 'continue-turn');
const cta = show('continue facing a TURN bet, HAVING CALLED THE FLOP', 'continue-turn-after-flop-call');
const cr = show('continue facing a RIVER bet (any)', 'continue-river');
const cra = show('continue facing a RIVER bet, HAVING CALLED THE TURN', 'continue-river-after-turn-call');

console.log('\n  VERDICT:');
if (cta.n > 30 && ct.n > 30) {
  const delta = (cta.p - ct.p) * 100;
  console.log(`    Turn continue after a flop call is ${cta.p > ct.p ? 'HIGHER' : 'LOWER'} than the`);
  console.log(`    unconditioned turn rate by ${Math.abs(delta).toFixed(1)}pp (${(cta.p * 100).toFixed(1)}% vs ${(ct.p * 100).toFixed(1)}%).`);
  console.log(`    "Pays once but not twice" predicts LOWER. ${delta < -2 ? 'SUPPORTED.' : delta > 2 ? 'REFUTED — they pay MORE once committed.' : 'NEITHER — the rate barely moves.'}`);
}

console.log('\n' + '='.repeat(96));
console.log('RULE tn-give-up-when-called — "I bet the flop, and if you call I am usually done."');
console.log('='.repeat(96));
const cb = show('c-bet the flop as preflop aggressor', 'cbet-opportunity');
const bt = show('bet the turn, having c-bet the flop and been called', 'barrel-turn-after-cbet');
console.log('\n  VERDICT:');
if (cb.n > 30 && bt.n > 30) {
  const delta = (bt.p - cb.p) * 100;
  console.log(`    Turn barrel after a called c-bet is ${(bt.p * 100).toFixed(1)}% against a flop c-bet rate of ${(cb.p * 100).toFixed(1)}%.`);
  console.log(`    "Usually done" predicts a large drop. ${delta < -15 ? 'SUPPORTED.' : delta < -5 ? 'PARTIALLY — it drops but not dramatically.' : 'REFUTED.'}`);
}

// Per-villain spread — the same rule is not the same rule for everyone.
const spread = (key) => villains.map(([pid, v]) => v.c[key]).filter(c => c && c.n >= 10).map(c => c.k / c.n);
const s = spread('barrel-turn-after-cbet');
if (s.length >= 10) {
  s.sort((a, b) => a - b);
  console.log(`\n  PER-VILLAIN SPREAD on the turn barrel (${s.length} villains with >=10 such spots):`);
  console.log(`    10th pct ${(s[Math.floor(s.length * 0.1)] * 100).toFixed(0)}%  median ${(s[Math.floor(s.length / 2)] * 100).toFixed(0)}%  90th pct ${(s[Math.floor(s.length * 0.9)] * 100).toFixed(0)}%`);
  console.log('    A single population rate would describe none of these players.');
}
