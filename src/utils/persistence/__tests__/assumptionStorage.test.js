import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { resetDBPool } from '../database';

// Mock the errorHandler to suppress logs during tests (pattern from handsStorage.test.js)
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
  saveAssumption,
  saveAssumptionBatch,
  loadAssumptionsByVillain,
  loadAllAssumptions,
  loadActiveAssumptions,
  deleteAssumption,
  clearAllAssumptions,
} from '../assumptionStorage';
import { canonicalAssumption } from '../../assumptionEngine/__tests__/fixtures';

beforeEach(() => {
  resetDBPool();
  globalThis.indexedDB = new IDBFactory();
  globalThis.window = { indexedDB: globalThis.indexedDB };
});

afterEach(() => {
  delete globalThis.window;
});

describe('assumptionStorage — CRUD', () => {
  it('saveAssumption + loadAssumptionsByVillain round-trips', async () => {
    const a = canonicalAssumption();
    await saveAssumption(a);
    const loaded = await loadAssumptionsByVillain(a.villainId);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(a.id);
    expect(loaded[0].villainId).toBe(a.villainId);
    expect(loaded[0].claim.predicate).toBe(a.claim.predicate);
  });

  it('saveAssumption rejects malformed assumption', async () => {
    await expect(saveAssumption(null)).rejects.toThrow();
    await expect(saveAssumption({})).rejects.toThrow();
    await expect(saveAssumption({ id: 'x' })).rejects.toThrow(); // missing villainId
  });

  it('saveAssumptionBatch persists multiple in one transaction', async () => {
    const a1 = { ...canonicalAssumption(), id: 'a1' };
    const a2 = { ...canonicalAssumption(), id: 'a2' };
    const a3 = { ...canonicalAssumption(), id: 'a3' };
    await saveAssumptionBatch([a1, a2, a3]);
    const loaded = await loadAssumptionsByVillain(a1.villainId);
    expect(loaded).toHaveLength(3);
  });

  it('loadAssumptionsByVillain returns empty for unknown villain', async () => {
    const loaded = await loadAssumptionsByVillain('nonexistent-villain');
    expect(loaded).toEqual([]);
  });

  it('loadAllAssumptions returns all records', async () => {
    const a1 = { ...canonicalAssumption(), id: 'a1', villainId: 'v1' };
    const a2 = { ...canonicalAssumption(), id: 'a2', villainId: 'v2' };
    await saveAssumption(a1);
    await saveAssumption(a2);
    const loaded = await loadAllAssumptions();
    expect(loaded).toHaveLength(2);
  });

  it('loadActiveAssumptions filters by status === "active"', async () => {
    const active = { ...canonicalAssumption(), id: 'active-1', status: 'active' };
    const retired = { ...canonicalAssumption(), id: 'retired-1', status: 'retired' };
    await saveAssumption(active);
    await saveAssumption(retired);
    const loaded = await loadActiveAssumptions();
    expect(loaded.map((a) => a.id)).toEqual(['active-1']);
  });

  it('deleteAssumption removes a specific record', async () => {
    const a = canonicalAssumption();
    await saveAssumption(a);
    await deleteAssumption(a.villainId, a.id);
    const loaded = await loadAssumptionsByVillain(a.villainId);
    expect(loaded).toEqual([]);
  });

  it('clearAllAssumptions wipes the store', async () => {
    await saveAssumption({ ...canonicalAssumption(), id: 'a1' });
    await saveAssumption({ ...canonicalAssumption(), id: 'a2' });
    await clearAllAssumptions();
    const loaded = await loadAllAssumptions();
    expect(loaded).toEqual([]);
  });

  it('saveAssumption upsert — same compound key overwrites', async () => {
    const original = canonicalAssumption();
    await saveAssumption(original);
    const updated = { ...original, status: 'expiring' };
    await saveAssumption(updated);
    const loaded = await loadAssumptionsByVillain(original.villainId);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].status).toBe('expiring');
  });
});

describe('assumptionStorage — schema migration at load time (I-AE-5)', () => {
  it('loads v1.0 record and migrates to v1.1 shape', async () => {
    // Construct a v1.0 record directly into IDB (bypassing our v1.1-enforcing save helpers).
    const { getDB, VILLAIN_ASSUMPTIONS_STORE_NAME } = await import('../database');
    const db = await getDB();
    const legacyRecord = {
      id: 'legacy-1',
      villainId: 'v-legacy',
      schemaVersion: '1.0',
      // Minimal v1.0 shape — migration will fill in v1.1 required fields
      claim: { predicate: 'foldToCbet', operator: '>=', threshold: 0.70, scope: {
        street: 'flop', position: 'IP', texture: 'dry',
        sprRange: [3, 15], betSizeRange: [0.25, 0.4], playersToAct: 0,
      } },
      evidence: {
        sampleSize: 71, observationCount: 55, pointEstimate: 0.78,
        credibleInterval: { lower: 0.68, upper: 0.86, level: 0.95 },
        prior: { type: 'style', alpha: 14, beta: 10 },
        posteriorConfidence: 0.88,
        lastUpdated: '2026-04-10T12:00:00Z',
        decayHalfLife: 30,
      },
      stability: { acrossSessions: 0.8, acrossTextures: 0.75, acrossStackDepths: 0.82, acrossStreetContext: 0.78, compositeScore: 0.79 },
      recognizability: { triggerDescription: 'Dry flop', conditionsCount: 2, heroCognitiveLoad: 'low', score: 0.85 },
      consequence: { deviationId: 'rangeBetDryFlops', deviationType: 'range-bet', expectedDividend: { mean: 0.47, sd: 0.13, unit: 'bb/100' }, affectedHands: "hero's range" },
      counterExploit: { resistanceScore: 0.82, resistanceSources: [{ factor: 'style-conditioned', weight: 0.7, contribution: 0.5 }], adjustmentCost: 0.2, asymmetricPayoff: 0.38 },
      operator: { target: 'villain', nodeSelector: {}, transform: { actionDistributionDelta: { fold: 0.15, call: -0.12, raise: -0.03 } }, currentDial: 0.78, dialFloor: 0.3, dialCeiling: 0.9 },
      narrative: { humanStatement: 'folds to cbet 78%', citationShort: 'fold 78%', citationLong: 'over 71 decisions', teachingPattern: 'range-bet' },
      quality: { composite: 0.81, actionable: true, thresholds: {}, gatesPassed: {} },
      status: 'active',
      validation: { timesApplied: 0, realizedDividend: 0, calibrationGap: 0, lastValidated: null },
    };

    await new Promise((resolve, reject) => {
      const tx = db.transaction(VILLAIN_ASSUMPTIONS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(VILLAIN_ASSUMPTIONS_STORE_NAME);
      const request = store.put(legacyRecord);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    const loaded = await loadAssumptionsByVillain('v-legacy');
    expect(loaded).toHaveLength(1);
    expect(loaded[0].schemaVersion).toBe('1.1');
    expect(loaded[0].consequence.expectedDividend.unit).toBe('bb per 100 trigger firings');
    expect(loaded[0].consequence.expectedDividend.sharpe).toBeDefined();
    expect(loaded[0].counterExploit.resistanceConfidence).toBeDefined();
    expect(loaded[0].operator.suppresses).toEqual([]);
  });
});
