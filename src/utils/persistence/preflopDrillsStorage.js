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
 * Returns { [frameworkId]: { attempts, correct, accuracy, avgDelta, deltaSamples } }.
 * Expects each drill to carry `truth.frameworks` (array of framework ids that applied).
 *
 * `avgDelta` is the mean absolute equity delta (|guess − truth|) across the
 * subset of attempts that recorded a numeric `delta`. Estimate and Recipe
 * drills record deltas; Framework Drill does not (it's a set-matching task
 * with no equity guess). `deltaSamples` counts contributing attempts so the
 * scheduler can ignore low-sample noise.
 */
export const aggregateFrameworkAccuracy = (drills) => {
  // Object.create(null) + string-id guard prevents prototype-chain writes from
  // tampered IDB records (e.g., `frameworks: ['__proto__']`). RT-96.
  const out = Object.create(null);
  for (const d of drills) {
    const fwIds = d?.truth?.frameworks || [];
    for (const id of fwIds) {
      if (typeof id !== 'string' || id.length === 0) continue;
      if (!out[id]) out[id] = { attempts: 0, correct: 0, accuracy: 0, sumDelta: 0, deltaSamples: 0, avgDelta: 0 };
      out[id].attempts++;
      if (d.correct) out[id].correct++;
      if (typeof d.delta === 'number' && Number.isFinite(d.delta)) {
        out[id].sumDelta += d.delta;
        out[id].deltaSamples++;
      }
    }
  }
  for (const id of Object.keys(out)) {
    out[id].accuracy = out[id].attempts ? out[id].correct / out[id].attempts : 0;
    out[id].avgDelta = out[id].deltaSamples ? out[id].sumDelta / out[id].deltaSamples : 0;
    // Internal bookkeeping field — don't expose sumDelta to callers.
    delete out[id].sumDelta;
  }
  return out;
};
