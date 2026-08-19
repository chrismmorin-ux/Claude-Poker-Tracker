/**
 * Known-answer checks for positionOf. The answer here exists independently of this code:
 * it is how the game names seats, and it is checkable at every table size without a corpus.
 *
 * THE BUG THIS EXISTS TO CATCH, because it shipped and reached a reported number.
 * `i === n - 3 -> 'HJ'` used to be tested BEFORE `i === 2 -> 'UTG'`. At six-handed those are
 * different seats and the order does not matter. At FIVE-handed they are the same seat - the
 * first voluntary actor, with the whole field behind it - and it was named HJ. One label then
 * covered two structurally different situations, and pooling them is not a rounding error:
 *
 *   villain SO0Om/HLLvkJps9pZmbgqQ, first-in opening rate
 *     HJ at 5-handed   4.8%  (n=146)     <- actually the first seat to act
 *     HJ at 6-handed  12.2%  (n=213)
 *     pooled "HJ"      9.2%  (n=359)     <- what the induction was given
 *
 * The induced ruleset then carried `seat pos = HJ -> I raise 9%`, sitting BELOW UTG at 12.5%,
 * which reads as a player who opens tighter in later position. No rule in the output was
 * false on its own terms; the label underneath it named two seats.
 *
 * Early seats are named from the FRONT (who acts first), late seats from the BACK (distance
 * to the button). So the two checks cannot be written in either order indifferently, and
 * nothing in the code says so - which is why this file does.
 */
import { positionOf } from '../decisionLabeler.mjs';

let failed = 0;
const is = (name, got, want) => {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${name.padEnd(56)} got ${got} want ${want}`);
};

/** Seats 1..n with the button on seat n, so the acting order starts at the small blind. */
const labelsAt = (n) => {
  const seats = Array.from({ length: n }, (_, k) => k + 1);
  return seats.map((s) => positionOf(s, n, seats));
};

console.log('every seat at a table gets its own label — no two seats share one');
for (let n = 2; n <= 10; n++) {
  const labels = labelsAt(n);
  is(`${n}-handed has ${n} distinct labels`, new Set(labels).size, n);
}

console.log('\nthe standard naming, table size by table size');
is('2-handed', labelsAt(2).join(' '), 'SB BB');
is('3-handed', labelsAt(3).join(' '), 'SB BB BTN');
is('4-handed', labelsAt(4).join(' '), 'SB BB CO BTN');
// THE REGRESSION. Five-handed has no hijack: the third seat opens the field, so it is UTG.
is('5-handed has no hijack', labelsAt(5).join(' '), 'SB BB UTG CO BTN');
is('6-handed', labelsAt(6).join(' '), 'SB BB UTG HJ CO BTN');
is('9-handed', labelsAt(9).join(' '), 'SB BB UTG UTG1 UTG2 MP HJ CO BTN');

console.log('\nthe two naming directions hold at every size');
for (let n = 6; n <= 10; n++) {
  const labels = labelsAt(n);
  // Named from the BACK: the hijack is always two seats off the button.
  is(`${n}-handed hijack sits 2 off the button`, labels[n - 3], 'HJ');
  // Named from the FRONT: the first voluntary actor is always under the gun.
  is(`${n}-handed first voluntary actor is UTG`, labels[2], 'UTG');
}

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
