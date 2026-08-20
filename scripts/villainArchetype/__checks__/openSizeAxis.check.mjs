/**
 * Known-answer checks for the open-size axis. No corpus, no randomness — the answers here are
 * properties of the lattice, checkable by hand.
 *
 * THE FAILURE THESE GUARD, in the order it actually happens:
 *
 * 1. A cell has too few observations, so someone widens a boundary to reach an n. That is the
 *    pooled rate coming back through the door the item closed — the 2.5bb bucket carries about
 *    0.3% of the corpus mass and is the one that will tempt this. So the axis is frozen against
 *    literals here, and a boundary edit fails this file unless OPEN_SIZE_AXIS_VERSION is bumped
 *    in the same commit. The version is what the persisted artifact carries and what the loader
 *    refuses on, so bumping it forces a re-measure rather than a silent re-read.
 *
 * 2. Producer and consumer bucket differently. Then the card looks conditioned and is not.
 *    Both import this module; these checks pin the function they share.
 */
import {
  OPEN_SIZE_AXIS_VERSION, OPEN_SIZE_STEP_BB, OPEN_SIZE_MIN_BB, OPEN_SIZE_MAX_BB,
  OPEN_SIZE_BELOW, OPEN_SIZE_ABOVE, OPEN_SIZE_BUCKETS, OPEN_SIZE_LATTICE,
  openSizeBucket, openSizeRange, openSizeCentre, openConditional,
} from '../openSizeAxis.mjs';

let failed = 0;
const is = (name, got, want) => {
  const ok = Object.is(got, want);
  if (!ok) failed++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${name.padEnd(62)} got ${got} want ${want}`);
};
const ok = (name, cond, detail = '') => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'pass' : 'FAIL'}  ${name.padEnd(62)} ${detail}`);
};

console.log('the axis is frozen — editing a boundary must fail here, not silently re-bucket');
is('OPEN_SIZE_AXIS_VERSION', OPEN_SIZE_AXIS_VERSION, 1);
is('OPEN_SIZE_STEP_BB', OPEN_SIZE_STEP_BB, 0.5);
is('OPEN_SIZE_MIN_BB', OPEN_SIZE_MIN_BB, 1.5);
is('OPEN_SIZE_MAX_BB', OPEN_SIZE_MAX_BB, 6.0);
is('lattice length', OPEN_SIZE_LATTICE.length, 10);
is('lattice, as a literal', OPEN_SIZE_LATTICE.join(','), '1.5,2,2.5,3,3.5,4,4.5,5,5.5,6');
is('bucket count (lattice + two tails)', OPEN_SIZE_BUCKETS.length, 12);

console.log('\n2.5bb is its own cell — merging it into a neighbour to reach an n is the defect');
is('openSizeBucket(2.5)', openSizeBucket(2.5), 'to2.5');
ok('2.5 is not pooled into 2.0', openSizeBucket(2.5) !== 'to2.0');
ok('2.5 is not pooled into 3.0', openSizeBucket(2.5) !== 'to3.0');

console.log('\nevery lattice point lands in its own cell, and no two share one');
for (const bb of OPEN_SIZE_LATTICE) is(`openSizeBucket(${bb})`, openSizeBucket(bb), `to${bb.toFixed(1)}`);
const latticeBuckets = OPEN_SIZE_LATTICE.map(openSizeBucket);
is('distinct buckets for distinct lattice points', new Set(latticeBuckets).size, OPEN_SIZE_LATTICE.length);

console.log('\nthe axis is monotone and total — a fine sweep never goes backwards, never returns null');
let prev = -1, nonMonotone = 0, nulls = 0, unknown = 0;
for (let v = 0.05; v <= 12; v += 0.05) {
  const b = openSizeBucket(+v.toFixed(2));
  if (b == null) { nulls++; continue; }
  const idx = OPEN_SIZE_BUCKETS.indexOf(b);
  if (idx === -1) unknown++;
  if (idx < prev) nonMonotone++;
  prev = idx;
}
is('non-monotone steps over a 0.05 sweep', nonMonotone, 0);
is('null buckets for finite positive input', nulls, 0);
is('buckets outside the declared set', unknown, 0);

console.log('\nboundaries sit at the midpoints, and each side goes to a different cell');
is('openSizeBucket(2.24)', openSizeBucket(2.24), 'to2.0');
is('openSizeBucket(2.26)', openSizeBucket(2.26), 'to2.5');
is('openSizeBucket(2.74)', openSizeBucket(2.74), 'to2.5');
is('openSizeBucket(2.76)', openSizeBucket(2.76), 'to3.0');
ok('a raise to 2.7bb is counted at 2.5, not 3.0', openSizeBucket(2.7) === 'to2.5',
  'rounding is to the NEAREST lattice point; the cell records the observed mean so this stays inspectable');

console.log('\nthe tails are named and reachable — nothing is silently dropped');
is('openSizeBucket(1.0)', openSizeBucket(1.0), OPEN_SIZE_BELOW);
is('openSizeBucket(1.24)', openSizeBucket(1.24), OPEN_SIZE_BELOW);
is('openSizeBucket(1.26)', openSizeBucket(1.26), 'to1.5');
is('openSizeBucket(6.24)', openSizeBucket(6.24), 'to6.0');
is('openSizeBucket(6.26)', openSizeBucket(6.26), OPEN_SIZE_ABOVE);
is('openSizeBucket(100)', openSizeBucket(100), OPEN_SIZE_ABOVE);

console.log('\nunusable input returns null rather than a plausible-looking cell');
for (const bad of [null, undefined, NaN, Infinity, -Infinity, '3', {}]) {
  is(`openSizeBucket(${typeof bad === 'object' && bad !== null ? 'object' : String(bad)})`,
    openSizeBucket(bad), null);
}

console.log('\nranges are half-open and contiguous — no gap, no overlap');
for (const bb of OPEN_SIZE_LATTICE) {
  const [lo, hi] = openSizeRange(`to${bb.toFixed(1)}`);
  ok(`range(to${bb.toFixed(1)}) contains its centre`, lo <= bb && bb < hi, `[${lo}, ${hi})`);
}
let gaps = 0;
for (let i = 0; i < OPEN_SIZE_LATTICE.length - 1; i++) {
  const a = openSizeRange(bucketName(OPEN_SIZE_LATTICE[i]));
  const b = openSizeRange(bucketName(OPEN_SIZE_LATTICE[i + 1]));
  if (Math.abs(a[1] - b[0]) > 1e-9) gaps++;
}
is('gaps or overlaps between adjacent ranges', gaps, 0);
is('the below-tail ends where the first cell begins',
  openSizeRange(OPEN_SIZE_BELOW)[1], openSizeRange('to1.5')[0]);
is('the above-tail begins where the last cell ends',
  openSizeRange(OPEN_SIZE_ABOVE)[0], openSizeRange('to6.0')[1]);
is('the tails have no centre', openSizeCentre(OPEN_SIZE_BELOW), null);

console.log('\nthe conditioning sentence names the seat, the size, and the pot it was measured in');
const cond = openConditional({ seat: 'BB', bucket: 'to3.0', blindTotalBB: 1.5 });
ok('names the seat', /seat = BB/.test(cond), cond);
ok('names the size range', /2\.75–3\.25bb/.test(cond));
ok('names the single-raise condition', /facing exactly one raise/.test(cond));
ok('names the unopened pot', /unopened pot \(1\.5bb\)/.test(cond));

function bucketName(bb) { return `to${bb.toFixed(1)}`; }

console.log(`\n${failed ? `FAILED — ${failed} check(s)` : 'all checks passed'}`);
process.exit(failed ? 1 : 0);
