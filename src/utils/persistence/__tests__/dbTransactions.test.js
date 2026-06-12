/**
 * dbTransactions.test.js — WS-226
 *
 * Tests the shared transaction helpers (readTx/writeTx/updateTx/cursorTx/
 * atomicTx) added in WS-226. Covers the binding contract:
 *   - raw DOMException rejection (never wrapped) — error.name checks survive
 *   - write helpers resolve AFTER commit (durable-writes decision)
 *   - updateTx/atomicTx abort-and-rollback semantics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

vi.mock('../../errorHandler', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    action: vi.fn(),
  },
  DEBUG: false,
}));

import {
  initDB,
  resetDBPool,
  closeDB,
  readTx,
  writeTx,
  updateTx,
  cursorTx,
  atomicTx,
  STORE_NAME,
  SETTINGS_STORE_NAME,
  PLAYERS_STORE_NAME,
  PLAYER_DRAFTS_STORE_NAME,
} from '../database';

beforeEach(() => {
  resetDBPool();
  globalThis.indexedDB = new IDBFactory();
  globalThis.window = { indexedDB: globalThis.indexedDB };
});

afterEach(() => {
  closeDB(); // WS-126: prevent stale-DB pollution into next test's IDBFactory swap
  delete globalThis.window;
});

const seedHand = (record) => writeTx(STORE_NAME, (s) => s.add(record));

describe('readTx', () => {
  it('resolves the record on get hit', async () => {
    await initDB();
    const id = await seedHand({ userId: 'guest', timestamp: 1 });
    const hand = await readTx(STORE_NAME, (s) => s.get(id));
    expect(hand.userId).toBe('guest');
  });

  it('resolves undefined on get miss', async () => {
    await initDB();
    expect(await readTx(STORE_NAME, (s) => s.get(99999))).toBeUndefined();
  });

  it('resolves all records on getAll', async () => {
    await initDB();
    await seedHand({ userId: 'guest', timestamp: 1 });
    await seedHand({ userId: 'guest', timestamp: 2 });
    const all = await readTx(STORE_NAME, (s) => s.getAll());
    expect(all).toHaveLength(2);
  });

  it('resolves count()', async () => {
    await initDB();
    await seedHand({ userId: 'guest', timestamp: 1 });
    expect(await readTx(STORE_NAME, (s) => s.count())).toBe(1);
  });

  it('supports index-based reads', async () => {
    await initDB();
    await seedHand({ userId: 'u1', timestamp: 1 });
    await seedHand({ userId: 'u2', timestamp: 2 });
    const u1Count = await readTx(STORE_NAME, (s) => s.index('userId').count('u1'));
    expect(u1Count).toBe(1);
  });
});

describe('writeTx', () => {
  it('put resolves after commit and the record is durable', async () => {
    await initDB();
    await writeTx(SETTINGS_STORE_NAME, (s) => s.put({ id: 'settings_guest', theme: 'dark' }));
    const rec = await readTx(SETTINGS_STORE_NAME, (s) => s.get('settings_guest'));
    expect(rec.theme).toBe('dark');
  });

  it('add resolves the generated key', async () => {
    await initDB();
    const key = await writeTx(STORE_NAME, (s) => s.add({ userId: 'guest', timestamp: 1 }));
    expect(typeof key).toBe('number');
  });

  it('delete removes the record', async () => {
    await initDB();
    const id = await seedHand({ userId: 'guest', timestamp: 1 });
    await writeTx(STORE_NAME, (s) => s.delete(id));
    expect(await readTx(STORE_NAME, (s) => s.get(id))).toBeUndefined();
  });

  it('rejects with the raw ConstraintError on duplicate add (abort → reject path)', async () => {
    await initDB();
    await writeTx(SETTINGS_STORE_NAME, (s) => s.add({ id: 'dup', theme: 'dark' }));
    let caught = null;
    try {
      await writeTx(SETTINGS_STORE_NAME, (s) => s.add({ id: 'dup', theme: 'light' }));
    } catch (err) {
      caught = err;
    }
    expect(caught).not.toBeNull();
    expect(caught.name).toBe('ConstraintError'); // raw DOMException, never wrapped
  });
});

describe('updateTx', () => {
  it('reads, mutates, and writes back in one transaction', async () => {
    await initDB();
    const id = await seedHand({ userId: 'guest', timestamp: 1, potSize: 10 });
    const updated = await updateTx(STORE_NAME, id, (hand) => {
      hand.potSize = 25;
      return hand;
    });
    expect(updated.potSize).toBe(25);
    const rec = await readTx(STORE_NAME, (s) => s.get(id));
    expect(rec.potSize).toBe(25);
  });

  it('rejects with the thrown error when mutate throws, leaving the record unchanged', async () => {
    await initDB();
    const id = await seedHand({ userId: 'guest', timestamp: 1, potSize: 10 });
    const boom = new Error('Hand not in expected state');
    let caught = null;
    try {
      await updateTx(STORE_NAME, id, () => { throw boom; });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBe(boom);
    const rec = await readTx(STORE_NAME, (s) => s.get(id));
    expect(rec.potSize).toBe(10);
  });

  it('skips the write and resolves undefined when mutate returns undefined', async () => {
    await initDB();
    const id = await seedHand({ userId: 'guest', timestamp: 1, potSize: 10 });
    const result = await updateTx(STORE_NAME, id, () => undefined);
    expect(result).toBeUndefined();
    const rec = await readTx(STORE_NAME, (s) => s.get(id));
    expect(rec.potSize).toBe(10);
  });
});

describe('cursorTx', () => {
  it('walks the full store accumulating via visit', async () => {
    await initDB();
    await seedHand({ userId: 'guest', timestamp: 1 });
    await seedHand({ userId: 'guest', timestamp: 2 });
    await seedHand({ userId: 'guest', timestamp: 3 });
    const timestamps = await cursorTx(STORE_NAME, {}, (cursor, acc) => {
      acc.push(cursor.value.timestamp);
    });
    expect(timestamps).toEqual([1, 2, 3]);
  });

  it('scopes the walk with an index + IDBKeyRange', async () => {
    await initDB();
    await seedHand({ userId: 'u1', timestamp: 1 });
    await seedHand({ userId: 'u2', timestamp: 2 });
    await seedHand({ userId: 'u1', timestamp: 3 });
    const u1 = await cursorTx(
      STORE_NAME,
      { index: 'userId', range: IDBKeyRange.only('u1') },
      (cursor, acc) => { acc.push(cursor.value.timestamp); }
    );
    expect(u1).toEqual([1, 3]);
  });

  it('stops early when visit returns false (loadLatestHand shape)', async () => {
    await initDB();
    await seedHand({ userId: 'guest', timestamp: 1 });
    await seedHand({ userId: 'guest', timestamp: 2 });
    await seedHand({ userId: 'guest', timestamp: 3 });
    const latest = await cursorTx(STORE_NAME, { direction: 'prev' }, (cursor, acc) => {
      acc.push(cursor.value.timestamp);
      return false;
    });
    expect(latest).toEqual([3]);
  });

  it('permits cursor.delete() in readwrite mode', async () => {
    await initDB();
    await seedHand({ userId: 'u1', timestamp: 1 });
    await seedHand({ userId: 'u2', timestamp: 2 });
    await cursorTx(
      STORE_NAME,
      { index: 'userId', range: IDBKeyRange.only('u1'), mode: 'readwrite' },
      (cursor) => { cursor.delete(); }
    );
    expect(await readTx(STORE_NAME, (s) => s.count())).toBe(1);
  });
});

describe('atomicTx', () => {
  it('commits across two stores and resolves the setResult value (commitDraft shape)', async () => {
    await initDB();
    await writeTx(PLAYER_DRAFTS_STORE_NAME, (s) => s.put({ userId: 'guest', draft: { name: 'Mike' } }));
    const playerId = await atomicTx(
      [PLAYERS_STORE_NAME, PLAYER_DRAFTS_STORE_NAME],
      (stores, tx, setResult) => {
        const addReq = stores[PLAYERS_STORE_NAME].add({ name: 'Mike', userId: 'guest' });
        addReq.onsuccess = () => {
          setResult(addReq.result);
          stores[PLAYER_DRAFTS_STORE_NAME].delete('guest');
        };
      }
    );
    expect(typeof playerId).toBe('number');
    const player = await readTx(PLAYERS_STORE_NAME, (s) => s.get(playerId));
    expect(player.name).toBe('Mike');
    expect(await readTx(PLAYER_DRAFTS_STORE_NAME, (s) => s.get('guest'))).toBeUndefined();
  });

  it('rolls back ALL stores when one request fails (atomicity proof)', async () => {
    await initDB();
    await writeTx(SETTINGS_STORE_NAME, (s) => s.add({ id: 'occupied', theme: 'dark' }));
    let caught = null;
    try {
      await atomicTx([PLAYERS_STORE_NAME, SETTINGS_STORE_NAME], (stores) => {
        stores[PLAYERS_STORE_NAME].add({ name: 'Ghost', userId: 'guest' });
        stores[SETTINGS_STORE_NAME].add({ id: 'occupied', theme: 'light' }); // ConstraintError → abort
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).not.toBeNull();
    expect(caught.name).toBe('ConstraintError');
    // The player write in the same tx must have rolled back
    expect(await readTx(PLAYERS_STORE_NAME, (s) => s.count())).toBe(0);
  });

  it('rejects with the thrown error on synchronous throw, writing nothing', async () => {
    await initDB();
    const boom = new Error('validation failed');
    let caught = null;
    try {
      await atomicTx([PLAYERS_STORE_NAME, PLAYER_DRAFTS_STORE_NAME], (stores) => {
        stores[PLAYERS_STORE_NAME].add({ name: 'Ghost', userId: 'guest' });
        throw boom;
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBe(boom);
    expect(await readTx(PLAYERS_STORE_NAME, (s) => s.count())).toBe(0);
  });
});
