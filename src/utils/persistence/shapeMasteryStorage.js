/**
 * shapeMasteryStorage.js — IDB CRUD for the v26 `shapeMastery` + `shapeLessons` stores.
 *
 * SLS Stream D (2026-05-14, SPR-081 / WS-040).
 *
 * `shapeMastery` is a singleton per user (keyPath: userId). The store is
 * created at v26 by migrateV26 (additive, no seed).
 *
 * `shapeLessons` is an append-only completion-history store (keyPath: id,
 * 3 indexes: by_userId / by_descriptorId / by_completedAt). Records keyed
 * by `${userId}:${lessonId}:${completedAt}` per Decision 2 (B) ratified at
 * SPR-081 plan-mode.
 *
 * The persistence hook (`useShapeMasteryPersistence`) is the only caller from
 * app code. Read-only sprint scope (SPR-081) only wires get/put for shapeMastery
 * + list for shapeLessons; appendLessonCompletion ships so the fast-follow WS
 * can wire RECORD_DRILL_OUTCOME without touching this module.
 *
 * Mirrors `telemetryConsentStore.js` singleton pattern + `assumptionStorage.js`
 * batch + cursor patterns.
 */

import {
  readTx,
  writeTx,
  SHAPE_MASTERY_STORE_NAME,
  SHAPE_LESSONS_STORE_NAME,
  GUEST_USER_ID,
  log,
  logError,
} from './database';

// =============================================================================
// shapeMastery — singleton per user
// =============================================================================

/**
 * Read the shapeMastery record for a given user.
 *
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export const getShapeMastery = async (userId = GUEST_USER_ID) => {
  try {
    const record = await readTx(SHAPE_MASTERY_STORE_NAME, (store) => store.get(userId));
    log(record
      ? `Shape mastery loaded for user ${userId}`
      : `No shape mastery record found for user ${userId}`);
    return record ?? null;
  } catch (error) {
    logError('Error in getShapeMastery:', error);
    throw error;
  }
};

/**
 * Write (upsert) the shapeMastery record. Must include a userId field; the
 * store's keyPath rejects records without one.
 *
 * @param {Object} record
 * @returns {Promise<void>}
 */
export const putShapeMastery = async (record) => {
  if (!record || typeof record.userId !== 'string') {
    throw new Error('putShapeMastery requires a record with a string userId field');
  }
  try {
    await writeTx(SHAPE_MASTERY_STORE_NAME, (store) => store.put(record));
    log(`Shape mastery saved for user ${record.userId}`);
  } catch (error) {
    logError('Error in putShapeMastery:', error);
    throw error;
  }
};

/**
 * Delete the shapeMastery record for a user. Reserved for testing / dev reset.
 * Production flow uses DISENROLL_SHAPE_MASTERY which preserves the record per
 * I-SM-6; only an explicit RESET_SHAPE_MASTERY would land here, and the latter
 * is deferred to the fast-follow WS.
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
export const deleteShapeMastery = async (userId = GUEST_USER_ID) => {
  try {
    await writeTx(SHAPE_MASTERY_STORE_NAME, (store) => store.delete(userId));
    log(`Shape mastery deleted for user ${userId}`);
  } catch (error) {
    logError('Error in deleteShapeMastery:', error);
    throw error;
  }
};

// =============================================================================
// shapeLessons — append-only per-completion history
// =============================================================================

/**
 * Append a single lesson completion record. Records are immutable once
 * written (no `updateLessonCompletion` — corrections happen via a new
 * record with a later completedAt, or a recalibrate writer that resets
 * the descriptor, not the history).
 *
 * @param {Object} record — { userId, lessonId, descriptorId, completedAt,
 *   accuracy, totalSpots, correctSpots, sessionIncognito, schemaVersion }.
 *   `id` is derived if absent.
 * @returns {Promise<void>}
 */
export const appendLessonCompletion = async (record) => {
  if (
    !record ||
    typeof record.userId !== 'string' ||
    typeof record.lessonId !== 'string' ||
    typeof record.descriptorId !== 'string' ||
    typeof record.completedAt !== 'number'
  ) {
    throw new Error(
      'appendLessonCompletion requires { userId, lessonId, descriptorId, completedAt } as the minimum shape',
    );
  }
  const id = record.id || `${record.userId}:${record.lessonId}:${record.completedAt}`;
  const full = { ...record, id };
  try {
    await writeTx(SHAPE_LESSONS_STORE_NAME, (store) => store.put(full));
    log(`Shape lesson completion appended: ${id}`);
  } catch (error) {
    logError('Error in appendLessonCompletion:', error);
    throw error;
  }
};

/**
 * List lesson completions for a given user. Returns in descending-completedAt
 * order (most recent first) by default.
 *
 * @param {string} userId
 * @param {Object} [options]
 * @param {string} [options.descriptorId] — optionally filter by descriptor.
 * @param {number} [options.since] — optionally filter completedAt >= since (ms epoch).
 * @returns {Promise<Array>} records, most-recent first.
 */
export const listLessonCompletions = async (userId = GUEST_USER_ID, options = {}) => {
  const { descriptorId, since } = options;
  try {
    // Use the by_userId index so we never scan completions for other users.
    const result = await readTx(SHAPE_LESSONS_STORE_NAME, (store) => store.index('by_userId').getAll(userId));
    let records = Array.isArray(result) ? result : [];
    if (typeof descriptorId === 'string') {
      records = records.filter((r) => r.descriptorId === descriptorId);
    }
    if (typeof since === 'number') {
      records = records.filter((r) => r.completedAt >= since);
    }
    records.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    return records;
  } catch (error) {
    logError('Error in listLessonCompletions:', error);
    throw error;
  }
};

/**
 * Clear all lesson completions for a user. Reserved for testing / dev reset
 * + future RESET_SHAPE_MASTERY writer scope.
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
export const clearLessonCompletions = async (userId = GUEST_USER_ID) => {
  try {
    const records = await listLessonCompletions(userId);
    if (records.length === 0) return;
    await writeTx(SHAPE_LESSONS_STORE_NAME, (store) => {
      for (const r of records) store.delete(r.id);
    });
    log(`Cleared ${records.length} lesson completions for user ${userId}`);
  } catch (error) {
    logError('Error in clearLessonCompletions:', error);
    throw error;
  }
};
