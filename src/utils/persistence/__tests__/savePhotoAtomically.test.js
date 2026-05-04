// @vitest-environment jsdom
/**
 * @file Tests for savePhotoAtomically.js — atomic playerPhotos + players write.
 * Per WS-161 / SPR-036.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { savePhotoAtomically } from '../savePhotoAtomically';
import {
  closeDB,
  resetDBPool,
  DB_NAME,
  getDB,
  PLAYERS_STORE_NAME,
  PLAYER_PHOTOS_STORE_NAME,
} from '../database';
import { getPhotoBlob } from '../playerPhotosStore';

const deleteEntireDB = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
    req.onblocked = () => resolve();
  });

const seedPlayer = async (playerId, fields = {}) => {
  const db = await getDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYERS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(PLAYERS_STORE_NAME);
    const numericId = Number(playerId);
    const key = Number.isFinite(numericId) ? numericId : playerId;
    store.put({
      playerId: key,
      name: 'Test Player',
      photoBlobId: null,
      ...fields,
    });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
};

const readPlayer = async (playerId) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYERS_STORE_NAME, 'readonly');
    const store = tx.objectStore(PLAYERS_STORE_NAME);
    const numericId = Number(playerId);
    const key = Number.isFinite(numericId) ? numericId : playerId;
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
};

const countPhotosForPlayer = async (playerId) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYER_PHOTOS_STORE_NAME, 'readonly');
    const store = tx.objectStore(PLAYER_PHOTOS_STORE_NAME);
    const idx = store.index('by_playerId');
    const req = idx.count(playerId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

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

describe('savePhotoAtomically — preconditions', () => {
  it('throws on empty playerId', async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    await expect(savePhotoAtomically('', blob)).rejects.toThrow(/playerId/);
  });

  it('throws on missing blob', async () => {
    await expect(savePhotoAtomically('p1', null)).rejects.toThrow(/Blob/);
  });
});

describe('savePhotoAtomically — atomic round-trip', () => {
  it('saves blob + sets player.photoBlobId in single transaction', async () => {
    await seedPlayer('1');
    const blob = new Blob(['fake-jpeg'], { type: 'image/jpeg' });
    const result = await savePhotoAtomically('1', blob);

    expect(typeof result.blobId).toBe('number');
    expect(result.blobId).toBe(result.photoBlobId);

    const photo = await getPhotoBlob(result.blobId);
    expect(photo).toBeTruthy();
    expect(photo.playerId).toBe('1');

    const player = await readPlayer('1');
    expect(player.photoBlobId).toBe(result.blobId);
  });

  it('aborts when player does not exist (no orphan blob)', async () => {
    const blob = new Blob(['fake'], { type: 'image/jpeg' });
    await expect(savePhotoAtomically('999', blob)).rejects.toThrow(/aborted|not found/i);

    const count = await countPhotosForPlayer('999');
    expect(count).toBe(0);
  });

  it('concurrent saves get distinct blobIds', async () => {
    await seedPlayer('1');
    await seedPlayer('2');
    const blob1 = new Blob(['a'], { type: 'image/jpeg' });
    const blob2 = new Blob(['b'], { type: 'image/jpeg' });
    const [r1, r2] = await Promise.all([
      savePhotoAtomically('1', blob1),
      savePhotoAtomically('2', blob2),
    ]);
    expect(r1.blobId).not.toBe(r2.blobId);
    const p1 = await readPlayer('1');
    const p2 = await readPlayer('2');
    expect(p1.photoBlobId).toBe(r1.blobId);
    expect(p2.photoBlobId).toBe(r2.blobId);
  });

  it('replaces photoBlobId when player already has one (orphans old blob; documented)', async () => {
    await seedPlayer('1');
    const blob1 = new Blob(['v1'], { type: 'image/jpeg' });
    const blob2 = new Blob(['v2'], { type: 'image/jpeg' });
    const r1 = await savePhotoAtomically('1', blob1);
    const r2 = await savePhotoAtomically('1', blob2);
    expect(r2.blobId).not.toBe(r1.blobId);

    const player = await readPlayer('1');
    expect(player.photoBlobId).toBe(r2.blobId);

    // Orphan blob still readable (cleanup is out-of-scope v1).
    const oldBlob = await getPhotoBlob(r1.blobId);
    expect(oldBlob).toBeTruthy();
  });

  it('preserves other player fields on photo update', async () => {
    await seedPlayer('1', { name: 'Alice', wardrobe: ['black-hoodie'], ageDecade: '30s' });
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    await savePhotoAtomically('1', blob);
    const player = await readPlayer('1');
    expect(player.name).toBe('Alice');
    expect(player.wardrobe).toEqual(['black-hoodie']);
    expect(player.ageDecade).toBe('30s');
  });
});
