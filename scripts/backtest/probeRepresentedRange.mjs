/**
 * probeRepresentedRange.mjs — WS-403. WHAT is wrong with the represented range?
 *
 * `probeLevel.mjs` established THAT the represented range moves the fold estimate by 27-48
 * points. It does not say WHICH property of the range is wrong. This decomposes it:
 *
 *   (a) COMPOSITION — the weight share of the represented raising range by strategic
 *       bucket, against the balanced bluff share the sizing implies (§12.4). A raising
 *       range built from an equity-monotone likelihood carries no bluffs; a real one is
 *       polarised.
 *   (b) THE SEED — the docblock claims the uniform seed "carries more trash than hero's
 *       true preflop range, so the represented range is if anything WEAKER". That is a
 *       testable claim: build the same range from a real LATE-open prior and compare.
 *   (c) THE LEVEL it produces — mean villain equity vs perceived, the required equity it
 *       is divided by, and the resulting fold estimate.
 *
 * Usage: node scripts/backtest/probeRepresentedRange.mjs
 */

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

const main = async () => {
  const loader = await openLoader(process.cwd());
  try {
    const { buildEvaluationContext } = await loader.load('/src/utils/exploitEngine/gameTreeContext.js');
    const { parseAndEncode } = await loader.load('/src/utils/pokerCore/cardParser.js');
    const { parseRangeString, createRange, decodeIndex } = await loader.load('/src/utils/pokerCore/rangeMatrix.js');
    const { encodeCard } = await loader.load('/src/utils/pokerCore/cardParser.js');
    const { buildRepresentedHeroRange } = await loader.load('/src/utils/exploitEngine/heroRangeBuilder.js');
    const { classifyComboFull, narrowByBoard } = await loader.load('/src/utils/exploitEngine/postflopNarrower.js');
    const { getPopulationPrior } = await loader.load('/src/utils/rangeEngine/populationPriors.js');
    const { villainRequiredEquity } = await loader.load('/src/utils/exploitEngine/foldEquityCalculator.js');
    const { balancedBluffShare } = await loader.load('/src/utils/exploitEngine/bluffValueConstruction.js');

    const cards = (...s) => s.map(parseAndEncode);
    const villainBetRange = () => parseRangeString(
      'AA,KK,QQ,JJ,TT,99,88,77,66,55,AKs,AQs,AJs,ATs,KQs,KJs,QJs,JTs,T9s,98s,87s,76s,65s,'
      + 'AKo,AQo,AJo,KQo,KJo,QJo,JTo,A5s,A4s,A3s,54s,T8s,97s,86s,K9s,Q9s,J9s');
    const uniform = () => { const g = createRange(); for (let i = 0; i < g.length; i++) g[i] = 1; return g; };

    /** Weight share of a 169-grid by strategic bucket, over LIVE combos on this board. */
    const composition = (grid, board) => {
      const dead = new Set(board);
      const out = { nuts: 0, strong: 0, marginal: 0, draw: 0, air: 0 };
      let total = 0;
      for (let idx = 0; idx < 169; idx++) {
        const w = grid[idx];
        if (!(w > 0)) continue;
        const { rank1, rank2, suited, isPair } = decodeIndex(idx);
        const suits = isPair
          ? (() => { const o = []; for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) o.push([a, b]); return o; })()
          : suited ? [[0, 0], [1, 1], [2, 2], [3, 3]]
            : (() => { const o = []; for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (a !== b) o.push([a, b]); return o; })();
        for (const [s1, s2] of suits) {
          const c1 = encodeCard(rank1, s1); const c2 = encodeCard(rank2, s2);
          if (dead.has(c1) || dead.has(c2)) continue;
          out[classifyComboFull(c1, c2, board).bucket] += w;
          total += w;
        }
      }
      for (const k of Object.keys(out)) out[k] = total > 0 ? out[k] / total : 0;
      return { shares: out, mass: total };
    };

    const SPOTS = [
      ['flop A♠K♦6♠  P100 B65', cards('A♠', 'K♦', '6♠'), cards('5♦', '4♦'), 100, 65],
      ['flop J♥T♥9♦  P120 B80', cards('J♥', 'T♥', '9♦'), cards('3♠', '2♣'), 120, 80],
      ['turn A♠7♥2♦9♣ P200 B120', cards('A♠', '7♥', '2♦', '9♣'), cards('5♦', '3♦'), 200, 120],
    ];

    for (const [name, board, hero, pot, bet] of SPOTS) {
      const run = async (perceived) => {
        Math.random = mulberry32(12345); Date.now = () => FROZEN_NOW;
        const ctx = await buildEvaluationContext({
          villainRange: villainBetRange(), board, heroCards: hero, potSize: pot,
          villainAction: 'bet', villainBet: bet, effectiveStack: 900,
          playerStats: { style: 'TAG', vpip: 22, pfr: 18, af: 2.5, cbet: 60 },
          villainModel: null, contextHints: { isIP: true, texture: 'unknown', posCategory: 'LATE' },
          trials: 200, perceivedHeroRange: perceived,
        });
        Date.now = realNow;
        let wsum = 0, esum = 0;
        for (const c of ctx.comboDistribution?.perCombo ?? []) {
          const e = c.villainEquityVsPerceived;
          if (!Number.isFinite(e)) continue;
          wsum += c.weight; esum += c.weight * e;
        }
        return { fold: ctx.foldPct.raise, vEq: wsum > 0 ? esum / wsum : NaN };
      };

      // The three constructions.
      const shipped = buildRepresentedHeroRange({ action: 'raise', board });
      // (b) same likelihood, seeded from a real LATE open prior instead of uniform.
      const latePrior = getPopulationPrior('LATE', 'open');
      const fromRealLine = narrowByBoard(latePrior, 'raise', board, [], {});
      const flat = uniform();

      const R0 = Math.min(bet * 3, pot + bet * 2);
      const reqEq = villainRequiredEquity('raise', { potSize: pot, villainBet: bet });
      // Raise sizing as a fraction of the pot BEFORE hero's chips, which is the `s` in §12.4.
      const s = (R0 - bet) / (pot + 2 * bet);

      console.log(`\n=== ${name} ===`);
      console.log(`  canonical raise to ${R0}  |  villainRequiredEquity ${f(reqEq)}  |  sizing s=${f(s, 3)}`
        + `  balanced bluff share ${f(balancedBluffShare(s), 3)}`);

      for (const [label, grid] of [
        ['shipped (uniform seed)', shipped],
        ['seeded from LATE open ', fromRealLine],
        ['uniform, no narrowing  ', flat],
      ]) {
        const { shares } = composition(grid, board);
        const r = await run(grid === shipped ? null : grid);
        console.log(`  ${label} | nuts ${f(shares.nuts, 3)} strong ${f(shares.strong, 3)} marg ${f(shares.marginal, 3)}`
          + ` draw ${f(shares.draw, 3)} air ${f(shares.air, 3)}  ||  villainEq ${f(r.vEq)}  eqRatio ${f(r.vEq / reqEq, 3)}  fold ${f(r.fold)}`);
      }
    }
  } finally {
    Date.now = realNow;
    await loader.close();
  }
};

main().catch((e) => { Date.now = realNow; console.error(e); process.exit(1); });
