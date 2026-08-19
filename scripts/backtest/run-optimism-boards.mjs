/**
 * run-optimism-boards.mjs — the optimizer's curse over the BOARD population (WS-496, Option 2).
 *
 * ── WHAT THIS ANSWERS THAT `run-optimism-probe.mjs` DOES NOT ──
 * That probe measures the curse at eight FIXED nodes chosen by hand. It answers "how optimistic
 * is the engine at this spot", which is the right question for diagnosing a spot and the wrong
 * one for deciding whether to trust the engine's numbers in general: eight hand-picked boards
 * are not the population, and hero never faces one board repeatedly.
 *
 * Here the BOARD is the replicate. Boards are drawn uniformly from the deck minus hero's cards,
 * which is not an estimate of anything — the flop distribution is a combinatorial fact, so
 * there is no corpus, no fitted sampler, and nothing to be wrong about in the draw. The figure
 * that comes out is the population-averaged curse, which is the one worth acting on.
 *
 * ── THE HELD-OUT DESIGN, AND WHY IT IS NOT SYNTHETIC AMPLIFICATION ──
 * At each board the engine is evaluated at TWO independent `rngSalt` values. The argmax is
 * taken on one draw and valued on the other, both directions, averaged. So:
 *
 *   - The choice and the valuation never share a draw, which removes the O(1/R) in-sample term
 *     `nodeOptimism` carries by valuing the winner at a mean that includes its own pick — a
 *     contamination that shrinks the curse toward zero, the direction that flatters the engine.
 *   - Neither draw is privileged as "the truth", so a bias present in BOTH cancels to zero
 *     instead of being counted as optimism. Resampling a model against itself and reporting a
 *     narrowed interval around a fixed bias is the trap this shape exists to avoid.
 *
 * ── WHAT IT STILL CANNOT SEE ──
 * A bias shared by every draw — wrong ranges, wrong priors, a mis-specified equity model — is
 * invisible, because it moves both draws together. Every figure here is therefore a LOWER
 * BOUND on the total curse, exactly as in the fixed-node probe. Reporting it as the whole curse
 * would be the same error as reporting the old probe's 1e-13 as evidence of no curse.
 *
 * ── WHY THE OLD PROBE MEASURED NOTHING, WHICH THIS DEPENDS ON NOT REPEATING ──
 * `boardDerivedRng` seeds from the board cards and reads `Math.random` nowhere, so the previous
 * design's 200 `Math.random` seeds were 200 identical computations and the estimand was zero by
 * construction. `rngSalt` (WS-496) is the axis that actually varies the estimator. If a run here
 * reports `curse` at 1e-13 with `argmaxFlipRate` 0, check that `rngSalt` is still reaching the
 * sampler BEFORE believing it.
 *
 * USAGE
 *   node scripts/backtest/run-optimism-boards.mjs --boards 60 --out out/optimism-boards.json
 *   node scripts/backtest/run-optimism-boards.mjs --boards 60 --street turn --arm depth-1
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openLoader } from './loader.mjs';
import { heldOutOptimism } from './optimismBias.mjs';

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

/** Same generator the fixed-node probe uses, so a seed means the same sequence in both. */
const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const FROZEN_NOW = 1_700_000_000_000;
const realNow = Date.now;
const realRandom = Math.random;
/**
 * Pin the ambient sources. NOT the replicate — the replicate is the board, and within a board
 * it is `rngSalt`. Pinning `Math.random` per replicate is precisely what made the fixed-node
 * probe measure a noise of exactly zero.
 */
const freeze = () => {
  const rng = mulberry32(0x5eed);
  Math.random = () => rng();
  Date.now = () => FROZEN_NOW;
};
const restore = () => { Date.now = realNow; Math.random = realRandom; };

const ARMS = {
  'depth-1': 0,
  'depth-2plus': 2000,
};

/**
 * Draw `n` distinct boards uniformly from the deck minus `dead`.
 *
 * Uniform over C(50, k) is the ACTUAL distribution of boards hero faces, so this needs no
 * corpus and carries no fitted parameter. Deterministic given the seed, so a run replicates.
 */
const drawBoards = (n, size, dead, seed) => {
  const rng = mulberry32(seed);
  const deck = [];
  for (let c = 0; c < 52; c++) if (!dead.includes(c)) deck.push(c);
  const seen = new Set();
  const boards = [];
  // Bounded so an impossible request (more distinct boards than exist) terminates loudly via
  // the returned count rather than spinning.
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
  if (!Number.isFinite(N) || N < 2) {
    console.error('--boards must be >= 2; the board is the replicate.');
    process.exit(2);
  }
  const street = String(args.street ?? 'flop');
  const boardSize = street === 'turn' ? 4 : street === 'river' ? 5 : 3;
  const armId = String(args.arm ?? 'depth-1');
  if (!(armId in ARMS)) {
    console.error(`--arm must be one of ${Object.keys(ARMS).join(', ')}`);
    process.exit(2);
  }
  const out = String(args.out ?? '');

  const loader = await openLoader(process.cwd());
  try {
    const { evaluateGameTree } = await loader.load('/src/utils/exploitEngine/gameTreeEvaluator.js');
    const { parseAndEncode } = await loader.load('/src/utils/pokerCore/cardParser.js');
    const { parseRangeString } = await loader.load('/src/utils/pokerCore/rangeMatrix.js');

    // Named hands, never grid index literals — index 0 is `22`, not `AA`, and reading it the
    // other way turned every "tight range" fixture in the behavioural suite into junk (WS-300).
    const villainRange = parseRangeString('AA,KK,QQ,JJ,TT,99,AKs,AKo,AQs,AQo,AJs,KQs');
    const heroCards = ['A♥', 'K♥'].map(parseAndEncode);

    const boards = drawBoards(N, boardSize, heroCards, 0xB0A2D5);
    if (boards.length < N) {
      console.error(`only ${boards.length} distinct boards drawn of ${N} requested`);
    }

    // Two salts, distinct and both non-zero. 0 is the engine's historical stream, so using it
    // would make one draw special in a design whose whole point is that neither is.
    const SALT_A = 0x9e37;
    const SALT_B = 0xc2b2;

    freeze();
    const pairs = [];
    const t0 = realNow();
    try {
      for (const board of boards) {
        const at = async (rngSalt) => {
          const r = await evaluateGameTree({
            villainRange, board, heroCards,
            potSize: 100,
            villainAction: 'bet',
            villainBet: 65,
            effectiveStack: 900,
            playerStats: { vpip: 22, pfr: 18, af: 2.5, cbet: 60 },
            villainModel: null,
            trials: 200,
            refinementBudgetMs: ARMS[armId],
            rngSalt,
          });
          return Object.fromEntries(
            (r.recommendations ?? [])
              .filter((x) => Number.isFinite(x.ev))
              // Sizing is part of the action's identity: two bets of different size are two
              // different actions, and collapsing them would let the max jump between them.
              .map((x) => [`${x.action}:${x.sizing?.betSize ?? 0}`, x.ev]),
          );
        };
        pairs.push({ a: await at(SALT_A), b: await at(SALT_B) });
      }
    } finally {
      restore();
    }
    const elapsedMs = realNow() - t0;

    const result = heldOutOptimism(pairs);

    const artifact = {
      kind: 'optimism-boards',
      config: {
        boards: boards.length,
        requestedBoards: N,
        street,
        arm: armId,
        refinementBudgetMs: ARMS[armId],
        saltA: SALT_A,
        saltB: SALT_B,
        boardSeed: 0xB0A2D5,
        frozenNow: FROZEN_NOW,
        trials: 200,
        generator: 'mulberry32',
        replicateAxis: 'board x rngSalt',
        villainRange: 'AA,KK,QQ,JJ,TT,99,AKs,AKo,AQs,AQo,AJs,KQs',
        heroCards: 'A♥K♥',
      },
      scope:
        'SYNTHETIC boards drawn uniformly from the deck, not corpus hands. Measures the optimism '
        + 'induced by the estimator\'s OWN SAMPLING noise, averaged over the board population. A '
        + 'bias shared by both draws is invisible by construction, so this is a LOWER BOUND on '
        + 'the total curse. Units are the engine\'s internal chips at a 100 pot, NOT bb and NOT '
        + 'a winrate.',
      liveTransfer:
        'The board distribution is a combinatorial fact and transfers exactly. The VILLAIN RANGE '
        + 'and the bet geometry are fixed by hand and do not describe the founder\'s live '
        + '9-handed 1/2-1/3 game, so the magnitude is transferred, not measured.',
      elapsedMs,
      result,
    };

    if (out) {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, JSON.stringify(artifact, null, 2));
    }

    if (!result) {
      console.error('no comparable node produced two shared actions — nothing to report');
      process.exit(1);
    }
    const f = (x, d = 4) => (x === null || x === undefined ? 'n/a' : x.toFixed(d));
    console.log(`\n  arm ${armId} · ${street} · ${result.nodes} boards · ${Math.round(elapsedMs / 1000)}s`);
    console.log(`  curse            ${f(result.curse)}  (sd ${f(result.curseSd)}, se ${f(result.curseSe)})`);
    console.log(`  argmax flip rate ${f(result.argmaxFlipRate, 3)}  — share of boards where two independent draws disagree on the best action`);
    if (result.curseSe) {
      const lo = result.curse - 1.96 * result.curseSe;
      const hi = result.curse + 1.96 * result.curseSe;
      console.log(`  95% interval     [${f(lo)}, ${f(hi)}]${lo <= 0 && hi >= 0 ? '  — straddles zero' : ''}`);
    }
    if (out) console.log(`\nWrote ${out}`);
  } finally {
    await loader.close?.();
  }
};

main().catch((e) => { restore(); console.error(e); process.exit(1); });
