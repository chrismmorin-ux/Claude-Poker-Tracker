/**
 * probe-depth2-coverage.mjs — is depth-2's noise bound by the CLOCK or by the SAMPLE COUNTS?
 *
 * ── THE QUESTION (founder, 2026-08-19) ──
 * "A better simulation of the poker game should ALWAYS be better than or equal to a more naive
 * one. Otherwise we settle into local min/maxes and never evaluate complex strategy."
 *
 * That is right, and the WS-496 board sweep appears to contradict it: depth-2plus carries 9.71x
 * depth-1's optimizer's curse (13.98 vs 1.44 chips on a 100 pot, non-overlapping intervals) and
 * flips its recommended action on 35.3% of flops against depth-1's 24.7%.
 *
 * The curse scales with ESTIMATOR VARIANCE, not with model quality, so a deeper tree that
 * estimates more quantities from a fixed budget can carry more of it. That is consistent with
 * two very different worlds and the difference decides what to build:
 *
 *   H1 UNDERSAMPLED — depth-2 is less biased but noisier at its current budget. The variance is
 *                     removable by sampling, depth-2 wins asymptotically, and the founder's
 *                     "always >=" holds in the limit. FIX: raise the binding constraint.
 *   H2 DEFECTIVE    — the noise does not fall with more sampling. Then it is a bug, and more
 *                     compute never fixes it.
 *
 * ── WHY THIS PROBE COMES FIRST, BEFORE ANY BUDGET SWEEP ──
 * There are two candidate constraints and they need different fixes:
 *
 *   - the CLOCK (`refinementBudgetMs`, default 2000, capped per stage at MAX_STAGE_SHARE = 0.4)
 *   - the SAMPLE COUNTS, which are hardcoded: 16 runout cards in each depth-2 sampler, and
 *     DEPTH3_TURN_CARDS = 6, DEPTH3_RIVER_CARDS = 8, DEPTH3_TURN_D3_RIVER_CARDS = 10.
 *
 * `treeMetadata.latency` already distinguishes them. A stage reports `completed` or `partial`,
 * and `weightConsumed` is the fraction of runout probability it actually averaged over. So:
 *
 *   - mostly `partial`, weightConsumed < 1  ->  the CLOCK binds. Raising it reduces variance.
 *   - mostly `completed`, weightConsumed = 1 ->  the clock is NOT binding. The variance is the
 *                                               fixed sample counts, and raising the budget
 *                                               would change NOTHING. The knob is the constants.
 *
 * Running a budget sweep without this measurement first would risk hours of compute answering
 * a question whose answer is already recorded in metadata the engine emits for free.
 *
 * USAGE
 *   node scripts/backtest/probe-depth2-coverage.mjs --boards 40 [--budget 2000] [--out f.json]
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openLoader } from './loader.mjs';

const parseArgs = (argv) => {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) args[k] = true;
    else { args[k] = n; i++; }
  }
  return args;
};

const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const FROZEN_NOW = 1_700_000_000_000;
const realNow = Date.now;
const realRandom = Math.random;

/** Same board draw as run-optimism-boards.mjs, same seed, so the two probes see one population. */
const drawBoards = (n, size, dead, seed) => {
  const rng = mulberry32(seed);
  const deck = [];
  for (let c = 0; c < 52; c++) if (!dead.includes(c)) deck.push(c);
  const seen = new Set();
  const boards = [];
  for (let guard = 0; guard < n * 400 && boards.length < n; guard++) {
    const pool = deck.slice();
    const board = [];
    for (let i = 0; i < size; i++) {
      const j = Math.floor(rng() * pool.length);
      board.push(pool[j]);
      pool.splice(j, 1);
    }
    const key = board.slice().sort((a, b) => a - b).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    boards.push(board);
  }
  return boards;
};

const main = async () => {
  const args = parseArgs(process.argv);
  const N = Number.parseInt(args.boards ?? '40', 10);
  const budget = Number.parseInt(args.budget ?? '2000', 10);
  const out = String(args.out ?? '');

  const loader = await openLoader(process.cwd());
  try {
    const { evaluateGameTree } = await loader.load('/src/utils/exploitEngine/gameTreeEvaluator.js');
    const { parseAndEncode } = await loader.load('/src/utils/pokerCore/cardParser.js');
    const { parseRangeString } = await loader.load('/src/utils/pokerCore/rangeMatrix.js');

    const villainRange = parseRangeString('AA,KK,QQ,JJ,TT,99,AKs,AKo,AQs,AQo,AJs,KQs');
    const heroCards = ['A♥', 'K♥'].map(parseAndEncode);
    const boards = drawBoards(N, 3, heroCards, 0xB0A2D5);

    // Per-stage tallies. The stage names come from the evaluator's own ledger.
    const stages = {};
    const bump = (name, field) => {
      const s = stages[name] ?? (stages[name] = {
        ran: 0, completed: 0, partial: 0, gated: 0, other: 0,
        weightSum: 0, weightN: 0, weightFull: 0,
      });
      s[field] = (s[field] ?? 0) + 1;
      return s;
    };

    let evaluated = 0;
    let anyRefinement = 0;
    const t0 = realNow();

    const rng = mulberry32(0x5eed);
    Math.random = () => rng();
    Date.now = () => FROZEN_NOW;
    try {
      for (const board of boards) {
        const r = await evaluateGameTree({
          villainRange, board, heroCards,
          potSize: 100,
          villainAction: 'bet',
          villainBet: 65,
          effectiveStack: 900,
          playerStats: { vpip: 22, pfr: 18, af: 2.5, cbet: 60 },
          villainModel: null,
          trials: 200,
          refinementBudgetMs: budget,
        });
        evaluated++;
        const lat = r?.treeMetadata?.latency ?? null;
        if (!lat) continue;
        const perStage = lat.stages ?? lat;
        let sawOne = false;
        for (const [name, rec] of Object.entries(perStage)) {
          if (!rec || typeof rec !== 'object') continue;
          if (!('ran' in rec) && !('outcome' in rec)) continue;
          sawOne = true;
          const s = bump(name, 'ran');
          const outcome = rec.outcome ?? (rec.ran ? 'completed' : 'gated');
          if (outcome === 'completed') s.completed++;
          else if (outcome === 'partial') s.partial++;
          else if (outcome === 'gated') s.gated++;
          else s.other++;
          if (Number.isFinite(rec.weightConsumed)) {
            s.weightSum += rec.weightConsumed;
            s.weightN++;
            if (rec.weightConsumed >= 0.999) s.weightFull++;
          }
        }
        if (sawOne) anyRefinement++;
      }
    } finally {
      Date.now = realNow;
      Math.random = realRandom;
    }
    const elapsedMs = realNow() - t0;

    const rows = Object.entries(stages).map(([name, s]) => ({
      stage: name,
      ran: s.ran,
      completed: s.completed,
      partial: s.partial,
      gated: s.gated,
      meanWeightConsumed: s.weightN ? s.weightSum / s.weightN : null,
      fullCoverageShare: s.weightN ? s.weightFull / s.weightN : null,
    })).sort((a, b) => b.ran - a.ran);

    const totalRan = rows.reduce((n, r) => n + r.ran, 0);
    const totalPartial = rows.reduce((n, r) => n + r.partial, 0);
    const weighted = rows.filter((r) => r.meanWeightConsumed !== null);
    const meanWeight = weighted.length
      ? weighted.reduce((s, r) => s + r.meanWeightConsumed * r.ran, 0) / weighted.reduce((s, r) => s + r.ran, 0)
      : null;

    // THE VERDICT. This is the whole point of the probe, so it is computed here rather than
    // left for a reader to infer from the table.
    const partialShare = totalRan ? totalPartial / totalRan : null;
    const verdict = totalRan === 0
      ? 'NO REFINEMENT RAN — depth-2 never fired on these boards; the budget is not the variable'
      : partialShare >= 0.2 || (meanWeight !== null && meanWeight < 0.95)
        ? 'CLOCK BINDS — stages are bailing early, so raising refinementBudgetMs should reduce variance'
        : 'CLOCK DOES NOT BIND — stages complete with full coverage, so the variance is the HARDCODED '
          + 'SAMPLE COUNTS (16 per depth-2 sampler; DEPTH3_TURN_CARDS 6, DEPTH3_RIVER_CARDS 8, '
          + 'DEPTH3_TURN_D3_RIVER_CARDS 10). Raising the budget would change nothing.';

    const artifact = {
      kind: 'depth2-coverage',
      config: { boards: boards.length, refinementBudgetMs: budget, trials: 200, frozenNow: FROZEN_NOW },
      evaluated,
      evaluationsWithRefinement: anyRefinement,
      elapsedMs,
      totals: { stageRuns: totalRan, partial: totalPartial, partialShare, meanWeightConsumed: meanWeight },
      verdict,
      stages: rows,
    };

    if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(artifact, null, 2)); }

    const f = (x, d = 3) => (x === null || x === undefined ? 'n/a' : x.toFixed(d));
    console.log(`\n  budget ${budget}ms · ${evaluated} boards · ${Math.round(elapsedMs / 1000)}s`);
    console.log(`  evaluations where any refinement stage ran: ${anyRefinement}/${evaluated}\n`);
    console.log('  stage                  ran  completed  partial  gated   meanWeight  fullCov');
    for (const r of rows) {
      console.log(`  ${r.stage.padEnd(20)} ${String(r.ran).padStart(4)} ${String(r.completed).padStart(10)} ${String(r.partial).padStart(8)} ${String(r.gated).padStart(6)}   ${f(r.meanWeightConsumed).padStart(9)}  ${f(r.fullCoverageShare).padStart(7)}`);
    }
    console.log(`\n  partial share ${f(partialShare)} · mean weightConsumed ${f(meanWeight)}`);
    console.log(`\n  VERDICT: ${verdict}\n`);
    if (out) console.log(`Wrote ${out}`);
  } finally {
    await loader.close?.();
  }
};

main().catch((e) => {
  Date.now = realNow; Math.random = realRandom;
  console.error(e); process.exit(1);
});
