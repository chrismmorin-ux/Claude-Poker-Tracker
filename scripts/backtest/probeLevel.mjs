/**
 * probeLevel.mjs — WS-402. How much of the fold estimate's LEVEL is the represented range?
 *
 * WS-402 fixed the SHAPE of the depth-1 fold estimate (the axis the curve is read on, the
 * curve for the action, and the anchor the base is moved from). A residual level error
 * survived it, largest on the turn. This isolates the cause by holding EVERYTHING else fixed
 * and swapping only `perceivedHeroRange` — the range villain's equity is measured against,
 * and therefore the thing that decides how often villain is modelled as folding.
 *
 * WS-403 — READ THE SPREAD AS A SENSITIVITY, NOT AS AN ERROR. The last column is an
 * un-narrowed uniform grid: "hero represents nothing at all". That is the NULL, not hero's
 * true range, so `shipped − flat` measures how load-bearing this input is and says nothing
 * about whether the shipped value is wrong. It was read as the latter, and two conclusions
 * were drawn from it that do not survive checking — that the represented range is too strong,
 * and that `buildRepresentedHeroRange`'s docblock asserts the opposite bias to the measured
 * one. `probeRepresentedRange.mjs` compares the shipped construction against hero's REAL
 * preflop line, which is the comparison the docblock's claim is actually about, and finds the
 * claim correct in direction. See exploitEngine/CLAUDE.md and POKER_THEORY §11.1c.
 *
 * Shipped behaviour is the first column:
 * facing a bet, `gameTreeContext` builds `buildRepresentedHeroRange({ action: 'raise' })`,
 * because raise is the one aggressive action reachable at that node.
 *
 * Measured 2026-08-05 (pool fold-to-raise at the matching anchor is ~0.47-0.49 on all three):
 *
 *   flop A♠K♦6♠   0.489 / 0.359 / 0.331 / 0.221
 *   flop J♥T♥9♦   0.535 / 0.275 / 0.238 / 0.212
 *   turn A♠7♥2♦9♣ 0.713 / 0.406 / 0.310 / 0.237
 *
 * Usage: node scripts/backtest/probeLevel.mjs
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

const main = async () => {
  const loader = await openLoader(process.cwd());
  try {
    const { buildEvaluationContext } = await loader.load('/src/utils/exploitEngine/gameTreeContext.js');
    const { parseAndEncode } = await loader.load('/src/utils/pokerCore/cardParser.js');
    const { parseRangeString, createRange } = await loader.load('/src/utils/pokerCore/rangeMatrix.js');
    const { buildRepresentedHeroRange } = await loader.load('/src/utils/exploitEngine/heroRangeBuilder.js');

    const cards = (...s) => s.map(parseAndEncode);
    const villainBetRange = () => parseRangeString(
      'AA,KK,QQ,JJ,TT,99,88,77,66,55,AKs,AQs,AJs,ATs,KQs,KJs,QJs,JTs,T9s,98s,87s,76s,65s,'
      + 'AKo,AQo,AJo,KQo,KJo,QJo,JTo,A5s,A4s,A3s,54s,T8s,97s,86s,K9s,Q9s,J9s');
    const uniform = () => { const g = createRange(); for (let i = 0; i < g.length; i++) g[i] = 1; return g; };

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
        return ctx.foldPct.raise;
      };
      const shipped = await run(null);                                            // represents a RAISE
      const asBet = await run(buildRepresentedHeroRange({ action: 'bet', board }));
      const asCall = await run(buildRepresentedHeroRange({ action: 'call', board }));
      const flat = await run(uniform());                                          // represents NOTHING
      console.log(`${name}\n  represented=RAISE (shipped) ${shipped.toFixed(4)}`
        + `   BET ${asBet.toFixed(4)}   CALL ${asCall.toFixed(4)}   NOTHING ${flat.toFixed(4)}`
        + `   spread ${(shipped - flat).toFixed(4)}`);
    }
  } finally {
    Date.now = realNow;
    await loader.close();
  }
};

main().catch((e) => { Date.now = realNow; console.error(e); process.exit(1); });
