/**
 * ws314Probe.mjs — WS-314 diagnostic probe (temporary, not a shipped module).
 *
 * Reproduces the 2026-07-30 measurement: A♠K♦6♠ two-tone, villain top-25%,
 * hero OOP, checked to hero. Reports the ranked actions plus the internal
 * check-raise branch terms, so the cause can be stated before any fix.
 */
import { evaluateGameTree } from '../../src/utils/exploitEngine/gameTreeEvaluator.js';
import { parseAndEncode } from '../../src/utils/pokerCore/cardParser.js';
import { topRange } from '../../src/utils/exploitEngine/__tests__/fixtures/ranges.js';
import { buildVillainDecisionModel } from '../../src/utils/exploitEngine/villainDecisionModel.js';

const enc = (s) => parseAndEncode(s);
const board = [enc('A♠'), enc('K♦'), enc('6♠')];

const HEROES = [
  { label: 'J♦T♦ gutshot', cards: [enc('J♦'), enc('T♦')] },
  { label: '8♦8♣ small pair', cards: [enc('8♦'), enc('8♣')] },
  { label: '5♦4♦ pure air', cards: [enc('5♦'), enc('4♦')] },
];

// Villain who demonstrably over-folds to a raise, across every texture/position cell so
// the probe does not depend on how A♠K♦6♠ classifies.
const foldsToRaiseModel = () => {
  const buckets = {};
  for (const texture of ['dry', 'wet', 'semi-wet', 'paired', 'monotone', 'dynamic', 'static']) {
    for (const pos of ['EARLY', 'MIDDLE', 'LATE', 'BLINDS']) {
      const base = { street: 'flop', texture, posCategory: pos, isAggressor: 'def', isIP: 'ip', facingAction: 'raise' };
      buckets[`flop:${texture}:${pos}:def:ip:raise:fold`] = {
        ...base, situationKey: `flop:${texture}:${pos}:def:ip:raise:fold`,
        action: 'fold', contextAction: 'fold',
        occurrences: 85, avgRangeEquity: 0.30, avgSegmentation: {}, showdownResults: [],
      };
      buckets[`flop:${texture}:${pos}:def:ip:raise:call`] = {
        ...base, situationKey: `flop:${texture}:${pos}:def:ip:raise:call`,
        action: 'call', contextAction: 'call',
        occurrences: 15, avgRangeEquity: 0.55, avgSegmentation: {}, showdownResults: [],
      };
    }
  }
  return buildVillainDecisionModel({ buckets, totalActions: 100 * 28 });
};

const run = async () => {
  console.log('board A♠K♦6♠ | villain top-25% | hero OOP, checked to hero | pot 100\n');
  console.log('=== ARM A: no villain model (the measured scenario) ===');
  console.log('hero              heroEq   TOP action     topEV    betEV   checkEV    crEV');
  for (const h of HEROES) {
    const r = await evaluateGameTree({
      villainRange: topRange(25),
      board,
      heroCards: h.cards,
      potSize: 100,
      isOOP: true,
      trials: 2000,
    });
    const find = (a) => r.recommendations.find((x) => x.action === a);
    const top = r.recommendations[0];
    const bet = find('bet');
    const chk = find('check');
    const cr = find('check-raise');
    const f = (v) => (v == null ? '   -  ' : v.toFixed(1).padStart(6));
    console.log(
      h.label.padEnd(17),
      r.heroEquity.toFixed(3).padStart(6),
      ' ', (top.action).padEnd(13),
      f(top.ev), f(bet?.ev), f(chk?.ev), f(cr?.ev),
    );
    if (cr?.villainResponse) {
      const vr = cr.villainResponse;
      console.log(
        '                  cr-branch: foldPct', vr.foldPct?.toFixed(3),
        '| villainChecks', vr.villainChecks?.pct?.toFixed(3), 'ev', vr.villainChecks?.ev?.toFixed(1),
        '| betsThenFolds', vr.villainBetsThenFolds?.pct?.toFixed(3), 'ev', vr.villainBetsThenFolds?.ev?.toFixed(1),
        '| betsThenCalls', vr.villainBetsThenCalls?.pct?.toFixed(3), 'ev', vr.villainBetsThenCalls?.ev?.toFixed(1),
      );
      const calledEV = vr.villainBetsThenCalls?.ev;
      console.log('                  called-branch EV =', calledEV?.toFixed(1),
        calledEV < 0 ? '→ CR profits ONLY via fold equity (WS-247 guard territory)' : '→ CR has a +EV called branch (value)');
    }
    console.log('');
  }

  console.log('=== ARM B: villain model showing 85% fold-to-raise (evidence present) ===');
  console.log('hero              heroEq   TOP action     topEV    betEV   checkEV    crEV');
  const model = foldsToRaiseModel();
  for (const h of HEROES) {
    const r = await evaluateGameTree({
      villainRange: topRange(25),
      board,
      heroCards: h.cards,
      potSize: 100,
      isOOP: true,
      villainModel: model,
      trials: 2000,
    });
    const find = (a) => r.recommendations.find((x) => x.action === a);
    const top = r.recommendations[0];
    const f = (v) => (v == null ? '   -  ' : v.toFixed(1).padStart(6));
    console.log(
      h.label.padEnd(17),
      r.heroEquity.toFixed(3).padStart(6),
      ' ', (top.action).padEnd(13),
      f(top.ev), f(find('bet')?.ev), f(find('check')?.ev), f(find('check-raise')?.ev),
    );
  }
};

run().catch((e) => { console.error(e); process.exit(1); });
