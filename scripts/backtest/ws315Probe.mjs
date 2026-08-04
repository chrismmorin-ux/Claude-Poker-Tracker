/**
 * ws315Probe.mjs — WS-315 diagnostic probe (temporary, not a shipped module).
 *
 * A♠K♦6♠, villain top-25%, checked to hero. Reports blocker removal per bucket and the
 * continuation-weighted score, so "blocks the calling range" vs "blocks nothing" is
 * visible as a number rather than asserted.
 */
import { evaluateGameTree } from '../../src/utils/exploitEngine/gameTreeEvaluator.js';
import { parseAndEncode } from '../../src/utils/pokerCore/cardParser.js';
import { buildEvaluationContext } from '../../src/utils/exploitEngine/gameTreeContext.js';
import { topRange } from '../../src/utils/exploitEngine/__tests__/fixtures/ranges.js';

const enc = (s) => parseAndEncode(s);
const board = [enc('A♠'), enc('K♦'), enc('6♠')];

const HEROES = [
  { label: 'Q♠J♠ flush draw', cards: [enc('Q♠'), enc('J♠')] },
  { label: 'J♠T♠ flush draw', cards: [enc('J♠'), enc('T♠')] },
  { label: 'J♦T♦ gutshot', cards: [enc('J♦'), enc('T♦')] },
  { label: '8♦8♣ small pair', cards: [enc('8♦'), enc('8♣')] },
  { label: '5♦4♦ pure air', cards: [enc('5♦'), enc('4♦')] },
  { label: 'A♦Q♦ TOP PAIR', cards: [enc('A♦'), enc('Q♦')] },
];

const run = async () => {
  console.log('board A♠K♦6♠ | villain top-25% | checked to hero | pot 100\n');
  console.log('hero               heroEq   nuts%rm  strong%rm  air%rm   SCORE   blockerBluff?');
  for (const h of HEROES) {
    const ctx = await buildEvaluationContext({
      villainRange: topRange(25), board, heroCards: h.cards, potSize: 100, isOOP: true, trials: 1500,
    });
    const be = ctx.blockerEffects;
    const r = await evaluateGameTree({
      villainRange: topRange(25), board, heroCards: h.cards, potSize: 100, isOOP: true, trials: 1500,
    });
    const hasBluff = r.recommendations.some((x) => x.blockerBluff);
    const p = (v) => (v ?? 0).toFixed(1).padStart(7);
    console.log(
      h.label.padEnd(18),
      ctx.heroEquity.toFixed(3).padStart(6),
      p(be.nuts?.pctRemoved), p(be.strong?.pctRemoved), p(be.air?.pctRemoved),
      (be.score ?? 0).toFixed(4).padStart(8),
      '  ', hasBluff ? 'YES' : 'no',
    );
  }
};

run().catch((e) => { console.error(e); process.exit(1); });
