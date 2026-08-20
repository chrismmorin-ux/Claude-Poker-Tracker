/**
 * emRecovery.mjs — WS-526 / F1. CAN A FOLD BRANCH BE RECOVERED FROM ACTION DATA ALONE?
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE QUESTION, STATED AS THE CORRECTION RATHER THAN AS THE CLAIM
 *
 * The design record (docs/research/villain-strategy-inference-2026-08-17.md §5.2) argues that
 * pi(a | s, h) is identifiable even though a folded hand never reveals its holding, because
 * (a) P(h) at the root is exact, (b) the action sequence is observed for EVERY hand, and
 * (c) branch ranges partition the parent range, so the folding branch is identified by
 * subtraction.
 *
 * THAT ARGUMENT IS UNCHECKED REASONING BY THE AUTHOR OF THE DESIGN RECORD, and it is
 * suspicious precisely because it explains three separate measured failures with one cause.
 * The DEFAULT expectation — that a hand which never reveals tells you nothing about which
 * holding folded — is given a fair chance to win here.
 *
 * Nothing downstream (WS-527 onward) is funded until this returns.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A KNOWN-ANSWER ANCHOR AND NOT A CORPUS RUN
 *
 * On the corpus there is no ground truth: the villain's true policy is exactly the unknown.
 * A corpus EM that converges tells you it converged, not that it converged to the truth.
 * So the policy is KNOWN here by construction, hands are generated from it, and the fitted
 * policy is scored against the generator.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE THREE INSTRUMENTS, AND WHY ERROR ALONE IS THE WEAKEST OF THEM
 *
 *  1. RECOVERY ERROR. |theta_hat - theta_true| per cell, fold cells reported separately from
 *     continue cells so the fold branch is read against a same-run control.
 *
 *  2. THE EXACT ARM (no sampling at all). Observation types are FINITE, so the expected
 *     histogram is computed in closed form instead of simulated. At that arm there is zero
 *     Monte Carlo error, so a failure to recover is NON-IDENTIFICATION and cannot be answered
 *     with "collect more hands". Added AFTER pre-registration as a diagnostic; it makes the
 *     verdict STRICTER, never looser, and the pre-registered verdict still keys on headlineN.
 *
 *  3. MULTI-START LIKELIHOOD RIDGE DETECTION — the sharpest of the three, and the only one
 *     that speaks to identifiability DIRECTLY rather than by inference from error. A model is
 *     non-identified exactly when distinct parameter settings produce the SAME likelihood. So
 *     EM is run from many random starts: if they reach equal log-likelihood at DIFFERENT
 *     parameters, the likelihood has a ridge and the fold branch is not identified, whatever
 *     the error number says on any single run.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE LOAD-BEARING ASSUMPTION, NAMED RATHER THAN BURIED
 *
 * The estimator is GIVEN the class prior and the class-transition matrix as exact. That
 * mirrors the real claim — P(h) at the root is exact combinatorics and the board is observed,
 * so how holding strength migrates across a runout is known rather than fitted. If T were
 * also unknown this would be a strictly harder problem than the one under test.
 */

/** Seeded RNG. Every arm carries its seed into the Result Card. */
export const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const STREETS = 3;
export const CLASSES = Object.freeze(['strong', 'medium', 'weak']);
export const ACTIONS = Object.freeze(['fold', 'call', 'raise']);
export const CONTINUE = Object.freeze(['call', 'raise']);

/** Class prior at the flop. Exact, and supplied to the estimator (see header). */
export const PRIOR = Object.freeze([0.20, 0.45, 0.35]);

/** Class transition across a runout. Exact, and supplied to the estimator. */
export const TRANSITION = Object.freeze([
  Object.freeze([0.75, 0.20, 0.05]),
  Object.freeze([0.15, 0.65, 0.20]),
  Object.freeze([0.05, 0.20, 0.75]),
]);

/**
 * The ground-truth villain. theta[street][class] = {fold, call, raise}.
 *
 * Deliberately NOT symmetric and NOT smooth across streets: a policy that is a simple function
 * of street or class could be recovered by a fitter that had learned the shape rather than the
 * data. The river weak-raise at 6% is the bluff, and it is the hardest cell in the table.
 */
export const TRUE_POLICY = Object.freeze([
  Object.freeze([
    Object.freeze({ fold: 0.02, call: 0.76, raise: 0.22 }),
    Object.freeze({ fold: 0.25, call: 0.69, raise: 0.06 }),
    Object.freeze({ fold: 0.62, call: 0.35, raise: 0.03 }),
  ]),
  Object.freeze([
    Object.freeze({ fold: 0.03, call: 0.71, raise: 0.26 }),
    Object.freeze({ fold: 0.35, call: 0.60, raise: 0.05 }),
    Object.freeze({ fold: 0.72, call: 0.26, raise: 0.02 }),
  ]),
  Object.freeze([
    Object.freeze({ fold: 0.05, call: 0.65, raise: 0.30 }),
    Object.freeze({ fold: 0.55, call: 0.41, raise: 0.04 }),
    Object.freeze({ fold: 0.85, call: 0.09, raise: 0.06 }),
  ]),
]);

/** A materially different policy. Used ONLY by the mismatch negative control. */
export const DECOY_POLICY = Object.freeze([
  Object.freeze([
    Object.freeze({ fold: 0.30, call: 0.55, raise: 0.15 }),
    Object.freeze({ fold: 0.10, call: 0.80, raise: 0.10 }),
    Object.freeze({ fold: 0.20, call: 0.70, raise: 0.10 }),
  ]),
  Object.freeze([
    Object.freeze({ fold: 0.40, call: 0.45, raise: 0.15 }),
    Object.freeze({ fold: 0.15, call: 0.75, raise: 0.10 }),
    Object.freeze({ fold: 0.25, call: 0.65, raise: 0.10 }),
  ]),
  Object.freeze([
    Object.freeze({ fold: 0.50, call: 0.35, raise: 0.15 }),
    Object.freeze({ fold: 0.20, call: 0.70, raise: 0.10 }),
    Object.freeze({ fold: 0.30, call: 0.60, raise: 0.10 }),
  ]),
]);

/**
 * A hand is fully described, for likelihood purposes, by its action sequence plus — only if it
 * reached showdown — the class trajectory showdown revealed. Those combinations are FINITE, so
 * the corpus collapses to a histogram with no loss. That is what makes the exact arm possible.
 *
 * key format: "<a0,a1,...>|<h0,h1,h2 or ->"
 */
export const obsKey = (actions, revealed) => `${actions.join(',')}|${revealed ? revealed.join(',') : '-'}`;

/** Every observation type with its exact probability under a policy. */
export const enumerateObservations = (policy, prior = PRIOR, T = TRANSITION) => {
  const out = new Map();
  const K = prior.length;
  const NS = policy.length;
  const add = (key, p, actions, revealed) => {
    const prev = out.get(key);
    if (prev) prev.p += p;
    else out.set(key, { p, actions, revealed });
  };
  const walk = (t, h, actions, traj, prob) => {
    const th = policy[t][h];
    if (th.fold > 0) {
      const acts = [...actions, 'fold'];
      add(obsKey(acts, null), prob * th.fold, acts, null);
    }
    for (const a of CONTINUE) {
      const pa = th[a];
      if (pa <= 0) continue;
      const acts = [...actions, a];
      const np = prob * pa;
      if (t === NS - 1) {
        add(obsKey(acts, traj), np, acts, [...traj]);
      } else {
        for (let h2 = 0; h2 < K; h2++) {
          if (T[h][h2] > 0) walk(t + 1, h2, acts, [...traj, h2], np * T[h][h2]);
        }
      }
    }
  };
  for (let h = 0; h < K; h++) if (prior[h] > 0) walk(0, h, [], [h], prior[h]);
  return out;
};

/**
 * Sample N hands into a histogram over observation types.
 *
 * THE LEAK GUARD IS STRUCTURAL, NOT A COMMENT. A folded hand's trajectory is never written
 * into the returned histogram — its key carries "-" — so there is no field for the estimator
 * to read even by accident. `oracle: true` reveals every trajectory and is the positive
 * control; the two arms differ in this one flag and nothing else.
 */
export const sampleHistogram = (N, policy, seed, { oracle = false, prior = PRIOR, T = TRANSITION } = {}) => {
  const rng = mulberry32(seed);
  const pick = (probs) => {
    const r = rng();
    let acc = 0;
    for (let i = 0; i < probs.length; i++) { acc += probs[i]; if (r < acc) return i; }
    return probs.length - 1;
  };
  const hist = new Map();
  let showdowns = 0;
  for (let n = 0; n < N; n++) {
    let h = pick(prior);
    const traj = [h];
    const actions = [];
    let folded = false;
    for (let t = 0; t < policy.length; t++) {
      const th = policy[t][h];
      const ai = pick([th.fold, th.call, th.raise]);
      actions.push(ACTIONS[ai]);
      if (ai === 0) { folded = true; break; }
      if (t < policy.length - 1) { h = pick(T[h]); traj.push(h); }
    }
    if (!folded) showdowns++;
    const revealed = (!folded || oracle) ? traj : null;
    const key = obsKey(actions, revealed);
    hist.set(key, (hist.get(key) || 0) + 1);
  }
  return { hist, N, showdowns, showdownRate: showdowns / N };
};

/** The exact (N = infinity) histogram: expected mass with zero sampling noise. */
export const exactHistogram = (policy, { oracle = false, prior = PRIOR, T = TRANSITION } = {}) => {
  const hist = new Map();
  const K = prior.length;
  const NS = policy.length;
  let showdowns = 0;
  const walk = (t, h, actions, traj, prob) => {
    const th = policy[t][h];
    if (th.fold > 0) {
      const acts = [...actions, 'fold'];
      const key = obsKey(acts, oracle ? traj : null);
      hist.set(key, (hist.get(key) || 0) + prob * th.fold);
    }
    for (const a of CONTINUE) {
      const pa = th[a];
      if (pa <= 0) continue;
      const acts = [...actions, a];
      const np = prob * pa;
      if (t === NS - 1) {
        showdowns += np;
        const key = obsKey(acts, traj);
        hist.set(key, (hist.get(key) || 0) + np);
      } else {
        for (let h2 = 0; h2 < K; h2++) {
          if (T[h][h2] > 0) walk(t + 1, h2, acts, [...traj, h2], np * T[h][h2]);
        }
      }
    }
  };
  for (let h = 0; h < K; h++) if (prior[h] > 0) walk(0, h, [], [h], prior[h]);
  return { hist, N: 1, showdowns, showdownRate: showdowns, exact: true };
};

const parseKey = (key) => {
  const [aPart, hPart] = key.split('|');
  return { actions: aPart.split(','), revealed: hPart === '-' ? null : hPart.split(',').map(Number) };
};

const uniformPolicy = (NS = STREETS, K = CLASSES.length) => Array.from({ length: NS }, () =>
  Array.from({ length: K }, () => ({ fold: 1 / 3, call: 1 / 3, raise: 1 / 3 })));

const randomPolicy = (rng, NS = STREETS, K = CLASSES.length) => Array.from({ length: NS }, () =>
  Array.from({ length: K }, () => {
    const v = [rng(), rng(), rng()];
    const s = v[0] + v[1] + v[2];
    return { fold: v[0] / s, call: v[1] / s, raise: v[2] / s };
  }));

/**
 * One EM pass over the histogram. Returns {counts, logLik}.
 *
 * Forward-backward over the truncated class chain. A hand that folded at street k has an
 * unobserved trajectory h_0..h_k, and every street it survived still contributes evidence
 * about the policy — which is the mechanism the whole claim rests on. A showdown hand's
 * trajectory is observed outright and contributes a hard count.
 */
export const emStep = (hist, policy, { prior = PRIOR, T = TRANSITION } = {}) => {
  const K = prior.length;
  const counts = Array.from({ length: policy.length }, () =>
    Array.from({ length: K }, () => ({ fold: 0, call: 0, raise: 0 })));
  let logLik = 0;

  for (const [key, w] of hist) {
    if (!(w > 0)) continue;
    const { actions, revealed } = parseKey(key);
    const L = actions.length;

    if (revealed && revealed.length === L) {
      let lp = Math.log(prior[revealed[0]]);
      for (let t = 0; t < L; t++) {
        counts[t][revealed[t]][actions[t]] += w;
        lp += Math.log(policy[t][revealed[t]][actions[t]]);
        if (t > 0) lp += Math.log(T[revealed[t - 1]][revealed[t]]);
      }
      logLik += w * lp;
      continue;
    }

    const alpha = Array.from({ length: L }, () => new Float64Array(K));
    for (let h = 0; h < K; h++) alpha[0][h] = prior[h] * policy[0][h][actions[0]];
    for (let t = 1; t < L; t++) {
      for (let h = 0; h < K; h++) {
        let s = 0;
        for (let hp = 0; hp < K; hp++) s += alpha[t - 1][hp] * T[hp][h];
        alpha[t][h] = s * policy[t][h][actions[t]];
      }
    }
    let Z = 0;
    for (let h = 0; h < K; h++) Z += alpha[L - 1][h];
    if (!(Z > 0)) continue;
    logLik += w * Math.log(Z);

    const beta = Array.from({ length: L }, () => new Float64Array(K));
    for (let h = 0; h < K; h++) beta[L - 1][h] = 1;
    for (let t = L - 2; t >= 0; t--) {
      for (let h = 0; h < K; h++) {
        let s = 0;
        for (let h2 = 0; h2 < K; h2++) s += T[h][h2] * policy[t + 1][h2][actions[t + 1]] * beta[t + 1][h2];
        beta[t][h] = s;
      }
    }
    for (let t = 0; t < L; t++) {
      for (let h = 0; h < K; h++) {
        const g = (alpha[t][h] * beta[t][h]) / Z;
        if (g > 0) counts[t][h][actions[t]] += w * g;
      }
    }
  }
  return { counts, logLik };
};

/**
 * Run EM from one start.
 *
 * CONVERGENCE IS TESTED ON PARAMETERS, NOT ON LOG-LIKELIHOOD, and that is not a stylistic
 * choice. WS-526's identity-transition stress case has a likelihood so flat along one
 * direction that a parameter error of 0.079 costs 2.2e-10 in log-likelihood. An LL-based
 * criterion declares victory there while the answer is still wrong by eight points, and
 * reports a confident number. A run that hits `maxIter` returns `converged: false` and every
 * caller surfaces it, because the original version of this file returned `iterations: 5000`
 * out of `maxIter: 5000` with no flag and the stall was found only by hand.
 */
export const fitEM = (hist, {
  prior = PRIOR, T = TRANSITION, maxIter = 200000, tol = 1e-12, start = null, seed = 1,
  streets = STREETS,
} = {}) => {
  const K = prior.length;
  let policy = start
    || (seed === 0 ? uniformPolicy(streets, K) : randomPolicy(mulberry32(seed), streets, K));
  let iter = 0;
  let logLik = -Infinity;
  let maxDelta = Infinity;
  let converged = false;
  for (; iter < maxIter; iter++) {
    const { counts, logLik: ll } = emStep(hist, policy, { prior, T });
    logLik = ll;
    const prev = policy;
    policy = counts.map((st) => st.map((c) => {
      const tot = c.fold + c.call + c.raise;
      // A class with no expected mass at a street is left flat rather than divided by zero,
      // and that state stays visible in the output rather than being silently smoothed away.
      if (!(tot > 0)) return { fold: 1 / 3, call: 1 / 3, raise: 1 / 3 };
      return { fold: c.fold / tot, call: c.call / tot, raise: c.raise / tot };
    }));
    maxDelta = 0;
    for (let s = 0; s < policy.length; s++) {
      for (let h = 0; h < policy[s].length; h++) {
        for (const a of ACTIONS) maxDelta = Math.max(maxDelta, Math.abs(policy[s][h][a] - prev[s][h][a]));
      }
    }
    if (maxDelta < tol) { iter++; converged = true; break; }
  }
  return { policy, logLik, iterations: iter, converged, maxParamDelta: maxDelta };
};

/** Log-likelihood of a policy on a histogram, per unit of histogram mass. */
export const logLikOf = (hist, policy, { prior = PRIOR, T = TRANSITION } = {}) => {
  let mass = 0;
  for (const [, w] of hist) mass += w;
  const { logLik } = emStep(hist, policy, { prior, T });
  return mass > 0 ? logLik / mass : NaN;
};

/**
 * RESOLVABILITY — how many hands are needed before a given error in a given cell becomes
 * statistically visible. This is the instrument WS-526 exists to hand to WS-527.
 *
 * WHY IT SUPERSEDES "DID EM CONVERGE". Convergence answers a question about the optimiser.
 * The question that matters is a property of the DATA: if the truth and a policy `delta` away
 * differ by only epsilon in expected log-likelihood, then no estimator recovers that cell
 * until the sample is large enough for epsilon to clear sampling noise. Identity-T is
 * theoretically identified and practically hopeless, and only this instrument can tell the
 * two apart.
 *
 * By Wilks, 2 * N * deltaLL is asymptotically chi-squared with 1 df, so detection at the
 * conventional 5% level needs N >= 1.920 / deltaLL. That constant is stated here rather than
 * buried: it is the whole conversion from flatness into hands.
 */
export const WILKS_95 = 1.920729;

export const resolvability = (hist, truth = TRUE_POLICY, {
  prior = PRIOR, T = TRANSITION, delta = 0.05,
} = {}) => {
  const base = logLikOf(hist, truth, { prior, T });
  const rows = [];
  for (let s = 0; s < truth.length; s++) {
    for (let h = 0; h < truth[s].length; h++) {
      const cell = truth[s][h];
      // Perturb fold by -delta (or +delta when fold is already small), moving the mass to
      // `call` so the row still sums to 1. Direction is recorded, not assumed.
      const dir = cell.fold >= delta ? -1 : +1;
      const other = dir < 0 ? 'call' : 'call';
      if (dir > 0 && cell[other] < delta) continue;
      const perturbed = truth.map((st, si) => st.map((c, hi) => {
        if (si !== s || hi !== h) return { ...c };
        return { ...c, fold: c.fold + dir * delta, [other]: c[other] - dir * delta };
      }));
      const ll = logLikOf(hist, perturbed, { prior, T });
      const dLL = base - ll;
      rows.push({
        street: s,
        handClass: (truth[s].length === CLASSES.length ? CLASSES[h] : `c${h}`),
        foldTruth: cell.fold,
        delta: dir * delta,
        deltaLogLikPerHand: dLL,
        handsToResolve: dLL > 0 ? Math.ceil(WILKS_95 / dLL) : Infinity,
      });
    }
  }
  rows.sort((a, b) => b.handsToResolve - a.handsToResolve);
  return {
    delta,
    baseLogLikPerHand: base,
    rows,
    worstHandsToResolve: rows.length ? rows[0].handsToResolve : Infinity,
    medianHandsToResolve: rows.length
      ? rows.map((r) => r.handsToResolve).sort((a, b) => a - b)[Math.floor(rows.length / 2)]
      : Infinity,
  };
};

/**
 * Symmetric eigen-decomposition by cyclic Jacobi. Small, exact enough, no dependency.
 * Returns eigenvalues ascending.
 */
export const jacobiEigenvalues = (Ain, sweeps = 100) => {
  const n = Ain.length;
  const A = Ain.map((r) => Float64Array.from(r));
  for (let s = 0; s < sweeps; s++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    if (off < 1e-24) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const tsign = theta >= 0 ? 1 : -1;
        const tt = tsign / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(tt * tt + 1);
        const sn = tt * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p]; const akq = A[k][q];
          A[k][p] = c * akp - sn * akq;
          A[k][q] = sn * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k]; const aqk = A[q][k];
          A[p][k] = c * apk - sn * aqk;
          A[q][k] = sn * apk + c * aqk;
        }
      }
    }
  }
  return Array.from({ length: n }, (_, i) => A[i][i]).sort((a, b) => a - b);
};

/**
 * CURVATURE — the instrument that supersedes `resolvability`, and the reason it had to.
 *
 * `resolvability` perturbs ONE cell at a time. That probes only axis-aligned directions, and
 * on this problem it is wrong by six orders of magnitude: it reported the identity-transition
 * case resolvable in ~6.5k hands while EM, drifting along a JOINT direction, sat 0.079 away
 * from the truth at a log-likelihood cost of 2e-10 per hand — about nine billion hands to
 * separate. A flat direction in parameter space need not line up with any parameter.
 *
 * So the honest instrument is the local geometry itself: the Hessian of the expected
 * per-hand log-likelihood over the free parameters (each row of the policy has 3 actions
 * summing to 1, hence 2 free), by central differences. Its SMALLEST eigenvalue is the
 * flattest direction there is, whatever orientation it happens to have.
 *
 * Hands to resolve a perturbation of size `delta` along the flattest direction:
 *   deltaLL ~= 0.5 * lambda_min * delta^2,  and Wilks needs N * deltaLL >= WILKS_95,
 *   so N >= 2 * WILKS_95 / (lambda_min * delta^2).
 *
 * A near-zero smallest eigenvalue IS non-identification, stated in the units the founder
 * asked the question in: hands.
 */
export const curvature = (hist, policy, {
  prior = PRIOR, T = TRANSITION, eps = null, delta = 0.05,
  epsLadder = [1e-3, 1e-4, 1e-5, 1e-6], stabilityTol = 0.05,
} = {}) => {
  // EPS REFINEMENT, AND WHY IT IS NOT OPTIONAL.
  //
  // A central-difference Hessian at a fixed step is not trustworthy near a flat direction:
  // WS-526's K=5 case returned lambdaMin = -7.17 at eps=1e-3, -5.4e-3 at 1e-4 and +2.13e-2 at
  // 1e-5. Read at the default step it said NOT IDENTIFIED. It is identified. A false
  // non-identification is the worst error this instrument can make, because it kills work that
  // would have succeeded — so the step is refined until the smallest eigenvalue STOPS MOVING,
  // and an estimate that never stabilises is returned with `stable: false` rather than as a
  // number someone can quote.
  if (eps == null) {
    const seen = [];
    for (const e of epsLadder) {
      const r = curvature(hist, policy, { prior, T, eps: e, delta });
      if (!r.ok) continue;
      seen.push({ eps: e, lambdaMin: r.smallestEigenvalue, r });
      const n = seen.length;
      if (n >= 2) {
        const a = seen[n - 2].lambdaMin;
        const b = seen[n - 1].lambdaMin;
        const scale = Math.max(Math.abs(a), Math.abs(b), 1e-6);
        if (Math.abs(a - b) / scale < stabilityTol) {
          return { ...seen[n - 1].r, stable: true, epsUsed: e, epsLadderTried: seen.map((x) => x.eps) };
        }
      }
    }
    if (!seen.length) return { ok: false, reason: 'hessian-non-finite-at-every-step' };
    const last = seen[seen.length - 1];
    return { ...last.r, stable: false, epsUsed: last.eps, epsLadderTried: seen.map((x) => x.eps) };
  }

  const NS = policy.length;
  const K = policy[0].length;
  // free coordinates: (street, class, which) with which in {0,1} -> shift mass fold<->raise
  // and call<->raise, keeping the row normalised.
  const coords = [];
  for (let s = 0; s < NS; s++) for (let h = 0; h < K; h++) { coords.push([s, h, 'fold']); coords.push([s, h, 'call']); }
  const n = coords.length;

  const shift = (base, vec, scale) => base.map((st, s) => st.map((c, h) => {
    let fold = c.fold; let call = c.call; let raise = c.raise;
    for (let i = 0; i < n; i++) {
      const [cs, ch, which] = coords[i];
      if (cs !== s || ch !== h) continue;
      const d = vec[i] * scale;
      if (which === 'fold') { fold += d; raise -= d; } else { call += d; raise -= d; }
    }
    return { fold, call, raise };
  }));

  const ok = (p) => p.every((st) => st.every((c) => c.fold > 1e-9 && c.call > 1e-9 && c.raise > 1e-9));
  const f = (vec, scale) => {
    const p = shift(policy, vec, scale);
    if (!ok(p)) return NaN;
    return logLikOf(hist, p, { prior, T });
  };

  const zero = new Float64Array(n);
  const f0 = f(zero, 0);
  const H = Array.from({ length: n }, () => new Float64Array(n));
  const e = (i) => { const v = new Float64Array(n); v[i] = 1; return v; };
  for (let i = 0; i < n; i++) {
    const ei = e(i);
    const fp = f(ei, eps); const fm = f(ei, -eps);
    H[i][i] = -(fp - 2 * f0 + fm) / (eps * eps);
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const v = new Float64Array(n); v[i] = 1; v[j] = 1;
      const w = new Float64Array(n); w[i] = 1; w[j] = -1;
      const fpp = f(v, eps); const fmm = f(v, -eps);
      const fpm = f(w, eps); const fmp = f(w, -eps);
      const val = -(fpp + fmm - fpm - fmp) / (4 * eps * eps);
      H[i][j] = val; H[j][i] = val;
    }
  }
  let finite = true;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!Number.isFinite(H[i][j])) finite = false;
  if (!finite) return { ok: false, reason: 'hessian-non-finite' };

  const eig = jacobiEigenvalues(H);
  const lamMin = eig[0];
  const lamMax = eig[eig.length - 1];
  const handsFlattest = lamMin > 0 ? Math.ceil((2 * WILKS_95) / (lamMin * delta * delta)) : Infinity;
  return {
    ok: true,
    dimensions: n,
    delta,
    smallestEigenvalue: lamMin,
    largestEigenvalue: lamMax,
    conditionNumber: lamMin > 0 ? lamMax / lamMin : Infinity,
    handsToResolveFlattestDirection: handsFlattest,
    eigenvalues: eig,
  };
};

/**
 * Score a fitted policy against the truth, fold cells SEPARATE from continue cells.
 *
 * They are never collapsed into one "max error": the fold branch is the branch under test and
 * the continue branch is its same-run control. A single combined figure would let a good
 * continue-branch fit launder a bad fold-branch one.
 */
export const scoreRecovery = (fitted, truth = TRUE_POLICY) => {
  const cells = [];
  let maxFold = 0;
  let maxContinue = 0;
  let sumSqFold = 0;
  let nFold = 0;
  const NS = truth.length;
  const K = truth[0].length;
  const names = K === CLASSES.length ? CLASSES : Array.from({ length: K }, (_, i) => `c${i}`);
  for (let t = 0; t < NS; t++) {
    for (let h = 0; h < K; h++) {
      for (const a of ACTIONS) {
        const err = fitted[t][h][a] - truth[t][h][a];
        cells.push({
          street: t, handClass: names[h], action: a,
          truth: truth[t][h][a], fitted: fitted[t][h][a], error: err,
        });
        if (a === 'fold') { maxFold = Math.max(maxFold, Math.abs(err)); sumSqFold += err * err; nFold++; } else {
          maxContinue = Math.max(maxContinue, Math.abs(err));
        }
      }
    }
  }
  return {
    maxFoldBranchAbsError: maxFold,
    rmseFoldBranch: Math.sqrt(sumSqFold / nFold),
    maxContinueBranchAbsError: maxContinue,
    cells,
  };
};

/**
 * Multi-start ridge detection — the direct identifiability instrument.
 *
 * Non-identification IS "distinct parameters, same likelihood". If starts agree on
 * log-likelihood to `llTol` but disagree on parameters by more than `paramTol`, the likelihood
 * has a ridge and no amount of data will separate them.
 */
export const detectRidge = (hist, {
  starts = 24, prior = PRIOR, T = TRANSITION, llTol = 1e-9, paramTol = 0.02, streets = STREETS,
} = {}) => {
  const fits = [];
  for (let s = 0; s < starts; s++) fits.push(fitEM(hist, { prior, T, seed: s + 1, streets }));
  const bestLL = Math.max(...fits.map((f) => f.logLik));
  const atBest = fits.filter((f) => Math.abs(f.logLik - bestLL) <= llTol * Math.max(1, Math.abs(bestLL)));
  let maxSpread = 0;
  for (let i = 0; i < atBest.length; i++) {
    for (let j = i + 1; j < atBest.length; j++) {
      for (let t = 0; t < streets; t++) {
        for (let h = 0; h < prior.length; h++) {
          for (const a of ACTIONS) {
            maxSpread = Math.max(maxSpread, Math.abs(atBest[i].policy[t][h][a] - atBest[j].policy[t][h][a]));
          }
        }
      }
    }
  }
  return {
    starts,
    bestLogLik: bestLL,
    startsAtBestLL: atBest.length,
    maxParamSpreadAtEqualLL: maxSpread,
    ridgeDetected: maxSpread > paramTol,
    best: atBest[0],
  };
};
