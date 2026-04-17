import { describe, it, expect } from 'vitest';
import {
  computePlayerStatsFromHands,
  computeAllPlayerStatsFromHands,
} from '../statsRecompute';

const h = (seatPlayers = {}) => ({ seatPlayers });

describe('computePlayerStatsFromHands', () => {
  it('returns zero for empty input', () => {
    expect(computePlayerStatsFromHands(7, [])).toEqual({ handCount: 0 });
    expect(computePlayerStatsFromHands(7, null)).toEqual({ handCount: 0 });
    expect(computePlayerStatsFromHands(7, undefined)).toEqual({ handCount: 0 });
  });

  it('returns zero for non-numeric playerId', () => {
    expect(computePlayerStatsFromHands('7', [h({ 3: 7 })])).toEqual({ handCount: 0 });
    expect(computePlayerStatsFromHands(null, [h({ 3: 7 })])).toEqual({ handCount: 0 });
  });

  it('counts hands where the player occupies any seat', () => {
    const hands = [h({ 3: 7 }), h({ 5: 7 }), h({ 1: 99 }), h({ 3: 7 })];
    expect(computePlayerStatsFromHands(7, hands)).toEqual({ handCount: 3 });
  });

  it('ignores hands with no seatPlayers', () => {
    const hands = [h(), { /* no seatPlayers */ }, h({ 3: 7 })];
    expect(computePlayerStatsFromHands(7, hands)).toEqual({ handCount: 1 });
  });

  it('ignores hands with non-object seatPlayers (defensive)', () => {
    const hands = [{ seatPlayers: null }, { seatPlayers: 'invalid' }, h({ 3: 7 })];
    expect(computePlayerStatsFromHands(7, hands)).toEqual({ handCount: 1 });
  });

  it('counts a hand once even if multiple seats somehow map to the same player', () => {
    // Shouldn't happen in production — but code handles it defensively.
    const hands = [h({ 3: 7, 5: 7 })];
    expect(computePlayerStatsFromHands(7, hands)).toEqual({ handCount: 1 });
  });

  it('does not count hands where seat maps to a different player', () => {
    const hands = [h({ 3: 99 }), h({ 5: 42 })];
    expect(computePlayerStatsFromHands(7, hands)).toEqual({ handCount: 0 });
  });

  it('is idempotent: calling twice yields the same result', () => {
    const hands = [h({ 3: 7 }), h({ 3: 7 }), h({ 3: 99 })];
    const first = computePlayerStatsFromHands(7, hands);
    const second = computePlayerStatsFromHands(7, hands);
    expect(first).toEqual(second);
  });
});

describe('computeAllPlayerStatsFromHands', () => {
  it('returns an empty map for no hands', () => {
    expect(computeAllPlayerStatsFromHands([]).size).toBe(0);
    expect(computeAllPlayerStatsFromHands(null).size).toBe(0);
  });

  it('aggregates handCount per playerId', () => {
    const hands = [
      h({ 3: 7, 5: 42 }),
      h({ 1: 7, 3: 99 }),
      h({ 5: 42 }),
    ];
    const result = computeAllPlayerStatsFromHands(hands);
    expect(result.get(7).handCount).toBe(2);
    expect(result.get(42).handCount).toBe(2);
    expect(result.get(99).handCount).toBe(1);
  });

  it('skips non-numeric seat values', () => {
    const hands = [h({ 3: 7, 5: null, 6: 'invalid' })];
    const result = computeAllPlayerStatsFromHands(hands);
    expect(result.size).toBe(1);
    expect(result.get(7).handCount).toBe(1);
  });

  it('matches computePlayerStatsFromHands for each player', () => {
    const hands = [
      h({ 3: 7 }),
      h({ 3: 7, 5: 42 }),
      h({ 1: 7 }),
      h({ 5: 42 }),
    ];
    const all = computeAllPlayerStatsFromHands(hands);
    expect(all.get(7).handCount).toBe(computePlayerStatsFromHands(7, hands).handCount);
    expect(all.get(42).handCount).toBe(computePlayerStatsFromHands(42, hands).handCount);
  });
});
