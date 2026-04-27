/**
 * perceptionPrimitivesStore.js — IDB CRUD for the EAL `perceptionPrimitives` store
 *
 * Per `docs/projects/exploit-anchor-library/schema-delta.md` §3.3 + WRITERS.md
 * §`perceptionPrimitives` (3 writers: W-PP-1 migration-seed, W-PP-2 tier2-validity-updater,
 * W-PP-3 owner-primitive-override).
 *
 * EAL Phase 6 Stream D B3 — Session 12 (2026-04-25). Mirrors `subscriptionStore.js`.
 *
 * Primitives are seeded at v19 migration time (8 records: PP-01..PP-08). This module
 * provides per-primitive read/write + style-keyed lookup via the multiEntry index
 * established in migrateV19.
 *
 * Note: this module does NOT contain primitive-validity update logic. That lives in
 * `src/utils/anchorLibrary/primitiveValidity.js` as a pure function. This module
 * persists the result the validator returns.
 */

import {
  getDB,
  PERCEPTION_PRIMITIVES_STORE_NAME,
  log,
  logError,
} from './database';

/**
 * Read a single primitive by id (e.g. "PP-01").
 *
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export const getPrimitive = async (id) => {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('getPrimitive requires a non-empty string id');
  }
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PERCEPTION_PRIMITIVES_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(PERCEPTION_PRIMITIVES_STORE_NAME);
      const request = objectStore.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = (event) => {
        logError('Failed to get primitive:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    logError('Error in getPrimitive:', error);
    throw error;
  }
};

/**
 * Read all primitives in the store. Used at hydration on app start.
 *
 * @returns {Promise<Array<Object>>}
 */
export const getAllPrimitives = async () => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PERCEPTION_PRIMITIVES_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(PERCEPTION_PRIMITIVES_STORE_NAME);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = (event) => {
        logError('Failed to get all primitives:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    logError('Error in getAllPrimitives:', error);
    throw error;
  }
};

/**
 * Read all primitives applicable to a given style (e.g. 'Nit') via the
 * multiEntry index on `appliesToStyles`.
 *
 * Used by Phase 6 surfaces:
 *   - Anchor Library style-filter
 *   - Calibration Dashboard cross-link "primitives this anchor depends on"
 *   - Tier-2 calibration update path: when a Nit-style anchor fires, look up
 *     all Nit primitives to update their validity posteriors.
 *
 * @param {string} style - 'Fish' | 'Nit' | 'LAG' | 'TAG' (or any style stored)
 * @returns {Promise<Array<Object>>}
 */
export const getPrimitivesByStyle = async (style) => {
  if (typeof style !== 'string' || style.length === 0) {
    throw new Error('getPrimitivesByStyle requires a non-empty string style');
  }
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PERCEPTION_PRIMITIVES_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(PERCEPTION_PRIMITIVES_STORE_NAME);
      const index = objectStore.index('appliesToStyles');
      const request = index.getAll(style);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = (event) => {
        logError('Failed to get primitives by style:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    logError('Error in getPrimitivesByStyle:', error);
    throw error;
  }
};

/**
 * Write (create or replace) a primitive record.
 *
 * Called by W-PP-2 (Tier-2 validity updater after `updatePrimitiveValidity`
 * computes new posterior) and W-PP-3 (Phase 8 owner override). Migration-seed
 * (W-PP-1) writes via the in-flight migration transaction in `migrations.js`,
 * not through this primitive.
 *
 * @param {Object} record - Full PerceptionPrimitive record (must include id, schemaVersion)
 * @returns {Promise<void>}
 */
export const putPrimitive = async (record) => {
  if (!record || typeof record !== 'object' || !record.id) {
    throw new Error('putPrimitive requires a record with an id field');
  }
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PERCEPTION_PRIMITIVES_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(PERCEPTION_PRIMITIVES_STORE_NAME);
      const request = objectStore.put(record);

      request.onsuccess = () => {
        log(`Primitive saved: ${record.id}`);
        resolve();
      };

      request.onerror = (event) => {
        logError('Failed to save primitive:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    logError('Error in putPrimitive:', error);
    throw error;
  }
};
