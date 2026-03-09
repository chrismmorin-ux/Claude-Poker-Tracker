import { describe, test, expect } from 'vitest';
import { analyzeBoardTexture } from '../boardTexture';
import { encodeCard } from '../cardParser';

// Rank indices: 0=2, 1=3, 2=4, 3=5, 4=6, 5=7, 6=8, 7=9, 8=T, 9=J, 10=Q, 11=K, 12=A
// Suit indices: 0=clubs, 1=diamonds, 2=hearts, 3=spades (arbitrary, just needs to be 0-3)
const makeBoard = (...pairs) => pairs.map(([r, s]) => encodeCard(r, s));

describe('board texture calibration', () => {
  // Dry boards

  test('A72 rainbow → dry', () => {
    // A=12 clubs, 7=5 diamonds, 2=0 hearts — three different suits, no draws
    expect(analyzeBoardTexture(makeBoard([12, 0], [5, 1], [0, 2])).texture).toBe('dry');
  });

  test('AA7 paired → dry', () => {
    // A=12 clubs, A=12 diamonds, 7=5 hearts — paired board with rainbow suits reduces wetScore
    expect(analyzeBoardTexture(makeBoard([12, 0], [12, 1], [5, 2])).texture).toBe('dry');
  });

  test('K83 rainbow → dry', () => {
    // K=11 clubs, 8=6 diamonds, 3=1 hearts — disconnected, rainbow
    expect(analyzeBoardTexture(makeBoard([11, 0], [6, 1], [1, 2])).texture).toBe('dry');
  });

  // Wet boards

  test('JT9 two-tone → wet', () => {
    // J=9 clubs, T=8 clubs, 9=7 diamonds — connected, straight-possible
    expect(analyzeBoardTexture(makeBoard([9, 0], [8, 0], [7, 1])).texture).toBe('wet');
  });

  test('876 two-tone → wet', () => {
    // 8=6 clubs, 7=5 clubs, 6=4 diamonds — connected rundown
    expect(analyzeBoardTexture(makeBoard([6, 0], [5, 0], [4, 1])).texture).toBe('wet');
  });

  test('QJT monotone → wet', () => {
    // Q=10, J=9, T=8 all clubs — flush complete on flop, straight-possible, connected
    expect(analyzeBoardTexture(makeBoard([10, 0], [9, 0], [8, 0])).texture).toBe('wet');
  });

  test('987 monotone → wet', () => {
    // 9=7, 8=6, 7=5 all clubs — monotone rundown
    expect(analyzeBoardTexture(makeBoard([7, 0], [6, 0], [5, 0])).texture).toBe('wet');
  });

  // Medium boards (with looser assertions for borderline cases)

  test('KQ8 two-tone → medium', () => {
    // K=11 clubs, Q=10 clubs, 8=6 diamonds — flush draw, connected KQ but gapped to 8
    const result = analyzeBoardTexture(makeBoard([11, 0], [10, 0], [6, 1]));
    expect(['medium', 'wet']).toContain(result.texture);
  });

  test('T72 two-tone → medium or dry', () => {
    // T=8 clubs, 7=5 clubs, 2=0 diamonds — weak flush draw, disconnected
    const result = analyzeBoardTexture(makeBoard([8, 0], [5, 0], [0, 1]));
    expect(['medium', 'dry']).toContain(result.texture);
  });

  test('AJ5 two-tone → medium', () => {
    // A=12 clubs, J=9 clubs, 5=3 diamonds — flush draw, high cards, but disconnected
    const result = analyzeBoardTexture(makeBoard([12, 0], [9, 0], [3, 1]));
    expect(['medium', 'wet']).toContain(result.texture);
  });

  // Wetness ordering

  test('JT9 wetter than A72', () => {
    const wet = analyzeBoardTexture(makeBoard([9, 0], [8, 0], [7, 1]));
    const dry = analyzeBoardTexture(makeBoard([12, 0], [5, 1], [0, 2]));
    expect(wet.wetScore).toBeGreaterThan(dry.wetScore);
  });

  test('monotone wetter than rainbow', () => {
    // T72 monotone vs T72 rainbow
    const mono = analyzeBoardTexture(makeBoard([8, 0], [5, 0], [0, 0]));
    const rainbow = analyzeBoardTexture(makeBoard([8, 0], [5, 1], [0, 2]));
    expect(mono.wetScore).toBeGreaterThan(rainbow.wetScore);
  });
});
