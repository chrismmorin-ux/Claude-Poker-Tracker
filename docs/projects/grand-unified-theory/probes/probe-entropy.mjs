/**
 * AS-GUT-4 probe — does range entropy separate morphology classes,
 * and does it decrease monotonically across streets?
 *
 * Two distinct entropies, because they measure different things:
 *   H_combo — over normalised combo weights. Measures how DEFINED a range is.
 *   H_type  — over the 22-class hand-type share vector. Measures morphology dispersion.
 *
 * Prediction to test: H_type separates capped/condensed (low, mass concentrated)
 * from linear (high, mass spread) but CANNOT distinguish polarized from linear,
 * because entropy is permutation-invariant over classes — it cannot see that
 * "strong" and "air" sit at opposite ends of an ordered strength axis.
 */

import { archetypeRangeFor, listArchetypeContexts } from '/home/user/Claude-Poker-Tracker/src/utils/postflopDrillContent/archetypeRanges.js';
import { handTypeBreakdown } from '/home/user/Claude-Poker-Tracker/src/utils/postflopDrillContent/handTypeBreakdown.js';
import { RANGE_MORPHOLOGY } from '/home/user/Claude-Poker-Tracker/src/utils/postflopDrillContent/frameworks.js';
import { enumerateCombos } from '/home/user/Claude-Poker-Tracker/src/utils/pokerCore/rangeMatrix.js';
import { analyzeBoardTexture } from '/home/user/Claude-Poker-Tracker/src/utils/pokerCore/boardTexture.js';
import { encodeCard } from '/home/user/Claude-Poker-Tracker/src/utils/pokerCore/cardParser.js';

const card = (r, s) => encodeCard(r, s);

// A spread of real flop textures. [rank, suit]; rank 0=2 .. 12=A
const BOARDS = {
  'K72r':   [card(11,0), card(5,1), card(0,2)],
  'A72r':   [card(12,0), card(5,1), card(0,2)],
  'JT9ss':  [card(9,0),  card(8,0), card(7,1)],
  '876ss':  [card(6,0),  card(5,0), card(4,1)],
  'QJTmono':[card(10,0), card(9,0), card(8,0)],
  '774ss':  [card(5,0),  card(5,1), card(2,0)],
  '885r':   [card(6,0),  card(6,1), card(3,2)],
  'AK5ss':  [card(12,0), card(11,0), card(3,1)],
  '654r':   [card(4,0),  card(3,1), card(2,2)],
  'T55r':   [card(8,0),  card(3,1), card(3,2)],
  'Q83ss':  [card(10,0), card(6,0), card(1,1)],
  '932r':   [card(7,0),  card(1,1), card(0,2)],
};

const shannon = (weights) => {
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return 0;
  let h = 0;
  for (const w of weights) {
    if (w <= 0) continue;
    const p = w / total;
    h -= p * Math.log2(p);
  }
  return h;
};

const hCombo = (range, board) => {
  const combos = enumerateCombos(range, board);
  return { h: shannon(combos.map(c => c.weight)), n: combos.length };
};

const hType = (bd) => {
  // Share vector over the 22 hand-type classes.
  const shares = Object.values(bd.handTypes).map(t => t.pct);
  return shannon(shares);
};

// ── Part 1: separation across morphology classes ──────────────────────

const rows = [];
const contexts = listArchetypeContexts();

for (const ctx of contexts) {
  const range = archetypeRangeFor(ctx);
  if (!range) continue;
  for (const [boardName, board] of Object.entries(BOARDS)) {
    const tx = analyzeBoardTexture(board);
    let bd;
    try {
      bd = handTypeBreakdown(range, board, tx);
    } catch { continue; }
    const match = RANGE_MORPHOLOGY.applies({ range, board });
    if (!match) continue;
    const { h: hc, n } = hCombo(range, board);
    rows.push({
      ctx: `${ctx.position} ${ctx.action}${ctx.vs ? ' vs ' + ctx.vs : ''}`,
      board: boardName,
      morph: match.subcase,
      hType: hType(bd),
      hCombo: hc,
      combos: n,
    });
  }
}

const byMorph = {};
for (const r of rows) {
  (byMorph[r.morph] ||= []).push(r);
}

const stats = (xs) => {
  const n = xs.length;
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  const sorted = [...xs].sort((a, b) => a - b);
  return { n, mean, sd, min: sorted[0], max: sorted[n - 1] };
};

console.log('='.repeat(74));
console.log('AS-GUT-4 · PART 1 — does entropy separate morphology classes?');
console.log(`sample: ${rows.length} (range × board) pairs from ${contexts.length} real archetype ranges × ${Object.keys(BOARDS).length} flops`);
console.log('='.repeat(74));
console.log();
console.log('H_type — entropy over the 22 hand-type class shares (bits)');
console.log('morphology     n     mean     sd      min      max');
for (const [m, rs] of Object.entries(byMorph)) {
  const s = stats(rs.map(r => r.hType));
  console.log(
    `${m.padEnd(13)} ${String(s.n).padStart(3)}   ${s.mean.toFixed(3)}   ${s.sd.toFixed(3)}   ${s.min.toFixed(3)}   ${s.max.toFixed(3)}`
  );
}
console.log();
console.log('H_combo — entropy over normalised combo weights (bits)');
console.log('morphology     n     mean     sd      min      max');
for (const [m, rs] of Object.entries(byMorph)) {
  const s = stats(rs.map(r => r.hCombo));
  console.log(
    `${m.padEnd(13)} ${String(s.n).padStart(3)}   ${s.mean.toFixed(3)}   ${s.sd.toFixed(3)}   ${s.min.toFixed(3)}   ${s.max.toFixed(3)}`
  );
}

// Pairwise separation: Cohen's d on H_type, and overlap of [min,max] ranges.
console.log();
console.log('Pairwise separation on H_type (Cohen\'s d, and whether ranges overlap)');
const keys = Object.keys(byMorph);
for (let i = 0; i < keys.length; i++) {
  for (let j = i + 1; j < keys.length; j++) {
    const a = stats(byMorph[keys[i]].map(r => r.hType));
    const b = stats(byMorph[keys[j]].map(r => r.hType));
    const pooled = Math.sqrt((a.sd ** 2 + b.sd ** 2) / 2);
    const d = pooled > 0 ? Math.abs(a.mean - b.mean) / pooled : Infinity;
    const overlap = a.min <= b.max && b.min <= a.max;
    const verdict = d >= 0.8 && !overlap ? 'SEPARATES' : d >= 0.8 ? 'shifted, overlapping' : 'NO separation';
    console.log(`  ${keys[i].padEnd(10)} vs ${keys[j].padEnd(10)}  d=${d.toFixed(2).padStart(6)}  ${verdict}`);
  }
}

// ── Part 2: the ordering-blindness test ───────────────────────────────
// Entropy is permutation-invariant. Build two share vectors with IDENTICAL
// entropy but opposite morphology, to demonstrate the limitation concretely.

console.log();
console.log('='.repeat(74));
console.log('AS-GUT-4 · PART 2 — is entropy blind to strength ORDERING?');
console.log('='.repeat(74));

// Ordered strength axis, strongest → weakest, 8 buckets.
const polarized = [0.30, 0.05, 0.02, 0.01, 0.01, 0.02, 0.05, 0.54]; // mass at both ends
const condensed = [0.01, 0.02, 0.05, 0.30, 0.54, 0.05, 0.02, 0.01]; // mass in the middle
// Same multiset of values, different positions → identical entropy by construction.
const shuffled  = [0.54, 0.30, 0.05, 0.05, 0.02, 0.02, 0.01, 0.01]; // monotone / linear

console.log(`H(polarized mass-at-ends)  = ${shannon(polarized).toFixed(4)} bits`);
console.log(`H(condensed mass-in-middle)= ${shannon(condensed).toFixed(4)} bits`);
console.log(`H(linear monotone decay)   = ${shannon(shuffled).toFixed(4)} bits`);
console.log();
console.log('All three are the same multiset of shares in different positions on the');
console.log('strength axis. Entropy cannot tell them apart. Polarization is a claim');
console.log('about WHERE the mass sits, not how spread it is.');

// The measure that DOES see ordering: variance about the mean strength index.
const spread = (shares) => {
  const total = shares.reduce((s, x) => s + x, 0);
  const p = shares.map(x => x / total);
  const mean = p.reduce((s, x, i) => s + x * i, 0);
  const varr = p.reduce((s, x, i) => s + x * (i - mean) ** 2, 0);
  // 4th standardised moment — kurtosis. Bimodal (polarized) runs LOW.
  const m4 = p.reduce((s, x, i) => s + x * (i - mean) ** 4, 0);
  return { mean, sd: Math.sqrt(varr), kurtosis: varr > 0 ? m4 / varr ** 2 : 0 };
};

console.log();
console.log('Same three vectors under an order-aware statistic:');
console.log('vector       mean-idx    sd      kurtosis');
for (const [name, v] of [['polarized', polarized], ['condensed', condensed], ['linear', shuffled]]) {
  const s = spread(v);
  console.log(`${name.padEnd(12)} ${s.mean.toFixed(3)}   ${s.sd.toFixed(3)}   ${s.kurtosis.toFixed(3)}`);
}
console.log();
console.log('sd and kurtosis DO separate them. Bimodal polarized → high sd, low kurtosis.');
console.log('Condensed → low sd. Linear → intermediate sd, monotone.');
