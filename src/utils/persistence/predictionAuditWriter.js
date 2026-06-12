/**
 * predictionAuditWriter.js — PMC Phase 5a primitive (WS-177 / SPR-068).
 *
 * Writes the per-hand `predictionAudit` field that captures
 * `{predictedDistribution, observedAction, modelVersion}` so PMC can measure
 * model-vs-reality without "theory grading theory."
 *
 * See `.claude/projects/predictive-model-calibration.md` §Phase 5a +
 * §Architectural primitives.
 *
 * AP-PMC-04 (charter §Anti-pattern refusals): hero entries on the
 * `observedAction` side MUST drop `evRealized` at write time. This is
 * SCHEMA-LEVEL enforcement — the writer strips the field regardless of
 * caller intent so the data contract does not depend on copy discipline.
 *
 * AP-PMC-04 only governs `evRealized` on hero observedAction entries.
 *   - Villain observedAction entries CAN carry evRealized (no hero-grading
 *     concern; villain hand outcomes are not user identity).
 *   - predictedDistribution entries (hero or villain) are model OUTPUT and
 *     are not subject to the strip.
 *
 * modelVersion is composed from rangeEngine PROFILE_VERSION + exploitEngine
 * ENGINE_VERSION (Q3 ratified — granular per-engine bumps; matches charter
 * Stage E ask #3).
 */

import {
  readTx,
  updateTx,
  STORE_NAME,
  log,
  logError,
} from './database';
import { PROFILE_VERSION } from '../rangeEngine';
import { ENGINE_VERSION } from '../../constants/runtimeVersions';

// =============================================================================
// VERSION COMPOSITION
// =============================================================================

/**
 * Composes the modelVersion field for a predictionAudit payload.
 * Format: `range-${PROFILE_VERSION}+engine-${ENGINE_VERSION}`.
 *
 * Granular per-engine bumps let later analysis distinguish range-engine
 * changes from exploit-engine changes (charter Stage E ask #3).
 */
export const composeModelVersion = () =>
  `range-${PROFILE_VERSION}+engine-${ENGINE_VERSION}`;

// =============================================================================
// SANITIZATION (AP-PMC-04 schema-level enforcement)
// =============================================================================

/**
 * Returns a NEW observedAction entry with `evRealized` removed iff the entry
 * is a hero entry. Pure; non-mutating.
 *
 * AP-PMC-04 schema-level binding: hero entries cannot persist evRealized.
 */
const stripHeroEvRealized = (entry) => {
  if (!entry || typeof entry !== 'object') return entry;
  if (entry.actor !== 'hero') return entry;
  if (!('evRealized' in entry)) return entry;
  // eslint-disable-next-line no-unused-vars
  const { evRealized, ...rest } = entry;
  return rest;
};

/**
 * Returns a sanitized copy of a predictionAudit payload with AP-PMC-04
 * enforcement applied to observedAction entries. Pure; non-mutating.
 *
 * Throws if payload is structurally invalid (missing modelVersion or
 * non-array predictedDistribution / observedAction).
 */
export const sanitizePredictionAudit = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('predictionAudit payload must be an object');
  }
  if (typeof payload.modelVersion !== 'string' || !payload.modelVersion) {
    throw new Error('predictionAudit payload missing modelVersion');
  }
  if (!Array.isArray(payload.predictedDistribution)) {
    throw new Error('predictionAudit payload.predictedDistribution must be an array');
  }
  if (!Array.isArray(payload.observedAction)) {
    throw new Error('predictionAudit payload.observedAction must be an array');
  }
  return {
    predictedDistribution: payload.predictedDistribution,
    observedAction: payload.observedAction.map(stripHeroEvRealized),
    modelVersion: payload.modelVersion,
  };
};

// =============================================================================
// WRITE / READ API
// =============================================================================

/**
 * Writes (or overwrites) the predictionAudit field on an existing hands
 * record. AP-PMC-04 sanitization is applied unconditionally before write.
 *
 * @param {number} handId
 * @param {Object} payload — { predictedDistribution, observedAction, modelVersion }
 * @returns {Promise<void>} resolves on commit; rejects on get/put failure.
 */
export const writePredictionAudit = async (handId, payload) => {
  const sanitized = sanitizePredictionAudit(payload);
  try {
    await updateTx(STORE_NAME, handId, (hand) => {
      if (!hand) throw new Error(`Hand ${handId} not found`);
      hand.predictionAudit = sanitized;
      return hand;
    });
    log(`predictionAudit written for hand ${handId}`);
  } catch (error) {
    logError('writePredictionAudit failed:', error);
    throw error;
  }
};

/**
 * Reads the predictionAudit field from an existing hands record.
 * Returns null if the hand exists but has no field, or if the hand is missing.
 *
 * @param {number} handId
 * @returns {Promise<Object|null>}
 */
export const readPredictionAudit = async (handId) => {
  try {
    const hand = await readTx(STORE_NAME, (store) => store.get(handId));
    return hand?.predictionAudit ?? null;
  } catch (error) {
    logError('readPredictionAudit get failed:', error);
    throw error;
  }
};
