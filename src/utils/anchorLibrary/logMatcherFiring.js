/**
 * logMatcherFiring.js — W-AO-2 writer for `anchorObservations` store
 *
 * Per `docs/projects/exploit-anchor-library/WRITERS.md` §`anchorObservations`
 * W-AO-2 (matcher-system-observation-writer).
 *
 * Pure factory. Takes matcher-fire context + enrollment state, returns either
 *   - `{ ok: true, record }` — a fully-formed system-origin AnchorObservation
 *     ready for the persistence layer / reducer dispatch, OR
 *   - `{ ok: true, record: null }` — short-circuit when not enrolled (per
 *     I-WR-5 enrollment gate; matcher fires for advice purposes but evidence
 *     accrual is dropped before write), OR
 *   - `{ ok: false, errors }` — input/context validation failed.
 *
 * Idempotence (per WRITERS.md W-AO-2 "If matcher fires twice on the same
 * `(anchorId, handId, streetKey)` tuple within a session, the second write is
 * dropped"): the deterministic id `obs:<handId>:matcher:<anchorId>:<streetKey>`
 * makes duplicate fires collapse on dispatch (reducer's spread-merge keeps
 * latest record at the same id key).
 *
 * Signal-separation (AP-08, I-WR-2): records are stamped
 * `origin: 'matcher-system'`. The Calibration Dashboard renders matcher-system
 * and owner-captured observations as separate series; never arithmetically
 * fused.
 *
 * AP-07 / Red Line #8 (live-surface contamination): this writer produces a
 * data-store record only. It does NOT render anything. The live anchor badge
 * shows `archetypeName + confidence dial` only — the firing metric here lives
 * exclusively in study-mode surfaces.
 */

import {
  ANCHOR_OBSERVATION_SCHEMA_VERSION,
  OBSERVATION_ORIGINS,
} from '../../constants/anchorLibraryConstants';

const VALID_STREETS = new Set(['preflop', 'flop', 'turn', 'river']);

/**
 * @typedef {Object} LogMatcherFiringInput
 * @property {string} anchorId               — required; the anchor that fired
 * @property {string} handId                 — required; the hand the fire belongs to
 * @property {string} streetKey              — required; preflop|flop|turn|river
 * @property {Object} [firingMetrics]        — optional; metrics captured at fire-time
 * @property {number} [firingMetrics.confidence]  — anchor.evidence.pointEstimate at fire-time
 * @property {string} [createdAt]            — ISO8601; defaults to nowFn()
 */

/**
 * @typedef {Object} LogMatcherFiringContext
 * @property {'enrolled'|'not-enrolled'} observation_enrollment_state
 * @property {function(): string} [nowFn]   — injected ISO8601 source (test-friendly)
 */

/**
 * Build a system-origin AnchorObservation record for a matcher fire. Returns
 * `{ ok: true, record: null }` (short-circuit) when not enrolled — caller
 * should dispatch nothing on a null record (I-WR-5).
 *
 * @param {LogMatcherFiringInput} input
 * @param {LogMatcherFiringContext} context
 * @returns {{ok: true, record: Object|null} | {ok: false, errors: string[]}}
 */
export const logMatcherFiring = (input, context) => {
  if (!input || typeof input !== 'object') {
    return { ok: false, errors: ['input must be an object'] };
  }
  if (!context || typeof context !== 'object') {
    return { ok: false, errors: ['context must be an object'] };
  }

  const errors = [];

  if (typeof input.anchorId !== 'string' || input.anchorId.length === 0) {
    errors.push('anchorId is required and must be a non-empty string');
  }
  if (typeof input.handId !== 'string' || input.handId.length === 0) {
    errors.push('handId is required and must be a non-empty string');
  }
  if (typeof input.streetKey !== 'string' || !VALID_STREETS.has(input.streetKey)) {
    errors.push(`streetKey must be one of preflop/flop/turn/river; got ${input.streetKey}`);
  }

  const enrollment = context.observation_enrollment_state;
  if (enrollment !== 'enrolled' && enrollment !== 'not-enrolled') {
    errors.push(`context.observation_enrollment_state must be "enrolled" or "not-enrolled"; got ${enrollment}`);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // I-WR-5 enrollment gate — short-circuit before composing the record.
  // Caller dispatches nothing on null record.
  if (enrollment !== 'enrolled') {
    return { ok: true, record: null };
  }

  const nowFn = typeof context.nowFn === 'function'
    ? context.nowFn
    : () => new Date().toISOString();
  const createdAt = typeof input.createdAt === 'string' ? input.createdAt : nowFn();

  // Deterministic id makes duplicate fires collapse at dispatch (reducer's
  // spread-merge keyed by id keeps the latest record). WRITERS.md W-AO-2
  // idempotence: "the second write is dropped".
  const id = `obs:${input.handId}:matcher:${input.anchorId}:${input.streetKey}`;

  // Compose the firingMetrics block. v1 carries only at-fire-time confidence;
  // ev-realized vs predicted is post-hand evaluation work (deferred — would
  // require hand outcome to compute). Scoping to single field keeps the
  // dispatch lightweight while preserving the metrics shape.
  const firingMetrics = {
    confidence: typeof input.firingMetrics?.confidence === 'number'
      ? input.firingMetrics.confidence
      : null,
  };

  const record = {
    id,
    schemaVersion: ANCHOR_OBSERVATION_SCHEMA_VERSION,
    createdAt,
    handId: input.handId,
    streetKey: input.streetKey,
    ownerTags: [], // matcher-system observations don't carry owner tags
    status: 'active',
    origin: OBSERVATION_ORIGINS.MATCHER_SYSTEM,
    contributesToCalibration: true, // I-WR-5 already gated above; if we reached
                                    // this point, observation contributes
    anchorId: input.anchorId,
    firingMetrics,
  };

  return { ok: true, record };
};
