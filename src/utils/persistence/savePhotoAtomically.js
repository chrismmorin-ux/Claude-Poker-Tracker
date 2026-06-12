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
  atomicTx,
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
  // Players use autoincrement integer keys; older code path expected strings.
  // Accept either; the function already coerces to numeric for the IDB key.
  const isValidId =
    (typeof playerId === 'number' && Number.isFinite(playerId))
    || (typeof playerId === 'string' && playerId.length > 0);
  if (!isValidId) {
    throw new Error('savePhotoAtomically requires a non-empty playerId (number or string)');
  }
  if (!blob) {
    throw new Error('savePhotoAtomically requires a Blob');
  }

  let playerMissing = false;
  try {
    const result = await atomicTx(
      [PLAYER_PHOTOS_STORE_NAME, PLAYERS_STORE_NAME],
      (stores, tx, setResult) => {
        const photoReq = stores[PLAYER_PHOTOS_STORE_NAME].add({
          playerId,
          blob,
          capturedAt: Date.now(),
        });
        photoReq.onsuccess = () => {
          const blobId = photoReq.result;
          // Read the player + put with photoBlobId in same txn.
          const numericId = Number(playerId);
          const lookupKey = Number.isFinite(numericId) ? numericId : playerId;
          const getReq = stores[PLAYERS_STORE_NAME].get(lookupKey);
          getReq.onsuccess = () => {
            const player = getReq.result;
            if (!player) {
              // Abort the whole txn — blob add is rolled back automatically.
              playerMissing = true;
              tx.abort();
              return;
            }
            stores[PLAYERS_STORE_NAME].put({ ...player, photoBlobId: blobId });
            setResult({ blobId, photoBlobId: blobId });
          };
        };
      }
    );
    log(`savePhotoAtomically: blobId=${result.blobId} attached to playerId=${playerId}`);
    return result;
  } catch (e) {
    const err = playerMissing
      ? new Error('Photo save aborted (player not found or write failed)')
      : e;
    logError('savePhotoAtomically failed', err);
    throw err;
  }
};
