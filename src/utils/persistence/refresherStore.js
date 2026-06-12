/**
 * refresherStore.js — IDB CRUD for the PRF `userRefresherConfig` + `printBatches` stores.
 *
 * Provides low-level read + write primitives for the v20 stores. Mirrors
 * EAL `anchorObservationsStore.js` pattern: input validation throws synchronously
 * with `non-empty string` messages; IDB errors logged via `logError` then propagated.
 *
 * This module is the **data layer**. Validators + writer-ownership enforcement
 * (W-URC-1 / W-URC-2 / W-URC-3 per WRITERS.md) live in `src/utils/printableRefresher/writers.js`
 * (next session). The writers compose with these primitives.
 *
 * PRF Phase 5 — Session 12 (persistence + selector wiring).
 *
 * Architecture: `docs/projects/printable-refresher/idb-migration.md` §Stores added
 * WRITERS: `docs/projects/printable-refresher/WRITERS.md` §I-WR-1 enumeration
 */

import {
  readTx,
  writeTx,
  USER_REFRESHER_CONFIG_STORE_NAME,
  PRINT_BATCHES_STORE_NAME,
  logError,
} from './database';
import {
  buildDefaultRefresherConfig,
  REFRESHER_CONFIG_SINGLETON_ID,
} from './refresherDefaults';

// =============================================================================
// userRefresherConfig — singleton CRUD
// =============================================================================

/**
 * Read the singleton refresher config record. Lazy-creates with the default
 * if missing (defense-in-depth — migration seeds it but a corrupted-DB case
 * would otherwise return null; we'd rather return defaults than crash).
 *
 * @returns {Promise<Object>} The singleton record (always non-null).
 */
export const getRefresherConfig = async () => {
  try {
    const record = await readTx(USER_REFRESHER_CONFIG_STORE_NAME, (store) => store.get(REFRESHER_CONFIG_SINGLETON_ID));
    return record || buildDefaultRefresherConfig();
  } catch (error) {
    logError('Error in getRefresherConfig:', error);
    throw error;
  }
};

/**
 * Write the singleton refresher config record. Writers (W-URC-1 / W-URC-2)
 * compose this with their validators; this primitive does NOT enforce ownership.
 *
 * @param {Object} record - The full record to write. Must have `id === 'singleton'`.
 */
export const putRefresherConfig = async (record) => {
  if (!record || typeof record !== 'object') {
    throw new Error('putRefresherConfig requires a non-null record object');
  }
  if (record.id !== REFRESHER_CONFIG_SINGLETON_ID) {
    throw new Error(`putRefresherConfig requires record.id === '${REFRESHER_CONFIG_SINGLETON_ID}' (got '${record.id}')`);
  }
  try {
    await writeTx(USER_REFRESHER_CONFIG_STORE_NAME, (store) => store.put(record));
  } catch (error) {
    logError('Error in putRefresherConfig:', error);
    throw error;
  }
};

// =============================================================================
// printBatches — append-only CRUD (per I-WR-5)
// =============================================================================

/**
 * Append a print batch record. NOT a delete or update path — I-WR-5 invariant:
 * `printBatches` is append-only. The writer registry has no batch-mutator.
 *
 * @param {Object} record - Full batch record. Must have `batchId` (UUID v4)
 *                          and `printedAt` (ISO8601). Other fields validated
 *                          at the writer layer (W-URC-3).
 */
export const putPrintBatch = async (record) => {
  if (!record || typeof record !== 'object') {
    throw new Error('putPrintBatch requires a non-null record object');
  }
  if (typeof record.batchId !== 'string' || record.batchId.length === 0) {
    throw new Error('putPrintBatch requires a non-empty string batchId');
  }
  if (typeof record.printedAt !== 'string' || record.printedAt.length === 0) {
    throw new Error('putPrintBatch requires a non-empty string printedAt');
  }
  try {
    await writeTx(PRINT_BATCHES_STORE_NAME, (store) => store.put(record));
  } catch (error) {
    logError('Error in putPrintBatch:', error);
    throw error;
  }
};

/**
 * Read a single batch by id.
 */
export const getPrintBatch = async (batchId) => {
  if (typeof batchId !== 'string' || batchId.length === 0) {
    throw new Error('getPrintBatch requires a non-empty string batchId');
  }
  try {
    const record = await readTx(PRINT_BATCHES_STORE_NAME, (store) => store.get(batchId));
    return record ?? null;
  } catch (error) {
    logError('Error in getPrintBatch:', error);
    throw error;
  }
};

/**
 * Get all print batches sorted by printedAt DESC (most recent first).
 *
 * Used by `selectStaleCards` upstream — the selector iterates batches in
 * DESC order to pick the most-recent print per card. Sorting here removes
 * the burden from every caller.
 *
 * @returns {Promise<Object[]>} Array of batch records sorted printedAt DESC.
 */
export const getAllPrintBatches = async () => {
  try {
    const result = await readTx(PRINT_BATCHES_STORE_NAME, (store) => store.getAll());
    const records = Array.isArray(result) ? result : [];
    records.sort((a, b) => {
      const aTime = Date.parse(a.printedAt || '');
      const bTime = Date.parse(b.printedAt || '');
      return bTime - aTime; // DESC
    });
    return records;
  } catch (error) {
    logError('Error in getAllPrintBatches:', error);
    throw error;
  }
};

/**
 * Get all print batches that include a given cardId, sorted by printedAt DESC.
 *
 * Used for per-card lineage modals + `selectStaleCards` "show batch history
 * for this card" surface (Phase 5+).
 *
 * @returns {Promise<Object[]>} Filtered + sorted batch records.
 */
export const getPrintBatchesForCard = async (cardId) => {
  if (typeof cardId !== 'string' || cardId.length === 0) {
    throw new Error('getPrintBatchesForCard requires a non-empty string cardId');
  }
  const all = await getAllPrintBatches();
  return all.filter((b) => Array.isArray(b.cardIds) && b.cardIds.includes(cardId));
};
