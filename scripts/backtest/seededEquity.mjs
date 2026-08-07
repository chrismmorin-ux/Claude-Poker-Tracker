/**
 * seededEquity.mjs — seeded Monte Carlo equity for the backtest harness (WS-433).
 *
 * The default engine equity path (`handVsRange`) draws from `Math.random`, which
 * makes every scored decision nondeterministic — including the early-convergence
 * trial COUNT, since convergence is checked on accumulated Welford variance.
 * `replicationStamp.mjs` names this as HERO_EV_UNSEEDED_SOURCES.
 *
 * This module closes that source WITHOUT global monkey-patching (the
 * `dumpGameTreeEV.mjs` freeze pattern corrupts concurrent evaluations in the
 * same isolate). It binds a per-call mulberry32 stream through the `opts.rng`
 * seam threaded into `monteCarloEquity.js`, injected via the `equityFn`
 * parameter that already flows end-to-end through the engine
 * (gameTreeEvaluator → gameTreeContext → rangeSegmenter).
 *
 * Seeds must derive from position in the stable work enumeration
 * (heroEvEnumeration.mjs), never from execution order — same doctrine as
 * entryEvaluator.seedFor.
 */

import { handVsRange } from '../../src/utils/pokerCore/monteCarloEquity.js';

/**
 * Default run-level equity seed — golden-ratio constant, same family as
 * `ipsEstimator.DEFAULT_BOOTSTRAP_SEED`. A DEFAULT rather than a required flag because a
 * reproducible run must be the path of least resistance; `--equity-seed none` opts back
 * into the legacy unseeded behavior explicitly.
 */
export const DEFAULT_EQUITY_SEED = 0x9e3779b9;

/**
 * mulberry32 — the repo-standard 32-bit seeded PRNG
 * (same construction as probeLevel.mjs / run-river-flip-replicate.mjs).
 * @param {number} seed - 32-bit integer seed
 * @returns {() => number} uniform [0,1) generator
 */
export const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * Build an equityFn (the `handVsRange` signature) backed by a private seeded
 * stream. One instance per `evaluateGameTree` call: the engine's equity calls
 * within one evaluation are serial, so draws from the stream are reproducible
 * regardless of which worker runs the evaluation. Callers must NOT share one
 * instance across concurrent evaluations.
 *
 * A caller-supplied `options.rng` is refused rather than silently overridden:
 * two RNG sources on one call is always a bug.
 *
 * @param {number} seed - 32-bit seed from seedForCombo(...)
 * @returns {(heroCards, villainRange, board?, options?) => Promise<object>}
 */
export const makeSeededEquityFn = (seed) => {
  const rng = mulberry32(seed);
  return (heroCards, villainRange, board = [], options = {}) => {
    if (options.rng !== undefined) {
      throw new Error('makeSeededEquityFn: options.rng already set — refusing to double-seed');
    }
    return handVsRange(heroCards, villainRange, board, { ...options, rng });
  };
};
