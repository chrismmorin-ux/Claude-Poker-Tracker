/**
 * probeRaiseBranch.mjs — WS-402 / WS-314 / hole-map S3 diagnosis instrument.
 *
 * Prints, for a fixed set of facing-a-bet spots, the FULL depth-1 EV decomposition of every
 * candidate: pFold / pCall / pRaise, each branch's EV, and each term's CONTRIBUTION to the
 * total. The question this exists to answer is which term of
 *
 *     ev = pFold*foldEV + pCall*callBranchEV + pRaise*raiseBranchEV
 *
 * is carrying the 79-point over-raise. Read the `contrib` columns, not the `ev` column.
 *
 * Also prints the composition fold estimate BEFORE and AFTER the sizing curve, because the
 * two are separately suspect: the base is calibrated at a representative raise sizing and
 * the curve then adds a sizing response on top of it.
 *
 * Usage: node scripts/backtest/probeRaiseBranch.mjs [out.json]
 */

import { writeFileSync } from 'node:fs';
import { openLoader } from './loader.mjs';

const REPO = process.cwd();

const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const FROZEN_NOW = 1_700_000_000_000;
const realNow = Date.now;

const f = (x, d = 3) => (x == null || !Number.isFinite(x) ? '   -  ' : x.toFixed(d));

const main = async () => {
  const outPath = process.argv[2] || null;
  const loader = await openLoader(REPO);
  try {
    const { evaluateGameTree } = await loader.load('/src/utils/exploitEngine/gameTreeEvaluator.js');
    const { parseAndEncode } = await loader.load('/src/utils/pokerCore/cardParser.js');
    const { parseRangeString } = await loader.load('/src/utils/pokerCore/rangeMatrix.js');

    const cards = (...strs) => {
      const encoded = strs.map(parseAndEncode);
      const bad = strs.filter((_, i) => encoded[i] < 0);
      if (bad.length) throw new Error(`unparseable card(s): ${bad.join(', ')}`);
      return encoded;
    };

    // A villain who BET the flop: a merged, mostly-continuing range. Built from named hands
    // (exploitEngine/CLAUDE.md: never from grid index literals).
    const bettingRange = () => parseRangeString(
      'AA,KK,QQ,JJ,TT,99,88,77,66,55,AKs,AQs,AJs,ATs,KQs,KJs,QJs,JTs,T9s,98s,87s,76s,65s,'
      + 'AKo,AQo,AJo,KQo,KJo,QJo,JTo,A5s,A4s,A3s,54s,T8s,97s,86s,K9s,Q9s,J9s'
    );

    const SPOTS = [
      { name: 'flop-AK6-hero-air-54s',   board: cards('A♠','K♦','6♠'), hero: cards('5♦','4♦'), pot: 100, bet: 65, stack: 900 },
      { name: 'flop-AK6-hero-gutshot-JT', board: cards('A♠','K♦','6♠'), hero: cards('J♦','T♦'), pot: 100, bet: 65, stack: 900 },
      { name: 'flop-AK6-hero-toppair-AQ', board: cards('A♠','K♦','6♠'), hero: cards('A♦','Q♦'), pot: 100, bet: 65, stack: 900 },
      { name: 'flop-AK6-POTBET-air-54s', board: cards('A♠','K♦','6♠'), hero: cards('5♦','4♦'), pot: 100, bet: 100, stack: 900 },
      { name: 'flop-AK6-OVERBET-air-54s', board: cards('A♠','K♦','6♠'), hero: cards('5♦','4♦'), pot: 100, bet: 175, stack: 900 },
      { name: 'flop-AK6-SMALLBET-air-54s', board: cards('A♠','K♦','6♠'), hero: cards('5♦','4♦'), pot: 100, bet: 30, stack: 900 },
      { name: 'flop-JT9-hero-air-32o',   board: cards('J♥','T♥','9♦'), hero: cards('3♠','2♣'), pot: 120, bet: 80, stack: 800 },
      { name: 'turn-A72-9-hero-air-53',  board: cards('A♠','7♥','2♦','9♣'), hero: cards('5♦','3♦'), pot: 200, bet: 120, stack: 600 },
      { name: 'river-A729-4-hero-air-53', board: cards('A♠','7♥','2♦','9♣','4♥'), hero: cards('5♦','3♣'), pot: 200, bet: 120, stack: 600 },
    ];

    const out = { spots: {} };

    for (const s of SPOTS) {
      let rng = mulberry32(12345);
      Math.random = () => rng();
      Date.now = () => FROZEN_NOW;
      const result = await evaluateGameTree({
        villainRange: bettingRange(),
        board: s.board,
        heroCards: s.hero,
        potSize: s.pot,
        villainAction: 'bet',
        villainBet: s.bet,
        effectiveStack: s.stack,
        playerStats: { style: 'TAG', vpip: 22, pfr: 18, af: 2.5, cbet: 60 },
        villainModel: null,
        contextHints: { isIP: true, texture: 'unknown', posCategory: 'LATE' },
        trials: 200,
        refinementBudgetMs: 0,   // DEPTH-1 ONLY — this is where the defect is claimed to live
      });
      Date.now = realNow;

      console.log(`\n=== ${s.name}   pot ${s.pot} villainBet ${s.bet}  heroEq ${f(result?.heroEquity)} ===`);
      console.log(`   foldPct.bet=${f(result?.foldPct?.bet)}  foldPct.raise=${f(result?.foldPct?.raise)}`
        + `  source=${result?.foldMeta?.raise?.source}  base=${f(result?.foldMeta?.raise?.baseEstimate)}`);
      console.log('   action        size  frac |  pFold  pCall pRaise |    foldEV    callEV   raiseEV |  cFold  cCall cRaise |     EV');
      const recs = [];
      for (const r of (result?.recommendations || [])) {
        const vr = r.villainResponse || {};
        const pF = vr.fold?.pct, pC = vr.call?.pct, pR = vr.raise?.pct;
        const eF = vr.fold?.ev, eC = vr.call?.ev, eR = vr.raise?.ev;
        const row = {
          action: r.action, betSize: r.sizing?.betSize ?? 0, betFraction: r.sizing?.betFraction ?? null,
          pFold: pF, pCall: pC, pRaise: pR, foldEV: eF, callEV: eC, raiseEV: eR,
          contribFold: pF != null ? pF * eF : null,
          contribCall: pC != null ? pC * eC : null,
          contribRaise: pR != null ? pR * eR : null,
          ev: r.ev, classification: r.classification ?? null,
          villainResponse: vr,
        };
        recs.push(row);
        console.log(
          `   ${r.action.padEnd(12)}${String(Math.round(row.betSize)).padStart(5)} ${f(row.betFraction, 2)} | `
          + `${f(pF)} ${f(pC)} ${f(pR)} | ${f(eF, 2).padStart(9)} ${f(eC, 2).padStart(9)} ${f(eR, 2).padStart(9)} | `
          + `${f(row.contribFold, 1).padStart(6)} ${f(row.contribCall, 1).padStart(6)} ${f(row.contribRaise, 1).padStart(6)} | `
          + `${f(r.ev, 2).padStart(8)}`);
      }
      out.spots[s.name] = {
        heroEquity: result?.heroEquity, foldPct: result?.foldPct, foldMeta: result?.foldMeta,
        top: result?.recommendations?.[0]?.action, recs,
      };
    }

    if (outPath) { writeFileSync(outPath, JSON.stringify(out, null, 2)); console.log(`\nWrote ${outPath}`); }
  } finally {
    Date.now = realNow;
    await loader.close();
  }
};

main().catch((e) => { Date.now = realNow; console.error(e); process.exit(1); });
