/**
 * assumptionStorage.js - CRUD operations for villainAssumptions IDB store
 *
 * Store shape (migration v17):
 *   keyPath: [villainId, id]  (compound key)
 *   indexes: villainId, status, lastUpdated (evidence.lastUpdated), schemaVersion
 *
 * Migration at load time per I-AE-5: records with older schemaVersion run through
 * `migratePersistedAssumption` from assumptionEngine before returning to caller.
 *
 * See:
 *   - docs/projects/exploit-deviation/architecture.md §8.1
 *   - docs/projects/exploit-deviation/schema.md §8 (additive-only evolution)
 */

import { getDB, VILLAIN_ASSUMPTIONS_STORE_NAME } from './database';
import { createPersistenceLogger } from './index';
import { migratePersistedAssumption, needsMigration, SCHEMA_VERSION } from '../assumptionEngine';

const { log, logError } = createPersistenceLogger('AssumptionStorage');

// =============================================================================
// WRITES
// =============================================================================

/**
 * Save (upsert) a single assumption.
 * @param {Object} assumption - VillainAssumption per schema v1.1
 * @returns {Promise<void>}
 */
export const saveAssumption = async (assumption) => {
  if (!assumption || typeof assumption.villainId !== 'string' || typeof assumption.id !== 'string') {
    throw new Error('saveAssumption: assumption must have string villainId and id');
  }
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VILLAIN_ASSUMPTIONS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(VILLAIN_ASSUMPTIONS_STORE_NAME);
      const request = store.put(assumption);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    logError(err);
    throw err;
  }
};

/**
 * Save a batch of assumptions in a single transaction.
 * @param {Array} assumptions
 */
export const saveAssumptionBatch = async (assumptions) => {
  if (!Array.isArray(assumptions) || assumptions.length === 0) return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VILLAIN_ASSUMPTIONS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(VILLAIN_ASSUMPTIONS_STORE_NAME);
    let errored = false;
    for (const a of assumptions) {
      if (!a || typeof a.villainId !== 'string' || typeof a.id !== 'string') continue;
      const request = store.put(a);
      request.onerror = () => {
        if (!errored) {
          errored = true;
          reject(request.error);
        }
      };
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

/**
 * Delete an assumption by compound key.
 * @param {string} villainId
 * @param {string} assumptionId
 */
export const deleteAssumption = async (villainId, assumptionId) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VILLAIN_ASSUMPTIONS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(VILLAIN_ASSUMPTIONS_STORE_NAME);
    const request = store.delete([villainId, assumptionId]);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Clear all assumptions. Used by test harness + admin reset.
 */
export const clearAllAssumptions = async () => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VILLAIN_ASSUMPTIONS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(VILLAIN_ASSUMPTIONS_STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// =============================================================================
// READS (with migration per I-AE-5)
// =============================================================================

/**
 * Load all assumptions for a specific villain.
 * Applies migration to v1.1 shape if any record is older.
 *
 * @param {string} villainId
 * @returns {Promise<Array>} VillainAssumption[] in v1.1 shape
 */
export const loadAssumptionsByVillain = async (villainId) => {
  if (typeof villainId !== 'string') return [];
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VILLAIN_ASSUMPTIONS_STORE_NAME, 'readonly');
    const store = tx.objectStore(VILLAIN_ASSUMPTIONS_STORE_NAME);
    const index = store.index('villainId');
    const request = index.getAll(villainId);
    request.onsuccess = () => {
      const records = request.result || [];
      try {
        const migrated = records.map(migrateIfNeeded);
        resolve(migrated);
      } catch (err) {
        logError(err);
        reject(err);
      }
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * Load all assumptions across all villains.
 * Applies migration as needed.
 */
export const loadAllAssumptions = async () => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VILLAIN_ASSUMPTIONS_STORE_NAME, 'readonly');
    const store = tx.objectStore(VILLAIN_ASSUMPTIONS_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const records = request.result || [];
      try {
        resolve(records.map(migrateIfNeeded));
      } catch (err) {
        logError(err);
        reject(err);
      }
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * Load only actionable assumptions (status === 'active') — common query
 * for live sidebar + drill-entry surfaces.
 */
export const loadActiveAssumptions = async () => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VILLAIN_ASSUMPTIONS_STORE_NAME, 'readonly');
    const store = tx.objectStore(VILLAIN_ASSUMPTIONS_STORE_NAME);
    const index = store.index('status');
    const request = index.getAll('active');
    request.onsuccess = () => {
      const records = request.result || [];
      try {
        resolve(records.map(migrateIfNeeded));
      } catch (err) {
        logError(err);
        reject(err);
      }
    };
    request.onerror = () => reject(request.error);
  });
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Migrate a persisted record if its schemaVersion is older than current.
 * Throws if migration fails or if the record is unrecognizably malformed.
 */
const migrateIfNeeded = (record) => {
  if (!record || typeof record !== 'object') return record;
  if (!needsMigration(record)) return record;
  try {
    const migrated = migratePersistedAssumption(record, record.schemaVersion, SCHEMA_VERSION);
    log(`Migrated assumption ${record.id} from ${record.schemaVersion} to ${SCHEMA_VERSION}`);
    return migrated;
  } catch (err) {
    logError(err);
    // Return original record with a flag; caller decides whether to use it.
    return { ...record, _migrationFailed: true, _migrationError: err.message };
  }
};
