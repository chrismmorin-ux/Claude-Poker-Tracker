/**
 * preflopDrillsStorage.js — IndexedDB CRUD for preflop drill attempts.
 *
 * Drill attempt record:
 *   {
 *     drillId: number (autoIncrement),
 *     userId: string,
 *     drillType: 'estimate' | 'framework',
 *     matchupKey: string (e.g., 'AKs_JTs'),
 *     handA: string,
 *     handB: string,
 *     userAnswer: object (mode-specific shape),
 *     truth: object (computed equity + framework ids),
 *     correct: boolean,
 *     delta: number (|user - truth| for estimate mode, else null),
 *     timestamp: number,
 *   }
 */

import {
  getDB,
  GUEST_USER_ID,
  PREFLOP_DRILLS_STORE_NAME,
  logError,
} from './database';

/**
 * Save a drill attempt. Auto-assigns drillId and timestamp.
 * @param {Object} attempt - partial drill record (without drillId or timestamp)
 * @param {string} [userId=GUEST_USER_ID]
 * @returns {Promise<number>} drillId
 */
export const savePreflopDrill = async (attempt, userId = GUEST_USER_ID) => {
  try {
    const db = await getDB();
    const record = {
      ...attempt,
      userId,
      timestamp: Date.now(),
    };
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PREFLOP_DRILLS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(PREFLOP_DRILLS_STORE_NAME);
      const req = store.add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    logError('savePreflopDrill failed:', err);
    throw err;
  }
};

/**
 * Load all drill attempts for a user, newest first.
 */
export const loadPreflopDrills = async (userId = GUEST_USER_ID) => {
  try {
    const db = await getDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PREFLOP_DRILLS_STORE_NAME, 'readonly');
      const store = tx.objectStore(PREFLOP_DRILLS_STORE_NAME);
      const idx = store.index('userId');
      const req = idx.getAll(userId);
      req.onsuccess = () => {
        const sorted = (req.result || []).sort((a, b) => b.timestamp - a.timestamp);
        resolve(sorted);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    logError('loadPreflopDrills failed:', err);
    return [];
  }
};

/**
 * Delete all drill attempts for a user. Used by Settings reset.
 */
export const clearPreflopDrills = async (userId = GUEST_USER_ID) => {
  try {
    const drills = await loadPreflopDrills(userId);
    const db = await getDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PREFLOP_DRILLS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(PREFLOP_DRILLS_STORE_NAME);
      for (const d of drills) store.delete(d.drillId);
      tx.oncomplete = () => resolve(drills.length);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    logError('clearPreflopDrills failed:', err);
    throw err;
  }
};

/**
 * Aggregate accuracy per framework id from a list of drill attempts.
 * Returns { [frameworkId]: { attempts, correct, accuracy } }.
 * Expects each drill to carry `truth.frameworks` (array of framework ids that applied).
 */
export const aggregateFrameworkAccuracy = (drills) => {
  const out = {};
  for (const d of drills) {
    const fwIds = d?.truth?.frameworks || [];
    for (const id of fwIds) {
      if (!out[id]) out[id] = { attempts: 0, correct: 0, accuracy: 0 };
      out[id].attempts++;
      if (d.correct) out[id].correct++;
    }
  }
  for (const id of Object.keys(out)) {
    out[id].accuracy = out[id].attempts ? out[id].correct / out[id].attempts : 0;
  }
  return out;
};
