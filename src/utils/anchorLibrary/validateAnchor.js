/**
 * validateAnchor.js — Runtime validation for ExploitAnchor + sibling records
 *
 * Part of the anchorLibrary module. See `CLAUDE.md` for rules (mandatory read).
 *
 * Validates:
 *   - `ExploitAnchor` against `schema-delta.md` §2 + inherited VillainAssumption v1.1
 *   - `AnchorObservation` against §3.1
 *   - `PerceptionPrimitive` against §3.3
 *
 * Returns `{ ok: boolean, errors: string[] }`. `ok: true` means the record is usable.
 * `ok: false` means the record is malformed and MUST NOT be persisted or consumed.
 *
 * Anchor schemaVersion is compound semver per `gate4-p3-decisions.md` §1:
 *   `<base-version>-anchor-v<extension-version>` (e.g. `"1.1-anchor-v1.0"`)
 *
 * Per §1 of gate4-p3-decisions:
 *   1. Parse schemaVersion as (baseVersion, extensionVersion) tuple.
 *   2. Check baseVersion is a supported VillainAssumption version.
 *   3. Check extensionVersion ≤ current max extension version.
 *   4. Delegate inherited field validation to `assumptionEngine/validator.js`.
 *   5. Apply EAL extension validator to the anchor-specific fields.
 *
 * Pure module — no IO.
 */

// ───────────────────────────────────────────────────────────────────────────
// Version constants
// ───────────────────────────────────────────────────────────────────────────

export const ANCHOR_SCHEMA_VERSION = '1.1-anchor-v1.0';
export const ANCHOR_EXTENSION_VERSION = '1.0';
export const SUPPORTED_BASE_VERSIONS = Object.freeze(['1.1']);

// ───────────────────────────────────────────────────────────────────────────
// Enum values (from schema-delta §2)
// ───────────────────────────────────────────────────────────────────────────

const POLARITIES = ['overfold', 'overbluff', 'overcall', 'over-raise', 'under-defend'];
const TIERS = [0, 1, 2];
const GTO_METHODS = ['MDF', 'pot-odds-equilibrium', 'hand-down-equity', 'range-balance'];
const ORIGIN_SOURCES = ['ai-authored', 'owner-promoted', 'ai-derived-from-search'];
const ANCHOR_STATUSES = ['active', 'expiring', 'retired', 'suppressed', 'candidate'];
const OBSERVATION_STATUSES = ['open', 'promoted', 'archived'];
const OBSERVATION_ORIGINS = ['owner-captured', 'matcher-system'];
const STREETS = ['preflop', 'flop', 'turn', 'river'];

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

const ok = (errors = []) => ({ ok: errors.length === 0, errors });
const fail = (...errors) => ok(errors);

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const inRange = (v, lo, hi) => isFiniteNumber(v) && v >= lo && v <= hi;
const isStringOfLen = (v, min = 1) => typeof v === 'string' && v.length >= min;
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isArrayOf = (v, pred) => Array.isArray(v) && v.every(pred);
const isISO8601 = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

// ───────────────────────────────────────────────────────────────────────────
// Schema version parsing
// ───────────────────────────────────────────────────────────────────────────

/**
 * Parse a compound anchor schemaVersion string.
 *
 * Format: `<base-version>-anchor-v<extension-version>` (e.g. `"1.1-anchor-v1.0"`).
 *
 * @param {string} version
 * @returns {{baseVersion: string, extensionVersion: string} | null} null if malformed
 */
export const parseSchemaVersion = (version) => {
  if (typeof version !== 'string') return null;
  const match = version.match(/^(\d+\.\d+)-anchor-v(\d+\.\d+)$/);
  if (!match) return null;
  return { baseVersion: match[1], extensionVersion: match[2] };
};

const validateSchemaVersion = (version) => {
  const parsed = parseSchemaVersion(version);
  if (!parsed) {
    return fail(`schemaVersion "${version}" is not a valid compound semver (expected "<base>-anchor-v<ext>")`);
  }
  const errors = [];
  if (!SUPPORTED_BASE_VERSIONS.includes(parsed.baseVersion)) {
    errors.push(`baseVersion "${parsed.baseVersion}" not in supported list [${SUPPORTED_BASE_VERSIONS.join(', ')}]`);
  }
  // Extension version: compare major.minor numerically; current max is ANCHOR_EXTENSION_VERSION
  const [currentMajor, currentMinor] = ANCHOR_EXTENSION_VERSION.split('.').map(Number);
  const [extMajor, extMinor] = parsed.extensionVersion.split('.').map(Number);
  if (extMajor > currentMajor || (extMajor === currentMajor && extMinor > currentMinor)) {
    errors.push(`extensionVersion "${parsed.extensionVersion}" exceeds current max "${ANCHOR_EXTENSION_VERSION}"`);
  }
  return ok(errors);
};

// ───────────────────────────────────────────────────────────────────────────
// ExploitAnchor field validators
// ───────────────────────────────────────────────────────────────────────────

const validateLineStep = (step, idx) => {
  const errors = [];
  if (!isPlainObject(step)) return fail(`lineSequence[${idx}] is not an object`);
  if (!STREETS.includes(step.street)) {
    errors.push(`lineSequence[${idx}].street "${step.street}" not in ${STREETS.join('/')}`);
  }
  // heroAction / villainAction / boardCondition are optional; if present they must be objects
  if (step.heroAction !== undefined && !isPlainObject(step.heroAction)) {
    errors.push(`lineSequence[${idx}].heroAction must be object`);
  }
  if (step.villainAction !== undefined && !isPlainObject(step.villainAction)) {
    errors.push(`lineSequence[${idx}].villainAction must be object`);
  }
  if (step.boardCondition !== undefined && !isPlainObject(step.boardCondition)) {
    errors.push(`lineSequence[${idx}].boardCondition must be object`);
  }
  return ok(errors);
};

const validateGtoBaseline = (baseline) => {
  if (!isPlainObject(baseline)) return fail('gtoBaseline is not an object');
  const errors = [];
  if (!GTO_METHODS.includes(baseline.method)) {
    errors.push(`gtoBaseline.method "${baseline.method}" not in ${GTO_METHODS.join('/')}`);
  }
  if (!inRange(baseline.referenceRate, 0, 1)) {
    errors.push(`gtoBaseline.referenceRate must be in [0, 1]; got ${baseline.referenceRate}`);
  }
  if (!isFiniteNumber(baseline.referenceEv)) {
    errors.push(`gtoBaseline.referenceEv must be a finite number`);
  }
  if (baseline.notes !== undefined && typeof baseline.notes !== 'string') {
    errors.push(`gtoBaseline.notes, if present, must be a string`);
  }
  return ok(errors);
};

const validateEvDecomposition = (decomp) => {
  if (!isPlainObject(decomp)) return fail('evDecomposition is not an object');
  const errors = [];
  if (!inRange(decomp.statAttributable, 0, 1)) {
    errors.push(`evDecomposition.statAttributable must be in [0, 1]; got ${decomp.statAttributable}`);
  }
  if (!inRange(decomp.perceptionAttributable, 0, 1)) {
    errors.push(`evDecomposition.perceptionAttributable must be in [0, 1]; got ${decomp.perceptionAttributable}`);
  }
  // I-EAL-5 equivalent: statAttributable + perceptionAttributable = 1.0 (±0.01)
  const sum = (decomp.statAttributable || 0) + (decomp.perceptionAttributable || 0);
  if (Math.abs(sum - 1.0) > 0.01) {
    errors.push(`evDecomposition sum must equal 1.0 (±0.01); got ${sum.toFixed(4)}`);
  }
  return ok(errors);
};

const validateRetirementCondition = (cond) => {
  if (!isPlainObject(cond)) return fail('retirementCondition is not an object');
  const errors = [];
  if (typeof cond.method !== 'string') {
    errors.push(`retirementCondition.method must be a string`);
  }
  if (cond.params !== undefined && !isPlainObject(cond.params)) {
    errors.push(`retirementCondition.params, if present, must be an object`);
  }
  return ok(errors);
};

const validateOrigin = (origin) => {
  if (!isPlainObject(origin)) return fail('origin is not an object');
  const errors = [];
  if (!ORIGIN_SOURCES.includes(origin.source)) {
    errors.push(`origin.source "${origin.source}" not in ${ORIGIN_SOURCES.join('/')}`);
  }
  if (!isISO8601(origin.authoredAt)) {
    errors.push(`origin.authoredAt must be ISO8601`);
  }
  if (origin.authoredBy !== undefined && origin.authoredBy !== null && !isStringOfLen(origin.authoredBy)) {
    errors.push(`origin.authoredBy, if present, must be a non-empty string`);
  }
  if (origin.sourceObservationIds !== undefined && !isArrayOf(origin.sourceObservationIds, isStringOfLen)) {
    errors.push(`origin.sourceObservationIds, if present, must be array of strings`);
  }
  return ok(errors);
};

// ───────────────────────────────────────────────────────────────────────────
// validateAnchor — the ExploitAnchor validator (anchor-specific fields only)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Validate an ExploitAnchor's anchor-specific extension fields + compound semver.
 *
 * Note: this validator does NOT re-validate inherited v1.1 VillainAssumption fields.
 * Those are validated by the `assumptionEngine/validator.js` inheritance contract.
 * Per `gate4-p3-decisions.md` §1 rule 4, a consumer that wants full-record validation
 * must invoke both validators:
 *
 *   const baseResult = validateAssumption(anchor); // from assumptionEngine
 *   const extResult = validateAnchor(anchor);       // from this module
 *
 * If either returns `{ ok: false }`, the record is not usable.
 *
 * Rationale: separation of concerns. This module owns the EAL extension; it does not
 * own the inherited schema. Combining them here would duplicate exploit-deviation's
 * validator maintenance.
 *
 * @param {unknown} anchor
 * @returns {{ok: boolean, errors: string[]}}
 */
export const validateAnchor = (anchor) => {
  if (!isPlainObject(anchor)) return fail('anchor is not an object');

  const errors = [];

  // 1. schemaVersion (compound semver)
  const versionResult = validateSchemaVersion(anchor.schemaVersion);
  if (!versionResult.ok) errors.push(...versionResult.errors.map((e) => `schemaVersion: ${e}`));

  // 2. archetypeName
  if (!isStringOfLen(anchor.archetypeName, 3)) {
    errors.push(`archetypeName must be a string of length ≥ 3`);
  }

  // 3. polarity
  if (!POLARITIES.includes(anchor.polarity)) {
    errors.push(`polarity "${anchor.polarity}" not in ${POLARITIES.join('/')}`);
  }

  // 4. tier
  if (!TIERS.includes(anchor.tier)) {
    errors.push(`tier "${anchor.tier}" not in ${TIERS.join('/')}`);
  }

  // 5. lineSequence
  if (!Array.isArray(anchor.lineSequence)) {
    errors.push(`lineSequence must be an array`);
  } else if (anchor.lineSequence.length < 1 || anchor.lineSequence.length > 3) {
    errors.push(`lineSequence must have 1..3 steps; got ${anchor.lineSequence.length}`);
  } else {
    anchor.lineSequence.forEach((step, idx) => {
      const stepResult = validateLineStep(step, idx);
      if (!stepResult.ok) errors.push(...stepResult.errors);
    });
  }

  // 6. perceptionPrimitiveIds
  if (!Array.isArray(anchor.perceptionPrimitiveIds)) {
    errors.push(`perceptionPrimitiveIds must be an array`);
  } else if (anchor.perceptionPrimitiveIds.length < 1) {
    errors.push(`perceptionPrimitiveIds must have ≥ 1 entry (I-EAL-2 referential integrity)`);
  } else if (!anchor.perceptionPrimitiveIds.every(isStringOfLen)) {
    errors.push(`perceptionPrimitiveIds entries must be non-empty strings`);
  }

  // 7. gtoBaseline
  const gtoResult = validateGtoBaseline(anchor.gtoBaseline);
  if (!gtoResult.ok) errors.push(...gtoResult.errors);

  // 8. evDecomposition (I-EAL-5 sum-to-1)
  const decompResult = validateEvDecomposition(anchor.evDecomposition);
  if (!decompResult.ok) errors.push(...decompResult.errors);

  // 9. retirementCondition
  const retireResult = validateRetirementCondition(anchor.retirementCondition);
  if (!retireResult.ok) errors.push(...retireResult.errors);

  // 10. origin
  const originResult = validateOrigin(anchor.origin);
  if (!originResult.ok) errors.push(...originResult.errors);

  // 11. status (if present — inherited VillainAssumption field, but we surface it
  // here for anchor-library-specific statuses like 'candidate' / 'suppressed')
  if (anchor.status !== undefined && !ANCHOR_STATUSES.includes(anchor.status)) {
    errors.push(`status "${anchor.status}" not in ${ANCHOR_STATUSES.join('/')}`);
  }

  return ok(errors);
};

// ───────────────────────────────────────────────────────────────────────────
// validateAnchorObservation — §3.1
// ───────────────────────────────────────────────────────────────────────────

/**
 * Validate an AnchorObservation record.
 *
 * Schema per `schema-delta.md` §3.1. Owner-captured or matcher-system-generated.
 * Per I-EAL-8: `note` ≤ 280 chars.
 *
 * @param {unknown} obs
 * @returns {{ok: boolean, errors: string[]}}
 */
export const validateAnchorObservation = (obs) => {
  if (!isPlainObject(obs)) return fail('observation is not an object');

  const errors = [];

  if (!isStringOfLen(obs.id, 1)) errors.push(`id must be non-empty string`);
  if (obs.schemaVersion !== 'anchor-obs-v1.0') {
    errors.push(`schemaVersion must be "anchor-obs-v1.0"; got "${obs.schemaVersion}"`);
  }
  if (!isISO8601(obs.createdAt)) errors.push(`createdAt must be ISO8601`);
  if (!isStringOfLen(obs.handId, 1)) errors.push(`handId must be non-empty string`);
  if (obs.streetKey !== undefined && !STREETS.includes(obs.streetKey)) {
    errors.push(`streetKey "${obs.streetKey}" not in ${STREETS.join('/')}`);
  }
  if (obs.actionIndex !== undefined && !Number.isInteger(obs.actionIndex)) {
    errors.push(`actionIndex, if present, must be integer`);
  }
  // note: optional for matcher-system; required for owner-captured with content
  if (obs.note !== undefined && obs.note !== null) {
    if (typeof obs.note !== 'string') {
      errors.push(`note, if present, must be string`);
    } else if (obs.note.length > 280) {
      errors.push(`note length ${obs.note.length} exceeds 280-char limit (I-EAL-8)`);
    }
  }
  if (!Array.isArray(obs.ownerTags)) {
    errors.push(`ownerTags must be an array`);
  } else if (!obs.ownerTags.every((t) => typeof t === 'string')) {
    errors.push(`ownerTags entries must be strings`);
  }
  if (obs.status !== undefined && !OBSERVATION_STATUSES.includes(obs.status)) {
    errors.push(`status "${obs.status}" not in ${OBSERVATION_STATUSES.join('/')}`);
  }
  // origin (new field per WRITERS.md W-AO-1/2 contract, signal-separation I-WR-2)
  if (obs.origin !== undefined && !OBSERVATION_ORIGINS.includes(obs.origin)) {
    errors.push(`origin "${obs.origin}" not in ${OBSERVATION_ORIGINS.join('/')}`);
  }
  // contributesToCalibration (per Q2-A + red line #9)
  if (obs.contributesToCalibration !== undefined && typeof obs.contributesToCalibration !== 'boolean') {
    errors.push(`contributesToCalibration, if present, must be boolean`);
  }
  if (obs.promotedToCandidateId !== undefined && !isStringOfLen(obs.promotedToCandidateId)) {
    errors.push(`promotedToCandidateId, if present, must be non-empty string`);
  }

  return ok(errors);
};

// ───────────────────────────────────────────────────────────────────────────
// validatePerceptionPrimitive — §3.3
// ───────────────────────────────────────────────────────────────────────────

/**
 * Validate a PerceptionPrimitive record.
 *
 * Per `schema-delta.md` §3.3. Primitives carry a Bayesian validityScore posterior
 * + dependent-anchor count (I-EAL-9 invariant).
 *
 * @param {unknown} prim
 * @returns {{ok: boolean, errors: string[]}}
 */
export const validatePerceptionPrimitive = (prim) => {
  if (!isPlainObject(prim)) return fail('primitive is not an object');

  const errors = [];

  if (!isStringOfLen(prim.id, 1)) errors.push(`id must be non-empty string`);
  if (!/^PP-\d{2,}$/.test(prim.id || '')) {
    errors.push(`id "${prim.id}" must match "PP-NN" format`);
  }
  if (!isStringOfLen(prim.name, 3)) errors.push(`name must be string of length ≥ 3`);
  if (!isStringOfLen(prim.description, 10)) {
    errors.push(`description must be string of length ≥ 10`);
  }
  if (!Array.isArray(prim.appliesToStyles)) {
    errors.push(`appliesToStyles must be an array`);
  }
  if (!isStringOfLen(prim.cognitiveStep, 3)) {
    errors.push(`cognitiveStep must be string of length ≥ 3`);
  }
  if (!isPlainObject(prim.validityScore)) {
    errors.push(`validityScore must be an object`);
  } else {
    if (!inRange(prim.validityScore.pointEstimate, 0, 1)) {
      errors.push(`validityScore.pointEstimate must be in [0, 1]`);
    }
    if (!isPlainObject(prim.validityScore.credibleInterval)) {
      errors.push(`validityScore.credibleInterval must be an object`);
    } else {
      const ci = prim.validityScore.credibleInterval;
      if (!inRange(ci.lower, 0, 1)) errors.push(`credibleInterval.lower must be in [0, 1]`);
      if (!inRange(ci.upper, 0, 1)) errors.push(`credibleInterval.upper must be in [0, 1]`);
      if (isFiniteNumber(ci.lower) && isFiniteNumber(ci.upper) && ci.lower > ci.upper) {
        errors.push(`credibleInterval.lower (${ci.lower}) must be ≤ upper (${ci.upper})`);
      }
    }
    if (prim.validityScore.dependentAnchorCount !== undefined
        && !Number.isInteger(prim.validityScore.dependentAnchorCount)) {
      errors.push(`validityScore.dependentAnchorCount, if present, must be integer`);
    }
    if (prim.validityScore.dependentAnchorCount < 0) {
      errors.push(`validityScore.dependentAnchorCount must be ≥ 0`);
    }
  }

  return ok(errors);
};
