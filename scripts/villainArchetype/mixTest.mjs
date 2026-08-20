/**
 * mixTest - decides whether a leaf is a MIX or a hidden condition.
 *
 * FOUNDER, 2026-08-18: "If we allow for a rule to be to mix, then we will have a new shape of
 * rule that allows us to still be precise at lower rule count and less statistical variance by
 * just giving it a mixing %."
 *
 * Correct, and it collapses a distinction that never should have existed: a fold-90% leaf whose
 * 10% residue is his opening range IS a mix, just a lopsided one. `induceCore` separated those
 * from "wrinkles" on a bare 0.25 residue threshold, which is a number, not a finding.
 *
 * THE HAZARD THIS MODULE EXISTS TO CLOSE. A mix and an unresolved wrinkle are observationally
 * IDENTICAL at a single node - both are a split tally. If `mix` becomes the label applied
 * whenever splitting fails, the wrinkle count goes to zero for the wrong reason and the search
 * stops early. That is the same self-concealing failure the engine spec names in section 4: a
 * plausible answer that agrees with itself because it was generated from the framing that
 * produced it.
 *
 * So a mix must be EARNED, and there is a test that earns it:
 *
 *   A true mix is STABLE UNDER EVERY SUB-PARTITION. That is what mixing means - the ratio does
 *   not depend on the situation. So cut the leaf by every feature not yet used, WITH NO
 *   MINIMUM-N FLOOR (the floor is exactly what hid the condition), and test action-vs-feature
 *   independence with a G-test. Bonferroni over the features actually testable in that leaf.
 *
 * Three verdicts, and they are the ones the engine spec already names in section 4:
 *
 *   mix            nothing observable separates the actions    -> resolved-noise, null stated
 *   hidden-cond    a feature DOES separate, blocked only by    -> resolved-subrule, feature named
 *                  the min-n floor
 *   needs-cards    nothing observable separates, but the       -> unresolvable-here, and it says
 *                  shown hands do                                 what would resolve it
 */

// -- chi-square upper tail, via the regularised incomplete gamma Q(a, x) ------------
const lgamma = (z) => {
  const g = [676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < g.length; i++) x += g[i] / (z + i + 1);
  const t = z + g.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
};

/** Lower regularised P(a,x) by series; upper Q(a,x) by continued fraction. Split at a+1. */
const gammaQ = (a, x) => {
  if (x < 0 || a <= 0) return 1;
  if (x === 0) return 1;
  if (x < a + 1) {                       // series for P, then Q = 1 - P
    let ap = a, sum = 1 / a, del = sum;
    for (let i = 0; i < 500; i++) {
      ap += 1; del *= x / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
  }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;   // Lentz continued fraction for Q
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
};

export const chiSqP = (stat, df) => (df <= 0 || !isFinite(stat)) ? 1 : gammaQ(df / 2, stat / 2);

/**
 * G-test of independence between a feature's value and the action taken.
 *
 * G rather than Pearson chi-square: G is the likelihood-ratio statistic, which is the SAME
 * quantity the induction already optimises (information gain), scaled by 2*n*ln2. Judging a
 * split with a different statistic than the one used to make it would be incoherent.
 */
export const gTest = (pairs) => {
  const rows = new Map(), cols = new Map(), cell = new Map();
  for (const [f, a] of pairs) {
    rows.set(f, (rows.get(f) || 0) + 1);
    cols.set(a, (cols.get(a) || 0) + 1);
    const k = f + '\t' + a;
    cell.set(k, (cell.get(k) || 0) + 1);
  }
  const n = pairs.length;
  if (rows.size < 2 || cols.size < 2) return { G: 0, df: 0, p: 1, n };
  let G = 0;
  for (const [f, rc] of rows) for (const [a, cc] of cols) {
    const o = cell.get(f + '\t' + a) || 0;
    if (!o) continue;
    const e = (rc * cc) / n;
    G += 2 * o * Math.log(o / e);
  }
  const df = (rows.size - 1) * (cols.size - 1);
  return { G, df, p: chiSqP(G, df), n };
};

/** Wilson interval - honest at small n, where a normal approximation is not. */
export const wilson = (k, n, z = 1.96) => {
  if (!n) return [0, 1];
  const p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
};

/** The coarsest holding split that cannot be accused of fitting: pair / broadway / other. */
const shownClass = (d) => {
  const r = (c) => '23456789TJQKA'.indexOf(c[0]);
  const [a, b] = d.holeCards;
  if (r(a) === r(b)) return 'pair';
  return (r(a) >= 9 && r(b) >= 9) ? 'broadway' : 'other';
};

/**
 * Classify one leaf.
 *
 * @param pool      the decisions at the leaf
 * @param features  { name -> fn(decision) -> value|null }, the SAME map the induction used
 * @param used      feature names already spent on the path to this leaf
 * @param alpha     family-wise error rate, Bonferroni-split across testable features
 */
/**
 * Exact test by permutation, for tables the chi-square approximation cannot serve.
 *
 * The observed G is compared against G under action labels shuffled within the leaf. That
 * null is exactly right regardless of how sparse the table is, which is the whole point: a
 * 25-decision leaf over three actions has no valid asymptotic test and this one needs no
 * asymptotics. Seeded so a rerun of the same leaf yields the same p - a verdict that moved
 * between identical runs would not be a record.
 */
const REPS = 2000;
export const permutationP = (pairs, observedG, seed = 0x9e3779b9) => {
  const vals = pairs.map((x) => x[0]);
  const acts = pairs.map((x) => x[1]);
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  let atLeast = 1;                       // +1 for the observed table itself
  for (let r = 0; r < REPS; r++) {
    const shuffled = acts.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    if (gTest(vals.map((v, i) => [v, shuffled[i]])).G >= observedG) atLeast++;
  }
  return atLeast / (REPS + 1);
};
export const classifyLeaf = (pool, features, used, { alpha = 0.05 } = {}) => {
  const tally = new Map();
  for (const d of pool) tally.set(d.action, (tally.get(d.action) || 0) + 1);
  const dist = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const n = pool.length;
  const shown = pool.filter(d => d.handKnown);

  if (dist.length === 1) {
    return { verdict: 'always', dist, n, tested: 0, separators: [],
      cardTest: null, shownCount: shown.length };
  }

  // -- every unused feature, NO minimum-n floor: the floor is what hid the condition --
  const candidates = [];
  // Features too fine-grained to test at this leaf size. Reported, never silently dropped.
  const unusable = [];
  for (const [fname, fn] of Object.entries(features)) {
    if (used.has(fname)) continue;
    const pairs = [];
    let complete = true;
    for (const d of pool) {
      const v = fn(d);
      if (v == null) { complete = false; break; }
      pairs.push([String(v), d.action]);
    }
    if (!complete) continue;
    const t = gTest(pairs);
    /**
     * THE CHI-SQUARE APPROXIMATION HAS A CONDITION, AND IT WAS NOT CHECKED.
     *
     * With one row per distinct value, G degenerates to 2*n*H(marginal) with df = n-1 and
     * stops depending on the association entirely. Measured: a shuffled unique id at n=330
     * with a 204/126 marginal produced G = 438.9 = 2*n*H exactly, and was declared a
     * separator at pAdj = 1.4e-4.
     *
     * The standard guard is a floor on the EXPECTED cell counts. A feature that cannot clear
     * it is marked `unusable` rather than dropped, because "not testable at this resolution"
     * and "does not separate" are different facts and the whole point of this file is to stop
     * the second one being asserted when only the first was established.
     */
    const acts = new Set(pairs.map((x) => x[1])).size;
    const density = (ps) => {
      const lv = new Set(ps.map((x) => x[0])).size;
      return acts > 0 && lv > 0 ? ps.length / (lv * acts) : 0;
    };
    if (t.df > 0 && density(pairs) >= 5) { candidates.push({ feature: fname, ...t }); continue; }

    /**
     * TOO FINE TO TEST AT FULL RESOLUTION - so test it at a resolution where the test is
     * valid, rather than discarding it. Quantile bands from the leaf's own distribution keep
     * the feature's ORDER (which is where a continuous separator's signal lives) while making
     * the contingency table dense. A real monotone effect survives this; the degenerate
     * one-row-per-value artifact cannot, because banding is precisely what destroys it.
     */
    /**
     * ORDERED FEATURES ARRIVE AS LABEL STRINGS - 'str hit vuln = 32', not 32.
     *
     * The first version of this tested Number(x[0]), which is NaN for every such label, so the
     * banding branch below was DEAD CODE and every continuous feature fell through to the
     * frequency-collapse path instead. Collapsing a continuous quantity to its most COMMON
     * values plus 'other' is an arbitrary grouping, and it manufactured a separator: leaf n=66
     * reported str_hit_vuln at pAdj=0.0115, while the same feature banded by VALUE gives
     * G=3.54, permutation p=0.32, and an independent 20,000-shuffle test gives 0.81.
     *
     * Parse the trailing number so ordering is recovered and the bands mean something.
     */
    const numOf = (lab) => {
      const m = /=\s*(-?[0-9.]+)\s*$/.exec(String(lab));
      return m ? Number(m[1]) : Number(lab);
    };
    const numeric = pairs.every((x) => Number.isFinite(numOf(x[0])));
    if (numeric) {
      const vals = pairs.map((x) => numOf(x[0])).sort((a, b) => a - b);
      for (const k of [4, 3, 2]) {
        const cuts = Array.from({ length: k - 1 },
          (_, i) => vals[Math.floor(((i + 1) / k) * (vals.length - 1))]);
        const banded = pairs.map(([v, a]) => {
          const x = numOf(v);
          let b = 0; while (b < cuts.length && x > cuts[b]) b++;
          return [`q${b}`, a];
        });
        const bt = gTest(banded);
        if (bt.df > 0 && density(banded) >= 5) {
          candidates.push({ feature: fname, ...bt, banded: k });
          break;
        }
      }
      if (!candidates.some((c) => c.feature === fname)) {
        // Banding could not make the approximation valid, so test the 2-band table exactly.
        const cuts2 = [vals[Math.floor(0.5 * (vals.length - 1))]];
        const b2 = pairs.map(([v, a]) => [numOf(v) > cuts2[0] ? 'hi' : 'lo', a]);
        const t2 = gTest(b2);
        if (t2.df > 0) {
          candidates.push({ feature: fname, ...t2, p: permutationP(b2, t2.G), exact: 'permutation', banded: 2 });
        } else {
          unusable.push({ feature: fname, reason: 'constant within this leaf' });
        }
      }
      continue;
    }
    /**
     * A SPARSE CATEGORICAL IS COLLAPSED, NOT DISCARDED. Rare levels are pooled into 'other'
     * until the table is dense enough to test. Dropping them instead left some leaves with
     * NOTHING testable, and the post-induction gate correctly refused the whole ruleset - a
     * mix verdict on a leaf where nothing could be tested is a blank, not a finding.
     */
    const freq = new Map();
    for (const [v] of pairs) freq.set(v, (freq.get(v) || 0) + 1);
    const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    let collapsed = null;
    for (let keep = Math.min(ranked.length - 1, 6); keep >= 1; keep--) {
      const top = new Set(ranked.slice(0, keep));
      const cand = pairs.map(([v, a]) => [top.has(v) ? v : 'other', a]);
      const ct = gTest(cand);
      if (ct.df > 0 && density(cand) >= 5) { collapsed = { ...ct, levels: keep + 1 }; break; }
    }
    if (collapsed) candidates.push({ feature: fname, ...collapsed, collapsedTo: collapsed.levels });
    else {
      /**
       * Nothing the approximation can serve. Take the exact route rather than dropping the
       * feature: dropping it is what left leaves with zero testable features and got two
       * rulesets refused by the gate.
       */
      const t2 = gTest(pairs);
      if (t2.df > 0) {
        candidates.push({ feature: fname, ...t2, p: permutationP(pairs, t2.G), exact: 'permutation' });
      } else {
        unusable.push({ feature: fname, reason: 'constant within this leaf' });
      }
    }
  }
  /**
   * ONE FAMILY, m + 1 TESTS. The m observable features and the single card test are compared
   * against each other to produce one verdict, so they are corrected together. Correcting the
   * observables and not the cards made the card test m times easier to pass than any feature
   * it was competing with, and the verdict it produces - "only his cards resolve it" - is the
   * one that says more corpus cannot help.
   */
  const m = (candidates.length || 1) + 1;
  const separators = candidates
    .filter(c => c.p * m < alpha)
    .sort((a, b) => a.p - b.p)
    .map(c => ({ ...c, pAdj: Math.min(1, c.p * m) }));

  // -- do the SHOWN hands separate? the direct test for a hidden hand-class condition --
  let cardTest = null;
  if (shown.length >= 6) {
    cardTest = gTest(shown.map(d => [shownClass(d), d.action]));
    cardTest.nShown = shown.length;
  }

  if (cardTest) cardTest.pAdj = Math.min(1, cardTest.p * m);

  /**
   * THE NEAR MISS, reported rather than discarded.
   *
   * When no feature clears the corrected threshold the leaf is called a mix, and a reader has
   * no way to tell "nothing observable came close" from "the best observable was at raw
   * p=0.012 and lost to a correction over 84 features". Those are different situations and the
   * second one names exactly which spot to go and get more hands for. Carrying it costs one
   * field; discarding it throws away the only pointer the leaf produced.
   */
  const best = candidates.slice().sort((a, b) => a.p - b.p)[0] || null;
  const nearMiss = (best && !separators.length && best.p < alpha)
    ? { feature: best.feature, p: best.p, pAdj: Math.min(1, best.p * m), family: m }
    : null;

  const verdict = separators.length ? 'hidden-cond'
    : (cardTest && cardTest.pAdj < alpha) ? 'needs-cards'
      : 'mix';

  return { verdict, dist, n, tested: candidates.length, family: m,
    untestable: unusable, separators,
    cardTest, nearMiss, shownCount: shown.length };
};
