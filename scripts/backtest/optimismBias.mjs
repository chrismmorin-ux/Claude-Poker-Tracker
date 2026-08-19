/**
 * optimismBias.mjs — the optimizer's curse, measured rather than argued (WS-295).
 *
 * THE CLAIM BEING TESTED. The engine reports the EV of the action it selected. Selection is
 * `argmax` over per-action ESTIMATES, and estimates carry error, so the selected action is
 * disproportionately the one whose error ran favourable:
 *
 *     E[ max_a EVhat(a) ]  >=  max_a E[ EVhat(a) ]
 *
 * The inequality is Jensen's and holds for ANY estimator with noise — it is not a modelling
 * defect to be fixed but a property of the max, and it always points the same way. What is
 * NOT determined a priori is its SIZE, and size is the only thing that decides whether it
 * matters. That is what this module measures.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THE REPLICATE MEAN IS, AND WHAT IT IS NOT.
 *
 * Every figure here is computed from R independent re-evaluations of the SAME node. The
 * per-action mean across replicates, `EVbar(a)`, stands in for the estimand. It is NOT truth:
 * it is the mean of the engine's own estimator, so a bias shared by every replicate — a
 * misspecified villain model, a wrong fold curve, a bad equity approximation — is invisible
 * here by construction. It cancels out of every difference this module reports.
 *
 * CONSEQUENCE, and it must travel with every number: this measures the optimism induced by
 * the estimator's OWN SAMPLING NOISE ONLY, and is therefore a LOWER BOUND on the total curse.
 * Parameter-posterior width (villain model uncertainty) adds a second, strictly additive
 * channel that a replicate design holding the model fixed cannot see.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE THREE QUANTITIES, and why all three are reported.
 *
 *   stated    = E_r[ max_a EVhat_r(a) ]            what the engine TELLS the founder
 *   realized  = E_r[ EVbar( argmax_a EVhat_r(a) ) ]  what the action it chose is WORTH
 *   oracle    = max_a EVbar(a)                     the best available, chosen knowing EVbar
 *
 * From which:
 *
 *   curse         = stated - realized  >= 0    THE HEADLINE — stated EV above delivered value
 *   jensenGap     = stated - oracle    >= 0    the part attributable to the max itself
 *   selectionLoss = oracle - realized  >= 0    the part attributable to choosing wrong
 *   curse = jensenGap + selectionLoss          exactly, by construction
 *
 * Reporting `curse` alone would conflate two different failures with different fixes. A large
 * `jensenGap` with `selectionLoss` near zero means the engine picks the right action and
 * merely overstates it — a reporting problem. A large `selectionLoss` means it picks the
 * wrong action — a decision problem, and far more expensive.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE TWO SHAPE PREDICTIONS. Both are scale-free, which is what makes them testable against
 * an instrument whose levels are on a different unit (see heroEvReport's units note):
 *
 *   1. the gap GROWS with per-action noise      (more noise -> more favourable mis-estimation)
 *   2. the gap SHRINKS as the top-two margin grows (a clear winner cannot be dislodged by noise)
 *
 * A FLAT relationship on either is a refutation and must be reported as one. `flatIsRefutation`
 * is not a comment here — `shapeVerdict` below returns the word.
 */

/** Actions whose EV is identically zero by definition carry no estimator noise. */
const EPSILON = 1e-12;

/**
 * Mean and (sample) standard deviation of a numeric array.
 * @returns {{mean: number, sd: number, n: number}}
 */
export const meanSd = (xs) => {
  const vals = xs.filter(Number.isFinite);
  const n = vals.length;
  if (n === 0) return { mean: null, sd: null, n: 0 };
  const mean = vals.reduce((s, x) => s + x, 0) / n;
  if (n < 2) return { mean, sd: 0, n };
  const varSum = vals.reduce((s, x) => s + (x - mean) ** 2, 0);
  return { mean, sd: Math.sqrt(varSum / (n - 1)), n };
};

/**
 * Decompose the optimizer's curse at ONE node from R replicate evaluations.
 *
 * @param {Array<Object<string, number>>} replicates - one `{action: ev}` map per replicate.
 *        Actions absent from a replicate are treated as NOT AVAILABLE in that replicate and
 *        the replicate is dropped, rather than imputed. An imputed EV would be an invented
 *        estimate entering an argmax whose whole subject is what noisy estimates do to argmax.
 * A FINITE-R ARTEFACT, NAMED because it biases the SPLIT between the two terms and a reader
 * differencing them would otherwise attribute it to the engine. `oracle` is itself an argmax —
 * over R-replicate SAMPLE means — so it carries its own optimism of order sd/sqrt(R). That
 * inflates `selectionLoss` and deflates `jensenGap` by the same amount, leaving their sum
 * `curse` UNAFFECTED. Read `curse` as the headline; read the split as indicative, and more so
 * the larger R is. At tied means the residual `selectionLoss` is entirely this artefact.
 *
 * @returns {Object|null} null when fewer than 2 usable replicates or fewer than 2 actions.
 */
export const nodeOptimism = (replicates) => {
  if (!Array.isArray(replicates) || replicates.length < 2) return null;

  // The action set is the INTERSECTION across replicates. A union would let an action that
  // appeared in one replicate win the max there and have no mean to be scored against.
  let actions = null;
  for (const rep of replicates) {
    const keys = Object.keys(rep || {}).filter((k) => Number.isFinite(rep[k]));
    if (actions === null) actions = new Set(keys);
    else for (const a of [...actions]) if (!keys.includes(a)) actions.delete(a);
  }
  const actionList = [...(actions ?? [])];
  if (actionList.length < 2) return null;

  const R = replicates.length;

  // Per-action mean and noise across replicates.
  const perAction = {};
  for (const a of actionList) {
    perAction[a] = meanSd(replicates.map((rep) => rep[a]));
  }

  const evbar = (a) => perAction[a].mean;

  // oracle: the best action judged on the replicate means.
  let oracleAction = actionList[0];
  for (const a of actionList) if (evbar(a) > evbar(oracleAction)) oracleAction = a;
  const oracle = evbar(oracleAction);

  // stated / realized: per replicate, take the argmax on THAT replicate's estimates, then
  // read its stated value (the estimate) and its worth (the mean).
  let statedSum = 0;
  let realizedSum = 0;
  const pickCounts = {};
  for (const rep of replicates) {
    let best = actionList[0];
    for (const a of actionList) if (rep[a] > rep[best]) best = a;
    statedSum += rep[best];
    realizedSum += evbar(best);
    pickCounts[best] = (pickCounts[best] || 0) + 1;
  }
  const stated = statedSum / R;
  const realized = realizedSum / R;

  // The two covariates the shape predictions are about.
  const sds = actionList.map((a) => perAction[a].sd).filter(Number.isFinite);
  const meanNoiseSd = sds.length ? sds.reduce((s, x) => s + x, 0) / sds.length : null;
  const maxNoiseSd = sds.length ? Math.max(...sds) : null;

  const sortedMeans = actionList.map(evbar).sort((a, b) => b - a);
  const topTwoMargin = sortedMeans.length >= 2 ? sortedMeans[0] - sortedMeans[1] : null;

  return {
    nActions: actionList.length,
    replicates: R,
    stated,
    realized,
    oracle,
    // The three differences. All are >= 0 up to floating-point noise; a negative one is an
    // arithmetic bug, not a finding, and `optimismProblems` refuses a set containing one.
    curse: stated - realized,
    jensenGap: stated - oracle,
    selectionLoss: oracle - realized,
    meanNoiseSd,
    maxNoiseSd,
    topTwoMargin,
    // How often the argmax moved between replicates. 1.0 means noise never changed the
    // decision, in which case `selectionLoss` is necessarily zero and the whole curse is
    // the reporting term.
    argmaxStability: Math.max(...Object.values(pickCounts)) / R,
    oracleAction,
    perAction: Object.fromEntries(actionList.map((a) => [a, {
      meanEv: perAction[a].mean,
      sdEv: perAction[a].sd,
      pickedShare: (pickCounts[a] || 0) / R,
    }])),
  };
};

/**
 * Structural checks on a decomposition. Returned as a list of problems rather than thrown,
 * so a probe writes its artifact and states why the artifact is not quotable — the same
 * contract `resultCardProblems` uses.
 */
export const optimismProblems = (node) => {
  const p = [];
  if (!node) return ['no decomposition — fewer than 2 replicates or fewer than 2 actions'];
  const tol = 1e-9;
  if (node.curse < -tol) p.push(`curse is negative (${node.curse}) — E[max] cannot be below the max of means`);
  if (node.jensenGap < -tol) p.push(`jensenGap is negative (${node.jensenGap})`);
  if (node.selectionLoss < -tol) p.push(`selectionLoss is negative (${node.selectionLoss})`);
  const recomposed = node.jensenGap + node.selectionLoss;
  if (Math.abs(recomposed - node.curse) > 1e-6) {
    p.push(`decomposition does not close: jensenGap + selectionLoss = ${recomposed} != curse ${node.curse}`);
  }
  if (node.replicates < 5) p.push(`${node.replicates} replicates — the noise estimate is itself very noisy below ~5`);
  return p;
};

/**
 * Rank correlation (Spearman) with ties handled by average ranks.
 *
 * A rank correlation rather than a slope, deliberately: the shape predictions are about
 * MONOTONE direction, and a slope in bb-per-bb would invite reading a magnitude off an
 * axis pair whose units do not license one.
 */
export const spearman = (xs, ys) => {
  const pairs = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const n = pairs.length;
  if (n < 3) return null;

  const rank = (vals) => {
    const idx = vals.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(vals.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };

  const rx = rank(pairs.map((p) => p[0]));
  const ry = rank(pairs.map((p) => p[1]));
  const mx = rx.reduce((s, v) => s + v, 0) / n;
  const my = ry.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  if (dx <= EPSILON || dy <= EPSILON) return null;
  return { rho: num / Math.sqrt(dx * dy), n };
};

/**
 * Cluster bootstrap CI for a Spearman rho, resampling CLUSTERS with replacement.
 *
 * Deliberately the same design as `ipsEstimator.clusterBootstrapCI` — nodes from one scenario
 * (or one player) are not independent evidence about the shape, and resampling rows would
 * produce an interval far too narrow. Deterministic LCG for the same reason: an interval that
 * moves between identical runs is worse than no interval.
 */
export const bootstrapRhoCI = (clusters, xKey, yKey, { resamples = 2000, alpha = 0.05, seed = 0x9e3779b9 } = {}) => {
  const keys = [...clusters.keys()];
  const k = keys.length;
  if (k < 2) return null;

  let state = seed >>> 0;
  const nextIdx = (mod) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return Math.floor((state / 0x100000000) * mod);
  };

  const rhos = [];
  for (let b = 0; b < resamples; b++) {
    const xs = [];
    const ys = [];
    for (let i = 0; i < k; i++) {
      for (const row of clusters.get(keys[nextIdx(k)])) { xs.push(row[xKey]); ys.push(row[yKey]); }
    }
    const s = spearman(xs, ys);
    if (s && Number.isFinite(s.rho)) rhos.push(s.rho);
  }
  if (rhos.length < 2) return null;
  rhos.sort((a, b) => a - b);
  const at = (q) => rhos[Math.min(rhos.length - 1, Math.max(0, Math.floor(q * rhos.length)))];
  return { lo: at(alpha / 2), hi: at(1 - alpha / 2), resamples: rhos.length, clusters: k };
};

/**
 * Turn a rho and its CI into the word the accept criteria demand.
 *
 * A CI straddling zero is FLAT, and flat is a REFUTATION of the shape prediction — not a
 * "weak effect", not "directionally consistent". The ticket is explicit that a null here is a
 * publishable outcome, and the only way that survives contact with a reader is for the
 * verdict to be a word in the artifact rather than an inference the reader has to draw.
 *
 * @param {string} predicted - 'positive' or 'negative', the direction the curse predicts
 */
export const shapeVerdict = (rho, ci, predicted, { informativeClusters = null, minInformative = 5 } = {}) => {
  if (rho === null || !ci) return { verdict: 'undetermined', detail: 'no rank correlation or no CI could be computed' };

  // POWER BEFORE VERDICT. A refutation is a CLAIM — "the predicted relationship is not there" —
  // and a sample that could not have detected the relationship has not made that claim. The
  // first run of this probe produced 8 nodes of which 7 had a curse of exactly zero; the
  // bootstrap straddled zero for the obvious reason, and calling that REFUTED-FLAT would have
  // asserted a null the design never had the power to find.
  //
  // This is the repo's recurring failure mode in its statistical costume: a LABEL asserting
  // something the values do not support. `REFUTED` and `UNDERPOWERED` must not be the same word.
  if (informativeClusters !== null && informativeClusters < minInformative) {
    const excl = (ci.lo > 0 && ci.hi > 0) || (ci.lo < 0 && ci.hi < 0);
    return {
      verdict: excl ? 'CONFIRMED-UNDERPOWERED' : 'UNDERPOWERED',
      detail: `only ${informativeClusters} cluster(s) carry a non-degenerate value (bar: ${minInformative}). `
        + `rho ${rho.toFixed(3)}, CI [${ci.lo.toFixed(3)}, ${ci.hi.toFixed(3)}]. `
        + (excl
          ? 'The interval excludes zero, but at this cluster count that is not a result to lean on.'
          : 'This is NOT a refutation — the sample could not have detected the predicted '
            + `${predicted} relationship had it been present. Raise the node count and re-run.`),
    };
  }

  const excludesZero = (ci.lo > 0 && ci.hi > 0) || (ci.lo < 0 && ci.hi < 0);
  if (!excludesZero) {
    return {
      verdict: 'REFUTED-FLAT',
      detail: `rho ${rho.toFixed(3)}, CI [${ci.lo.toFixed(3)}, ${ci.hi.toFixed(3)}] straddles zero. `
        + `The predicted ${predicted} relationship is not present in this sample.`,
    };
  }
  const observed = rho > 0 ? 'positive' : 'negative';
  if (observed !== predicted) {
    return {
      verdict: 'REFUTED-WRONG-SIGN',
      detail: `rho ${rho.toFixed(3)}, CI [${ci.lo.toFixed(3)}, ${ci.hi.toFixed(3)}] excludes zero but is `
        + `${observed}; the curse predicts ${predicted}.`,
    };
  }
  return {
    verdict: 'CONFIRMED',
    detail: `rho ${rho.toFixed(3)}, CI [${ci.lo.toFixed(3)}, ${ci.hi.toFixed(3)}] excludes zero in the `
      + `predicted ${predicted} direction.`,
  };
};

/**
 * Score both shape predictions over a set of per-node decompositions.
 *
 * @param {Array<Object>} nodes - `nodeOptimism` outputs, each carrying a `cluster` key
 */
export const shapeReport = (nodes) => {
  const rows = nodes
    .filter((n) => n && Number.isFinite(n.curse))
    .map((n) => ({
      cluster: n.cluster ?? 'all',
      curse: n.curse,
      noise: n.meanNoiseSd,
      margin: n.topTwoMargin,
      nActions: n.nActions,
    }));

  const clusters = new Map();
  for (const r of rows) {
    if (!clusters.has(r.cluster)) clusters.set(r.cluster, []);
    clusters.get(r.cluster).push(r);
  }

  // A cluster is INFORMATIVE about the curse's shape only if it exhibits a curse at all. A
  // cluster whose curse is exactly zero contributes a tie to every rank correlation and cannot
  // discriminate between the hypothesis and the null — counting it toward power would let a
  // sample of all-zeros look like a large, confidently-flat sample.
  const informativeClusters = [...clusters.values()]
    .filter((rowsIn) => rowsIn.some((r) => Math.abs(r.curse) > 1e-9)).length;

  const build = (key, predicted) => {
    const s = spearman(rows.map((r) => r[key]), rows.map((r) => r.curse));
    const ci = bootstrapRhoCI(clusters, key, 'curse');
    return {
      covariate: key, predicted, rho: s?.rho ?? null, n: s?.n ?? 0, ci, informativeClusters,
      ...shapeVerdict(s?.rho ?? null, ci, predicted, { informativeClusters }),
    };
  };

  return {
    n: rows.length,
    clusters: clusters.size,
    // PREDICTION 1 — more estimator noise, more optimism.
    vsNoise: build('noise', 'positive'),
    // PREDICTION 2 — a wider gap between the top two actions, LESS optimism, because noise
    // can no longer dislodge the winner.
    vsMargin: build('margin', 'negative'),
    // Not a prediction of the curse per se, but the ticket names it: the bias grows with the
    // NUMBER of actions compared. Reported so a flat result there is visible too.
    vsNActions: build('nActions', 'positive'),
  };
};

/**
 * The optimizer's curse from TWO INDEPENDENT ESTIMATES of the same node (WS-496, Option 2).
 *
 * ── WHY THIS EXISTS ALONGSIDE `nodeOptimism` ──
 * `nodeOptimism` values the winning action at the MEAN over replicates, and that mean includes
 * the very replicate that chose it. The contamination is O(1/R) and shrinks as R grows, but it
 * shrinks the measured curse toward zero — the direction that flatters the engine. With R = 6
 * it is a sixth of the estimate.
 *
 * Here the choice and the valuation come from disjoint draws, so there is no in-sample term at
 * any R: pick the argmax on estimate A, then read what estimate B says that action is worth.
 * The expected gap is exactly the optimism, and it is unbiased by construction rather than
 * asymptotically.
 *
 * ── AND WHY IT IS NOT SYNTHETIC AMPLIFICATION ──
 * Resampling a model against itself shrinks the interval around a fixed bias and reports
 * confidence that was never earned. This is the endorsed shape instead — HELD OUT BOTH WAYS.
 * Every pair is scored in both directions and the two are averaged, so no draw is privileged
 * as "the estimate" against the other as "the truth", and a bias present in BOTH draws
 * correctly cancels to zero rather than being counted as optimism.
 *
 * A bias shared by every draw is INVISIBLE here, exactly as it is to `nodeOptimism`. That is a
 * property of the estimand, not a defect of the instrument: this measures the curse induced by
 * variation, so every figure remains a LOWER BOUND on the total.
 *
 * @param {Array<{a: Object, b: Object}>} pairs - per node, two independent {action: ev} maps
 * @returns {Object|null} the decomposition, or null when no pair carries two shared actions
 */
export const heldOutOptimism = (pairs) => {
  if (!Array.isArray(pairs) || pairs.length === 0) return null;

  const oneWay = (chooseOn, valueOn) => {
    // Intersection, for the reason `nodeOptimism` states: an action present in only one draw
    // could win the max there with nothing to be scored against.
    const acts = Object.keys(chooseOn)
      .filter((k) => Number.isFinite(chooseOn[k]) && Number.isFinite(valueOn[k]));
    if (acts.length < 2) return null;
    let best = acts[0];
    for (const a of acts) if (chooseOn[a] > chooseOn[best]) best = a;
    return { stated: chooseOn[best], heldOut: valueOn[best], action: best, nActions: acts.length };
  };

  const gaps = [];
  const picks = {};
  let nActions = 0;
  let flips = 0;
  let comparable = 0;

  for (const { a, b } of pairs) {
    const ab = oneWay(a, b);
    const ba = oneWay(b, a);
    if (!ab || !ba) continue;
    comparable++;
    nActions = Math.max(nActions, ab.nActions);
    // Both directions, averaged — see the note above on why neither draw is the truth.
    gaps.push(ab.stated - ab.heldOut, ba.stated - ba.heldOut);
    picks[ab.action] = (picks[ab.action] || 0) + 1;
    picks[ba.action] = (picks[ba.action] || 0) + 1;
    // How often the two independent draws disagree about which action is best. This is the
    // decision-relevant number: a curse that never changes the pick costs nothing at the table.
    if (ab.action !== ba.action) flips++;
  }

  if (!gaps.length) return null;
  const { mean, sd } = meanSd(gaps);
  return {
    nodes: comparable,
    draws: gaps.length,
    nActions,
    // THE HEADLINE. Positive means the engine's stated EV for the action it picks exceeds what
    // an independent estimate of that same action says it is worth.
    curse: mean,
    curseSd: sd,
    // Standard error of the mean, so the interval can be read without re-deriving it. Pairs
    // contribute two correlated draws, so n is the PAIR count, not the draw count.
    curseSe: comparable > 1 ? sd / Math.sqrt(comparable) : null,
    // The share of nodes where two independent estimates disagree on the best action. When
    // this is 0 the curse is entirely a reporting error: the decision was never at risk.
    argmaxFlipRate: comparable ? flips / comparable : null,
    pickShare: Object.fromEntries(
      Object.entries(picks).map(([a, n]) => [a, n / gaps.length]),
    ),
  };
};
