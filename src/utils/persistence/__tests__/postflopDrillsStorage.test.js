import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { resetDBPool } from '../database';

vi.mock('../../errorHandler', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  DEBUG: false,
}));

import {
  savePostflopDrill,
  loadPostflopDrills,
  clearPostflopDrills,
  aggregatePostflopFrameworkAccuracy,
} from '../postflopDrillsStorage';

describe('postflopDrillsStorage', () => {
  beforeEach(() => {
    resetDBPool();
    globalThis.indexedDB = new IDBFactory();
    globalThis.window = { indexedDB: globalThis.indexedDB };
  });

  afterEach(() => {
    delete globalThis.window;
  });

  it('saves and loads drill attempts for a user', async () => {
    const id1 = await savePostflopDrill({
      drillType: 'estimate',
      scenarioKey: 'BTN_open_vs_BB_call_AsKh7d',
      context: { position: 'BTN', action: 'open' },
      opposingContext: { position: 'BB', action: 'call', vs: 'BTN' },
      board: 'As Kh 7d',
      userAnswer: { estimate: 0.25 },
      truth: { topPairPct: 0.30, frameworks: ['range_advantage', 'nut_advantage', 'capped_range_check'] },
      correct: true,
      delta: 0.05,
    }, 'guest');
    expect(id1).toBeGreaterThan(0);

    const id2 = await savePostflopDrill({
      drillType: 'framework',
      scenarioKey: 'UTG_open_6c5h4d',
      context: { position: 'UTG', action: 'open' },
      opposingContext: null,
      board: '6c 5h 4d',
      userAnswer: { picked: ['range_morphology'] },
      truth: { frameworks: ['range_morphology', 'board_tilt'] },
      correct: false,
      delta: null,
    }, 'guest');
    expect(id2).not.toBe(id1);

    const drills = await loadPostflopDrills('guest');
    expect(drills).toHaveLength(2);
    // Newest first
    expect(drills[0].drillType).toBe('framework');
    expect(drills[1].drillType).toBe('estimate');
  });

  it('isolates drills per user', async () => {
    const common = {
      drillType: 'estimate',
      scenarioKey: 'BTN_open_K72',
      context: { position: 'BTN', action: 'open' },
      opposingContext: null,
      board: 'Ks 7h 2d',
      userAnswer: {},
      truth: { frameworks: [] },
      correct: true,
      delta: 0,
    };
    await savePostflopDrill(common, 'guest');
    await savePostflopDrill(common, 'alice');

    expect(await loadPostflopDrills('guest')).toHaveLength(1);
    expect(await loadPostflopDrills('alice')).toHaveLength(1);
  });

  it('clears drills for a user', async () => {
    const common = {
      drillType: 'estimate',
      scenarioKey: 'x',
      context: { position: 'BTN', action: 'open' },
      opposingContext: null,
      board: 'As Kh 7d',
      userAnswer: {},
      truth: { frameworks: [] },
      correct: true,
      delta: 0,
    };
    await savePostflopDrill(common, 'guest');
    await savePostflopDrill({ ...common, scenarioKey: 'y' }, 'guest');

    const cleared = await clearPostflopDrills('guest');
    expect(cleared).toBe(2);
    expect(await loadPostflopDrills('guest')).toHaveLength(0);
  });

  describe('aggregatePostflopFrameworkAccuracy', () => {
    it('computes accuracy per framework', () => {
      const drills = [
        { correct: true,  truth: { frameworks: ['range_advantage', 'nut_advantage'] } },
        { correct: false, truth: { frameworks: ['range_advantage'] } },
        { correct: true,  truth: { frameworks: ['board_tilt'] } },
        { correct: true,  truth: { frameworks: ['board_tilt'] } },
      ];
      const agg = aggregatePostflopFrameworkAccuracy(drills);
      expect(agg.range_advantage).toEqual({ attempts: 2, correct: 1, accuracy: 0.5 });
      expect(agg.nut_advantage).toEqual({ attempts: 1, correct: 1, accuracy: 1 });
      expect(agg.board_tilt).toEqual({ attempts: 2, correct: 2, accuracy: 1 });
    });

    it('handles empty input', () => {
      expect(aggregatePostflopFrameworkAccuracy([])).toEqual({});
    });

    it('handles missing truth.frameworks gracefully', () => {
      const drills = [
        { correct: true, truth: {} },
        { correct: true },
      ];
      expect(aggregatePostflopFrameworkAccuracy(drills)).toEqual({});
    });
  });
});
