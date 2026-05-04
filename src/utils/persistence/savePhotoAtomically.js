/**
 * @file savePhotoAtomically.js — atomic write of a photo blob + Player.photoBlobId.
 *
 * Per `docs/design/surfaces/camera-capture-modal.md` §Atomic-txn binding:
 * camera modal MUST write the blob + the Player reference inside a single
 * IDB transaction. If the Player put fails (e.g., player was deleted
 * concurrently), the blob add is rolled back. No half-written state.
 *
 * Replaces existing photoBlobId without orphan cleanup (v1; future GC).
 *
 * SPR-036 / WS-161 (2026-05-04).
 */

import {
  getDB,
  PLAYER_PHOTOS_STORE_NAME,
  PLAYERS_STORE_NAME,
  log,
  logError,
} from './database';

/**
 * Save a photo blob + update Player.photoBlobId atomically.
 *
 * @param {string} playerId - target Player record key
 * @param {Blob} blob - JPEG/PNG blob from cropToSquare
 * @returns {Promise<{ blobId: number, photoBlobId: number }>}
 */
export const savePhotoAtomically = async (playerId, blob) => {
  if (typeof playerId !== 'string' || playerId.length === 0) {
    throw new Error('savePhotoAtomically requires a non-empty string playerId');
  }
  if (!blob) {
    throw new Error('savePhotoAtomically requires a Blob');
  }

  try {
    const db = await getDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(
        [PLAYER_PHOTOS_STORE_NAME, PLAYERS_STORE_NAME],
        'readwrite',
      );
      let blobId = null;
      let aborted = false;

      tx.oncomplete = () => {
        if (aborted) return;
        log(`savePhotoAtomically: blobId=${blobId} attached to playerId=${playerId}`);
        resolve({ blobId, photoBlobId: blobId });
      };
      tx.onerror = () => reject(tx.error || new Error('Photo save tx error'));
      tx.onabort = () => {
        aborted = true;
        reject(new Error('Photo save aborted (player not found or write failed)'));
      };

      const photosStore = tx.objectStore(PLAYER_PHOTOS_STORE_NAME);
      const playersStore = tx.objectStore(PLAYERS_STORE_NAME);

      const photoReq = photosStore.add({
        playerId,
        blob,
        capturedAt: Date.now(),
      });
      photoReq.onerror = () => {
        // Tx onerror will fire; nothing more to do here.
      };
      photoReq.onsuccess = () => {
        blobId = photoReq.result;
        // Read the player + put with photoBlobId in same txn.
        const numericId = Number(playerId);
        const lookupKey = Number.isFinite(numericId) ? numericId : playerId;
        const getReq = playersStore.get(lookupKey);
        getReq.onerror = () => { /* tx aborts on error */ };
        getReq.onsuccess = () => {
          const player = getReq.result;
          if (!player) {
            // Abort the whole txn — blob add is rolled back automatically.
            tx.abort();
            return;
          }
          playersStore.put({ ...player, photoBlobId: blobId });
        };
      };
    });
  } catch (e) {
    logError('savePhotoAtomically failed', e);
    throw e;
  }
};
