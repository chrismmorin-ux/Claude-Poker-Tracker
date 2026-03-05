import { describe, test, expect } from 'vitest';
import {
  parseCard, encodeCard, cardRank, cardSuit,
  parseAndEncode, parseBoard,
} from '../cardParser';

describe('cardParser', () => {
  test('parseCard returns correct rank and suit', () => {
    expect(parseCard('A\u2660')).toEqual({ rank: 12, suit: 0 }); // A spades
    expect(parseCard('2\u2663')).toEqual({ rank: 0, suit: 3 }); // 2 clubs
    expect(parseCard('T\u2665')).toEqual({ rank: 8, suit: 1 }); // T hearts
    expect(parseCard('K\u2666')).toEqual({ rank: 11, suit: 2 }); // K diamonds
  });

  test('parseCard returns null for invalid input', () => {
    expect(parseCard('')).toBeNull();
    expect(parseCard(null)).toBeNull();
    expect(parseCard('X!')).toBeNull();
  });

  test('encodeCard and decode roundtrip', () => {
    for (let r = 0; r < 13; r++) {
      for (let s = 0; s < 4; s++) {
        const encoded = encodeCard(r, s);
        expect(cardRank(encoded)).toBe(r);
        expect(cardSuit(encoded)).toBe(s);
      }
    }
  });

  test('encodeCard produces unique values 0-51', () => {
    const seen = new Set();
    for (let r = 0; r < 13; r++) {
      for (let s = 0; s < 4; s++) {
        const val = encodeCard(r, s);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(52);
        expect(seen.has(val)).toBe(false);
        seen.add(val);
      }
    }
    expect(seen.size).toBe(52);
  });

  test('parseAndEncode works for valid cards', () => {
    const val = parseAndEncode('A\u2660');
    expect(val).toBeGreaterThanOrEqual(0);
    expect(cardRank(val)).toBe(12);
    expect(cardSuit(val)).toBe(0);
  });

  test('parseAndEncode returns -1 for invalid', () => {
    expect(parseAndEncode('')).toBe(-1);
  });

  test('parseBoard filters empty strings and invalid cards', () => {
    const board = parseBoard(['A\u2660', '', 'K\u2665', '', '2\u2663']);
    expect(board).toHaveLength(3);
    expect(board.every(c => c >= 0)).toBe(true);
  });

  test('parseBoard handles empty array', () => {
    expect(parseBoard([])).toHaveLength(0);
    expect(parseBoard(null)).toHaveLength(0);
  });
});
