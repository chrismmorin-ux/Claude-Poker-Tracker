/**
 * captureObservation.js — W-AO-1 writer for `anchorObservations` store
 *
 * Per `WRITERS.md` §`anchorObservations` — W-AO-1 (hand-replay-capture-writer).
 *
 * Pure function: takes capture-modal inputs + persona-context, returns a fully-formed
 * `AnchorObservation` record ready for the persistence layer to write. Phase 6 reducer
 * + persistence hook handle the actual IDB transaction (W-AO-1 invariants enforced
 * here at the boundary; transaction atomicity enforced by caller).
 *
 * Invariants enforced at this boundary (per WRITERS.md §`anchorObservations`):
 *   - **I-EAL-8** — `note` ≤ 280 chars (NOTE_MAX_LENGTH).
 *   - **I-WR-2** — authored vs evidence separation: never writes matcher-system fields.
 *   - **I-WR-5** — enrollment gate: when `observation_enrollment_state === 'not-enrolled'`,
 *     `contributesToCalibration` is forced to `false` regardless of caller input.
 *   - **I-WR-6** — incognito per-observation guarantee (red line #9): incognito flag
 *     is always honored; it overrides default-on-when-enrolled to `false`.
 *   - **schema-delta §3.1** — required fields populated; optional fields left undefined
 *     when not supplied (rather than null) to match validateAnchorObservation accepting
 *     undefined.
 *   - **schema-delta §3.1.1** — tag vocabulary: at least one fixed-enum tag required;
 *     custom tags normalized to kebab-case-lowercase.
 *
 * Pure module — no IO, no side effects.
 */

import {
  ANCHOR_OBSERVATION_SCHEMA_VERSION,
  NOTE_MAX_LENGTH,
  OBSERVATION_ORIGINS,
} from '../../constants/anchorLibraryConstants';

import { normalizeTagSet, hasAtLeastOneFixedTag } from './observationTags';

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} CaptureObservationInput
 * @property {string} handId                       — required; hand being tagged
 * @property {string} [streetKey]                  — optional ('preflop' | 'flop' | 'turn' | 'river')
 * @property {number} [actionIndex]                — optional; integer ≥ 0
 * @property {string} [note]                       — optional; max 280 chars
 * @property {Array<string|unknown>} ownerTags     — required ≥ 1 fixed-enum tag after normalization
 * @property {boolean} [contributesToCalibration]  — opt-out default true; ignored when not-enrolled
 * @property {string} [createdAt]                  — ISO8601; defaults to caller-injected nowFn() output
 * @property {number} [observationIndex=0]         — used to build deterministic id "obs:<handId>:<idx>"
 */

/**
 * @typedef {Object} CaptureObservationContext
 * @property {'enrolled'|'not-enrolled'} observation_enrollment_state
 *           — global enrollment state per persona attribute
 * @property {function(): string} [nowFn]
 *           — injected ISO8601 timestamp source (test-friendly); defaults to (() => new Date().toISOString())
 */

/**
 * @typedef {Object} CaptureResult
 * @property {true} ok
 * @property {Object} record  — AnchorObservation ready for persistence
 *
 * OR
 *
 * @typedef {Object} CaptureError
 * @property {false} ok
 * @property {string[]} errors
 */

/**
 * Build an AnchorObservation record from capture-modal inputs.
 *
 * Returns `{ ok: true, record }` on success or `{ ok: false, errors }` on validation failure.
 * Caller (capture modal Save handler) checks `ok` and either dispatches the persistence
 * write or surfaces errors to UI.
 *
 * @param {CaptureObservationInput} input
 * @param {CaptureObservationContext} context
 * @returns {CaptureResult | CaptureError}
 */
export const captureObservation = (input, context) => {
  if (!input || typeof input !== 'object') {
    return { ok: false, errors: ['input must be an object'] };
  }
  if (!context || typeof context !== 'object') {
    return { ok: false, errors: ['context must be an object'] };
  }

  const errors = [];

  // ─── handId (required) ────────────────────────────────────────────────
  if (typeof input.handId !== 'string' || input.handId.length === 0) {
    errors.push('handId is required and must be a non-empty string');
  }

  // ─── streetKey (optional, must be valid if present) ───────────────────
  const VALID_STREETS = new Set(['preflop', 'flop', 'turn', 'river']);
  if (input.streetKey !== undefined && !VALID_STREETS.has(input.streetKey)) {
    errors.push(`streetKey "${input.streetKey}" must be one of preflop/flop/turn/river`);
  }

  // ─── actionIndex (optional integer ≥ 0) ──────────────────────────────
  if (input.actionIndex !== undefined) {
    if (!Number.isInteger(input.actionIndex) || input.actionIndex < 0) {
      errors.push(`actionIndex must be a non-negative integer; got ${input.actionIndex}`);
    }
  }

  // ─── note (optional, max 280 chars per I-EAL-8) ──────────────────────
  let note;
  if (input.note !== undefined && input.note !== null) {
    if (typeof input.note !== 'string') {
      errors.push('note, if present, must be a string');
    } else if (input.note.length > NOTE_MAX_LENGTH) {
      errors.push(`note length ${input.note.length} exceeds ${NOTE_MAX_LENGTH}-char limit (I-EAL-8)`);
    } else {
      note = input.note;
    }
  }

  // ─── ownerTags (required ≥ 1 fixed-enum) ─────────────────────────────
  let normalizedTags = [];
  if (!Array.isArray(input.ownerTags)) {
    errors.push('ownerTags is required and must be an array');
  } else {
    const tagResult = normalizeTagSet(input.ownerTags);
    normalizedTags = tagResult.normalized;
    if (tagResult.rejected.length > 0) {
      // Surface rejected-tag reasons but don't block save unless no fixed tag remains
      tagResult.rejected.forEach((rej) => {
        errors.push(`ownerTags: rejected entry — ${rej.reason}`);
      });
    }
    if (!hasAtLeastOneFixedTag(normalizedTags)) {
      errors.push('ownerTags must include at least one fixed-enum tag (per schema-delta §3.1.1)');
    }
  }

  // ─── enrollment context (required to determine contributesToCalibration) ─
  const enrollment = context.observation_enrollment_state;
  if (enrollment !== 'enrolled' && enrollment !== 'not-enrolled') {
    errors.push(`context.observation_enrollment_state must be "enrolled" or "not-enrolled"; got ${enrollment}`);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // ─── Compute contributesToCalibration per Q2-A + I-WR-5 + I-WR-6 ────
  // I-WR-5: when not-enrolled, force contributesToCalibration to false regardless of input.
  // I-WR-6 (red line #9): when enrolled, default is true (Q2-A opt-out); explicit
  //                       `contributesToCalibration: false` from caller (incognito toggle on)
  //                       overrides to false. The toggle is structurally preserved.
  let contributesToCalibration;
  if (enrollment === 'not-enrolled') {
    contributesToCalibration = false; // I-WR-5
  } else if (input.contributesToCalibration === false) {
    contributesToCalibration = false; // I-WR-6 — owner clicked Incognito
  } else {
    contributesToCalibration = true;  // Q2-A opt-out default
  }

  // ─── Compose timestamp + id ──────────────────────────────────────────
  const nowFn = typeof context.nowFn === 'function'
    ? context.nowFn
    : () => new Date().toISOString();
  const createdAt = typeof input.createdAt === 'string' ? input.createdAt : nowFn();
  const observationIndex = Number.isInteger(input.observationIndex) && input.observationIndex >= 0
    ? input.observationIndex
    : 0;
  const id = `obs:${input.handId}:${observationIndex}`;

  // ─── Build record ────────────────────────────────────────────────────
  const record = {
    id,
    schemaVersion: ANCHOR_OBSERVATION_SCHEMA_VERSION,
    createdAt,
    handId: input.handId,
    ownerTags: normalizedTags,
    status: 'open',
    origin: OBSERVATION_ORIGINS.OWNER_CAPTURED,
    contributesToCalibration,
  };

  // Optional fields — only include when present (validateAnchorObservation
  // accepts undefined but rejects null for note; consistent omit-on-absent
  // keeps the persisted record clean).
  if (input.streetKey !== undefined) record.streetKey = input.streetKey;
  if (input.actionIndex !== undefined) record.actionIndex = input.actionIndex;
  if (note !== undefined) record.note = note;

  return { ok: true, record };
};
