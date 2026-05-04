/**
 * @file heroLeaksStore.js — IDB CRUD for the SCF `heroLeaks` store (v22).
 *
 * Composite keypath [playerId, situationKey] per SCF G3 SCHEMA spec.
 *
 * Per `src/utils/skillAssessment/CLAUDE.md` source-util-policy whitelist:
 *   READ-ALLOWED: HandReplayView (review-mode only), SelfCoachView.
 *   BLACKLISTED: live-table surfaces (OnlineView, sidebar HUD, TableView,
 *                TournamentView, ShowdownView).
 *
 * Per chris-live-player.md autonomy red line #8 (no cross-surface contamination).
 *
 * SPR-030 / WS-145 (2026-05-03).
 */

import {
  getDB,
  HERO_LEAKS_STORE_NAME,
  log,
  logError,
} from './database';

/**
 * Read all leaks for a given playerId. Returns array of leak records sorted
 * by severity descending (highest-severity leaks first).
 *
 * @param {string} playerId
 * @returns {Promise<Array>}
 */
export const getLeaksForPlayer = async (playerId) => {
  if (typeof playerId !== 'string' || playerId.length === 0) {
    throw new Error('getLeaksForPlayer requires a non-empty string playerId');
  }
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HERO_LEAKS_STORE_NAME, 'readonly');
      const store = tx.objectStore(HERO_LEAKS_STORE_NAME);
      const idx = store.index('by_playerId');
      const req = idx.getAll(playerId);
      req.onsuccess = () => {
        const records = req.result || [];
        records.sort((a, b) => (b.severity || 0) - (a.severity || 0));
        resolve(records);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    logError('getLeaksForPlayer failed', e);
    return [];
  }
};

/**
 * Read a single leak by composite key.
 *
 * @param {string} playerId
 * @param {string} situationKey
 * @returns {Promise<object|null>}
 */
export const getLeak = async (playerId, situationKey) => {
  if (!playerId || !situationKey) {
    throw new Error('getLeak requires playerId + situationKey');
  }
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HERO_LEAKS_STORE_NAME, 'readonly');
      const store = tx.objectStore(HERO_LEAKS_STORE_NAME);
      const req = store.get([playerId, situationKey]);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    logError('getLeak failed', e);
    return null;
  }
};

/**
 * Upsert a leak record. Composite key derived from record.playerId + record.situationKey.
 *
 * @param {object} record - Must include playerId, situationKey, leakRuleId,
 *   observedRate, ciLower, ciUpper, sampleSize, solverBaseline,
 *   relatedConceptId, severity, confidence, lastUpdatedAt.
 * @returns {Promise<void>}
 */
export const putLeak = async (record) => {
  if (!record?.playerId || !record?.situationKey) {
    throw new Error('putLeak requires record.playerId + record.situationKey');
  }
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HERO_LEAKS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(HERO_LEAKS_STORE_NAME);
      const toWrite = {
        ...record,
        lastUpdatedAt: record.lastUpdatedAt ?? Date.now(),
      };
      const req = store.put(toWrite);
      req.onsuccess = () => {
        log(`heroLeaks put ${record.playerId}/${record.situationKey}`);
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    logError('putLeak failed', e);
    throw e;
  }
};

/**
 * Snooze a leak — sets snoozedUntil = now + 7 days. Persisted across sessions.
 *
 * @param {string} playerId
 * @param {string} situationKey
 * @returns {Promise<void>}
 */
export const snoozeLeak = async (playerId, situationKey) => {
  const existing = await getLeak(playerId, situationKey);
  if (!existing) return;
  const snoozedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
  await putLeak({ ...existing, snoozedUntil });
};

/**
 * Bulk replace all leaks for a player with the new set. Used when a fresh
 * detector run produces new fired leaks; preserves snoozedUntil from prior
 * records (so snoozes survive re-detection).
 *
 * @param {string} playerId
 * @param {Array<object>} firedLeaks - Output of detectHeroLeaks(); each leak
 *   gets playerId stamped on it before write.
 * @returns {Promise<void>}
 */
export const replacePlayerLeaks = async (playerId, firedLeaks) => {
  if (!playerId) throw new Error('replacePlayerLeaks requires playerId');
  if (!Array.isArray(firedLeaks)) firedLeaks = [];

  const existing = await getLeaksForPlayer(playerId);
  const snoozeMap = new Map(
    existing.filter((r) => r.snoozedUntil).map((r) => [r.situationKey, r.snoozedUntil]),
  );

  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HERO_LEAKS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(HERO_LEAKS_STORE_NAME);

      // Clear existing player records.
      const idx = store.index('by_playerId');
      const cursorReq = idx.openCursor(playerId);
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
          return;
        }
        // Insert fresh records, preserving snoozedUntil from prior writes.
        for (const leak of firedLeaks) {
          const snoozed = snoozeMap.get(leak.situationKey) || null;
          store.put({
            ...leak,
            playerId,
            snoozedUntil: snoozed,
            dismissedAt: null, // dismiss is session-local; not persisted
            lastUpdatedAt: Date.now(),
          });
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    logError('replacePlayerLeaks failed', e);
    throw e;
  }
};
