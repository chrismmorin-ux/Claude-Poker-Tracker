/**
 * @file sightingLogsStore.js — IDB CRUD for the PIO `sightingLogs` store (v23).
 *
 * Append-only per-event store of player sightings. Each record stores the
 * attribute snapshot observed in a single session/sighting context. Bayesian-
 * Beta posteriors are derived at READ-TIME by `computeStability()` — the
 * store itself just keeps raw events, indexed for efficient retrieval.
 *
 * Per `docs/design/audits/2026-05-02-gate4-design-player-identification-v2.md`
 * §PIO-G4-MIG (lines 391–427).
 *
 * Per AP-PIO-02 source-util-policy: this store is READ-ALLOWED only by:
 *   - PlayerProfileView (sighting history rendering)
 *   - PlayerEditorView (attribute panel + edit)
 *   - PlayersView (filter/search)
 *   - Table-Build CandidateColumn (recognition ranking)
 * BLACKLISTED: live-table surfaces (OnlineView, sidebar HUD, ShowdownView).
 *
 * SPR-034 / WS-160 (2026-05-04).
 */

import {
  readTx,
  writeTx,
  cursorTx,
  SIGHTING_LOGS_STORE_NAME,
  log,
  logError,
} from './database';

/**
 * Append a new sighting record. Returns the autoincrement sightingId.
 *
 * @param {object} sighting - { playerId, sessionId, capturedAt, venueId, featuresSeen, attributes }
 * @returns {Promise<number>} - generated sightingId
 */
// playerId can be a number (the players store uses autoIncrement integer
// keys) or a string (for future cross-venue stable IDs). Both shapes index
// fine — accept either.
const isValidPlayerId = (id) => {
  if (typeof id === 'number') return Number.isFinite(id);
  if (typeof id === 'string') return id.length > 0;
  return false;
};

export const appendSighting = async (sighting) => {
  if (!sighting || typeof sighting !== 'object') {
    throw new Error('appendSighting requires a sighting object');
  }
  if (!isValidPlayerId(sighting.playerId)) {
    throw new Error('appendSighting requires sighting.playerId (number or non-empty string)');
  }
  try {
    return await writeTx(SIGHTING_LOGS_STORE_NAME, (store) => store.add({
      ...sighting,
      // Default optional fields so indexes don't choke on undefined.
      capturedAt: sighting.capturedAt ?? Date.now(),
      venueId: sighting.venueId ?? null,
      featuresSeen: Array.isArray(sighting.featuresSeen) ? sighting.featuresSeen : [],
    }));
  } catch (e) {
    logError('appendSighting failed', e);
    throw e;
  }
};

/**
 * Read all sightings for a given playerId. Sorted by capturedAt descending
 * (most-recent first) for natural display order.
 *
 * @param {string} playerId
 * @returns {Promise<Array>}
 */
export const getSightingsForPlayer = async (playerId) => {
  if (!isValidPlayerId(playerId)) {
    throw new Error('getSightingsForPlayer requires a non-empty playerId (number or string)');
  }
  try {
    const records = (await readTx(SIGHTING_LOGS_STORE_NAME, (store) => store.index('by_playerId').getAll(playerId))) || [];
    records.sort((a, b) => (b.capturedAt || 0) - (a.capturedAt || 0));
    return records;
  } catch (e) {
    logError('getSightingsForPlayer failed', e);
    return [];
  }
};

/**
 * Read all sightings for a (playerId, sessionId) pair.
 *
 * @param {string} playerId
 * @param {string|number} sessionId
 * @returns {Promise<Array>}
 */
export const getSightingsBySession = async (playerId, sessionId) => {
  if (!playerId || sessionId === undefined || sessionId === null) {
    throw new Error('getSightingsBySession requires playerId + sessionId');
  }
  try {
    const records = await readTx(SIGHTING_LOGS_STORE_NAME, (store) => store.index('by_playerId_sessionId').getAll([playerId, sessionId]));
    return records || [];
  } catch (e) {
    logError('getSightingsBySession failed', e);
    return [];
  }
};

/**
 * Read all sightings whose `featuresSeen` array contains the given feature
 * (multiEntry index lookup). Useful for "find all sightings tagged with hat".
 *
 * @param {string} feature
 * @returns {Promise<Array>}
 */
export const getSightingsByFeature = async (feature) => {
  if (typeof feature !== 'string' || feature.length === 0) {
    throw new Error('getSightingsByFeature requires a non-empty feature');
  }
  try {
    const records = await readTx(SIGHTING_LOGS_STORE_NAME, (store) => store.index('by_featuresSeen').getAll(feature));
    return records || [];
  } catch (e) {
    logError('getSightingsByFeature failed', e);
    return [];
  }
};

/**
 * Delete all sightings for a given playerId. Used by Player-delete cascade.
 *
 * @param {string} playerId
 * @returns {Promise<number>} - count deleted
 */
export const deleteSightingsForPlayer = async (playerId) => {
  if (!isValidPlayerId(playerId)) {
    throw new Error('deleteSightingsForPlayer requires a non-empty playerId (number or string)');
  }
  try {
    const deleted = await cursorTx(
      SIGHTING_LOGS_STORE_NAME,
      { index: 'by_playerId', range: IDBKeyRange.only(playerId), mode: 'readwrite' },
      (cursor, acc) => {
        cursor.delete();
        acc.push(cursor.primaryKey);
      }
    );
    log(`deleteSightingsForPlayer(${playerId}): ${deleted.length} records deleted`);
    return deleted.length;
  } catch (e) {
    logError('deleteSightingsForPlayer failed', e);
    return 0;
  }
};
