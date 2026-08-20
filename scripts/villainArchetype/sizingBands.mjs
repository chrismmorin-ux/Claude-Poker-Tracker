/**
 * sizingBands — the axis a Conduct Card's ACTION SIZES are recorded on (WS-578).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE DEFECT THIS EXISTS TO CLOSE.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * `emitConductCard.mjs:169` built a rule's action distribution from `r.mix.dist`, which is
 * keyed on the action NAME alone. Measured on villain 2 (`jSCaL6Fm4lAi`, 9,442 labelled
 * decisions): `my_raise_to_bb` is populated on **1,676 of 1,676** aggressive actions — 1,106
 * preflop raises and 570 postflop bets/raises — and reached the card on ZERO rules. He raises
 * to exactly 3.5bb on 675 of 1,106 preflop raises, a near-deterministic sizing policy the card
 * did not record at all.
 *
 * It blocks WS-580 and WS-582 outright, not approximately: a simulator stepping an environment
 * needs `(action, amount)`. "He raises 16.4%" has no transition function. And it is not a gap a
 * default papers over — a raise to 3.5bb and a raise to 12bb produce different pots, different
 * SPRs and different continuing ranges, and their average describes a player who does not exist.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * TWO REGIMES, AND THEY MUST NEVER BE MIXED.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * PREFLOP IS A LATTICE IN BIG BLINDS. 1,101 of 1,106 preflop raises (99.5%) sit on the 0.5bb
 * lattice, and one point carries 61% of them. This is the same fact `openSizeAxis.mjs` records
 * about the wider corpus and for the same reason: fitting a continuous axis across that would
 * manufacture interpolated values between points nobody ever bet.
 *
 * POSTFLOP IS A POT FRACTION. In bb it is not comparable across pots at all; as a fraction it
 * is tight and unimodal, and the three profiled villains sit at medians 0.746 / 0.483 / 0.667.
 * That separation IS the read — it is the thing a banding must not smear.
 *
 * WHICH NUMERATOR, WHICH DENOMINATOR — named, because the repo has already been bitten here.
 * The postflop fraction is `myRaiseToBB / potBB`: the CUMULATIVE street amount he put the bet
 * TO, over the pot INCLUDING the live bet. `decisionLabeler.mjs:877-882` deletes a field that
 * conflated exactly these two conventions under a legend that said only "as a fraction of the
 * pot", so the convention is stamped on the card rather than assumed. Raise-TO is the right
 * numerator HERE (and the incremental cost is not) because the consumer is a transition
 * function: what the environment needs is the amount the chips go to, not what this player's
 * share of it cost him. Measured: only 12 of 570 postflop aggressive actions had any prior
 * in-street commitment, so the two conventions coincide on 558 of 570 — but "they usually
 * agree" is not a reason to leave which-one-it-is unwritten.
 *
 * DO NOT USE `my_bet_x_pot` FROM THE ARCHIVED v2 TSVs. That column divided by `potBB - myBet`,
 * subtracting hero's own bet from a pot that never contained it: 1,351 of 1,676 values exceed
 * 3, with a median of exactly 350 (= 3.5/0.01, the clamp) and a maximum of 15,900. Fixed in
 * `decisionLabeler.mjs` on 2026-08-19; the archived cards predate the fix.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * TWO ARMS, BECAUSE THE BANDING IS AN UNMEASURED CONSTANT.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * `.claude/rules/unmeasured-constants.md`: when a constant is needed and has not been proven,
 * run BOTH arms and report the delta — the difference between them is itself a result, not a
 * diagnostic to glance at once and discard. Here that is nearly free: a banding is a post-hoc
 * bucketing of an already-computed column, so the second arm costs one extra pass over 1,676
 * rows rather than a second induction.
 *
 *   S2 — DATA-DERIVED. Boundaries placed off the observed distribution, with the 3.5bb point
 *        mass given its own band. WS-578's own accept criterion: a fixed 0.25-width banding
 *        "wastes most of its resolution on empty space and merges the one value that matters
 *        with its neighbours".
 *   S3 — FIXED CONVENTION. The postflop boundaries are the repo's OWN existing table
 *        (`induceCore.mjs:29-31`, the `bet_x_pot` rule bands), not a fresh invention — that is
 *        what makes S3 an independent arm rather than S2 with the numbers jiggled.
 *
 * Neither arm is the answer by default. A consumer's choice of arm is a DECLARED field on the
 * card, never an implicit default that drifts.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE TAIL SPLIT — S2 v1 -> v2, and the pre-registered falsifier it answered.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * S2 v1's preflop tail `>=8` held 191 of 1,106 preflop raises and **121 of them were the same
 * value, exactly 12bb** — a second near-deterministic size, 11% of his preflop raises, merged
 * with 35bb and 44bb shoves. The argument that earned 3.5bb its own band was the identical
 * argument for 12bb, so v1 was data-derived at the low end and a constant table at the high end.
 *
 * The domain argument is stronger than the statistical one: `>=8` conflated the modal **3-bet**
 * with the **jam** tail, and those are DIFFERENT ACTIONS rather than different sizes of one
 * action. That is the label-collapse this repo's own first-principles rule warns about.
 *
 * MEASURED, and stated whichever way it went. The prediction on record before the boundary
 * moved was preflop RMSE 8.68 -> 7.72 bb (-11%) from a bare 12bb band. **The prediction was
 * beaten.** Splitting the shoulder as well gives 7.408 (-14.6%), and adding the gap-based jam
 * edge gives **2.498 (-71.2%)**, with bits retained rising 1.516 -> 1.748. Reconstruction error
 * in the tail band falls from 20.88 to 6.49 for the jams and 11.17 for the 4-bet band, from a
 * single pooled 20.88.
 *
 * WHAT IS STILL MERGED, and it stays named on every card (`knownLimitation`):
 *   - `12.25-79` pools 4-bets (13-19bb, 32 obs) with large 3-bets and mid shoves (23-58bb, 20
 *     obs), RMSE 11.17. The same different-actions argument applies once more; it is not split
 *     because no comparable gap exists there — the largest is 9bb, inside a populated region,
 *     so any edge would be fitted rather than found.
 *   - `>=79` is a SIZE PROXY for "he is all-in", not an all-in flag. At a different stack depth
 *     the proxy is wrong, and nothing here would notice.
 * Both are visible per band via `shape` (`distinctValues`, `modal`, `modalShare`) as well.
 */

import {
  SIZING_REGIMES,
  SIZING_UNSIZED_BAND,
  SIZED_ACTIONS,
} from '../../src/utils/standardOfRecord/conductCard.js';
import { MIN_RULE_DEFAULT } from './induceCore.mjs';

export { SIZING_REGIMES, SIZING_UNSIZED_BAND, SIZED_ACTIONS };

/**
 * VERSION PER SCHEME. Bump when ANY boundary, band name, or regime assignment changes.
 *
 * A stored card carries its scheme version AND its full boundary table (see
 * `bandingDeclaration`), and `assertBandingCompatible` refuses a mismatch — the same contract
 * `OPEN_SIZE_AXIS_VERSION` + `loadFoldToOpenCurve` already hold for the fold-to-open lattice.
 * Without it, a re-bucketing silently re-reads cells that were measured under the old lattice,
 * which is a wrong number that never has to meet a right one.
 */
export const SIZING_SCHEME_VERSIONS = Object.freeze({ S2: 2, S3: 1 });

export const SIZING_SCHEME_IDS = Object.freeze(Object.keys(SIZING_SCHEME_VERSIONS));

/**
 * THE PRIOR WEIGHT FOR SHRINKAGE, and it is not a new constant.
 *
 * `induceCore.mjs:13` — the repo's own minimum leaf size, the n below which the induction
 * refuses to call a cell a rule. Reused rather than re-chosen: a pseudo-count of 25 means a
 * band standing on exactly the repo's minimum leaf gets equal weight from its own data and
 * from its parent, which is the only defensible place to put the crossover if the threshold is
 * to mean anything at all.
 */
export const SIZING_PRIOR_WEIGHT = MIN_RULE_DEFAULT;

/** Half-open `[lo, hi)` everywhere, with no gaps and no overlaps. See BANDING TOTALITY below. */
const band = (name, lo, hi) => Object.freeze({ name, lo, hi });

/**
 * BANDING TOTALITY — why the boundaries below are not literally the strings that were ruled on.
 *
 * S2 was ruled as preflop `<3.25 / 3.5 / 4-4.5 / 5-8 / >=8`. Read literally that is not a
 * partition: it says nothing about (3.5, 4) or (4.5, 5), and a value landing in a gap would be
 * dropped — which is the one thing this form forbids, since the residue check requires the
 * bands to sum to the action's own k. So the gaps are closed at the midpoints of the 0.5bb
 * lattice, which is `openSizeAxis`'s own convention (`openSizeBucket` rounds to the nearest
 * lattice point, putting boundaries at 2.25, 2.75, …).
 *
 * VERIFIED IMMATERIAL on the only subject whose sizes are measured: zero observations fall in
 * (3.5, 4) or (4.5, 5), zero fall exactly on 3.25 / 3.75 / 4.75, and the 4 observations exactly
 * at 8.0 land in `>=8` under either reading. The closure changes no measured count; it changes
 * whether a FUTURE value can vanish.
 *
 * The postflop `<=0.45` is likewise re-read as `<0.45` so every boundary in the file is
 * half-open in the same direction. Zero observations sit exactly at 0.45 (two within ±0.01).
 */
const S2_PREFLOP = Object.freeze([
  // Below the modal open. Small, and small is the point: 5 of 1,106.
  band('<3.25', 0, 3.25),
  // THE POINT BAND. 675 of 1,106 preflop raises are exactly 3.5bb. ±0.25 is half the 0.5bb
  // lattice step, so this band is "the 3.5 lattice point" and nothing else.
  band('3.5', 3.25, 3.75),
  // The 4.0 and 4.5 lattice points pooled — 198 of 1,106, and no separator was sought between
  // them, so pooling them is a statement about resolution rather than about him.
  band('4-4.5', 3.75, 4.75),
  band('5-8', 4.75, 8),

  // ── S2 v2 (2026-08-20): the `>=8` tail, split. See THE TAIL SPLIT below. ──
  /** The 3-bet shoulder below the modal size: 8bb ×4, 10.5 ×3, 11 ×2. */
  band('8-11.75', 8, 11.75),
  /**
   * THE SECOND POINT BAND. 121 of 191 tail raises are exactly 12.0bb — his modal 3-bet, and a
   * larger point mass than anything except the 3.5bb open itself. Edges are ±0.25, half the
   * 0.5bb lattice step, the identical convention that gave 3.5 its band; the nearest observed
   * neighbours are 11 and 13, so this band captures the 121 and nothing else.
   */
  band('12', 11.75, 12.25),
  /** 4-bets and large 3-bets: 52 observations, 13.0 to 58.0, mean 22.8. */
  band('12.25-79', 12.25, 79),
  /**
   * THE JAM TAIL. The edge is the midpoint of the LARGEST GAP in the observed distribution —
   * 58.0 to 100.0, a 42bb hole, where the next largest gap anywhere in the tail is 9bb. An edge
   * sitting in an empty region is the robust kind: it is not fitted to the 9 observations above
   * it, and moving it anywhere inside (58, 100) changes no count. Those 9 raises average 106.5bb
   * at a 100bb table, i.e. they are full-stack shoves.
   */
  band('>=79', 79, Infinity),
]);

const S2_POSTFLOP = Object.freeze([
  band('<0.45', 0, 0.45),
  band('0.45-0.60', 0.45, 0.60),
  // The three profiled villains' medians (0.746 / 0.483 / 0.667) fall in three DIFFERENT bands
  // here. That is the whole design target: a banding that put them in one cell would erase the
  // only postflop sizing separation the corpus has actually shown.
  band('0.60-0.72', 0.60, 0.72),
  band('0.72-0.95', 0.72, 0.95),
  band('>=0.95', 0.95, Infinity),
]);

const S3_PREFLOP = Object.freeze([
  band('<3', 0, 3),
  band('3-4.5', 3, 4.5),
  band('4.5-8', 4.5, 8),
  band('>=8', 8, Infinity),
]);

/**
 * S3 POSTFLOP IS THE REPO'S EXISTING FIXED TABLE, lifted from `induceCore.mjs:29-31` where it
 * already bands `bet_x_pot` for rule predicates ("a small bet (<0.4x pot)" / "a medium bet
 * (0.4-0.7x)" / "a pot-sized bet" (<=1.05) / "an overbet"). Lifting it rather than inventing
 * 0.45/0.75/1.0 is what makes this a genuinely independent arm: an arm invented alongside S2,
 * by the same person, off the same histogram, is S2 with the numbers jiggled and its delta
 * would measure nothing.
 */
const S3_POSTFLOP = Object.freeze([
  band('small', 0, 0.4),
  band('medium', 0.4, 0.7),
  band('large', 0.7, 1.05),
  band('overbet', 1.05, Infinity),
]);

export const SIZING_SCHEMES = Object.freeze({
  S2: Object.freeze({
    id: 'S2',
    kind: 'data-derived',
    rationale: 'Boundaries placed off the observed distribution of 1,676 aggressive actions, '
      + 'with the 3.5bb point mass (675/1,106 preflop raises) given its own band. WS-578 AC4: a '
      + 'fixed-width banding wastes its resolution on empty space and merges the one value that matters.',
    regimes: Object.freeze({
      [SIZING_REGIMES.PREFLOP_BB]: S2_PREFLOP,
      [SIZING_REGIMES.POSTFLOP_POT_FRACTION]: S2_POSTFLOP,
    }),
  }),
  S3: Object.freeze({
    id: 'S3',
    kind: 'fixed-convention',
    rationale: 'The conventional open-size bands preflop, and the repo\'s OWN existing '
      + 'bet_x_pot table postflop (induceCore.mjs:29-31). Chosen for independence from S2, not '
      + 'for fit — an arm fitted to the same histogram measures nothing when differenced.',
    regimes: Object.freeze({
      [SIZING_REGIMES.PREFLOP_BB]: S3_PREFLOP,
      [SIZING_REGIMES.POSTFLOP_POT_FRACTION]: S3_POSTFLOP,
    }),
  }),
});

/** The regime a street is measured in. Preflop is a bb lattice; every other street is a pot fraction. */
export const regimeForStreet = (street) => (
  street === 'preflop' ? SIZING_REGIMES.PREFLOP_BB : SIZING_REGIMES.POSTFLOP_POT_FRACTION
);

/**
 * The scalar a size is banded on, with the regime that says what it means.
 *
 * Returns `null` — never a fallback value — when the size is missing or the postflop
 * denominator is unusable. A size that cannot be computed becomes the `unsized` band, which is
 * counted and named, because a silently dropped row is how a sample stops being representative
 * without anyone noticing (`openSizeAxis`'s named tails exist for the same reason).
 *
 * @param {{sizeBb:number|null, potBb:number|null, street:string}} d
 * @returns {{regime:string, value:number}|null}
 */
export const sizingValue = ({ sizeBb, potBb, street }) => {
  const regime = regimeForStreet(street);
  if (typeof sizeBb !== 'number' || !Number.isFinite(sizeBb) || sizeBb <= 0) return null;
  if (regime === SIZING_REGIMES.PREFLOP_BB) return { regime, value: sizeBb };
  if (typeof potBb !== 'number' || !Number.isFinite(potBb) || potBb <= 0) return null;
  return { regime, value: sizeBb / potBb };
};

/** The ordered band descriptors for a regime under a scheme. */
export const bandsOf = (regime, scheme = 'S2') => {
  const s = SIZING_SCHEMES[scheme];
  if (!s) throw new Error(`unknown sizing scheme "${scheme}" — legal: ${SIZING_SCHEME_IDS.join(', ')}`);
  const bands = s.regimes[regime];
  if (!bands) throw new Error(`unknown sizing regime "${regime}" under scheme ${scheme}`);
  return bands;
};

/** Every band NAME for a regime, in order, with the unsized cell appended. Sums to k over these. */
export const bandNamesOf = (regime, scheme = 'S2') => [
  ...bandsOf(regime, scheme).map((b) => b.name), SIZING_UNSIZED_BAND,
];

/**
 * Which band a size falls in.
 *
 * @param {number|null} sizeBb - `decisionLabeler`'s `myRaiseToBB`: the CUMULATIVE amount he put
 *   the bet TO on this street, in big blinds. Do NOT pass an incremental cost.
 * @param {number|null} potBb  - `potBB`, the pot INCLUDING the live bet. Ignored preflop.
 * @param {string} street
 * @param {string} scheme
 * @returns {string} a band name, or `unsized` when no size is derivable.
 */
export const bandFor = (sizeBb, potBb, street, scheme = 'S2') => {
  const v = sizingValue({ sizeBb, potBb, street });
  if (!v) return SIZING_UNSIZED_BAND;
  for (const b of bandsOf(v.regime, scheme)) {
    if (v.value >= b.lo && v.value < b.hi) return b.name;
  }
  // Unreachable while the tables stay total; kept as a loud failure rather than a quiet drop,
  // because a gap introduced by a later edit must not present as missing data.
  throw new Error(`sizing bands for ${v.regime}/${scheme} are not total: ${v.value} fell through`);
};

/** The `[lo, hi)` a band covers, or null for the unsized cell (which covers no interval). */
export const bandRange = (bandName, regime, scheme = 'S2') => {
  if (bandName === SIZING_UNSIZED_BAND) return null;
  const b = bandsOf(regime, scheme).find((x) => x.name === bandName);
  return b ? [b.lo, b.hi] : null;
};

/**
 * THE DECLARATION A CARD CARRIES — the full boundary table, not a version string.
 *
 * A card that stamped only `scheme: 'S2', version: 1` would still be re-basable: read it with
 * a build whose S2 means something else and every band silently changes meaning. Carrying the
 * boundaries makes the card SELF-DESCRIBING, so an old card can be read correctly by a reader
 * that has never heard of the lattice it was measured on, and a difference between two cards'
 * tables is visible in a diff rather than inferred from a mismatched integer.
 */
export const bandingDeclaration = (scheme = 'S2') => {
  const s = SIZING_SCHEMES[scheme];
  if (!s) throw new Error(`unknown sizing scheme "${scheme}"`);
  return {
    scheme: s.id,
    version: SIZING_SCHEME_VERSIONS[s.id],
    kind: s.kind,
    rationale: s.rationale,
    regimes: Object.fromEntries(Object.entries(s.regimes).map(([regime, bands]) => [
      regime,
      bands.map((b) => ({ name: b.name, lo: b.lo, hi: b.hi === Infinity ? null : b.hi })),
    ])),
    unsizedBand: SIZING_UNSIZED_BAND,
  };
};

/**
 * REFUSE, do not adapt. A loader reading a stored card whose banding disagrees with this
 * build's must stop: quietly re-reading old cells under a new lattice is exactly the class of
 * silent re-basing `.claude/rules/artifact-location.md` forbids ("unreachable must be an error,
 * never a fallback") and that `loadFoldToOpenCurve` already enforces for the open-size axis.
 */
export const assertBandingCompatible = (declared, scheme = 'S2') => {
  if (!declared || typeof declared !== 'object') {
    throw new Error('sizing banding declaration missing — a card that cannot name its lattice cannot be read');
  }
  if (declared.scheme !== scheme) {
    throw new Error(`sizing scheme mismatch: card was banded under "${declared.scheme}", this reader wants "${scheme}"`);
  }
  const want = SIZING_SCHEME_VERSIONS[scheme];
  if (declared.version !== want) {
    throw new Error(
      `sizing scheme ${scheme} version mismatch: card was banded under v${declared.version}, `
      + `this build is v${want}. REFUSED rather than re-bucketed — cells measured under one `
      + 'lattice are not cells of another.',
    );
  }
  const live = bandingDeclaration(scheme);
  for (const [regime, bands] of Object.entries(live.regimes)) {
    const stored = declared.regimes?.[regime];
    if (!Array.isArray(stored) || stored.length !== bands.length) {
      throw new Error(`sizing banding for ${regime} differs in shape from this build's ${scheme} v${want}`);
    }
    for (let i = 0; i < bands.length; i += 1) {
      if (stored[i].name !== bands[i].name || stored[i].lo !== bands[i].lo || stored[i].hi !== bands[i].hi) {
        throw new Error(
          `sizing band ${regime}[${i}] differs: card has ${JSON.stringify(stored[i])}, `
          + `this build has ${JSON.stringify(bands[i])}. The version matched and the boundaries `
          + 'did not, which means a version was not bumped when boundaries moved.',
        );
      }
    }
  }
  return true;
};

// ────────────────────────────────────────────────────────────────────────────────────────────
// SHRINKAGE — the operation `.claude/rules/sparsity-refuse-or-shrink.md` prescribes HERE.
// ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A sizing band is a DECISION INPUT, not a displayed comparative claim: it feeds a simulator's
 * transition function. ADR-009's trigger — "could someone act on this number or cite it" —
 * answers NO for the value in this field, so the operation is SHRINK TOWARD THE PARENT and not
 * refuse. Refusal is the right operation on a Guide cell and a ranked spot list, where the
 * number reaches a human; class is set by where the number ENDS UP, which is why every band
 * carries `shrunk` and why `classNote` rides on the block.
 *
 * The thin cells are thin CELLS, not thin MASS. At the repo's own MIN_RULE_DEFAULT = 25 only
 * 15 (rule, action) pairs clear the threshold on villain 2 — and those 15 hold 86% of all his
 * aggressive decisions. Refusing the rest would blank a long tail of spots while retaining
 * almost all the evidence, which is the wrong trade for a transition function that has to
 * return SOMETHING at every node it can be stepped into.
 *
 * THE ESTIMATOR IS APPLIED UNIFORMLY, not only below the threshold. A rule that shrank only
 * thin cells would put a discontinuity at n = 25: two nearly identical cells, one at n = 24 and
 * one at n = 26, would report values produced by different estimators and be incomparable in a
 * way nothing on the card would show. So every band reports a posterior mean with pseudo-count
 * `SIZING_PRIOR_WEIGHT`, the raw rate is kept beside it, and `thin` marks the cells whose own
 * data does not clear the repo's minimum leaf size.
 *
 * A ZERO BAND KEEPS A NON-ZERO ESTIMATE, which is the point rather than a side effect: a
 * simulator must not assign probability zero to a size this player demonstrably uses elsewhere
 * merely because one leaf never happened to contain it.
 *
 * THE CELL IS `(regime, band)`, NOT `band`. Measured on villain 2: induced rules routinely span
 * streets — one leaf carries `["preflop","flop"]` and another `["turn","preflop","flop","river"]`
 * — so a single (rule, action) pair genuinely holds decisions in BOTH regimes. Keying the cell
 * on the band name alone would put a 3.5bb preflop raise and a 0.6x flop raise in adjacent cells
 * of one distribution and make the two axes look commensurable, which is the one thing the
 * two-regime split exists to prevent. Keyed on the pair, the distribution is over
 * `(regime, band)` and a simulator at a known street conditions on its regime before sampling.
 *
 * @param {Object} p
 * @param {Array<{regime:string, band:string}>} p.cells - the cells to emit, INCLUDING zeros
 * @param {Map<string,number>} p.counts       - cellKey -> k, for THIS (rule, action)
 * @param {number} p.n                        - the action's k in this rule; cells sum to it
 * @param {Map<string,number>} p.parentCounts - cellKey -> k, for this action across the CARD
 * @param {number} p.parentN
 * @param {Map<string,number>} p.popCounts    - cellKey -> k, for every sized action on the card
 * @param {number} p.popN
 * @param {string} p.parentLabel              - what the parent IS, recorded on every band
 */
export const cellKey = (regime, band) => `${regime} ${band}`;

export const shrinkBands = ({
  cells, counts, n, parentCounts, parentN, popCounts, popN, parentLabel,
  priorWeight = SIZING_PRIOR_WEIGHT,
}) => {
  const m = priorWeight;
  return cells.map(({ regime, band: name }) => {
    const key = cellKey(regime, name);
    const k = counts.get(key) || 0;
    // Two-level chain: population -> this action across the card -> this (rule, action). The
    // parent is itself shrunk toward the population, so a card-level cell that is ALSO thin
    // does not get treated as ground truth just because it sits one level up.
    const qPop = popN > 0 ? (popCounts.get(key) || 0) / popN : 0;
    const qParent = parentN > 0
      ? ((parentCounts.get(key) || 0) + m * qPop) / (parentN + m)
      : qPop;
    const pRaw = n > 0 ? k / n : 0;
    const p = (k + m * qParent) / (n + m);
    return {
      regime,
      band: name,
      k,
      n,
      /** The count fact, untouched. Shrinkage never edits a count — only the estimate over it. */
      pRaw,
      /** The value a simulator samples. Posterior mean, pseudo-count m, parent as prior. */
      p,
      shrunk: true,
      shift: p - pRaw,
      thin: n < SIZING_PRIOR_WEIGHT,
      shrunkToward: parentLabel,
      priorWeight: m,
    };
  });
};

// ────────────────────────────────────────────────────────────────────────────────────────────
// THE ARM COMPARISON — the delta `unmeasured-constants.md` requires be reported, not buried.
// ────────────────────────────────────────────────────────────────────────────────────────────

const entropyBits = (ks, total) => {
  if (!total) return 0;
  let h = 0;
  for (const k of ks) { if (k > 0) { const q = k / total; h -= q * Math.log2(q); } }
  return h;
};

/**
 * How much of the size a banding actually preserves, per regime, in the regime's own units.
 *
 * The metric is the BAND-MEAN RECONSTRUCTION ERROR: replace every observation by its band's
 * observed mean — which is exactly what a simulator sampling a band and taking its centre
 * would do — and measure what is left. It is the same quantity WS-578's known-answer criterion
 * asks about ("reproduce the actual pot size at every node to within the band width"), it is
 * comparable across schemes with different band counts, and it is in bb preflop and in pot
 * fractions postflop rather than in an abstract score.
 *
 * `bitsRetained` is reported beside it because the two can disagree, and the disagreement is
 * informative: a scheme can carry more bits (more, better-balanced cells) while reconstructing
 * worse (its cells are wider where the mass is).
 *
 * @param {Array<{sizeBb:number|null, potBb:number|null, street:string}>} samples
 */
export const armResolution = (samples, scheme = 'S2') => {
  const perRegime = {};
  for (const s of samples) {
    const v = sizingValue(s);
    const regime = regimeForStreet(s.street);
    const slot = perRegime[regime] || (perRegime[regime] = { values: [], byBand: new Map(), unsized: 0 });
    if (!v) { slot.unsized += 1; continue; }
    const b = bandFor(s.sizeBb, s.potBb, s.street, scheme);
    slot.values.push({ value: v.value, band: b });
    slot.byBand.set(b, [...(slot.byBand.get(b) || []), v.value]);
  }
  const out = {};
  for (const [regime, slot] of Object.entries(perRegime)) {
    const means = new Map();
    for (const [b, vals] of slot.byBand) means.set(b, vals.reduce((x, y) => x + y, 0) / vals.length);
    let sq = 0; let maxAbs = 0;
    for (const { value, band: b } of slot.values) {
      const e = value - means.get(b);
      sq += e * e; maxAbs = Math.max(maxAbs, Math.abs(e));
    }
    const n = slot.values.length;
    out[regime] = {
      n,
      unsized: slot.unsized,
      bandsOccupied: slot.byBand.size,
      bandsDeclared: bandsOf(regime, scheme).length,
      rmse: n ? Math.sqrt(sq / n) : null,
      maxAbsErr: n ? maxAbs : null,
      bitsRetained: entropyBits([...slot.byBand.values()].map((v) => v.length), n),
      unit: regime === SIZING_REGIMES.PREFLOP_BB ? 'bb (raise-to)' : 'fraction of pot including the live bet',
    };
  }
  return out;
};

/**
 * Both arms and the difference between them, as a result.
 *
 * A delta of zero is a FINDING and not a failure: it says the banding is not load-bearing on
 * this path, which is worth knowing and is often surprising. A large delta promotes the
 * banding to a first-class measurement target with its own item.
 */
export const armComparison = (samples, { primary = 'S2', alt = 'S3' } = {}) => {
  const a = armResolution(samples, primary);
  const b = armResolution(samples, alt);
  const delta = {};
  for (const regime of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[regime]; const y = b[regime];
    delta[regime] = {
      rmse: x?.rmse != null && y?.rmse != null ? y.rmse - x.rmse : null,
      maxAbsErr: x?.maxAbsErr != null && y?.maxAbsErr != null ? y.maxAbsErr - x.maxAbsErr : null,
      bitsRetained: x && y ? y.bitsRetained - x.bitsRetained : null,
      unit: x?.unit ?? y?.unit ?? null,
    };
  }
  return {
    metric: 'band-mean reconstruction error: every observation replaced by its band\'s observed '
      + 'mean, which is what a simulator sampling the band and taking its centre would produce',
    sign: `positive = ${alt} reconstructs WORSE than ${primary}`,
    arms: { [primary]: a, [alt]: b },
    delta,
  };
};

/**
 * The per-band descriptive summary that makes a merged point mass visible.
 *
 * This is the concrete answer to the S2 disagreement in the header: `>=8` looks like a tail and
 * on villain 2 it is 63% one repeated value. A band that carries `distinctValues: 14` with
 * `modalShare: 0.63` cannot be read as a smooth tail by anyone looking at the card.
 *
 * It is also WS-578 AC5 in a queryable form: "report how concentrated the sizing is per action
 * — if a villain's raise size is nearly deterministic, that is itself an exploitable fact".
 */
export const bandShape = (values) => {
  if (!values.length) return { distinctValues: 0, modal: null, modalShare: null, mean: null, min: null, max: null };
  const tally = new Map();
  for (const v of values) tally.set(v, (tally.get(v) || 0) + 1);
  const [modal, count] = [...tally.entries()].sort((x, y) => y[1] - x[1])[0];
  return {
    distinctValues: tally.size,
    modal,
    modalShare: count / values.length,
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
};
