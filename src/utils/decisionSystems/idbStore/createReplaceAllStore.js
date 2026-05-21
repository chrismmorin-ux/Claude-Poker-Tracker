/**
 * createReplaceAllStore.js — IDB CRUD wrapper factory for per-owner
 * replace-all stores.
 *
 * Models skillAssessment/heroLeaksStore.js's pattern: records are keyed by
 * a composite `[ownerKey, secondaryKey]` and a `replaceAllForOwner(ownerId,
 * records)` operation atomically replaces ALL records for that owner inside
 * a single transaction.
 *
 * Used when a downstream computation produces an N-record snapshot per
 * owner and the previous snapshot must be invalidated as a unit. The
 * per-record CRUD primitives (`get`, `put`, etc.) remain available but
 * the atomic per-owner reset is the load-bearing primitive.
 *
 * For per-key upsert semantics → `createUpsertStore`.
 * For records embedded on a foreign host record → `createEmbeddedRecordStore`.
 */

import { getDB, log, logError } from '../../persistence/database';
import { assertStoreRegistered } from './migrationGuard';

/**
 * @template T
 * @typedef {Object} ReplaceAllStoreWrapper
 * @property {(key: unknown) => Promise<T | null>} get
 * @property {() => Promise<T[]>} getAll
 * @property {(record: T) => Promise<void>} put
 * @property {(key: unknown) => Promise<void>} delete
 * @property {(indexName: string, value: unknown) => Promise<T[]>} getByIndex
 * @property {(ownerId: string, records: T[]) => Promise<void>} replaceAllForOwner
 * @property {string} storeName
 */

/**
 * Build a per-owner replace-all store wrapper.
 *
 * @template T
 * @param {Object} config
 * @param {string} config.storeName - Object-store name (must exist in migrationRegistry).
 * @param {string} [config.ownerKey='ownerId'] - Field on records that holds the owner id.
 * @param {string} [config.ownerIndexName] - Index on the owner field; required for atomic
 *   per-owner delete-then-put. If omitted, replaceAllForOwner falls back to scan-and-filter.
 * @returns {ReplaceAllStoreWrapper<T>}
 */
export const createReplaceAllStore = (config) => {
  if (!config || typeof config !== 'object') {
    throw new TypeError('createReplaceAllStore: config must be an object');
  }
  const { storeName, ownerKey = 'ownerId', ownerIndexName } = config;
  if (typeof storeName !== 'string' || storeName.length === 0) {
    throw new TypeError('createReplaceAllStore: config.storeName must be a non-empty string');
  }
  assertStoreRegistered(storeName);

  const get = async (key) => {
    if (key === null || key === undefined) {
      throw new Error(`createReplaceAllStore(${storeName}).get requires a key`);
    }
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readonly');
        const os = tx.objectStore(storeName);
        const req = os.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      logError(`Error in ${storeName}.get:`, err);
      throw err;
    }
  };

  const getAll = async () => {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readonly');
        const os = tx.objectStore(storeName);
        const req = os.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      logError(`Error in ${storeName}.getAll:`, err);
      throw err;
    }
  };

  const put = async (record) => {
    if (!record || typeof record !== 'object') {
      throw new Error(`createReplaceAllStore(${storeName}).put requires a record object`);
    }
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        const os = tx.objectStore(storeName);
        os.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target?.error || new Error('put failed'));
        tx.onabort = (e) => reject(e.target?.error || new Error('put aborted'));
      });
    } catch (err) {
      logError(`Error in ${storeName}.put:`, err);
      throw err;
    }
  };

  const del = async (key) => {
    if (key === null || key === undefined) {
      throw new Error(`createReplaceAllStore(${storeName}).delete requires a key`);
    }
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        const os = tx.objectStore(storeName);
        os.delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target?.error || new Error('delete failed'));
        tx.onabort = (e) => reject(e.target?.error || new Error('delete aborted'));
      });
    } catch (err) {
      logError(`Error in ${storeName}.delete:`, err);
      throw err;
    }
  };

  const getByIndex = async (indexName, value) => {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readonly');
        const os = tx.objectStore(storeName);
        const idx = os.index(indexName);
        const req = idx.getAll(value);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      logError(`Error in ${storeName}.getByIndex(${indexName}):`, err);
      throw err;
    }
  };

  /**
   * Atomically delete every record matching `[ownerKey]: ownerId` and then
   * insert the new `records` set — all within a single readwrite transaction.
   * If `ownerIndexName` was provided, uses the index; otherwise scans.
   */
  const replaceAllForOwner = async (ownerId, records) => {
    if (typeof ownerId !== 'string' || ownerId.length === 0) {
      throw new Error(
        `createReplaceAllStore(${storeName}).replaceAllForOwner requires a non-empty ownerId`,
      );
    }
    if (!Array.isArray(records)) {
      throw new Error(
        `createReplaceAllStore(${storeName}).replaceAllForOwner requires an array of records`,
      );
    }
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        const os = tx.objectStore(storeName);

        const onCommit = () => {
          log(`${storeName} replaceAllForOwner(${ownerId}): wrote ${records.length}`);
          resolve();
        };
        const onAbort = (e) => reject(e.target?.error || new Error('transaction aborted'));
        tx.oncomplete = onCommit;
        tx.onerror = onAbort;
        tx.onabort = onAbort;

        const deleteExisting = () => {
          if (ownerIndexName) {
            const idx = os.index(ownerIndexName);
            const cursorReq = idx.openCursor(ownerId);
            cursorReq.onsuccess = (event) => {
              const cursor = event.target.result;
              if (cursor) {
                cursor.delete();
                cursor.continue();
              } else {
                writeNew();
              }
            };
            cursorReq.onerror = onAbort;
          } else {
            // Fallback: scan all and delete matches by ownerKey field
            const getAllReq = os.getAll();
            getAllReq.onsuccess = () => {
              const all = getAllReq.result || [];
              for (const rec of all) {
                if (rec && rec[ownerKey] === ownerId) {
                  os.delete(extractKeyFor(rec, ownerKey));
                }
              }
              writeNew();
            };
            getAllReq.onerror = onAbort;
          }
        };

        const writeNew = () => {
          for (const rec of records) {
            os.put(rec);
          }
        };

        deleteExisting();
      });
    } catch (err) {
      logError(`Error in ${storeName}.replaceAllForOwner:`, err);
      throw err;
    }
  };

  return {
    get,
    getAll,
    put,
    delete: del,
    getByIndex,
    replaceAllForOwner,
    storeName,
  };
};

// Fallback key extractor for scan-based replaceAllForOwner. Records that
// rely on a composite primaryKey must pass an `ownerIndexName` for atomic
// cursor-based delete; this fallback only works when the primary key is
// recoverable from the record (most records have an `id` field).
const extractKeyFor = (rec, ownerKey) => {
  if (rec.id) return rec.id;
  // Composite key fallback — best effort. Callers with composite keys
  // should pass `ownerIndexName` so the cursor path runs instead.
  return rec[ownerKey];
};
