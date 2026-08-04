/**
 * strategyPosition.mjs — a strategy has a POSITION, not a number (WS-331).
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE ROTATING BASELINE
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * The founder asked for "a rotating baseline around a known anchor". A single EV figure
 * cannot be one: +12 bb is unreadable without knowing whether 13 was available or 400 was.
 * And it survives no engine upgrade — improve the engine and the number moves, with nothing
 * saying whether the ceiling moved with it.
 *
 * So every strategy gets TWO coordinates, and the anchor is that both are defined by the
 * POPULATION and the EQUILIBRIUM rather than by our engine:
 *
 *   x — EV, LOCATED BETWEEN THE POSTS. Not the raw edge: the fraction of the available edge
 *       captured (`exploitationEfficiency`). A strategy at 0.3 leaves 70% of the money the
 *       field was giving away on the table, and that reading does not change when the engine
 *       changes, because the denominator is not ours.
 *
 *   y — OWN EXPLOITABILITY. What a best response to THIS strategy would win against it. The
 *       axis that separates "wins because the field is bad" from "wins and cannot be
 *       punished for how".
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHY THE SHAPE IS ENFORCED AND ONE COORDINATE IS OFTEN NULL
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * `buildPosition` REFUSES a bare scalar. That is the whole mechanism — not a convention, not
 * a doc line. The failure it prevents is the one the repo has already lived: a number
 * escapes with no axis attached, gets quoted, and by the time anyone asks "compared to
 * what?" it has been load-bearing for months.
 *
 * The y-axis is MEASURABLE FOR EXACTLY ONE SURFACE TODAY, and that is not a gap — it is a
 * definition. The pool's exploitability IS PBR's edge: PBR is the best response to the pool,
 * so what it wins is by construction what the pool is exploitable for. For any other
 * strategy, measuring exploitability means playing a best response AGAINST it, which needs
 * the population simulator (WS-326) that does not exist. So it ships `null` with a reason,
 * exactly as the Equilibrium post does.
 *
 * A null coordinate that a reader can SEE is a different object from a coordinate that was
 * never mentioned. This module exists to make the difference structural.
 */

import { PBR_SCOPE, PBR_WARNING } from './poolBestResponse.mjs';

/** Why y is null for everything but the pool. */
export const EXPLOITABILITY_UNAVAILABLE_REASON =
  'own exploitability requires playing a best response AGAINST this strategy, which needs the '
  + 'population simulator (WS-326). Not built. The pool is the one exception: its '
  + 'exploitability is PBR\'s edge by construction.';

/** Why efficiency is null when the ceiling is not usable as a denominator. */
export const EFFICIENCY_UNAVAILABLE_NONPOSITIVE =
  'exploitation efficiency is undefined: PBR\'s own edge is not positive, so there is no '
  + 'measured headroom to take a fraction of. This is a statement about the RUN (too few '
  + 'decisions, or a ceiling the sample cannot resolve), not a finding that the field is '
  + 'unexploitable.';

export const EFFICIENCY_UNAVAILABLE_NO_PBR =
  'exploitation efficiency is undefined: no PBR arm was scored on this run.';

/**
 * Exploitation efficiency — a strategy's edge as a fraction of the ceiling's edge.
 *
 * BOTH TERMS ARE EDGES OVER THE FIELD, never raw values, and the difference matters. Raw
 * WIS values are dominated by the field's own baseline (they are hand-scale outcomes that
 * both policies share), so a ratio of raw values would sit near 1.0 for any two strategies
 * and read as "we are already at the ceiling". The ratio of EDGES is the quantity the
 * founder asked for: of the money that was there to be won BEYOND playing like the field,
 * how much did we get.
 *
 * Not clamped to [0,1]. A negative value (the strategy loses to the field) and a value above
 * 1 (the strategy beat the one-step ceiling, which is possible because PBR is capped at one
 * step — see `PBR_SCOPE`) are both real readings, and clamping them would hide the two cases
 * most worth seeing.
 *
 * @returns {{value: number|null, reason: string|null}}
 */
export const exploitationEfficiency = (strategyEdgeBB, pbrEdgeBB) => {
  if (!Number.isFinite(pbrEdgeBB)) {
    return { value: null, reason: EFFICIENCY_UNAVAILABLE_NO_PBR };
  }
  if (pbrEdgeBB <= 0) {
    return { value: null, reason: EFFICIENCY_UNAVAILABLE_NONPOSITIVE };
  }
  if (!Number.isFinite(strategyEdgeBB)) {
    return { value: null, reason: 'strategy has no scorable edge on this run' };
  }
  return { value: Number((strategyEdgeBB / pbrEdgeBB).toFixed(4)), reason: null };
};

/** Thrown when something tries to report a strategy as a single number. */
export class ScalarPositionError extends Error {
  constructor(message, detail = {}) {
    super(message);
    this.name = 'ScalarPositionError';
    this.detail = detail;
  }
}

/**
 * Build a strategy's 2D position.
 *
 * @param {Object} args
 * @param {string} args.label - which strategy this is
 * @param {number|null} args.edgeBB - its edge over the field, in bb
 * @param {number|null} args.pbrEdgeBB - the upper post's edge, in bb
 * @param {number|null} [args.ownExploitabilityBB] - y, when it can be measured
 * @param {string|null} [args.exploitabilityReason] - why y is null, when it is
 * @param {boolean} [args.isCeiling] - true for PBR itself, which carries its own warning
 * @throws {ScalarPositionError} when handed a number instead of a described strategy
 */
export const buildPosition = (args) => {
  if (typeof args === 'number' || typeof args === 'string') {
    throw new ScalarPositionError(
      `A strategy may not be reported as a bare ${typeof args} (${args}). Every strategy is a `
      + 'POSITION: EV located between the posts, plus its own exploitability. A scalar edge '
      + 'cannot say whether it captured 3% or 90% of what was available, and it does not '
      + 'survive an engine upgrade — which is exactly what the two posts exist to fix.',
      { got: args },
    );
  }
  const {
    label,
    edgeBB = null,
    pbrEdgeBB = null,
    ownExploitabilityBB = null,
    exploitabilityReason = EXPLOITABILITY_UNAVAILABLE_REASON,
    isCeiling = false,
  } = args ?? {};

  if (!label) {
    throw new ScalarPositionError(
      'A position must name the strategy it describes — two positions can only be compared if '
      + 'both say what they are of.',
      { got: args },
    );
  }

  const efficiency = exploitationEfficiency(edgeBB, pbrEdgeBB);
  const hasY = Number.isFinite(ownExploitabilityBB);

  return {
    label,
    // x
    edgeBB: Number.isFinite(edgeBB) ? edgeBB : null,
    exploitationEfficiency: efficiency.value,
    efficiencyUnavailableReason: efficiency.reason,
    // y
    ownExploitabilityBB: hasY ? ownExploitabilityBB : null,
    exploitabilityUnavailableReason: hasY ? null : exploitabilityReason,
    // Both axes present, in the sense that matters: a reader cannot see this object without
    // seeing that there are two and which of them is unmeasured.
    axesMeasured: [efficiency.value !== null, hasY],
    warning: isCeiling ? PBR_WARNING : null,
    scope: isCeiling ? PBR_SCOPE : null,
  };
};

/**
 * Positions for every arm of a hero-EV run, against the PBR ceiling.
 *
 * The POOL entry is the one with a measured y-coordinate, and its x is 0 by definition (the
 * field's edge over itself is zero — the control arm asserts exactly this every run). Listing
 * it makes the coordinate system legible: the reader sees the origin, the ceiling, and where
 * the engine sits between them.
 *
 * @param {Object} arms - the `heroEvReport` arms
 * @param {Object|null} pbrArm - the PBR arm, or null when the run produced none
 */
export const buildPositions = (arms, pbrArm) => {
  const pbrEdgeBB = Number.isFinite(pbrArm?.edgeBB) ? pbrArm.edgeBB : null;
  const out = [];

  out.push(buildPosition({
    label: 'field (population-typical)',
    edgeBB: 0,
    pbrEdgeBB,
    // BY CONSTRUCTION, not by measurement-with-a-caveat: a best response to the pool wins
    // exactly what the pool is exploitable for. This is the one y in the repo today.
    ownExploitabilityBB: pbrEdgeBB,
    exploitabilityReason: null,
  }));

  if (pbrArm) {
    out.push(buildPosition({
      label: 'PBR (ceiling — NEVER PLAY)',
      edgeBB: pbrEdgeBB,
      pbrEdgeBB,
      isCeiling: true,
      // PBR's own exploitability is STRUCTURALLY MAXIMAL — it is a best response, so it is
      // maximally counterable — but "maximal" is not a number, and writing one here would
      // be inventing the very quantity WS-326 is gated on.
      exploitabilityReason:
        'structurally maximal (a best response is maximally exploitable), but unquantified — '
        + 'measuring it needs the WS-326 simulator like every other strategy.',
    }));
  }

  for (const [key, label] of [
    ['engineRaked', 'engine advice (rake modelled)'],
    ['engineUnraked', 'engine advice (no rake)'],
    ['passive', 'baseline: always fold/check'],
  ]) {
    const arm = arms?.[key];
    if (!arm || !arm.n) continue;
    out.push(buildPosition({ label, edgeBB: arm.edgeBB, pbrEdgeBB }));
  }

  return out;
};
