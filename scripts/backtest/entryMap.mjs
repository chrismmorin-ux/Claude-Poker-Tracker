/**
 * entryMap.mjs — WS-323. "Is this hand worth playing at all?", enumerated.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE QUESTION, AND WHY ZERO IS THE INTERESTING NUMBER
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Folding is EV = 0. Not approximately, not by convention — by definition, since a fold puts
 * no further money in and claims none. So "worth playing" is exactly `EV(enter) > 0`, and the
 * FRINGE — hands indifferent to folding — sits at zero by construction rather than by
 * coincidence. Nothing has to be calibrated for that anchor to hold.
 *
 * That band is where the interesting thing lives. When EV ≈ 0 the arithmetic ABSTAINS: there
 * is no equity answer to a breakeven decision, so the choice must come from a read, from
 * structure, or from fear. **The zero-EV band is the only place where warrant type is
 * observable.** Everywhere else equity decides and every non-broken strategy agrees. Which is
 * also why it is where fear has room to hide — see the standing doctrine that fear pushes
 * MEDIUM hands into passive lines, and that the shape goes wrong in the middle, not the tails.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS ENUMERATES RATHER THAN OBSERVES — the ticket's premise, corrected
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * WS-323 was filed on the claim that the entry question is "defined on EVERY hand including
 * every folded one (no showdown selection)", and would therefore recover the hands the
 * per-decision instrument discards. Measured against the actual corpus (60 files, 59,625
 * hands) before any code was written:
 *
 *   preflop FOLDS:            259,084   hole cards known:      0  (0.0%)
 *   preflop VOLUNTARY ENTRY:   99,166   hole cards known: 21,642 (21.8%)
 *
 * Every hole card is masked at deal (`d dh p1 ????`); cards surface only through a showdown.
 * `handOutcome.mjs` is right that realized OUTCOMES survive masking — a folded seat's result
 * is simply minus what it posted. But this map is keyed on CELLS, and cell attribution does
 * not survive: a folded hand cannot be assigned to one of the 169 classes at all. Worse, the
 * 21.8% that do reveal are the hands that got called down — a selection that is strongest
 * exactly in the fringe band this map exists to measure.
 *
 * The founder's structural insight is untouched. What moves is where COMPLETENESS comes from:
 * enumeration, not observation. 169 hand classes × 5 posCategory × 4 facingAction ≈ 3,380
 * cells is small enough to compute exhaustively — which is the ticket's own argument that the
 * honest answer to "don't brute-force more than needed" is to brute-force the part that is
 * genuinely small. No observed cards are needed, so showdown selection cannot arise. The
 * corpus still supplies the Field (what opponents do facing each action); it does not supply
 * the EV.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * "NEAR ZERO" AND "WE CANNOT TELL" ARE DIFFERENT FACTS
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * They look identical in a point estimate, which is how a confident rule ends up resting on
 * nothing. `0.0 ± 0.05bb` is genuinely marginal — a real coin flip a read may legitimately
 * break. `0.0 ± 3bb` is UNMEASURED. So every cell carries an INTERVAL, never a bare point
 * estimate, and the interval is decomposed into its two sources because they mean different
 * things and have different fixes:
 *
 *   mcError    — sampling noise (stratified flops, Monte Carlo equity). Fix: more samples.
 *   modelError — sensitivity to the Field's own uncertainty, measured by re-evaluating the
 *                cell at the Field's posterior quantiles. Fix: more DATA, or a better model.
 *                THIS is the term that separates "genuinely marginal" from "we cannot tell".
 *
 * A cell whose interval straddles zero on `mcError` alone is a research-compute problem. One
 * that straddles zero because `modelError` is wide is a research-EVIDENCE problem. Collapsing
 * them into one number would hide which.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * ZONES ARE A REPORTING BAND, NEVER A DECISION RULE
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * The engine's standing anti-pattern is explicit that `if (n >= K) use the specific estimate`
 * is "a threshold label, the same anti-pattern in another costume". The same objection applies
 * to `if (EV > K) enter`. So this module emits a CONTINUOUS margin with its uncertainty, and
 * `bandOf` exists only to LABEL a cell for a human reader. Nothing in `src/` may branch on a
 * zone, and the verification step greps for exactly that.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE CONTINUATION POLICY IS PART OF THE ANSWER, NOT A DETAIL
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Entry EV is NOT a property of a hand. Suited connectors are +EV played well after the flop
 * and -EV played badly, so a map without its continuation policy names no quantity at all.
 * Every map produced here is stamped with `CONTINUATION_POLICY` and the engine commit, and
 * `loadEntryMap` refuses one that is not. That constraint pays for itself: re-run the map
 * under successive engine generations and WATCH THE FRINGE MOVE. Hands migrating out of the
 * fringe into clear-+EV is what "getting better" IS, measured on the same cells forever.
 *
 * Founder decision 2026-08-02: v1's policy is the shipped stratified-flop policy already in
 * `preflopFlopEV.js`, reached through `computePreflopAdvice` — the production preflop path,
 * so the map describes the strategy that actually ships rather than a parallel one.
 */

/**
 * The five position categories, from `positionUtils.RANGE_POSITION_CATEGORIES`.
 *
 * A CO-ORDINATE THE MAP IS INDEXED BY, NEVER A MULTIPLIER APPLIED TO A RATE. §7.2 forbids
 * position labels as decision inputs, and this module obeys it by construction: the label
 * selects which seat hero occupies, and every number then comes from `computePreflopAdvice`
 * resolving the ACTUAL seats behind hero (WS-274). There is no `if (posCategory === 'EARLY')`
 * anywhere below, and there must never be.
 */
export const POS_CATEGORIES = Object.freeze(['EARLY', 'MIDDLE', 'LATE', 'SB', 'BB']);

/**
 * The preflop facing-actions, matching what `decisionAccumulator` emits on the
 * `facingAction` axis. 'none' is the open/limp decision; 'raise' is facing an open.
 */
export const FACING_ACTIONS = Object.freeze(['none', 'raise']);

/**
 * Identity of the continuation policy this map is computed under.
 *
 * Bumped whenever the policy changes, because a map computed under a different continuation
 * is a different quantity and must not be diffed against this one as if it were a generation
 * of the same thing.
 */
export const CONTINUATION_POLICY = Object.freeze({
  id: 'cp-stratified-flop-v1',
  module: 'src/utils/exploitEngine/preflopFlopEV.js',
  via: 'src/utils/exploitEngine/preflopAdvisor.js#computePreflopAdvice',
  description:
    'The shipped stratified-flop policy: sample flops by archetype, classify hero on each, ' +
    'bet nuts/strong for value, semi-bluff draws, check marginal, check-fold air (EV 0). ' +
    'Reached through the production preflop advisor, so the map describes the strategy that ' +
    'actually ships.',
  /**
   * KNOWN BIAS OF THIS POLICY, STATED SO NO CELL IS READ AS POKER TRUTH.
   *
   * CP-1 systematically undervalues UNPAIRED hands, and the map makes the size of that visible
   * for the first time. The mechanism is structural, not a bug: an unpaired holding misses the
   * flop roughly two times in three and classifies as `air`, which the policy check-folds for
   * EV 0. It has no barrelling, no equity realization from overcards, and no postflop fold
   * equity for the preflop raiser — so a hand that whiffs that often can never recover the
   * money invested preflop. Pairs flop overpairs and sets and are unaffected.
   *
   * Measured from EARLY at a 9-handed table, opening to 3.75bb:
   *
   *   AKs  equity 0.619 vs the opening range  →  open EV -0.70bb   (best action: limp)
   *   QQ   equity 0.719                       →  open EV +1.51bb
   *   KK   equity 0.766                       →  open EV +1.34bb
   *   AA   equity 0.859                       →  open EV +1.72bb
   *
   * Note the map is NON-MONOTONE IN EQUITY — QQ outranks KK — which is the pair archetypes
   * paying off differently, not a model disagreement about hand strength.
   *
   * READ THE MAP ACCORDINGLY. "AKs is not worth opening from UTG" is a true statement ABOUT
   * CP-1 and a false statement about poker. That is exactly the ticket's point: entry EV is
   * not a property of a hand, it is conditional on how the hand gets played afterwards, which
   * is why every map is stamped with its policy. CP-1 is the BASELINE a better continuation
   * policy has to beat, and the fringe-migration report is the instrument that will show it
   * doing so — unpaired hands climbing out of `clear-` is precisely what a postflop model
   * that can barrel would produce.
   */
  knownBias: 'undervalues unpaired hands: no barrelling, no overcard realization, air check-folds to 0',
});

/**
 * Default half-width, in bb, separating a genuinely marginal cell from an unmeasured one.
 *
 * A REPORTING PARAMETER, stamped into the manifest so a reader knows which value produced the
 * bands they are looking at. It is deliberately not tuned: 0.25bb is roughly the size of an
 * edge a competent player could act on, so an interval wider than that cannot distinguish
 * "small edge" from "no edge". Change it and the bands move; that is a presentational change
 * and the underlying margins are untouched.
 */
export const DEFAULT_TAU_BB = 0.25;

/** Zone labels. Reporting only — see the header note. */
export const BANDS = Object.freeze({
  CLEAR_PLUS: 'clear+',
  CLEAR_MINUS: 'clear-',
  FRINGE_TIGHT: 'fringe-tight',
  UNMEASURED: 'unmeasured',
});

/**
 * Label a cell from its interval.
 *
 * Note what decides: the INTERVAL, not the point estimate. A cell is "clear" only when its
 * whole interval is on one side of zero, so a large margin with a huge interval is correctly
 * reported as unmeasured rather than as a strong result.
 */
export const bandOf = ({ lower, upper, halfWidth }, tauBB = DEFAULT_TAU_BB) => {
  if (lower > 0) return BANDS.CLEAR_PLUS;
  if (upper < 0) return BANDS.CLEAR_MINUS;
  return halfWidth <= tauBB ? BANDS.FRINGE_TIGHT : BANDS.UNMEASURED;
};

/**
 * Preflop action order at a 9-handed table with the button on seat 9.
 *
 * Explicit because two facts fall straight out of it that the map would otherwise fabricate,
 * and both are recorded rather than quietly skipped — see `reachability` below.
 */
export const PREFLOP_ACTION_ORDER = Object.freeze([
  { seat: 3, posCategory: 'EARLY' },   // UTG — first to act
  { seat: 4, posCategory: 'EARLY' },
  { seat: 5, posCategory: 'MIDDLE' },
  { seat: 6, posCategory: 'MIDDLE' },
  { seat: 7, posCategory: 'LATE' },    // HJ
  { seat: 8, posCategory: 'LATE' },    // CO
  { seat: 9, posCategory: 'LATE' },    // BTN
  { seat: 1, posCategory: 'SB' },
  { seat: 2, posCategory: 'BB' },      // last to act preflop
]);

/** The seat this map places hero in for each position category, and its action index. */
export const HERO_SEAT_BY_POS = Object.freeze({
  EARLY: 3, MIDDLE: 5, LATE: 8, SB: 1, BB: 2,
});

const actionIndexOf = (seat) => PREFLOP_ACTION_ORDER.findIndex((s) => s.seat === seat);

/**
 * Is this (posCategory, facingAction) combination a decision that can actually occur?
 *
 * TWO CELLS ARE STRUCTURALLY UNREACHABLE, and saying so is the point:
 *
 *   EARLY × raise — UTG acts FIRST. There is nobody who could have raised into it, so no
 *      holding ever faces this spot. A map that computed a number here would be answering a
 *      question the game cannot ask.
 *   BB × none — "folded to hero" with nobody having entered means BB already has the pot.
 *      There is no entry decision, and EV(enter) is not defined.
 *
 * These are NOT the same fact as "unmeasured", and the census must be able to tell them
 * apart: an unmeasured cell is a research queue, an unreachable one is a cell that should
 * never acquire a number no matter how much compute is spent. Collapsing them would make the
 * denominator wrong in both directions.
 */
export const reachability = (posCategory, facingAction) => {
  const idx = actionIndexOf(HERO_SEAT_BY_POS[posCategory]);
  if (facingAction === 'raise' && idx === 0) {
    return { reachable: false, reason: 'utg-acts-first: nobody can have raised into the first seat' };
  }
  if (facingAction === 'none' && idx === PREFLOP_ACTION_ORDER.length - 1) {
    return { reachable: false, reason: 'folded-to-bb: no entry decision, BB already holds the pot' };
  }
  return { reachable: true, reason: null };
};

/**
 * Who is left to act behind hero, and who opened.
 *
 * WS-274 doctrine: players remaining means WHO, not how many. The engine resolves each seat
 * individually, so this returns the SEATS and the caller stands each one up with the Field's
 * stats — never a count multiplied by a per-opponent rate.
 */
export const tableGeometry = (posCategory, facingAction) => {
  const heroSeat = HERO_SEAT_BY_POS[posCategory];
  const idx = actionIndexOf(heroSeat);
  const seatsBehind = PREFLOP_ACTION_ORDER.slice(idx + 1);
  // Facing a raise, the opener is the nearest seat before hero — the tightest plausible
  // range hero can face, and the only one reachable without inventing extra dead money.
  const opener = facingAction === 'raise' ? PREFLOP_ACTION_ORDER[idx - 1] : null;
  return { heroSeat, actionIndex: idx, seatsBehind, opener };
};

/**
 * Every cell in the declared domain, in a stable order.
 *
 * Stability matters more than it looks: the generation-over-generation fringe-migration report
 * joins two runs on cell identity, so an unstable enumeration would silently compare different
 * cells and report migration that never happened.
 *
 * Unreachable cells ARE enumerated, carrying `reachable: false` and their reason. The census
 * counts them; the estimator skips them. Dropping them here would make them invisible, and a
 * coverage record whose denominator quietly excludes what it could not answer is the exact
 * shape the Census object exists to prevent.
 *
 * @param {string[]} handClasses - the 169 notations, from `preflopEquityTable.HAND_LABELS`
 */
export const enumerateCells = (handClasses) => {
  const cells = [];
  for (const posCategory of POS_CATEGORIES) {
    for (const facingAction of FACING_ACTIONS) {
      const { reachable, reason } = reachability(posCategory, facingAction);
      for (const handClass of handClasses) {
        cells.push({
          handClass,
          posCategory,
          facingAction,
          cellId: `${handClass}|${posCategory}|${facingAction}`,
          reachable,
          unreachableReason: reason,
        });
      }
    }
  }
  return cells;
};

/**
 * Combine replicate margins into a point estimate and an interval.
 *
 * The two error terms are combined in QUADRATURE rather than added. They are independent by
 * construction — one is sampling noise in the flop/equity draw, the other is the spread across
 * deliberately perturbed Field parameters — and adding independent errors would overstate the
 * interval, which here means over-reporting cells as `unmeasured` and quietly shrinking the
 * fringe. Both errors are reported alongside the combined figure so a reader can see which
 * one dominates rather than having to trust the combination.
 *
 * @param {number[]} mcReplicates    - margins from repeated draws at the CENTRAL Field
 * @param {number[]} modelReplicates - margins at the Field's perturbed quantiles
 */
/**
 * Two-sided 97.5% Student-t critical values by degrees of freedom.
 *
 * Tabulated rather than computed: the map needs df ≤ ~10 and a table is auditable at a glance,
 * where an incomplete-beta implementation would be one more thing to be quietly wrong. Above
 * df 30 the difference from z is under 5% and the normal value is used.
 */
const T_CRITICAL_975 = Object.freeze([
  Infinity, // df 0 — no information; an interval cannot be formed
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228,
  2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086,
  2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042,
]);

export const tCritical = (df) => {
  if (df < 1) return 1.96;          // no sd was estimated, so there is nothing to correct
  if (df >= T_CRITICAL_975.length) return 1.96;
  return T_CRITICAL_975[df];
};

export const combineInterval = (mcReplicates, modelReplicates, { z = 1.96 } = {}) => {
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  // Sample standard deviation with the n-1 correction; 0 for a single replicate, which is
  // honest — one draw carries no information about its own spread.
  const sd = (xs) => {
    if (xs.length < 2) return 0;
    const m = mean(xs);
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
  };

  const margin = mean(mcReplicates);

  // Standard ERROR of the mean — the uncertainty in our estimate of the margin, which is what
  // the interval is about, not the spread of individual draws.
  const mcError = sd(mcReplicates) / Math.sqrt(mcReplicates.length);

  // Model error is a SPREAD, not a standard error: the Field quantiles are not samples from a
  // distribution we are averaging over, they are a deliberate sensitivity sweep. Dividing by
  // sqrt(n) would make a wider sweep look more certain, which is backwards.
  const modelError = modelReplicates.length >= 2 ? sd(modelReplicates) : 0;

  /**
   * THE MC TERM USES STUDENT-t, AND THE REASON IS A DEFECT THIS CAUGHT.
   *
   * `mcError` is an sd ESTIMATED FROM 3–4 REPLICATES. An sd from that few draws is itself
   * wildly uncertain, and it is small by luck a meaningful fraction of the time. Multiplying it
   * by z = 1.96 — the multiplier for a KNOWN sd — therefore produces occasional cells whose
   * interval is near-zero-width by accident, and the loader then labels them `clear+` or
   * `clear-` on a fluke.
   *
   * That failure lands in exactly the wrong place. The tight/wide split exists to separate
   * "genuinely marginal" from "we cannot tell", and this defect converts "we cannot tell" into
   * "definitely worth playing" — a confident rule resting on nothing, which is the precise
   * outcome this map was built to prevent. It was caught on a smoke run where a class was
   * reported as sign-split at n=2.
   *
   * Student-t with n−1 degrees of freedom is the textbook correction for an estimated sd, and
   * at these sample sizes it is not a rounding detail: t(3) = 3.182 against z = 1.96, so a
   * 4-replicate MC interval widens by 62%.
   *
   * The SWEEP term keeps z. The Field quantiles are not a sample whose sd is being estimated —
   * they are three deliberately chosen points, and there is no sampling distribution to correct
   * for. Applying t to them would be borrowing the arithmetic without the argument.
   *
   * Mixing the two multipliers in quadrature is a heuristic, and is stated as one: the combined
   * figure is not a calibrated 95% interval for a single well-defined estimator. Both terms are
   * reported separately so a reader never has to accept the combination on faith.
   */
  const halfWidth = Math.sqrt((tCritical(mcReplicates.length - 1) * mcError) ** 2 + (z * modelError) ** 2);
  return {
    margin,
    mcError,
    modelError,
    halfWidth,
    lower: margin - halfWidth,
    upper: margin + halfWidth,
  };
};

/**
 * EV of the best ENTRY action, in bb, given the advisor's recommendations.
 *
 * `computePreflopAdvice` already emits `{ action: 'fold', ev: 0 }` as one of its
 * recommendations — the anchor is the engine's own, not one this module asserts. Entry is
 * everything else, and the margin is `max(EV over entry actions) - 0`.
 *
 * Returns `null` when the advisor produced no entry action at all, which is a real state
 * (a degenerate spot) and must not be silently read as an EV of zero — that would put the
 * cell in the fringe, which is the one band where a wrong entry does the most damage.
 */
export const entryMarginFrom = (recommendations, bigBlind) => {
  const entries = recommendations.filter((r) => r.action !== 'fold');
  if (entries.length === 0) return null;
  const best = entries.reduce((a, b) => (b.ev > a.ev ? b : a));
  return { marginBB: best.ev / bigBlind, action: best.action, sizing: best.sizing ?? null };
};

// ─── THE FIELD SWEEP ─────────────────────────────────────────────────────────────────────

/**
 * The quantiles the Field is swept across to produce `modelError`.
 *
 * Three points, not more: the sweep is a sensitivity range, and its job is to answer "could a
 * plausibly different opponent flip this cell's sign?" A finer grid costs a full engine
 * evaluation per point and does not change that answer.
 */
export const FIELD_QUANTILES = Object.freeze([0.1, 0.5, 0.9]);

/**
 * Build the Field's plausible per-stat range from the pool aggregates.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE SWEEP IS OVER BETWEEN-PLAYER SPREAD AND NOT OVER SAMPLING ERROR
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * The obvious move is to take the Beta posterior of the pool aggregate — `HANDHQ_REFERENCE_
 * STAKES[...].stats.vpip` is a literal (k, n) — and sweep its quantiles. That would be wrong,
 * and wrong in the direction that matters: n is in the MILLIONS, so that posterior is razor
 * tight and the sweep would report `modelError ≈ 0` for every cell. The map would then claim
 * to know the Field essentially exactly, and almost every straddling cell would be labelled
 * `fringe-tight` — a confident rule resting on nothing, which is the exact failure the
 * tight/wide split exists to prevent.
 *
 * The pool mean is precisely known. It is also not what hero faces. Hero faces ONE villain
 * drawn from a population that varies, and the quantity that matters is the BETWEEN-PLAYER
 * spread. WS-262 measured exactly this and refuted the flat 200-pseudocount assumption as
 * ~20x too confident; the replacement is `PER_STAT_PRIOR_WEIGHT` (10–35), derived from
 * between-player overdispersion. Reading the spread off that constant reuses a measured
 * number rather than inventing a new one — and if the overdispersion measurement is ever
 * re-run, this sweep tracks it automatically.
 *
 * So: mean `p` from the pool aggregate, concentration `w` from the measured overdispersion,
 * and the plausible villain is `Beta(p·w, (1-p)·w)`.
 *
 * @param {Object} poolStats - `{ [stat]: { k, n } }` from the reference pool
 * @param {Object} priorWeights - `PER_STAT_PRIOR_WEIGHT`
 * @param {Function} betaQuantile - from `pokerCore/betaMath.js`
 * @returns {Object} `{ [stat]: number[] }` — one value per entry in FIELD_QUANTILES
 */
export const buildFieldSweep = (poolStats, priorWeights, betaQuantile, defaultWeight = 10) => {
  const sweep = {};
  for (const [stat, counts] of Object.entries(poolStats)) {
    if (!counts || !counts.n) continue;
    const p = counts.k / counts.n;
    const w = priorWeights[stat] ?? defaultWeight;
    // Guard the degenerate ends: a stat pinned at 0 or 1 has no spread to sweep, and
    // Beta(0, ·) is undefined rather than merely narrow.
    const alpha = Math.max(1e-6, p * w);
    const beta = Math.max(1e-6, (1 - p) * w);
    sweep[stat] = FIELD_QUANTILES.map((q) => betaQuantile(q, alpha, beta));
  }
  return sweep;
};

/**
 * The player-stats object for one point of the sweep.
 *
 * Percentages because that is the unit `estimatePreflopFoldPct` and the exploit rules read;
 * the sweep values are proportions.
 */
export const fieldPointStats = (sweep, index) => {
  const stats = {};
  for (const [stat, values] of Object.entries(sweep)) {
    stats[stat] = values[index] * 100;
  }
  return stats;
};

// ─── THE LOADER ──────────────────────────────────────────────────────────────────────────

/** Schema version of the entry-map artifact. Refuse a version this loader cannot read. */
export const ENTRY_MAP_SCHEMA_VERSION = 1;

/** Thrown by `loadEntryMap`. Never returns a partial map — same posture as the SoR loaders. */
export class EntryMapError extends Error {
  constructor(message, detail = {}) {
    super(message);
    this.name = 'EntryMapError';
    Object.assign(this, detail);
  }
}

const isFinite_ = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Load an entry map, refusing one that does not name the quantity it measured.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHY AN UNSTAMPED MAP IS REFUSED RATHER THAN WARNED ABOUT
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Entry EV is not a property of a hand — it is conditional on the continuation policy, so a
 * map without its policy stamp NAMES NO QUANTITY. It is not a slightly-worse map; it is a
 * grid of numbers whose units are unknown. The failure mode is specific and it is the one
 * this project has already lived through: an unstamped grid gets diffed against a stamped one
 * as though the two were generations of the same thing, and the difference gets read as
 * progress. Warning would not prevent that, because the diff would still run.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * BANDS ARE RECOMPUTED, NEVER TRUSTED FROM THE FILE
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * τ is a REPORTING parameter (see `DEFAULT_TAU_BB`), so two maps written under different τ
 * carry bands that are not comparable even though their margins are. Reading the stored band
 * would let a τ change masquerade as hands migrating — movement manufactured entirely by a
 * presentational setting. So the loader recomputes every band from the stored INTERVAL at the
 * caller's τ, and recomputes `counts.byBand` with it: a returned map that contradicted its own
 * counts would be worse than one that never carried them.
 *
 * The margins themselves are untouched. Only the labels move, which is exactly what it means
 * for a zone to be a reporting band rather than a decision rule.
 *
 * `engineDirty` is a WARNING, not a refusal. The flag is honest information — the map was
 * produced from a tree that differs from the commit it names, so it is not replicable — but
 * refusing it outright would make the smoke path unloadable, and a dirty map is still the
 * right input for a "did the instrument manufacture movement" check where neither side is a
 * published claim.
 *
 * @param {Object} artifact - a parsed entry-map JSON artifact
 * @param {Object} [opts]
 * @param {number} [opts.tauBB] - τ to band at; defaults to the artifact's own reporting τ
 * @returns {Object} the map with bands recomputed, plus a `warnings` array
 */
export const loadEntryMap = (artifact, { tauBB = null } = {}) => {
  if (artifact === null || typeof artifact !== 'object' || Array.isArray(artifact)) {
    throw new EntryMapError('an entry map must be an object');
  }

  const schemaVersion = artifact.schemaVersion ?? ENTRY_MAP_SCHEMA_VERSION;
  if (schemaVersion > ENTRY_MAP_SCHEMA_VERSION) {
    throw new EntryMapError(
      `entry map declares schemaVersion ${schemaVersion}; this loader understands ` +
      `${ENTRY_MAP_SCHEMA_VERSION}. Refusing rather than duck-typing it.`,
      { schemaVersion },
    );
  }

  const policy = artifact.continuationPolicy;
  if (!policy || typeof policy !== 'object' || typeof policy.id !== 'string' || !policy.id) {
    throw new EntryMapError(
      'entry map carries no continuation policy. Entry EV is conditional on how the hand is ' +
      'played after the flop, so a map without its policy names no quantity and must not be ' +
      'compared against one that does.',
    );
  }

  if (typeof artifact.engineCommit !== 'string' || !artifact.engineCommit) {
    throw new EntryMapError(
      'entry map carries no engine commit. The policy id names WHICH strategy; the commit ' +
      'names the code that implemented it, and generations of the same policy are told apart ' +
      'by nothing else.',
      { policyId: policy.id },
    );
  }

  const storedTau = artifact.reporting?.tauBB;
  if (!isFinite_(storedTau)) {
    throw new EntryMapError(
      'entry map does not record the τ its bands were written at. Without it a band cannot be ' +
      'recomputed, and a τ change would be indistinguishable from hands migrating.',
      { policyId: policy.id },
    );
  }

  if (!Array.isArray(artifact.cells) || artifact.cells.length === 0) {
    throw new EntryMapError('entry map has no cells', { policyId: policy.id });
  }

  const tau = tauBB === null ? storedTau : tauBB;
  if (!isFinite_(tau) || tau < 0) {
    throw new EntryMapError(`τ must be a non-negative number, got ${String(tau)}`, { tauBB });
  }

  const INTERVAL_FIELDS = ['margin', 'mcError', 'modelError', 'halfWidth', 'lower', 'upper'];

  const cells = artifact.cells.map((cell, i) => {
    if (!cell || typeof cell.cellId !== 'string' || !cell.cellId) {
      throw new EntryMapError(`cell #${i} has no cellId; the migration report joins on it`, { index: i });
    }
    // Unreachable and degenerate cells legitimately carry no number — see `reachability`.
    // They are enumerated so the denominator stays honest, not so they can be read.
    if (cell.reachable === false || cell.degenerate === true) {
      return { ...cell, band: null };
    }
    for (const field of INTERVAL_FIELDS) {
      if (!isFinite_(cell[field])) {
        throw new EntryMapError(
          `cell "${cell.cellId}" is missing "${field}". Every evaluated cell carries an ` +
          'interval, never a bare point estimate — "near zero" and "we cannot tell" are ' +
          'different facts and only the interval separates them.',
          { cellId: cell.cellId, field },
        );
      }
    }
    return { ...cell, band: bandOf(cell, tau) };
  });

  const byBand = cells.reduce((acc, c) => {
    const k = c.band ?? (c.reachable === false ? 'unreachable' : 'degenerate');
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const warnings = [];
  if (artifact.engineDirty) {
    warnings.push(
      `map was produced from a dirty tree: the stamp names commit ${artifact.engineCommit.slice(0, 8)} ` +
      'but that commit does not contain the code that ran, so this map is not replicable',
    );
  }
  if (tau !== storedTau) {
    warnings.push(`bands recomputed at τ=${tau}bb; the artifact was written at τ=${storedTau}bb`);
  }

  return {
    ...artifact,
    schemaVersion,
    reporting: { ...artifact.reporting, tauBB: tau, tauBBAsWritten: storedTau },
    cells,
    counts: { ...artifact.counts, byBand },
    warnings,
  };
};
