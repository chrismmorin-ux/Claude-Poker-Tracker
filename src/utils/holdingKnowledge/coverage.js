/**
 * coverage.js — scoring a believed range against the hand that was actually held (WS-292).
 *
 * Lifted verbatim from `scripts/backtest/rangeCalibrationProbe.mjs:85-105`, which is the
 * point: that probe had the only implementation of this join in the repo, living in a
 * script outside `src/`, so nothing the app ships could ask the question. Moving it here
 * makes the probe a thin consumer instead of the sole owner.
 *
 * ── THE METRIC THAT IS NOT ARGUABLE, AND WHY IT IS CURRENTLY DEGENERATE ───────
 *
 * `covered` — does the believed range assign ANY probability to the hand actually held? A
 * model that assigns zero to an event that occurred is not miscalibrated, it is falsified.
 * Everything else here is a matter of degree; that is a matter of kind.
 *
 * **On the engine as it ships today, `covered` is always true** — confirmed on the corpus,
 * where coverage and retainedFraction are both 100.0% in every slice. Be precise about WHY,
 * because the two mechanisms involved are not interchangeable:
 *
 *   - WS-302 gave the preflop population priors support on every cell
 *     (`populationPriors.PRIOR_SUPPORT_LAMBDA = 0.8`). This is what actually delivers
 *     coverage: the SEED contains every hand.
 *   - WS-291's floor (`softWeights.MIN_CONTINUATION_WEIGHT = 0.05`) then keeps every
 *     surviving cell positive through each narrowing.
 *
 * The floor alone would not be enough, and it is worth stating plainly: `narrowByBoard`
 * deliberately PRESERVES a zero the incoming range already had — it reweights support, it
 * does not create it. Hand it a hard-edged range and hands outside that range stay at zero
 * (asserted in the tests). So coverage is a property of the seed first and the narrowing
 * second, and a consumer that seeds from something narrower than the WS-302 priors can
 * still see genuine misses.
 *
 * `covered` is kept because it is cheap and because it is the metric that matters the
 * instant anyone reintroduces a hard cut or seeds from a hard-edged range. It is NOT the
 * signal to build a per-player width on.
 *
 * The live signal is `logLift` = log(p / u): how much more probability the believed range
 * put on the true hand than a uniform range over the same live combos would have. That is
 * the `deltaLogVsUniform` the WS-291/302/303 sweeps were all decided on, and it degrades
 * smoothly — a player who continues below the equity threshold the model assumes will have
 * their revealed hands sitting near the floor, producing low or negative lift, WITHOUT ever
 * producing a coverage miss.
 *
 * `retainedFraction` is the fair baseline: coverage alone flatters a wide range (keep every
 * combo and coverage is 100%), so it is always reported against the share of available
 * combos the range retained — what a range of that width would score by eliminating at
 * random.
 */

import { enumerateCombos } from '../pokerCore/rangeMatrix.js';

/** All available combos ignoring the range — the denominator for `retainedFraction`. */
const totalAvailableCombos = (board, dead) => {
  const blocked = new Set([...board, ...dead]);
  const free = 52 - blocked.size;
  return (free * (free - 1)) / 2;
};

/**
 * Score one (range, revealed hand) pair.
 *
 * @param {Float64Array} range - the BELIEVED range at the decision point
 * @param {number[]} board - encoded board cards
 * @param {number[]} hole - the two encoded cards actually held
 * @param {number[]} [dead] - additional excluded cards
 * @returns {{covered: boolean, weightOfTruth: number, uniformWeight: number,
 *            retainedFraction: number, logLift: number, liveCombos: number}|null}
 *   `null` when the pair cannot be scored at all (no board, or the revealed cards collide
 *   with the board — a data problem, not a model result, and averaging it in as a zero
 *   would understate the model).
 */
export const scoreCoverage = (range, board, hole, dead = []) => {
  if (!range || !board || board.length < 3 || !hole || hole.length !== 2) return null;
  const [c1, c2] = hole;
  if (!Number.isInteger(c1) || !Number.isInteger(c2) || c1 < 0 || c2 < 0) return null;
  if (board.includes(c1) || board.includes(c2)) return null;

  const combos = enumerateCombos(range, [...board, ...dead]);
  if (combos.length === 0) return null;
  const total = combos.reduce((s, c) => s + c.weight, 0);
  if (!(total > 0)) return null;

  const p = combos
    .filter((c) => (c.card1 === c1 && c.card2 === c2) || (c.card1 === c2 && c.card2 === c1))
    .reduce((s, c) => s + c.weight, 0) / total;

  const avail = totalAvailableCombos(board, dead);
  const u = 1 / combos.length;

  return {
    covered: p > 0,
    weightOfTruth: p,
    uniformWeight: u,
    retainedFraction: avail > 0 ? combos.length / avail : 0,
    // Clamped exactly as the probe clamps it, so a zero-weight combo yields a large
    // negative rather than -Infinity poisoning every downstream mean.
    logLift: Math.log(Math.max(p, 1e-9)) - Math.log(u),
    liveCombos: combos.length,
  };
};
