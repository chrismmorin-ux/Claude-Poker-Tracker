/**
 * Known-answer checks for size-aware, PAIRED pricing. No corpus.
 *
 * THE TWO BUGS THIS EXISTS TO CATCH, both of which shipped and reached a published card.
 *
 * 1. THE SWEEP DID NOT MOVE THE FOLD RATE. `runExploitCard` swept hero's open across
 *    2 / 2.5 / 3 / 4bb, but `allFold(seats)` took no size argument, so `predicted.p` was
 *    BYTE-IDENTICAL on all four rows. Only the required threshold moved. The card's headline —
 *    "the cheapest steal should be the best one" — was therefore a theorem of the arithmetic
 *    (lower the bar, hold the rate, the cheapest always wins) and not a finding about anyone.
 *    The guard is one line and it is unmissable:
 *
 *        new Set(rows.map(r => r.predictedFold)).size === rows.length
 *
 *    It fails on the old code by construction.
 *
 * 2. ROWS WERE NOT PAIRED. Each row drew a fresh posterior, so differencing two rows added
 *    spread from seats they SHARE — the small blind is the same cell in both, and its
 *    uncertainty must cancel exactly, not accumulate. `compareLines(a, a)` is the control: a
 *    line differenced against itself must give exactly [0, 0], and unpaired draws do not.
 */
import {
  seatPolicy, fieldSeatFromPlayers, fieldSeatFromCurve, subjectSeatFromCurve,
  ineligibleSeat, allFold, priceLine, compareLines, resolvingN, openPricingContext,
  cellId, POLICY_KINDS, SEAT_INELIGIBLE,
} from '../exploitCard.mjs';

let failed = 0;
const is = (name, got, want) => {
  const ok = Object.is(got, want);
  if (!ok) failed++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${name.padEnd(58)} got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};
const ok = (name, cond, detail = '') => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'pass' : 'FAIL'}  ${name.padEnd(58)} ${detail}`);
};

// A synthetic curve with a REAL gradient: the field folds much less to a small open.
const players = (rate, count, n = 60) => Array.from({ length: count }, (_, i) => ({
  pid: `f${i}`, n, k: Math.round(rate * n), rate: Math.round(rate * n) / n,
}));
const SUBJ = 'subject-1';
const cell = (seat, bucket, stake, rate, count, subjRate = null) => {
  const ps = players(rate, count);
  if (subjRate != null) ps.push({ pid: SUBJ, n: 50, k: Math.round(subjRate * 50), rate: Math.round(subjRate * 50) / 50 });
  return [`${bucket}|${stake}`, { seat, bucket, stake, players: ps, playerCount: ps.length,
    status: 'hit', pooled: { k: 0, n: 0, rate } }];
};
const curve = {
  cells: {
    SB: Object.fromEntries([cell('SB', 'to2.0', '50NLH', 0.70, 50), cell('SB', 'to3.0', '50NLH', 0.85, 50)]),
    BB: Object.fromEntries([
      cell('BB', 'to2.0', '50NLH', 0.575, 50, 0.87),
      cell('BB', 'to3.0', '50NLH', 0.721, 50, 0.92),
      cell('BB', 'to2.5', '50NLH', 0.60, 1),                     // the thin cell — must refuse
    ]),
  },
};

const seatsAt = (openTo) => [
  fieldSeatFromCurve({ curve, seat: 'SB', openToBB: openTo, stake: '50NLH', minPlayers: 40, excludePlayerIds: [SUBJ] }),
  subjectSeatFromCurve({ curve, seat: 'BB', openToBB: openTo, stake: '50NLH', subjectId: SUBJ, minN: 25 }),
];

// ── 1. THE HEADLINE GUARD ───────────────────────────────────────────────────────────────────
console.log('the sweep must move the PREDICTED rate, not only the required one');
const ctx = openPricingContext({ draws: 20000 });
const rows = [2, 3].map((openTo) => priceLine({
  lineId: `steal-${openTo}bb`, spotKey: 'steal:BTN-first-in',
  description: `open to ${openTo}bb`, potBB: 1.5, riskBB: openTo,
  seats: seatsAt(openTo), ctx,
}));
is('every row priced', rows.filter((r) => r.verdict !== 'ineligible').length, 2);
is('DISTINCT predicted fold rates across the sweep',
  new Set(rows.map((r) => r.predictedFold)).size, rows.length);
ok('and the required rate moved too', new Set(rows.map((r) => r.requiredFold)).size === rows.length,
  rows.map((r) => `${(100 * r.requiredFold).toFixed(1)}%`).join(' vs '));
ok('the 2bb row predicts a LOWER fold rate than the 3bb row',
  rows[0].predictedFold < rows[1].predictedFold,
  `${(100 * rows[0].predictedFold).toFixed(1)}% vs ${(100 * rows[1].predictedFold).toFixed(1)}%`);

// ── 1b. THE OLD SHAPE, DEMONSTRATED ─────────────────────────────────────────────────────────
// `priceLine` alone does NOT fix this, and that is worth pinning. Hand it POOLED seats — seats
// with no `sizeCell`, exactly what `seatPolicy`/`fieldSeatFromPlayers` produced before — and
// the predicted rate is identical across the sweep again, because nothing about those seats
// knows what hero bet. The fix is that the SEATS are resolved at the size being priced. A
// future caller that reaches for the pooled constructors reintroduces the defect in full, so
// the failure mode is asserted here rather than left as a comment.
console.log('\nthe old shape, shown failing: POOLED seats give one rate at every size');
const pooled = [
  fieldSeatFromPlayers({ seat: 'SB', players: players(0.85, 50) }),
  seatPolicy({ seat: 'BB', k: 150, n: 170, kind: POLICY_KINDS.CONDUCT, subjectId: SUBJ }),
];
const pooledRows = [2, 2.5, 3, 4].map((openTo) => priceLine({
  lineId: `pooled-${openTo}`, spotKey: 'steal:BTN-first-in', description: `open to ${openTo}bb`,
  potBB: 1.5, riskBB: openTo, seats: pooled, ctx: openPricingContext({ draws: 5000 }),
}));
is('pooled seats: DISTINCT predicted rates', new Set(pooledRows.map((r) => r.predictedFold)).size, 1);
ok('...i.e. one rate applied to four different prices — the defect, reproduced',
  pooledRows.every((r) => r.predictedFold === pooledRows[0].predictedFold),
  `all four rows predict ${(100 * pooledRows[0].predictedFold).toFixed(1)}%`);
ok('while the required rate fans out 57.1% -> 72.7%',
  new Set(pooledRows.map((r) => r.requiredFold)).size === 4,
  pooledRows.map((r) => `${(100 * r.requiredFold).toFixed(1)}%`).join(' '));
ok('so the cheapest open wins by construction, whatever anyone folds',
  pooledRows[0].evBB > pooledRows[3].evBB,
  'this is the theorem the published card reported as a finding');

// ── 2. PAIRING ──────────────────────────────────────────────────────────────────────────────
console.log('\na line differenced against itself is exactly zero — the control for pairing');
const self = compareLines({ a: rows[0], b: rows[0] });
is('deltaEvBB', self.deltaEvBB, 0);
is('delta CI low', self.deltaEvCI[0], 0);
is('delta CI high', self.deltaEvCI[1], 0);
ok('unpaired draws could not produce this', self.deltaEvCI[0] === 0 && self.deltaEvCI[1] === 0,
  'a fresh RNG per row gives a non-degenerate interval here');

console.log('\nshared seat cells reuse the SAME draws, so their uncertainty cancels');
const sbA = seatsAt(2)[0], sbB = seatsAt(2)[0];
is('same cell id', cellId(sbA), cellId(sbB));
const d1 = ctx.drawsFor(sbA), d2 = ctx.drawsFor(sbB);
ok('identical draw arrays for the same cell', d1 === d2 || d1.every((v, i) => v === d2[i]));
ok('a DIFFERENT size is a different cell', cellId(seatsAt(2)[0]) !== cellId(seatsAt(3)[0]),
  `${cellId(seatsAt(2)[0])} vs ${cellId(seatsAt(3)[0])}`);

console.log('\nthe comparison is a real claim with an interval, not two point estimates');
const cmp = compareLines({ a: rows[0], b: rows[1] });
ok('comparable', cmp.comparable === true);
ok('carries a difference interval', Array.isArray(cmp.deltaEvCI), JSON.stringify(cmp.deltaEvCI.map((x) => +x.toFixed(3))));
ok('carries P(A > B)', cmp.pAGreaterB >= 0 && cmp.pAGreaterB <= 1, `P(2bb > 3bb) = ${cmp.pAGreaterB.toFixed(3)}`);
ok('verdict is one of the three', ['a-better', 'b-better', 'not-resolved'].includes(cmp.verdict), cmp.verdict);

// ── 3. REFUSAL ──────────────────────────────────────────────────────────────────────────────
console.log('\na thin cell refuses, and its refusal poisons the whole line');
const thinSeats = [
  fieldSeatFromCurve({ curve, seat: 'SB', openToBB: 2.5, stake: '50NLH', minPlayers: 40 }),
  fieldSeatFromCurve({ curve, seat: 'BB', openToBB: 2.5, stake: '50NLH', minPlayers: 40 }),
];
is('the thin BB seat is ineligible', thinSeats[1].kind, POLICY_KINDS.INELIGIBLE);
is('with a reason', thinSeats[1].reason, SEAT_INELIGIBLE.TOO_FEW_PLAYERS);
is('and its shortfall', `${thinSeats[1].have}/${thinSeats[1].need}`, '1/40');
is('a refusing seat has NO rate', thinSeats[1].foldRate, null);

const thinRow = priceLine({
  lineId: 'steal-2.5bb', spotKey: 'steal:BTN-first-in', description: 'open to 2.5bb',
  potBB: 1.5, riskBB: 2.5, seats: thinSeats, ctx,
  occurrences: { per100Hands: 6.0, conditional: 'measured' },
});
is('verdict', thinRow.verdict, 'ineligible');
is('evBB is NULL, not 0', thinRow.evBB, null);
is('bbPer100 is NULL, not 0', thinRow.bbPer100, null);
is('predictedFold is NULL', thinRow.predictedFold, null);
ok('but the required fold IS reported — pot geometry has no data in it',
  typeof thinRow.requiredFold === 'number', `needs ${(100 * thinRow.requiredFold).toFixed(1)}%`);
// EVERY refusing seat is listed, not just the first one to fail. A line blocked by two
// different shortfalls needs both named, or fixing one leaves the row still refusing with no
// clue why.
const bbRefusal = thinRow.ineligible.seats.find((s) => s.seat === 'BB');
const sbRefusal = thinRow.ineligible.seats.find((s) => s.seat === 'SB');
is('both refusing seats are listed', thinRow.ineligible.seats.length, 2);
ok('the BB refusal names its shortfall', bbRefusal?.have === 1 && bbRefusal?.need === 40,
  JSON.stringify(bbRefusal));
is('the SB refusal is a different reason — never measured at all', sbRefusal?.reason, SEAT_INELIGIBLE.CELL_NOT_MEASURED);
ok('and the two reasons are distinguishable', bbRefusal.reason !== sbRefusal.reason,
  `${bbRefusal.reason} vs ${sbRefusal.reason} — "too thin" and "never measured" are different problems`);

// ── 4. THE DEGENERATE-INTERVAL TRAP ─────────────────────────────────────────────────────────
console.log('\na one-player field cell can never present as certainty');
const one = fieldSeatFromPlayers({ seat: 'CO', players: players(0.8, 1), minPlayers: 0 });
ok('zero-width interval is flagged degenerate', one.ciDegenerate === true, one.ciKind);
is('interval width', one.foldCI[1] - one.foldCI[0], 0);
ok('and with a guard it refuses outright',
  fieldSeatFromPlayers({ seat: 'CO', players: players(0.8, 1), minPlayers: 40 }).kind === POLICY_KINDS.INELIGIBLE);

// ── 5. EXPOSURE WEIGHTING ───────────────────────────────────────────────────────────────────
console.log('\nthe field player is drawn by EXPOSURE — who actually sits there, not who exists');
const lopsided = { seat: 'SB', kind: POLICY_KINDS.FIELD, foldRate: 0.5, foldCI: [0, 1],
  players: [{ pid: 'a', k: 0, n: 1000 }, { pid: 'b', k: 500, n: 500 }] };
const ew = allFold([lopsided], { draws: 20000, playerDraw: 'exposure-weighted' });
const un = allFold([lopsided], { draws: 20000, playerDraw: 'uniform' });
ok('exposure-weighted leans to the player seen more often', ew.p != null && ew.ci[0] < un.ci[1],
  `weighted mean ${(ew.sortedSamples.reduce((a, b) => a + b, 0) / 20000).toFixed(3)} vs `
  + `uniform ${(un.sortedSamples.reduce((a, b) => a + b, 0) / 20000).toFixed(3)}`);
const ewMean = ew.sortedSamples.reduce((a, b) => a + b, 0) / 20000;
const unMean = un.sortedSamples.reduce((a, b) => a + b, 0) / 20000;
ok('and the two differ materially — this is why it ships as a stated sensitivity',
  Math.abs(ewMean - unMean) > 0.05, `${ewMean.toFixed(3)} vs ${unMean.toFixed(3)}`);

// ── 6. resolvingN ───────────────────────────────────────────────────────────────────────────
console.log('\na not-resolved row says what would resolve it — or why nothing would');
const fieldOnly = [
  fieldSeatFromCurve({ curve, seat: 'SB', openToBB: 2, stake: '50NLH', minPlayers: 40 }),
  fieldSeatFromCurve({ curve, seat: 'BB', openToBB: 2, stake: '50NLH', minPlayers: 40 }),
];
const rn = resolvingN({ seats: fieldOnly, required: 0.571, slope: 3.5 });
is('a field-limited row is honest about it', rn.limitedBy, 'between-player');
is('and quotes no unreachable n', rn.resolvingN, null);
ok('and says why', /does not shrink with more observations/.test(rn.note), rn.note);

console.log(`\n${failed ? `FAILED — ${failed} check(s)` : 'all checks passed'}`);
process.exit(failed ? 1 : 0);
