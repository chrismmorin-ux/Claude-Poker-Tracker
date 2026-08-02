/**
 * dumpGameTreeEV.mjs — bit-identity check on `evaluateGameTree` (WS-292).
 *
 * WHY IT LIVES HERE. The engine's depth-2/3 path is the one place where a refactor can move
 * shipped recommendations without any test noticing: the unit suites assert bands and
 * shapes, not exact EVs, and the path is nondeterministic besides. This dumps per-action
 * EVs for a fixed scenario set so a refactor can be checked for EXACT equality before and
 * after. Run it on the pre-change tree, run it again after, diff the JSON.
 *
 *   node scripts/backtest/dumpGameTreeEV.mjs out/before.json
 *   # ...make changes...
 *   node scripts/backtest/dumpGameTreeEV.mjs out/after.json
 *
 * It is a REGRESSION instrument, not a correctness one: it says "nothing moved", never
 * "the numbers are right". Verify it reproduces itself before trusting a diff.
 *
 * The depth-2/3 path has TWO sources of nondeterminism, and both must be frozen or a
 * before/after diff measures noise rather than the refactor:
 *
 *   1. `Math.random` — stratifiedSample / miniRolloutEquity / monteCarloEquity.
 *   2. `Date.now`    — gameTreeDepth2's mid-loop time bailout
 *                      (`Date.now() - startTime > timeBudgetMs`). WS-301 measured this
 *                      path at 8.5s against a 150ms budget, so depth-3 bails constantly
 *                      and WHERE it bails depends on machine load.
 *
 * Freezing Date.now to a constant means the budget never trips, so the FULL depth-3 tree
 * runs every time. That is slower but it is the only way the comparison covers the code
 * this ticket touches.
 *
 * Seeding is valid as a bit-identity check specifically because the refactor does not
 * consume randomness: wrapping `narrowByBoard` in `narrowHolding` neither draws nor
 * reorders a random call. If the diff moves, something real moved.
 *
 * Usage: node <this> <out.json>
 */

import { writeFileSync } from 'node:fs';
import { openLoader } from './loader.mjs';

const REPO = process.cwd();

// ── deterministic clocks ─────────────────────────────────────────────────────
const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const FROZEN_NOW = 1_700_000_000_000;
const realNow = Date.now;

const freezeClocks = (seed) => {
  let rng = mulberry32(seed);
  Math.random = () => rng();
  Date.now = () => FROZEN_NOW;
};
const restoreClocks = () => { Date.now = realNow; };

const main = async () => {
  const outPath = process.argv[2];
  if (!outPath) { console.error('usage: node dumpGameTreeEV.mjs <out.json>'); process.exit(2); }

  const loader = await openLoader(REPO);
  try {
    const { evaluateGameTree } = await loader.load('/src/utils/exploitEngine/gameTreeEvaluator.js');
    const { encodeCard, parseAndEncode } = await loader.load('/src/utils/pokerCore/cardParser.js');
    const { tightRange, topRange, fullRange } =
      await loader.load('/src/utils/exploitEngine/__tests__/fixtures/ranges.js');

    // Suits are the Unicode symbols from gameConstants.SUITS — parseAndEncode('A♠') is -1.
    // A board of three -1s still passes `board.length >= 3` and the whole tree runs on
    // garbage, producing a plausible-looking baseline that exercises nothing. Guarded.
    const cards = (...strs) => {
      const encoded = strs.map(parseAndEncode);
      const bad = strs.filter((_, i) => encoded[i] < 0);
      if (bad.length) throw new Error(`unparseable card(s): ${bad.join(', ')} — suits must be ♠♥♦♣`);
      return encoded;
    };

    // Scenarios chosen to reach every narrowing site under test:
    //   - flop  => computeDepth3BarrelEV flop path (sites 914 + 986) + computeBetCallDepth2EV (641)
    //   - turn  => computeDepth3BarrelEV turn path (site 831)
    //   - facing a bet => raise branch (site 754) + evaluator refinement (site 747)
    const SCENARIOS = [
      { name: 'flop-dry-noaction-tight', board: cards('A♠', '7♥', '2♦'), hero: cards('K♦', 'Q♦'),
        range: () => tightRange(), villainAction: null, villainBet: 0, pot: 100, stack: 900 },
      { name: 'flop-dry-facing-bet-tight', board: cards('A♠', '7♥', '2♦'), hero: cards('K♦', 'Q♦'),
        range: () => tightRange(), villainAction: 'bet', villainBet: 65, pot: 100, stack: 900 },
      { name: 'flop-wet-noaction-top30', board: cards('J♥', 'T♥', '9♦'), hero: cards('A♣', 'A♦'),
        range: () => topRange(30), villainAction: null, villainBet: 0, pot: 120, stack: 800 },
      { name: 'flop-wet-facing-bet-top30', board: cards('J♥', 'T♥', '9♦'), hero: cards('Q♠', 'Q♣'),
        range: () => topRange(30), villainAction: 'bet', villainBet: 80, pot: 120, stack: 800 },
      { name: 'flop-wet-facing-raise-full', board: cards('J♥', 'T♥', '9♦'), hero: cards('K♥', 'Q♥'),
        range: () => fullRange(), villainAction: 'raise', villainBet: 150, pot: 200, stack: 700 },
      { name: 'turn-noaction-top30', board: cards('A♠', '7♥', '2♦', '9♣'), hero: cards('A♥', 'K♣'),
        range: () => topRange(30), villainAction: null, villainBet: 0, pot: 200, stack: 600 },
      { name: 'turn-facing-bet-tight', board: cards('A♠', '7♥', '2♦', '9♣'), hero: cards('7♠', '7♦'),
        range: () => tightRange(), villainAction: 'bet', villainBet: 120, pot: 200, stack: 600 },
      { name: 'turn-wet-facing-bet-top50', board: cards('J♥', 'T♥', '9♦', '2♥'), hero: cards('A♥', 'J♠'),
        range: () => topRange(50), villainAction: 'bet', villainBet: 140, pot: 260, stack: 540 },
    ];

    const out = { frozenNow: FROZEN_NOW, scenarios: {} };

    for (const s of SCENARIOS) {
      // Same seed per scenario so scenario N is independent of scenario N-1's draw count.
      freezeClocks(12345);
      const t0 = realNow();
      const result = await evaluateGameTree({
        villainRange: s.range(),
        board: s.board,
        heroCards: s.hero,
        potSize: s.pot,
        villainAction: s.villainAction,
        villainBet: s.villainBet,
        effectiveStack: s.stack,
        playerStats: { style: 'TAG', vpip: 22, pfr: 18, af: 2.5, cbet: 60 },
        villainModel: null,
        contextHints: { isIP: true, texture: 'unknown', posCategory: 'LATE' },
        trials: 200,
      });
      const elapsed = realNow() - t0;
      restoreClocks();

      out.scenarios[s.name] = {
        elapsedMs: elapsed,
        heroEquity: result?.heroEquity ?? null,
        foldPct: result?.foldPct ?? null,
        recommendations: (result?.recommendations || []).map((r) => ({
          action: r.action,
          ev: r.ev,
          betFraction: r.sizing?.betFraction ?? null,
          betSize: r.sizing?.betSize ?? null,
          classification: r.classification ?? null,
          depth2Ev: r.depth2?.ev ?? null,
          depth3Ev: r.depth3?.ev ?? null,
        })),
      };
      console.log(`${s.name.padEnd(32)} ${String(elapsed).padStart(6)}ms  ${out.scenarios[s.name].recommendations.length} recs`);
    }

    writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.log(`\nWrote ${outPath}`);
  } finally {
    restoreClocks();
    await loader.close();
  }
};

main().catch((e) => { restoreClocks(); console.error(e); process.exit(1); });
