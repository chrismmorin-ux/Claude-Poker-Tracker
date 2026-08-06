/**
 * holeMap.mjs — the pure arithmetic behind View 7 of the Scored Readout: THE HOLE MAP.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE QUESTION THIS ANSWERS (founder, 2026-08-05):
 *
 *   "I need a visual of the decision tree with numbers at its termination points and
 *    decision points. I need to see which boards have which preponderance of actions and
 *    where the thresholds are. I should be able to see a distribution and where the holes
 *    are. IE, a check raise isn't present, but if it were, the pot odds would imply what
 *    fold % and what continue % based on what inelasticity model? THIS is our exploit
 *    opportunity."
 *
 * Views 1-6 of SCORED-READOUT-SPEC.md measure how good our action is ON BRANCHES THE POOL
 * TAKES. This is the inverse: WHAT IS THE PRICE OF THE BRANCHES NOBODY TAKES? A line the
 * pool almost never faces has no defence constructed against it, so the hole in the action
 * distribution IS the exploit.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE THREE QUANTITIES, AND WHY ALL THREE ARE REQUIRED (coordinator amendment, 2026-08-05)
 *
 * The founder anchored the ask on a RATE: "good players make upwards of 20bb per hour".
 * That is a scale test. A gap reported as "+0.35 bb when it occurs" is unactionable — he
 * cannot tell whether that is a fifth of a good player's edge or a rounding error. So every
 * hole row carries three numbers, not one:
 *
 *   1. GAP PER OCCURRENCE   predicted fold% − required fold%, converted to bb at that
 *                           spot's pot geometry.
 *   2. OCCURRENCE RATE      how often the spot arises, per 100 hands. §14.1 of
 *                           POKER_THEORY is explicit that this is the repo's currency.
 *   3. GAP x RATE           in bb/hour, at a STATED hands-per-hour figure.
 *
 * Rows sort by (3). That ordering is the answer to "where is the exploit", and it disagrees
 * with the ordering by (1) — a large gap in a rare spot loses to a modest gap in a common
 * one, which is exactly what this instrument exists to show.
 *
 * TWO GUARDS, because column 3 is the easiest number here to inflate:
 *
 *   · `totalBbPerHour` REFUSES to sum rows that are not disjoint. Two holes on the same
 *     node are not additive, and a summed "total available edge" that double-counts is the
 *     most misleading number this instrument could produce. See `sumDisjoint`.
 *   · A row's RATE and its GAP have different n. The occurrence rate may rest on 20,000
 *     hands while the fold-elasticity prediction behind the gap rests on 205 decisions.
 *     Both n's ride on the row separately (`nGap`, `nRate`) and neither is ever collapsed
 *     into a single "n" — the larger one would launder the smaller.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE STANDING PRIOR ON A NEGATIVE RESULT (founder, 2026-08-05)
 *
 *   "triple barrel bluffs, or triple barrel with a river 3bet exist and win huge pots when
 *    they do, otherwise good players would NEVER do them, because they would statistically
 *    hurt them. Good players track decisions and win rate, so we can assume that there is
 *    some validity to all these possible lines."
 *
 * This is an argument from revealed preference by results-tracking practitioners, and it is
 * legitimate evidence. It is encoded here as a rule, not held in someone's head, because
 * the DEFAULT reading of a negative number is the opposite one and a future reader will
 * make that mistake:
 *
 *   >>> IF THIS INSTRUMENT REPORTS THAT A LINE WINNING PLAYERS DEMONSTRABLY USE IS -EV,
 *   >>> THE LEADING HYPOTHESIS IS THAT THE MODEL OF THE LINE IS WRONG — NOT THAT THE LINE
 *   >>> IS WRONG.
 *
 * `PRACTITIONER_REPERTOIRE` names the lines this applies to. `classifyGap` flags a negative
 * gap on one of them `model-suspect` rather than `line-unprofitable`, and names the specific
 * component that would have to be wrong.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY THE IPS ESTIMATOR CANNOT PRICE THESE LINES, STRUCTURALLY
 *
 * `ipsEstimator` reweights by `w = pi_ours / pi_pool`. A line that is a HOLE has pi_pool
 * near zero BY DEFINITION. So the weight explodes or hits the cap (`weightCap: 20`), the
 * payoff magnitude is large (the founder's "huge pots") so variance goes as magnitude², and
 * the occurrence count is tiny. THE LINES HE MOST WANTS PRICED ARE PRECISELY WHERE
 * IMPORTANCE-WEIGHTED ESTIMATION IS STRUCTURALLY WEAKEST. That is why this module prices
 * holes from POT GEOMETRY AND A MEASURED FOLD CURVE rather than from the IPS arm, and why
 * `buildOutcomeArm` exists as an engine-independent check.
 */

/** bet/pot -> the fold frequency a PURE bluff needs to break even. `s/(1+s)`. */
export const requiredFoldBet = (s) => (s > 0 ? s / (1 + s) : 0);

/**
 * Raise-to-`R` over a bet of `B` into a pot of `P` -> breakeven fold frequency.
 *
 * Hero risks `R` and wins `P + B` when villain folds, so `f(P+B) = (1-f)R`. Expressed in
 * the two dimensionless numbers the corpus actually carries: `s = B/P` (the size bucket)
 * and `m = R/B` (the raise multiple).
 */
export const requiredFoldRaise = (s, m) => {
  const num = m * s;
  const den = m * s + 1 + s;
  return den > 0 ? num / den : 0;
};

/**
 * The axis the measured fold curve is keyed on, for a DEFENDER facing a raise.
 *
 * `out/fold-vs-sizing.json` declares its axis as
 * `fracEngine = owed / (potIncludingFacedBet - owed)`. For a defender who already has `B`
 * in and faces a raise to `R` over a pot of `P`: `owed = R - B`, the pot including the
 * faced raise is `P + B + R`, and the denominator reduces to `P + 2B`. In `s`/`m` terms
 * that is `(m-1)s / (1 + 2s)`.
 *
 * Getting this wrong silently reads the fold curve at the wrong point, which would move
 * every raise row's gap without moving anything visible. It is a named function so it has
 * somewhere to be tested.
 */
export const raiseLookupFrac = (s, m) => {
  const den = 1 + 2 * s;
  return den > 0 ? ((m - 1) * s) / den : 0;
};

/**
 * bb swing per percentage-point of fold-frequency error, at this geometry.
 *
 * At the breakeven frequency the line's EV is exactly 0, and EV is linear in `f` with slope
 * `(amount won on a fold) + (amount risked)`. So the whole gap converts to money with one
 * multiply and no simulation. `potBB` is the pot BEFORE the action being priced.
 */
export const evSlopeBet = (potBB, s) => potBB * (1 + s);
export const evSlopeRaise = (potBB, s, m) => potBB * (1 + s + m * s);

/**
 * The lines a results-tracking winning player demonstrably uses.
 *
 * Membership changes how a NEGATIVE gap is read (see the module docblock). Kept as data so
 * the visual and the spec read the same list, and so adding one is a one-line change rather
 * than an edit to prose in three places.
 */
export const PRACTITIONER_REPERTOIRE = Object.freeze({
  flop_checkraise: 'check-raise',
  turn_checkraise: 'check-raise',
  river_checkraise: 'check-raise',
  checkraise_fold: 'check-raise then fold to the re-raise',
  double_barrel: 'multi-street barrel',
  triple_barrel: 'multi-street barrel',
  barrel_then_river_raise: 'triple barrel with a river raise',
  escalating_sizing: 'increasing value bet sizing across streets',
});

/**
 * Which model component would have to be wrong, per line family.
 *
 * A "model suspect" flag that does not name a suspect is a shrug. Each entry points at the
 * specific thing to go and measure.
 */
export const SUSPECT_COMPONENT = Object.freeze({
  'check-raise':
    'THE PURE-BLUFF ASSUMPTION FIRST. This row prices a check-raise with ZERO equity when '
    + 'called, so all of its value must come from fold equity. The pool\'s actual check-raises '
    + 'are mostly value and semi-bluffs with real equity, and their EV comes from the called '
    + 'branch this model sets to zero. Second: the fold-elasticity curve at raise sizings — '
    + 'the facing-a-raise arm was measured and never merged into the shipped fit.',
  'multi-street barrel':
    'the villain river continuation range — a barrel is priced by who is still there on the '
    + 'river, and the range engine is graded on flop/turn evidence',
  'triple barrel with a river raise':
    'the villain river continuation range AND the fold curve tail above 1.5x pot, where the '
    + 'measured bins carry the smallest n in the whole curve',
  'increasing value bet sizing across streets':
    'the fold curve at large sizings, and the assumption that the pool re-optimises its '
    + 'defence per street rather than carrying a fixed continuation frequency',
});

/**
 * Read a negative gap. This function IS the standing prior.
 *
 * A negative gap on a line nobody good plays is a finding. A negative gap on a line every
 * winning player plays is a bug report against this instrument.
 */
export const classifyGap = (gapPp, lineId) => {
  const family = PRACTITIONER_REPERTOIRE[lineId] ?? null;
  if (gapPp >= 0) {
    return { verdict: 'gap-positive', family, suspectComponent: null };
  }
  if (family) {
    return {
      verdict: 'model-suspect',
      family,
      suspectComponent: SUSPECT_COMPONENT[family] ?? null,
      note:
        'NEGATIVE GAP ON A LINE WINNING PLAYERS DEMONSTRABLY USE. Per the standing prior '
        + '(founder 2026-08-05), the leading hypothesis is that the MODEL of this line is '
        + 'wrong, not that the line is unprofitable. Read this row as a defect report '
        + 'against the named component, not as advice to avoid the line.',
    };
  }
  return { verdict: 'line-unprofitable', family: null, suspectComponent: null };
};

/**
 * Parse the HOLD-OUT block of `out/fold-curve-fit.txt` into `{s, n, k, obs}` bins.
 *
 * THE HOLD-OUT, NOT THE FIT SET, ON PURPOSE. The shipped curve's parameters were chosen on
 * the fit half; reading predicted-fold off the same half would price every hole against a
 * number that was tuned to it. EVAL players, days 12-23, n = 316,178.
 */
export const parseHoldOutFoldCurve = (txt) => {
  const bins = [];
  let inBlock = false;
  for (const raw of String(txt).split(/\r?\n/)) {
    if (raw.includes('### HOLD-OUT')) { inBlock = true; continue; }
    if (!inBlock) continue;
    if (raw.trimStart().startsWith('[')) break;          // the residual-summary footer
    const m = raw.trim().match(/^([\d.]+)\s+(\d+)\s+(\d+)\s+([\d.]+)/);
    if (m) bins.push({ s: +m[1], n: +m[2], k: +m[3], obs: +m[4] });
  }
  return bins;
};

/**
 * Build a binned fold curve straight from `out/fold-vs-sizing.json`.
 *
 * This is the ONLY source in the repo for a fold curve conditioned on FACING A RAISE, which
 * is the arm every check-raise row needs and which the shipped fit deliberately excluded.
 * `binWidth` and the bin index convention come from the file's own `meta`.
 */
export const foldCurveFromCells = (doc, { group = 'eval', facing = 'bet', street = null } = {}) => {
  const binWidth = doc?.meta?.binWidth ?? 0.05;
  const acc = new Map();
  for (const [key, cell] of Object.entries(doc?.cells ?? {})) {
    const [g, , , st, fc, binStr] = key.split('|');
    if (g !== group) continue;
    if (facing && fc !== facing) continue;
    if (street && st !== street) continue;
    const bin = Number.parseInt(binStr, 10);
    if (!Number.isInteger(bin)) continue;
    const cur = acc.get(bin) ?? { n: 0, k: 0, sumFrac: 0 };
    cur.n += cell.n ?? 0;
    cur.k += cell.folds ?? 0;
    cur.sumFrac += cell.sumFrac ?? 0;
    acc.set(bin, cur);
  }
  return [...acc.entries()]
    .map(([bin, v]) => ({
      // The bin's OWN mean fraction where it is available — a bin is 0.05 wide and its
      // occupants are not uniform inside it, so the midpoint would misplace the busy bins.
      s: v.n > 0 && v.sumFrac > 0 ? v.sumFrac / v.n : (bin + 0.5) * binWidth,
      bin,
      n: v.n,
      k: v.k,
      obs: v.n > 0 ? v.k / v.n : null,
    }))
    .filter((b) => b.n > 0)
    .sort((a, b) => a.s - b.s);
};

/**
 * Read a measured fold curve at an arbitrary `s`, by pooling the bins that bracket it.
 *
 * Returns the pooled `k/n` and the bins it came from, NEVER an interpolated point estimate
 * with no n behind it. Every consumer needs the n as much as the rate — a hole priced off a
 * bin with n = 205 and one priced off a bin with n = 36,223 are not the same claim, and an
 * interpolation would make them look identical.
 */
export const readFoldCurve = (bins, s, { halfWidth = 0.08 } = {}) => {
  const near = bins.filter((b) => Math.abs(b.s - s) <= halfWidth);
  const use = near.length ? near : (() => {
    // Nothing within the window — fall back to the single nearest bin and say so.
    let best = null;
    for (const b of bins) {
      if (!best || Math.abs(b.s - s) < Math.abs(best.s - s)) best = b;
    }
    return best ? [best] : [];
  })();
  if (!use.length) return { obs: null, n: 0, k: 0, bins: [], exact: false };
  const n = use.reduce((a, b) => a + b.n, 0);
  const k = use.reduce((a, b) => a + b.k, 0);
  return {
    obs: n > 0 ? k / n : null,
    n,
    k,
    bins: use.map((b) => b.s),
    exact: near.length > 0,
  };
};

/** The shipped ENGINE curve, so its threshold can sit on the same axis as the measured one. */
export const POPULATION_CURVE = Object.freeze({
  maxDelta: 0.95, steepness: 1.0, steepnessUp: 6.5, steepnessDown: 0.75, midpoint: 0.35,
});
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/**
 * `villainModelData.js:379-397`, reproduced so the visual can draw the engine's own curve
 * beside the measured one. `baseFold` is the LEVEL and it is NOT fitted — see
 * `INELASTICITY_PROVENANCE` below, which is the whole answer to the founder's question.
 */
export const engineFoldPct = (frac, baseFold, curve = POPULATION_CURVE) => {
  const k = frac < curve.midpoint ? (curve.steepnessUp ?? curve.steepness) : (curve.steepnessDown ?? curve.steepness);
  return clamp01(baseFold + (sigmoid(k * (frac - curve.midpoint)) - 0.5) * curve.maxDelta);
};

/**
 * FIT OR ASSUMED — the founder's question, answered per component.
 *
 * This is the load-bearing disclosure in the whole instrument. If the elasticity model were
 * assumed, every gap and therefore every bb/hour figure would be an assumption wearing a
 * measurement's clothes. It is not that simple, and the split matters:
 *
 *   THE SHAPE IS FIT. THE LEVEL IS NOT.
 *
 * Which is why this module prices holes off the MEASURED curve (`obs` from the hold-out
 * bins) rather than off `engineFoldPct` — the measured curve carries both shape and level
 * from the same data, and the engine's does not.
 */
export const INELASTICITY_PROVENANCE = Object.freeze([
  {
    component: 'Fold-curve SHAPE (maxDelta, midpoint, steepnessUp, steepnessDown)',
    status: 'FIT',
    evidence:
      'Brier-minimised on HandHQ POOL players days 1-11 (k=98,273 / n=178,174), validated on '
      + 'EVAL players days 12-23 (k=178,794 / n=318,347). Hold-out residual slope vs frac '
      + '+0.1409 -> +0.0078; Brier 0.24054 -> 0.23530. WS-283, commit 923aef3a.',
    site: 'src/utils/exploitEngine/villainModelData.js:239-256',
  },
  {
    component: 'Fold-curve LEVEL (baseFold / POPULATION_FOLD_RATE = 0.45)',
    status: 'ASSUMED',
    evidence:
      'Deliberately not fitted, under the ratified live/online separation (WS-259). Pinning '
      + 'the base at the shipped 0.45 live estimate leaves the hold-out under-predicting by '
      + '+9.5pp / +9.2pp / +2.9pp across the three size buckets — the level is a live-game '
      + 'estimate the online corpus is not allowed to overwrite.',
    site: 'src/utils/exploitEngine/foldEquityCalculator.js:562-565',
  },
  {
    component: 'Per-style curve multipliers (1.2 / 0.8 / 0.8 / 0.7 / 0.9)',
    status: 'ASSUMED',
    evidence:
      'Founder estimate, never measured against anything. The code says so verbatim: an '
      + 'earlier comment claiming calibration against live 1/2 showdown data was WITHDRAWN '
      + 'in WS-283 because no such calibration exists in the repo.',
    site: 'src/utils/exploitEngine/villainModelData.js:264-292',
  },
  {
    component: 'Per-street modifiers (FOLD_CURVE_STREET_MODS)',
    status: 'MEASURED AND REFUTED, STILL SHIPPED',
    evidence:
      'Applying the shipped mods on top of the refit makes the hold-out Brier WORSE on all '
      + 'three streets: flop 0.23668 -> 0.23723, turn 0e-5, river 0.22844 -> 0.22885. They '
      + 'were left in place deliberately rather than removed inside a shape ticket.',
    site: 'src/utils/exploitEngine/villainModelData.js:336-340',
  },
  {
    component: 'sprMidpointMultiplier (0.50 + log2(spr)*0.15, clamped [0.65, 1.20])',
    status: 'ASSUMED',
    evidence: 'No fit artifact exists anywhere in the repo for these constants.',
    site: 'src/utils/exploitEngine/gameTreeConstants.js:84-87',
  },
  {
    component: 'Facing-a-RAISE elasticity — the arm every check-raise row needs',
    status: 'FIT SEPARATELY, NEVER MERGED',
    evidence:
      'Hold-out facing a raise: n=45,293, k=19,212, marginal 0.4242, slope 0.1842 -> 0.0522. '
      + 'Measured, reported, and then NOT folded into the shipped curve. This module reads '
      + 'it directly out of out/fold-vs-sizing.json (facing=raise) rather than reusing the '
      + 'facing-a-bet curve, which would be the wrong population for a raise row.',
    site: 'out/fold-curve-fit.txt (facing a RAISE block); out/fold-vs-sizing.json cells',
  },
]);

/**
 * THE SELECTION CAVEAT THAT SHRINKS EVERY GAP, AND IS NOT CORRECTABLE FROM THIS DATA.
 *
 * The measured fold rate is conditioned on THE BETS THE POOL ACTUALLY MADE. Those bets carry
 * the pool's real range. A bluff you ADD to the tree is a bet the pool did not make, faced
 * by a defender who — if you took the line often — would widen against it. So the measured
 * `obs` is an upper bound on the fold rate a systematic exploiter would face, and every gap
 * below is an upper bound that DECAYS WITH USE.
 *
 * This is not a footnote. It is the difference between "the pool over-folds" (true, measured)
 * and "you can print money by always bluffing" (false, and the instrument must not imply it).
 */
export const EXPLOIT_DECAY_CAVEAT =
  'The measured fold rate is conditioned on the bets the pool actually made, with the pool\'s '
  + 'real range behind them. A bluff added to the tree is a bet the pool did not make. Against '
  + 'a defender who adapts, the fold rate falls toward the required rate — so every gap here is '
  + 'an UPPER BOUND that decays with use. The corpus cannot measure the decay rate: it contains '
  + 'no counterfactual in which hero bluffed more.';

/**
 * THE ONE ASSUMPTION EVERY GAP IN THIS INSTRUMENT RESTS ON, NAMED ONCE.
 *
 * `requiredFoldBet` / `requiredFoldRaise` are the breakeven frequencies for a hand with NO
 * equity when called. That is the right price for a pure bluff and the WRONG price for
 * everything else: a semi-bluff with 30% equity needs far fewer folds, and a value hand
 * needs none at all.
 *
 * So a NEGATIVE gap on this table says "this line does not pay AS A PURE BLUFF". It does not
 * say the line does not pay. That distinction is the entire reconciliation between the model
 * arm and the outcome arm, and without it a reader will take a −8pp gap on check-raising as
 * an instruction not to check-raise, which the corpus flatly contradicts.
 */
export const ZERO_EQUITY_ASSUMPTION =
  'Every required-fold figure here is the breakeven for a hand with ZERO equity when called — '
  + 'a pure bluff. A semi-bluff needs fewer folds and a value hand needs none. A negative gap '
  + 'therefore means "does not pay AS A PURE BLUFF", never "does not pay".';

/** Live 9-handed is roughly this. The conversion is a TRANSFER, and every row says so. */
export const DEFAULT_HANDS_PER_HOUR = 25;

/**
 * Denominate one hole: gap -> per-occurrence bb -> per-100-hands -> bb/hour.
 *
 * `nGap` and `nRate` stay separate all the way through. There is no combined `n` and there
 * must not be one.
 */
export const denominate = ({
  gapFold, slopeBB, ratePer100, nGap, nRate, handsPerHour = DEFAULT_HANDS_PER_HOUR,
}) => {
  const perOccurrenceBB = gapFold == null || slopeBB == null ? null : gapFold * slopeBB;
  const bbPer100 = perOccurrenceBB == null || ratePer100 == null
    ? null : perOccurrenceBB * ratePer100;
  const bbPerHour = bbPer100 == null ? null : (bbPer100 / 100) * handsPerHour;
  return {
    gapFoldPp: gapFold == null ? null : gapFold * 100,
    perOccurrenceBB,
    ratePer100,
    bbPer100,
    bbPerHour,
    handsPerHour,
    nGap: nGap ?? 0,
    nRate: nRate ?? 0,
    rateMeasured: ratePer100 != null,
    rateUnmeasuredReason: ratePer100 != null ? null
      : 'Spot frequency not established from the sampled corpus slice. The per-occurrence gap '
      + 'stands; the rate does not. A full-corpus pass over the same line matcher would measure it.',
    transferNote:
      `bb/hour assumes ${handsPerHour} hands/hour (live 9-handed). The corpus is ONLINE, where `
      + 'table pace is several multiples faster, so the RATE transfers worse than the '
      + 'per-occurrence gap. The per-100-hands figure beside it is the repo\'s own currency '
      + '(POKER_THEORY §14.1) and carries no pace assumption.',
  };
};

/**
 * Sum bb/hour across rows — and REFUSE when the rows are not disjoint.
 *
 * Two holes on the same decision node are alternatives, not addends: you cannot check-raise
 * and donk-bet the same spot. A total that silently adds them is the single most misleading
 * number this instrument could emit, so it is a refusal rather than a caveat.
 */
export const sumDisjoint = (rows, keyOf = (r) => r.nodeKey) => {
  const seen = new Map();
  const collisions = [];
  for (const r of rows) {
    const k = keyOf(r);
    if (seen.has(k)) collisions.push({ nodeKey: k, rows: [seen.get(k).lineId, r.lineId] });
    else seen.set(k, r);
  }
  if (collisions.length) {
    return {
      total: null,
      disjoint: false,
      collisions,
      reason:
        'REFUSED. These rows share decision nodes, so their bb/hour figures are alternatives '
        + 'at the same spot, not additive contributions. Summing them would double-count. '
        + 'Pick one line per node, or report the rows and no total.',
    };
  }
  const withValue = rows.filter((r) => Number.isFinite(r?.denom?.bbPerHour));
  return {
    total: withValue.reduce((a, r) => a + r.denom.bbPerHour, 0),
    disjoint: true,
    collisions: [],
    rowsSummed: withValue.length,
    rowsDropped: rows.length - withValue.length,
    reason: null,
  };
};

/** Flatten a behaviour-policy level into `{key, parts, counts, n, freq}` node rows. */
export const flattenPolicyLevel = (table, depth) => {
  const hierarchy = table?.provenance?.hierarchy ?? [];
  const level = table?.levels?.[depth] ?? {};
  const dims = ['facingAction', ...hierarchy.slice(0, depth)];
  return Object.entries(level).map(([key, counts]) => {
    const values = key.split('|');
    const parts = Object.fromEntries(dims.map((d, i) => [d, values[i]]));
    const n = Object.values(counts).reduce((a, b) => a + b, 0);
    const freq = Object.fromEntries(
      Object.entries(counts).map(([a, c]) => [a, n > 0 ? c / n : 0]),
    );
    return { key, depth, parts, counts, n, freq };
  });
};

/** Bucket label -> the representative `s = bet/pot` the row is priced at. */
export const SIZE_BUCKET_MIDPOINT = Object.freeze({
  '0-33': 0.25, '33-66': 0.50, '66-100': 0.80, '100-150': 1.20, '150+': 1.75,
});

/**
 * The board dimension, and what it costs.
 *
 * The pool policy is keyed on `analyzeBoardTexture`'s three-way label — `wet` (wetScore>=65),
 * `medium` (>=40), `dry` — collapsed from a 12-field analysis. Per-individual-board is far too
 * sparse: 12,191 observations over ~22,100 distinct flops is well under one observation per
 * board before any other dimension is applied.
 *
 * THE COST IS MEASURED, NOT GUESSED, AND IT IS NEGATIVE. `hierarchyVariants.mjs:109` records
 * that keying on texture scored +0.0132 WORSE than pooling texture away entirely. So the board
 * dimension in this visual is present because the founder asked to see boards, and it is
 * reported with the finding that the repo's own ablation could not make it pay.
 */
export const TEXTURE_RESOLUTION_NOTE = Object.freeze({
  classifier: 'src/utils/pokerCore/boardTexture.js:84 — analyzeBoardTexture',
  labels: ['dry', 'medium', 'wet'],
  rule: 'wetScore >= 65 -> wet; >= 40 -> medium; else dry. wetScore is an 8-term additive '
    + 'score over flushDraw/monotone/flushComplete/straightPossible/connected/isPaired/'
    + 'rainbow/highCardCount, baseline 30, clamped [0,100].',
  discarded:
    'The other 11 fields of the analysis never cross the backtest seam — decisionAccumulator '
    + 'takes `.texture` alone. So monotone-and-paired and two-tone-and-connected are the same '
    + 'cell here, and any read that depends on WHICH kind of wet cannot be made from this data.',
  measuredCost:
    'scripts/backtest/hierarchyVariants.mjs:109 — keying the policy on texture measured '
    + '+0.0132 WORSE than pooling texture away. The dimension is shown because it was asked '
    + 'for; the repo\'s own ablation says it does not currently earn its place.',
});
