/**
 * createUpsertStore.js — IDB CRUD wrapper factory for upsert-by-key stores.
 *
 * Produces a uniform `{ get, getAll, put, delete, getByIndex }` surface
 * over an arbitrary object store. The factory:
 *   1. Asserts the store is registered in migrationRegistry (ADR-DS-2).
 *   2. Returns CRUD primitives that lazily open the DB via `getDB()`.
 *
 * Use this factory for stores where each record has a unique key and
 * writes are upserts (most stores in this codebase: anchors, observations,
 * primitives, drafts, assumptions, subscriptions, etc.).
 *
 * For per-owner replace-all semantics → `createReplaceAllStore`.
 * For records embedded on a foreign host record → `createEmbeddedRecordStore`.
 *
 * Note: this factory does NOT create the object store. Stores are still
 * created in `persistence/migrations.js` at version-bump time. The factory
 * just produces typed CRUD wrappers against an already-existing store.
 */

import { getDB, log, logError } from '../../persistence/database';
import { assertStoreRegistered } from './migrationGuard';

/**
 * @template T
 * @typedef {Object} StoreWrapper
 * @property {(key: string) => Promise<T | null>} get
 * @property {() => Promise<T[]>} getAll
 * @property {(record: T) => Promise<void>} put
 * @property {(key: string) => Promise<void>} delete
 * @property {(indexName: string, value: unknown) => Promise<T[]>} getByIndex
 * @property {string} storeName
 */

/**
 * Build an upsert-by-key store wrapper.
 *
 * @template T
 * @param {Object} config
 * @param {string} config.storeName - Object-store name (must exist in migrationRegistry).
 * @param {string} [config.keyPath='id'] - Diagnostic only; actual keyPath is set at migration time.
 * @returns {StoreWrapper<T>}
 */
export const createUpsertStore = (config) => {
  if (!config || typeof config !== 'object') {
    throw new TypeError('createUpsertStore: config must be an object');
  }
  const { storeName } = config;
  if (typeof storeName !== 'string' || storeName.length === 0) {
    throw new TypeError('createUpsertStore: config.storeName must be a non-empty string');
  }
  assertStoreRegistered(storeName);

  const get = async (key) => {
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error(`createUpsertStore(${storeName}).get requires a non-empty string key`);
    }
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readonly');
        const os = tx.objectStore(storeName);
        const req = os.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = (e) => {
          logError(`Failed to get from ${storeName}:`, e.target.error);
          reject(e.target.error);
        };
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
        req.onerror = (e) => {
          logError(`Failed to getAll from ${storeName}:`, e.target.error);
          reject(e.target.error);
        };
      });
    } catch (err) {
      logError(`Error in ${storeName}.getAll:`, err);
      throw err;
    }
  };

  const put = async (record) => {
    if (!record || typeof record !== 'object') {
      throw new Error(`createUpsertStore(${storeName}).put requires a record object`);
    }
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        const os = tx.objectStore(storeName);
        os.put(record);
        tx.oncomplete = () => {
          log(`${storeName} put: ${record.id ?? '(no id)'}`);
          resolve();
        };
        tx.onerror = (e) => {
          logError(`Failed to put into ${storeName}:`, e.target?.error);
          reject(e.target?.error || new Error('put transaction failed'));
        };
        tx.onabort = (e) => reject(e.target?.error || new Error('put transaction aborted'));
      });
    } catch (err) {
      logError(`Error in ${storeName}.put:`, err);
      throw err;
    }
  };

  const del = async (key) => {
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error(`createUpsertStore(${storeName}).delete requires a non-empty string key`);
    }
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        const os = tx.objectStore(storeName);
        os.delete(key);
        tx.oncomplete = () => {
          log(`${storeName} delete: ${key}`);
          resolve();
        };
        tx.onerror = (e) => {
          logError(`Failed to delete from ${storeName}:`, e.target?.error);
          reject(e.target?.error || new Error('delete transaction failed'));
        };
        tx.onabort = (e) => reject(e.target?.error || new Error('delete transaction aborted'));
      });
    } catch (err) {
      logError(`Error in ${storeName}.delete:`, err);
      throw err;
    }
  };

  const getByIndex = async (indexName, value) => {
    if (typeof indexName !== 'string' || indexName.length === 0) {
      throw new Error(
        `createUpsertStore(${storeName}).getByIndex requires a non-empty string indexName`,
      );
    }
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readonly');
        const os = tx.objectStore(storeName);
        const idx = os.index(indexName);
        const req = idx.getAll(value);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = (e) => {
          logError(`Failed to getByIndex(${indexName}) from ${storeName}:`, e.target.error);
          reject(e.target.error);
        };
      });
    } catch (err) {
      logError(`Error in ${storeName}.getByIndex(${indexName}):`, err);
      throw err;
    }
  };

  return { get, getAll, put, delete: del, getByIndex, storeName };
};
