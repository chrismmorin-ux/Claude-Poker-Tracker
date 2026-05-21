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
  getDB,
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
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SHAPE_MASTERY_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(SHAPE_MASTERY_STORE_NAME);
      const request = objectStore.get(userId);

      request.onsuccess = () => {
        const record = request.result;
        if (record) {
          log(`Shape mastery loaded for user ${userId}`);
          resolve(record);
        } else {
          log(`No shape mastery record found for user ${userId}`);
          resolve(null);
        }
      };

      request.onerror = (event) => {
        logError('Failed to get shape mastery:', event.target.error);
        reject(event.target.error);
      };
    });
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
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SHAPE_MASTERY_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(SHAPE_MASTERY_STORE_NAME);
      const request = objectStore.put(record);

      request.onsuccess = () => {
        log(`Shape mastery saved for user ${record.userId}`);
        resolve();
      };

      request.onerror = (event) => {
        logError('Failed to save shape mastery:', event.target.error);
        reject(event.target.error);
      };
    });
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
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SHAPE_MASTERY_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(SHAPE_MASTERY_STORE_NAME);
      const request = objectStore.delete(userId);

      request.onsuccess = () => {
        log(`Shape mastery deleted for user ${userId}`);
        resolve();
      };

      request.onerror = (event) => {
        logError('Failed to delete shape mastery:', event.target.error);
        reject(event.target.error);
      };
    });
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
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SHAPE_LESSONS_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(SHAPE_LESSONS_STORE_NAME);
      const request = objectStore.put(full);

      request.onsuccess = () => {
        log(`Shape lesson completion appended: ${id}`);
        resolve();
      };

      request.onerror = (event) => {
        logError('Failed to append lesson completion:', event.target.error);
        reject(event.target.error);
      };
    });
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
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SHAPE_LESSONS_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(SHAPE_LESSONS_STORE_NAME);
      // Use the by_userId index so we never scan completions for other users.
      const index = objectStore.index('by_userId');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        let records = Array.isArray(request.result) ? request.result : [];
        if (typeof descriptorId === 'string') {
          records = records.filter((r) => r.descriptorId === descriptorId);
        }
        if (typeof since === 'number') {
          records = records.filter((r) => r.completedAt >= since);
        }
        records.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
        resolve(records);
      };

      request.onerror = (event) => {
        logError('Failed to list lesson completions:', event.target.error);
        reject(event.target.error);
      };
    });
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
    const db = await getDB();
    const records = await listLessonCompletions(userId);
    if (records.length === 0) return;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SHAPE_LESSONS_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(SHAPE_LESSONS_STORE_NAME);
      let errored = false;
      for (const r of records) {
        const req = objectStore.delete(r.id);
        req.onerror = () => {
          if (!errored) {
            errored = true;
            reject(req.error);
          }
        };
      }
      transaction.oncomplete = () => {
        log(`Cleared ${records.length} lesson completions for user ${userId}`);
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    logError('Error in clearLessonCompletions:', error);
    throw error;
  }
};
