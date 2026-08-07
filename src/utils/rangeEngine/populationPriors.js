/**
 * populationPriors.js - Default "typical live 1/2 player" priors
 *
 * Defines population-level action frequencies and range grids per position.
 * These serve as Bayesian priors that are updated with observed data.
 * NOT GTO — models typical live 1/2 tendencies (looser, more passive).
 *
 * PROVENANCE (2026-06-19 · WS-235 / FIND-023 / docs/provenance registry SRC-009):
 *   FACED_RAISE_RATE / NO_RAISE_FREQUENCIES / FACED_RAISE_FREQUENCIES below are a FOUNDER
 *   ESTIMATE of the live 1/2 pool — informed judgment, NOT a measured dataset. Author-estimate
 *   trust (Field-frame prior). WS-235 Step 2 grounds them empirically from observed pool hands as
 *   data accumulates (hierarchical, self-weighted by sample). Do NOT cite as measured until then.
 *
 * KEY DESIGN: Preflop actions split into two independent decision trees:
 *   No raise faced:  fold | limp | open        (sums to 1.0)
 *   Facing a raise:  fold | coldCall | threeBet (sums to 1.0)
 *
 * A hand like AA can be 100% in "open" AND 100% in "threeBet" —
 * these are conditional on different game states, not competing.
 */

import { createRange, rangeIndex, decodeIndex, PREFLOP_CHARTS, averageCharts } from '../pokerCore/rangeMatrix.js';
import { softContinuationWeights, MIN_CONTINUATION_WEIGHT, quantile } from '../pokerCore/softWeights.js';
import { EQUITY_VS_OPEN } from '../pokerCore/preflopEquityTable.js';

const GRID_SIZE = 169;
const TOTAL_COMBOS = 1326;

/**
 * How often does a player in this position face a raise before acting?
 * Table-dependent; these are reasonable live 1/2 defaults.
 */
export const FACED_RAISE_RATE = {
  EARLY:  0.15, // UTG/UTG+1 rarely face a raise (act early)
  MIDDLE: 0.25,
  LATE:   0.35,
  SB:     0.40,
  BB:     0.50, // BB faces a raise ~half the time
};

/**
 * Action frequencies when NO raise has been seen.
 * fold + limp + open = 1.0 per position.
 */
export const NO_RAISE_FREQUENCIES = {
  EARLY:  { fold: 0.83, limp: 0.05, open: 0.12 },
  MIDDLE: { fold: 0.76, limp: 0.08, open: 0.16 },
  LATE:   { fold: 0.62, limp: 0.06, open: 0.32 },
  SB:     { fold: 0.64, limp: 0.12, open: 0.24 },
  BB:     { fold: 0.00, limp: 0.00, open: 0.00 }, // BB checks when no raise — not a voluntary action
};

/**
 * Action frequencies when FACING a raise.
 * fold + coldCall + threeBet = 1.0 per position.
 */
export const FACED_RAISE_FREQUENCIES = {
  EARLY:  { fold: 0.82, coldCall: 0.12, threeBet: 0.06 },
  MIDDLE: { fold: 0.75, coldCall: 0.17, threeBet: 0.08 },
  LATE:   { fold: 0.62, coldCall: 0.26, threeBet: 0.12 },
  SB:     { fold: 0.60, coldCall: 0.28, threeBet: 0.12 },
  BB:     { fold: 0.48, coldCall: 0.40, threeBet: 0.12 },
};

/** Pseudocount strength — how many "virtual observations" the prior represents */
export const PRIOR_WEIGHT = 10;

/** Action groupings by scenario */
export const NO_RAISE_ACTIONS = ['fold', 'limp', 'open'];
export const FACED_RAISE_ACTIONS = ['fold', 'coldCall', 'threeBet'];

// =============================================================================
// DERIVED LINE SUBCLASSES (POKER_THEORY §2.5 / DEC-025)
// =============================================================================

/**
 * Pseudocount strength for a subclass's shrinkage toward its parent posterior.
 * Held at PRIOR_WEIGHT for v1 — see AS-2 in DEC-025 for the falsification test.
 */
export const SUBCLASS_PRIOR_WEIGHT = 10;

/**
 * How a parent's frequency divides across its subclasses, per position.
 * Each position's fractions sum to 1.0 within a parent.
 *
 * PROVENANCE: FOUNDER ESTIMATE — informed judgment, NOT a measured dataset,
 * the same trust class as FACED_RAISE_FREQUENCIES above (author-estimate,
 * Field-frame). WS-264's HandHQ pass-2 position trees are the empirical
 * grounding path; per the WS-263 precedent these should eventually be MEASURED
 * from between-player overdispersion rather than assumed. Tracked as AS-1 in
 * DEC-025 with a 2026-10-25 revisit. Do NOT cite as measured.
 *
 * Shape reasoning (all derived from who acts when, not from position labels
 * as causes — §7.2):
 *  - squeeze share RISES with position: acting later means more chances that a
 *    raise AND a caller are already in front of you.
 *  - limpReraise share FALLS with position: it requires having limped first,
 *    and limping is an early/middle/SB habit.
 *  - BB cannot limp at all (rangeEngine/CLAUDE.md §5), so its limpReraise
 *    share is exactly 0 — the subclass grid stays empty by construction.
 *  - isoRaise share RISES with position for the same reason as squeeze:
 *    limpers must already be in front of you to raise over them.
 */
export const SUBCLASS_SPLIT = {
  threeBet: {
    EARLY:  { cold3Bet: 0.70, squeeze: 0.15, limpReraise: 0.15 },
    MIDDLE: { cold3Bet: 0.68, squeeze: 0.22, limpReraise: 0.10 },
    LATE:   { cold3Bet: 0.60, squeeze: 0.34, limpReraise: 0.06 },
    SB:     { cold3Bet: 0.66, squeeze: 0.26, limpReraise: 0.08 },
    BB:     { cold3Bet: 0.70, squeeze: 0.30, limpReraise: 0.00 },
  },
  open: {
    EARLY:  { openFirstIn: 0.95, isoRaise: 0.05 },
    MIDDLE: { openFirstIn: 0.80, isoRaise: 0.20 },
    LATE:   { openFirstIn: 0.68, isoRaise: 0.32 },
    SB:     { openFirstIn: 0.70, isoRaise: 0.30 },
    // Inert: BB has no voluntary no-raise scenario, so the open parent is 0.
    BB:     { openFirstIn: 0.70, isoRaise: 0.30 },
  },
};

/** Subclass groupings per scenario, for normalization and iteration. */
export const NO_RAISE_SUBCLASSES = ['openFirstIn', 'isoRaise'];
export const FACED_RAISE_SUBCLASSES = ['cold3Bet', 'squeeze', 'limpReraise'];

// =============================================================================
// RANGE CONSTRUCTION HELPERS
// =============================================================================

// =============================================================================
// SUPPORT EVERYWHERE (WS-302)
// =============================================================================

/**
 * How much of each prior's mass is carried by the smooth equity-ranked support grid
 * rather than by the positional chart. A shrinkage weight in the same family as
 * `PRIOR_WEIGHT` and `SUBCLASS_PRIOR_WEIGHT`; 0 reproduces the pre-WS-302 grids exactly.
 *
 * MEASURED, NOT PICKED (WS-302, 2026-07-29). Swept through the WS-293 calibration probe
 * against revealed showdown hands, every arm scored on the SAME decisions so the arms are
 * differenced per decision. Coverage reaches 100% at ANY positive lambda, so it cannot
 * rank the arms — DISCRIMINATION does (mean log P of the hand actually held, vs uniform):
 *
 *     lambda    0       0.40    0.60    0.80    1.00
 *     FTP    -1.545   +0.391  +0.438  +0.456  +0.438   (n=2520)
 *     PS     -1.646   +0.323  +0.373  +0.391  +0.370   (n=2426)
 *
 * 0.80 is the argmax on BOTH sites, and the curve turns over at 1.00 on both — so this is
 * an interior optimum, not a grid that failed to bracket one.
 *
 * Swept twice. The first pass ranked support by a raw equity ramp and put the argmax in
 * the same place (FTP +0.462, PS +0.402), but that construction inverted `fold` and
 * `limp` — see `smoothedShape`. The table above is the corrected support, and the fix
 * cost under 0.01 nats, so the conclusion is the construction's, not the artifact's.
 *
 * READ WHAT THAT SAYS, BECAUSE IT IS UNCOMFORTABLE. At the optimum the hand-built
 * positional charts carry 20% of the prior's shape and a smooth ranking by per-combo
 * preflop equity carries 80% — and switching the charts off entirely (lambda = 1) costs
 * only ~0.01 nats. This is the third time in this engine that an elaborate hand-built
 * mechanism, once measured, lost to the trivial alternative (WS-285's HIERARCHY_ORDER,
 * WS-291's tau). The charts are not worthless — lambda = 0 is catastrophic because of the
 * zeros, and the 0.15-to-0.80 climb is real — but their SHAPE was doing far less work
 * than its provenance implied.
 *
 * THE HONEST CAVEAT. The probe scores the UNOBSERVED-SEAT prior (no VPIP, no observations)
 * against SHOWDOWN hands, which are not a uniform sample of held hands. And raw all-in
 * equity does not encode equity REALIZATION (§1.4) — suited and connected hands play
 * better than their all-in equity suggests, which is exactly the information a chart is
 * supposed to add. The measurement says that information is worth less than assumed; it
 * does not say it is worth nothing.
 *
 * FALSIFICATION TEST. Re-run the sweep against a non-showdown ground truth (the WS-292
 * holding-knowledge join, when it lands) and against a hero-EV metric rather than log
 * loss. If the optimum moves sharply toward 0 under either, the shape information is real
 * and this metric was the wrong instrument. Re-run the sweep — do not re-reason it.
 *
 * RE-SWEPT AT WS-304 (2026-08-05), because that ticket changed the shapes underneath this
 * constant and the argmax could not be assumed to hold. Both arms scored on the SAME 531
 * revealed villain decisions (50NLH, 60 files, 200 players — a smaller slice than the
 * table above, so read the two ROWS against each other, not against the numbers above):
 *
 *     lambda        0      0.40    0.60    0.80    1.00
 *     pre-WS-304  -1.038  +0.581  +0.609  +0.611  +0.577    coverage at lambda 0: 90.4%
 *     WS-304      -0.284  +0.580  +0.593  +0.590  +0.561    coverage at lambda 0: 95.5%
 *
 * Two things, and the second is the uncomfortable one again:
 *
 *   1. Where the doctrine shape actually does the work — lambda = 0 — the ordering fix is
 *      worth +0.754 nats and five points of coverage. That is the WS-304 defect being
 *      priced: a grid that could not hold AK, and that ranked 22 below K3o, was losing
 *      that much per decision.
 *   2. At the SHIPPED lambda it COSTS 0.021 nats (+0.611 -> +0.590), and the argmax drifts
 *      0.80 -> 0.60 across a 0.003-nat plateau. NOT MOVED, deliberately: 0.021 and 0.003
 *      nats are not a basis for changing a constant that a 4,946-decision run put at 0.80,
 *      and this is the arm where 80% of the mass is the smooth support rather than the
 *      shape. The shape fix is a doctrine correctness claim (2.3 names AK as a value
 *      3-bet); this metric — showdown-selected, support-dominated — is not the instrument
 *      that adjudicates it. Re-run at the WS-302 corpus size before moving lambda.
 */
export const PRIOR_SUPPORT_LAMBDA = 0.8;

/** Floor handed to the logistic. Self-limits to 90% of a narrow grid's own width. */
export const PRIOR_SUPPORT_FLOOR = MIN_CONTINUATION_WEIGHT;

/** Combos per grid cell — pairs 6, suited 4, offsuit 12. */
const COMBOS_AT = new Uint8Array(GRID_SIZE);
for (let i = 0; i < GRID_SIZE; i++) {
  const { isPair, suited } = decodeIndex(i);
  COMBOS_AT[i] = isPair ? 6 : suited ? 4 : 12;
}

/**
 * A grid's RANGE WIDTH: the fraction of all 1326 starting combos it holds. This is the
 * quantity the support blend must not move — a rate derived from observation would
 * otherwise be silently rescaled by a change that was only supposed to fill in holes.
 */
const comboWeightedMean = (grid) => {
  let s = 0;
  for (let i = 0; i < GRID_SIZE; i++) s += grid[i] * COMBOS_AT[i];
  return s / TOTAL_COMBOS;
};

/** Per-position expansion of the equity table into one score per COMBO. Built once. */
const scoreCache = {};
const comboScores = (position) => {
  if (scoreCache[position]) return scoreCache[position];
  // Ranking only — the table is keyed by the position whose opening range the hand is
  // measured against, and the ORDER barely moves between keys. An unrecognized category
  // falls back rather than throwing, matching `getBaseChart`.
  const src = EQUITY_VS_OPEN[position] || EQUITY_VS_OPEN.LATE;
  const equity = Float64Array.from(src, (bp) => bp / 10000); // basis points -> fraction
  const cellOf = new Uint16Array(TOTAL_COMBOS);
  let k = 0;
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let c = 0; c < COMBOS_AT[i]; c++) cellOf[k++] = i;
  }
  scoreCache[position] = { equity, cellOf };
  return scoreCache[position];
};

/**
 * Smoothing bandwidth, as a fraction of the equity spread across the 169 cells.
 *
 * Wide enough that a hole is filled by its genuine neighbours, narrow enough that a
 * range's shape is not flattened into its own average.
 */
const SUPPORT_BANDWIDTH = 0.12;

/**
 * The prior's own shape, smoothed over equity — this is the SCORE the support ranks by.
 *
 * WHY NOT A PLAIN EQUITY RAMP. The obvious construction is "rank every hand by equity and
 * lay a logistic over it", and it is wrong for most of these grids, because not every
 * preflop action is "stronger hand, more likely":
 *
 *   open        rises with strength          a ramp fits (r = 0.81)
 *   fold        FALLS with strength          a ramp fits, mirrored (r = -0.85)
 *   limp        peaks in the MIDDLE (2.2)    no monotone ramp can fit it (r = -0.53)
 *
 * An ascending ramp on `fold` claims the hand most likely to be folded is aces. A
 * descending one on `limp` claims the modal limp is 32o, when 2.2 says limp ranges are
 * small pairs, suited connectors and suited aces. Both are the same error: forcing a
 * monotone model onto a distribution that is not monotone.
 *
 * The grid ALREADY encodes its own direction and shape. Smoothing it in equity space and
 * ranking by the result gets all three cases right with no orientation flag, no
 * per-action table, and nothing for a future action to be forgotten by. A hole is filled
 * by what its equity-neighbours do, which is exactly the inference being made: a hand the
 * chart omitted is about as likely as the hands either side of it that the chart kept.
 *
 * Nadaraya-Watson with a Gaussian kernel, combo-weighted so a pair (6 combos) does not
 * pull as hard as an offsuit class (12).
 */
const smoothedShape = (grid, eq) => {
  const out = new Float64Array(GRID_SIZE);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < GRID_SIZE; i++) {
    const e = eq[i];
    if (e < lo) lo = e;
    if (e > hi) hi = e;
  }
  const h = Math.max(1e-9, (hi - lo) * SUPPORT_BANDWIDTH);

  for (let i = 0; i < GRID_SIZE; i++) {
    let num = 0, den = 0;
    for (let j = 0; j < GRID_SIZE; j++) {
      const d = (eq[i] - eq[j]) / h;
      const k = Math.exp(-0.5 * d * d) * COMBOS_AT[j];
      num += k * grid[j];
      den += k;
    }
    out[i] = den > 0 ? num / den : 0;
  }
  return out;
};

/**
 * The logistic's transition width, in SCORE units. DERIVED FROM `SUPPORT_BANDWIDTH` — the
 * only width this section names — not from a shipped fraction (WS-366).
 *
 * THE DEFECT THIS CLOSES. `softContinuationWeights` defaults `tau` to `TAU_FRACTION × IQR
 * of the scores`, and that default is measured for the POSTFLOP caller, whose scores are
 * per-combo equities across a villain's continuing range — roughly symmetric, so the IQR
 * straddles the decision. Preflop the scores are a range SHAPE, concentrated at the top of
 * the field. Measured on the LATE `threeBet` prior: the shape runs 0 → 0.935, but Q1 =
 * 0.00016 and Q3 = 0.0124, so the IQR is 0.012 and `tau` came out at 0.0037 — 1/250th of
 * the axis it was supposed to soften. Both quartiles lie inside the folded tail, where
 * nothing happens. The logistic degenerated into a STEP.
 *
 * A step is not a slightly-too-sharp logistic; it is a different object. Its position
 * depends on the grid's own WIDTH (the mean is pinned to it), so a WIDE grid saturates its
 * whole top at 1.0 and a NARROW grid saturates only its premiums. That is exactly the
 * WS-366 inversion: `limpReraise` is deliberately wide (§5.8 uncapped), so its step fell
 * below 88 and the doctrine's 1.00 / 0.25 / 0.10 tiers were flattened to a single
 * saturated value; its narrow siblings `cold3Bet` / `squeeze` kept theirs. `bayesianUpdater`
 * then carves the parent by `splitPost_sub · prior_sub(h)` normalised across siblings, so
 * what decided the cell was WHERE EACH SIBLING'S STEP FELL — a function of range width —
 * rather than anything the doctrine says. Measured at LATE before the fix: carved
 * `limpReraise` gave 88 = 0.0370 against QQ = 0.0202.
 *
 * THE DERIVATION. The scores are `smoothedShape(grid, equity)` — a Nadaraya-Watson
 * regression of the grid on equity with bandwidth `h = SUPPORT_BANDWIDTH × (equity
 * spread)`. That bandwidth IS this section's declared resolution: its comment states both
 * bounds ("wide enough that a hole is filled by its genuine neighbours, narrow enough that
 * a range's shape is not flattened into its own average"). Structure finer than one
 * bandwidth is not resolved by the smoother and must not be resolved by the logistic
 * either; structure coarser than one bandwidth is real and must not be erased by it. So
 * the logistic transitions over exactly one bandwidth, transported onto the score axis.
 *
 * The transport is exact, not an analogy. A monotone smoothed shape covers its full range
 * `S_max − S_min` across the full equity spread `E`, so its average slope is
 * `(S_max − S_min) / E`; one bandwidth `h = SUPPORT_BANDWIDTH · E` of equity therefore
 * spans `SUPPORT_BANDWIDTH · (S_max − S_min)` of score. The `E` cancels, which is why no
 * equity quantity appears below.
 *
 *     tau = SUPPORT_BANDWIDTH × (S_max − S_min)
 *
 * Nothing is fitted and nothing is per-position: the same 0.12 that set the smoother's
 * resolution sets the logistic's. It is a per-GRID quantity because `S` is, and that is the
 * point — a grid's sharpness now follows its own shape rather than its width, which is what
 * stops a wide range and a narrow one from being softened by different amounts.
 *
 * CONSISTENCY CHECK, NOT A SECOND DERIVATION. On a symmetric score distribution the shipped
 * postflop default sits in the same place: `0.3 × IQR` is `0.15 × range` for a uniform and
 * `0.06 × range` for a Gaussian at n = 1326, and 0.12 lies between them. So this is not a
 * new sharpness regime — it is the postflop sharpness computed from a statistic that
 * survives skew. The postflop caller is deliberately NOT moved (it keeps `ACTION_TAU_FRACTION`,
 * measured separately in WS-303).
 *
 * FALSIFIERS. (1) If a shipped prior's ordering ever departs from its own doctrine grid's
 * ordering, `tau` is too small — asserted per position in `taxonomyInvariants.test.js`.
 * (2) If shipped tier RATIOS are flatter than the blend `(1−λ)·doctrine + λ·[floor,1]`
 * permits, `tau` is too large. (3) Re-run the WS-293 discrimination sweep: if a materially
 * different sharpness wins at BOTH sites, the bandwidth transport is the wrong argument and
 * this constant is measured, not derived. Re-run it — do not re-reason it.
 *
 * DELIVERED AS A `tauFraction`, NOT AS A NEW OPTION. `softContinuationWeights` parameterises
 * its sharpness as a fraction of the score IQR, so this returns
 * `derived tau / IQR(scores)` — which the primitive multiplies straight back out. The
 * primitive is WS-291's shared postflop/preflop surface and is left untouched: its default
 * path, and therefore `ACTION_TAU_FRACTION`, is bit-identical. The IQR is computed here with
 * the primitive's OWN exported `quantile` on the same combo-expanded score array, so the two
 * cannot drift.
 */
const supportTauFraction = (shape, scores) => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < GRID_SIZE; i++) {
    if (shape[i] < lo) lo = shape[i];
    if (shape[i] > hi) hi = shape[i];
  }
  const tau = Math.max(1e-9, SUPPORT_BANDWIDTH * (hi - lo));
  // Same statistic, same guard, same helper the primitive itself applies.
  const asc = Array.from(scores).sort((a, b) => a - b);
  const iqr = Math.max(1e-6, quantile(asc, 0.75) - quantile(asc, 0.25));
  return tau / iqr;
};

/**
 * Give a prior grid support on every cell, ranked by the grid's own smoothed shape.
 *
 * THE DEFECT THIS CLOSES (WS-302). A prior of exactly zero is not "unlikely", it is
 * "impossible" — and `bayesianUpdater` updates ranges as `prior[i] * ratio`, a pure
 * multiplication, so a cell that starts at zero can NEVER be moved off zero by any
 * amount of frequency evidence. The positional charts zeroed 30-37% of the grid, which
 * is exactly the region a live 9-handed player strays into off-chart: a limped 84s from
 * early position, a defended K3o in the blinds. When one got turned over, the model was
 * never in the running. POKER_THEORY 2.1 demotes these charts to the UNOBSERVED-SEAT
 * PRIOR, and a starting belief is not allowed to be unfalsifiable.
 *
 * STRUCTURAL ZERO vs EPISTEMIC ZERO — the distinction this function turns on. A grid
 * that is IDENTICALLY zero describes a scenario that cannot occur, not a range with
 * holes: BB has no voluntary no-raise action, so it cannot limp, and its `limp` grid is
 * empty by construction (see CLAUDE.md 5 — "do not attempt to 'fix' it"). That one passes
 * through untouched. Every grid with any mass in it gets support.
 *
 * The support is `softContinuationWeights` (WS-291's primitive, reused not re-derived)
 * over the grid's OWN shape smoothed in equity space (`smoothedShape` — read its comment
 * for why NOT raw equity), with its mean pinned to the grid's own width. Blending two
 * grids of equal mean preserves that mean by construction — no rescaling step and no
 * artifact. The narrow grids protect themselves: the primitive caps its floor at 90% of
 * the target mean, so a 1%-wide `threeBet` prior takes a floor near 0.009, not 0.05, and
 * POKER_THEORY 2.3's "a live 3-bet is almost always a monster" read survives intact.
 *
 * @param {Float64Array} grid - the doctrine shape
 * @param {string} position - EARLY | MIDDLE | LATE | SB | BB
 * @param {number} lambda - shrinkage weight toward support
 * @returns {Float64Array} same grid when structurally empty, otherwise the blend
 */
export const withEquitySupport = (grid, position, lambda = PRIOR_SUPPORT_LAMBDA) => {
  if (!(lambda > 0)) return grid;

  const width = comboWeightedMean(grid);
  if (!(width > 0)) return grid; // structural impossibility — leave it alone

  const { cellOf, equity } = comboScores(position);
  // Rank by the grid's OWN smoothed shape, not by raw equity — see `smoothedShape`.
  const shape = smoothedShape(grid, equity);
  const scores = Float64Array.from(cellOf, (i) => shape[i]);
  const w = softContinuationWeights(scores, width, {
    floor: PRIOR_SUPPORT_FLOOR,
    // Sharpness DERIVED from the smoother's own bandwidth — see `supportTauFraction`.
    tauFraction: supportTauFraction(shape, scores),
  });

  const out = createRange();
  // Every combo in a cell carries the same score, so it receives the same weight; the
  // last write per cell is the cell's support value.
  for (let k = 0; k < w.length; k++) out[cellOf[k]] = w[k];
  for (let i = 0; i < GRID_SIZE; i++) out[i] = (1 - lambda) * grid[i] + lambda * out[i];
  return out;
};

// =============================================================================
// HAND STRENGTH ORDERING (WS-304)
// =============================================================================

/**
 * Hand strength as the COMBO-WEIGHTED EQUITY PERCENTILE of a hand class: the fraction of
 * the 1326 starting combos this class beats, measured (not asserted) by `EQUITY_VS_OPEN`.
 *
 * WHAT THIS REPLACED, AND WHY IT HAD TO GO (WS-304). Every branch below used to threshold
 * on `(rank1 + rank2 + 8·isPair + 2·suited) / 32` — a rank sum with two fudge terms, not a
 * hand strength ordering. Three measured consequences:
 *
 *   1. **AK was not in the 3-bet prior at all.** AKo scored 0.719 against an EARLY
 *      threshold of 0.78 and got exactly zero; AKs scored 0.781 and cleared by 0.001, so
 *      the ramp gave it 0.006. POKER_THEORY 2.3 names AK as one of the two value 3-bet
 *      holdings in the live pool. A villain who 3-bet and turned over AK was holding a
 *      hand the model said they could not have.
 *   2. **22 (0.250) ranked BELOW K3o (0.375)** everywhere the score was used — a pair's
 *      +8 bonus is worth less than one rank step at the top of the deck. That put small
 *      pairs outside the cold-call prior (foot 0.30) while K3o was inside it.
 *   3. **The score has 33 levels for 169 classes**, so distinct thresholds selected
 *      identical hand sets: `cold3Bet` at 0.81 and `squeeze` at 0.79 both selected exactly
 *      {AA,KK,QQ,JJ}, and at LATE (0.73 / 0.72) both selected exactly
 *      {AA,KK,QQ,JJ,AKs,TT,AQs}. The two shapes 2.5.2 calls different were the same shape.
 *
 * WHY A PERCENTILE AND NOT RAW EQUITY. A percentile is **uniform on combos** by
 * construction, so a threshold `t` means exactly "the top (1 − t) of the field" and a
 * linear ramp from `t` to 1 has combo-weighted mean `(1 − t) / 2`. That is what lets every
 * threshold below be *derived* from a stated range width or a named hand set instead of
 * tuned until one hand comes out right. Raw equity has no such reading — its spread is
 * compressed at the bottom and a threshold on it means nothing in particular.
 *
 * NAMED APPROXIMATION (1.4). All-in equity does not encode equity REALIZATION, and this
 * ordering inherits that: it ranks AKo just BELOW TT and JJ, where doctrine ranks AK
 * above both — AK realizes far better than a small pair against a raiser's calling range,
 * and the table cannot see it. It is still the right instrument here, because the error it
 * makes is one rank position and the error it replaces was 150. Same caveat, same wording,
 * as `PRIOR_SUPPORT_LAMBDA` above.
 *
 * Midpoint-of-ties, so classes with identical table entries share a percentile rather than
 * being ordered by grid index.
 */
const percentileCache = {};
const strengthPercentiles = (position) => {
  if (percentileCache[position]) return percentileCache[position];
  // Same key semantics and same fallback as `comboScores` — the ORDER barely moves
  // between keys, and an unrecognized category falls back rather than throwing.
  const eq = EQUITY_VS_OPEN[position] || EQUITY_VS_OPEN.LATE;
  const out = new Float64Array(GRID_SIZE);
  for (let i = 0; i < GRID_SIZE; i++) {
    let below = 0;
    let tied = 0;
    for (let j = 0; j < GRID_SIZE; j++) {
      if (eq[j] < eq[i]) below += COMBOS_AT[j];
      else if (eq[j] === eq[i]) tied += COMBOS_AT[j];
    }
    out[i] = (below + tied / 2) / TOTAL_COMBOS;
  }
  percentileCache[position] = out;
  return out;
};

/** Hand strength (0.0-1.0) for one grid cell. Higher = stronger. */
const handStrengthTier = (idx, position) => strengthPercentiles(position)[idx];

/**
 * Linear ramp: 0 at `foot`, `cap` at `top`, clamped outside.
 * Every branch below is one of these, a window, or a step.
 */
const ramp = (x, foot, top, cap = 1.0) => (
  x <= foot ? 0 : Math.min(cap, (cap * (x - foot)) / (top - foot))
);

/**
 * THRESHOLD TRANSPORT (WS-304). Every threshold that carried no doctrine number of its own
 * was moved onto the percentile axis by QUANTILE MATCHING: the old threshold θ selected
 * some fraction q of the 1326 combos, and the new threshold is `1 − q`, which selects the
 * same fraction of the field ranked by measured equity. Nothing was fitted and no region
 * changed size — only its MEMBERSHIP changed, from the rank sum to the equity ordering,
 * which is the defect being fixed. `q` is combo-exact; the comment on each constant gives
 * the old threshold and the combo count it selected.
 *
 * `threeBet` is the one exception: its old threshold is the defect, so it is re-derived
 * from doctrine below rather than transported.
 */
const OPEN_TOP = 1 - 6 / TOTAL_COMBOS;         // old 0.975 (where the 0.5 cap was reached)
const ISO_TOP = 1 - 6 / TOTAL_COMBOS;          // old 0.9467 (where the 0.6 cap was reached)
const COLD3_TAIL_LO = 1 - 684 / TOTAL_COMBOS;  // old 0.40
const COLD3_TAIL_HI = 1 - 162 / TOTAL_COMBOS;  // old 0.60
const SQUEEZE_TAIL_LO = 1 - 782 / TOTAL_COMBOS; // old 0.35
const SQUEEZE_TAIL_HI = 1 - 162 / TOTAL_COMBOS; // old 0.62 (same 162 combos as 0.60 — see 3 above)
const LR_PREMIUM = 1 - 18 / TOTAL_COMBOS;      // old 0.82   → 18 combos = exactly QQ+
const LR_MID = 1 - 272 / TOTAL_COMBOS;         // old 0.55
const LR_LOW = 1 - 1158 / TOTAL_COMBOS;        // old 0.20
const COLD_CALL_LO = 1 - 956 / TOTAL_COMBOS;   // old 0.30
const COLD_CALL_HI = 1 - 28 / TOTAL_COMBOS;    // old 0.78
const LIMP_LO = 1 - 1246 / TOTAL_COMBOS;       // old 0.15
const LIMP_MID = 1 - 272 / TOTAL_COMBOS;       // old 0.55
const LIMP_HI = 1 - 58 / TOTAL_COMBOS;         // old 0.70
const FOLD_ZERO = 1 - 18 / TOTAL_COMBOS;       // old 1/1.2 = 0.8333, where the fold ramp hit 0

/**
 * The 3-bet value core, as a fraction of the field. DERIVED, not transported — the old
 * threshold is the defect this ticket exists for.
 *
 * TWO INDEPENDENT ROUTES TO 0.05, WHICH IS WHY IT IS 0.05:
 *
 *  1. **The branch's own stated support.** The comment on `case 'threeBet'` has always
 *     read "Top 3-5%: QQ+, AK heavy". Measured against `EQUITY_VS_OPEN`, AKo enters the
 *     top-of-field prefix at 3.47% of combos (EARLY) — so the 3% end of that band excludes
 *     AK outright, and a foot placed AT 3.47% gives it a ramp weight of zero, which is the
 *     AKs-clears-by-0.001 failure restated. 5% is the smallest value in the branch's own
 *     band that gives every hand 2.3 names a non-degenerate weight.
 *  2. **The combinatorics of the hand set 2.3 names.** QQ+ is 18 combos and AK is 16, so
 *     the live-pool value 3-bet range is 34/1326 = 2.56% of the field. A linear ramp over
 *     the top f has combo-weighted mean f/2, so f = 0.05 gives the prior a range width of
 *     2.50%. The two routes agree to 0.06 percentage points.
 *
 * The old thresholds gave 1.04% (EARLY/MIDDLE/SB) and 1.55% (LATE/BB) — narrower than the
 * hand set the doctrine names, which is why AK had to fall off the bottom of it.
 */
export const THREE_BET_TOP_FRACTION = 0.05;

/**
 * Position scaling for the 3-bet foot.
 *
 * The old code branched on `position === 'LATE' || position === 'BB'` — a label list, and
 * one that contradicted its own file: `FACED_RAISE_FREQUENCIES` declares SB 3-betting at
 * 0.12, twice EARLY's 0.06 and equal to LATE, while 2.5.2 calls the blind 3-bet WIDER and
 * more merged. SB was nonetheless given EARLY's tight threshold. Reading the declared
 * relative propensity instead of a label list corrects that and removes the list.
 *
 * This is a PRIOR conditioned on position, which 7.2 sanctions explicitly; no decision
 * reads a label.
 */
const threeBetTopFraction = (position) => {
  const f = FACED_RAISE_FREQUENCIES[position] || FACED_RAISE_FREQUENCIES.LATE;
  return THREE_BET_TOP_FRACTION * (f.threeBet / FACED_RAISE_FREQUENCIES.EARLY.threeBet);
};

/**
 * How much wider than its GTO chart a live 1/2 open range is, as a fraction of the chart's
 * own combo width.
 *
 * THIS IS THE BRANCH'S OWN NUMBER. `case 'open'` has always been commented "Widen GTO
 * charts ~20% for live 1/2" — and has never done that. The off-chart extension was a ramp
 * on an absolute strength threshold, which knows nothing about how wide the chart under it
 * already is, so the actual widening ran from +2% (LATE) to +36% (EARLY): the tightest
 * chart got widened most and the widest barely at all, which is the opposite of a uniform
 * percentage and the opposite of the doctrine (§2.1 — live players are looser than the
 * chart *everywhere*). Solving for the foot instead of asserting it makes the branch do
 * what it says, and it is what keeps WS-304's ordering change from silently moving these
 * widths as a side effect.
 *
 * ISO_WIDENING is not a second guess. The old code's iso-raise extension came out at very
 * nearly 2× the open extension at EVERY position (+68/36, +45/23, +7/2, +21/10, +10/4), so
 * the 2× is transported from the code being replaced, the same as every other constant
 * above. §2.5.2: iso-raise is "wider than openFirstIn, value-tilted".
 */
const OPEN_WIDENING = 0.20;
const ISO_WIDENING = 0.40;

/**
 * Solve the off-chart ramp's foot so the extension adds exactly `targetAdd` of combo width.
 *
 * Added width falls monotonically as the foot rises, so bisection converges. ~50 iterations
 * is machine-adequate, matching `softContinuationWeights`' own bisection.
 */
const chartExtensionFoot = (chart, pct, targetAdd, top, cap) => {
  const addedAt = (foot) => {
    let s = 0;
    for (let i = 0; i < GRID_SIZE; i++) {
      if (chart[i] > 0) continue;
      s += ramp(pct[i], foot, top, cap) * COMBOS_AT[i];
    }
    return s / TOTAL_COMBOS;
  };
  let lo = 0;
  let hi = 1;
  if (addedAt(lo) <= targetAdd) return lo; // cannot reach it; widest possible extension
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2;
    if (addedAt(mid) > targetAdd) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
};

/** Is this grid cell a suited hand? Used by the polar bluff tails. */
const suitedAt = (idx) => decodeIndex(idx).suited;

/**
 * Get the base GTO chart for a 5-category position.
 */
const getBaseChart = (position) => {
  const keys = { EARLY: ['UTG', 'UTG+1'], MIDDLE: ['MP1', 'MP2'], LATE: ['HJ', 'CO', 'BTN'], SB: ['SB'], BB: ['BB'] }[position];
  if (!keys) return createRange();
  return keys.length === 1 ? PREFLOP_CHARTS[keys[0]] : averageCharts(...keys);
};

/**
 * Build a prior range grid for a specific position + action.
 * Each grid cell is P(hand | action, position) — the likelihood
 * of holding this hand given you took this action.
 */
const buildActionPrior = (position, action, lambda = PRIOR_SUPPORT_LAMBDA) => {
  const range = createRange();
  const baseChart = getBaseChart(position);

  const threeBetFoot = 1 - threeBetTopFraction(position);
  // Solved per position, because the target is a fraction of THIS chart's width.
  const pct = strengthPercentiles(position);
  const chartWidth = comboWeightedMean(baseChart);
  const openFoot = (action === 'open' || action === 'openFirstIn')
    ? chartExtensionFoot(baseChart, pct, OPEN_WIDENING * chartWidth, OPEN_TOP, 0.5)
    : 0;
  const isoFoot = action === 'isoRaise'
    ? chartExtensionFoot(baseChart, pct, ISO_WIDENING * chartWidth, ISO_TOP, 0.6)
    : 0;

  for (let i = 0; i < GRID_SIZE; i++) {
    const strength = handStrengthTier(i, position);
    const inChart = baseChart[i] > 0;

    switch (action) {
      case 'open': {
        // Widen GTO charts ~20% for live 1/2
        if (inChart) {
          range[i] = baseChart[i];
        } else {
          range[i] = ramp(strength, openFoot, OPEN_TOP, 0.5);
        }
        break;
      }
      case 'threeBet': {
        // Top 3-5%: QQ+, AK heavy (2.3). Foot DERIVED — see THREE_BET_TOP_FRACTION.
        range[i] = ramp(strength, threeBetFoot, 1.0);
        break;
      }
      // ---- Derived subclasses (POKER_THEORY §2.5.2) --------------------
      // Position-conditioned PRIORS are explicitly sanctioned by §7.2
      // ("position labels can serve as priors in a Bayesian framework") and
      // follow the parent threeBet pattern above. No DECISION reads a label.
      case 'cold3Bet': {
        // Strongest and slightly polar. No money invested and players still to
        // act behind, so the live pool re-raises only real value plus a thin
        // suited bluff tail.
        //
        // SB/BB are the merged blind3Bet case (DEC-025): money is already
        // posted, the price to continue is discounted, so the range is WIDER
        // and MERGED — medium hands stay in, and there is no bluff tail
        // because the value region already extends down.
        //
        // VALUE CORE (WS-304). All three 3-bet classes share 2.3's value set —
        // "most players 3-bet only premiums (QQ+, AK)" is a statement about
        // 3-bets, and 2.5.2 describes cold3Bet as "real value plus a thin
        // bluff tail" and squeeze as "real value + more bluffs". So the value
        // foot is the PARENT's derived foot, and the classes differ where
        // 2.5.2 actually says they differ: the bluff side, and the blind
        // merge. This is not a widening of the taxonomy — measured, the old
        // cold3Bet (0.81) and squeeze (0.79) feet selected the SAME 1.81% of
        // the field, and at LATE (0.73 / 0.72) the same 2.87%. The distinction
        // the two thresholds appeared to draw did not exist.
        const isBlind = position === 'SB' || position === 'BB';
        range[i] = ramp(strength, threeBetFoot, 1.0);
        if (!isBlind && range[i] === 0
            && suitedAt(i) && strength > COLD3_TAIL_LO && strength < COLD3_TAIL_HI) {
          range[i] = 0.08; // thin polar bluff tail (§2.3: A5s, 76s)
        }
        break;
      }
      case 'squeeze': {
        // Polar and leveraged. Dead money plus a capped caller range makes the
        // bluff side profitable, so the range splits: real value on top, MORE
        // bluffs than a cold 3-bet, medium region hollowed out (§2.4).
        range[i] = ramp(strength, threeBetFoot, 1.0);
        if (range[i] === 0
            && suitedAt(i) && strength > SQUEEZE_TAIL_LO && strength < SQUEEZE_TAIL_HI) {
          range[i] = 0.18; // wider bluff tail than cold3Bet — the leverage
        }
        break;
      }
      case 'limpReraise': {
        // UNCAPPED (§5.8). The passive line was chosen deliberately to trap,
        // so premiums carry full weight, plus the speculative residue of the
        // limp range that occasionally wakes up. Never a capped shape.
        if (strength > LR_PREMIUM) {
          range[i] = 1.0; // premium traps — full weight, uncapped
        } else if (strength > LR_MID) {
          range[i] = 0.25;
        } else if (strength > LR_LOW) {
          range[i] = 0.10; // limp-range residue
        }
        break;
      }
      case 'openFirstIn': {
        // Nobody has voluntarily entered — this is the classic open. Same
        // shape as the parent open, which was always predominantly first-in.
        if (inChart) {
          range[i] = baseChart[i];
        } else {
          range[i] = ramp(strength, openFoot, OPEN_TOP, 0.5);
        }
        break;
      }
      case 'isoRaise': {
        // Raising over limpers targets a known-weak capped range rather than
        // folding out the field (§5.7), so it correctly includes hands too
        // weak to open first-in — wider than openFirstIn, value-tilted.
        if (inChart) {
          range[i] = baseChart[i];
        } else {
          range[i] = ramp(strength, isoFoot, ISO_TOP, 0.6);
        }
        break;
      }
      case 'coldCall': {
        // Medium hands: suited connectors, medium pairs, suited broadways
        if (strength > COLD_CALL_LO && strength < COLD_CALL_HI) {
          range[i] = inChart ? 0.6 : 0.3;
        } else if (strength >= COLD_CALL_HI) {
          range[i] = 0.2; // strong hands that might flat
        }
        break;
      }
      case 'limp': {
        // Speculative hands: small pairs, suited connectors, weak suited aces
        if (position === 'BB') break; // BB doesn't limp
        if (strength > LIMP_LO && strength < LIMP_MID) {
          range[i] = 0.4;
        } else if (strength >= LIMP_MID && strength < LIMP_HI) {
          range[i] = 0.15;
        }
        break;
      }
      case 'fold': {
        // Fold prior — weakest hands fold most. Descending ramp, 1.0 at the
        // bottom of the field, 0 at FOLD_ZERO (transported from `1 - s*1.2`).
        range[i] = Math.max(0, 1.0 - strength / FOLD_ZERO);
        break;
      }
    }
  }

  // No prior assigns exactly zero to a hand a player could actually be holding (WS-302).
  // Applied here, at the single point every prior is constructed, so the guarantee cannot
  // be reintroduced by a new `case` forgetting about it.
  return withEquitySupport(range, position, lambda);
};

// Cache built priors
const priorCache = {};

/**
 * Get the population prior range for a position + action.
 *
 * @param {string} position - EARLY, MIDDLE, LATE, SB, BB
 * @param {string} action - fold, limp, open, coldCall, threeBet (+ WS-256 subclasses)
 * @param {{ supportLambda?: number }} [opts] - override the support shrinkage weight.
 *        Exposed so the WS-293 calibration probe can SWEEP it rather than have it
 *        asserted here; production never passes it.
 * @returns {Float64Array} 169-cell weight grid (copy, safe to mutate)
 */
export const getPopulationPrior = (position, action, opts = {}) => {
  const lambda = Number.isFinite(opts.supportLambda) ? opts.supportLambda : PRIOR_SUPPORT_LAMBDA;
  const key = lambda === PRIOR_SUPPORT_LAMBDA
    ? `${position}_${action}`
    : `${position}_${action}_L${lambda}`;
  if (!priorCache[key]) {
    priorCache[key] = buildActionPrior(position, action, lambda);
  }
  return new Float64Array(priorCache[key]);
};
