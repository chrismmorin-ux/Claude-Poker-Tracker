/**
 * @file playerPhotosStore.js — IDB CRUD for the PIO `playerPhotos` store (v23).
 *
 * Blob storage for player photos captured via the PIO Camera Capture Modal.
 * Cascade-on-delete when the parent Player is deleted.
 *
 * Per `docs/design/surfaces/camera-capture-modal.md` §Atomic-txn binding —
 * camera modal writes blob + Player.photoBlobId reference inside a single
 * transaction. This store is the blob side of that pair.
 *
 * Per AP-PIO-03: photo capture is OFF by default. The Settings master toggle
 * (`photoCaptureEnabled`) gates the camera entry button app-wide. This store
 * does not enforce that toggle — call sites do.
 *
 * Per AP-PIO-02 source-util-policy: BLACKLISTED for live-table surfaces.
 *
 * SPR-034 / WS-160 (2026-05-04).
 */

import {
  readTx,
  writeTx,
  cursorTx,
  PLAYER_PHOTOS_STORE_NAME,
  log,
  logError,
} from './database';

/**
 * Save a photo blob for a player. Returns the autoincrement blobId.
 * Caller is responsible for atomically updating Player.photoBlobId in the
 * same transaction (see camera-capture-modal.md §Atomic-txn binding).
 *
 * @param {string} playerId
 * @param {Blob} blob - image blob (typically a 256x256 JPEG @ 0.85 quality, ~25KB)
 * @returns {Promise<number>} - generated blobId
 */
export const savePhoto = async (playerId, blob) => {
  if (typeof playerId !== 'string' || playerId.length === 0) {
    throw new Error('savePhoto requires a non-empty string playerId');
  }
  if (!(blob instanceof Blob) && !(blob && typeof blob === 'object' && 'size' in blob)) {
    // Accept Blob OR Blob-like (test envs may use a polyfill).
    throw new Error('savePhoto requires a Blob');
  }
  try {
    return await writeTx(PLAYER_PHOTOS_STORE_NAME, (store) => store.add({
      playerId,
      blob,
      capturedAt: Date.now(),
    }));
  } catch (e) {
    logError('savePhoto failed', e);
    throw e;
  }
};

/**
 * Read a photo blob by blobId. Returns null if absent.
 *
 * @param {number} blobId
 * @returns {Promise<{blobId, playerId, blob, capturedAt}|null>}
 */
export const getPhotoBlob = async (blobId) => {
  if (typeof blobId !== 'number' || !Number.isFinite(blobId)) {
    throw new Error('getPhotoBlob requires a numeric blobId');
  }
  try {
    const record = await readTx(PLAYER_PHOTOS_STORE_NAME, (store) => store.get(blobId));
    return record ?? null;
  } catch (e) {
    logError('getPhotoBlob failed', e);
    return null;
  }
};

/**
 * Delete all photos for a given playerId. Cascade on Player deletion.
 *
 * @param {string} playerId
 * @returns {Promise<number>} - count deleted
 */
export const deletePhotosForPlayer = async (playerId) => {
  if (typeof playerId !== 'string' || playerId.length === 0) {
    throw new Error('deletePhotosForPlayer requires a non-empty string playerId');
  }
  try {
    const deleted = await cursorTx(
      PLAYER_PHOTOS_STORE_NAME,
      { index: 'by_playerId', range: IDBKeyRange.only(playerId), mode: 'readwrite' },
      (cursor, acc) => {
        cursor.delete();
        acc.push(cursor.primaryKey);
      }
    );
    log(`deletePhotosForPlayer(${playerId}): ${deleted.length} blobs deleted`);
    return deleted.length;
  } catch (e) {
    logError('deletePhotosForPlayer failed', e);
    return 0;
  }
};
