/**
 * handNarrative — what happened NEXT.
 *
 * An exception read at its own node is unreadable: "I limped, cards never shown" is a dead
 * end. The same exception read as a LINE is not. A seat that limps and then folds the flop
 * to one bet was not trapping. A seat that limps and then check-raises the flop was. The
 * hand's later actions narrow the range that took the earlier action, which is the ordinary
 * way a player reads an opponent at the table and the reason a per-node aggregation loses
 * information a human would keep.
 *
 * This prints, for any set of decisions, the whole hand around each one: every seat's
 * actions in order, the board as it ran out, who showed what. It is deliberately raw. The
 * point is to look at the hands before deciding what the rule is, rather than the reverse.
 */
import { discoverCorpusFiles, selectCorpusFiles, resolveCorpusRoot } from '../backtest/corpusFiles.mjs';
import { iterAppHands } from '../backtest/phhAdapter.mjs';
import { labelDecisions } from './decisionLabeler.mjs';

const MAX_FILES = Number(process.env.MAX_FILES || 120);
const TARGET = process.env.VILLAIN || null;
/** Which exception to chase. Default: first-in limps — the founder's question. */
const MODE = process.env.MODE || 'limp';

const root = resolveCorpusRoot();
const { files } = selectCorpusFiles(await discoverCorpusFiles({ root }), { maxFiles: MAX_FILES });

const counts = new Map();
for (const f of files) {
  for await (const h of iterAppHands(f.path)) {
    for (const pid of Object.values(h.seatPlayers || {})) counts.set(pid, (counts.get(pid) || 0) + 1);
  }
}
const pid = TARGET || [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

const isTarget = (d) => {
  if (MODE === 'limp') return d.street === 'preflop' && d.firstIn && d.facing === 'no bet' && d.action === 'call';
  if (MODE === 'limpbehind') return d.street === 'preflop' && d.limpersAhead > 0 && d.facing === 'no bet' && d.action === 'call';
  if (MODE === 'coldcall') return d.street === 'preflop' && d.facing === 'a raise' && d.action === 'call';
  return false;
};

const hits = [];
for (const f of files) {
  for await (const h of iterAppHands(f.path)) {
    const seat = Object.entries(h.seatPlayers || {}).find(([, p]) => p === pid)?.[0];
    if (!seat) continue;
    const ds = labelDecisions(h, seat);
    if (ds.some(isTarget)) hits.push({ hand: h, seat, ds });
  }
}

console.log(`villain ${pid} — ${counts.get(pid)} hands`);
console.log(`mode "${MODE}": ${hits.length} hands\n`);

const streetOrder = ['preflop', 'flop', 'turn', 'river'];

for (const { hand, seat, ds } of hits) {
  const g = hand.gameState;
  const bb = hand._backtest?.bb || 1;
  console.log('='.repeat(96));
  console.log(`hand ${hand.handId} — villain in seat ${seat}, board ${(g.communityCards || []).join(' ') || '(none dealt)'}`);
  const sd = g.showdownCards || {};
  console.log(`showdown: ${Object.keys(sd).length
    ? Object.entries(sd).map(([s, c]) => `seat ${s}${s === seat ? ' (VILLAIN)' : ''} ${c.join('')}`).join(' | ')
    : 'NOBODY SHOWED — the hand ended before showdown'}`);

  let cur = null;
  for (const e of [...g.actionSequence].sort((a, b) => a.order - b.order)) {
    if (e.street !== cur) {
      cur = e.street;
      const n = { preflop: 0, flop: 3, turn: 4, river: 5 }[cur];
      console.log(`  --- ${cur.toUpperCase()} ${(g.communityCards || []).slice(0, n).join(' ')}`);
    }
    const me = String(e.seat) === String(seat);
    const amt = Number.isFinite(e.amount) ? ` ${(e.amount / bb).toFixed(2)}bb` : '';
    console.log(`     ${me ? '>>> VILLAIN' : `    seat ${e.seat}`.padEnd(11)} ${e.action}${amt}`);
  }

  // What the villain themselves did, street by street — the line, in one row.
  const line = streetOrder.map(s => {
    const acts = ds.filter(d => d.street === s).map(d => d.action);
    return acts.length ? `${s[0].toUpperCase()}:${acts.join('-')}` : null;
  }).filter(Boolean).join('  ');
  console.log(`  LINE: ${line}`);
  console.log(`  REACHED: ${ds[ds.length - 1].street}${sd[seat] ? ' + SHOWED ' + sd[seat].join('') : ''}`);
  console.log('');
}

// The summary the founder actually asked for.
const reached = new Map();
let showed = 0;
for (const { seat, ds, hand } of hits) {
  const last = ds[ds.length - 1];
  const key = `${last.street} / ${last.action}`;
  reached.set(key, (reached.get(key) || 0) + 1);
  if (hand.gameState.showdownCards?.[seat]) showed++;
}
console.log('='.repeat(96));
console.log('WHERE THESE HANDS ENDED FOR THE VILLAIN:');
for (const [k, v] of [...reached.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${String(v).padStart(3)}  ${k}`);
console.log(`   ${showed} of ${hits.length} reached showdown with cards shown.`);
