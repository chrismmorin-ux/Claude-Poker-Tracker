/**
 * refresherReducer.test.js — per-action coverage for the refresher reducer.
 *
 * PRF Phase 5 — Session 14 (PRF-G5-HK).
 */

import { describe, it, expect } from 'vitest';
import {
  refresherReducer,
  initialRefresherState,
} from '../refresherReducer';
import { REFRESHER_ACTIONS } from '../../constants/refresherConstants';
import { buildDefaultRefresherConfig } from '../../utils/persistence/refresherDefaults';

// ───────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ───────────────────────────────────────────────────────────────────────────

const sampleConfig = (overrides = {}) => ({
  ...buildDefaultRefresherConfig(),
  ...overrides,
});

const sampleBatch = (overrides = {}) => ({
  batchId: 'uuid-1',
  printedAt: '2026-04-26T00:00:00Z',
  label: null,
  cardIds: ['PRF-MATH-AUTO-PROFIT'],
  engineVersion: 'v4.7.2',
  appVersion: 'v123',
  perCardSnapshots: {
    'PRF-MATH-AUTO-PROFIT': { contentHash: 'sha256:abc', version: 'v1.0' },
  },
  schemaVersion: 1,
  ...overrides,
});

// ───────────────────────────────────────────────────────────────────────────
// Initial state
// ───────────────────────────────────────────────────────────────────────────

describe('refresherReducer — initial state', () => {
  it('returns initial state on unknown action', () => {
    const next = refresherReducer(initialRefresherState, { type: 'UNKNOWN' });
    expect(next).toBe(initialRefresherState);
  });

  it('initial state has default config + empty batches + isReady false', () => {
    expect(initialRefresherState.config).toEqual(buildDefaultRefresherConfig());
    expect(initialRefresherState.printBatches).toEqual([]);
    expect(initialRefresherState.isReady).toBe(false);
    expect(initialRefresherState.schemaVersion).toBe('1.0.0');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// REFRESHER_HYDRATED
// ───────────────────────────────────────────────────────────────────────────

describe('refresherReducer — REFRESHER_HYDRATED', () => {
  it('bulk-loads config + printBatches and sets isReady true', () => {
    const config = sampleConfig({ printPreferences: { ...buildDefaultRefresherConfig().printPreferences, colorMode: 'bw' } });
    const printBatches = [sampleBatch()];

    const next = refresherReducer(initialRefresherState, {
      type: REFRESHER_ACTIONS.REFRESHER_HYDRATED,
      payload: { config, printBatches },
    });

    expect(next.config).toBe(config);
    expect(next.printBatches).toBe(printBatches);
    expect(next.isReady).toBe(true);
  });

  it('preserves default config when payload.config is missing', () => {
    const next = refresherReducer(initialRefresherState, {
      type: REFRESHER_ACTIONS.REFRESHER_HYDRATED,
      payload: { printBatches: [] },
    });
    expect(next.config).toBe(initialRefresherState.config);
    expect(next.isReady).toBe(true);
  });

  it('defaults printBatches to [] when payload missing', () => {
    const next = refresherReducer(initialRefresherState, {
      type: REFRESHER_ACTIONS.REFRESHER_HYDRATED,
      payload: { config: sampleConfig() },
    });
    expect(next.printBatches).toEqual([]);
  });

  it('defaults printBatches to [] when payload.printBatches is non-array', () => {
    const next = refresherReducer(initialRefresherState, {
      type: REFRESHER_ACTIONS.REFRESHER_HYDRATED,
      payload: { printBatches: 'not-an-array' },
    });
    expect(next.printBatches).toEqual([]);
  });

  it('handles missing payload entirely (failure-path-still-ready)', () => {
    const next = refresherReducer(initialRefresherState, {
      type: REFRESHER_ACTIONS.REFRESHER_HYDRATED,
      payload: undefined,
    });
    expect(next.isReady).toBe(true);
    expect(next.config).toBe(initialRefresherState.config);
    expect(next.printBatches).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// REFRESHER_CONFIG_REPLACED
// ───────────────────────────────────────────────────────────────────────────

describe('refresherReducer — REFRESHER_CONFIG_REPLACED', () => {
  it('replaces config slice with the writer-returned record', () => {
    const updated = sampleConfig({ printPreferences: { ...buildDefaultRefresherConfig().printPreferences, colorMode: 'bw' } });
    const next = refresherReducer(initialRefresherState, {
      type: REFRESHER_ACTIONS.REFRESHER_CONFIG_REPLACED,
      payload: { config: updated },
    });
    expect(next.config).toBe(updated);
  });

  it('preserves printBatches + isReady through the action', () => {
    const seeded = { ...initialRefresherState, isReady: true, printBatches: [sampleBatch()] };
    const next = refresherReducer(seeded, {
      type: REFRESHER_ACTIONS.REFRESHER_CONFIG_REPLACED,
      payload: { config: sampleConfig() },
    });
    expect(next.printBatches).toBe(seeded.printBatches);
    expect(next.isReady).toBe(true);
  });

  it('returns same-state when payload.config missing', () => {
    const next = refresherReducer(initialRefresherState, {
      type: REFRESHER_ACTIONS.REFRESHER_CONFIG_REPLACED,
      payload: {},
    });
    expect(next).toBe(initialRefresherState);
  });

  it('returns same-state when payload.config has wrong id (defensive)', () => {
    const next = refresherReducer(initialRefresherState, {
      type: REFRESHER_ACTIONS.REFRESHER_CONFIG_REPLACED,
      payload: { config: { id: 'wrong', schemaVersion: 1 } },
    });
    expect(next).toBe(initialRefresherState);
  });

  it('returns same-state when payload.config is null', () => {
    const next = refresherReducer(initialRefresherState, {
      type: REFRESHER_ACTIONS.REFRESHER_CONFIG_REPLACED,
      payload: { config: null },
    });
    expect(next).toBe(initialRefresherState);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// REFRESHER_BATCH_APPENDED
// ───────────────────────────────────────────────────────────────────────────

describe('refresherReducer — REFRESHER_BATCH_APPENDED', () => {
  it('prepends batch to printBatches (most-recent first)', () => {
    const seeded = { ...initialRefresherState, isReady: true };
    const batch = sampleBatch({ batchId: 'uuid-new', printedAt: '2026-05-01T00:00:00Z' });
    const updatedConfig = sampleConfig({ lastExportAt: '2026-05-01T00:00:00Z' });

    const next = refresherReducer(seeded, {
      type: REFRESHER_ACTIONS.REFRESHER_BATCH_APPENDED,
      payload: { batch, updatedConfig },
    });

    expect(next.printBatches[0]).toBe(batch);
    expect(next.printBatches).toHaveLength(1);
  });

  it('updates config slice with lastExportAt from W-URC-3 side effect', () => {
    const seeded = { ...initialRefresherState, isReady: true };
    const batch = sampleBatch();
    const updatedConfig = sampleConfig({ lastExportAt: '2026-04-26T00:00:00Z' });

    const next = refresherReducer(seeded, {
      type: REFRESHER_ACTIONS.REFRESHER_BATCH_APPENDED,
      payload: { batch, updatedConfig },
    });

    expect(next.config.lastExportAt).toBe('2026-04-26T00:00:00Z');
  });

  it('preserves existing batches when prepending', () => {
    const existingBatch = sampleBatch({ batchId: 'uuid-old', printedAt: '2026-01-01T00:00:00Z' });
    const seeded = { ...initialRefresherState, isReady: true, printBatches: [existingBatch] };
    const newBatch = sampleBatch({ batchId: 'uuid-new', printedAt: '2026-05-01T00:00:00Z' });

    const next = refresherReducer(seeded, {
      type: REFRESHER_ACTIONS.REFRESHER_BATCH_APPENDED,
      payload: { batch: newBatch, updatedConfig: sampleConfig() },
    });

    expect(next.printBatches).toHaveLength(2);
    expect(next.printBatches[0]).toBe(newBatch);
    expect(next.printBatches[1]).toBe(existingBatch);
  });

  it('returns same-state when payload.batch missing', () => {
    const next = refresherReducer(initialRefresherState, {
      type: REFRESHER_ACTIONS.REFRESHER_BATCH_APPENDED,
      payload: { updatedConfig: sampleConfig() },
    });
    expect(next).toBe(initialRefresherState);
  });

  it('returns same-state when payload.batch has invalid batchId', () => {
    const next = refresherReducer(initialRefresherState, {
      type: REFRESHER_ACTIONS.REFRESHER_BATCH_APPENDED,
      payload: { batch: { batchId: null }, updatedConfig: sampleConfig() },
    });
    expect(next).toBe(initialRefresherState);
  });

  it('drops duplicate batchId (defense-in-depth) but still updates config', () => {
    const existingBatch = sampleBatch({ batchId: 'uuid-dup' });
    const seeded = { ...initialRefresherState, isReady: true, printBatches: [existingBatch] };
    const updatedConfig = sampleConfig({ lastExportAt: '2026-05-01T00:00:00Z' });

    const next = refresherReducer(seeded, {
      type: REFRESHER_ACTIONS.REFRESHER_BATCH_APPENDED,
      payload: { batch: sampleBatch({ batchId: 'uuid-dup' }), updatedConfig },
    });

    expect(next.printBatches).toHaveLength(1); // not duplicated
    expect(next.config.lastExportAt).toBe('2026-05-01T00:00:00Z'); // config still updated
  });

  it('preserves existing config when updatedConfig missing', () => {
    const seeded = { ...initialRefresherState, isReady: true, config: sampleConfig({ lastExportAt: 'preserved' }) };
    const next = refresherReducer(seeded, {
      type: REFRESHER_ACTIONS.REFRESHER_BATCH_APPENDED,
      payload: { batch: sampleBatch() },
    });
    expect(next.config).toBe(seeded.config);
    expect(next.printBatches).toHaveLength(1);
  });
});
