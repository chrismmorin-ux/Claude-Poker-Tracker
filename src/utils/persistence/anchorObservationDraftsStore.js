/**
 * anchorObservationDraftsStore.js — IDB CRUD for the EAL `anchorObservationDrafts` sidecar
 *
 * Per `docs/design/surfaces/hand-replay-observation-capture.md` §State:
 * 400ms-debounced draft persistence; keypath `id` with format `draft:<handId>`.
 * One draft per hand at any time (deterministic id).
 *
 * EAL Phase 6 Stream D B3 — Session 12 (2026-04-25). Mirrors `subscriptionStore.js`.
 *
 * The drafts sidecar is intentionally separated from `anchorObservations` per
 * S10 handoff design choice: separate store gives index isolation (draft cursors
 * don't scan canonical observations) + simpler post-Save cleanup (single-store
 * delete transaction).
 *
 * Lifecycle:
 *   1. Capture modal opens → `getDraft(handId)` to resume if exists
 *   2. User edits → `putDraft(record)` debounced 400ms
 *   3. User clicks Save → `captureObservation` produces canonical record →
 *      `putObservation` writes to `anchorObservations` → `deleteDraft(handId)`
 *      removes the sidecar (caller orchestrates the two writes; this module
 *      provides the primitives)
 *   4. User clicks Discard → `deleteDraft(handId)` only (no canonical write)
 *   5. User clicks "Keep for later" → no Save + leaves draft alive
 */

import {
  getDB,
  ANCHOR_OBSERVATION_DRAFTS_STORE_NAME,
  log,
  logError,
} from './database';

/**
 * Build the deterministic draft id for a given hand.
 */
const draftId = (handId) => `draft:${handId}`;

/**
 * Read the draft for a given hand, or null if no draft exists.
 *
 * @param {string} handId - Hand id (the suffix of the draft's `id` field)
 * @returns {Promise<Object|null>} Draft record or null
 */
export const getDraft = async (handId) => {
  if (typeof handId !== 'string' || handId.length === 0) {
    throw new Error('getDraft requires a non-empty string handId');
  }
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ANCHOR_OBSERVATION_DRAFTS_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(ANCHOR_OBSERVATION_DRAFTS_STORE_NAME);
      const request = objectStore.get(draftId(handId));

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = (event) => {
        logError('Failed to get draft:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    logError('Error in getDraft:', error);
    throw error;
  }
};

/**
 * Write (create or replace) the draft for a given hand.
 *
 * Caller constructs the record; the writer auto-attaches the deterministic
 * `id` if missing, but if the caller passes an explicit id it must match
 * `draft:<handId>` format (asserted to prevent accidental cross-hand writes).
 *
 * @param {Object} record - Draft record (must include handId; updatedAt strongly recommended)
 * @returns {Promise<void>}
 */
export const putDraft = async (record) => {
  if (!record || typeof record !== 'object' || !record.handId) {
    throw new Error('putDraft requires a record with a handId field');
  }
  const expectedId = draftId(record.handId);
  if (record.id !== undefined && record.id !== expectedId) {
    throw new Error(
      `putDraft: record.id "${record.id}" does not match expected "${expectedId}" — drafts are keyed by handId`,
    );
  }
  // Auto-attach id if absent
  const persistedRecord = { ...record, id: expectedId };

  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ANCHOR_OBSERVATION_DRAFTS_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(ANCHOR_OBSERVATION_DRAFTS_STORE_NAME);
      const request = objectStore.put(persistedRecord);

      request.onsuccess = () => {
        log(`Draft saved: ${persistedRecord.id}`);
        resolve();
      };

      request.onerror = (event) => {
        logError('Failed to save draft:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    logError('Error in putDraft:', error);
    throw error;
  }
};

/**
 * Delete the draft for a given hand.
 *
 * Called after Save success (canonical observation persisted; sidecar no longer
 * needed) or on Discard (user explicit).
 *
 * @param {string} handId
 * @returns {Promise<void>}
 */
export const deleteDraft = async (handId) => {
  if (typeof handId !== 'string' || handId.length === 0) {
    throw new Error('deleteDraft requires a non-empty string handId');
  }
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ANCHOR_OBSERVATION_DRAFTS_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(ANCHOR_OBSERVATION_DRAFTS_STORE_NAME);
      const request = objectStore.delete(draftId(handId));

      request.onsuccess = () => {
        log(`Draft deleted for hand: ${handId}`);
        resolve();
      };

      request.onerror = (event) => {
        logError('Failed to delete draft:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    logError('Error in deleteDraft:', error);
    throw error;
  }
};

/**
 * List all drafts (debug + cleanup tooling).
 *
 * Phase 6+ may add a "stale draft cleanup" utility that uses this + the
 * `updatedAt` index to delete drafts older than a threshold (e.g., 30 days).
 *
 * @returns {Promise<Array<Object>>}
 */
export const getAllDrafts = async () => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ANCHOR_OBSERVATION_DRAFTS_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(ANCHOR_OBSERVATION_DRAFTS_STORE_NAME);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = (event) => {
        logError('Failed to get all drafts:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    logError('Error in getAllDrafts:', error);
    throw error;
  }
};
