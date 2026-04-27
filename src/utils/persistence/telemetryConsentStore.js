/**
 * telemetryConsentStore.js — IDB CRUD for the v21 `telemetryConsent` store
 *
 * Provides read + write operations for the telemetry consent record.
 * Singleton per user (keyPath: userId). The store is created at v21 by
 * migrateV21 with a seeded guest record.
 *
 * MPMF G5-B2 (2026-04-26).
 *
 * The persistence hook (`useTelemetryConsentPersistence`) is the only
 * caller from app code. The first-launch panel + Settings TelemetrySection
 * dispatch through the reducer; the hook debounces those state changes
 * back to IDB via `putTelemetryConsent`.
 */

import {
  getDB,
  TELEMETRY_CONSENT_STORE_NAME,
  GUEST_USER_ID,
  log,
  logError,
} from './database';

/**
 * Read the telemetry consent record for a given user.
 *
 * @param {string} userId - User ID (defaults to GUEST_USER_ID)
 * @returns {Promise<Object|null>} Record or null if not found
 */
export const getTelemetryConsent = async (userId = GUEST_USER_ID) => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TELEMETRY_CONSENT_STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(TELEMETRY_CONSENT_STORE_NAME);
      const request = objectStore.get(userId);

      request.onsuccess = () => {
        const record = request.result;
        if (record) {
          log(`Telemetry consent loaded for user ${userId}`);
          resolve(record);
        } else {
          log(`No telemetry consent record found for user ${userId}`);
          resolve(null);
        }
      };

      request.onerror = (event) => {
        logError('Failed to get telemetry consent:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    logError('Error in getTelemetryConsent:', error);
    throw error;
  }
};

/**
 * Write (create or replace) the telemetry consent record for a given user.
 *
 * @param {Object} record - Full record (must include userId)
 * @returns {Promise<void>}
 */
export const putTelemetryConsent = async (record) => {
  if (!record || !record.userId) {
    throw new Error('putTelemetryConsent requires a record with a userId field');
  }
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TELEMETRY_CONSENT_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(TELEMETRY_CONSENT_STORE_NAME);
      const request = objectStore.put(record);

      request.onsuccess = () => {
        log(`Telemetry consent saved for user ${record.userId}`);
        resolve();
      };

      request.onerror = (event) => {
        logError('Failed to save telemetry consent:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    logError('Error in putTelemetryConsent:', error);
    throw error;
  }
};

/**
 * Delete the telemetry consent record for a given user. Reserved for
 * testing / dev reset flows. Not used by app code — Settings → Telemetry
 * has a "Reset to defaults" affordance which dispatches RESET_TO_DEFAULTS
 * (preserves firstLaunchSeenAt per MPMF-AP-13) rather than calling delete.
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
export const deleteTelemetryConsent = async (userId = GUEST_USER_ID) => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([TELEMETRY_CONSENT_STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(TELEMETRY_CONSENT_STORE_NAME);
      const request = objectStore.delete(userId);

      request.onsuccess = () => {
        log(`Telemetry consent deleted for user ${userId}`);
        resolve();
      };

      request.onerror = (event) => {
        logError('Failed to delete telemetry consent:', event.target.error);
        reject(event.target.error);
      };
    });
  } catch (error) {
    logError('Error in deleteTelemetryConsent:', error);
    throw error;
  }
};
