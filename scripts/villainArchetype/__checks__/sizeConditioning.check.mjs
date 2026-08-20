/**
 * Known-answer checks for the size-conditioned fold-to-open measurement. Synthetic hands, no
 * corpus — every answer here is one a person can count on their fingers.
 *
 * THE BUG THIS EXISTS TO CATCH, because it shipped and reached a published card.
 * The field's fold-to-a-raise rate was keyed on the seat alone, so a fold to a 2bb min-open and
 * a call of a 5bb open landed in one cell. The exploit card then applied that pooled rate to a
 * 2bb steal. The central assertion below is therefore not "the cells are right" but the
 * stronger, stranger one:
 *
 *   THE POOLED FIGURE MUST APPEAR IN NO CELL AT ALL.
 *
 * A build that pools produces 2/4 = 50% somewhere. A build that conditions produces 2/2 and 0/2
 * and nothing in between. That is a difference you can see without knowing any poker.
 *
 * ALSO PINNED HERE: the predicate trap. `decisionLabeler` sets `limpersAhead` to null on every
 * facing-a-raise row, so the obvious way to test for an unopened pot (`limpersAhead === 0`)
 * silently matches nothing and reads as an empty corpus rather than a broken filter. It is
 * asserted as a trap so that anyone who "simplifies" the predicate back to it fails here.
 */
import { measureFoldToOpenCurve, curveCell, CURVE_CELL_STATUS } from '../foldToOpenCurve.mjs';
import { labelDecisions } from '../decisionLabeler.mjs';

let failed = 0;
const is = (name, got, want) => {
  const ok = Object.is(got, want);
  if (!ok) failed++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${name.padEnd(60)} got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};
const ok = (name, cond, detail = '') => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'pass' : 'FAIL'}  ${name.padEnd(60)} ${detail}`);
};

// ── a six-handed hand builder ───────────────────────────────────────────────────────────────
// Seats 1..6, button on 6. Preflop acts 3,4,5,6,1(SB),2(BB). Blinds 0.5/1 so chips read as bb.
const SEATS = [1, 2, 3, 4, 5, 6];
const PID = (s) => `p${s}`;

/**
 * @param {Object} o
 * @param {number} o.openTo   - the raise-to amount, in bb
 * @param {number} o.opener   - seat that opens
 * @param {string} o.bbAction - 'fold' | 'call'
 * @param {number[]} [o.limpers] - seats that limp BEFORE the open (makes the pot not unopened)
 */
const hand = ({ openTo, opener = 6, bbAction = 'fold', limpers = [], id = 'h' }) => {
  const seq = [];
  let order = 0;
  const push = (seat, action, amount) => seq.push({ order: order++, seat, action, street: 'preflop', ...(amount != null ? { amount } : {}) });
  for (const s of [3, 4, 5]) {
    if (limpers.includes(s)) push(s, 'call', 1);
    else if (s !== opener) push(s, 'fold');
  }
  push(opener, 'raise', openTo);
  push(1, 'fold');                                   // SB folds
  if (bbAction === 'fold') push(2, 'fold');
  else push(2, 'call', openTo - 1);                  // BB owes the raise minus its posted blind
  return {
    handId: id,
    seatPlayers: Object.fromEntries(SEATS.map((s) => [s, PID(s)])),
    gameState: {
      actionSequence: seq, dealerButtonSeat: 6, mySeat: null,
      communityCards: [], showdownCards: {}, currentStreet: 'preflop',
      potSize: 10, blinds: { sb: 0.5, bb: 1 },
    },
  };
};

const source = (hands) => (async function* () {
  for (const h of hands) yield { hand: h, stakeLabel: '50NLH' };
}());

const measure = (hands, opts = {}) => measureFoldToOpenCurve({
  handSource: source(hands), minCellN: 1, minPlayersPerCell: 1, selection: null, root: null, ...opts,
});

// ── 1. the central assertion ────────────────────────────────────────────────────────────────
console.log('the big blind folds to two 2bb opens and calls two 4bb opens');
const curve = await measure([
  hand({ openTo: 2, bbAction: 'fold', id: 'a' }),
  hand({ openTo: 2, bbAction: 'fold', id: 'b' }),
  hand({ openTo: 4, bbAction: 'call', id: 'c' }),
  hand({ openTo: 4, bbAction: 'call', id: 'd' }),
]);
const at = (bucket) => curveCell(curve, { seat: 'BB', bucket, stake: '50NLH' });
is('BB to2.0 folds', at('to2.0')?.pooled.k, 2);
is('BB to2.0 total', at('to2.0')?.pooled.n, 2);
is('BB to2.0 rate', at('to2.0')?.pooled.rate, 1);
is('BB to4.0 folds', at('to4.0')?.pooled.k, 0);
is('BB to4.0 total', at('to4.0')?.pooled.n, 2);
is('BB to4.0 rate', at('to4.0')?.pooled.rate, 0);

console.log('\nTHE POOLED FIGURE APPEARS IN NO CELL — this is the whole point of the item');
const everyCell = Object.values(curve.cells).flatMap((s) => Object.values(s)).filter((c) => c.pooled);
const pooledRates = everyCell.map((c) => c.pooled.rate);
ok('no cell holds the pooled 2/4 = 0.5', !pooledRates.includes(0.5), `cell rates: ${JSON.stringify(pooledRates)}`);
ok('no cell holds n=4 (all four decisions merged)', !everyCell.some((c) => c.seat === 'BB' && c.pooled.n === 4));
is('BB has exactly two size cells', Object.keys(curve.cells.BB ?? {}).length, 2);

// ── 2. nothing is silently dropped ──────────────────────────────────────────────────────────
// EVERY ROW IS ACCOUNTED FOR. This is the assertion that caught a real crash: `labelDecisions`
// threw on every raise row (a null geometry dereference), the loop's bare `catch { continue }`
// swallowed it, and four of twenty-four rows simply ceased to exist. Counted + excluded had no
// reason to equal the total, so nothing noticed. Now it must.
console.log('\nevery row is either counted or tallied with a reason — the books must balance');
const SEEN_PER_HAND = 6;                       // 3 folds + the open + SB + BB
is('counted decisions', curve.corpus.countedDecisions, 8);          // SB and BB, four hands
const tallied = Object.values(curve.conditioning.excluded).reduce((a, b) => a + b, 0);
is('excluded decisions', tallied, 16);                              // the three folders and the opener
is('counted + excluded === every row the labeller emitted',
  curve.corpus.countedDecisions + tallied, SEEN_PER_HAND * 4);
is('nothing threw', curve.conditioning.excluded.labelThrew, 0);
ok('no swallowed errors', Object.keys(curve.conditioning.labelErrors).length === 0,
  JSON.stringify(curve.conditioning.labelErrors));

// ── 3. a limped pot is excluded, and says so ────────────────────────────────────────────────
console.log('\na limped pot is NOT an unopened pot — excluded, and counted as excluded');
const limped = await measure([hand({ openTo: 3, bbAction: 'fold', limpers: [3], id: 'L' })]);
is('BB has no cell from a limped hand', limped.cells.BB ? Object.keys(limped.cells.BB).length : 0, 0);
ok('the limped row was tallied, not vanished', limped.conditioning.excluded.limpedOrRaisedPot > 0,
  `limpedOrRaisedPot = ${limped.conditioning.excluded.limpedOrRaisedPot}`);

// ── 4. the predicate trap, asserted as a trap ───────────────────────────────────────────────
console.log('\nthe limpersAhead trap — a filter on it would match NOTHING and look like an empty corpus');
const rows = labelDecisions(hand({ openTo: 3, bbAction: 'fold', id: 'T' }), 2);
const facing = rows.filter((d) => d.street === 'preflop' && d.facing === 'a raise');
ok('there IS a facing-a-raise row to filter', facing.length > 0, `${facing.length} row(s)`);
ok('limpersAhead is null on every one of them', facing.every((d) => d.limpersAhead == null),
  'so `limpersAhead === 0` yields zero rows — use potBeforeBetBB === blindTotal instead');
ok('potBeforeBetBB is the usable field', facing.every((d) => d.potBeforeBetBB === 1.5),
  `potBeforeBetBB = ${facing.map((d) => d.potBeforeBetBB).join(',')}`);

// ── 5. structural zero vs thinness ──────────────────────────────────────────────────────────
console.log('\nUTG cannot face a single open — that is unreachable, not unmeasured');
is('UTG marked unreachable', curve.cells.UTG?._structural?.status, CURVE_CELL_STATUS.UNREACHABLE);
ok('and it says why', /cannot face a single open/.test(curve.cells.UTG?._structural?.reason ?? ''));

// ── 6. refusal is written down, not omitted ─────────────────────────────────────────────────
console.log('\na cell short of players REFUSES — and is persisted with its shortfall');
const thin = await measure([hand({ openTo: 2, bbAction: 'fold', id: 'x' })], { minPlayersPerCell: 40 });
const tc = curveCell(thin, { seat: 'BB', bucket: 'to2.0', stake: '50NLH' });
ok('the cell EXISTS rather than being omitted', tc != null, 'an absent key is indistinguishable from a lookup bug');
is('status', tc?.status, CURVE_CELL_STATUS.DROPPED);
is('have', tc?.have, 1);
is('need', tc?.need, 40);
ok('reason names both numbers', /playerCount 1 < minPlayersPerCell 40/.test(tc?.unavailableReason ?? ''), tc?.unavailableReason);

// ── 7. the degenerate-interval tell ─────────────────────────────────────────────────────────
console.log('\na one-player interval is LABELLED degenerate — zero width must never read as certainty');
ok('ciKind says degenerate', /DEGENERATE at 1 players/.test(tc?.betweenPlayer?.ciKind ?? ''), tc?.betweenPlayer?.ciKind);

// ── 8. the stake axis is real ───────────────────────────────────────────────────────────────
console.log('\nstake is part of the key — two stakes never merge into one cell');
const twoStakes = await measureFoldToOpenCurve({
  minCellN: 1, minPlayersPerCell: 1, selection: null, root: null,
  handSource: (async function* () {
    yield { hand: hand({ openTo: 2, bbAction: 'fold', id: 's1' }), stakeLabel: '50NLH' };
    yield { hand: hand({ openTo: 2, bbAction: 'call', id: 's2' }), stakeLabel: '200NLH' };
  }()),
});
is('50NLH cell', curveCell(twoStakes, { seat: 'BB', bucket: 'to2.0', stake: '50NLH' })?.pooled.rate, 1);
is('200NLH cell', curveCell(twoStakes, { seat: 'BB', bucket: 'to2.0', stake: '200NLH' })?.pooled.rate, 0);
is('two distinct cells, not one merged', Object.keys(twoStakes.cells.BB ?? {}).length, 2);

// ── 9. the subject survives a threshold that removes everyone else ──────────────────────────
// Load-bearing, and easy to lose: conditioning on size splits the subject's record into cells
// that are BELOW any sensible per-player threshold by construction. If `subjectIds` retention
// silently failed, his cells would simply not exist and the card could not price him at all —
// which looks like "no data" rather than like a dropped filter.
console.log('\nthe subject is retained below the threshold that drops the rest of the field');
const withSubject = await measureFoldToOpenCurve({
  minCellN: 999, minPlayersPerCell: 1, selection: null, root: null,
  subjectIds: [PID(2)],                                    // seat 2 is the big blind
  handSource: source([hand({ openTo: 2, bbAction: 'fold', id: 'r1' })]),
});
const rc = curveCell(withSubject, { seat: 'BB', bucket: 'to2.0', stake: '50NLH' });
is('subject kept despite minCellN=999', rc?.players.length, 1);
is('and it is him', rc?.players[0]?.pid, PID(2));
const withoutSubject = await measureFoldToOpenCurve({
  minCellN: 999, minPlayersPerCell: 1, selection: null, root: null, subjectIds: [],
  handSource: source([hand({ openTo: 2, bbAction: 'fold', id: 'r2' })]),
});
const rc2 = curveCell(withoutSubject, { seat: 'BB', bucket: 'to2.0', stake: '50NLH' });
is('without the retention he is dropped', rc2?.players.length, 0);
ok('and the drop is recorded, not silent', rc2?.playersBelowThreshold === 1,
  `playersBelowThreshold = ${rc2?.playersBelowThreshold}`);

console.log(`\n${failed ? `FAILED — ${failed} check(s)` : 'all checks passed'}`);
process.exit(failed ? 1 : 0);
