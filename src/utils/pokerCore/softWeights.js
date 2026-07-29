/**
 * softWeights.js — mean-pinned logistic weighting over an arbitrary score.
 *
 * Extracted from `exploitEngine/postflopNarrower.js` (WS-302) so that BOTH engines can
 * reach it. `rangeEngine` must not import from `exploitEngine` — that direction does not
 * exist anywhere in the repo and would invert the layering — but `rangeEngine/
 * populationPriors.js` needs exactly this primitive to give its preflop priors support
 * everywhere. `pokerCore/` is where shared infrastructure of this kind already lives
 * (`monteCarloEquity.js`, `rangeMatrix.js`, `handEvaluator.js`, `cardParser.js`).
 *
 * The module knows nothing about combos, boards, actions or positions. It turns scores
 * into probabilities. Callers supply the meaning.
 */

/**
 * Minimum weight. Nothing is ever ruled out.
 *
 * RANGE_ENGINE_DESIGN.md 4.3 forbids excluding a hand outright and offers
 * P(limp | AA) = 0.05 as its "rare but not zero" illustration.
 *
 * MEASURED, NOT PICKED (WS-291, 2026-07-28). Swept 0.01 → 0.40 through the WS-293
 * calibration probe against revealed showdown hands, every arm scored on the SAME
 * decisions. Coverage is 100% for any positive floor, so the ranking metric is
 * discrimination — mean log P of the hand actually held, vs uniform, given covered:
 *
 *     floor   0.01    0.03    0.05    0.10    0.15    0.25    0.40
 *     FTP    +0.227  +0.242  +0.251  +0.253  +0.239  +0.252  +0.213   (n=974)
 *     PS     +0.104  +0.113  +0.117  +0.105  +0.090  +0.103  +0.074   (n=866)
 *
 * Confirmed at ~8x the sample on the three values that mattered:
 *
 *     floor   0.03    0.05    0.10
 *     FTP    +0.205  +0.210  +0.202   (n=7793)
 *     PS     +0.163  +0.167  +0.157   (n=6194)
 *
 * 0.05 is the argmax on BOTH sites at BOTH sample sizes. State the honest caveat with the
 * number: the margin is ~0.005 nats and the wide grid is flat and non-monotone across
 * 0.03–0.25. The finding is "move off zero and land somewhere sane", not "0.05 is
 * special". Re-run the sweep before treating any refinement of this value as real.
 */
export const MIN_CONTINUATION_WEIGHT = 0.05;

/**
 * Logistic softness, as a fraction of the score spread. MEASURED, not chosen.
 *
 * Swept against 2,032 revealed villain hands at identical coverage, so mean log P of the
 * hand actually held is directly comparable across arms (WS-291):
 *
 *     tau    0.10     0.15     0.30     0.60     1.50     10 (~no narrowing)
 *     dlog  -1.874   -1.792   -1.636   -1.590   -1.605   -1.644
 *
 * Two things that table says, and the second is uncomfortable:
 *
 *   1. The optimum is ~0.60 and the curve is FLAT — 0.30 to 1.50 sit within 0.05 nats.
 *   2. Sharpening toward the old hard cut makes it monotonically WORSE, and anything
 *      below ~0.30 is beaten by tau = 10, which is equity-based narrowing switched OFF.
 *      The equity ordering carries real but SMALL information, and the shipped
 *      parameterisation was extracting less than nothing from it.
 *
 * Same shape of result as WS-285: an elaborate mechanism, never measured, performing
 * worse than the trivial alternative.
 *
 * WHY 0.30 AND NOT THE OPTIMAL 0.60. At 0.60 the check branch's U-shape collapses — the
 * trap slice stops being more likely to check than the middle of the range, so the model
 * can no longer represent a slowplay at all. That costs a real poker capability
 * (bluff-catching against a trapper) to buy 0.046 nats on a proxy metric measured over
 * SHOWDOWN hands with default continuation rates. 0.30 is the softest setting that still
 * beats no-narrowing AND keeps the U. Whether that trade is right is a live question for
 * WS-293's standing instrument — re-run the sweep, do not re-reason it.
 */
export const TAU_FRACTION = 0.3;

export const sigmoid = (x) => 1 / (1 + Math.exp(-x));

export const quantile = (sortedAsc, q) => {
  if (sortedAsc.length === 0) return 0;
  const i = Math.min(sortedAsc.length - 1, Math.max(0, Math.round(q * (sortedAsc.length - 1))));
  return sortedAsc[i];
};

/**
 * Turn scores into probabilities whose MEAN equals `targetMean`.
 *
 * The mean is pinned rather than approximated because the target carries real information.
 * Postflop it is the villain's observed continuation frequency (`gameTreeContext` passes
 * `dist.actions.call + dist.actions.raise`); preflop it is the prior grid's own range
 * width (WS-302). Smoothing the decision boundary must not also, silently, move the
 * aggregate. So the shape becomes soft while the total stays exactly where the evidence
 * put it.
 *
 * theta is found by bisection on a monotone function: raising theta lowers every
 * sigmoid, so it lowers the mean. ~40 iterations gives machine-adequate precision.
 *
 * @param {Float64Array|number[]} scores - higher = more likely
 * @param {number} targetMean - the mean the returned weights must have
 * @param {{ floor?: number, tauFraction?: number }} [opts]
 * @returns {Float64Array} weights in [floor, 1], mean == targetMean
 */
export const softContinuationWeights = (scores, targetMean, opts = {}) => {
  const requestedFloor = Number.isFinite(opts.floor) ? opts.floor : MIN_CONTINUATION_WEIGHT;
  const tauFraction = Number.isFinite(opts.tauFraction) ? opts.tauFraction : TAU_FRACTION;
  const n = scores.length;
  const w = new Float64Array(n);
  if (n === 0) return w;

  // The floor must leave HEADROOM below the target mean, or the likelihood stops being a
  // likelihood. `continuationRate` is clamped to a minimum of 0.05 and the measured floor
  // is also 0.05, so a villain whose observed continuation rate sits at that clamp would
  // otherwise land on target = 0 and get a flat range: every combo weighted identically,
  // the action treated as telling us nothing about which hand villain holds. A rare action
  // is weak evidence, not no evidence — it should sharpen the range, not erase the read.
  //
  // The same guard does the load-bearing work preflop (WS-302), where the target mean IS
  // the range width: a 1%-wide threeBet prior takes a floor of ~0.009, not 0.05, so
  // "a live 3-bet is almost always a monster" (POKER_THEORY 2.3) survives the change.
  const floor = Math.min(requestedFloor, targetMean * 0.9);

  // Mean of the logistic part needed to land the overall mean on target.
  const target = (targetMean - floor) / (1 - floor);
  if (!(target > 0)) { w.fill(floor); return w; }
  if (target >= 1) { w.fill(1); return w; }

  const asc = Array.from(scores).sort((a, b) => a - b);
  const spread = Math.max(1e-6, quantile(asc, 0.75) - quantile(asc, 0.25));
  const tau = spread * tauFraction;

  const meanSigmoidAt = (theta) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += sigmoid((scores[i] - theta) / tau);
    return s / n;
  };

  // Bracket wide enough that the mean spans (0, 1) across it.
  let lo = asc[0] - 10 * tau;
  let hi = asc[n - 1] + 10 * tau;
  for (let it = 0; it < 40; it++) {
    const mid = (lo + hi) / 2;
    if (meanSigmoidAt(mid) > target) lo = mid; else hi = mid;
  }
  const theta = (lo + hi) / 2;

  for (let i = 0; i < n; i++) {
    w[i] = floor + (1 - floor) * sigmoid((scores[i] - theta) / tau);
  }
  return w;
};
