// @vitest-environment jsdom
/**
 * rangeLabPersistence.test.js — Range Lab Phase 1 (WS-056).
 *
 * Session-scoped save/load of a painted range, the rangeToString↔parseRangeString
 * round-trip (regression pin), and graceful handling of empty/corrupt storage.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { saveRangeLabState, loadRangeLabState, clearRangeLabState } from '../rangeLabPersistence';
import { createRange, rangeIndex } from '../../pokerCore/rangeMatrix';

const AA = rangeIndex(12, 12, false); // pair index for AA
const AKs = rangeIndex(12, 11, true);

describe('rangeLabPersistence', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('returns null when nothing is saved', () => {
    expect(loadRangeLabState()).toBeNull();
  });

  it('round-trips a painted range (incl. a partial weight) and board', () => {
    const range = createRange();
    range[AA] = 1;
    range[AKs] = 0.5;
    const board = ['K♠', '7♥', '2♦', 'Q♣'];

    expect(saveRangeLabState({ range, board })).toBe(true);

    const loaded = loadRangeLabState();
    expect(loaded).not.toBeNull();
    expect(loaded.board).toEqual(board);
    expect(loaded.range[AA]).toBeCloseTo(1, 6);
    expect(loaded.range[AKs]).toBeCloseTo(0.5, 6);
    // unset cells stay empty
    expect(loaded.range[rangeIndex(0, 1, false)]).toBe(0);
  });

  it('returns null on corrupt payload without throwing', () => {
    window.sessionStorage.setItem('rangelab:painted:v1', '{not json');
    expect(() => loadRangeLabState()).not.toThrow();
    expect(loadRangeLabState()).toBeNull();
  });

  it('clear removes saved state', () => {
    saveRangeLabState({ range: createRange(), board: ['K♠', '7♥', '2♦'] });
    clearRangeLabState();
    expect(loadRangeLabState()).toBeNull();
  });

  it('save is a no-op (false) when range is missing', () => {
    expect(saveRangeLabState({ range: null, board: [] })).toBe(false);
  });
});
