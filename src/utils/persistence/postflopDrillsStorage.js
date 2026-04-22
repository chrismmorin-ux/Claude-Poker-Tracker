/**
 * postflopDrillsStorage.js — IndexedDB CRUD for postflop drill attempts.
 *
 * Drill attempt record:
 *   {
 *     drillId:     number (autoIncrement),
 *     userId:      string,
 *     drillType:   'estimate' | 'framework' | 'recipe' | 'line',
 *     scenarioKey: string (e.g., 'BTN_open_vs_BB_call_Ah_Kd_7s', or
 *                  '<lineId>:<nodeId>' for drillType='line'),
 *     context:     { position, action, vs? },
 *     opposingContext: { position, action, vs? } | null,
 *     board:       string (e.g., 'As Kh 7d'),
 *     userAnswer:  object (mode-specific shape),
 *     truth:       object (expected subcase + framework ids + numeric details),
 *     correct:     boolean,
 *     delta:       number | null ( |user% - truth%| for estimate mode ),
 *     timestamp:   number,
 *
 *     // RT-114 (schema v2, 2026-04-21) — additive-optional. Both fields are
 *     // enum-checked at aggregate time against the canonical drill-content
 *     // taxonomies; records with unknown IDs are filtered out of
 *     // taxonomy-aware aggregators (but the raw record stays in IDB).
 *     // Validated against `isKnownArchetype` (fish/reg/pro) and
 *     // `isKnownBucket` (28 bucket IDs) in `postflopDrillContent/`.
 *     archetypeId?: string,  // e.g., 'fish' | 'reg' | 'pro'
 *     bucketId?:    string,  // e.g., 'topSet' | 'tptk' | 'flushDraw'
 *   }
 *
 * IDB is schemaless at the record level — no database version bump is needed
 * for adding the two optional fields. Legacy records (before 2026-04-21) have
 * neither field; aggregate-by-archetype / aggregate-by-bucket helpers skip
 * them via the same "unknown ID" path as tampered records.
 */

import {
  getDB,
  GUEST_USER_ID,
  POSTFLOP_DRILLS_STORE_NAME,
  logError,
} from './database';

/**
 * Save a postflop drill attempt. Auto-assigns drillId and timestamp.
 * @param {Object} attempt - partial drill record (without drillId or timestamp)
 * @param {string} [userId=GUEST_USER_ID]
 * @returns {Promise<number>} drillId
 */
export const savePostflopDrill = async (attempt, userId = GUEST_USER_ID) => {
  try {
    const db = await getDB();
    const record = {
      ...attempt,
      userId,
      timestamp: Date.now(),
    };
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(POSTFLOP_DRILLS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(POSTFLOP_DRILLS_STORE_NAME);
      const req = store.add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    logError('savePostflopDrill failed:', err);
    throw err;
  }
};

/** Load all postflop drill attempts for a user, newest first. */
export const loadPostflopDrills = async (userId = GUEST_USER_ID) => {
  try {
    const db = await getDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(POSTFLOP_DRILLS_STORE_NAME, 'readonly');
      const store = tx.objectStore(POSTFLOP_DRILLS_STORE_NAME);
      const idx = store.index('userId');
      const req = idx.getAll(userId);
      req.onsuccess = () => {
        const sorted = (req.result || []).sort((a, b) => b.timestamp - a.timestamp);
        resolve(sorted);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    logError('loadPostflopDrills failed:', err);
    return [];
  }
};

/** Delete all postflop drill attempts for a user. Used by Settings reset. */
export const clearPostflopDrills = async (userId = GUEST_USER_ID) => {
  try {
    const drills = await loadPostflopDrills(userId);
    const db = await getDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(POSTFLOP_DRILLS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(POSTFLOP_DRILLS_STORE_NAME);
      for (const d of drills) store.delete(d.drillId);
      tx.oncomplete = () => resolve(drills.length);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    logError('clearPostflopDrills failed:', err);
    throw err;
  }
};

/**
 * Aggregate accuracy per framework id from a list of drill attempts.
 * Returns { [frameworkId]: { attempts, correct, accuracy } }.
 * Expects each drill to carry `truth.frameworks` (array of framework ids that applied).
 *
 * Shape contract (RT-100): this function returns a *subset* of the preflop
 * `aggregateFrameworkAccuracy` shape. Postflop drills do not record a numeric
 * equity `delta` (estimate is a % guess, framework is set-matching), so
 * `avgDelta` and `deltaSamples` are intentionally absent. Any caller that
 * merges preflop + postflop aggregates must handle the missing fields
 * explicitly — `undefined` will propagate `NaN` into arithmetic.
 */
export const aggregatePostflopFrameworkAccuracy = (drills) => {
  // Object.create(null) + string-id guard prevents prototype-chain writes from
  // tampered IDB records. RT-96.
  const out = Object.create(null);
  for (const d of drills) {
    const fwIds = d?.truth?.frameworks || [];
    for (const id of fwIds) {
      if (typeof id !== 'string' || id.length === 0) continue;
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
