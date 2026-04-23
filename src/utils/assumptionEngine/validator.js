/**
 * validator.js — Runtime validation for VillainAssumption + boundary inputs
 *
 * Part of the assumptionEngine module. See `CLAUDE.md` for rules (mandatory read).
 *
 * Two kinds of validation:
 *
 *   1. **Assumption-object validation** — validates a persisted or produced
 *      VillainAssumption against schema v1.1. Used by:
 *        - Producer (before emitting assumption output; ensures schema integrity)
 *        - Storage layer (before writing to IDB; ensures persisted records are valid)
 *        - Migration (after upgrade; verifies migration produced a valid v1.1 shape)
 *
 *   2. **Boundary payload validation** — validates untrusted input at the extension
 *      boundary per R-10.1 payload-invariants doctrine. Rejects malformed state
 *      early rather than propagating corruption into the engine.
 *
 * All validator functions return { ok: boolean, errors: string[] }.
 * `ok: true` means the input is usable. `ok: false` means the input is malformed
 * and MUST NOT be consumed by downstream logic.
 *
 * Pure module — no imports from outside assumptionEngine/ except assumptionTypes.
 */

import {
  PREDICATE_KEYS,
  DEPRECATED_PREDICATES,
  DEVIATION_TYPES,
  EMOTIONAL_TRIGGER_TYPES,
  STREETS,
  POSITIONS,
  TEXTURES,
  HERO_LINE_TYPES,
  VILLAIN_STYLES,
  ASSUMPTION_STATUS,
  SURFACES,
  OPERATOR_TARGETS,
  CLAIM_OPERATORS,
  PRIOR_TYPES,
  SCHEMA_VERSION,
  SCHEMA_VERSION_HISTORY,
} from './assumptionTypes';

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

const ok = (errors = []) => ({ ok: errors.length === 0, errors });
const fail = (...errors) => ok(errors);

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const inRange = (v, lo, hi) => isFiniteNumber(v) && v >= lo && v <= hi;
const isStringOfLen = (v, min = 1) => typeof v === 'string' && v.length >= min;
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// ───────────────────────────────────────────────────────────────────────────
// §1.1 Scope
// ───────────────────────────────────────────────────────────────────────────

export const validateScope = (scope) => {
  const errors = [];
  if (!isPlainObject(scope)) return fail('scope: must be a plain object');

  if (!STREETS.includes(scope.street)) {
    errors.push(`scope.street: must be one of ${STREETS.join(', ')}`);
  }
  if (!POSITIONS.includes(scope.position)) {
    errors.push(`scope.position: must be one of ${POSITIONS.join(', ')}`);
  }
  if (!TEXTURES.includes(scope.texture)) {
    errors.push(`scope.texture: must be one of ${TEXTURES.join(', ')}`);
  }
  if (!Array.isArray(scope.sprRange) || scope.sprRange.length !== 2
      || !isFiniteNumber(scope.sprRange[0]) || !isFiniteNumber(scope.sprRange[1])
      || scope.sprRange[0] > scope.sprRange[1] || scope.sprRange[0] < 0) {
    errors.push('scope.sprRange: must be [min, max] with 0 ≤ min ≤ max');
  }
  if (!Array.isArray(scope.betSizeRange) || scope.betSizeRange.length !== 2
      || !isFiniteNumber(scope.betSizeRange[0]) || !isFiniteNumber(scope.betSizeRange[1])
      || scope.betSizeRange[0] > scope.betSizeRange[1] || scope.betSizeRange[0] < 0) {
    errors.push('scope.betSizeRange: must be [min, max] with 0 ≤ min ≤ max');
  }
  if (!Number.isInteger(scope.playersToAct) || scope.playersToAct < 0) {
    errors.push('scope.playersToAct: must be a non-negative integer');
  }
  if (scope.heroLineType !== undefined && !HERO_LINE_TYPES.includes(scope.heroLineType)) {
    errors.push(`scope.heroLineType: must be one of ${HERO_LINE_TYPES.join(', ')}`);
  }
  if (scope.villainFearRange !== undefined) {
    if (!Array.isArray(scope.villainFearRange) || scope.villainFearRange.length !== 2
        || !inRange(scope.villainFearRange[0], 0, 1) || !inRange(scope.villainFearRange[1], 0, 1)
        || scope.villainFearRange[0] > scope.villainFearRange[1]) {
      errors.push('scope.villainFearRange: must be [min, max] in [0, 1]');
    }
  }
  if (scope.villainGreedRange !== undefined) {
    if (!Array.isArray(scope.villainGreedRange) || scope.villainGreedRange.length !== 2
        || !inRange(scope.villainGreedRange[0], 0, 1) || !inRange(scope.villainGreedRange[1], 0, 1)
        || scope.villainGreedRange[0] > scope.villainGreedRange[1]) {
      errors.push('scope.villainGreedRange: must be [min, max] in [0, 1]');
    }
  }
  if (scope.activationFrequency !== undefined && !inRange(scope.activationFrequency, 0, 1)) {
    errors.push('scope.activationFrequency: must be in [0, 1]');
  }
  return ok(errors);
};

// ───────────────────────────────────────────────────────────────────────────
// §1.2 Evidence
// ───────────────────────────────────────────────────────────────────────────

export const validateEvidence = (evidence) => {
  const errors = [];
  if (!isPlainObject(evidence)) return fail('evidence: must be a plain object');

  if (!Number.isInteger(evidence.sampleSize) || evidence.sampleSize < 0) {
    errors.push('evidence.sampleSize: must be a non-negative integer');
  }
  if (!Number.isInteger(evidence.observationCount) || evidence.observationCount < 0) {
    errors.push('evidence.observationCount: must be a non-negative integer');
  }
  if (evidence.observationCount > evidence.sampleSize) {
    errors.push('evidence.observationCount: cannot exceed sampleSize');
  }
  if (!inRange(evidence.pointEstimate, 0, 1)) {
    errors.push('evidence.pointEstimate: must be in [0, 1]');
  }
  if (!isPlainObject(evidence.credibleInterval)
      || !inRange(evidence.credibleInterval.lower, 0, 1)
      || !inRange(evidence.credibleInterval.upper, 0, 1)
      || evidence.credibleInterval.lower > evidence.credibleInterval.upper
      || evidence.credibleInterval.level !== 0.95) {
    errors.push('evidence.credibleInterval: must be { lower, upper, level: 0.95 } with lower ≤ upper ⊆ [0,1]');
  }
  if (!isPlainObject(evidence.prior)
      || !PRIOR_TYPES.includes(evidence.prior.type)
      || !isFiniteNumber(evidence.prior.alpha) || evidence.prior.alpha <= 0
      || !isFiniteNumber(evidence.prior.beta) || evidence.prior.beta <= 0) {
    errors.push(`evidence.prior: must be { type: one of ${PRIOR_TYPES.join('|')}, alpha>0, beta>0 }`);
  }
  if (!inRange(evidence.posteriorConfidence, 0, 1)) {
    errors.push('evidence.posteriorConfidence: must be in [0, 1]');
  }
  if (!isStringOfLen(evidence.lastUpdated)) {
    errors.push('evidence.lastUpdated: must be an ISO8601 string');
  }
  if (!isFiniteNumber(evidence.decayHalfLife) || evidence.decayHalfLife <= 0) {
    errors.push('evidence.decayHalfLife: must be a positive number (days)');
  }
  return ok(errors);
};

// ───────────────────────────────────────────────────────────────────────────
// §1.3 Stability (v1.1 allows null subscores)
// ───────────────────────────────────────────────────────────────────────────

const isSubscore = (v) => v === null || inRange(v, 0, 1);

export const validateStability = (stability) => {
  const errors = [];
  if (!isPlainObject(stability)) return fail('stability: must be a plain object');

  if (!isSubscore(stability.acrossSessions)) {
    errors.push('stability.acrossSessions: must be null or in [0, 1]');
  }
  if (!isSubscore(stability.acrossTextures)) {
    errors.push('stability.acrossTextures: must be null or in [0, 1]');
  }
  if (!isSubscore(stability.acrossStackDepths)) {
    errors.push('stability.acrossStackDepths: must be null or in [0, 1]');
  }
  if (!isSubscore(stability.acrossStreetContext)) {
    errors.push('stability.acrossStreetContext: must be null or in [0, 1]');
  }
  if (stability.compositeScore !== null && !inRange(stability.compositeScore, 0, 1)) {
    errors.push('stability.compositeScore: must be null or in [0, 1]');
  }
  if (!Number.isInteger(stability.nonNullSubscoreCount)
      || stability.nonNullSubscoreCount < 0
      || stability.nonNullSubscoreCount > 4) {
    errors.push('stability.nonNullSubscoreCount: must be integer in [0, 4]');
  }
  return ok(errors);
};

// ───────────────────────────────────────────────────────────────────────────
// §1.4 Recognizability
// ───────────────────────────────────────────────────────────────────────────

export const validateRecognizability = (r) => {
  const errors = [];
  if (!isPlainObject(r)) return fail('recognizability: must be a plain object');

  if (!isStringOfLen(r.triggerDescription)) {
    errors.push('recognizability.triggerDescription: must be a non-empty string');
  }
  if (!Number.isInteger(r.conditionsCount) || r.conditionsCount < 0) {
    errors.push('recognizability.conditionsCount: must be a non-negative integer');
  }
  if (!['low', 'medium', 'high'].includes(r.heroCognitiveLoad)) {
    errors.push('recognizability.heroCognitiveLoad: must be one of low, medium, high');
  }
  if (!inRange(r.score, 0, 1)) {
    errors.push('recognizability.score: must be in [0, 1]');
  }
  return ok(errors);
};

// ───────────────────────────────────────────────────────────────────────────
// §1.5 Consequence
// ───────────────────────────────────────────────────────────────────────────

export const validateConsequence = (c) => {
  const errors = [];
  if (!isPlainObject(c)) return fail('consequence: must be a plain object');

  if (!isStringOfLen(c.deviationId)) {
    errors.push('consequence.deviationId: must be a non-empty string');
  }
  if (!DEVIATION_TYPES.includes(c.deviationType)) {
    errors.push(`consequence.deviationType: must be one of ${DEVIATION_TYPES.join(', ')}`);
  }
  if (!isPlainObject(c.expectedDividend)
      || !isFiniteNumber(c.expectedDividend.mean)
      || !isFiniteNumber(c.expectedDividend.sd)
      || c.expectedDividend.sd < 0
      || !isFiniteNumber(c.expectedDividend.sharpe)
      || c.expectedDividend.sharpe < 0
      || c.expectedDividend.unit !== 'bb per 100 trigger firings') {
    errors.push('consequence.expectedDividend: must be { mean, sd≥0, sharpe≥0, unit: "bb per 100 trigger firings" }');
  }
  if (!isStringOfLen(c.affectedHands, 0)) {
    errors.push('consequence.affectedHands: must be a string');
  }
  return ok(errors);
};

// ───────────────────────────────────────────────────────────────────────────
// §1.6 CounterExploit
// ───────────────────────────────────────────────────────────────────────────

export const validateCounterExploit = (ce) => {
  const errors = [];
  if (!isPlainObject(ce)) return fail('counterExploit: must be a plain object');

  if (!inRange(ce.resistanceScore, 0, 1)) {
    errors.push('counterExploit.resistanceScore: must be in [0, 1]');
  }
  if (!inRange(ce.resistanceConfidence, 0, 1)) {
    errors.push('counterExploit.resistanceConfidence: must be in [0, 1]');
  }
  if (!Array.isArray(ce.resistanceSources)) {
    errors.push('counterExploit.resistanceSources: must be an array');
  } else {
    for (let i = 0; i < ce.resistanceSources.length; i++) {
      const src = ce.resistanceSources[i];
      if (!isPlainObject(src)
          || !isStringOfLen(src.factor)
          || !isFiniteNumber(src.weight)
          || !isFiniteNumber(src.contribution)
          || !Number.isInteger(src.observationCount) || src.observationCount < 0) {
        errors.push(`counterExploit.resistanceSources[${i}]: must be { factor, weight, contribution, observationCount≥0 }`);
      }
    }
  }
  if (!isFiniteNumber(ce.adjustmentCost) || ce.adjustmentCost < 0) {
    errors.push('counterExploit.adjustmentCost: must be a non-negative number');
  }
  if (!isFiniteNumber(ce.asymmetricPayoff)) {
    errors.push('counterExploit.asymmetricPayoff: must be a finite number');
  }
  return ok(errors);
};

// ───────────────────────────────────────────────────────────────────────────
// §1.7 Operator (with v1.1 suppresses array)
// ───────────────────────────────────────────────────────────────────────────

export const validateOperator = (op) => {
  const errors = [];
  if (!isPlainObject(op)) return fail('operator: must be a plain object');

  if (!OPERATOR_TARGETS.includes(op.target)) {
    errors.push(`operator.target: must be one of ${OPERATOR_TARGETS.join(', ')}`);
  }
  if (!isPlainObject(op.nodeSelector)) {
    errors.push('operator.nodeSelector: must be a plain object');
  }
  if (!isPlainObject(op.transform)) {
    errors.push('operator.transform: must be a plain object');
  } else {
    if (!isPlainObject(op.transform.actionDistributionDelta)) {
      errors.push('operator.transform.actionDistributionDelta: must be a plain object');
    } else {
      // Verify deltas sum ≈ 0 (schema §1.7 rule)
      let sum = 0;
      for (const key of Object.keys(op.transform.actionDistributionDelta)) {
        const v = op.transform.actionDistributionDelta[key];
        if (!isFiniteNumber(v)) {
          errors.push(`operator.transform.actionDistributionDelta.${key}: must be finite number`);
        } else {
          sum += v;
        }
      }
      if (Math.abs(sum) > 0.001) {
        errors.push(`operator.transform.actionDistributionDelta: deltas must sum to 0 (got ${sum.toFixed(4)})`);
      }
    }
  }
  if (typeof op.currentDial !== 'number' || !inRange(op.currentDial, 0, 1)) {
    errors.push('operator.currentDial: must be in [0, 1]');
  }
  if (!inRange(op.dialFloor, 0, 1)) {
    errors.push('operator.dialFloor: must be in [0, 1]');
  }
  if (!inRange(op.dialCeiling, 0, 1)) {
    errors.push('operator.dialCeiling: must be in [0, 1]');
  }
  if (op.dialFloor > op.dialCeiling) {
    errors.push('operator.dialFloor: must be ≤ dialCeiling');
  }
  if (!Array.isArray(op.suppresses)) {
    errors.push('operator.suppresses: must be an array (empty allowed)');
  } else {
    for (let i = 0; i < op.suppresses.length; i++) {
      if (!isStringOfLen(op.suppresses[i])) {
        errors.push(`operator.suppresses[${i}]: must be a non-empty string assumption id`);
      }
    }
  }
  return ok(errors);
};

// ───────────────────────────────────────────────────────────────────────────
// §1.8 Narrative
// ───────────────────────────────────────────────────────────────────────────

export const validateNarrative = (n) => {
  const errors = [];
  if (!isPlainObject(n)) return fail('narrative: must be a plain object');

  if (!isStringOfLen(n.humanStatement)) errors.push('narrative.humanStatement: non-empty string');
  if (!isStringOfLen(n.citationShort)) errors.push('narrative.citationShort: non-empty string');
  if (!isStringOfLen(n.citationLong)) errors.push('narrative.citationLong: non-empty string');
  if (!isStringOfLen(n.teachingPattern)) errors.push('narrative.teachingPattern: non-empty string');
  if (n.analogAnchor !== undefined && typeof n.analogAnchor !== 'string') {
    errors.push('narrative.analogAnchor: must be a string if present');
  }
  if (n.concept !== undefined && typeof n.concept !== 'string') {
    errors.push('narrative.concept: must be a string if present');
  }
  return ok(errors);
};

// ───────────────────────────────────────────────────────────────────────────
// §1.9 EmotionalTrigger (optional)
// ───────────────────────────────────────────────────────────────────────────

export const validateEmotionalTrigger = (t) => {
  if (t === undefined || t === null) return ok();
  const errors = [];
  if (!isPlainObject(t)) return fail('emotionalTrigger: must be a plain object if present');

  if (!EMOTIONAL_TRIGGER_TYPES.includes(t.type)) {
    errors.push(`emotionalTrigger.type: must be one of ${EMOTIONAL_TRIGGER_TYPES.join(', ')}`);
  }
  if (!isPlainObject(t.condition)) {
    errors.push('emotionalTrigger.condition: must be a plain object');
  }
  if (!isFiniteNumber(t.activationMultiplier) || t.activationMultiplier < 0) {
    errors.push('emotionalTrigger.activationMultiplier: must be a non-negative number');
  }
  if (!isStringOfLen(t.citableReason)) {
    errors.push('emotionalTrigger.citableReason: must be a non-empty string');
  }
  return ok(errors);
};

// ───────────────────────────────────────────────────────────────────────────
// §1.10 Quality composite (v1.1)
// ───────────────────────────────────────────────────────────────────────────

export const validateQuality = (q) => {
  const errors = [];
  if (!isPlainObject(q)) return fail('quality: must be a plain object');

  if (!inRange(q.composite, 0, 1)) {
    errors.push('quality.composite: must be in [0, 1]');
  }
  if (typeof q.actionableInDrill !== 'boolean') {
    errors.push('quality.actionableInDrill: must be boolean');
  }
  if (typeof q.actionableLive !== 'boolean') {
    errors.push('quality.actionableLive: must be boolean');
  }
  if (typeof q.actionable !== 'boolean') {
    errors.push('quality.actionable: must be boolean (legacy alias; typically = actionableLive)');
  }
  if (!isPlainObject(q.thresholds)) {
    errors.push('quality.thresholds: must be a plain object');
  }
  if (!isPlainObject(q.gatesPassed)) {
    errors.push('quality.gatesPassed: must be a plain object');
  }
  // `reason` is optional
  if (q.reason !== undefined && typeof q.reason !== 'string') {
    errors.push('quality.reason: must be a string if present');
  }
  return ok(errors);
};

// ───────────────────────────────────────────────────────────────────────────
// §1 AssumptionClaim
// ───────────────────────────────────────────────────────────────────────────

export const validateClaim = (claim) => {
  const errors = [];
  if (!isPlainObject(claim)) return fail('claim: must be a plain object');

  if (!PREDICATE_KEYS.includes(claim.predicate) && !DEPRECATED_PREDICATES.includes(claim.predicate)) {
    errors.push(`claim.predicate: must be one of ${PREDICATE_KEYS.join(', ')} (or a deprecated key for legacy records)`);
  }
  if (!CLAIM_OPERATORS.includes(claim.operator)) {
    errors.push(`claim.operator: must be one of ${CLAIM_OPERATORS.join(', ')}`);
  }
  if (claim.operator === 'in_range') {
    if (!Array.isArray(claim.threshold) || claim.threshold.length !== 2
        || !isFiniteNumber(claim.threshold[0]) || !isFiniteNumber(claim.threshold[1])
        || claim.threshold[0] > claim.threshold[1]) {
      errors.push('claim.threshold: must be [lo, hi] with lo ≤ hi for in_range operator');
    }
  } else if (!isFiniteNumber(claim.threshold)) {
    errors.push('claim.threshold: must be a finite number for non-range operators');
  }
  const scopeCheck = validateScope(claim.scope);
  if (!scopeCheck.ok) errors.push(...scopeCheck.errors.map((e) => `claim.${e}`));
  return ok(errors);
};

// ───────────────────────────────────────────────────────────────────────────
// Full VillainAssumption
// ───────────────────────────────────────────────────────────────────────────

export const validateAssumption = (a) => {
  const errors = [];
  if (!isPlainObject(a)) return fail('assumption: must be a plain object');

  if (!isStringOfLen(a.id)) errors.push('assumption.id: non-empty string');
  if (a.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`assumption.schemaVersion: must be ${SCHEMA_VERSION} (got ${a.schemaVersion}) — run migrations first`);
  }
  if (!isStringOfLen(a.villainId) && a.villainId !== '_hero') {
    errors.push('assumption.villainId: non-empty string (or sentinel "_hero")');
  }
  if (!ASSUMPTION_STATUS.includes(a.status)) {
    errors.push(`assumption.status: must be one of ${ASSUMPTION_STATUS.join(', ')}`);
  }

  // Compose per-section validations
  const claim = validateClaim(a.claim);
  if (!claim.ok) errors.push(...claim.errors);
  const evidence = validateEvidence(a.evidence);
  if (!evidence.ok) errors.push(...evidence.errors);
  const stability = validateStability(a.stability);
  if (!stability.ok) errors.push(...stability.errors);
  const recognizability = validateRecognizability(a.recognizability);
  if (!recognizability.ok) errors.push(...recognizability.errors);
  const consequence = validateConsequence(a.consequence);
  if (!consequence.ok) errors.push(...consequence.errors);
  const counterExploit = validateCounterExploit(a.counterExploit);
  if (!counterExploit.ok) errors.push(...counterExploit.errors);
  const operator = validateOperator(a.operator);
  if (!operator.ok) errors.push(...operator.errors);
  const narrative = validateNarrative(a.narrative);
  if (!narrative.ok) errors.push(...narrative.errors);
  const trigger = validateEmotionalTrigger(a.emotionalTrigger);
  if (!trigger.ok) errors.push(...trigger.errors);
  const quality = validateQuality(a.quality);
  if (!quality.ok) errors.push(...quality.errors);

  if (!isPlainObject(a.validation)) {
    errors.push('assumption.validation: must be a plain object');
  }
  return ok(errors);
};

// ───────────────────────────────────────────────────────────────────────────
// Boundary payload validation (R-10.1)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Validate an untrusted boundary payload from the sidebar extension.
 *
 * Per R-10.1, malformed payloads are rejected at the boundary, not propagated
 * into the engine. This check is defensive — it verifies the shape required
 * for assumption production, not the full sidebar state.
 *
 * Required fields:
 *   - villainId: non-empty string
 *   - gameState: { street, spr, nodeId? }
 *   - rangeWeights: Float64Array(169) or array of 169 numbers
 */
export const validateExtensionPayload = (payload) => {
  const errors = [];
  if (!isPlainObject(payload)) return fail('payload: must be a plain object');

  if (!isStringOfLen(payload.villainId)) {
    errors.push('payload.villainId: non-empty string required');
  }
  if (!isPlainObject(payload.gameState)) {
    errors.push('payload.gameState: must be a plain object');
  } else {
    if (!STREETS.includes(payload.gameState.street)) {
      errors.push(`payload.gameState.street: must be one of ${STREETS.join(', ')}`);
    }
    if (!isFiniteNumber(payload.gameState.spr) || payload.gameState.spr < 0) {
      errors.push('payload.gameState.spr: must be non-negative finite number');
    }
    if (payload.gameState.nodeId !== undefined && !isStringOfLen(payload.gameState.nodeId)) {
      errors.push('payload.gameState.nodeId: must be non-empty string if present');
    }
  }

  const rw = payload.rangeWeights;
  const isValidArr = rw instanceof Float64Array && rw.length === 169;
  const isValidList = Array.isArray(rw) && rw.length === 169 && rw.every(isFiniteNumber);
  if (!isValidArr && !isValidList) {
    errors.push('payload.rangeWeights: must be Float64Array(169) or number[169]');
  }

  if (payload.villainStyle !== undefined && !VILLAIN_STYLES.includes(payload.villainStyle)) {
    errors.push(`payload.villainStyle: must be one of ${VILLAIN_STYLES.join(', ')}`);
  }

  return ok(errors);
};

// ───────────────────────────────────────────────────────────────────────────
// Helpers for testing / external consumers
// ───────────────────────────────────────────────────────────────────────────

/**
 * Returns true if `record` is a persisted-assumption shape that needs migration
 * before validation against the current schema. Callers should route through
 * `migratePersistedAssumption` first, then re-validate.
 */
export const needsMigration = (record) => {
  if (!isPlainObject(record)) return false;
  return SCHEMA_VERSION_HISTORY.includes(record.schemaVersion) && record.schemaVersion !== SCHEMA_VERSION;
};
