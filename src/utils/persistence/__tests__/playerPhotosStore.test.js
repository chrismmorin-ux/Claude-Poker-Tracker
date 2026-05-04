// @vitest-environment jsdom
/**
 * playerPhotosStore.test.js
 *
 * IDB v23 blob storage: save / get / cascade-delete.
 * Per WS-160 / SPR-034 (PIO Gate 5 child A).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  savePhoto,
  getPhotoBlob,
  deletePhotosForPlayer,
} from '../playerPhotosStore';
import { closeDB, resetDBPool, DB_NAME } from '../database';

const deleteEntireDB = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
    req.onblocked = () => resolve();
  });

beforeEach(async () => {
  closeDB();
  resetDBPool();
  await deleteEntireDB();
});

afterEach(async () => {
  closeDB();
  resetDBPool();
  await deleteEntireDB();
});

describe('playerPhotosStore — preconditions', () => {
  it('savePhoto requires non-empty playerId', async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    await expect(savePhoto('', blob)).rejects.toThrow(/playerId/);
  });

  it('savePhoto requires a Blob', async () => {
    await expect(savePhoto('p1', null)).rejects.toThrow(/Blob/);
    await expect(savePhoto('p1', 'not-a-blob')).rejects.toThrow(/Blob/);
  });

  it('getPhotoBlob requires a numeric blobId', async () => {
    await expect(getPhotoBlob('not-a-number')).rejects.toThrow(/numeric blobId/);
  });

  it('deletePhotosForPlayer requires non-empty playerId', async () => {
    await expect(deletePhotosForPlayer('')).rejects.toThrow(/playerId/);
  });
});

describe('playerPhotosStore — round-trip', () => {
  it('savePhoto returns a numeric blobId; getPhotoBlob retrieves the record', async () => {
    const blob = new Blob(['fake-jpeg-bytes'], { type: 'image/jpeg' });
    const blobId = await savePhoto('p1', blob);
    expect(typeof blobId).toBe('number');

    const record = await getPhotoBlob(blobId);
    expect(record).toBeTruthy();
    expect(record.playerId).toBe('p1');
    expect(record.blob).toBeDefined();
    expect(typeof record.capturedAt).toBe('number');
  });

  it('returns null for absent blobId', async () => {
    const record = await getPhotoBlob(999999);
    expect(record).toBeNull();
  });
});

describe('playerPhotosStore — cascade delete', () => {
  it('deletes all blobs for a player', async () => {
    const blob = new Blob(['a'], { type: 'image/jpeg' });
    const id1 = await savePhoto('p1', blob);
    const id2 = await savePhoto('p1', new Blob(['b'], { type: 'image/jpeg' }));
    await savePhoto('p2', new Blob(['c'], { type: 'image/jpeg' }));

    const count = await deletePhotosForPlayer('p1');
    expect(count).toBe(2);
    expect(await getPhotoBlob(id1)).toBeNull();
    expect(await getPhotoBlob(id2)).toBeNull();
    // p2's photo should still exist
    const remaining = await deletePhotosForPlayer('p2');
    expect(remaining).toBe(1);
  });

  it('returns 0 when no photos exist for a player', async () => {
    const count = await deletePhotosForPlayer('nonexistent');
    expect(count).toBe(0);
  });
});
