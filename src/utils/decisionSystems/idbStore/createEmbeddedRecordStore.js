/**
 * createEmbeddedRecordStore.js — wrapper factory for records embedded on a
 * foreign host record.
 *
 * Models predictionAudit's pattern: the record (e.g. predictionAudit
 * `{ predictedDistribution, observedAction, modelVersion }`) is not stored
 * in its own object store — it lives as a field on a host record (e.g. the
 * `hands` store's record, under field `predictionAudit`). This factory
 * encapsulates the read-modify-write transaction so consumers don't
 * hand-write the same dance every time.
 *
 * The factory uses the HOST store name (e.g. `hands`); the embedded record
 * lives at `hostRecord[embeddedKey]`. Because the host store owns its own
 * primary key, this wrapper does NOT expose `getAll` or `getByIndex` —
 * those are the host store's concern. Only `read(hostKey)` and
 * `write(hostKey, record)` are provided.
 *
 * For per-key upsert semantics → `createUpsertStore`.
 * For per-owner replace-all semantics → `createReplaceAllStore`.
 */

import { getDB, log, logError } from '../../persistence/database';
import { assertStoreRegistered } from './migrationGuard';

/**
 * @template T
 * @typedef {Object} EmbeddedRecordStoreWrapper
 * @property {(hostKey: unknown) => Promise<T | null>} read
 * @property {(hostKey: unknown, record: T) => Promise<void>} write
 * @property {string} hostStoreName
 * @property {string} embeddedKey
 */

/**
 * Build an embedded-record store wrapper.
 *
 * @template T
 * @param {Object} config
 * @param {string} config.hostStoreName - Object-store name of the host record.
 * @param {string} config.embeddedKey - Field on the host record that holds the embedded record.
 * @returns {EmbeddedRecordStoreWrapper<T>}
 */
export const createEmbeddedRecordStore = (config) => {
  if (!config || typeof config !== 'object') {
    throw new TypeError('createEmbeddedRecordStore: config must be an object');
  }
  const { hostStoreName, embeddedKey } = config;
  if (typeof hostStoreName !== 'string' || hostStoreName.length === 0) {
    throw new TypeError(
      'createEmbeddedRecordStore: config.hostStoreName must be a non-empty string',
    );
  }
  if (typeof embeddedKey !== 'string' || embeddedKey.length === 0) {
    throw new TypeError(
      'createEmbeddedRecordStore: config.embeddedKey must be a non-empty string',
    );
  }
  assertStoreRegistered(hostStoreName);

  const read = async (hostKey) => {
    if (hostKey === null || hostKey === undefined) {
      throw new Error(
        `createEmbeddedRecordStore(${hostStoreName}.${embeddedKey}).read requires a hostKey`,
      );
    }
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([hostStoreName], 'readonly');
        const os = tx.objectStore(hostStoreName);
        const req = os.get(hostKey);
        req.onsuccess = () => {
          const host = req.result;
          if (!host) {
            resolve(null);
            return;
          }
          resolve(host[embeddedKey] ?? null);
        };
        req.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      logError(`Error in ${hostStoreName}.${embeddedKey}.read:`, err);
      throw err;
    }
  };

  const write = async (hostKey, record) => {
    if (hostKey === null || hostKey === undefined) {
      throw new Error(
        `createEmbeddedRecordStore(${hostStoreName}.${embeddedKey}).write requires a hostKey`,
      );
    }
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([hostStoreName], 'readwrite');
        const os = tx.objectStore(hostStoreName);
        const getReq = os.get(hostKey);
        let notFound = false;
        getReq.onsuccess = () => {
          const host = getReq.result;
          if (!host) {
            notFound = true;
            tx.abort();
            return;
          }
          const updated = { ...host, [embeddedKey]: record };
          os.put(updated);
        };
        getReq.onerror = (e) => reject(e.target?.error || new Error('read for write failed'));
        tx.oncomplete = () => {
          log(`${hostStoreName}.${embeddedKey} write at host ${hostKey}`);
          resolve();
        };
        tx.onerror = (e) => reject(e.target?.error || new Error('write transaction failed'));
        tx.onabort = (e) => {
          if (notFound) {
            reject(new Error(
              `createEmbeddedRecordStore(${hostStoreName}.${embeddedKey}).write: `
                + `host record with key ${JSON.stringify(hostKey)} not found`,
            ));
          } else {
            reject(e.target?.error || new Error('write transaction aborted'));
          }
        };
      });
    } catch (err) {
      logError(`Error in ${hostStoreName}.${embeddedKey}.write:`, err);
      throw err;
    }
  };

  return { read, write, hostStoreName, embeddedKey };
};
