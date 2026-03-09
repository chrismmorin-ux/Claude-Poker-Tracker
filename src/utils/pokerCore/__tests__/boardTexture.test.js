import { describe, test, expect } from 'vitest';
import { analyzeBoardTexture, analyzeBoardFromStrings } from '../boardTexture';
import { encodeCard } from '../cardParser';

const makeBoard = (...pairs) => pairs.map(([r, s]) => encodeCard(r, s));

describe('boardTexture', () => {
  test('A-K-2 rainbow is dry', () => {
    // A spades, K hearts, 2 diamonds
    const board = makeBoard([12, 0], [11, 1], [0, 2]);
    const result = analyzeBoardTexture(board);
    expect(result.texture).toBe('dry');
    expect(result.rainbow).toBe(true);
    expect(result.isPaired).toBe(false);
    expect(result.flushDraw).toBe(false);
  });

  test('J-T-9 two-tone is wet', () => {
    // J spades, T spades, 9 hearts
    const board = makeBoard([9, 0], [8, 0], [7, 1]);
    const result = analyzeBoardTexture(board);
    expect(result.texture).toBe('wet');
    expect(result.straightPossible).toBe(true);
    expect(result.connected).toBeGreaterThanOrEqual(2);
  });

  test('monotone board has flushDraw', () => {
    const board = makeBoard([12, 0], [8, 0], [3, 0]);
    const result = analyzeBoardTexture(board);
    expect(result.monotone).toBe(true);
    expect(result.flushDraw).toBe(true);
    expect(result.texture).toBe('wet');
  });

  test('paired board detected', () => {
    const board = makeBoard([10, 0], [10, 1], [5, 2]);
    const result = analyzeBoardTexture(board);
    expect(result.isPaired).toBe(true);
  });

  test('trips board detected', () => {
    const board = makeBoard([8, 0], [8, 1], [8, 2]);
    const result = analyzeBoardTexture(board);
    expect(result.isTrips).toBe(true);
  });

  test('returns null for empty board', () => {
    expect(analyzeBoardTexture([])).toBeNull();
    expect(analyzeBoardTexture(null)).toBeNull();
  });

  test('highCardCount counts broadway cards', () => {
    // A, K, Q (all broadway = rank >= 8)
    const board = makeBoard([12, 0], [11, 1], [10, 2]);
    const result = analyzeBoardTexture(board);
    expect(result.highCardCount).toBe(3);
  });

  test('wetScore is between 0 and 100', () => {
    const board = makeBoard([6, 0], [5, 1], [4, 2]);
    const result = analyzeBoardTexture(board);
    expect(result.wetScore).toBeGreaterThanOrEqual(0);
    expect(result.wetScore).toBeLessThanOrEqual(100);
  });

  test('analyzeBoardFromStrings convenience works', () => {
    const result = analyzeBoardFromStrings(['A\u2660', 'K\u2665', '2\u2666']);
    expect(result).not.toBeNull();
    expect(result.texture).toBeDefined();
  });

  // Calibration boards from plan
  describe('board texture calibration', () => {
    test('A72 rainbow is dry', () => {
      const board = makeBoard([12, 0], [5, 1], [0, 2]); // A♠ 7♥ 2♦
      expect(analyzeBoardTexture(board).texture).toBe('dry');
    });

    test('KK3 rainbow is dry', () => {
      const board = makeBoard([11, 0], [11, 1], [1, 2]); // K♠ K♥ 3♦
      expect(analyzeBoardTexture(board).texture).toBe('dry');
    });

    test('876 two-suited is wet', () => {
      const board = makeBoard([6, 0], [5, 0], [4, 1]); // 8♠ 7♠ 6♥
      expect(analyzeBoardTexture(board).texture).toBe('wet');
    });

    test('QJT rainbow is wet', () => {
      const board = makeBoard([10, 0], [9, 1], [8, 2]); // Q♠ J♥ T♦
      const result = analyzeBoardTexture(board);
      expect(result.texture).toBe('wet');
      expect(result.straightPossible).toBe(true);
    });
  });

  describe('4 and 5 card boards', () => {
    test('4-card board with flush draw', () => {
      const board = makeBoard([12, 0], [8, 0], [5, 0], [2, 1]); // A♠ T♠ 7♠ 4♥
      const result = analyzeBoardTexture(board);
      expect(result.flushDraw).toBe(true);
      expect(result.texture).toBe('wet');
    });

    test('5-card board with completed flush', () => {
      const board = makeBoard([12, 0], [10, 0], [7, 0], [5, 0], [2, 1]); // 4 spades + 1 heart
      const result = analyzeBoardTexture(board);
      expect(result.flushComplete).toBe(true);
    });

    test('4-card paired dry board', () => {
      const board = makeBoard([12, 0], [12, 1], [5, 2], [1, 3]); // AA73 rainbow
      const result = analyzeBoardTexture(board);
      expect(result.isPaired).toBe(true);
    });

    test('5-card board with straight', () => {
      const board = makeBoard([8, 0], [7, 1], [6, 2], [5, 3], [2, 0]); // T9876+4
      const result = analyzeBoardTexture(board);
      expect(result.straightPossible).toBe(true);
      expect(result.connected).toBeGreaterThanOrEqual(3);
    });

    test('5-card monotone board is monotone and flushComplete', () => {
      // All five cards in spades: A♠ K♠ 7♠ 4♠ 2♠
      const board = makeBoard([12, 0], [11, 0], [5, 0], [2, 0], [0, 0]);
      const result = analyzeBoardTexture(board);
      expect(result.monotone).toBe(true);
      expect(result.flushComplete).toBe(true);
    });

    test('4-card turn board with completed straight is straightPossible and highly connected', () => {
      // 5♠ 6♥ 7♦ 8♣ — four consecutive cards making a complete straight
      const board = makeBoard([3, 0], [4, 1], [5, 2], [6, 3]);
      const result = analyzeBoardTexture(board);
      expect(result.straightPossible).toBe(true);
      expect(result.connected).toBeGreaterThanOrEqual(3);
    });
  });
});
