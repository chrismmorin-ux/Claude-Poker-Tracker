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
  readTx,
  writeTx,
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
    const record = await readTx(TELEMETRY_CONSENT_STORE_NAME, (store) => store.get(userId));
    log(record
      ? `Telemetry consent loaded for user ${userId}`
      : `No telemetry consent record found for user ${userId}`);
    return record ?? null;
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
    await writeTx(TELEMETRY_CONSENT_STORE_NAME, (store) => store.put(record));
    log(`Telemetry consent saved for user ${record.userId}`);
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
    await writeTx(TELEMETRY_CONSENT_STORE_NAME, (store) => store.delete(userId));
    log(`Telemetry consent deleted for user ${userId}`);
  } catch (error) {
    logError('Error in deleteTelemetryConsent:', error);
    throw error;
  }
};
