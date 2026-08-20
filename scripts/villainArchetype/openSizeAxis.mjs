/**
 * openSizeAxis — the size axis that fold-to-a-single-open is conditioned on.
 *
 * THE BUG THIS EXISTS TO STOP, because it shipped and reached a published card.
 * `populationBaseline` keyed fold-to-a-raise on the seat alone. `facing: 'a raise'` is a raise
 * COUNT, not an amount (decisionLabeler.mjs:815-819), so a min-open to 2bb and an open to 5bb
 * landed in one cell. The exploit card then applied that pooled rate to a 2bb open. Measured on
 * the full 1756-file corpus, the big blind folds 57.5% to a 2bb open and 80.0% to a 4bb one —
 * so the pooled number imported ~23 points of fold equity that does not exist at the cheap end,
 * and it did so in the direction that made the cheapest open look best.
 *
 * Worse, and the reason this module is shared rather than inlined: the card's size sweep
 * (`runExploitCard.mjs`) moved only the REQUIRED fold rate. `allFold` took no size argument, so
 * the predicted rate was byte-identical across all four rows. "The cheapest steal is best" was
 * therefore a theorem of the arithmetic, not a finding about anyone. Producer and consumer must
 * bucket identically or the conditioning is decorative, which is why both import this file.
 *
 * WHY RAISE-TO, IN BIG BLINDS, AND NOT A POT FRACTION.
 * `standingBet` subtracts the opener's own posted blind, so a small blind opening to 3bb and a
 * button opening to 3bb produce different `betFractionOfPot` values (1.667 vs 2.0) for a price
 * that is identical to the seat that has to fold. Keying on pot fraction splits one cell in two
 * and calls the split "size". Raise-to is invariant to the opener's seat, and it is the only
 * lever hero actually chooses.
 *
 * WHY A LATTICE AND NOT A CONTINUOUS AXIS.
 * Open sizes are not continuous. On the full corpus the mass sits on the 0.5bb lattice from
 * 1.5bb to 6.0bb and essentially nowhere else. Fitting a curve across that would manufacture
 * interpolated values between points nobody ever bet.
 */

/** Bump when any boundary, the step, or the tail definitions change. Persisted artifacts carry
 *  it and `loadFoldToOpenCurve` refuses a mismatch, so a re-bucketing cannot silently re-read
 *  cells measured under the old lattice. */
export const OPEN_SIZE_AXIS_VERSION = 1;

/** The lattice the corpus actually sits on. Measured, not chosen: on 1,756 files every open
 *  size with non-trivial mass is a multiple of 0.5bb between 1.5 and 6.0. */
export const OPEN_SIZE_STEP_BB = 0.5;
export const OPEN_SIZE_MIN_BB = 1.5;
export const OPEN_SIZE_MAX_BB = 6.0;

/** The two tails. They are named and counted rather than dropped, because a filter that
 *  silently discards rows is how a sample becomes unrepresentative without anyone noticing —
 *  the scratch script that produced the original numbers dropped everything outside [1.5, 5]
 *  and never reported how much. */
export const OPEN_SIZE_BELOW = 'below1.5';
export const OPEN_SIZE_ABOVE = 'above6.0';

const latticePoints = () => {
  const out = [];
  for (let v = OPEN_SIZE_MIN_BB; v <= OPEN_SIZE_MAX_BB + 1e-9; v += OPEN_SIZE_STEP_BB) {
    out.push(Math.round(v * 2) / 2);
  }
  return out;
};

/** `to2.0`, `to2.5`, … — the raise-to amount the bucket is centred on. */
export const bucketName = (bb) => `to${bb.toFixed(1)}`;

export const OPEN_SIZE_LATTICE = Object.freeze(latticePoints());
export const OPEN_SIZE_BUCKETS = Object.freeze([
  OPEN_SIZE_BELOW, ...OPEN_SIZE_LATTICE.map(bucketName), OPEN_SIZE_ABOVE,
]);

/**
 * Which cell a raise-to amount belongs in.
 *
 * Rounds to the nearest lattice point, which puts the boundaries at the midpoints (2.25, 2.75,
 * …). A raise to 2.7bb is closer to 2.5 than to 3.0 and is counted there; the cell records the
 * observed mean so the rounding stays inspectable rather than becoming an assumption.
 *
 * @param {number} raiseToBB - the CUMULATIVE amount the aggressor raised to, in big blinds.
 *   Use `decisionLabeler`'s `aggressorToBB`. Do NOT reconstruct it as `toCallBB + posted`:
 *   that identity holds only for a seat that has invested exactly its blind and nothing more,
 *   and it breaks the moment the filter widens to limped pots, 3-bets, or the small blind.
 * @returns {string|null} a bucket name, or null when the input is not a usable number.
 */
export const openSizeBucket = (raiseToBB) => {
  if (typeof raiseToBB !== 'number' || !Number.isFinite(raiseToBB)) return null;
  if (raiseToBB < OPEN_SIZE_MIN_BB - OPEN_SIZE_STEP_BB / 2) return OPEN_SIZE_BELOW;
  if (raiseToBB >= OPEN_SIZE_MAX_BB + OPEN_SIZE_STEP_BB / 2) return OPEN_SIZE_ABOVE;
  return bucketName(Math.round(raiseToBB * 2) / 2);
};

/**
 * The half-open interval a bucket covers, `[lo, hi)`. The tails carry an infinite side so a
 * reader never has to guess where they stop.
 */
export const openSizeRange = (bucket) => {
  if (bucket === OPEN_SIZE_BELOW) return [0, OPEN_SIZE_MIN_BB - OPEN_SIZE_STEP_BB / 2];
  if (bucket === OPEN_SIZE_ABOVE) return [OPEN_SIZE_MAX_BB + OPEN_SIZE_STEP_BB / 2, Infinity];
  const centre = Number(String(bucket).replace(/^to/, ''));
  if (!Number.isFinite(centre)) return null;
  return [centre - OPEN_SIZE_STEP_BB / 2, centre + OPEN_SIZE_STEP_BB / 2];
};

/** The lattice point a bucket is centred on, or null for the tails (which have no centre). */
export const openSizeCentre = (bucket) => {
  if (bucket === OPEN_SIZE_BELOW || bucket === OPEN_SIZE_ABOVE) return null;
  const centre = Number(String(bucket).replace(/^to/, ''));
  return Number.isFinite(centre) ? centre : null;
};

/**
 * The conditioning sentence for a cell, in words.
 *
 * Every number this system reports carries the set it was measured over. That is not decoration
 * here: the whole defect this module addresses is a rate whose name did not say what it was
 * conditioned on, so nothing downstream could notice it was the wrong number.
 */
export const openConditional = ({ seat, bucket, blindTotalBB = null }) => {
  const range = openSizeRange(bucket);
  const where = bucket === OPEN_SIZE_BELOW ? `an open below ${OPEN_SIZE_MIN_BB}bb`
    : bucket === OPEN_SIZE_ABOVE ? `an open above ${OPEN_SIZE_MAX_BB}bb`
      : `an open to ${range[0].toFixed(2)}–${range[1].toFixed(2)}bb`;
  const pot = blindTotalBB == null ? 'an unopened pot' : `an unopened pot (${blindTotalBB}bb)`;
  return `P(fold | preflop, facing exactly one raise, ${pot}, seat = ${seat}, ${where})`;
};
