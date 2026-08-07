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
 * WS-432: source (2) NO LONGER EXISTS — refinement gates read a logical work meter, so the
 * `Date.now` freeze below is inert for them, and a budget now trips DETERMINISTICALLY at
 * the same point on every machine. Consequence for this instrument: at the default
 * `refinementBudgetMs` the dump is a reproducible BUDGETED tree, not the full one; pass a
 * large `WS334_REFINEMENT_MS` (e.g. 600000) when a full-tree dump is what the diff needs.
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

/**
 * WS-361: THE FROZEN CLOCK IS WHY THIS INSTRUMENT COULD NOT SEE THE DEFECT IT WAS AIMED AT.
 *
 * Freezing `Date.now` means the refinement budget never trips, so this harness always dumps
 * the FULL depth-2/3 tree. That is correct for a bit-identity check — it is the only way a
 * before/after diff covers the same code — but it means the harness can never reproduce a
 * budget-truncated run, and budget truncation is precisely what mispriced the OESD call at
 * -26.9 EV against +12.4 over the full sample.
 *
 * `WS361_LIVE_CLOCK=1` leaves `Date.now` real, so the run reflects what the founder's sidebar
 * actually computes under its budget. Output from a live-clock run is NOT bit-comparable
 * between invocations and must never be used as a regression baseline — it is a measurement
 * of the degraded path, which is a different question and now an askable one.
 *
 *   node scripts/backtest/dumpGameTreeEV.mjs out/full.json            # full tree
 *   WS361_LIVE_CLOCK=1 node scripts/backtest/dumpGameTreeEV.mjs out/budgeted.json
 *
 * WS-432: this whole distinction is now moot for refinement gates — the logical clock makes
 * the budgeted path deterministic, so `WS361_LIVE_CLOCK` no longer changes which stages run;
 * the budget itself (WS334_REFINEMENT_MS) is the only lever, and every setting of it is
 * bit-comparable between invocations.
 */
const LIVE_CLOCK = process.env.WS361_LIVE_CLOCK === '1';

const freezeClocks = (seed) => {
  let rng = mulberry32(seed);
  Math.random = () => rng();
  if (!LIVE_CLOCK) Date.now = () => FROZEN_NOW;
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
    // WS-386: THIS LIST WAS BUILT FOR A DIFFERENT QUESTION. Its original comment (above)
    // explains that the scenarios were chosen to reach every NARROWING site for WS-292.
    // WS-334 then reused it to ask what enabling DEPTH does to advice — a question with a
    // different stage structure — and the set had FIVE flop, THREE turn and ZERO river
    // spots. Every depth-2 branch is gated `street !== 'river'`, so on the river an
    // entirely different stage runs (`riverPerCombo`), and the set could not see it.
    //
    // The dump reported "1 of 8 top-action flips" and that was read as "no systematic pull
    // toward passivity". The WS-361 corpus ablation (260 paired decisions) then found the
    // pull is real, large and one-directional — and that 36 of 45 RIVER decisions flip
    // (80%) against 4 of 215 flop+turn decisions. The dump was not wrong about the spots it
    // covered; it was blind to the street where the effect lives, and the conclusion was
    // stated over the whole engine rather than over the streets sampled.
    //
    // A fixture set inherits the coverage of the question it was BUILT for, not the question
    // you are asking of it. Before reusing this list, check it against the stage structure
    // of your question — and read the coverage census the run prints.
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

      // RIVER (WS-386). Where `riverPerCombo` fires and where the corpus ablation found 80%
      // of top-action flips. `computeRiverCheckEV` and `computeRiverBetEV` replace the check
      // and bet candidates' EV with DIFFERENT functions, so any asymmetry between the two
      // lands straight on the recommendation — which is exactly what these spots expose.
      { name: 'river-dry-noaction-top30', board: cards('A♠', '7♥', '2♦', '9♣', '4♠'), hero: cards('A♥', 'K♣'),
        range: () => topRange(30), villainAction: null, villainBet: 0, pot: 260, stack: 500 },
      { name: 'river-dry-facing-bet-tight', board: cards('A♠', '7♥', '2♦', '9♣', '4♠'), hero: cards('7♠', '7♦'),
        range: () => tightRange(), villainAction: 'bet', villainBet: 160, pot: 260, stack: 500 },
      { name: 'river-wet-noaction-top50', board: cards('J♥', 'T♥', '9♦', '2♥', '5♥'), hero: cards('A♥', 'J♠'),
        range: () => topRange(50), villainAction: null, villainBet: 0, pot: 300, stack: 460 },
      { name: 'river-paired-facing-bet-full', board: cards('J♥', 'T♥', '9♦', '9♠', '3♣'), hero: cards('K♥', 'Q♥'),
        range: () => fullRange(), villainAction: 'bet', villainBet: 180, pot: 300, stack: 460 },
    ];

    // WS-386: the census, INCLUDING THE ZEROS. Printed before the run and written into the
    // output, so no reader can draw an engine-wide conclusion from a partial set without
    // seeing the gap. Reporting only the streets a set covers makes it look healthier the
    // narrower it is — the same selection effect recorded against the fallback-level quality
    // table (WS-285), pointed at our own fixtures.
    const STREETS = ['flop', 'turn', 'river'];
    const streetOf = (sc) => STREETS[sc.board.length - 3] ?? 'unknown';
    const coverage = Object.fromEntries(STREETS.map(st => [st, 0]));
    for (const sc of SCENARIOS) coverage[streetOf(sc)] = (coverage[streetOf(sc)] ?? 0) + 1;
    const gaps = STREETS.filter(st => coverage[st] === 0);
    console.log(`Street coverage: ${STREETS.map(st => `${st} ${coverage[st]}`).join(' / ')}`
      + (gaps.length ? `  ** GAP: no ${gaps.join(', ')} scenarios — conclusions do not `
        + `generalise to ${gaps.length > 1 ? 'those streets' : 'that street'} **` : ''));

    const out = { frozenNow: LIVE_CLOCK ? null : FROZEN_NOW, liveClock: LIVE_CLOCK,
      streetCoverage: coverage, coverageGaps: gaps, scenarios: {} };

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
        // WS-334: the refinement budget is now a parameter, so this harness can dump the
        // SAME scenarios at depth-1 and at full depth and the pair can be differenced.
        //   WS334_REFINEMENT_MS=0 node scripts/backtest/dumpGameTreeEV.mjs out/depth1.json
        //   node scripts/backtest/dumpGameTreeEV.mjs out/depth2.json
        // With `Date.now` frozen the budget never trips, so the non-zero run explores the
        // FULL tree — which is what makes the difference attributable to depth rather than
        // to where a bailout happened to land.
        // WS-432: the freeze no longer buys that — the budget is logical and CAN trip here,
        // deterministically. For a full-tree dump set WS334_REFINEMENT_MS to a large value.
        refinementBudgetMs: process.env.WS334_REFINEMENT_MS != null
          ? Number(process.env.WS334_REFINEMENT_MS)
          : 2000,
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
        // WS-361: a depth-2 number is only as good as the fraction of the runout tree it
        // averaged over. Dumping the EV without this is dumping a number with no error bar,
        // and a stage that bailed at 5% used to be indistinguishable from one that finished.
        depthReached: result?.treeMetadata?.depthReached ?? null,
        stages: (result?.treeMetadata?.latency?.stages || [])
          .filter(s => s.ran)
          .map(s => ({ stage: s.stage, outcome: s.outcome, weightConsumed: s.weightConsumed ?? null })),
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
