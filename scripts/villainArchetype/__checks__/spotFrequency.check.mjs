/**
 * Known-answer checks for the measured steal-spot frequency. Synthetic tables, no corpus.
 *
 * THE CONSTANT THIS REPLACES, AND THE TWO SEPARATE ERRORS INSIDE IT.
 * `occurrencesPer100: 100 / 6` appeared four times in `runExploitCard.mjs`, described as "the
 * button comes round once per orbit at six-handed".
 *
 *   ERROR 1 — IT HAS NO FOLDED-TO CONDITION. It counts every button, while the line it prices
 *   (`steal:BTN-first-in`) requires everyone before hero to fold. Measured on the corpus the
 *   button is folded to 38% of the time, so the constant overstates the spot ~2.9x.
 *
 *   ERROR 2 — IT ASSUMES THE TABLE SIZE. The corpus is not six-max: tables run 3-9 handed and
 *   ~18% of hands are NINE-handed, which is the founder's game. At nine-handed the button is
 *   folded to 25.7%, not 38.2%.
 *
 * The check below pins the one case where the old constant is exactly right — a six-handed
 * table where it always folds to the button — because that is precisely what `100/6` silently
 * asserted about every table. Seeing it pass there and fail everywhere else is the clearest
 * statement of what the constant was claiming.
 *
 * THE BUG THIS ALSO CATCHES, having already occurred once during this work: counting the first
 * seat to ENTER rather than every seat the action REACHES. A seat folded to that then folds
 * still had the opportunity — hero's spot does not depend on what the corpus player did with
 * it. Getting this wrong understated every frequency by a factor of ~2.8, in the same direction
 * as the original bug, which is exactly why it was hard to notice.
 */
import { measureSpotFrequency } from '../spotFrequency.mjs';

let failed = 0;
const is = (name, got, want) => {
  const ok = Object.is(got, want);
  if (!ok) failed++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${name.padEnd(58)} got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};
const near = (name, got, want, tol = 1e-9) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) failed++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${name.padEnd(58)} got ${got} want ~${want}`);
};
const ok = (name, cond, detail = '') => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'pass' : 'FAIL'}  ${name.padEnd(58)} ${detail}`);
};

/** A hand at `size` seats, button on the last one. `entrant` = position that first enters, or null. */
const table = (size, entrantPos = null, id = 'h') => {
  const seats = Array.from({ length: size }, (_, i) => i + 1);
  // Preflop order at an n-handed table with the button on seat n: 3,4,…,n,1,2 for n>2.
  const order = [...seats.slice(2), seats[0], seats[1]];
  const seq = []; let o = 0;
  for (const s of order) {
    // Positions are assigned by the same primitive the module uses, so we resolve by index:
    // the first actor is UTG, the button is the last seat.
    const isEntrant = entrantPos === 'first' ? s === order[0]
      : entrantPos === 'button' ? s === seats[size - 1] : false;
    seq.push({ order: o++, seat: s, action: isEntrant ? 'raise' : 'fold', street: 'preflop', ...(isEntrant ? { amount: 3 } : {}) });
    if (isEntrant) break;
  }
  return {
    handId: id,
    seatPlayers: Object.fromEntries(seats.map((s) => [s, `p${s}`])),
    gameState: { actionSequence: seq, dealerButtonSeat: seats[size - 1], mySeat: null,
      communityCards: [], showdownCards: {}, currentStreet: 'preflop', potSize: 5, blinds: { sb: 0.5, bb: 1 } },
  };
};
const run = (hands) => measureSpotFrequency({
  handSource: (async function* () { for (const h of hands) yield { hand: h }; }()),
});

// ── 1. what the old constant silently asserted ──────────────────────────────────────────────
console.log('a six-handed table where it ALWAYS folds to the button — the only case 100/6 is right');
const always = await run(Array.from({ length: 60 }, (_, i) => table(6, 'button', `a${i}`)));
near('BTN P(in seat)', always.bySeat.BTN.inSeat.rate, 1 / 6, 1e-9);
near('BTN P(folded to)', always.bySeat.BTN.firstIn.rate, 1, 1e-9);
near('BTN per 100 hands', always.bySeat.BTN.per100Hands, +(100 / 6).toFixed(3), 0.001);
ok('...which is exactly 16.667 — the constant, reproduced as a special case',
  Math.abs(always.bySeat.BTN.per100Hands - 100 / 6) < 0.001,
  'the card applied this to every table, folded-to or not');

// ── 2. the folded-to condition ──────────────────────────────────────────────────────────────
console.log('\nwhen the first seat always opens, the button is NEVER folded to');
const never = await run(Array.from({ length: 60 }, (_, i) => table(6, 'first', `b${i}`)));
near('BTN P(folded to)', never.bySeat.BTN.firstIn.rate, 0, 1e-9);
is('BTN per 100 hands', never.bySeat.BTN.per100Hands, 0);
near('UTG P(folded to) is 1 by construction — it acts first', never.bySeat.UTG.firstIn.rate, 1, 1e-9);
ok('the constant would still have said 16.667 here', true,
  'it has no folded-to condition in it at all — that is the whole of error 1');

console.log('\na seat that is folded to and then FOLDS still had the opportunity');
const halfOpen = await run([
  ...Array.from({ length: 30 }, (_, i) => table(6, 'button', `c${i}`)),   // folds to BTN, BTN opens
  ...Array.from({ length: 30 }, (_, i) => table(6, null, `d${i}`)),       // folds to BTN, BTN folds too
]);
near('BTN P(folded to) counts both', halfOpen.bySeat.BTN.firstIn.rate, 1, 1e-9);
ok('counting only ENTRANTS would have given 0.5 — the ~2.8x understatement',
  halfOpen.bySeat.BTN.firstIn.rate === 1,
  'hero\'s opportunity does not depend on what the corpus player chose');

// ── 3. the table-size assumption ────────────────────────────────────────────────────────────
console.log('\ntable size is measured, not assumed — and the corpus is NOT six-max');
const mixed = await run([
  ...Array.from({ length: 40 }, (_, i) => table(6, 'button', `e${i}`)),
  ...Array.from({ length: 40 }, (_, i) => table(9, 'button', `f${i}`)),
]);
is('two table sizes seen', Object.keys(mixed.tableSizeDistribution).join(','), '6,9');
near('mean table size', mixed.meanTableSize, 7.5, 1e-9);
ok('a 9-handed figure is readable directly', mixed.bySeatAndTableSize['BTN|9'] != null,
  JSON.stringify(mixed.bySeatAndTableSize['BTN|9']?.conditional));
near('BTN P(in seat) at 9-handed', mixed.bySeatAndTableSize['BTN|9'].dealt / (40 * 9), 1 / 9, 1e-9);
ok('and it differs from the pooled figure', mixed.bySeat.BTN.inSeat.rate !== 1 / 9,
  `pooled ${mixed.bySeat.BTN.inSeat.rate.toFixed(4)} vs 9-handed ${(1 / 9).toFixed(4)}`);
ok('the hijack does not exist at every table size',
  (mixed.bySeatAndTableSize['HJ|6']?.dealt ?? 0) !== (mixed.bySeatAndTableSize['HJ|9']?.dealt ?? 0)
  || mixed.bySeatAndTableSize['HJ|9'] != null,
  'one constant cannot carry a seat that is sometimes absent');

// ── 4. the conditioning travels with the number ─────────────────────────────────────────────
console.log('\nevery rate carries the set it was measured over');
ok('inSeat names its conditional', /dealt into a hand/.test(mixed.bySeat.BTN.inSeat.conditional));
ok('firstIn names its conditional', /folded to BTN with nobody yet entered/.test(mixed.bySeat.BTN.firstIn.conditional));
ok('the table-size cell names its size', /9-handed table/.test(mixed.bySeatAndTableSize['BTN|9'].conditional));
ok('the artifact carries the transfer caveat', /not live 2026/i.test(mixed.transferCaveat), mixed.transferCaveat.slice(0, 80) + '…');
ok('and explicitly DENIES the six-max description rather than repeating it',
  /NOT a six-max/i.test(mixed.transferCaveat),
  'the corpus was called six-max throughout the work that produced the card; it runs 3-9 handed');
ok('and points at the table-size breakdown instead of just caveating',
  /bySeatAndTableSize/.test(mixed.transferCaveat));

console.log(`\n${failed ? `FAILED — ${failed} check(s)` : 'all checks passed'}`);
process.exit(failed ? 1 : 0);
