/**
 * equilibriumPost.mjs — the LOWER pier post, and the fact that it does not exist (WS-331).
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHY A MODULE FOR SOMETHING THAT DOES NOT EXIST
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * The number this half of WS-331 exists to produce is:
 *
 *     EXPLOITATION PREMIUM = EV(PBR) - EV(Equilibrium)
 *
 * How much money exists SPECIFICALLY BECAUSE THE POOL IS BAD, as opposed to because hero
 * plays solid poker. If the premium is small, the exploit engine is chasing pennies and the
 * honest founder-facing answer is "play well". If it is large, reads are where the money is
 * and we would know by how much. Nothing in the repo answers this today, and this module is
 * the reason it stays honestly unanswered rather than dishonestly answered.
 *
 * The upper post is measurable (`poolBestResponse.mjs`). The lower post is an EQUILIBRIUM,
 * registered in the promoted provenance registry as **SRC-013 — DOES NOT EXIST YET**: no
 * store, no ingestion, no schema, gated on an external solver artifact.
 *
 * A premium with a missing subtrahend is not a small number — it is not a number. So this
 * module returns `null` with a reason, and the report prints the reason.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE SUBSTITUTION THIS REFUSES, AND WHY IT IS THE LIKELY ONE
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * `PREFLOP_CHARTS` (`pokerCore/rangeMatrix.js`) is labelled "GTO-approximate" and is sitting
 * right there. Dropping it in would make the premium compute, and every downstream figure
 * would look complete.
 *
 * FSA Finding F3 and the SRC-013 registry entry are both explicit that it must not be:
 * the charts are STATIC PUBLISHED CHART STRINGS carrying no solver identity, no stack depth,
 * no rake model and no spot coverage. Scored as an Equilibrium they would be **a second
 * Field wearing an Equilibrium label** — and the premium computed against them would not be
 * "money that exists because the pool is bad", it would be "money that exists because the
 * pool differs from a chart", which is a different claim that reads identically.
 *
 * That is the WS-291 mechanism exactly: a plausible number on a load-bearing path with
 * nothing forcing it to meet a right one. So the refusal is a THROW, not a warning, and a
 * test asserts it — because a warning would let the next such surface register anyway, and
 * the whole value of the declaration is that it is unskippable (the argument
 * `surfaceRegistry.buildSurfaceEntry` already makes for `stack`).
 */

/** The registry id of the absent lower post. */
export const EQUILIBRIUM_SOURCE_ID = 'SRC-013';

/**
 * The Equilibrium post. `null` is the correct value and it is exported so consumers read a
 * named absence rather than each inventing their own fallback at the point of use.
 */
export const EQUILIBRIUM_POST = null;

/** Why it is null, in the words the report prints. */
export const EQUILIBRIUM_UNAVAILABLE_REASON =
  'lower post unavailable — the Equilibrium frame (SRC-013) does not exist: no solver '
  + 'artifact, no store, no schema. PREFLOP_CHARTS are published chart strings with no solver '
  + 'identity, stack depth, rake model or spot coverage, and scoring them as an equilibrium '
  + 'would make this premium measure "how far the pool sits from a chart" while reading as '
  + '"how much money the pool\'s mistakes are worth" (FSA Finding F3).';

/**
 * Sources that are chart-derived and therefore may never stand in for the Equilibrium post.
 *
 * Matched as substrings against whatever a caller offers, so `PREFLOP_CHARTS`,
 * `pokerCore/rangeMatrix.PREFLOP_CHARTS` and `SRC-009` all trip it. Being permissive about
 * the FORM of the identifier is deliberate: the guard exists to catch a mistake, and a
 * mistake will not arrive in the exact string this module would have guessed.
 */
export const FORBIDDEN_EQUILIBRIUM_SOURCES = Object.freeze([
  'PREFLOP_CHARTS',
  'rangeMatrix',
  'populationPriors',
  'POPULATION_PRIORS',
  'archetypeRanges',
  'SRC-009',
]);

/** Thrown when something tries to stand in for the equilibrium post. */
export class EquilibriumSubstitutionError extends Error {
  constructor(message, detail = {}) {
    super(message);
    this.name = 'EquilibriumSubstitutionError';
    this.detail = detail;
  }
}

/**
 * Refuse chart-derived material as the Equilibrium post.
 *
 * Call this at the moment a lower post is SUPPLIED, not at the moment it is used — by the
 * time a premium has been computed the substitution has already happened and the number
 * exists to be quoted.
 *
 * @param {string[]|string|null} sources
 * @throws {EquilibriumSubstitutionError}
 */
export const refuseChartsAsEquilibrium = (sources) => {
  const list = sources == null ? [] : (Array.isArray(sources) ? sources : [sources]);
  const offending = [];
  for (const s of list) {
    const str = String(s ?? '');
    for (const bad of FORBIDDEN_EQUILIBRIUM_SOURCES) {
      if (str.toLowerCase().includes(bad.toLowerCase())) { offending.push(str); break; }
    }
  }
  if (offending.length) {
    throw new EquilibriumSubstitutionError(
      `Refused as an Equilibrium post: ${offending.join(', ')}. ${EQUILIBRIUM_UNAVAILABLE_REASON}`,
      { offending, sources: list },
    );
  }
  return list;
};

/**
 * The exploitation premium, or a stated absence.
 *
 * @param {Object} args
 * @param {number|null} args.pbrEdgeBB - the upper post's edge over the field, in bb
 * @param {Object|null} [args.equilibrium] - the lower post; MUST be null until SRC-013 exists
 * @param {string[]} [args.equilibriumSources] - checked by `refuseChartsAsEquilibrium`
 * @returns {{value: number|null, reason: string|null, upperBB: number|null, lowerBB: number|null}}
 */
export const exploitationPremium = ({
  pbrEdgeBB = null,
  equilibrium = EQUILIBRIUM_POST,
  equilibriumSources = [],
} = {}) => {
  // Check the sources even when the post is null: a caller passing sources alongside a null
  // post is mid-substitution, and catching it here is cheaper than catching it after the
  // post is populated.
  refuseChartsAsEquilibrium(equilibriumSources);

  if (equilibrium == null) {
    return {
      value: null,
      reason: EQUILIBRIUM_UNAVAILABLE_REASON,
      upperBB: Number.isFinite(pbrEdgeBB) ? pbrEdgeBB : null,
      lowerBB: null,
      sourceId: EQUILIBRIUM_SOURCE_ID,
    };
  }

  // Unreachable until SRC-013 lands. Written now so the shape is fixed and the arrival of
  // the post is a data change rather than a code change here.
  const lower = equilibrium.edgeBB;
  if (!Number.isFinite(pbrEdgeBB) || !Number.isFinite(lower)) {
    return {
      value: null,
      reason: 'both posts must carry a finite edge before a premium means anything',
      upperBB: Number.isFinite(pbrEdgeBB) ? pbrEdgeBB : null,
      lowerBB: Number.isFinite(lower) ? lower : null,
      sourceId: EQUILIBRIUM_SOURCE_ID,
    };
  }
  return {
    value: pbrEdgeBB - lower,
    reason: null,
    upperBB: pbrEdgeBB,
    lowerBB: lower,
    sourceId: EQUILIBRIUM_SOURCE_ID,
  };
};
