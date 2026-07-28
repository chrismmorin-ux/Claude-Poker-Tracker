/**
 * AS-GUT-7 probe, round 2 — founder hypothesis (2026-07-28).
 *
 * Founder's point: my first morphology probe classified ARCHETYPE PREFLOP RANGES
 * projected onto a flop. No postflop action had been applied. Polarization is
 * CREATED by betting action (the bet splits value from bluffs; the check keeps the
 * middle) — so a pre-action range should not be polarized, and finding only 5.5%
 * polarized was measuring the wrong node, not a mis-tuned classifier.
 *
 * He also observed that a "range c-bet" or "range check" does no range filtering
 * at all, which is exactly what narrowByBoard's continuationRate parameterises.
 *
 * This probe applies real action narrowing and re-measures. Four conditions per
 * (range x board):
 *   raw          — no action applied (what round 1 measured)
 *   bet @ 0.40   — engine default DEFAULT_CONTINUATION_RATES.bet
 *   bet @ 0.95   — a "range bet": keep essentially everything (his scenario)
 *   check @ 0.65 — engine default DEFAULT_CONTINUATION_RATES.check
 *
 * Two statistics per condition:
 *   morphology  — the real RANGE_MORPHOLOGY classifier's verdict
 *   kurtosis    — 4th standardised moment on the ORDERED strength axis
 *                 (HAND_TYPES is declared strongest -> weakest, so index is the
 *                 axis). Bimodal/polarized runs LOW; concentrated runs HIGH.
 *                 This is the AS-GUT-6 statistic that replaced entropy.
 */

import { archetypeRangeFor, listArchetypeContexts } from '/home/user/Claude-Poker-Tracker/src/utils/postflopDrillContent/archetypeRanges.js';
import { handTypeBreakdown, HAND_TYPES } from '/home/user/Claude-Poker-Tracker/src/utils/postflopDrillContent/handTypeBreakdown.js';
import { RANGE_MORPHOLOGY } from '/home/user/Claude-Poker-Tracker/src/utils/postflopDrillContent/frameworks.js';
import { narrowByBoard } from '/home/user/Claude-Poker-Tracker/src/utils/exploitEngine/postflopNarrower.js';
import { analyzeBoardTexture } from '/home/user/Claude-Poker-Tracker/src/utils/pokerCore/boardTexture.js';
import { encodeCard } from '/home/user/Claude-Poker-Tracker/src/utils/pokerCore/cardParser.js';

const card = (r, s) => encodeCard(r, s);

const BOARDS = {
  'K72r':    [card(11, 0), card(5, 1), card(0, 2)],
  'A72r':    [card(12, 0), card(5, 1), card(0, 2)],
  'JT9ss':   [card(9, 0), card(8, 0), card(7, 1)],
  '876ss':   [card(6, 0), card(5, 0), card(4, 1)],
  'QJTmono': [card(10, 0), card(9, 0), card(8, 0)],
  '774ss':   [card(5, 0), card(5, 1), card(2, 0)],
  '885r':    [card(6, 0), card(6, 1), card(3, 2)],
  'AK5ss':   [card(12, 0), card(11, 0), card(3, 1)],
  '654r':    [card(4, 0), card(3, 1), card(2, 2)],
  'T55r':    [card(8, 0), card(3, 1), card(3, 2)],
};

// Ordered strength axis: index into HAND_TYPES (declared strongest -> weakest).
const strengthMoments = (bd) => {
  const p = HAND_TYPES.map(ht => bd.handTypes[ht].pct);
  const total = p.reduce((s, x) => s + x, 0);
  if (total <= 0) return null;
  const q = p.map(x => x / total);
  const mean = q.reduce((s, x, i) => s + x * i, 0);
  const varr = q.reduce((s, x, i) => s + x * (i - mean) ** 2, 0);
  if (varr <= 0) return { mean, sd: 0, kurtosis: 0 };
  const m4 = q.reduce((s, x, i) => s + x * (i - mean) ** 4, 0);
  return { mean, sd: Math.sqrt(varr), kurtosis: m4 / varr ** 2 };
};

const CONDITIONS = [
  { key: 'raw',        apply: (r) => r },
  { key: 'bet @0.40',  apply: (r, b, tx) => narrowByBoard(r, 'bet',   b, [], { boardTexture: tx, continuationRate: 0.40 }) },
  { key: 'bet @0.95',  apply: (r, b, tx) => narrowByBoard(r, 'bet',   b, [], { boardTexture: tx, continuationRate: 0.95 }) },
  { key: 'check@0.65', apply: (r, b, tx) => narrowByBoard(r, 'check', b, [], { boardTexture: tx, continuationRate: 0.65 }) },
];

const acc = {};
for (const c of CONDITIONS) acc[c.key] = { morph: {}, kurt: [], sd: [], meanIdx: [] };

let pairs = 0;
for (const ctx of listArchetypeContexts()) {
  const base = archetypeRangeFor(ctx);
  if (!base) continue;
  for (const board of Object.values(BOARDS)) {
    const tx = analyzeBoardTexture(board);
    for (const cond of CONDITIONS) {
      let r;
      try { r = cond.apply(base, board, tx); } catch { continue; }
      let bd, match;
      try {
        bd = handTypeBreakdown(r, board, tx);
        match = RANGE_MORPHOLOGY.applies({ range: r, board });
      } catch { continue; }
      if (!match) continue;
      const a = acc[cond.key];
      a.morph[match.subcase] = (a.morph[match.subcase] || 0) + 1;
      const m = strengthMoments(bd);
      if (m) { a.kurt.push(m.kurtosis); a.sd.push(m.sd); a.meanIdx.push(m.mean); }
    }
    pairs++;
  }
}

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);

console.log('='.repeat(80));
console.log('AS-GUT-7 round 2 — does morphology change once ACTION narrowing is applied?');
console.log(`sample: ${pairs} (range x board) pairs x ${CONDITIONS.length} conditions`);
console.log('='.repeat(80));
console.log();

const MORPHS = ['capped', 'condensed', 'linear', 'polarized'];
console.log('Morphology distribution by condition (% of classified pairs)');
console.log('condition     ' + MORPHS.map(m => m.padStart(11)).join('') + '        n');
for (const c of CONDITIONS) {
  const a = acc[c.key];
  const n = Object.values(a.morph).reduce((s, x) => s + x, 0);
  const cells = MORPHS.map(m => {
    const v = a.morph[m] || 0;
    return `${(v / n * 100).toFixed(1)}%`.padStart(11);
  }).join('');
  console.log(`${c.key.padEnd(13)} ${cells}   ${String(n).padStart(6)}`);
}

console.log();
console.log('Ordered-strength-axis moments (AS-GUT-6 statistic)');
console.log('condition       mean-idx      sd   kurtosis   <- LOW kurtosis = bimodal/polarized');
for (const c of CONDITIONS) {
  const a = acc[c.key];
  console.log(
    `${c.key.padEnd(13)} ${mean(a.meanIdx).toFixed(2).padStart(9)} ${mean(a.sd).toFixed(3).padStart(7)} ${mean(a.kurt).toFixed(3).padStart(10)}`
  );
}

console.log();
console.log('='.repeat(80));
console.log('What narrowByBoard actually does (postflopNarrower.js:690-720)');
console.log('='.repeat(80));
console.log(`
  Step 2: sort all live combos by equity DESCENDING
  Step 4: for bet / call / raise  -> keep the TOP  continuationRate fraction
          for check               -> keep the BOTTOM fraction + top 10% as traps

  So a modelled BET range is a pure top-slice of the equity distribution. It has
  no lower arm. Pure air can never be in a villain's betting range at any
  continuationRate < 1 — draws enter only because the sort key is total equity
  (semi-bluffs yes, pure bluffs never).

  The only bimodal range the model can produce is the CHECK range, because check
  is the one action that keeps the bottom AND a top trapping slice.

  POKER_THEORY.md 3.6 states: "Bet: Removes weak hands (would check). Range is
  value + bluffs." The implementation delivers value-only. Polarized betting is
  structurally unrepresentable; a range bet (continuationRate -> 1) IS
  representable, and reduces to the unfiltered range as the founder predicted.
`);
