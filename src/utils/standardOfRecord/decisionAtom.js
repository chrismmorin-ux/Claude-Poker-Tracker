/**
 * decisionAtom.js — one row per decision, and the layer intermediates beneath it (WS-324/328).
 *
 * An ATOM is the primary record. Aggregates are VIEWS over atoms, never the record — an
 * aggregate saved instead of derived is a question decided in advance that future-us is
 * allowed to ask.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE COST ASYMMETRY THAT SETS THE CAPTURE POLICY.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Capturing an extra field costs bytes. NOT capturing it costs a re-run — and by then the
 * engine has moved, so the re-run does not reproduce the old number and the comparison being
 * attempted is lost entirely. The loss is TOTAL, not partial. Hence over-capture by design.
 *
 * But the sharper principle is: RECONSTRUCT WHERE YOU CAN, CAPTURE WHERE YOU CANNOT. Anything
 * deterministic should be replayable rather than stored, which is why `seeds` is the highest-
 * value field here and why the compressed layer representation is the default rather than the
 * exception.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * FULL vs COMPRESSED INTERMEDIATES, and why the sampling rate is stored rather than inferred.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * A range layer's full intermediate is a 169-cell vector PER OPPONENT PER DECISION — roughly
 * 10-50x the size of the rest of the atom. Storing it for every decision makes ablation exact
 * and makes 100k hands unwieldy; storing it for none makes some future questions permanently
 * unanswerable.
 *
 * So: every layer emits a COMPRESSED summary always, and a recorded FRACTION also emit the
 * full value. The sampling rate lives on the atom SET manifest (`buildAtomSetManifest`), not
 * inferred from how many full values happen to be present. Inferring it would conflate three
 * different facts — a low rate, a run that crashed halfway, and a filter that dropped rows —
 * and those have opposite meanings for any number computed downstream.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY `basis` RIDES ALONG WITH TRUTH.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * `holdingKnowledge/provenance.js` established the axis: a range narrowed down a COUNTERFACTUAL
 * branch ("suppose villain calls") cannot be scored against the hand villain turned up. That is
 * a category error, not a miscalibration, and `holdingTruth` refuses it structurally rather
 * than by asking callers to be careful. An atom that recorded truth WITHOUT basis would let
 * that refusal be bypassed at the point where it matters most — after the fact, when nobody
 * remembers which branch produced the range. So basis travels with the truth or the truth does
 * not get written.
 */

import {
  SOR_SCHEMAS,
  SOR_SCHEMA_VERSIONS,
  StandardOfRecordError,
  checkAgainstSchema,
} from './schemas.js';
import { isStackLayer } from './stack.js';

/** How a layer's intermediate was recorded. */
export const VALUE_KINDS = Object.freeze(['full', 'compressed']);

/** Mirrors holdingKnowledge/provenance.js BASIS. Re-stated, never redefined. */
export const ATOM_BASIS = Object.freeze(['observed', 'hypothesized']);

/**
 * Build one layer emission.
 *
 * @param {Object} params
 * @param {string} params.layer - one of STACK_LAYERS
 * @param {*} params.value - the intermediate. Shape depends on `valueKind`.
 * @param {string} params.valueKind - 'full' | 'compressed'
 * @param {Object|null} params.provenance - how this intermediate came to be. For a range layer
 *   this is holdingKnowledge provenance, carrying narrowingCount and basis counts.
 * @param {string[]} params.assumptions - the layer's named assumptions AS THEY WERE at this
 *   decision. Stamped per-atom rather than read from the surface later, because the surface
 *   can be edited and the atom cannot.
 */
export const buildLayerEmission = ({
  layer,
  value = null,
  valueKind = 'compressed',
  provenance = null,
  assumptions = [],
} = {}) => {
  if (!isStackLayer(layer)) {
    throw new StandardOfRecordError(`decisionAtom: unknown layer "${layer}"`, { layer });
  }
  if (!VALUE_KINDS.includes(valueKind)) {
    throw new StandardOfRecordError(
      `decisionAtom: valueKind must be ${VALUE_KINDS.join(' | ')}, got "${valueKind}"`,
      { layer, valueKind },
    );
  }
  return Object.freeze({
    layer,
    value,
    valueKind,
    provenance,
    assumptions: Object.freeze([...assumptions]),
  });
};

/**
 * Decide whether THIS decision carries full intermediates.
 *
 * Deterministic in the atom's own identity rather than random, so a re-run with the same seed
 * samples the same decisions. A `Math.random()` here would make the sampled subset differ
 * between two runs that are supposed to be identical, and "which decisions carry full data"
 * would silently become another unseeded source.
 */
export const samplesFull = (atomId, rate) => {
  if (!(rate > 0)) return false;
  if (rate >= 1) return true;
  let h = 0;
  for (let i = 0; i < atomId.length; i += 1) {
    h = (h * 31 + atomId.charCodeAt(i)) >>> 0;
  }
  return (h % 10000) / 10000 < rate;
};

/**
 * Ground truth attached to an atom, with its basis.
 *
 * Throws on a missing or unknown basis. Defaulting it would reintroduce exactly the ambiguity
 * the axis exists to remove — the same reason `narrowHolding` throws.
 */
export const buildAtomTruth = ({ revealed = null, basis, revealedAt = null } = {}) => {
  if (!ATOM_BASIS.includes(basis)) {
    throw new StandardOfRecordError(
      `decisionAtom: truth.basis must be one of ${ATOM_BASIS.join(' | ')}, got "${basis}". `
      + 'Scoring a hypothesized branch against a revealed hand is a category error, not a '
      + 'miscalibration, so the basis is required rather than defaulted.',
      { basis },
    );
  }
  return Object.freeze({ revealed, basis, revealedAt });
};

/**
 * Build a Decision Atom, validated against the registered schema.
 *
 * Throws rather than returning a partial object — the same rule every loader in this
 * directory follows. A half-built atom that reaches the store is indistinguishable later from
 * a decision that genuinely had no rule fire.
 */
export const buildDecisionAtom = ({
  atomId,
  situationKey,
  carried = {},
  surfaceId,
  action,
  ruleId = null,
  warrant = null,
  layers = [],
  outcome = null,
  skipReason = null,
  // v2
  alternativeScores = null,
  rulesMatchedAndLost = [],
  beliefState = null,
  truth = null,
  seeds = {},
  actorSeat = null,
  actorRole = null,
  wallTimeMs = null,
  tokens = null,
  // v3 (WS-431) — atomId's parts, kept; run coordinates; deliberate-omission discriminator.
  playerId = null,
  handId = null,
  order = null,
  stable = null,
  omissions = null,
} = {}) => {
  const atom = {
    schemaVersion: SOR_SCHEMA_VERSIONS.decisionAtom,
    atomId,
    situationKey,
    carried,
    surfaceId,
    action,
    ruleId,
    warrant,
    layers: [...layers],
    outcome,
    skipReason,
    alternativeScores,
    rulesMatchedAndLost: [...rulesMatchedAndLost],
    beliefState,
    truth,
    seeds,
    actorSeat,
    actorRole,
    wallTimeMs,
    tokens,
    playerId,
    handId,
    order,
    stable,
    omissions,
  };

  const problems = checkAgainstSchema(atom, SOR_SCHEMAS.decisionAtom, { label: 'decisionAtom' });
  if (problems.length > 0) {
    throw new StandardOfRecordError(
      `decisionAtom is not well-formed: ${problems.join('; ')}`,
      { problems, atomId },
    );
  }
  if (truth !== null && !ATOM_BASIS.includes(truth?.basis)) {
    throw new StandardOfRecordError(
      'decisionAtom: truth was supplied without a valid `basis`. Build it with buildAtomTruth.',
      { atomId },
    );
  }
  return Object.freeze(atom);
};

/**
 * The atom SET manifest — what is true of the whole run rather than of one decision.
 *
 * `fullSampleRate` lives here for the reason given in the header. `seatOccupancy` lives here
 * because who sat, when, with what stack, and for how long is a property of the TABLE OVER
 * TIME, not of any single decision — and without it "does this card earn more against a table
 * that has been together two hours" is permanently unanswerable.
 */
export const buildAtomSetManifest = ({
  atomSetId,
  surfaceId,
  fullSampleRate = 0,
  seatOccupancy = [],
  atomCount = 0,
  anchorGeneration = 1,
} = {}) => {
  if (!atomSetId || typeof atomSetId !== 'string') {
    throw new StandardOfRecordError('atomSetId is required');
  }
  if (!(fullSampleRate >= 0 && fullSampleRate <= 1)) {
    throw new StandardOfRecordError(
      `fullSampleRate must be in [0,1], got ${fullSampleRate}. It is RECORDED rather than `
      + 'inferred from how many full values are present, because a low rate, a crashed run, '
      + 'and a filter that dropped rows are three different facts with opposite meanings.',
      { fullSampleRate },
    );
  }
  return Object.freeze({
    atomSetId,
    surfaceId,
    fullSampleRate,
    seatOccupancy: Object.freeze([...seatOccupancy]),
    atomCount,
    anchorGeneration,
  });
};

/**
 * One seat-occupancy span. Answers the table-history question above.
 */
export const buildOccupancySpan = ({
  seat, playerId = null, stackBB = null, joinedAtHand, leftAtHand = null,
} = {}) => Object.freeze({
  seat, playerId, stackBB, joinedAtHand, leftAtHand,
  handsSeated: leftAtHand === null ? null : leftAtHand - joinedAtHand,
});
