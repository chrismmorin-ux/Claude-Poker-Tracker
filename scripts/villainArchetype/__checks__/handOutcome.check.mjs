/**
 * handOutcome — corpus-free known-answer checks.
 *
 * WHY THIS EXISTS. `hand-outcome` was carried in the detectability census as an ABSENT
 * capability, on the untested sentence "nothing records who won the pot or how much", and 43 of
 * 128 behaviours were written off against it. The claim was true of the raw PHH file and false
 * of this pipeline: the award is DERIVED, and `handOutcome.mjs` had already shipped to derive it.
 *
 * A derived column is the kind that most needs known answers. Nothing in the corpus can
 * contradict it, so a wrong derivation is wrong QUIETLY, and every leak, EV and payoff figure
 * built on it inherits the error with no symptom at all. A 99.94% resolve rate says the function
 * returned; it says nothing about whether it returned the right seat.
 *
 * These are known answers, not plausibility checks. Each one is a hand where the correct award
 * follows from the rules of poker and can be written down before running anything.
 *
 *   node scripts/villainArchetype/__checks__/handOutcome.check.mjs
 */
import { resolveHandOutcome } from '../../backtest/handOutcome.mjs';

/**
 * Cards in this codebase carry SUIT SYMBOLS, not letters - `parseAndEncode("Ah")` returns -1.
 * The first version of this fixture used letters and every showdown case came back
 * `unparseable-cards`, which is the check doing its job on the check.
 */
const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
const C = (t) => t.slice(0, -1) + SUIT[t.slice(-1)];
const B = (...t) => t.map(C);


let failed = 0;
const ok = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) failed++;
  console.log(`  ${pass ? 'pass' : 'FAIL'}  ${name.padEnd(52)} got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};

/**
 * A hand in the shape `phhAdapter` emits. Only the fields `resolveHandOutcome` reads are set,
 * deliberately: a fixture that fills everything hides which fields the function depends on.
 */
const hand = ({ committed, bb = 1, folds = [], board = [], shown = {}, street = 'river' }) => ({
  gameState: {
    actionSequence: folds.map((seat) => ({ seat, action: 'fold' })),
    communityCards: board,
    showdownCards: shown,
    currentStreet: street,
  },
  _backtest: { bb, committedBySeat: committed },
});

// ── 1. everyone folds ───────────────────────────────────────────────────────
// Three seats in for 1, 3 and 3; two fold. The survivor is awarded all 7 and had 3 in, so it is
// up 4 and each folder is down exactly what it put in. No card is involved anywhere.
console.log('\neverybody folds - the last live seat takes it, no cards needed');
{
  const r = resolveHandOutcome(hand({ committed: { 1: 1, 2: 3, 3: 3 }, folds: ['1', '2'] }));
  ok('it resolves without a board', r.resolved, true);
  ok('the survivor is up the dead money', r.netBySeat['3'], 4);
  ok('a folder is down exactly what it committed', r.netBySeat['1'], -1);
  ok('the other folder likewise', r.netBySeat['2'], -3);
  ok('the survivor is the only winner', r.winners, ['3']);
  ok('it is not a showdown', r.wentToShowdown, false);
}

// ── 2. a contested showdown ─────────────────────────────────────────────────
// Board 2c 7d 9s Jh 3h. Seat 1 holds AhAd (an overpair), seat 2 holds KsKc. Aces win. This is
// the check that catches an award landing on the wrong seat, which is the failure a resolve
// RATE cannot see.
console.log('\na contested showdown - the better hand is awarded the pot');
{
  const r = resolveHandOutcome(hand({
    committed: { 1: 10, 2: 10 },
    board: B('2c','7d','9s','Jh','3h'),
    shown: { 1: B('Ah','Ad'), 2: B('Ks','Kc') },
  }));
  ok('it resolves', r.resolved, true);
  ok('aces are paid', r.winners, ['1']);
  ok('and are up their opponent’s commitment', r.netBySeat['1'], 10);
  ok('kings are down theirs', r.netBySeat['2'], -10);
  ok('it is flagged as a showdown', r.wentToShowdown, true);
}

// ── 3. the loser of the showdown is not paid ────────────────────────────────
// Same board and same holdings, seats swapped. If the derivation keyed on seat order rather
// than hand strength this is the check that fails, and case 2 alone would not have caught it.
console.log('\nthe same hand with the seats swapped - strength decides, not seat order');
{
  const r = resolveHandOutcome(hand({
    committed: { 1: 10, 2: 10 },
    board: B('2c','7d','9s','Jh','3h'),
    shown: { 1: B('Ks','Kc'), 2: B('Ah','Ad') },
  }));
  ok('aces are still the ones paid', r.winners, ['2']);
  ok('and the kings still lose', r.netBySeat['1'], -10);
}

// ── 4. a side pot ───────────────────────────────────────────────────────────
// Seat 1 is all-in for 5 with the best hand; seats 2 and 3 contest 20 each. Seat 1 can only win
// the layer it paid for: 5 from each of three seats = 15. The remaining 30 is a side pot between
// 2 and 3, which seat 2 wins with the better of the two. Dropping all-in hands would be the
// worst possible filter for an EV instrument, so this case has to be right rather than skipped.
console.log('\na short all-in - the main pot and the side pot go to different seats');
{
  const r = resolveHandOutcome(hand({
    committed: { 1: 5, 2: 20, 3: 20 },
    board: B('2c','7d','9s','Jh','3h'),
    shown: { 1: B('Ah','Ad'), 2: B('Ks','Kc'), 3: B('Qs','Qc') },
  }));
  ok('it resolves rather than being skipped', r.resolved, true);
  ok('the short stack wins only the main pot', r.netBySeat['1'], 10);
  ok('the side pot goes to the better of the rest', r.netBySeat['2'], 10);
  ok('and the third seat loses everything it put in', r.netBySeat['3'], -20);
  ok('both are named as winners', r.winners.sort(), ['1', '2']);
}

// ── 5. an uncalled bet comes back ───────────────────────────────────────────
// Seat 1 bets 20 into a seat that has 5 in and folds. The top layer has exactly one eligible
// seat, so the bettor wins their own excess back and is up only the 5 they were actually paid.
console.log('\nan uncalled bet returns to the bettor rather than being won');
{
  const r = resolveHandOutcome(hand({ committed: { 1: 20, 2: 5 }, folds: ['2'] }));
  ok('the bettor is up only what was called', r.netBySeat['1'], 5);
  ok('the folder is down only what it paid', r.netBySeat['2'], -5);
}

// ── 6. chips are conserved ──────────────────────────────────────────────────
// With no rake modelled the nets must sum to zero. This is the property the whole ledger rests
// on: if it does not hold, some seat is being paid money no seat put in.
console.log('\nchips are conserved when no rake is modelled');
{
  const cases = [
    hand({ committed: { 1: 1, 2: 3, 3: 3 }, folds: ['1', '2'] }),
    hand({ committed: { 1: 5, 2: 20, 3: 20 }, board: B('2c','7d','9s','Jh','3h'),
      shown: { 1: B('Ah','Ad'), 2: B('Ks','Kc'), 3: B('Qs','Qc') } }),
    hand({ committed: { 1: 20, 2: 5 }, folds: ['2'] }),
  ];
  const sums = cases.map((h) => {
    const r = resolveHandOutcome(h);
    return Number(Object.values(r.netBySeat).reduce((s, v) => s + v, 0).toFixed(6));
  });
  ok('every case sums to zero', sums, [0, 0, 0]);
}

// ── 7. it refuses rather than guessing ──────────────────────────────────────
// A contested pot where nobody showed cannot be awarded: somebody has to expose a hand to claim
// it. The correct output is a NAMED refusal, because a blank that reads as a zero would enter
// the ledger as a real result.
console.log('\nan underivable pot is refused by name, never estimated');
{
  const r = resolveHandOutcome(hand({
    committed: { 1: 10, 2: 10 }, board: B('2c','7d','9s','Jh','3h'), shown: {},
  }));
  ok('it does not resolve', r.resolved, false);
  ok('and it says why', r.reason, 'showdown-cards-missing');

  const b = resolveHandOutcome(hand({
    committed: { 1: 10, 2: 10 }, board: B('2c','7d','9s'),
    shown: { 1: B('Ah','Ad'), 2: B('Ks','Kc') },
  }));
  ok('an incomplete board is refused too', b.reason, 'incomplete-board');
}

// ── 8. the result is in big blinds ──────────────────────────────────────────
// Every other figure in this directory is in big blinds, and a ledger that silently reported
// chips would be off by the stake on every hand.
console.log('\nthe net is denominated in big blinds, not chips');
{
  const r = resolveHandOutcome(hand({ committed: { 1: 100, 2: 300, 3: 300 }, folds: ['1', '2'], bb: 100 }));
  ok('a 4bb win at bb=100 reads 4, not 400', r.netBySeat['3'], 4);
  ok('and the pot is in big blinds', r.potBB, 7);
}

console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nall checks pass');
process.exit(failed ? 1 : 0);
