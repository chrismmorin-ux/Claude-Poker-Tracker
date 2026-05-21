// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEmbeddedRecordStore } from '../createEmbeddedRecordStore';
import { createUpsertStore } from '../createUpsertStore';
import { __testing__ } from '../migrationGuard';
import {
  getDB,
  closeDB,
  resetDBPool,
  DB_NAME,
  EXPLOIT_ANCHORS_STORE_NAME,
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

describe('createEmbeddedRecordStore — construction-time assertions', () => {
  it('throws on missing config', () => {
    expect(() => createEmbeddedRecordStore()).toThrow(TypeError);
  });

  it('throws on missing hostStoreName', () => {
    expect(() => createEmbeddedRecordStore({ embeddedKey: 'x' })).toThrow(/hostStoreName/);
  });

  it('throws on missing embeddedKey', () => {
    expect(() => createEmbeddedRecordStore({
      hostStoreName: EXPLOIT_ANCHORS_STORE_NAME,
    })).toThrow(/embeddedKey/);
  });

  it('throws on unregistered hostStoreName', () => {
    expect(() => createEmbeddedRecordStore({
      hostStoreName: 'zzz-not-real',
      embeddedKey: 'audit',
    })).toThrow(/migrationRegistry/);
  });

  it('returns expected surface (read + write)', () => {
    const wrapper = createEmbeddedRecordStore({
      hostStoreName: EXPLOIT_ANCHORS_STORE_NAME,
      embeddedKey: 'audit',
    });
    expect(typeof wrapper.read).toBe('function');
    expect(typeof wrapper.write).toBe('function');
    expect(wrapper.hostStoreName).toBe(EXPLOIT_ANCHORS_STORE_NAME);
    expect(wrapper.embeddedKey).toBe('audit');
  });

  it('does NOT expose getAll or getByIndex (host-store concern)', () => {
    const wrapper = createEmbeddedRecordStore({
      hostStoreName: EXPLOIT_ANCHORS_STORE_NAME,
      embeddedKey: 'audit',
    });
    expect(wrapper).not.toHaveProperty('getAll');
    expect(wrapper).not.toHaveProperty('getByIndex');
    expect(wrapper).not.toHaveProperty('delete');
  });
});

describe('createEmbeddedRecordStore — read/write round-trip', () => {
  it('writes an embedded record and reads it back', async () => {
    await getDB();

    // Seed a host record via an upsert wrapper.
    const hostWrapper = createUpsertStore({ storeName: EXPLOIT_ANCHORS_STORE_NAME });
    await hostWrapper.put({ id: 'anchor:1', villainId: 'v', status: 'active' });

    // Now use the embedded-record wrapper.
    const embedded = createEmbeddedRecordStore({
      hostStoreName: EXPLOIT_ANCHORS_STORE_NAME,
      embeddedKey: 'auditPayload',
    });
    const auditRecord = { predictedRate: 0.3, observedRate: 0.4, modelVersion: 'v1.0' };
    await embedded.write('anchor:1', auditRecord);

    const readBack = await embedded.read('anchor:1');
    expect(readBack).toEqual(auditRecord);

    // Confirm the host record still has its own fields.
    const host = await hostWrapper.get('anchor:1');
    expect(host.villainId).toBe('v');
    expect(host.status).toBe('active');
    expect(host.auditPayload).toEqual(auditRecord);
  });

  it('read returns null when host record exists but has no embedded field', async () => {
    await getDB();
    const hostWrapper = createUpsertStore({ storeName: EXPLOIT_ANCHORS_STORE_NAME });
    await hostWrapper.put({ id: 'anchor:nope', villainId: 'v', status: 'active' });

    const embedded = createEmbeddedRecordStore({
      hostStoreName: EXPLOIT_ANCHORS_STORE_NAME,
      embeddedKey: 'auditPayload',
    });
    const read = await embedded.read('anchor:nope');
    expect(read).toBeNull();
  });

  it('read returns null when host record does not exist', async () => {
    await getDB();
    const embedded = createEmbeddedRecordStore({
      hostStoreName: EXPLOIT_ANCHORS_STORE_NAME,
      embeddedKey: 'auditPayload',
    });
    const read = await embedded.read('anchor:ghost');
    expect(read).toBeNull();
  });

  it('write rejects when host record does not exist', async () => {
    await getDB();
    const embedded = createEmbeddedRecordStore({
      hostStoreName: EXPLOIT_ANCHORS_STORE_NAME,
      embeddedKey: 'auditPayload',
    });
    await expect(embedded.write('anchor:absent', { x: 1 })).rejects.toThrow(/not found/);
  });

  it('write rejects on missing hostKey', async () => {
    await getDB();
    const embedded = createEmbeddedRecordStore({
      hostStoreName: EXPLOIT_ANCHORS_STORE_NAME,
      embeddedKey: 'auditPayload',
    });
    await expect(embedded.write(null, { x: 1 })).rejects.toThrow();
    await expect(embedded.write(undefined, { x: 1 })).rejects.toThrow();
  });
});
