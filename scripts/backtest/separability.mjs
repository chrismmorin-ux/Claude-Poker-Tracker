/**
 * separability.mjs — WS-320. The §11.8 instrument, extracted so it can be pointed at a new axis.
 *
 * THE STANDING RULE THIS IMPLEMENTS (founder, ratified): prove an archetype separates before
 * building its channel. A tail always exists in any behavioural rate — selecting it and
 * reporting its mean is circular and looks convincing. The non-circular test is
 * OVERDISPERSION measured against a CONTROL AXIS, plus a CROSS-AXIS correlation check.
 *
 * WHY EACH PIECE IS HERE, because a test with a missing leg reaches a confident wrong answer:
 *
 *  1. OVERDISPERSION. Under one common rate, Pearson χ² over players has E[χ²] = df. Excess
 *     variance is the only evidence of distinct player types that does not presuppose them.
 *     χ²/df ≈ 1.0 means the observed spread is fully explained by each player's own n.
 *
 *  2. A CONTROL AXIS IN THE SAME RUN. §11.8's credibility came entirely from this: the method
 *     found χ²/df = 1.859 on flop bet frequency in the same sample where it found 1.005 on
 *     slowplay, so the null was a fact about the axis and not about the instrument. A
 *     separability claim without a control is unfalsifiable.
 *
 *  3. POWER, STATED. §11.8's own limits paragraph is the reason WS-320 exists: at a MEDIAN OF
 *     TWO observations per player, χ²/df returns ≈ 1 whether or not the type is real. So this
 *     module reports observations-per-player beside every χ², and a verdict is refused where
 *     the count cannot carry it. An axis is ranked on MEASURABILITY before it is ranked on
 *     reality, and saying which is which is the whole job.
 *
 *  4. SPLIT-HALF RELIABILITY, WHICH §11.8 DID NOT HAVE. Overdispersion says players differ.
 *     It cannot say whether a player differs from HIMSELF between his first hands and his
 *     last — state, tilt, table change, a leak he plugged. A trait you cannot re-measure on
 *     the same player is not a channel you can build. Splitting each player's observations at
 *     their own temporal midpoint and correlating the halves is the walk-forward-shaped form
 *     of the leakage doctrine for a descriptive estimand, and it is also the ONLY thing here
 *     that can distinguish "real between-player variation" from "real within-player drift".
 *
 *  5. ATTENUATION, HANDLED IN NUMBERS RATHER THAN PROSE. §11.8 recorded that a null
 *     correlation at ~2 observations per player is uninformative, because noise correlates ≈ 0
 *     with everything. The correct repair is to divide the observed correlation by the
 *     geometric mean of the two axes' reliabilities. That is computed here — and it is
 *     reported ALONGSIDE the raw correlation, never instead of it, because a disattenuated
 *     figure divided by a small reliability is itself unstable.
 *
 * NOTHING IN THIS MODULE DELETES ANYTHING ON A NULL. A null is a fact about an axis at a
 * sample size, and the founder's standing rule is that it is recorded as such.
 */

/** §11.8's pseudocount for the Beta-Binomial shrinkage. */
export const DEFAULT_PRIOR_WEIGHT = 10;

/**
 * Observations a shrunk per-player estimate needs before it can move meaningfully off the
 * population prior. §11.8 names ~30; below it, a "player rate" is mostly the prior wearing a
 * player's name.
 */
export const OBS_FOR_MOVEABLE_ESTIMATE = 30;

const clamp01 = (x) => Math.min(1, Math.max(0, x));

export const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ═══════════════════════════════════════════════════════════════════════════════════════════
// OVERDISPERSION
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Pearson χ² over players against the binomial expectation implied by each player's own n.
 *
 * @param {Object} input
 * @param {Array<{k:number,n:number}>} input.rows - one per player, already filtered to minN
 * @param {number} input.commonRate - p̄, the single rate the null asserts everyone shares
 * @param {boolean} input.rateEstimatedInSample - see the df note below
 *
 * DEGREES OF FREEDOM DEPEND ON WHERE p̄ CAME FROM, and getting this wrong shifts every χ²/df
 * by a factor of m/(m-1). When p̄ is estimated from the very players being tested, one degree
 * of freedom is spent fitting it, so df = m - 1. When p̄ comes from an INDEPENDENT sample —
 * here, the POOL half of the partition — nothing was fitted and df = m. The leakage-free
 * variant is the primary reading precisely because it spends no df on the players it scores.
 */
export const overdispersion = ({ rows, commonRate, rateEstimatedInSample = true }) => {
  const usable = rows.filter((r) => r.n > 0);
  const m = usable.length;
  const p = commonRate;
  if (m === 0 || !(p > 0) || !(p < 1)) {
    return {
      players: m, decisions: usable.reduce((s, r) => s + r.n, 0),
      commonRate: p, chi2: null, df: null, chi2PerDf: null, z: null,
      betweenPlayerSd: null, rateEstimatedInSample,
      note: 'χ² undefined: no players, or a degenerate common rate (0 or 1).',
    };
  }

  const q = 1 - p;
  let chi2 = 0;
  let decisions = 0;
  let sumNMinus1 = 0;
  for (const r of usable) {
    const expected = r.n * p;
    chi2 += ((r.k - expected) ** 2) / (r.n * p * q);
    decisions += r.n;
    sumNMinus1 += r.n - 1;
  }

  const df = rateEstimatedInSample ? m - 1 : m;
  if (df <= 0) {
    return {
      players: m, decisions, commonRate: p, chi2, df, chi2PerDf: null, z: null,
      betweenPlayerSd: null, rateEstimatedInSample,
      note: 'χ² undefined: fewer than two players.',
    };
  }

  // Method-of-moments between-player SD. Under a beta-binomial with between-player variance
  // σ², E[(k_i - n_i p̄)²] = n_i p̄q + n_i(n_i - 1)σ², so E[χ²] = m + σ²/(p̄q) · Σ(n_i - 1).
  // Inverting gives σ̂². This is the figure §11.8 quotes as "≈ 9pp on bet frequency against
  // ≈ 2pp on the slowplay conditional" — the one that makes a χ²/df interpretable in units a
  // reader can act on, rather than as a bare ratio.
  const betweenVar = sumNMinus1 > 0 ? ((chi2 - m) * p * q) / sumNMinus1 : null;

  return {
    players: m,
    decisions,
    obsPerPlayerMedian: median(usable.map((r) => r.n)),
    obsPerPlayerMean: decisions / m,
    commonRate: p,
    chi2,
    df,
    chi2PerDf: chi2 / df,
    // E[χ²] = df, Var[χ²] = 2df. z is the standardised excess.
    z: (chi2 - df) / Math.sqrt(2 * df),
    betweenPlayerSd: betweenVar === null ? null : Math.sqrt(Math.max(0, betweenVar)),
    rateEstimatedInSample,
    note: null,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SHRINKAGE
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Beta-Binomial shrinkage with a LEAVE-ONE-OUT population prior.
 *
 * Leave-one-out is structural, not cosmetic. A prior that includes the player it is shrinking
 * pulls each player toward a mean they themselves helped set, which manufactures agreement
 * between a player and "the population" and would bias every downstream correlation upward.
 * The repo has this rule written down twice (memory: never shrink a villain toward a baseline
 * built from that same villain; and the backtest-split/leakage entry), and it applies to a
 * descriptive population measurement exactly as it applies to a model.
 *
 * `externalPrior` overrides the leave-one-out mean entirely, for the POOL-mined variant where
 * the prior comes from players who are not in this set at all.
 */
export const shrinkRates = (rows, { priorWeight = DEFAULT_PRIOR_WEIGHT, externalPrior = null } = {}) => {
  const K = rows.reduce((s, r) => s + r.k, 0);
  const N = rows.reduce((s, r) => s + r.n, 0);
  return rows.map((r) => {
    let prior;
    if (externalPrior !== null) {
      prior = externalPrior;
    } else {
      const nOut = N - r.n;
      prior = nOut > 0 ? (K - r.k) / nOut : (N > 0 ? K / N : 0);
    }
    return {
      ...r,
      rawRate: r.n > 0 ? r.k / r.n : null,
      prior,
      shrunkRate: (r.k + priorWeight * prior) / (r.n + priorWeight),
    };
  });
};

// ═══════════════════════════════════════════════════════════════════════════════════════════
// CORRELATION
// ═══════════════════════════════════════════════════════════════════════════════════════════

export const pearson = (xs, ys) => {
  const n = xs.length;
  if (n !== ys.length || n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx <= 0 || syy <= 0) return null;
  return sxy / Math.sqrt(sxx * syy);
};

/** Average ranks, so ties do not silently become an arbitrary ordering. */
const ranks = (xs) => {
  const idx = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(xs.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let t = i; t <= j; t++) out[idx[t][1]] = avg;
    i = j + 1;
  }
  return out;
};

/**
 * Spearman is reported beside Pearson because the ladder hypothesis is about ORDER of
 * acquisition, which is monotone but has no reason to be linear. A Pearson-only answer could
 * miss a real monotone relationship or be dragged by a handful of extreme shrunk rates.
 */
export const spearman = (xs, ys) => pearson(ranks(xs), ranks(ys));

/**
 * Split-half reliability over each player's OWN timeline.
 *
 * Each player's ordered observations are cut at their midpoint; the first-half rate is
 * correlated against the second-half rate across players, then Spearman-Brown-corrected back
 * up to full length (a half-length test is less reliable than the whole one, and comparing an
 * uncorrected half-test reliability against a full-length correlation would understate it).
 *
 * A LOW VALUE HERE IS NOT A MEASUREMENT FAILURE — it is the finding that the axis is not a
 * stable trait at this observation density, which is exactly what a channel would need.
 *
 * @param {Array<{bits: boolean[]}>} rows
 * @param {number} minHalfN - observations required in EACH half
 * @param {Object} [guard] - optional LeakageGuard; receives one assertStatWindow per player
 */
export const splitHalfReliability = (rows, { minHalfN = 5, guard = null } = {}) => {
  const first = []; const second = [];
  let used = 0;
  for (const r of rows) {
    const bits = r.bits ?? [];
    const cut = Math.floor(bits.length / 2);
    if (cut < minHalfN || bits.length - cut < minHalfN) continue;
    const a = bits.slice(0, cut);
    const b = bits.slice(cut);
    // Channel-2 ordering, in the form this estimand admits: the EARLY window ends where the
    // LATE window begins, so nothing from a player's future informs his past.
    if (guard) guard.assertStatWindow({ playerId: r.playerKey, trainEndIdx: cut, handIdx: cut });
    first.push(a.reduce((s, x) => s + (x ? 1 : 0), 0) / a.length);
    second.push(b.reduce((s, x) => s + (x ? 1 : 0), 0) / b.length);
    used += 1;
  }
  const r = pearson(first, second);
  // Spearman-Brown. Clamped: a negative half-correlation cannot be projected up to a
  // meaningful full-length reliability, and pretending otherwise would produce a
  // disattenuation denominator that inflates every correlation it touches.
  const corrected = r === null ? null : clamp01((2 * r) / (1 + r));
  return { players: used, minHalfN, halfCorrelation: r, reliability: corrected };
};

/**
 * Cross-axis correlation between two axes' shrunk rates, over the players present on both.
 *
 * @param {Object} input
 * @param {Map<string, number>} input.a - playerKey -> shrunk rate, axis A
 * @param {Map<string, number>} input.b
 * @param {number|null} input.reliabilityA - Spearman-Brown split-half reliability of axis A
 * @param {number|null} input.reliabilityB
 */
export const crossAxisCorrelation = ({ a, b, reliabilityA = null, reliabilityB = null }) => {
  const xs = []; const ys = [];
  for (const [key, va] of a) {
    const vb = b.get(key);
    if (vb === undefined) continue;
    xs.push(va); ys.push(vb);
  }
  const r = pearson(xs, ys);
  const rho = spearman(xs, ys);

  // Disattenuation is only meaningful when BOTH reliabilities are positive and not tiny; a
  // denominator near zero turns a noise correlation into a large number with a confident sign.
  const denom = (reliabilityA !== null && reliabilityB !== null && reliabilityA > 0 && reliabilityB > 0)
    ? Math.sqrt(reliabilityA * reliabilityB)
    : null;
  const disattenuated = (r !== null && denom !== null) ? r / denom : null;

  return {
    players: xs.length,
    pearson: r,
    spearman: rho,
    reliabilityA,
    reliabilityB,
    disattenuated: disattenuated === null ? null : Math.max(-1, Math.min(1, disattenuated)),
    disattenuatedUncapped: disattenuated,
    disattenuationBlocked: denom === null
      ? 'one or both axes have no usable split-half reliability, so attenuation cannot be corrected'
      : null,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ORDERING — is it a ladder, or a set of independent habits wearing a ladder's name?
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Split players into "has acquired this rung" / "has not", at the POPULATION MEDIAN of the
 * shrunk rate, in the direction study is claimed to move the player.
 *
 * THE MEDIAN IS NOT AN ARBITRARY CUT — it is the one choice that makes the ordering test
 * readable. It forces both marginals to ≈ 50%, so under independence every cell of the 2×2 is
 * ≈ 25% and under a perfect ladder P(earlier | later) = 1. Any other threshold makes the
 * observed co-occurrence a function of the threshold and the test unfalsifiable.
 *
 * It also means this test can only detect the SHAPE of the relationship, never the absolute
 * standard of the pool: half the pool is "above median" by construction even if every player
 * in it limps constantly. Stated so no one reads the marginals as a skill census.
 */
export const acquiredFlags = (shrunkByPlayer, direction) => {
  const values = [...shrunkByPlayer.values()];
  const cut = median(values);
  const flags = new Map();
  for (const [key, v] of shrunkByPlayer) {
    flags.set(key, direction === 'lower' ? v < cut : v > cut);
  }
  return { flags, threshold: cut, direction };
};

/**
 * 2×2 co-occurrence for a pair of rungs, with BOTH conditionals.
 *
 * The repo rule (memory: numbers carry their conditional) is that P(A|B) and P(B|A) support
 * opposite reads and both get reported. For a ladder they are also the two different claims:
 * P(earlier | later) near 1 is the ladder's actual prediction, while P(later | earlier) near 1
 * would mean the rungs are the same rung.
 */
export const coOccurrence = ({ flagsA, flagsB, labelA, labelB }) => {
  let both = 0; let aOnly = 0; let bOnly = 0; let neither = 0;
  for (const [key, a] of flagsA) {
    const b = flagsB.get(key);
    if (b === undefined) continue;
    if (a && b) both++;
    else if (a) aOnly++;
    else if (b) bOnly++;
    else neither++;
  }
  const n = both + aOnly + bOnly + neither;
  const pA = n ? (both + aOnly) / n : null;
  const pB = n ? (both + bOnly) / n : null;
  const phiDen = n ? Math.sqrt((both + aOnly) * (bOnly + neither) * (both + bOnly) * (aOnly + neither)) : 0;
  return {
    labelA,
    labelB,
    n,
    both,
    aOnly,
    bOnly,
    neither,
    pAgivenB: (both + bOnly) ? both / (both + bOnly) : null,
    pBgivenA: (both + aOnly) ? both / (both + aOnly) : null,
    marginalA: pA,
    marginalB: pB,
    expectedBothUnderIndependence: (pA !== null && pB !== null) ? pA * pB * n : null,
    phi: phiDen > 0 ? (both * neither - aOnly * bOnly) / phiDen : null,
  };
};

/**
 * Guttman-style nesting check across the rungs IN THE FOUNDER'S STATED ORDER.
 *
 * A ladder predicts nesting: acquiring rung 3 implies rungs 1 and 2. A VIOLATION is a player
 * who has a later rung without an earlier one. Independent habits produce violations at the
 * rate chance predicts; a real ladder produces far fewer. The chance baseline is reported
 * beside the observed count, because a violation count alone is a number with no scale.
 *
 * THE BASELINE IS COMPUTED FROM THE OBSERVED MARGINALS, NOT ASSUMED TO BE 50%. This is not a
 * refinement — it is the difference between a real finding and an artifact, and it was caught
 * only because the first run printed both. `acquiredFlags` splits at each axis's median over
 * ITS OWN population, but the nesting test runs on the INTERSECTION of players who have data
 * on every rung, and that intersection is selected: a player with enough c-bet spots to
 * measure is a player who raises preflop, and such players limp far less than the median. In
 * the live run the limp marginal in the intersection was 0.90, not 0.50 — which lifts the
 * chance baseline for nested patterns from 50% to 78% and shrinks the apparent ladder signal
 * from "+32 points over chance" to "+5". Assuming equal marginals here would have manufactured
 * most of the evidence for the founder's hypothesis out of a selection effect.
 */
export const ladderNesting = ({ orderedFlagMaps, labels }) => {
  const keys = [...orderedFlagMaps[0].keys()].filter(
    (k) => orderedFlagMaps.every((m) => m.has(k)),
  );
  const rungs = orderedFlagMaps.length;
  let violators = 0;
  let perfect = 0;
  const patterns = new Map();
  const marginalCounts = new Array(rungs).fill(0);

  for (const key of keys) {
    const pattern = orderedFlagMaps.map((m) => (m.get(key) ? 1 : 0));
    pattern.forEach((v, i) => { marginalCounts[i] += v; });
    patterns.set(pattern.join(''), (patterns.get(pattern.join('')) ?? 0) + 1);
    // Nested (Guttman-scalable) patterns are the prefixes: 000, 100, 110, 111.
    const firstZero = pattern.indexOf(0);
    const isNested = firstZero === -1 || pattern.slice(firstZero).every((v) => v === 0);
    if (isNested) perfect++; else violators++;
  }

  const n = keys.length;
  const marginals = marginalCounts.map((c) => (n ? c / n : null));

  // Expected share of nested patterns if the rungs were INDEPENDENT habits with exactly these
  // marginals. Enumerating the (rungs + 1) prefix patterns is exact and cheap.
  let expected = null;
  if (n > 0) {
    expected = 0;
    for (let ones = 0; ones <= rungs; ones++) {
      let p = 1;
      for (let i = 0; i < rungs; i++) p *= i < ones ? marginals[i] : 1 - marginals[i];
      expected += p;
    }
  }

  return {
    labels,
    players: n,
    nested: perfect,
    violations: violators,
    nestedRate: n ? perfect / n : null,
    violationRate: n ? violators / n : null,
    marginals,
    expectedNestedRateUnderIndependence: expected,
    // The only number that means anything on its own: observed nesting MINUS what independent
    // habits with the same marginals would already produce.
    excessOverIndependence: (expected === null || !n) ? null : perfect / n - expected,
    // Kept and LABELLED so the difference between the two baselines stays visible rather than
    // being silently corrected away.
    equalMarginalBaseline: (rungs + 1) / 2 ** rungs,
    patternCounts: Object.fromEntries([...patterns].sort((a, b) => b[1] - a[1])),
  };
};

// ═══════════════════════════════════════════════════════════════════════════════════════════
// VERDICT
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * The separability verdict for one axis, read against the control FROM THE SAME RUN.
 *
 * THREE OUTCOMES, NOT TWO. "Does not separate" and "cannot be told apart at this sample size"
 * are different findings with opposite implications for what to do next, and collapsing them
 * is the error §11.8 warned about when it called its own result a weak-power null rather than
 * proof of absence. `underpowered` is therefore a first-class verdict.
 *
 * A null NEVER licenses removing a capability (founder standing rule). It licenses not
 * BUILDING one, which is a different act.
 */
export const separabilityVerdict = ({ stats, controlStats, obsThreshold = OBS_FOR_MOVEABLE_ESTIMATE }) => {
  if (stats.chi2PerDf === null || stats.z === null) {
    return { verdict: 'undefined', reason: stats.note ?? 'statistic could not be computed' };
  }
  const powered = (stats.obsPerPlayerMedian ?? 0) >= obsThreshold;
  const separates = stats.z >= 3;

  if (separates) {
    return {
      verdict: 'separates',
      reason:
        `χ²/df = ${stats.chi2PerDf.toFixed(3)} (z = ${stats.z.toFixed(1)}), against the control's `
        + `${controlStats.chi2PerDf?.toFixed(3)} (z = ${controlStats.z?.toFixed(1)}) in this same run. `
        + `Between-player SD ≈ ${(100 * (stats.betweenPlayerSd ?? 0)).toFixed(1)}pp — real variation `
        + 'beyond what each player\'s own n explains.',
      powered,
    };
  }
  if (!powered) {
    return {
      verdict: 'underpowered',
      reason:
        `χ²/df = ${stats.chi2PerDf.toFixed(3)} (z = ${stats.z.toFixed(1)}), but the median player has `
        + `${stats.obsPerPlayerMedian} observations against the ~${obsThreshold} a shrunk estimate needs. `
        + 'An axis at this density returns χ²/df ≈ 1 whether or not the type exists. This is a '
        + 'weak-power null, NOT proof of absence (§11.8).',
      powered,
    };
  }
  return {
    verdict: 'does-not-separate',
    reason:
      `χ²/df = ${stats.chi2PerDf.toFixed(3)} (z = ${stats.z.toFixed(1)}) at a median of `
      + `${stats.obsPerPlayerMedian} observations per player — enough to detect heterogeneity, and `
      + `none found. The control reached ${controlStats.chi2PerDf?.toFixed(3)} on the same players, `
      + 'so the instrument was working. Do not build a channel here; do not delete anything either.',
    powered,
  };
};
