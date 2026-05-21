// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createReplaceAllStore } from '../createReplaceAllStore';
import { __testing__ } from '../migrationGuard';
import {
  getDB,
  closeDB,
  resetDBPool,
  DB_NAME,
  HERO_LEAKS_STORE_NAME,
} from '../../../persistence/database';

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
  __testing__.bypassMigrationCheck = false;
});

afterEach(async () => {
  closeDB();
  resetDBPool();
  __testing__.bypassMigrationCheck = false;
});

describe('createReplaceAllStore — construction-time assertions', () => {
  it('throws on missing config', () => {
    expect(() => createReplaceAllStore()).toThrow(TypeError);
  });

  it('throws on missing storeName', () => {
    expect(() => createReplaceAllStore({})).toThrow(/storeName/);
  });

  it('throws on unregistered storeName', () => {
    expect(() => createReplaceAllStore({ storeName: 'zzz-not-real' })).toThrow(/migrationRegistry/);
  });

  it('returns expected surface (CRUD + replaceAllForOwner)', () => {
    const wrapper = createReplaceAllStore({ storeName: HERO_LEAKS_STORE_NAME });
    expect(typeof wrapper.get).toBe('function');
    expect(typeof wrapper.getAll).toBe('function');
    expect(typeof wrapper.put).toBe('function');
    expect(typeof wrapper.delete).toBe('function');
    expect(typeof wrapper.getByIndex).toBe('function');
    expect(typeof wrapper.replaceAllForOwner).toBe('function');
    expect(wrapper.storeName).toBe(HERO_LEAKS_STORE_NAME);
  });
});

describe('createReplaceAllStore — replaceAllForOwner (scan fallback path)', () => {
  it('replaces ALL records for an owner in one atomic transaction', async () => {
    await getDB();
    // heroLeaks has compound keyPath [playerId, situationKey]. The scan
    // fallback handles this case via the `ownerKey` field on records.
    const store = createReplaceAllStore({
      storeName: HERO_LEAKS_STORE_NAME,
      ownerKey: 'playerId',
      ownerIndexName: 'by_playerId',
    });

    // Seed: 2 records for player-A + 1 record for player-B
    await store.put({
      playerId: 'player-A',
      situationKey: 'preflop:limp',
      rate: 0.4,
      sampleSize: 30,
    });
    await store.put({
      playerId: 'player-A',
      situationKey: 'flop:cbet',
      rate: 0.6,
      sampleSize: 30,
    });
    await store.put({
      playerId: 'player-B',
      situationKey: 'preflop:limp',
      rate: 0.2,
      sampleSize: 30,
    });

    // Replace ALL of player-A with a single new record
    await store.replaceAllForOwner('player-A', [
      { playerId: 'player-A', situationKey: 'river:bluff', rate: 0.1, sampleSize: 30 },
    ]);

    const all = await store.getAll();
    const playerArecords = all.filter((r) => r.playerId === 'player-A');
    const playerBrecords = all.filter((r) => r.playerId === 'player-B');

    expect(playerArecords).toHaveLength(1);
    expect(playerArecords[0].situationKey).toBe('river:bluff');
    expect(playerBrecords).toHaveLength(1);
    expect(playerBrecords[0].situationKey).toBe('preflop:limp');
  });

  it('handles empty replacement array (deletes all owner records)', async () => {
    await getDB();
    const store = createReplaceAllStore({
      storeName: HERO_LEAKS_STORE_NAME,
      ownerKey: 'playerId',
      ownerIndexName: 'by_playerId',
    });
    await store.put({
      playerId: 'player-X',
      situationKey: 'x',
      rate: 0.5,
      sampleSize: 30,
    });

    await store.replaceAllForOwner('player-X', []);

    const all = await store.getAll();
    expect(all.filter((r) => r.playerId === 'player-X')).toHaveLength(0);
  });

  it('throws on empty ownerId', async () => {
    await getDB();
    const store = createReplaceAllStore({
      storeName: HERO_LEAKS_STORE_NAME,
      ownerKey: 'playerId',
      ownerIndexName: 'by_playerId',
    });
    await expect(store.replaceAllForOwner('', [])).rejects.toThrow();
  });

  it('throws on non-array records', async () => {
    await getDB();
    const store = createReplaceAllStore({
      storeName: HERO_LEAKS_STORE_NAME,
      ownerKey: 'playerId',
      ownerIndexName: 'by_playerId',
    });
    await expect(store.replaceAllForOwner('player-X', null)).rejects.toThrow();
  });
});
