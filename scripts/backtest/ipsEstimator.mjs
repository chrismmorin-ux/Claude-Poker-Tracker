/**
 * ipsEstimator.mjs — off-policy value of the engine's advice, from realized chips.
 *
 * WHAT IS BEING ESTIMATED (WS-287, founder decision 2026-07-28).
 *
 *   "Take our advice at THIS ONE decision, then the hand plays on as it actually did."
 *
 * That sentence is the whole contract, and every figure this module produces carries it
 * as `TREATMENT`. The corpus records what the 2009 player did, not what our advice would
 * have led to, so the value of our policy is not directly observable. Per-decision
 * importance sampling recovers it without inventing continuations:
 *
 *     w_d  = pi_ours(a_d | s_d) / pi_pool(a_d | s_d)
 *     V    = sum(w_d * R_d) / sum(w_d)          <- self-normalized (WIS), headline
 *     edge = V(pi_ours) - V(pi_pool)
 *
 * `R_d` is the hero seat's REALIZED net for that hand in bb (handOutcome.mjs). Because
 * pi_pool IS the behaviour policy, V(pi_pool) reduces to the plain sample mean of R_d —
 * which is a free correctness check on the whole estimator and is asserted by test.
 *
 * UNITS. `R_d` is the whole HAND's net, so the estimand is expected hand value evaluated
 * at the decision level — NOT a per-decision increment. A hand containing three scored
 * decisions contributes its net three times, once per decision.
 *
 * THAT REPETITION IS A VARIANCE FACT, NOT A LEVEL FACT — and this docblock asserted the
 * opposite for months. It used to say that reading `edgeBB` as a winrate "overstates it by
 * roughly the decisions-per-hand factor". **Measured and false** (WS-428): duplicate every
 * decision, so decisions-per-hand doubles while the hands and the strategy are unchanged,
 * and `edge` does not move — 8.171 at 1x, 2x and 4x. It cannot be inflated by a factor it
 * carries no dependence on. Both `wisValue` and `poolValue` are convex combinations —
 * their weights sum to one — so each sits on the scale of ONE hand's net, and
 * self-normalization cancels the repetition exactly. The claim propagated verbatim into
 * three other files before it was tested.
 *
 * What the repetition DOES cause is correlation between a hand's decisions, which is why
 * `n` overstates precision and why the cluster bootstrap is mandatory. That is the true
 * statement the false one was a corruption of.
 *
 * THERE IS A REAL LEVEL DISTORTION, AND IT IS A DIFFERENT ONE. Because `d` is uniform over
 * decisions, this is a DECISION-WEIGHTED average of hand nets, not a hand-weighted one.
 * Measured on `out/hero-ev-44players-PARTIAL-650dec.json`: reweighting by `1/k_h` moves the
 * edge 3.6878 -> 1.1626, a factor of 3.17 — and NOT via `k̄ = 2.38`, because the tilt is
 * through scale rather than location (`corr(k, R) = 0.008`, while mean |R| by decision
 * count runs 8.55 / 10.04 / 10.07 / 22.14 / 30.30). Long hands are big-pot hands, so
 * decision-weighting concentrates the estimator on the fat tail.
 *
 * AND THE SCORED POPULATION IS SELECTED. A scored decision requires hero to have
 * voluntarily reached postflop with a fitted range, so `valuePoolBB` is not ~0 as a field's
 * realized mean must be — it is positive. Any per-hand figure built on this must be
 * denominated in hands DEALT (`handLedger.mjs`), not hands scored, and the field-winrate
 * anchor there is what makes a violation visible.
 *
 * (`ipsEstimator.mjs` also asserts below that "a hand belongs to exactly one scored
 * player". That is false by construction — measured at 2.91 EVAL players per hand — and is
 * tracked separately; the cluster bootstrap's independence assumption does not hold.)
 *
 * THE BIAS, NAMED. The horizon is one decision. Everything downstream of the scored
 * node is the field's play, not ours, so this measures the value of substituting our
 * action at a single node into an otherwise-2009 hand. It does NOT measure the value of
 * playing our whole strategy. That is a real limitation and also the right unit for a
 * curriculum, which is learned one decision at a time.
 *
 * WHY SELF-NORMALIZED. Plain IPS is unbiased but its variance is unusable when some
 * propensities are small — a single rare action with pi_pool = 0.01 contributes a
 * weight of 100 and swamps the sample. WIS trades a small, vanishing bias for a large
 * variance reduction. Both are reported; WIS is the headline, and the gap between them
 * is itself a diagnostic.
 *
 * WHY CLIPPING AND ESS. Clipping bounds the influence of any single decision; the
 * clipped share is reported so a number propped up by clipping is visible. Effective
 * sample size, `ESS = (sum w)^2 / sum(w^2)`, is the honest denominator: 10,000
 * decisions at ESS 40 is a 40-decision result wearing a large n, and reporting n alone
 * would badly overstate the precision.
 *
 * WHY THE BOOTSTRAP RESAMPLES PLAYERS. Decisions within one player are correlated —
 * same tendencies, often the same session, sometimes the same hand. Resampling
 * decisions independently would treat those as independent evidence and produce an
 * interval far too narrow. The cluster bootstrap resamples whole players, which is the
 * level at which the corpus is actually independent.
 */

/** Attached to every figure. A number without a treatment is not a result. */
export const TREATMENT = 'per-decision IPS · one-decision horizon · pool continuation · range-marginalized policy';

/** Default cap on a single importance weight. */
export const DEFAULT_WEIGHT_CAP = 20;

/** Why a decision could not be scored. Counted, never silently dropped. */
export const SCORE_SKIP_REASONS = {
  ZERO_PROPENSITY: 'zero-propensity',
  MISSING_OUTCOME: 'missing-outcome',
  MISSING_POLICY: 'missing-policy',
  NON_FINITE: 'non-finite',
};

const EPSILON = 1e-12;

/**
 * Build the importance weight for one decision.
 *
 * @param {Object} d - { piOurs: {a: p}, piPool: {a: p}, observedAction, netBB, playerId }
 * @returns {{ok: true, w, raw, clipped, net}|{ok: false, reason}}
 */
export const weightFor = (d, { weightCap = DEFAULT_WEIGHT_CAP } = {}) => {
  if (!d?.piOurs || !d?.piPool) return { ok: false, reason: SCORE_SKIP_REASONS.MISSING_POLICY };
  if (!Number.isFinite(d.netBB)) return { ok: false, reason: SCORE_SKIP_REASONS.MISSING_OUTCOME };

  const pOurs = d.piOurs[d.observedAction];
  const pPool = d.piPool[d.observedAction];
  if (!Number.isFinite(pOurs) || !Number.isFinite(pPool)) {
    return { ok: false, reason: SCORE_SKIP_REASONS.NON_FINITE };
  }
  // A propensity of zero means the behaviour policy says this action never happens
  // here — yet it did. The ratio is undefined, so the decision is dropped and counted
  // rather than divided by. (pi_ours = 0 is fine: the weight is legitimately zero,
  // meaning our policy would never take the observed action, so the hand carries no
  // evidence about our policy's value.)
  if (pPool <= EPSILON) return { ok: false, reason: SCORE_SKIP_REASONS.ZERO_PROPENSITY };

  const raw = pOurs / pPool;
  const w = Math.min(raw, weightCap);
  return { ok: true, w, raw, clipped: raw > weightCap, net: d.netBB };
};

/**
 * Deterministic LCG. A backtest must reproduce exactly; an interval that moves between
 * identical runs is worse than no interval. Same generator as evCost.bootstrapMeanCI.
 */
/**
 * The bootstrap seed, named and exported (WS-322).
 *
 * It was already this value in two places as an inline default and was never written to any
 * output file. A replication manifest has to record the seed a run ACTUALLY used, and the only
 * way to do that without the manifest holding its own guess is for the seed to have a name
 * something else can import.
 */
export const DEFAULT_BOOTSTRAP_SEED = 0x9e3779b9;

const lcg = (seed) => {
  let state = seed >>> 0;
  return (mod) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    // Take the HIGH bits, not `state % mod`. A linear congruential generator with a
    // power-of-two modulus has notoriously short periods in its low bits — bit k
    // repeats with period 2^(k+1) — so `% mod` for a small power-of-two `mod` returns
    // a fixed cycle rather than a sample. With 4 clusters it yields 0,1,2,3,0,1,2,3…,
    // so every "resample" draws one of each cluster and the interval collapses to zero
    // width: a CI that looks impossibly precise for the worst possible reason.
    return Math.floor((state / 0x100000000) * mod);
  };
};

/**
 * Cluster bootstrap CI for a statistic computed over weighted decisions.
 *
 * Resamples PLAYERS with replacement, then recomputes the statistic over all decisions
 * belonging to the drawn players. See the header for why the cluster is the player.
 *
 * @param {Map<string, Array>} byPlayer - playerId -> scored decisions
 * @param {Function} statOf - (decisions) => number|null
 */
export const clusterBootstrapCI = (byPlayer, statOf, {
  resamples = 2000, alpha = 0.05, seed = DEFAULT_BOOTSTRAP_SEED,
} = {}) => {
  const players = [...byPlayer.keys()];
  const k = players.length;
  if (k < 2) return null;

  const nextIdx = lcg(seed);
  const stats = [];
  for (let b = 0; b < resamples; b++) {
    const drawn = [];
    for (let i = 0; i < k; i++) {
      const chunk = byPlayer.get(players[nextIdx(k)]);
      for (let j = 0; j < chunk.length; j++) drawn.push(chunk[j]);
    }
    const s = statOf(drawn);
    if (Number.isFinite(s)) stats.push(s);
  }
  if (stats.length < 2) return null;
  stats.sort((a, b) => a - b);

  const at = (q) => stats[Math.min(stats.length - 1, Math.max(0, Math.floor(q * stats.length)))];
  return { lo: at(alpha / 2), hi: at(1 - alpha / 2), resamples: stats.length, clusters: k };
};

/** Self-normalized (weighted) IPS value over a set of scored decisions. */
export const wisValue = (scored) => {
  let sw = 0, swr = 0;
  for (const s of scored) { sw += s.w; swr += s.w * s.net; }
  return sw > EPSILON ? swr / sw : null;
};

/** Plain (Horvitz-Thompson) IPS value. Unbiased, high variance. */
export const ipsValue = (scored) => {
  if (!scored.length) return null;
  let swr = 0;
  for (const s of scored) swr += s.w * s.net;
  return swr / scored.length;
};

/** Behaviour-policy value: the plain mean of realized outcomes. */
export const poolValue = (scored) => {
  if (!scored.length) return null;
  let sr = 0;
  for (const s of scored) sr += s.net;
  return sr / scored.length;
};

/**
 * Score a set of decisions and produce the edge with a cluster-bootstrapped CI.
 *
 * @param {Array} decisions - { piOurs, piPool, observedAction, netBB, playerId, handId }
 * @param {Object} opts
 * @returns {Object} report — every figure carries `treatment`
 */
export const estimateEdge = (decisions, {
  weightCap = DEFAULT_WEIGHT_CAP,
  resamples = 2000,
  alpha = 0.05,
  seed = DEFAULT_BOOTSTRAP_SEED,
  label = null,
} = {}) => {
  const scored = [];
  const byPlayer = new Map();
  const skipped = {};
  let clippedCount = 0;

  for (const d of decisions) {
    const r = weightFor(d, { weightCap });
    if (!r.ok) { skipped[r.reason] = (skipped[r.reason] || 0) + 1; continue; }
    if (r.clipped) clippedCount++;
    const rec = { w: r.w, raw: r.raw, net: r.net, playerId: d.playerId };
    scored.push(rec);
    let bucket = byPlayer.get(d.playerId);
    if (!bucket) byPlayer.set(d.playerId, (bucket = []));
    bucket.push(rec);
  }

  const n = scored.length;
  if (n === 0) {
    return {
      treatment: TREATMENT, label, n: 0, skipped,
      note: 'no scorable decisions',
    };
  }

  let sw = 0, sw2 = 0;
  for (const s of scored) { sw += s.w; sw2 += s.w * s.w; }
  const ess = sw2 > EPSILON ? (sw * sw) / sw2 : 0;

  const vOurs = wisValue(scored);
  const vPool = poolValue(scored);
  const vIps = ipsValue(scored);
  const edge = (vOurs !== null && vPool !== null) ? vOurs - vPool : null;

  // The CI is taken on the EDGE, not on the two values separately: the same decisions
  // feed both, so the difference is far better determined than either level, and C3
  // asks whether the DIFFERENCE excludes zero.
  const edgeStat = (chunk) => {
    const a = wisValue(chunk);
    const b = poolValue(chunk);
    return (a !== null && b !== null) ? a - b : null;
  };
  const ci = clusterBootstrapCI(byPlayer, edgeStat, { resamples, alpha, seed });

  return {
    treatment: TREATMENT,
    label,
    n,
    players: byPlayer.size,
    ess: Number(ess.toFixed(1)),
    essShare: Number((ess / n).toFixed(4)),
    weightCap,
    clippedShare: Number((clippedCount / n).toFixed(4)),
    meanWeight: Number((sw / n).toFixed(4)),
    valueOursBB: vOurs === null ? null : Number(vOurs.toFixed(4)),
    valuePoolBB: vPool === null ? null : Number(vPool.toFixed(4)),
    valueOursPlainIpsBB: vIps === null ? null : Number(vIps.toFixed(4)),
    edgeBB: edge === null ? null : Number(edge.toFixed(4)),
    // WS-428: renamed from `edgeBBPer100`, which the spec called a landmine — "a bare
    // rescale with no denominator change". The diagnosis was wrong and the name was the
    // whole problem. `edge` IS per scored decision, so `edge x 100` is denominator-
    // consistent: it is bb per 100 SCORED DECISIONS, the same quantity `evCost.mjs:203`
    // already names `bbPer100Decisions`. What it is not, and what the old name invited a
    // reader to take it for, is a WINRATE. Deleting a correct field because its name lied
    // would have removed the only correctly-denominated per-100 figure this file produces.
    //
    // The per-100-HANDS figure is a different quantity with a different denominator, and
    // it is NOT this number times anything: see `handLedger.mjs` for the denominator and
    // why hands dealt is not hands scored.
    edgeBBPer100Decisions: edge === null ? null : Number((edge * 100).toFixed(2)),
    edgeCiLowBB: ci ? Number(ci.lo.toFixed(4)) : null,
    edgeCiHighBB: ci ? Number(ci.hi.toFixed(4)) : null,
    ciResamples: ci?.resamples ?? 0,
    skipped,
  };
};
