/**
 * FIND-137 divergence probe — does the PRODUCTION path actually move?
 *
 * Guard against the shipped-but-inert failure mode: a rake-aware fold branch no production
 * caller reaches is worth nothing. Drives `evaluateGameTree` end to end with and without the
 * founder's live rake config and reports the BEST AGGRESSIVE candidate (the one priced off
 * the fold branch) alongside the check.
 *
 * PRE-REGISTERED, before looking:
 *   1. Aggressive candidates lose MORE EV than the check, because the check branch never
 *      touches the fold-branch pot.
 *   2. Therefore bet-minus-check narrows on every spot, and flips bet->check where marginal.
 * If the check loses as much as the bet, the fold branch is not reaching the bet path and
 * the change is inert — record that unhedged.
 */
import { evaluateGameTree } from '../../src/utils/exploitEngine/gameTreeEvaluator.js';
import { parseRangeString } from '../../src/utils/pokerCore/rangeMatrix.js';

// rank: 0=2 … 12=A.  suit: 0=♠ 1=♥ 2=♦ 3=♣  (encodeCard = rank*4 + suit)
const card = (rank, suit) => (rank << 2) | suit;

const LIVE_1_3 = { pct: 0.10, cap: 6, jackpotDrop: 2, dropThreshold: 0, noFlopNoDrop: true };

const SPOTS = [
  { name: 'AK6r   QJo air        pot 60', hero: [card(10, 0), card(9, 2)], board: [card(12, 0), card(11, 2), card(4, 1)], pot: 60 },
  { name: 'AK6r   K9o mid pair   pot 60', hero: [card(11, 1), card(7, 3)], board: [card(12, 0), card(11, 2), card(4, 1)], pot: 60 },
  { name: 'JT9ss  A3hh fd        pot 40', hero: [card(12, 1), card(1, 1)], board: [card(9, 1), card(8, 1), card(7, 2)], pot: 40 },
  { name: 'JT9ss  AA overpair    pot 40', hero: [card(12, 3), card(12, 2)], board: [card(9, 1), card(8, 1), card(7, 2)], pot: 40 },
  { name: 'K72r   87o air  SMALL pot 20', hero: [card(6, 3), card(5, 2)], board: [card(11, 2), card(5, 0), card(0, 3)], pot: 20 },
  { name: 'K72r   KQo top pair   pot 20', hero: [card(11, 3), card(10, 2)], board: [card(11, 2), card(5, 0), card(0, 3)], pot: 20 },
  { name: 'Q83r   T9s air  BIG   pot 90', hero: [card(8, 0), card(7, 0)], board: [card(10, 1), card(6, 2), card(1, 3)], pot: 90 },
  { name: 'Q83r   QJo top pair   pot 90', hero: [card(10, 3), card(9, 2)], board: [card(10, 1), card(6, 2), card(1, 3)], pot: 90 },
];

const villainRange = parseRangeString('22+,A2s+,K7s+,Q9s+,JTs,T9s,98s,ATo+,KJo+,QJo');

const AGGRESSIVE = new Set(['bet', 'raise', 'check-raise']);

const run = async (spot, rakeConfig) => {
  const res = await evaluateGameTree({
    villainRange,
    board: spot.board,
    heroCards: spot.hero,
    potSize: spot.pot,
    rakeConfig,
    trials: 1000,
    refinementBudgetMs: 0, // depth-1 only — deterministic, and the fold branch lives here
  });
  const recs = res?.recommendations ?? [];
  const agg = recs.filter(r => AGGRESSIVE.has(r.action)).sort((a, b) => b.ev - a.ev)[0] ?? null;
  const chk = recs.find(r => r.action === 'check') ?? null;
  return { top: recs[0] ?? null, agg, chk };
};

const f = (n, w = 8) => (n == null ? '—'.padStart(w) : n.toFixed(2).padStart(w));

console.log('spot                             |  bet off   bet on   dBet |  chk off   chk on   dChk |  edge off  edge on');
console.log('-'.repeat(112));
let nAgg = 0, flips = 0, narrowed = 0;
for (const spot of SPOTS) {
  const off = await run(spot, null);
  const on = await run(spot, LIVE_1_3);
  const edgeOff = off.agg && off.chk ? off.agg.ev - off.chk.ev : null;
  const edgeOn = on.agg && on.chk ? on.agg.ev - on.chk.ev : null;
  if (edgeOff != null && edgeOn != null) {
    nAgg += 1;
    if (edgeOn < edgeOff - 1e-9) narrowed += 1;
    if (edgeOff > 0 && edgeOn <= 0) flips += 1;
  }
  console.log(
    `${spot.name.padEnd(32)} | ${f(off.agg?.ev)} ${f(on.agg?.ev)} ${f(on.agg && off.agg ? on.agg.ev - off.agg.ev : null)} `
    + `| ${f(off.chk?.ev)} ${f(on.chk?.ev)} ${f(on.chk && off.chk ? on.chk.ev - off.chk.ev : null)} `
    + `| ${f(edgeOff)} ${f(edgeOn)}`,
  );
}
console.log('-'.repeat(112));
console.log(`spots with both candidates=${nAgg}  bet-edge narrowed=${narrowed}  bet->check flips=${flips}`);
