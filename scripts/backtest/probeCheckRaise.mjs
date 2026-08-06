/**
 * probeCheckRaise.mjs — WS-314 / WS-402 shared-root test.
 *
 * Reproduces the WS-314 measurement verbatim (A♠K♦6♠ two-tone, villain top-25%, hero OOP,
 * checked to hero) and prints the check-raise branch decomposition beside the best bet and
 * the plain check, so the question "is the check-raise over-credited by the same fold-branch
 * defect as the raise?" can be answered rather than assumed.
 *
 * Usage: node scripts/backtest/probeCheckRaise.mjs
 */

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
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '  -  ');

const main = async () => {
  const loader = await openLoader(REPO);
  try {
    const { evaluateGameTree } = await loader.load('/src/utils/exploitEngine/gameTreeEvaluator.js');
    const { parseAndEncode } = await loader.load('/src/utils/pokerCore/cardParser.js');
    const { topRange } = await loader.load('/src/utils/exploitEngine/__tests__/fixtures/ranges.js');
    const cards = (...s) => s.map(parseAndEncode);

    const board = cards('A♠', 'K♦', '6♠');
    const HEROES = [
      ['J♦T♦ gutshot', cards('J♦', 'T♦')],
      ['8♦8♣ small pair', cards('8♦', '8♣')],
      ['5♦4♦ pure air', cards('5♦', '4♦')],
      ['A♦Q♦ top pair', cards('A♦', 'Q♦')],
    ];

    for (const [label, hero] of HEROES) {
      let rng = mulberry32(12345); Math.random = () => rng(); Date.now = () => FROZEN_NOW;
      const r = await evaluateGameTree({
        villainRange: topRange(25), board, heroCards: hero,
        potSize: 100, villainAction: null, villainBet: 0, effectiveStack: 900,
        playerStats: { style: 'TAG', vpip: 22, pfr: 18, af: 2.5, cbet: 60 },
        villainModel: null,
        contextHints: { isIP: false, texture: 'unknown', posCategory: 'LATE' },
        trials: 200, refinementBudgetMs: 0,
      });
      Date.now = realNow;
      const recs = r?.recommendations || [];
      const top = recs[0];
      const cr = recs.find(x => x.action === 'check-raise');
      const bet = recs.find(x => x.action === 'bet');
      const chk = recs.find(x => x.action === 'check');
      console.log(`\n${label}  heroEq ${f(r?.heroEquity, 3)}   TOP = ${top?.action} (${f(top?.ev)})`);
      console.log(`   check-raise ${f(cr?.ev).padStart(8)}   bet ${f(bet?.ev).padStart(8)}   check ${f(chk?.ev).padStart(8)}`);
      if (cr) {
        const v = cr.villainResponse || {};
        console.log(`   CR branches: villainChecks p=${f(v.villainChecks?.pct, 3)} ev=${f(v.villainChecks?.ev)}`
          + ` | betsThenFolds p=${f(v.villainBetsThenFolds?.pct, 3)} ev=${f(v.villainBetsThenFolds?.ev)}`
          + ` | betsThenCalls p=${f(v.villainBetsThenCalls?.pct, 3)} ev=${f(v.villainBetsThenCalls?.ev)}`
          + ` | foldToCR=${f(v.foldPct, 3)}`);
        const contribCheck = (v.villainChecks?.pct ?? 0) * (v.villainChecks?.ev ?? 0);
        const contribFold = (v.villainBetsThenFolds?.pct ?? 0) * (v.villainBetsThenFolds?.ev ?? 0);
        const contribCall = (v.villainBetsThenCalls?.pct ?? 0) * (v.villainBetsThenCalls?.ev ?? 0);
        console.log(`   contributions: checkBack ${f(contribCheck)}  foldToCR ${f(contribFold)}  callCR ${f(contribCall)}`
          + `   sum ${f(contribCheck + contribFold + contribCall)}  crSize ${f(cr.sizing?.betSize)}`);
      }
      if (bet) {
        const v = bet.villainResponse || {};
        console.log(`   BET branches: fold p=${f(v.fold?.pct, 3)} ev=${f(v.fold?.ev)}`
          + ` | call p=${f(v.call?.pct, 3)} ev=${f(v.call?.ev)} | raise p=${f(v.raise?.pct, 3)} ev=${f(v.raise?.ev)}`
          + `  size ${f(bet.sizing?.betSize)}`);
      }
    }
  } finally {
    Date.now = realNow;
    await loader.close();
  }
};
main().catch(e => { Date.now = realNow; console.error(e); process.exit(1); });
