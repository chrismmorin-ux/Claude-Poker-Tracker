import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { resetDBPool } from '../database';

vi.mock('../../errorHandler', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  DEBUG: false,
}));

import {
  savePreflopDrill,
  loadPreflopDrills,
  clearPreflopDrills,
  aggregateFrameworkAccuracy,
} from '../preflopDrillsStorage';

describe('preflopDrillsStorage', () => {
  beforeEach(() => {
    resetDBPool();
    globalThis.indexedDB = new IDBFactory();
    globalThis.window = { indexedDB: globalThis.indexedDB };
  });

  afterEach(() => {
    delete globalThis.window;
  });

  it('saves and loads drill attempts for a user', async () => {
    const id1 = await savePreflopDrill({
      drillType: 'estimate',
      matchupKey: 'AKs_JTs',
      handA: 'AKs',
      handB: 'JTs',
      userAnswer: { estimate: 0.60 },
      truth: { equity: 0.620, frameworks: ['broadway_vs_connector'] },
      correct: true,
      delta: 0.02,
    }, 'guest');
    expect(id1).toBeGreaterThan(0);

    const id2 = await savePreflopDrill({
      drillType: 'framework',
      matchupKey: '77_AKo',
      handA: '77',
      handB: 'AKo',
      userAnswer: { picked: ['race'] },
      truth: { equity: 0.550, frameworks: ['race'] },
      correct: true,
      delta: null,
    }, 'guest');
    expect(id2).not.toBe(id1);

    const drills = await loadPreflopDrills('guest');
    expect(drills).toHaveLength(2);
    // Newest first
    expect(drills[0].drillType).toBe('framework');
    expect(drills[1].drillType).toBe('estimate');
  });

  it('isolates drills per user', async () => {
    await savePreflopDrill({ drillType: 'estimate', matchupKey: 'AA_KK', handA: 'AA', handB: 'KK', userAnswer: {}, truth: { frameworks: [] }, correct: true, delta: 0 }, 'guest');
    await savePreflopDrill({ drillType: 'estimate', matchupKey: 'AA_KK', handA: 'AA', handB: 'KK', userAnswer: {}, truth: { frameworks: [] }, correct: true, delta: 0 }, 'alice');

    expect(await loadPreflopDrills('guest')).toHaveLength(1);
    expect(await loadPreflopDrills('alice')).toHaveLength(1);
  });

  it('clears drills for a user', async () => {
    await savePreflopDrill({ drillType: 'estimate', matchupKey: 'AA_KK', handA: 'AA', handB: 'KK', userAnswer: {}, truth: { frameworks: [] }, correct: true, delta: 0 }, 'guest');
    await savePreflopDrill({ drillType: 'estimate', matchupKey: 'AA_QQ', handA: 'AA', handB: 'QQ', userAnswer: {}, truth: { frameworks: [] }, correct: true, delta: 0 }, 'guest');

    const cleared = await clearPreflopDrills('guest');
    expect(cleared).toBe(2);
    expect(await loadPreflopDrills('guest')).toHaveLength(0);
  });

  describe('aggregateFrameworkAccuracy', () => {
    it('computes accuracy per framework (including delta aggregates)', () => {
      const drills = [
        { correct: true, delta: 0.02, truth: { frameworks: ['race', 'straight_coverage'] } },
        { correct: false, delta: 0.08, truth: { frameworks: ['race'] } },
        { correct: true, delta: 0.01, truth: { frameworks: ['domination'] } },
        { correct: true, delta: 0.03, truth: { frameworks: ['domination'] } },
      ];
      const agg = aggregateFrameworkAccuracy(drills);
      expect(agg.race).toEqual({ attempts: 2, correct: 1, accuracy: 0.5, avgDelta: 0.05, deltaSamples: 2 });
      expect(agg.straight_coverage).toEqual({ attempts: 1, correct: 1, accuracy: 1, avgDelta: 0.02, deltaSamples: 1 });
      expect(agg.domination).toEqual({ attempts: 2, correct: 2, accuracy: 1, avgDelta: 0.02, deltaSamples: 2 });
    });

    it('treats missing/null deltas as unsampled (avgDelta=0, deltaSamples=0)', () => {
      const drills = [
        { correct: true, truth: { frameworks: ['race'] } },          // no delta
        { correct: false, delta: null, truth: { frameworks: ['race'] } }, // null
        { correct: true, delta: 0.04, truth: { frameworks: ['race'] } },  // real
      ];
      const agg = aggregateFrameworkAccuracy(drills);
      expect(agg.race.attempts).toBe(3);
      expect(agg.race.deltaSamples).toBe(1);
      expect(agg.race.avgDelta).toBe(0.04);
    });

    it('handles empty input', () => {
      expect(aggregateFrameworkAccuracy([])).toEqual({});
    });

    it('handles missing truth.frameworks gracefully', () => {
      const drills = [
        { correct: true, truth: {} },
        { correct: true },
      ];
      expect(aggregateFrameworkAccuracy(drills)).toEqual({});
    });
  });
});
