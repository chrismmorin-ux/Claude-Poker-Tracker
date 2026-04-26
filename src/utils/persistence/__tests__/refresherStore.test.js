// @vitest-environment jsdom
/**
 * refresherStore.test.js — IDB CRUD wrapper tests for PRF v20 stores.
 *
 * Tests round-trip CRUD on `userRefresherConfig` (singleton) + `printBatches`
 * (UUID-keyed append-only). Mirrors `anchorLibraryWrappers.test.js` pattern.
 *
 * PRF Phase 5 — Session 12.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getDB,
  closeDB,
  resetDBPool,
  DB_NAME,
  USER_REFRESHER_CONFIG_STORE_NAME,
  PRINT_BATCHES_STORE_NAME,
} from '../database';
import {
  getRefresherConfig,
  putRefresherConfig,
  putPrintBatch,
  getPrintBatch,
  getAllPrintBatches,
  getPrintBatchesForCard,
} from '../refresherStore';
import {
  buildDefaultRefresherConfig,
  REFRESHER_CONFIG_SINGLETON_ID,
} from '../refresherDefaults';

const deleteEntireDB = () => new Promise((resolve, reject) => {
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
});

const sampleBatch = (id, printedAt, cardIds = ['PRF-MATH-AUTO-PROFIT']) => ({
  batchId: id,
  printedAt,
  label: null,
  cardIds,
  engineVersion: 'v4.7.2',
  appVersion: 'v123',
  perCardSnapshots: cardIds.reduce((acc, c) => {
    acc[c] = { contentHash: `sha256:hash-for-${c}`, version: 'v1.0' };
    return acc;
  }, {}),
  schemaVersion: 1,
});

// ───────────────────────────────────────────────────────────────────────────
// userRefresherConfig CRUD
// ───────────────────────────────────────────────────────────────────────────

describe('refresherStore — getRefresherConfig (singleton)', () => {
  it('returns the migration-seeded default singleton on first read', async () => {
    await getDB();
    const record = await getRefresherConfig();
    expect(record).toEqual(buildDefaultRefresherConfig());
  });

  it('lazy-creates default if singleton is missing (defense-in-depth)', async () => {
    // Force a state where the singleton was never seeded by directly clearing
    // the store after migration. (This simulates a corrupted-DB recovery.)
    await getDB();
    const db = await getDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([USER_REFRESHER_CONFIG_STORE_NAME], 'readwrite');
      tx.objectStore(USER_REFRESHER_CONFIG_STORE_NAME).clear();
      tx.oncomplete = resolve;
      tx.onerror = (e) => reject(e.target.error);
    });

    const record = await getRefresherConfig();
    // Returns default rather than null — defense-in-depth lazy fallback
    expect(record).toEqual(buildDefaultRefresherConfig());
  });
});

describe('refresherStore — putRefresherConfig (singleton)', () => {
  it('round-trips a mutated singleton', async () => {
    await getDB();
    const original = await getRefresherConfig();
    const mutated = {
      ...original,
      printPreferences: { ...original.printPreferences, colorMode: 'bw', cardsPerSheet: 6 },
    };
    await putRefresherConfig(mutated);
    const after = await getRefresherConfig();
    expect(after.printPreferences.colorMode).toBe('bw');
    expect(after.printPreferences.cardsPerSheet).toBe(6);
  });

  it('throws on null record', async () => {
    await getDB();
    await expect(putRefresherConfig(null)).rejects.toThrow(/non-null record/);
  });

  it('throws on missing record.id', async () => {
    await getDB();
    await expect(putRefresherConfig({ schemaVersion: 1 })).rejects.toThrow(/singleton/);
  });

  it('throws on wrong record.id (must be the singleton id)', async () => {
    await getDB();
    await expect(putRefresherConfig({ id: 'other', schemaVersion: 1 })).rejects.toThrow(/singleton/);
  });

  it('only ever writes one singleton record (id-keyed put overwrites)', async () => {
    await getDB();
    await putRefresherConfig({ ...buildDefaultRefresherConfig(), schemaVersion: 99 });
    await putRefresherConfig({ ...buildDefaultRefresherConfig(), schemaVersion: 100 });
    // Verify only 1 record in store
    const db = await getDB();
    const count = await new Promise((resolve, reject) => {
      const tx = db.transaction([USER_REFRESHER_CONFIG_STORE_NAME], 'readonly');
      const req = tx.objectStore(USER_REFRESHER_CONFIG_STORE_NAME).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
    expect(count).toBe(1);
    const record = await getRefresherConfig();
    expect(record.schemaVersion).toBe(100); // last write wins
  });
});

// ───────────────────────────────────────────────────────────────────────────
// printBatches CRUD
// ───────────────────────────────────────────────────────────────────────────

describe('refresherStore — putPrintBatch + getPrintBatch round-trip', () => {
  it('inserts and retrieves a batch by batchId', async () => {
    await getDB();
    const batch = sampleBatch('uuid-1', '2026-04-26T00:00:00Z');
    await putPrintBatch(batch);
    const after = await getPrintBatch('uuid-1');
    expect(after).toEqual(batch);
  });

  it('returns null when batch not found', async () => {
    await getDB();
    const result = await getPrintBatch('non-existent');
    expect(result).toBeNull();
  });

  it('throws on empty batchId in putPrintBatch', async () => {
    await getDB();
    await expect(putPrintBatch({ batchId: '', printedAt: '2026-04-26T00:00:00Z' })).rejects.toThrow(/batchId/);
  });

  it('throws on missing printedAt in putPrintBatch', async () => {
    await getDB();
    await expect(putPrintBatch({ batchId: 'uuid-1', printedAt: '' })).rejects.toThrow(/printedAt/);
  });

  it('throws on null record in putPrintBatch', async () => {
    await getDB();
    await expect(putPrintBatch(null)).rejects.toThrow(/non-null record/);
  });

  it('throws on empty batchId in getPrintBatch', async () => {
    await getDB();
    await expect(getPrintBatch('')).rejects.toThrow(/non-empty string batchId/);
  });
});

describe('refresherStore — getAllPrintBatches (sorted DESC)', () => {
  it('returns empty array on empty store', async () => {
    await getDB();
    const all = await getAllPrintBatches();
    expect(all).toEqual([]);
  });

  it('returns batches sorted by printedAt DESC (most recent first)', async () => {
    await getDB();
    await putPrintBatch(sampleBatch('uuid-old', '2026-01-01T00:00:00Z'));
    await putPrintBatch(sampleBatch('uuid-recent', '2026-04-26T00:00:00Z'));
    await putPrintBatch(sampleBatch('uuid-mid', '2026-02-15T00:00:00Z'));

    const all = await getAllPrintBatches();
    expect(all.map((b) => b.batchId)).toEqual(['uuid-recent', 'uuid-mid', 'uuid-old']);
  });

  it('preserves all batch fields end-to-end', async () => {
    await getDB();
    const batch = sampleBatch('uuid-1', '2026-04-26T00:00:00Z', ['PRF-MATH-AUTO-PROFIT', 'PRF-PREFLOP-CO-OPEN']);
    batch.label = 'first batch';
    await putPrintBatch(batch);

    const all = await getAllPrintBatches();
    expect(all).toHaveLength(1);
    expect(all[0].label).toBe('first batch');
    expect(all[0].cardIds).toEqual(['PRF-MATH-AUTO-PROFIT', 'PRF-PREFLOP-CO-OPEN']);
    expect(all[0].perCardSnapshots['PRF-MATH-AUTO-PROFIT'].contentHash).toBe('sha256:hash-for-PRF-MATH-AUTO-PROFIT');
  });
});

describe('refresherStore — getPrintBatchesForCard', () => {
  it('returns only batches that include the given cardId', async () => {
    await getDB();
    await putPrintBatch(sampleBatch('b1', '2026-01-01T00:00:00Z', ['PRF-MATH-AUTO-PROFIT']));
    await putPrintBatch(sampleBatch('b2', '2026-02-01T00:00:00Z', ['PRF-PREFLOP-CO-OPEN']));
    await putPrintBatch(sampleBatch('b3', '2026-03-01T00:00:00Z', ['PRF-MATH-AUTO-PROFIT', 'PRF-PREFLOP-CO-OPEN']));

    const autoProfitBatches = await getPrintBatchesForCard('PRF-MATH-AUTO-PROFIT');
    expect(autoProfitBatches.map((b) => b.batchId)).toEqual(['b3', 'b1']); // DESC sorted

    const coOpenBatches = await getPrintBatchesForCard('PRF-PREFLOP-CO-OPEN');
    expect(coOpenBatches.map((b) => b.batchId)).toEqual(['b3', 'b2']);
  });

  it('returns empty array when card never printed', async () => {
    await getDB();
    await putPrintBatch(sampleBatch('b1', '2026-01-01T00:00:00Z', ['PRF-MATH-AUTO-PROFIT']));
    const result = await getPrintBatchesForCard('PRF-NEVER-PRINTED');
    expect(result).toEqual([]);
  });

  it('throws on empty cardId', async () => {
    await getDB();
    await expect(getPrintBatchesForCard('')).rejects.toThrow(/non-empty string cardId/);
  });
});

describe('refresherStore — append-only invariant (I-WR-5)', () => {
  it('multiple batches all preserved (no overwrite when batchIds differ)', async () => {
    await getDB();
    for (let i = 0; i < 5; i++) {
      await putPrintBatch(sampleBatch(`batch-${i}`, `2026-04-${String(20 + i).padStart(2, '0')}T00:00:00Z`));
    }
    const all = await getAllPrintBatches();
    expect(all).toHaveLength(5);
    const ids = all.map((b) => b.batchId).sort();
    expect(ids).toEqual(['batch-0', 'batch-1', 'batch-2', 'batch-3', 'batch-4']);
  });

  it('same-batchId put overwrites (last-write-wins for re-replay safety; UI must not call this path)', async () => {
    // Note: this is a primitive — the writers.js layer enforces append-only.
    // At the IDB level, put() is upsert. UI must never call putPrintBatch with
    // a duplicate batchId; the writer layer (W-URC-3) generates fresh UUIDs.
    await getDB();
    await putPrintBatch(sampleBatch('uuid-1', '2026-04-26T00:00:00Z', ['A']));
    await putPrintBatch(sampleBatch('uuid-1', '2026-04-26T00:00:00Z', ['B'])); // overwrite — should not happen via writer
    const all = await getAllPrintBatches();
    expect(all).toHaveLength(1);
    expect(all[0].cardIds).toEqual(['B']);
  });
});
