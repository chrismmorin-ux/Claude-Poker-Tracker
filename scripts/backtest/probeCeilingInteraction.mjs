/**
 * probeCeilingInteraction.mjs — WS-403. Is the [0.10, 0.80] truncation compensating for the
 * represented range, or for something else?
 *
 * WS-402 recorded a hypothesis it could not test in the time it had: raising
 * `CONTINUE_PROB_CEILING` alone flips both flop spots from over-folding to under-folding while
 * the turn stays high, and it read that as "the truncation has been compensating for an
 * over-strong represented range".
 *
 * That hypothesis makes a FALSIFIABLE prediction. If the truncation compensates for the
 * represented range, then weakening the represented range must change what lifting the ceiling
 * does — the flip to under-folding should shrink or reverse. If lifting the ceiling subtracts
 * the SAME amount of fold no matter which range hero is taken to represent, the two are
 * independent and the compensation story is wrong.
 *
 * So this is a 2x2 (and then some): {represented range} x {continue-probability ceiling}, with
 * the fold estimate recomputed from the SAME per-combo distribution each time.
 *
 * The fold arithmetic is re-implemented here rather than called, because the ceiling is a
 * default of `scaledLogistic` and is not a parameter of `estimateFoldPct`. The shipped
 * configuration is printed alongside `ctx.foldPct.raise` so the re-implementation is checked
 * against the engine rather than trusted.
 *
 * Usage: node scripts/backtest/probeCeilingInteraction.mjs
 */

import { readFileSync } from 'node:fs';
import { openLoader } from './loader.mjs';

const FROZEN_NOW = 1_700_000_000_000;
const realNow = Date.now;
const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const f = (x, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : '  -  ');
const sig = (x) => 1 / (1 + Math.exp(-x));

/** Pool fold-to-raise on the fitted axis, pooled over group/street/day (as probeFoldSizingResponse). */
const poolCurve = () => {
  const raw = JSON.parse(readFileSync('out/fold-vs-sizing.json', 'utf8'));
  const agg = new Map();
  for (const [k, v] of Object.entries(raw.cells)) {
    const [, , , , facing, bin] = k.split('|');
    if (facing !== 'raise' || +bin < 0) continue;
    let b = agg.get(+bin);
    if (!b) { b = { n: 0, folds: 0, sumFrac: 0 }; agg.set(+bin, b); }
    b.n += v.n; b.folds += v.folds; b.sumFrac += v.sumFrac;
  }
  const pts = [...agg.entries()].map(([bin, b]) => ({ bin, frac: b.sumFrac / b.n, fold: b.folds / b.n, n: b.n }))
    .filter(p => p.n >= 300).sort((a, b) => a.frac - b.frac);
  return (frac) => {
    if (frac <= pts[0].frac) return pts[0].fold;
    for (let i = 1; i < pts.length; i++) {
      if (frac <= pts[i].frac) {
        const t = (frac - pts[i - 1].frac) / (pts[i].frac - pts[i - 1].frac);
        return pts[i - 1].fold + t * (pts[i].fold - pts[i - 1].fold);
      }
    }
    return pts[pts.length - 1].fold;
  };
};

const main = async () => {
  const poolFold = poolCurve();
  const loader = await openLoader(process.cwd());
  try {
    const { buildEvaluationContext } = await loader.load('/src/utils/exploitEngine/gameTreeContext.js');
    const { parseAndEncode, encodeCard, cardRank } = await loader.load('/src/utils/pokerCore/cardParser.js');
    const { parseRangeString, createRange, decodeIndex } = await loader.load('/src/utils/pokerCore/rangeMatrix.js');
    const { buildRepresentedHeroRange } = await loader.load('/src/utils/exploitEngine/heroRangeBuilder.js');
    const {
      classifyComboFull, computeComboEquity, DEFAULT_CONTINUATION_RATES, ACTION_TAU_FRACTION,
    } = await loader.load('/src/utils/exploitEngine/postflopNarrower.js');
    const { softContinuationWeights } = await loader.load('/src/utils/pokerCore/softWeights.js');
    const { villainRequiredEquity } = await loader.load('/src/utils/exploitEngine/foldEquityCalculator.js');
    const { balancedBluffShare } = await loader.load('/src/utils/exploitEngine/bluffValueConstruction.js');

    const cards = (...s) => s.map(parseAndEncode);
    const villainBetRange = () => parseRangeString(
      'AA,KK,QQ,JJ,TT,99,88,77,66,55,AKs,AQs,AJs,ATs,KQs,KJs,QJs,JTs,T9s,98s,87s,76s,65s,'
      + 'AKo,AQo,AJo,KQo,KJo,QJo,JTo,A5s,A4s,A3s,54s,T8s,97s,86s,K9s,Q9s,J9s');
    const uniform = () => { const g = createRange(); for (let i = 0; i < g.length; i++) g[i] = 1; return g; };

    /** Enumerate every live combo on `board` with the equity narrowByBoard scores it on. */
    const liveCombos = (board) => {
      const street = board.length >= 5 ? 'river' : board.length >= 4 ? 'turn' : 'flop';
      const boardRanks = board.map(cardRank).sort((a, b) => b - a);
      const dead = new Set(board);
      const out = [];
      for (let idx = 0; idx < 169; idx++) {
        const { rank1, rank2, suited, isPair } = decodeIndex(idx);
        const suits = isPair
          ? (() => { const o = []; for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) o.push([a, b]); return o; })()
          : suited ? [[0, 0], [1, 1], [2, 2], [3, 3]]
            : (() => { const o = []; for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (a !== b) o.push([a, b]); return o; })();
        for (const [s1, s2] of suits) {
          const c1 = encodeCard(rank1, s1); const c2 = encodeCard(rank2, s2);
          if (dead.has(c1) || dead.has(c2)) continue;
          const info = classifyComboFull(c1, c2, board, null);
          const hr = [rank1, rank2].sort((a, b) => b - a);
          out.push({ idx, equity: computeComboEquity(info.category, hr, boardRanks, info.totalEquityOuts, street) });
        }
      }
      return out;
    };

    /**
     * A POLARISED raising range: value at the top by equity, bluffs at the BOTTOM, and the
     * bluff share set by villain's indifference at this sizing (§12.4, `balancedBluffShare`)
     * rather than chosen. Nothing is tuned — the two mean-pinned narrowings sum to the same
     * `DEFAULT_CONTINUATION_RATES.raise` the shipped construction uses.
     */
    const polarisedRaiseRange = (board, sizing) => {
      const combos = liveCombos(board);
      const rate = DEFAULT_CONTINUATION_RATES.raise;
      const b = balancedBluffShare(sizing);
      const tau = ACTION_TAU_FRACTION.raise;
      const up = softContinuationWeights(combos.map(c => c.equity), rate * (1 - b), { tauFraction: tau, floor: 1e-6 });
      const dn = softContinuationWeights(combos.map(c => -c.equity), rate * b, { tauFraction: tau, floor: 1e-6 });
      const cellW = new Float64Array(169); const cellN = new Float64Array(169);
      for (let i = 0; i < combos.length; i++) { cellW[combos[i].idx] += up[i] + dn[i]; cellN[combos[i].idx]++; }
      const g = createRange();
      for (let i = 0; i < 169; i++) if (cellN[i] > 0) g[i] = cellW[i] / cellN[i];
      return g;
    };

    const SPOTS = [
      ['flop A♠K♦6♠  P100 B65', cards('A♠', 'K♦', '6♠'), cards('5♦', '4♦'), 100, 65],
      ['flop J♥T♥9♦  P120 B80', cards('J♥', 'T♥', '9♦'), cards('3♠', '2♣'), 120, 80],
      ['turn A♠7♥2♦9♣ P200 B120', cards('A♠', '7♥', '2♦', '9♣'), cards('5♦', '3♦'), 200, 120],
    ];

    const CEILINGS = [[0.10, 0.70], [0.10, 0.86], [0.014, 0.972]]; // [floor, scale] -> ceiling .80/.96/.986

    for (const [name, board, hero, pot, bet] of SPOTS) {
      const R0 = Math.min(bet * 3, pot + bet * 2);
      const s0 = (R0 - bet) / (pot + 2 * bet);
      const reqEq = villainRequiredEquity('raise', { potSize: pot, villainBet: bet });

      const ARMS = [
        ['shipped  (equity-monotone)', null],
        ['polarised (balanced bluffs)', polarisedRaiseRange(board, s0)],
        ['uniform  (represents none)', uniform()],
      ];

      console.log(`\n=== ${name} ===   raise to ${R0}, fitted-axis s=${f(s0, 3)}, `
        + `required eq ${f(reqEq, 3)}, pool fold ${f(poolFold(s0), 3)}`);
      console.log('  represented range           | engine  | ceiling .800  .960  .986  |  d(.986-.800)');

      for (const [label, grid] of ARMS) {
        Math.random = mulberry32(12345); Date.now = () => FROZEN_NOW;
        const ctx = await buildEvaluationContext({
          villainRange: villainBetRange(), board, heroCards: hero, potSize: pot,
          villainAction: 'bet', villainBet: bet, effectiveStack: 900,
          playerStats: { style: 'TAG', vpip: 22, pfr: 18, af: 2.5, cbet: 60 },
          villainModel: null, contextHints: { isIP: true, texture: 'unknown', posCategory: 'LATE' },
          trials: 200, perceivedHeroRange: grid,
        });
        Date.now = realNow;

        // Re-implement estimateFoldPct's per-combo branch at an arbitrary ceiling.
        const foldAt = (floor, scale) => {
          let fs = 0, tw = 0;
          for (const c of ctx.comboDistribution?.perCombo ?? []) {
            const vEq = Number.isFinite(c.villainEquityVsPerceived) ? c.villainEquityVsPerceived : (1 - c.heroEquity);
            const r = reqEq > 0 ? vEq / reqEq : 1;
            fs += c.weight * (1 - (floor + sig(4 * (r - 1)) * scale));
            tw += c.weight;
          }
          return tw > 0 ? fs / tw : NaN;
        };
        const vals = CEILINGS.map(([fl, sc]) => foldAt(fl, sc));
        console.log(`  ${label.padEnd(27)} | ${f(ctx.foldPct.raise)} | `
          + vals.map(v => f(v)).join(' ')
          + `  |  ${(vals[2] - vals[0] >= 0 ? '+' : '') + f(vals[2] - vals[0])}`);
      }
    }
  } finally {
    Date.now = realNow;
    await loader.close();
  }
};

main().catch((e) => { Date.now = realNow; console.error(e); process.exit(1); });
