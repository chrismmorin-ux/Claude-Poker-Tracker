#!/usr/bin/env node
/**
 * probe-depth2-reach.mjs — WS-482. Does depth-2/3 actually RUN?
 *
 * The paired before/after for WS-482 came back at zero divergence. That has the same two
 * explanations WS-481's null had, and they must not be confused:
 *
 *   (a) threading the node's computed pFold changes no advice, or
 *   (b) the depth-2/3 stages never execute at these decisions, so the tighten they contain
 *       never runs and the null measures the harness.
 *
 * `treeMetadata.latency` records per-stage status — completed / partial / no-candidate /
 * gated / error — plus `weightConsumed`. Printing it for the same kind of spot the probe
 * scores answers the question directly instead of by inference.
 *
 * USAGE
 *   node scripts/backtest/probe-depth2-reach.mjs
 */
import { openLoader } from './loader.mjs';

const main = async () => {
  const REPO = process.cwd().split(String.fromCharCode(92)).join('/');
  const loader = await openLoader(REPO);
  try {
    const { evaluateGameTree } = await loader.load('/src/utils/exploitEngine/gameTreeEvaluator.js');
    const { parseCard } = await loader.load('/src/utils/pokerCore/cardParser.js');
    const { parseRangeString } = await loader.load('/src/utils/pokerCore/rangeMatrix.js');

    const cards = (...cs) => cs.map(parseCard);
    const villainRange = () => parseRangeString(
      'AA,KK,QQ,JJ,TT,99,88,77,66,55,AKs,AQs,AJs,ATs,KQs,KJs,QJs,JTs,T9s,98s,'
      + 'AKo,AQo,AJo,KQo,KJo,QJo,JTo,A5s,A4s,54s,T8s,97s,86s,K9s,Q9s,J9s'
    );

    const SPOTS = [
      ['flop A♠K♦6♠ P100 (hero to act, no bet faced)', cards('A♠', 'K♦', '6♠'), cards('Q♠', 'J♠'), 100, null, null],
      ['flop J♥T♥9♦ P120 facing 80', cards('J♥', 'T♥', '9♦'), cards('A♠', 'K♠'), 120, 'bet', 80],
      ['turn A♠7♥2♦9♣ P200 (no bet faced)', cards('A♠', '7♥', '2♦', '9♣'), cards('K♦', 'Q♦'), 200, null, null],
    ];

    for (const budget of [0, 2000]) {
      console.log(`\n=== refinementBudgetMs = ${budget} ===`);
      for (const [name, board, hero, pot, action, bet] of SPOTS) {
        const res = await evaluateGameTree({
          villainRange: villainRange(), board, heroCards: hero, potSize: pot,
          villainAction: action ?? undefined, villainBet: bet ?? undefined,
          effectiveStack: 900,
          playerStats: { vpip: 22, pfr: 18, af: 2.5, cbet: 60 },
          villainModel: null,
          contextHints: { isIP: true, texture: 'unknown', posCategory: 'LATE' },
          trials: 200,
          refinementBudgetMs: budget,
        });
        const lat = res?.treeMetadata?.latency || {};
        const stages = Object.entries(lat)
          .filter(([k]) => /depth|Depth/.test(k))
          .map(([k, v]) => `${k}=${v?.status ?? v}${v?.weightConsumed != null ? `(w=${Number(v.weightConsumed).toFixed(2)})` : ''}`);
        console.log(`  ${name}`);
        console.log(`    top=${res?.recommendation?.action ?? res?.actions?.[0]?.action ?? '?'}  stages: ${stages.length ? stages.join('  ') : '(none reported)'}`);
      }
    }
  } finally {
    await loader.close();
  }
};
main().catch((e) => { console.error(e); process.exit(1); });
