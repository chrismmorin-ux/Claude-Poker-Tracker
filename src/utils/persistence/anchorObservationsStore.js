/**
 * anchorObservationsStore.js — IDB CRUD for the EAL `anchorObservations` store
 *
 * Provides read + write operations for the v19 `anchorObservations` IDB store.
 * Records keyed by `id` (format `obs:<handId>:<index>` per W-AO-1).
 *
 * EAL Phase 6 Stream D B3 — Session 12 (2026-04-25). Mirrors `subscriptionStore.js`.
 *
 * Architecture: `docs/projects/exploit-anchor-library/schema-delta.md` §3.1
 * WRITERS: `docs/projects/exploit-anchor-library/WRITERS.md` §`anchorObservations`
 *
 * Writer registry (WRITERS.md I-WR-1):
 *   W-AO-1 — hand-replay-capture-writer (owner Tier 0 capture; pure writer in
 *            `src/utils/anchorLibrary/captureObservation.js`; this module persists
 *            the record it returns)
 *   W-AO-2 — matcher-system-observation-writer (Phase 5+ — fires per matcher firing)
 *   W-AO-3 — candidate-promotion-writer (Phase 2 — stamps `promotedToCandidateId`)
 *
 * Functions in this file are the low-level IDB primitives the writers compose with.
 * Phase 6 reducer + persistence hook calls them on hydration + dispatched writes.
 */

import {
  getDB,
  ANCHOR_OBSERVATIONS_STORE_NAME,
  log,
  logError,
} from './database';

/**
 * Read a single observation by id.
 *
 * @param {string} id - Observation id (format `obs:<handId>:<index>`)
 * @returns {Promise<Object|null>} Observation record or null if not found
 */
export const getObservation = async (id) => {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('getObservation requires a non-empty string id');
  }
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ANCHOR_OBSERVATIONS_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(ANCHOR_OBSERVATIONS_STORE_NAME);
      const request = objectStore.get(id);

      request.onsuccess = () => {
        const record = request.result;
        resolve(record || null);
      };

      request.onerror = (event) => {
        logError('Failed to get observation:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    logError('Error in getObservation:', error);
    throw error;
  }
};

/**
 * Read all observations for a given hand via the handId index.
 *
 * Returns chronological-ASC by createdAt order (IDB default key order on the
 * index is by handId then by id; for canonical chronological ordering, callers
 * should sort by createdAt themselves — this primitive returns the raw set).
 *
 * @param {string} handId - Hand id to filter by
 * @returns {Promise<Array<Object>>} Array of observation records (possibly empty)
 */
export const getObservationsByHandId = async (handId) => {
  if (typeof handId !== 'string' || handId.length === 0) {
    throw new Error('getObservationsByHandId requires a non-empty string handId');
  }
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ANCHOR_OBSERVATIONS_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(ANCHOR_OBSERVATIONS_STORE_NAME);
      const index = objectStore.index('handId');
      const request = index.getAll(handId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = (event) => {
        logError('Failed to get observations by handId:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    logError('Error in getObservationsByHandId:', error);
    throw error;
  }
};

/**
 * Read all observations across the store.
 *
 * Used by hydration on app start (EAL persistence hook) and by exports.
 *
 * @returns {Promise<Array<Object>>} All observation records
 */
export const getAllObservations = async () => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ANCHOR_OBSERVATIONS_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(ANCHOR_OBSERVATIONS_STORE_NAME);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = (event) => {
        logError('Failed to get all observations:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    logError('Error in getAllObservations:', error);
    throw error;
  }
};

/**
 * Write (create or replace) an observation record.
 *
 * The record's `id` field is required and used as the keypath. Callers should
 * pass the full record (per WRITERS.md schema; typically constructed by
 * `captureObservation` W-AO-1 writer). Partial updates are not supported.
 *
 * @param {Object} record - Full observation record (must include id, handId, schemaVersion)
 * @returns {Promise<void>}
 */
export const putObservation = async (record) => {
  if (!record || typeof record !== 'object' || !record.id) {
    throw new Error('putObservation requires a record with an id field');
  }
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ANCHOR_OBSERVATIONS_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(ANCHOR_OBSERVATIONS_STORE_NAME);
      const request = objectStore.put(record);

      request.onsuccess = () => {
        log(`Observation saved: ${record.id}`);
        resolve();
      };

      request.onerror = (event) => {
        logError('Failed to save observation:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    logError('Error in putObservation:', error);
    throw error;
  }
};

/**
 * Delete a single observation by id.
 *
 * Per surface spec: delete-observation is NOT exposed at the capture surface.
 * This primitive supports the Anchor Library surface's per-observation delete
 * action (Phase 6+) + dev-mode reset flows.
 *
 * @param {string} id - Observation id to delete
 * @returns {Promise<void>}
 */
export const deleteObservation = async (id) => {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('deleteObservation requires a non-empty string id');
  }
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ANCHOR_OBSERVATIONS_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(ANCHOR_OBSERVATIONS_STORE_NAME);
      const request = objectStore.delete(id);

      request.onsuccess = () => {
        log(`Observation deleted: ${id}`);
        resolve();
      };

      request.onerror = (event) => {
        logError('Failed to delete observation:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    logError('Error in deleteObservation:', error);
    throw error;
  }
};
