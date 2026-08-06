/**
 * probeFoldSizingResponse.mjs — WS-402 attribution instrument.
 *
 * ONE QUESTION, MEASURED. When hero raises facing a bet, the engine estimates villain's
 * fold rate TWICE over: structurally, inside `estimateFoldPct` (which prices each combo's
 * equity against `villainRequiredEquity`, a function of the actual pot geometry), and
 * behaviourally, by running the result through `logisticFoldResponse`. Both are estimates
 * of the SAME sizing response. This sweeps the raise size and prints:
 *
 *   - the STRUCTURAL response  : estimateFoldPct with this candidate's real geometry
 *   - the SHIPPED response     : the context's one-size base run through the bet curve,
 *                                on the engine's own `betSize / (pot + villainBet)` axis
 *   - the POOL's realized fold : out/fold-vs-sizing.json, facing='raise', at the axis the
 *                                curve was actually fitted on, owed / (potIncluding - owed)
 *
 * The comparison is on the SLOPE, re-anchored at a common sizing, because the levels
 * answer different questions (the pool's is a population marginal; the engine's is
 * conditioned on this range).
 *
 * Usage: node scripts/backtest/probeFoldSizingResponse.mjs
 */

import { readFileSync } from 'node:fs';
import { openLoader } from './loader.mjs';

const REPO = process.cwd();
const FROZEN_NOW = 1_700_000_000_000;
const realNow = Date.now;
const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ── pool fold-vs-sizing, facing a raise, pooled over group/street/day ────────
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

const f = (x, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : '  -  ');

const main = async () => {
  const poolFold = poolCurve();
  const loader = await openLoader(REPO);
  try {
    const { buildEvaluationContext } = await loader.load('/src/utils/exploitEngine/gameTreeContext.js');
    const { estimateFoldPct } = await loader.load('/src/utils/exploitEngine/foldEquityCalculator.js');
    const { logisticFoldResponse, FOLD_CURVE_PARAMS } = await loader.load('/src/utils/exploitEngine/villainModelData.js');
    const { parseAndEncode } = await loader.load('/src/utils/pokerCore/cardParser.js');
    const { parseRangeString } = await loader.load('/src/utils/pokerCore/rangeMatrix.js');

    const cards = (...s) => s.map(parseAndEncode);
    const bettingRange = () => parseRangeString(
      'AA,KK,QQ,JJ,TT,99,88,77,66,55,AKs,AQs,AJs,ATs,KQs,KJs,QJs,JTs,T9s,98s,87s,76s,65s,'
      + 'AKo,AQo,AJo,KQo,KJo,QJo,JTo,A5s,A4s,A3s,54s,T8s,97s,86s,K9s,Q9s,J9s');

    const SPOTS = [
      { name: 'flop A♠K♦6♠  P=100 B=65  hero 5♦4♦', board: cards('A♠', 'K♦', '6♠'), hero: cards('5♦', '4♦'), pot: 100, bet: 65 },
      { name: 'flop J♥T♥9♦  P=120 B=80  hero 3♠2♣', board: cards('J♥', 'T♥', '9♦'), hero: cards('3♠', '2♣'), pot: 120, bet: 80 },
      { name: 'turn A♠7♥2♦9♣ P=200 B=120 hero 5♦3♦', board: cards('A♠', '7♥', '2♦', '9♣'), hero: cards('5♦', '3♦'), pot: 200, bet: 120 },
    ];

    for (const s of SPOTS) {
      let rng = mulberry32(12345); Math.random = () => rng(); Date.now = () => FROZEN_NOW;
      const ctx = await buildEvaluationContext({
        villainRange: bettingRange(), board: s.board, heroCards: s.hero,
        potSize: s.pot, villainAction: 'bet', villainBet: s.bet, effectiveStack: 900,
        playerStats: { style: 'TAG', vpip: 22, pfr: 18, af: 2.5, cbet: 60 },
        villainModel: null, contextHints: { isIP: true, texture: 'unknown', posCategory: 'LATE' }, trials: 200,
      });
      Date.now = realNow;

      const P = s.pot, B = s.bet;
      const curve = FOLD_CURVE_PARAMS.TAG;
      const hints = {
        posCategory: 'LATE', isIP: true, street: ctx.street, texture: 'unknown',
        advantage: ctx.advantage, spr: ctx.spr, potSize: P, villainBet: B,
      };
      // The base the shipped path uses: one estimate, at the representative geometry
      // `villainRequiredEquity` falls back to (R = min(3B, P+2B)).
      const shippedBase = ctx.foldPct.raise;
      const R0 = Math.min(3 * B, P + 2 * B);
      const s0Correct = (R0 - B) / (P + 2 * B);

      // The fitted FACING-A-RAISE curve (scripts/foldCurve/fit-raise-curve.mjs, WS-402).
      const RAISE_CURVE = { maxDelta: 0.65, steepness: 5.625, midpoint: 0.40, steepnessUp: 8, steepnessDown: 3.25 };
      const delta = (c, frac) => logisticFoldResponse(0, frac, c.maxDelta, c.steepness, c.midpoint, c.steepnessUp, c.steepnessDown)
        || (frac < c.midpoint ? -1 : 1) * 0; // logisticFoldResponse clamps at 0 — compute the raw delta instead
      const rawDelta = (c, frac) => {
        const k = frac < c.midpoint ? (c.steepnessUp ?? c.steepness) : (c.steepnessDown ?? c.steepness);
        return (1 / (1 + Math.exp(-k * (frac - c.midpoint))) - 0.5) * c.maxDelta;
      };
      void delta;

      console.log(`\n=== ${s.name} ===`);
      console.log(`  context foldPct.raise = ${f(shippedBase)}  (computed at raise-to ${R0}, i.e. correct frac ${f(s0Correct, 3)})`);
      console.log('  raiseTo   incr | fracEngine fracTrue |  structural  shipped  reanch   pool  | shipped-pool struct-pool reanch-pool');
      const rows = [];
      for (const inc of [20, 40, 65, 100, 140, 200, 280, 400]) {
        const R = B + inc;
        const fracEngine = inc / (P + B);
        const fracTrue = inc / (P + 2 * B);
        const structural = estimateFoldPct(ctx.segmentation, 'raise',
          { style: 'TAG', vpip: 22, pfr: 18, af: 2.5, cbet: 60 }, null,
          { ...hints, heroRaiseTo: R }, ctx.comboDistribution).value;
        const shipped = logisticFoldResponse(shippedBase, fracEngine,
          curve.maxDelta, curve.steepness, curve.midpoint, curve.steepnessUp, curve.steepnessDown);
        // Re-anchored variant: correct axis, fitted RAISE curve, and the base held at the
        // sizing it was actually computed at (so the sizing response is counted ONCE).
        const reanch = Math.min(0.95, Math.max(0.02,
          shippedBase + rawDelta(RAISE_CURVE, fracTrue) - rawDelta(RAISE_CURVE, s0Correct)));
        const pool = poolFold(fracTrue);
        rows.push({ inc, fracEngine, fracTrue, structural, shipped, reanch, pool });
        console.log(`  ${String(R).padStart(6)} ${String(inc).padStart(6)} | ${f(fracEngine, 3).padStart(9)} ${f(fracTrue, 3).padStart(8)} | `
          + `${f(structural).padStart(10)} ${f(shipped).padStart(8)} ${f(reanch).padStart(7)} ${f(pool).padStart(6)} | `
          + `${(shipped - pool >= 0 ? '+' : '') + f(shipped - pool, 3)}       ${(structural - pool >= 0 ? '+' : '') + f(structural - pool, 3)}      ${(reanch - pool >= 0 ? '+' : '') + f(reanch - pool, 3)}`);
      }
      for (const k of ['shipped', 'structural', 'reanch']) {
        const mae = rows.reduce((a, r) => a + Math.abs(r[k] - r.pool), 0) / rows.length;
        const bias = rows.reduce((a, r) => a + (r[k] - r.pool), 0) / rows.length;
        console.log(`  [${k.padEnd(10)}] MAE vs pool = ${f(mae)}   bias = ${(bias >= 0 ? '+' : '') + f(bias)}`);
      }
      // Slope comparison, re-anchored at the middle row so LEVEL differences do not
      // contaminate the SHAPE comparison.
      const anchor = rows[3];
      console.log('  re-anchored at fracTrue=' + f(anchor.fracTrue, 3) + '  (delta from anchor):');
      console.log('  fracTrue |  structural  shipped     pool');
      for (const r of rows) {
        console.log(`  ${f(r.fracTrue, 3).padStart(8)} | ${f(r.structural - anchor.structural, 3).padStart(10)} `
          + `${f(r.shipped - anchor.shipped, 3).padStart(8)} ${f(r.pool - anchor.pool, 3).padStart(8)}`);
      }
    }
  } finally {
    Date.now = realNow;
    await loader.close();
  }
};

main().catch((e) => { Date.now = realNow; console.error(e); process.exit(1); });
