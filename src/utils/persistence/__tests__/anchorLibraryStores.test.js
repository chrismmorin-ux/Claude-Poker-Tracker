// @vitest-environment jsdom
/**
 * anchorLibraryStores.test.js
 *
 * Tests for IDB v19 migration adding the 4 main Exploit Anchor Library stores
 * + 1 drafts sidecar store.
 *
 * Verifies:
 *   - v18 → v19 migration creates all 5 new stores with correct keypaths + indexes
 *   - perceptionPrimitives store seeded with 8 starter primitives (PP-01..PP-08)
 *   - Migration is idempotent (re-running on v19 doesn't duplicate seed)
 *   - v18 stores untouched (additive-only invariant per gate4-p3-decisions §2)
 *   - exploitAnchors / anchorObservations / anchorCandidates start empty (Phase 1 — no seed records)
 *   - Round-trip CRUD on each store
 *
 * EAL Phase 6 Stream D B3 — Session 11 (2026-04-25).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getDB,
  closeDB,
  resetDBPool,
  DB_NAME,
  DB_VERSION,
  EXPLOIT_ANCHORS_STORE_NAME,
  ANCHOR_OBSERVATIONS_STORE_NAME,
  ANCHOR_OBSERVATION_DRAFTS_STORE_NAME,
  ANCHOR_CANDIDATES_STORE_NAME,
  PERCEPTION_PRIMITIVES_STORE_NAME,
  SUBSCRIPTION_STORE_NAME,
  PLAYERS_STORE_NAME,
  STORE_NAME,
} from '../database';
import { PERCEPTION_PRIMITIVE_SEEDS } from '../../anchorLibrary/perceptionPrimitiveSeed';

// Helper: wipe IDB completely between tests for clean migration runs
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

// ───────────────────────────────────────────────────────────────────────────
// DB_VERSION
// ───────────────────────────────────────────────────────────────────────────

describe('DB_VERSION', () => {
  it('is at v20 (after PRF-G5-MIG bumped 19 → 20)', () => {
    expect(DB_VERSION).toBe(20);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// migrateV19 — fresh install: 5 new stores created
// ───────────────────────────────────────────────────────────────────────────

describe('migrateV19 — fresh install creates all 5 EAL stores', () => {
  it('creates exploitAnchors store with correct indexes', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains(EXPLOIT_ANCHORS_STORE_NAME)).toBe(true);

    const tx = db.transaction(EXPLOIT_ANCHORS_STORE_NAME, 'readonly');
    const store = tx.objectStore(EXPLOIT_ANCHORS_STORE_NAME);
    expect(store.keyPath).toBe('id');
    expect(store.indexNames.contains('villainId')).toBe(true);
    expect(store.indexNames.contains('archetypeName')).toBe(true);
    expect(store.indexNames.contains('polarity')).toBe(true);
    expect(store.indexNames.contains('tier')).toBe(true);
    expect(store.indexNames.contains('status')).toBe(true);
    expect(store.indexNames.contains('lastUpdated')).toBe(true);
    expect(store.indexNames.contains('schemaVersion')).toBe(true);
  });

  it('creates anchorObservations store with correct indexes', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains(ANCHOR_OBSERVATIONS_STORE_NAME)).toBe(true);

    const tx = db.transaction(ANCHOR_OBSERVATIONS_STORE_NAME, 'readonly');
    const store = tx.objectStore(ANCHOR_OBSERVATIONS_STORE_NAME);
    expect(store.keyPath).toBe('id');
    expect(store.indexNames.contains('handId')).toBe(true);
    expect(store.indexNames.contains('createdAt')).toBe(true);
    expect(store.indexNames.contains('status')).toBe(true);
    expect(store.indexNames.contains('promotedToCandidateId')).toBe(true);
    expect(store.indexNames.contains('origin')).toBe(true);
  });

  it('creates anchorObservationDrafts (sidecar) store with correct indexes', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains(ANCHOR_OBSERVATION_DRAFTS_STORE_NAME)).toBe(true);

    const tx = db.transaction(ANCHOR_OBSERVATION_DRAFTS_STORE_NAME, 'readonly');
    const store = tx.objectStore(ANCHOR_OBSERVATION_DRAFTS_STORE_NAME);
    expect(store.keyPath).toBe('id');
    expect(store.indexNames.contains('handId')).toBe(true);
    expect(store.indexNames.contains('updatedAt')).toBe(true);
  });

  it('creates anchorCandidates (Phase 2 — empty at v19) store with correct indexes', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains(ANCHOR_CANDIDATES_STORE_NAME)).toBe(true);

    const tx = db.transaction(ANCHOR_CANDIDATES_STORE_NAME, 'readonly');
    const store = tx.objectStore(ANCHOR_CANDIDATES_STORE_NAME);
    expect(store.keyPath).toBe('id');
    expect(store.indexNames.contains('status')).toBe(true);
    expect(store.indexNames.contains('ownerPromotedAt')).toBe(true);
    expect(store.indexNames.contains('archetypeName')).toBe(true);
  });

  it('creates perceptionPrimitives store with multi-entry index on appliesToStyles', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains(PERCEPTION_PRIMITIVES_STORE_NAME)).toBe(true);

    const tx = db.transaction(PERCEPTION_PRIMITIVES_STORE_NAME, 'readonly');
    const store = tx.objectStore(PERCEPTION_PRIMITIVES_STORE_NAME);
    expect(store.keyPath).toBe('id');
    expect(store.indexNames.contains('appliesToStyles')).toBe(true);
    expect(store.indexNames.contains('lastUpdated')).toBe(true);

    // Verify multiEntry on appliesToStyles
    const idx = store.index('appliesToStyles');
    expect(idx.multiEntry).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// migrateV19 — perceptionPrimitives seeded with 8 starter records
// ───────────────────────────────────────────────────────────────────────────

describe('migrateV19 — perceptionPrimitives seeding', () => {
  const getAllPrimitives = async () => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PERCEPTION_PRIMITIVES_STORE_NAME, 'readonly');
      const store = tx.objectStore(PERCEPTION_PRIMITIVES_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  };

  it('seeds exactly 8 primitives (PP-01..PP-08)', async () => {
    const records = await getAllPrimitives();
    expect(records).toHaveLength(8);
  });

  it('seeded ids match PP-01..PP-08 from markdown', async () => {
    const records = await getAllPrimitives();
    const ids = records.map((r) => r.id).sort();
    expect(ids).toEqual([
      'PP-01', 'PP-02', 'PP-03', 'PP-04',
      'PP-05', 'PP-06', 'PP-07', 'PP-08',
    ]);
  });

  it('every seeded record has required fields', async () => {
    const records = await getAllPrimitives();
    for (const record of records) {
      expect(record.id).toMatch(/^PP-\d{2,}$/);
      expect(record.schemaVersion).toBe('pp-v1.0');
      expect(typeof record.name).toBe('string');
      expect(record.name.length).toBeGreaterThanOrEqual(3);
      expect(typeof record.description).toBe('string');
      expect(record.description.length).toBeGreaterThanOrEqual(10);
      expect(Array.isArray(record.appliesToStyles)).toBe(true);
      expect(record.appliesToStyles.length).toBeGreaterThan(0);
      expect(typeof record.cognitiveStep).toBe('string');
    }
  });

  it('every seeded record has Beta(1, 1) prior + initialized validityScore', async () => {
    const records = await getAllPrimitives();
    for (const record of records) {
      expect(record.validityScore.priorAlpha).toBe(1);
      expect(record.validityScore.priorBeta).toBe(1);
      expect(record.validityScore.pointEstimate).toBe(0.5);
      expect(record.validityScore.sampleSize).toBe(0);
      expect(record.validityScore.supportsCount).toBe(0);
      expect(record.validityScore.dependentAnchorCount).toBe(0);
      expect(record.validityScore.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(record.validityScore.credibleInterval.level).toBe(0.95);
    }
  });

  it('PP-01 has correct content (canonical example)', async () => {
    const records = await getAllPrimitives();
    const pp01 = records.find((r) => r.id === 'PP-01');
    expect(pp01).toBeDefined();
    expect(pp01.name).toMatch(/Nit re-weights aggressively/);
    expect(pp01.appliesToStyles).toContain('Nit');
    expect(pp01.appliesToStyles).toContain('TAG');
    expect(pp01.cognitiveStep).toBe('range-reweighting');
    expect(pp01.inverseOf).toBe('PP-03');
  });

  it('PP-04 has correct content (Gate 2 flagged primitive)', async () => {
    const records = await getAllPrimitives();
    const pp04 = records.find((r) => r.id === 'PP-04');
    expect(pp04).toBeDefined();
    expect(pp04.name).toMatch(/off-script aggression/);
    expect(pp04.appliesToStyles).toContain('TAG');
  });

  it('PP-08 applies to all 4 styles (universal primitive)', async () => {
    const records = await getAllPrimitives();
    const pp08 = records.find((r) => r.id === 'PP-08');
    expect(pp08).toBeDefined();
    expect(pp08.appliesToStyles).toContain('Fish');
    expect(pp08.appliesToStyles).toContain('Nit');
    expect(pp08.appliesToStyles).toContain('LAG');
    expect(pp08.appliesToStyles).toContain('TAG');
  });

  it('seed constant matches IDB count exactly', async () => {
    const records = await getAllPrimitives();
    expect(records.length).toBe(PERCEPTION_PRIMITIVE_SEEDS.length);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// migrateV19 — Phase 1 stores start empty
// ───────────────────────────────────────────────────────────────────────────

describe('migrateV19 — Phase 1 stores start empty', () => {
  const countStoreRecords = async (storeName) => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  };

  it('exploitAnchors starts empty (W-EA-1 seed runs separately Phase 6+)', async () => {
    expect(await countStoreRecords(EXPLOIT_ANCHORS_STORE_NAME)).toBe(0);
  });

  it('anchorObservations starts empty (no observations until owner captures)', async () => {
    expect(await countStoreRecords(ANCHOR_OBSERVATIONS_STORE_NAME)).toBe(0);
  });

  it('anchorObservationDrafts starts empty (no drafts until capture modal opens)', async () => {
    expect(await countStoreRecords(ANCHOR_OBSERVATION_DRAFTS_STORE_NAME)).toBe(0);
  });

  it('anchorCandidates starts empty (W-AC-1 placeholder; Phase 2 only)', async () => {
    expect(await countStoreRecords(ANCHOR_CANDIDATES_STORE_NAME)).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// migrateV19 — idempotency (re-open at v19 doesn't duplicate seed)
// ───────────────────────────────────────────────────────────────────────────

describe('migrateV19 — idempotency (EAL-G5-SI target)', () => {
  it('re-opening at v19 does not duplicate primitives', async () => {
    // First open creates the stores + seed
    await getDB();
    closeDB();
    resetDBPool();

    // Second open at same version — should not re-run create or seed
    const db = await getDB();

    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(PERCEPTION_PRIMITIVES_STORE_NAME, 'readonly');
      const store = tx.objectStore(PERCEPTION_PRIMITIVES_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
    expect(records).toHaveLength(8);
  });

  it('all 5 stores exist after re-open at v19', async () => {
    await getDB();
    closeDB();
    resetDBPool();
    const db = await getDB();
    expect(db.objectStoreNames.contains(EXPLOIT_ANCHORS_STORE_NAME)).toBe(true);
    expect(db.objectStoreNames.contains(ANCHOR_OBSERVATIONS_STORE_NAME)).toBe(true);
    expect(db.objectStoreNames.contains(ANCHOR_OBSERVATION_DRAFTS_STORE_NAME)).toBe(true);
    expect(db.objectStoreNames.contains(ANCHOR_CANDIDATES_STORE_NAME)).toBe(true);
    expect(db.objectStoreNames.contains(PERCEPTION_PRIMITIVES_STORE_NAME)).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// migrateV19 — v18 stores untouched (additive-only per gate4-p3-decisions §2)
// ───────────────────────────────────────────────────────────────────────────

describe('migrateV19 — v18 stores untouched (additive-only invariant)', () => {
  it('preserves subscription store from v18', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains(SUBSCRIPTION_STORE_NAME)).toBe(true);
  });

  it('preserves players store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains(PLAYERS_STORE_NAME)).toBe(true);
  });

  it('preserves hands store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains(STORE_NAME)).toBe(true);
  });

  it('preserves villainAssumptions store from v17', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('villainAssumptions')).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// CRUD round-trip verification — write + read on each new store
// ───────────────────────────────────────────────────────────────────────────

describe('CRUD round-trip on EAL stores', () => {
  const writeAndRead = async (storeName, record) => {
    const db = await getDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(record.id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  };

  it('round-trip on exploitAnchors', async () => {
    const record = { id: 'anchor:test:1', archetypeName: 'Test', tier: 2, status: 'active' };
    const fetched = await writeAndRead(EXPLOIT_ANCHORS_STORE_NAME, record);
    expect(fetched).toEqual(record);
  });

  it('round-trip on anchorObservations', async () => {
    const record = { id: 'obs:hand-42:0', handId: 'hand-42', createdAt: '2026-04-25T00:00:00Z', status: 'open' };
    const fetched = await writeAndRead(ANCHOR_OBSERVATIONS_STORE_NAME, record);
    expect(fetched).toEqual(record);
  });

  it('round-trip on anchorObservationDrafts', async () => {
    const record = { id: 'draft:hand-42', handId: 'hand-42', updatedAt: '2026-04-25T00:00:00Z' };
    const fetched = await writeAndRead(ANCHOR_OBSERVATION_DRAFTS_STORE_NAME, record);
    expect(fetched).toEqual(record);
  });

  it('round-trip on anchorCandidates', async () => {
    const record = { id: 'cand:test:1', status: 'pending-owner-review' };
    const fetched = await writeAndRead(ANCHOR_CANDIDATES_STORE_NAME, record);
    expect(fetched).toEqual(record);
  });

  it('round-trip on perceptionPrimitives (overwrites seed)', async () => {
    const record = {
      id: 'PP-01',
      schemaVersion: 'pp-v1.0',
      name: 'Updated name',
      description: 'Updated description for testing CRUD',
      appliesToStyles: ['Nit'],
      cognitiveStep: 'range-reweighting',
      validityScore: {
        pointEstimate: 0.5,
        priorAlpha: 1,
        priorBeta: 1,
        sampleSize: 0,
        supportsCount: 0,
        credibleInterval: { lower: 0.025, upper: 0.975, level: 0.95 },
        lastUpdated: '2026-04-25T00:00:00Z',
        dependentAnchorCount: 0,
      },
    };
    const fetched = await writeAndRead(PERCEPTION_PRIMITIVES_STORE_NAME, record);
    expect(fetched.name).toBe('Updated name');
    expect(fetched.id).toBe('PP-01');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Index query verification — verify multiEntry index on appliesToStyles works
// ───────────────────────────────────────────────────────────────────────────

describe('perceptionPrimitives appliesToStyles multiEntry index', () => {
  it('finds primitives by their constituent style', async () => {
    const db = await getDB();
    const tx = db.transaction(PERCEPTION_PRIMITIVES_STORE_NAME, 'readonly');
    const store = tx.objectStore(PERCEPTION_PRIMITIVES_STORE_NAME);
    const idx = store.index('appliesToStyles');

    // PP-01 + PP-04 + PP-07 + PP-08 all apply to Nit (in some form)
    const nitMatches = await new Promise((resolve, reject) => {
      const req = idx.getAll('Nit');
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
    const ids = nitMatches.map((r) => r.id).sort();
    // Per perception-primitives.md: Nit appears in PP-01, PP-04, PP-07, PP-08
    expect(ids).toContain('PP-01');
    expect(ids).toContain('PP-04');
    expect(ids).toContain('PP-07');
    expect(ids).toContain('PP-08');
  });

  it('finds primitives by Fish style', async () => {
    const db = await getDB();
    const tx = db.transaction(PERCEPTION_PRIMITIVES_STORE_NAME, 'readonly');
    const store = tx.objectStore(PERCEPTION_PRIMITIVES_STORE_NAME);
    const idx = store.index('appliesToStyles');

    const fishMatches = await new Promise((resolve, reject) => {
      const req = idx.getAll('Fish');
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
    const ids = fishMatches.map((r) => r.id).sort();
    // Per markdown: Fish appears in PP-03, PP-05, PP-06, PP-08
    expect(ids).toContain('PP-03');
    expect(ids).toContain('PP-05');
    expect(ids).toContain('PP-06');
    expect(ids).toContain('PP-08');
  });
});
