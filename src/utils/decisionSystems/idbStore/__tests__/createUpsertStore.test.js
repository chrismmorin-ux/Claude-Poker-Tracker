// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createUpsertStore } from '../createUpsertStore';
import { __testing__ } from '../migrationGuard';
import {
  getDB,
  closeDB,
  resetDBPool,
  DB_NAME,
  EXPLOIT_ANCHORS_STORE_NAME,
} from '../../../persistence/database';

// Use exploitAnchors (keyPath: 'id') for round-trip tests; hands has
// keyPath 'handId' with autoIncrement so it wouldn't exercise the
// string-key get() path.
const TEST_STORE = EXPLOIT_ANCHORS_STORE_NAME;

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

describe('createUpsertStore — construction-time assertions', () => {
  it('throws on missing config', () => {
    expect(() => createUpsertStore()).toThrow(TypeError);
  });

  it('throws on missing storeName', () => {
    expect(() => createUpsertStore({})).toThrow(/storeName/);
  });

  it('throws on unregistered storeName (bound to migrationRegistry)', () => {
    expect(() => createUpsertStore({ storeName: 'zzz-not-real' })).toThrow(
      /migrationRegistry/,
    );
  });

  it('allows unregistered storeName when bypass flag is on', () => {
    __testing__.bypassMigrationCheck = true;
    expect(() => createUpsertStore({ storeName: 'zzz-not-real' })).not.toThrow();
  });

  it('succeeds for a registered storeName', () => {
    expect(() => createUpsertStore({ storeName: TEST_STORE })).not.toThrow();
  });

  it('returns an object with the expected CRUD surface', () => {
    const wrapper = createUpsertStore({ storeName: TEST_STORE });
    expect(typeof wrapper.get).toBe('function');
    expect(typeof wrapper.getAll).toBe('function');
    expect(typeof wrapper.put).toBe('function');
    expect(typeof wrapper.delete).toBe('function');
    expect(typeof wrapper.getByIndex).toBe('function');
    expect(wrapper.storeName).toBe(TEST_STORE);
  });
});

describe('createUpsertStore — IDB round-trip against the exploitAnchors store', () => {
  it('put + get round-trip', async () => {
    await getDB(); // run migrations to current version
    const store = createUpsertStore({ storeName: TEST_STORE });
    const record = { id: 'anchor:test:1', villainId: 'v1', status: 'active' };
    await store.put(record);
    const read = await store.get('anchor:test:1');
    expect(read).toEqual(record);
  });

  it('get returns null for missing key', async () => {
    await getDB();
    const store = createUpsertStore({ storeName: TEST_STORE });
    const read = await store.get('anchor:nope');
    expect(read).toBeNull();
  });

  it('getAll returns all records', async () => {
    await getDB();
    const store = createUpsertStore({ storeName: TEST_STORE });
    await store.put({ id: 'anchor:a', villainId: 'v', status: 'active' });
    await store.put({ id: 'anchor:b', villainId: 'v', status: 'active' });
    await store.put({ id: 'anchor:c', villainId: 'v', status: 'active' });
    const all = await store.getAll();
    expect(all).toHaveLength(3);
    expect(all.map((r) => r.id).sort()).toEqual(['anchor:a', 'anchor:b', 'anchor:c']);
  });

  it('delete removes a record', async () => {
    await getDB();
    const store = createUpsertStore({ storeName: TEST_STORE });
    await store.put({ id: 'anchor:del', villainId: 'v', status: 'active' });
    await store.delete('anchor:del');
    const read = await store.get('anchor:del');
    expect(read).toBeNull();
  });

  it('put is upsert (second put with same id replaces first)', async () => {
    await getDB();
    const store = createUpsertStore({ storeName: TEST_STORE });
    await store.put({ id: 'anchor:up', villainId: 'v', status: 'active', v: 1 });
    await store.put({ id: 'anchor:up', villainId: 'v', status: 'active', v: 2 });
    const read = await store.get('anchor:up');
    expect(read.v).toBe(2);
  });

  it('getByIndex returns matching records by indexed field', async () => {
    await getDB();
    const store = createUpsertStore({ storeName: TEST_STORE });
    await store.put({ id: 'anchor:1', villainId: 'vA', status: 'active' });
    await store.put({ id: 'anchor:2', villainId: 'vB', status: 'active' });
    await store.put({ id: 'anchor:3', villainId: 'vA', status: 'active' });
    const vAAnchors = await store.getByIndex('villainId', 'vA');
    expect(vAAnchors.map((r) => r.id).sort()).toEqual(['anchor:1', 'anchor:3']);
  });
});

describe('createUpsertStore — input validation', () => {
  let store;
  beforeEach(() => {
    store = createUpsertStore({ storeName: TEST_STORE });
  });

  it('get throws on empty key', async () => {
    await expect(store.get('')).rejects.toThrow();
  });

  it('get throws on non-string key', async () => {
    await expect(store.get(null)).rejects.toThrow();
  });

  it('delete throws on empty key', async () => {
    await expect(store.delete('')).rejects.toThrow();
  });

  it('put throws on missing record', async () => {
    await expect(store.put(null)).rejects.toThrow();
  });

  it('getByIndex throws on missing indexName', async () => {
    await expect(store.getByIndex('', 'x')).rejects.toThrow();
  });
});
